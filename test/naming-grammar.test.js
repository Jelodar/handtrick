const { assert, HandTrick, target, mouseEvent, pointerEvent, run } = require('./helpers');

function createPointer(options = {}) {
    const node = target();
    const hand = new HandTrick(node, Object.assign({
        input: 'pointer',
        clock: () => 0,
        windowEvents: false,
        preventDefault: false,
        wheel: { enabled: false },
        press: { enabled: false },
        tapHold: { enabled: false },
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false }
    }, options));
    return { node, hand };
}

function twoFingerTap(hand, node, time, x, y) {
    time.value += 10;
    hand.pointerDown(pointerEvent(node, 1, x, y));
    hand.pointerDown(pointerEvent(node, 2, x + 34, y));
    time.value += 30;
    hand.pointerUp(pointerEvent(node, 2, x + 34, y, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 1, x, y, { buttons: 0 }));
}

run('tap count selector is shared by on once and off', () => {
    const time = { value: 0 };
    const { node, hand } = createPointer({
        clock: () => time.value,
        tap: { interval: 320 }
    });
    let calls = 0;
    const handler = () => calls++;

    hand.on('tap:2x', { fingers: 2 }, handler);
    hand.off('tap:2x', handler);
    hand.once('tap:2x', { fingers: 2 }, handler);
    hand.off('tap:2x', handler);
    twoFingerTap(hand, node, time, 80, 80);
    time.value += 100;
    twoFingerTap(hand, node, time, 82, 80);
    assert.strictEqual(calls, 0);

    hand.once('tap:2x', { fingers: 2 }, handler);
    time.value += 500;
    twoFingerTap(hand, node, time, 90, 90);
    time.value += 100;
    twoFingerTap(hand, node, time, 92, 90);
    time.value += 500;
    twoFingerTap(hand, node, time, 110, 90);
    time.value += 100;
    twoFingerTap(hand, node, time, 112, 90);
    assert.strictEqual(calls, 1);
});

run('reordered modifier swipe and rolling selectors dispatch canonical detail types', () => {
    let t = 0;
    const node = target();
    const hand = new HandTrick(node, {
        input: 'pointer',
        clock: () => t,
        windowEvents: false,
        preventDefault: false,
        wheel: { enabled: false },
        press: { enabled: false },
        tapHold: { enabled: false },
        pan: { enabled: false },
        swipe: {
            distanceByFingers: { 1: 60 },
            minTime: 0,
            minSamples: 1,
            velocity: 0.01
        },
        pinch: { enabled: false },
        rotate: { enabled: false }
    });
    const seen = [];

    hand.on('pan:start:mod', detail => seen.push(detail.type));
    hand.on('swipe:left', { speed: 'flick' }, detail => seen.push(detail.type + ':' + detail.speed));
    hand.on('rolling:right', { fingers: 3 }, detail => seen.push(detail.type + ':' + detail.fingers));

    hand.pointerDown(pointerEvent(node, 1, 30, 30));
    t = 220;
    hand.pointerDown(pointerEvent(node, 2, 140, 30));
    t = 300;
    hand.pointerMove(pointerEvent(node, 2, 190, 30));
    hand.pointerUp(pointerEvent(node, 2, 190, 30, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 1, 30, 30, { buttons: 0 }));

    t = 600;
    hand.pointerDown(pointerEvent(node, 3, 260, 120));
    t = 620;
    hand.pointerMove(pointerEvent(node, 3, 150, 120));
    hand.pointerUp(pointerEvent(node, 3, 150, 120, { buttons: 0 }));

    t = 900;
    hand.pointerDown(pointerEvent(node, 4, 40, 200));
    t = 950;
    hand.pointerDown(pointerEvent(node, 5, 80, 200));
    t = 1000;
    hand.pointerDown(pointerEvent(node, 6, 120, 200));
    t = 1040;
    hand.pointerUp(pointerEvent(node, 6, 120, 200, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 5, 80, 200, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 4, 40, 200, { buttons: 0 }));

    assert.ok(seen.includes('pan:mod:start'));
    assert.ok(seen.includes('swipe:left:flick'));
    assert.ok(seen.includes('rolling:right:3'));
});

