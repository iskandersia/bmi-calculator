/**
 * gesture-logic.js
 * Pure, DOM-free functions for hand-gesture classification.
 * Exported as a CommonJS module so they can be unit-tested with Jest.
 * The same logic is used by gesture-mouse.js in the browser.
 */

'use strict';

// ── Constants ────────────────────────────────────────────────────────────────

const SMOOTHING         = 0.18;
const PINCH_THRESH      = 0.065;
const SCROLL_SPEED      = 6;
const CLICK_COOLDOWN_MS = 600;

// MediaPipe hand landmark indices
const TIP = { THUMB: 4, INDEX: 8, MIDDLE: 12, RING: 16, PINKY: 20 };
const PIP = { INDEX: 6, MIDDLE: 10, RING: 14, PINKY: 18 };

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Linear interpolation */
function lerp(a, b, t) {
    return a + (b - a) * t;
}

/** Euclidean distance between two normalised landmarks (with half-weight on Z) */
function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y, (a.z - b.z) * 0.5);
}

/**
 * Returns true when a finger tip is above its PIP joint (finger extended).
 * In MediaPipe's coordinate system y=0 is the top of the image.
 */
function isFingerUp(landmarks, tipIdx, pipIdx) {
    return landmarks[tipIdx].y < landmarks[pipIdx].y;
}

/**
 * Classify gesture from a MediaPipe 21-landmark array.
 * @returns {'move'|'click'|'scroll'|'pause'|'none'}
 */
function classifyGesture(landmarks) {
    const indexUp  = isFingerUp(landmarks, TIP.INDEX,  PIP.INDEX);
    const middleUp = isFingerUp(landmarks, TIP.MIDDLE, PIP.MIDDLE);
    const ringUp   = isFingerUp(landmarks, TIP.RING,   PIP.RING);
    const pinkyUp  = isFingerUp(landmarks, TIP.PINKY,  PIP.PINKY);

    const pinchDist = dist(landmarks[TIP.THUMB], landmarks[TIP.INDEX]);

    if (pinchDist < PINCH_THRESH)                              return 'click';
    if (indexUp && middleUp && ringUp  && pinkyUp)             return 'pause';
    if (indexUp && middleUp && !ringUp && !pinkyUp)            return 'scroll';
    if (indexUp && !middleUp && !ringUp && !pinkyUp)           return 'move';
    return 'none';
}

// ── Export ────────────────────────────────────────────────────────────────────

module.exports = {
    SMOOTHING,
    PINCH_THRESH,
    SCROLL_SPEED,
    CLICK_COOLDOWN_MS,
    TIP,
    PIP,
    lerp,
    dist,
    isFingerUp,
    classifyGesture,
};
