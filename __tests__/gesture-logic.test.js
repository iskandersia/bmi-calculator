'use strict';

const {
    PINCH_THRESH,
    TIP,
    PIP,
    lerp,
    dist,
    isFingerUp,
    classifyGesture,
} = require('../gesture-logic');

// ── Landmark factory ──────────────────────────────────────────────────────────

/**
 * Build a 21-element landmark array.
 * All points default to { x:0.5, y:0.5, z:0 }.
 * Pass overrides as { [index]: { x?, y?, z? } }.
 */
function makeLandmarks(overrides = {}) {
    const lm = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
    for (const [idx, val] of Object.entries(overrides)) {
        lm[idx] = { ...lm[idx], ...val };
    }
    return lm;
}

/** Thumb tip far from index tip (no pinch) */
const NO_PINCH = { 4: { x: 0.1, y: 0.8, z: 0 } };

/** Make a finger extended: tip above pip */
function fingerUp(tipIdx, pipIdx) {
    return { [tipIdx]: { y: 0.2 }, [pipIdx]: { y: 0.6 } };
}

/** Make a finger curled: tip below pip */
function fingerDown(tipIdx, pipIdx) {
    return { [tipIdx]: { y: 0.8 }, [pipIdx]: { y: 0.4 } };
}

/** Merge multiple override objects */
function merge(...objs) {
    return Object.assign({}, ...objs);
}

// ── lerp ─────────────────────────────────────────────────────────────────────

describe('lerp', () => {
    test('returns a when t=0', () => {
        expect(lerp(10, 20, 0)).toBe(10);
    });

    test('returns b when t=1', () => {
        expect(lerp(10, 20, 1)).toBe(20);
    });

    test('returns midpoint when t=0.5', () => {
        expect(lerp(0, 100, 0.5)).toBe(50);
    });

    test('works with negative values', () => {
        expect(lerp(-10, 10, 0.5)).toBe(0);
    });

    test('clamps beyond 1 when t > 1', () => {
        expect(lerp(0, 10, 2)).toBe(20);
    });

    test('returns fractional result for non-integer t', () => {
        expect(lerp(0, 10, 0.18)).toBeCloseTo(1.8);
    });
});

// ── dist ─────────────────────────────────────────────────────────────────────

describe('dist', () => {
    test('returns 0 for identical points', () => {
        expect(dist({ x: 0.5, y: 0.5, z: 0 }, { x: 0.5, y: 0.5, z: 0 })).toBe(0);
    });

    test('measures distance in X only', () => {
        const a = { x: 0, y: 0, z: 0 };
        const b = { x: 0.1, y: 0, z: 0 };
        expect(dist(a, b)).toBeCloseTo(0.1);
    });

    test('measures distance in Y only', () => {
        const a = { x: 0, y: 0, z: 0 };
        const b = { x: 0, y: 0.2, z: 0 };
        expect(dist(a, b)).toBeCloseTo(0.2);
    });

    test('Z contributes at half weight', () => {
        const a = { x: 0, y: 0, z: 0 };
        const b = { x: 0, y: 0, z: 0.2 };
        // contribution = (0.2 * 0.5) = 0.1
        expect(dist(a, b)).toBeCloseTo(0.1);
    });

    test('combined XYZ', () => {
        const a = { x: 0, y: 0, z: 0 };
        const b = { x: 0.3, y: 0.4, z: 0 };
        expect(dist(a, b)).toBeCloseTo(0.5);
    });

    test('pinch threshold: very close points → below PINCH_THRESH', () => {
        const a = { x: 0.5, y: 0.5, z: 0 };
        const b = { x: 0.52, y: 0.5, z: 0 }; // 0.02 apart
        expect(dist(a, b)).toBeLessThan(PINCH_THRESH);
    });

    test('pinch threshold: far points → above PINCH_THRESH', () => {
        const a = { x: 0.1, y: 0.8, z: 0 };
        const b = { x: 0.5, y: 0.2, z: 0 };
        expect(dist(a, b)).toBeGreaterThan(PINCH_THRESH);
    });
});

// ── isFingerUp ────────────────────────────────────────────────────────────────