run('swipe finger criteria dispatch canonical detail types', () => {
    let t = 0;
    const { node, hand } = createPointer({
        clock: () => t,
        swipe: {
            enabled: true,
            distanceByFingers: { 2: 50 },
            minTime: 0,
            minSamples: 1,
            velocity: 0.01
        }
    });
    const seen = [];

    hand.on('swipe:right', () => seen.push('generic'));
    hand.on('swipe:right', { fingers: 2 }, detail => seen.push(detail.type + ':' + detail.fingers));

    hand.pointerDown(pointerEvent(node, 1, 80, 80));
    hand.pointerDown(pointerEvent(node, 2, 140, 80));
    t = 40;
    hand.pointerMove(pointerEvent(node, 1, 160, 80));
    hand.pointerMove(pointerEvent(node, 2, 220, 80));
    hand.pointerUp(pointerEvent(node, 2, 220, 80, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 1, 160, 80, { buttons: 0 }));

    assert.deepStrictEqual(seen, ['swipe:right:2']);
});

run('finger and speed selector sugar is invalid', () => {
    ['swipe:right:2f', 'swipe:flick:right', 'swipe:normal:right', 'swipe:slow:right', 'tap:2f', 'tap:2f:2x', 'rolling:3f:right'].forEach(type => {
        assert.strictEqual(HandTrick.isEvent(type), false);
    });
});

run('unknown criteria keys never broaden a handler', () => {
    const detail = {
        type: 'swipe:right',
        region: 'right',
        direction: 'right',
        speed: 'normal',
        fingers: 1,
        gestureSequence: {
            gestures: [{
                event: 'tap',
                gesture: 'tap',
                family: 'tap',
                direction: 'none',
                fingers: 1,
                center: { region: 'right' }
            }]
        }
    };

    assert.strictEqual(HandTrick.matches(detail, { speed: 'normal' }), true);
    assert.strictEqual(HandTrick.matches(detail, { flick: true }), false);
    assert.strictEqual(HandTrick.matches(detail, { sequence: [] }), false);
    assert.strictEqual(HandTrick.matches(detail, { sequence: { steps: [{ nope: true }] } }), false);
});

run('swipe speed criteria separate slow normal and flick releases', () => {
    const cases = [
        { name: 'slow', threshold: 2, duration: 100 },
        { name: 'normal', threshold: 0.5, duration: 100 },
        { name: 'flick', threshold: 0.25, duration: 100 }
    ];

    cases.forEach(item => {
        let t = 0;
        const { node, hand } = createPointer({
            clock: () => t,
            swipe: {
                enabled: true,
                distanceByFingers: { 1: 50 },
                minTime: 0,
                minSamples: 1,
                velocity: item.threshold
            }
        });
        const seen = [];

        hand.on('swipe:right', { speed: item.name }, detail => seen.push(detail.speed));
        hand.on('swipe:right', { flick: true }, detail => seen.push('old:' + detail.speed));

        hand.pointerDown(pointerEvent(node, 1, 20, 80));
        t = item.duration;
        hand.pointerMove(pointerEvent(node, 1, 100, 80));
        hand.pointerUp(pointerEvent(node, 1, 100, 80, { buttons: 0 }));

        assert.deepStrictEqual(seen, [item.name]);
    });
});

run('modifier plus multi-finger swipe uses criteria for fingers', () => {
    let t = 0;
    const { node, hand } = createPointer({
        clock: () => t,
        swipe: {
            enabled: true,
            distanceByFingers: { 2: 50 },
            minTime: 0,
            minSamples: 1,
            velocity: 0.01
        }
    });
    let matched = null;

    hand.on('swipe:mod:right', { fingers: 2 }, detail => {
        matched = detail;
    });

    hand.pointerDown(pointerEvent(node, 1, 80, 80, { shiftKey: true }));
    t = 20;
    hand.pointerDown(pointerEvent(node, 2, 140, 80, { shiftKey: true }));
    t = 70;
    hand.pointerMove(pointerEvent(node, 1, 160, 80, { shiftKey: true }));
    hand.pointerMove(pointerEvent(node, 2, 220, 80, { shiftKey: true }));
    hand.pointerUp(pointerEvent(node, 2, 220, 80, { buttons: 0, shiftKey: true }));
    hand.pointerUp(pointerEvent(node, 1, 160, 80, { buttons: 0, shiftKey: true }));

    assert.ok(matched);
    assert.strictEqual(matched.type, 'swipe:mod:right');
    assert.strictEqual(matched.fingers, 2);
    assert.strictEqual(matched.modified, true);
    assert.strictEqual(matched.keyCombo, 'shift');
});

