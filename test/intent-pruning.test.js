const { assert, create, pointerEvent, run } = require('./helpers');

run('registered callbacks prune unobserved rotate during rotate-shaped input', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        pan: { enabled: false },
        pinch: { enabled: false }
    });
    const types = [];

    hand.on('swipe', () => {});
    hand.on('*', detail => types.push(detail.type));

    hand.pointerDown(pointerEvent(node, 1, 100, 100));
    hand.pointerDown(pointerEvent(node, 2, 200, 100));
    t = 60;
    hand.pointerMove(pointerEvent(node, 1, 120, 70));
    t = 120;
    hand.pointerMove(pointerEvent(node, 2, 180, 130));
    t = 180;
    hand.pointerMove(pointerEvent(node, 1, 135, 65));
    hand.pointerUp(pointerEvent(node, 1, 135, 65, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 2, 180, 130, { buttons: 0 }));

    assert.ok(!types.includes('rotatestart'));
    assert.ok(!types.includes('rotate'));
});

run('explicit intent whitelist emits swipe through fast path before normal min time', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        intent: {
            events: ['swipe'],
            fastPathTime: 0.5,
            fastPathSamples: 1
        },
        pan: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        swipe: {
            distanceByFingers: { 1: 70 },
            minTime: 120,
            minSamples: 3,
            confidenceDelay: 0,
            intentDistance: 30
        }
    });
    let swipe = null;

    hand.on('swipe', detail => {
        swipe = detail;
    });

    hand.pointerDown(pointerEvent(node, 1, 20, 40));
    t = 70;
    hand.pointerMove(pointerEvent(node, 1, 120, 40));
    hand.pointerUp(pointerEvent(node, 1, 120, 40, { buttons: 0 }));

    assert.ok(swipe);
    assert.strictEqual(swipe.direction, 'right');
    assert.ok(swipe.intent.pruned);
    assert.deepStrictEqual(swipe.intent.possible.filter(item => item === 'swipe'), ['swipe']);
});

run('explicit empty intent whitelist suppresses semantic gesture commits', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        intent: {
            events: []
        },
        pan: {
            minTime: 0,
            minSamples: 1
        }
    });
    const types = [];

    hand.on('*', detail => types.push(detail.type));

    hand.pointerDown(pointerEvent(node, 1, 20, 40));
    t = 30;
    hand.pointerMove(pointerEvent(node, 1, 120, 40));
    hand.pointerUp(pointerEvent(node, 1, 120, 40, { buttons: 0 }));

    assert.ok(!types.includes('panstart'));
    assert.ok(!types.includes('pan'));
    assert.ok(!types.includes('swipe'));
    assert.ok(types.includes('move'));
    assert.ok(types.includes('end'));
});
