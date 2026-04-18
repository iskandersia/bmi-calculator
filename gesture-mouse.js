/**
 * gesture-mouse.js
 * Controls a virtual cursor using hand gestures detected via MediaPipe Hands.
 *
 * Gestures:
 *   ☝️  One finger (index up)   → Move cursor
 *   🤏  Pinch (index + thumb)   → Left click
 *   ✌️  Two fingers (index + middle up) → Scroll
 *   ✋  Open palm               → Pause / freeze cursor
 */

'use strict';

// ── Constants ────────────────────────────────────────────────────────────────

const SMOOTHING     = 0.18;   // lower = smoother but laggier (0–1)
const PINCH_THRESH  = 0.065;  // normalised distance for pinch detection
const SCROLL_SPEED  = 6;      // pixels scrolled per frame while gesture held
const CLICK_COOLDOWN_MS = 600; // minimum ms between clicks

// MediaPipe landmark indices
const TIP = { THUMB: 4, INDEX: 8, MIDDLE: 12, RING: 16, PINKY: 20 };
const MCP = { THUMB: 2, INDEX: 5, MIDDLE: 9, RING: 13, PINKY: 17 };
const PIP = { INDEX: 6, MIDDLE: 10, RING: 14, PINKY: 18 };

// ── State ────────────────────────────────────────────────────────────────────

let cursorX = window.innerWidth  / 2;
let cursorY = window.innerHeight / 2;
let lastClickTime = 0;
let lastGesture   = '';
let scrollDir     = 0;

// ── DOM refs ─────────────────────────────────────────────────────────────────

const virtualCursor  = document.getElementById('virtual-cursor');
const canvasElement  = document.getElementById('output-canvas');
const canvasCtx      = canvasElement.getContext('2d');
const gestureLabel   = document.getElementById('gesture-label');
const dotCamera      = document.getElementById('dot-camera');
const dotHands       = document.getElementById('dot-hands');
const startOverlay   = document.getElementById('start-overlay');
const startBtn       = document.getElementById('start-btn');

// ── Helpers ───────────────────────────────────────────────────────────────────

function lerp(a, b, t) { return a + (b - a) * t; }

/** Euclidean distance between two normalised landmarks */
function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y, (a.z - b.z) * 0.5);
}

/** Returns true when a finger tip is above its PIP joint (finger extended) */
function isFingerUp(landmarks, tipIdx, pipIdx) {
    return landmarks[tipIdx].y < landmarks[pipIdx].y;
}

/**
 * Classify gesture from landmarks.
 * Returns one of: 'move' | 'click' | 'scroll' | 'pause' | 'none'
 */
function classifyGesture(landmarks) {
    const indexUp  = isFingerUp(landmarks, TIP.INDEX,  PIP.INDEX);
    const middleUp = isFingerUp(landmarks, TIP.MIDDLE, PIP.MIDDLE);
    const ringUp   = isFingerUp(landmarks, TIP.RING,   PIP.RING);
    const pinkyUp  = isFingerUp(landmarks, TIP.PINKY,  PIP.PINKY);

    const pinchDist = dist(landmarks[TIP.THUMB], landmarks[TIP.INDEX]);

    // Pinch → click (index + thumb close, others don't matter)
    if (pinchDist < PINCH_THRESH) return 'click';

    // Open palm (all 4 fingers up) → pause
    if (indexUp && middleUp && ringUp && pinkyUp) return 'pause';

    // Two fingers (index + middle, ring + pinky down) → scroll
    if (indexUp && middleUp && !ringUp && !pinkyUp) return 'scroll';

    // One finger only → move
    if (indexUp && !middleUp && !ringUp && !pinkyUp) return 'move';

    return 'none';
}

/** Move the virtual cursor using smooth interpolation */
function moveCursor(nx, ny) {
    // nx/ny are normalised [0,1] from MediaPipe; mirror X because webcam is mirrored
    const targetX = (1 - nx) * window.innerWidth;
    const targetY =      ny  * window.innerHeight;

    cursorX = lerp(cursorX, targetX, SMOOTHING);
    cursorY = lerp(cursorY, targetY, SMOOTHING);

    virtualCursor.style.left = cursorX + 'px';
    virtualCursor.style.top  = cursorY + 'px';
}