run('invalid and removed selectors are opaque and do not activate recognizers', () => {
    let t = 0;
    const node = target();
    const hand = new HandTrick(node, {
        input: 'mouse',
        clock: () => t,
        windowEvents: false,
        preventDefault: false,
        wheel: { enabled: false },
        press: { enabled: false },
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false }
    });
    let oldDouble = 0;
    let canonicalDouble = 0;

    hand.on('tap:2f:3f', () => oldDouble++);
    hand.on('rotate:clockwise', () => oldDouble++);
    hand.on('tap:mod:1f', () => oldDouble++);
    hand.on('doubletap', () => oldDouble++);
    hand.on('tap:2x', () => canonicalDouble++);

    hand.mouseDown(mouseEvent(node, 70, 70));
    hand.mouseUp(mouseEvent(node, 70, 70, { buttons: 0 }));
    t = 100;
    hand.mouseDown(mouseEvent(node, 72, 70));
    hand.mouseUp(mouseEvent(node, 72, 70, { buttons: 0 }));

    assert.strictEqual(oldDouble, 0);
    assert.strictEqual(canonicalDouble, 1);

    const inert = new HandTrick(target(), {
        input: 'mouse',
        windowEvents: false,
        preventDefault: false,
        wheel: { enabled: false },
        press: { enabled: false }
    });
    inert.on('path:left>right', () => {});
    inert.on('tap:swipe', () => {});
    inert.on('pan:mod:move', () => {});
    inert.on('swipe:2f:3f:right', () => {});
    inert.on('circle:2x:3x', () => {});
    inert.on('circle:2f:3f', () => {});
    inert.on('circle:cw:ccw', () => {});
    inert.on('right>circle:2x:3x', () => {});
    inert.on('right>circle:2f:3f', () => {});
    inert.on('right>circle:clockwise', () => {});
    assert.deepStrictEqual(inert.getIntentState().groups, []);
});

run('sequence payloads use canonical selector names only', () => {
    let t = 0;
    const node = target();
    const hand = new HandTrick(node, {
        input: 'mouse',
        clock: () => t,
        windowEvents: false,
        preventDefault: false,
        wheel: { enabled: false },
        press: { enabled: false },
        tapHold: { enabled: false },
        pan: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        swipe: {
            distanceByFingers: { 1: 60 },
            minTime: 0,
            minSamples: 1
        }
    });
    let detail = null;

    hand.on('tap:2x>swipe:left', event => {
        detail = event;
    });

    hand.mouseDown(mouseEvent(node, 200, 100));
    hand.mouseUp(mouseEvent(node, 200, 100, { buttons: 0 }));
    t = 120;
    hand.mouseDown(mouseEvent(node, 202, 100));
    hand.mouseUp(mouseEvent(node, 202, 100, { buttons: 0 }));
    t = 240;
    hand.mouseDown(mouseEvent(node, 210, 100));
    t = 300;
    hand.mouseMove(mouseEvent(node, 120, 100));
    hand.mouseUp(mouseEvent(node, 120, 100, { buttons: 0 }));

    assert.ok(detail);
    assert.strictEqual(detail.type, 'tap:2x>swipe:left');
    assert.deepStrictEqual(detail.sequence, ['tap', 'tap', 'swipe']);
    assert.deepStrictEqual(detail.gestureSequence.pattern, ['tap:2x', 'swipe:left']);
    assert.deepStrictEqual(detail.gestureSequence.gestures.map(item => item.event), ['tap:1x', 'tap:2x', 'swipe:left']);
});