describe('isFingerUp', () => {
    test('returns true when tip.y < pip.y (finger extended)', () => {
        const lm = makeLandmarks({ 8: { y: 0.2 }, 6: { y: 0.6 } });
        expect(isFingerUp(lm, TIP.INDEX, PIP.INDEX)).toBe(true);
    });

    test('returns false when tip.y > pip.y (finger curled)', () => {
        const lm = makeLandmarks({ 8: { y: 0.8 }, 6: { y: 0.4 } });
        expect(isFingerUp(lm, TIP.INDEX, PIP.INDEX)).toBe(false);
    });

    test('returns false when tip.y === pip.y (borderline)', () => {
        const lm = makeLandmarks({ 8: { y: 0.5 }, 6: { y: 0.5 } });
        expect(isFingerUp(lm, TIP.INDEX, PIP.INDEX)).toBe(false);
    });

    test('works for middle finger', () => {
        const lm = makeLandmarks({ 12: { y: 0.1 }, 10: { y: 0.7 } });
        expect(isFingerUp(lm, TIP.MIDDLE, PIP.MIDDLE)).toBe(true);
    });

    test('works for ring finger', () => {
        const lm = makeLandmarks({ 16: { y: 0.9 }, 14: { y: 0.4 } });
        expect(isFingerUp(lm, TIP.RING, PIP.RING)).toBe(false);
    });

    test('works for pinky finger', () => {
        const lm = makeLandmarks({ 20: { y: 0.15 }, 18: { y: 0.55 } });
        expect(isFingerUp(lm, TIP.PINKY, PIP.PINKY)).toBe(true);
    });
});

// ── classifyGesture ───────────────────────────────────────────────────────────