/** Perform a virtual left-click at current cursor position */
function fireClick() {
    const now = Date.now();
    if (now - lastClickTime < CLICK_COOLDOWN_MS) return;
    lastClickTime = now;

    const el = document.elementFromPoint(cursorX, cursorY);
    if (!el) return;

    // Visual feedback
    virtualCursor.classList.add('clicking');
    setTimeout(() => virtualCursor.classList.remove('clicking'), 150);

    // Highlight demo button if hovered
    el.classList.add('clicked');
    setTimeout(() => el.classList.remove('clicked'), 200);

    // Dispatch real click
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

/** Update hover state on interactive elements */
function updateHover() {
    // Remove previous hover
    document.querySelectorAll('.hovered').forEach(el => el.classList.remove('hovered'));

    const el = document.elementFromPoint(cursorX, cursorY);
    if (el && (el.classList.contains('demo-btn') || el.tagName === 'A' || el.tagName === 'BUTTON')) {
        el.classList.add('hovered');
    }
}

/** Update gesture label in HUD */
function updateGestureHUD(gesture) {
    if (gesture === lastGesture) return;
    lastGesture = gesture;

    const labels = {
        move:   '☝️ Перемещение',
        click:  '🤏 Клик',
        scroll: '✌️ Прокрутка',
        pause:  '✋ Пауза',
        none:   '—',
    };
    gestureLabel.textContent = labels[gesture] || '—';
}

// ── MediaPipe Setup ───────────────────────────────────────────────────────────

function onResults(results) {
    // Draw webcam frame
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
        canvasCtx.restore();
        updateGestureHUD('none');
        virtualCursor.style.opacity = '0.3';
        return;
    }

    virtualCursor.style.opacity = '1';
    dotHands.classList.add('active');
    dotHands.classList.remove('error');

    // Use only first detected hand
    const landmarks = results.multiHandLandmarks[0];

    // Draw landmarks
    if (window.drawConnectors && window.drawLandmarks) {
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS,
            { color: 'rgba(124, 106, 255, 0.6)', lineWidth: 2 });
        drawLandmarks(canvasCtx, landmarks,
            { color: '#4ecdc4', lineWidth: 1, radius: 3 });
    }

    canvasCtx.restore();

    const gesture = classifyGesture(landmarks);
    updateGestureHUD(gesture);

    // Index finger tip drives cursor position
    const tip = landmarks[TIP.INDEX];

    switch (gesture) {
        case 'move':
            moveCursor(tip.x, tip.y);
            virtualCursor.classList.remove('clicking', 'scrolling');
            break;

        case 'click':
            moveCursor(tip.x, tip.y);
            virtualCursor.classList.remove('scrolling');
            fireClick();
            break;

        case 'scroll': {
            moveCursor(tip.x, tip.y);
            virtualCursor.classList.add('scrolling');
            virtualCursor.classList.remove('clicking');
            // Direction: index above middle → scroll up, else scroll down
            const idxTip = landmarks[TIP.INDEX];
            const midTip = landmarks[TIP.MIDDLE];
            const dir    = idxTip.y < midTip.y ? -1 : 1;
            window.scrollBy({ top: dir * SCROLL_SPEED, behavior: 'auto' });
            // Also scroll the element under cursor
            const el = document.elementFromPoint(cursorX, cursorY);
            if (el) el.scrollTop += dir * SCROLL_SPEED;
            break;
        }

        case 'pause':
            virtualCursor.classList.remove('clicking', 'scrolling');
            // Cursor stays at last position
            break;

        default:
            moveCursor(tip.x, tip.y);
            virtualCursor.classList.remove('clicking', 'scrolling');
    }

    updateHover();
}

// ── Boot ──────────────────────────────────────────────────────────────────────

async function startApp() {
    startOverlay.style.display = 'none';

    const videoElement = document.createElement('video');
    videoElement.style.display = 'none';
    document.body.appendChild(videoElement);

    // Resize canvas to match container
    const container = document.getElementById('webcam-container');
    canvasElement.width  = 320;
    canvasElement.height = 240;

    // Init MediaPipe Hands
    const hands = new Hands({
        locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
        maxNumHands:           1,
        modelComplexity:       1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence:  0.6,
    });

    hands.onResults(onResults);

    // Camera
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 320, height: 240, facingMode: 'user' },
        });
        videoElement.srcObject = stream;
        videoElement.play();
        dotCamera.classList.add('active');
        dotCamera.classList.remove('error');
    } catch (err) {
        dotCamera.classList.add('error');
        gestureLabel.textContent = '❌ Нет доступа к камере';
        console.error('Camera error:', err);
        return;
    }

    // Use Camera utility if available, otherwise manual loop
    if (window.Camera) {
        const camera = new Camera(videoElement, {
            onFrame: async () => {
                await hands.send({ image: videoElement });
            },
            width: 320,
            height: 240,
        });
        camera.start();
    } else {
        const sendFrame = async () => {
            await hands.send({ image: videoElement });
            requestAnimationFrame(sendFrame);
        };
        videoElement.addEventListener('loadeddata', sendFrame);
    }
}

startBtn.addEventListener('click', startApp);

// ── Demo button interactions ──────────────────────────────────────────────────

document.querySelectorAll('.demo-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        const msg = this.dataset.msg || '✅ Нажато!';
        this.querySelector('.demo-icon').textContent = '✅';
        setTimeout(() => {
            this.querySelector('.demo-icon').textContent = this.dataset.icon;
        }, 800);
    });
});
