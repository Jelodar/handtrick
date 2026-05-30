const defaults = {
    enabled: true,
    input: 'auto',
    touch: true,
    mouse: true,
    pen: true,
    mouseTouchDelay: 700,
    buttons: 1,
    preventDefault: true,
    stopPropagation: false,
    capture: true,
    windowEvents: true,
    ignore: null,
    clock: null,
    rect: 'session',
    dom: {
        enabled: true,
        target: true,
        active: true,
        touchAction: 'none',
        userSelect: 'none',
        webkitUserSelect: 'none',
        webkitTouchCallout: 'none',
        webkitUserDrag: 'none',
        webkitTapHighlightColor: 'transparent',
        selectionGuard: true,
        clearSelection: true,
        tapGuard: true,
        tapGuardDelay: null,
        tapGuardDistance: null,
        overscrollBehavior: 'contain'
    },
    intent: {
        history: 12,
        enabled: true,
        prune: true,
        useListeners: true,
        events: null,
        fastPath: true,
        fastPathMaxCandidates: 2,
        fastPathTime: 0.62,
        fastPathSamples: 1,
        releaseGuard: 180,
        releaseDistance: 34,
        sequenceWindow: 1200,
        sequenceMax: 8
    },
    claim: {
        enabled: true,
        threshold: 0.58,
        preventDefault: true,
        stopPropagation: false
    },
    tap: {
        enabled: true,
        maxTime: 420,
        maxMove: 18,
        interval: 340,
        distance: 80
    },
    tapHold: {
        enabled: true,
        window: 1200,
        distance: 160,
        maxRestTime: 320
    },
    press: {
        enabled: true,
        delay: 500,
        move: 14,
        repeat: 0,
        consumesTap: true,
        allowsPan: false
    },
    pan: {
        enabled: true,
        threshold: 12,
        minTime: 45,
        minSamples: 2,
        fingers: [1],
        axis: 'free',
        canStart: null
    },
    swipe: {
        enabled: true,
        distance: 80,
        distanceByFingers: { 1: 100, 2: 60, 3: 60, 4: 60 },
        velocity: 0.25,
        axisRatio: 1.12,
        confidenceDelay: 80,
        intentDistance: 50,
        minTime: 90,
        minSamples: 2,
        allowAfterPan: true
    },
    pinch: {
        enabled: true,
        distance: 10,
        scale: 0.03,
        minTime: 70,
        minSamples: 2,
        dominance: 0.35
    },
    rotate: {
        enabled: true,
        angle: 8,
        minTime: 130,
        minSamples: 3,
        lateAngle: 22,
        maxSoftStart: 650,
        minAngularVelocity: 0.035,
        requireMovedFingers: true,
        dominance: 0.42,
        confidence: 0.72
    },
    path: {
        enabled: true,
        fingers: [1],
        minDistance: 44,
        segmentDistance: 42,
        axisRatio: 1.35,
        turnAngle: 55,
        maxPause: 650,
        maxSegments: 6,
        maxCircleCount: 6,
        minTime: 80,
        minSamples: 2,
        consume: 'auto'
    },
    rolling: {
        enabled: true,
        fingers: [2, 3, 4],
        minDelay: 10,
        maxDelay: rollingDefaultSeed.maxDelay,
        maxDelayByFingers: ratioMap(rollingDefaultSeed.maxDelay, rollingDefaultRatio.maxDelay),
        keyboardMaxDelay: 500,
        maxHold: rollingDefaultSeed.maxHold,
        maxHoldByFingers: ratioMap(rollingDefaultSeed.maxHold, rollingDefaultRatio.maxHold),
        maxMove: 28,
        minSpan: 24,
        minStep: 10,
        maxGap: rollingDefaultSeed.maxGap,
        maxGapByFingers: ratioMap(rollingDefaultSeed.maxGap, rollingDefaultRatio.maxGap),
        directionRatio: 1.08,
        offAxisRatio: 1.25,
        consumesTap: true
    },
    modifier: {
        enabled: true,
        anchorMove: 10,
        anchorDelay: 180,
        panDelay: 70,
        maxTapTime: 430,
        maxTapMove: 28,
        panThreshold: 12,
        keyboard: {
            enabled: true,
            preventNative: true,
            roles: clone(defaultKeyboardRoles),
            combos: clone(defaultKeyboardCombos)
        }
    },
    pressure: {
        enabled: true,
        threshold: 0.01
    },
    wheel: {
        enabled: true,
        preventDefault: false,
        zoomFactor: 0.0015,
        normalize: true,
        lineHeight: 16,
        pageHeight: 800
    },
    edge: {
        size: 32
    }
};