describe('classifyGesture', () => {
    // ── click ────────────────────────────────────────────────────────────────

    describe('click (pinch)', () => {
        test('detects click when thumb and index tips are very close', () => {
            const lm = makeLandmarks({
                [TIP.THUMB]:  { x: 0.5, y: 0.5, z: 0 },
                [TIP.INDEX]:  { x: 0.52, y: 0.5, z: 0 },
            });
            expect(classifyGesture(lm)).toBe('click');
        });

        test('click takes priority over any finger configuration', () => {
            // Even with index extended, pinch wins
            const lm = makeLandmarks({
                ...fingerUp(TIP.INDEX, PIP.INDEX),
                [TIP.THUMB]:  { x: 0.5, y: 0.5, z: 0 },
                [TIP.INDEX]:  { x: 0.52, y: 0.5, z: 0 }, // override y for closeness
            });
            expect(classifyGesture(lm)).toBe('click');
        });

        test('does NOT detect click when thumb and index are far apart', () => {
            const lm = makeLandmarks(merge(
                fingerUp(TIP.INDEX, PIP.INDEX),
                fingerDown(TIP.MIDDLE, PIP.MIDDLE),
                fingerDown(TIP.RING, PIP.RING),
                fingerDown(TIP.PINKY, PIP.PINKY),
                NO_PINCH,
            ));
            expect(classifyGesture(lm)).not.toBe('click');
        });
    });

    // ── move ─────────────────────────────────────────────────────────────────

    describe('move (index only)', () => {
        test('detects move when only index finger is up', () => {
            const lm = makeLandmarks(merge(
                fingerUp(TIP.INDEX, PIP.INDEX),
                fingerDown(TIP.MIDDLE, PIP.MIDDLE),
                fingerDown(TIP.RING, PIP.RING),
                fingerDown(TIP.PINKY, PIP.PINKY),
                NO_PINCH,
            ));
            expect(classifyGesture(lm)).toBe('move');
        });

        test('does NOT detect move when middle is also up', () => {
            const lm = makeLandmarks(merge(
                fingerUp(TIP.INDEX, PIP.INDEX),
                fingerUp(TIP.MIDDLE, PIP.MIDDLE),
                fingerDown(TIP.RING, PIP.RING),
                fingerDown(TIP.PINKY, PIP.PINKY),
                NO_PINCH,
            ));
            expect(classifyGesture(lm)).not.toBe('move');
        });
    });

    // ── scroll ───────────────────────────────────────────────────────────────

    describe('scroll (index + middle)', () => {
        test('detects scroll when index and middle are up, ring and pinky are down', () => {
            const lm = makeLandmarks(merge(
                fingerUp(TIP.INDEX, PIP.INDEX),
                fingerUp(TIP.MIDDLE, PIP.MIDDLE),
                fingerDown(TIP.RING, PIP.RING),
                fingerDown(TIP.PINKY, PIP.PINKY),
                NO_PINCH,
            ));
            expect(classifyGesture(lm)).toBe('scroll');
        });

        test('does NOT detect scroll when ring is also up', () => {
            const lm = makeLandmarks(merge(
                fingerUp(TIP.INDEX, PIP.INDEX),
                fingerUp(TIP.MIDDLE, PIP.MIDDLE),
                fingerUp(TIP.RING, PIP.RING),
                fingerDown(TIP.PINKY, PIP.PINKY),
                NO_PINCH,
            ));
            expect(classifyGesture(lm)).not.toBe('scroll');
        });

        test('does NOT detect scroll when pinky is also up', () => {
            const lm = makeLandmarks(merge(
                fingerUp(TIP.INDEX, PIP.INDEX),
                fingerUp(TIP.MIDDLE, PIP.MIDDLE),
                fingerDown(TIP.RING, PIP.RING),
                fingerUp(TIP.PINKY, PIP.PINKY),
                NO_PINCH,
            ));
            expect(classifyGesture(lm)).not.toBe('scroll');
        });
    });

    // ── pause ─────────────────────────────────────────────────────────────────

    describe('pause (open palm)', () => {
        test('detects pause when all four fingers are up', () => {
            const lm = makeLandmarks(merge(
                fingerUp(TIP.INDEX, PIP.INDEX),
                fingerUp(TIP.MIDDLE, PIP.MIDDLE),
                fingerUp(TIP.RING, PIP.RING),
                fingerUp(TIP.PINKY, PIP.PINKY),
                NO_PINCH,
            ));
            expect(classifyGesture(lm)).toBe('pause');
        });

        test('does NOT detect pause when one finger is down', () => {
            const lm = makeLandmarks(merge(
                fingerUp(TIP.INDEX, PIP.INDEX),
                fingerUp(TIP.MIDDLE, PIP.MIDDLE),
                fingerDown(TIP.RING, PIP.RING),
                fingerUp(TIP.PINKY, PIP.PINKY),
                NO_PINCH,
            ));
            expect(classifyGesture(lm)).not.toBe('pause');
        });
    });

    // ── none ──────────────────────────────────────────────────────────────────

    describe('none (unrecognised gesture)', () => {
        test('returns none when only ring is up', () => {
            const lm = makeLandmarks(merge(
                fingerDown(TIP.INDEX, PIP.INDEX),
                fingerDown(TIP.MIDDLE, PIP.MIDDLE),
                fingerUp(TIP.RING, PIP.RING),
                fingerDown(TIP.PINKY, PIP.PINKY),
                NO_PINCH,
            ));
            expect(classifyGesture(lm)).toBe('none');
        });

        test('returns none when only pinky is up', () => {
            const lm = makeLandmarks(merge(
                fingerDown(TIP.INDEX, PIP.INDEX),
                fingerDown(TIP.MIDDLE, PIP.MIDDLE),
                fingerDown(TIP.RING, PIP.RING),
                fingerUp(TIP.PINKY, PIP.PINKY),
                NO_PINCH,
            ));
            expect(classifyGesture(lm)).toBe('none');
        });

        test('returns none when all fingers are down and no pinch', () => {
            const lm = makeLandmarks(merge(
                fingerDown(TIP.INDEX, PIP.INDEX),
                fingerDown(TIP.MIDDLE, PIP.MIDDLE),
                fingerDown(TIP.RING, PIP.RING),
                fingerDown(TIP.PINKY, PIP.PINKY),
                NO_PINCH,
            ));
            expect(classifyGesture(lm)).toBe('none');
        });

        test('returns none when index + ring are up (non-standard combo)', () => {
            const lm = makeLandmarks(merge(
                fingerUp(TIP.INDEX, PIP.INDEX),
                fingerDown(TIP.MIDDLE, PIP.MIDDLE),
                fingerUp(TIP.RING, PIP.RING),
                fingerDown(TIP.PINKY, PIP.PINKY),
                NO_PINCH,
            ));
            expect(classifyGesture(lm)).toBe('none');
        });
    });

    // ── priority order ────────────────────────────────────────────────────────

    describe('gesture priority', () => {
        test('click beats pause (pinch overrides open palm)', () => {
            // All fingers up but thumb very close to index → pinch wins
            const lm = makeLandmarks(merge(
                fingerUp(TIP.MIDDLE, PIP.MIDDLE),
                fingerUp(TIP.RING, PIP.RING),
                fingerUp(TIP.PINKY, PIP.PINKY),
                {
                    [TIP.INDEX]: { x: 0.5,  y: 0.2, z: 0 },
                    [PIP.INDEX]: { x: 0.5,  y: 0.6, z: 0 },
                    [TIP.THUMB]: { x: 0.52, y: 0.2, z: 0 }, // close to index tip
                },
            ));
            expect(classifyGesture(lm)).toBe('click');
        });
    });
});
