const { assert, create, pointerEvent, run } = require('./helpers');

run('deliberate rotation survives pruning when rotate is whitelisted', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        intent: {
            events: ['rotate']
        },
        pan: { enabled: false },
        pinch: { enabled: false },
        swipe: { enabled: false },
        rotate: {
            minTime: 90,
            minSamples: 2
        }
    });
    const rotations = [];

    hand.on('rotate', detail => rotations.push(detail.rotation));

    hand.pointerDown(pointerEvent(node, 1, 100, 100));
    hand.pointerDown(pointerEvent(node, 2, 200, 100));
    t = 60;
    hand.pointerMove(pointerEvent(node, 1, 110, 80));
    t = 120;
    hand.pointerMove(pointerEvent(node, 2, 190, 120));
    t = 170;
    hand.pointerMove(pointerEvent(node, 1, 120, 70));
    hand.pointerUp(pointerEvent(node, 1, 120, 70, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 2, 190, 120, { buttons: 0 }));

    assert.ok(rotations.length > 0);
    assert.ok(Math.abs(rotations[rotations.length - 1]) > 8);
});

run('pinch keeps continuous scale updates with swipe pruned away', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        intent: {
            events: ['pinch']
        },
        pan: { enabled: false },
        swipe: { enabled: false },
        rotate: { enabled: false },
        pinch: {
            minTime: 40,
            minSamples: 1
        }
    });
    const scales = [];

    hand.on('pinch', detail => scales.push(Number(detail.scale.toFixed(2))));

    hand.pointerDown(pointerEvent(node, 1, 100, 100));
    hand.pointerDown(pointerEvent(node, 2, 200, 100));
    t = 50;
    hand.pointerMove(pointerEvent(node, 1, 80, 100));
    t = 90;
    hand.pointerMove(pointerEvent(node, 2, 220, 100));
    t = 130;
    hand.pointerMove(pointerEvent(node, 1, 70, 100));
    hand.pointerUp(pointerEvent(node, 1, 70, 100, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 2, 220, 100, { buttons: 0 }));

    assert.deepStrictEqual(scales, [1, 1.17, 1.25]);
});

run('tap-hold pan still works when only pan callback is registered', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        input: 'mouse',
        pan: {
            threshold: 10,
            minTime: 0,
            minSamples: 1,
            canStart: detail => detail.tapHold
        },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false }
    });
    const deltas = [];

    hand.on('pan', detail => deltas.push(detail.deltaX));

    hand.mouseDown({
        target: node,
        pageX: 50,
        pageY: 50,
        clientX: 50,
        clientY: 50,
        screenX: 50,
        screenY: 50,
        cancelable: false,
        button: 0,
        buttons: 1,
        pointerType: 'mouse'
    });
    hand.mouseUp({
        target: node,
        pageX: 50,
        pageY: 50,
        clientX: 50,
        clientY: 50,
        screenX: 50,
        screenY: 50,
        cancelable: false,
        button: 0,
        buttons: 0,
        pointerType: 'mouse'
    });
    t = 160;
    hand.mouseDown({
        target: node,
        pageX: 50,
        pageY: 50,
        clientX: 50,
        clientY: 50,
        screenX: 50,
        screenY: 50,
        cancelable: false,
        button: 0,
        buttons: 1,
        pointerType: 'mouse'
    });
    t = 190;
    hand.mouseMove({
        target: node,
        pageX: 80,
        pageY: 50,
        clientX: 80,
        clientY: 50,
        screenX: 80,
        screenY: 50,
        cancelable: false,
        button: 0,
        buttons: 1,
        pointerType: 'mouse'
    });
    hand.mouseUp({
        target: node,
        pageX: 80,
        pageY: 50,
        clientX: 80,
        clientY: 50,
        screenX: 80,
        screenY: 50,
        cancelable: false,
        button: 0,
        buttons: 0,
        pointerType: 'mouse'
    });

    assert.deepStrictEqual(deltas, [30]);
});
