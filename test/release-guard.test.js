const fs = require('fs');
const path = require('path');
const { assert, HandTrick, create, pointerEvent, run } = require('./helpers');

run('runtime version matches package metadata', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'));
    assert.strictEqual(HandTrick.version, pkg.version);
});

run('public event registry contains documented gesture families', () => {
    ['tap', 'swipe', 'pinch', 'rotate', 'wheelzoom', 'ignored'].forEach(type => {
        assert.ok(HandTrick.events.includes(type));
    });
    ['tap', 'swipe', 'pinch', 'rotate', 'wheel'].forEach(type => {
        assert.ok(HandTrick.gestures.includes(type));
    });
});

run('staggered multi-finger release suppresses accidental one-finger swipe', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        intent: {
            events: ['pan', 'swipe']
        },
        pan: {
            threshold: 12,
            minTime: 0,
            minSamples: 1,
            fingers: [1]
        },
        swipe: {
            distanceByFingers: { 1: 50, 2: 120 },
            minTime: 0,
            minSamples: 1
        },
        pinch: { enabled: false },
        rotate: { enabled: false }
    });
    const types = [];

    hand.on('*', detail => types.push(detail.type + ':' + (detail.direction || 'none')));
    hand.on('pan', () => {});
    hand.on('swipe', () => {});

    hand.pointerDown(pointerEvent(node, 1, 100, 100));
    hand.pointerDown(pointerEvent(node, 2, 200, 100));
    t = 20;
    hand.pointerMove(pointerEvent(node, 1, 100, 92));
    hand.pointerMove(pointerEvent(node, 2, 200, 92));
    t = 30;
    hand.pointerUp(pointerEvent(node, 2, 200, 92, { buttons: 0 }));
    t = 70;
    hand.pointerMove(pointerEvent(node, 1, 220, 92));
    hand.pointerUp(pointerEvent(node, 1, 220, 92, { buttons: 0 }));

    assert.ok(!types.some(type => type.indexOf('pan:') === 0));
    assert.ok(!types.some(type => type.indexOf('swipe:') === 0));
});

run('one-finger continuation can start after release guard clears', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        intent: {
            events: ['pan']
        },
        pan: {
            threshold: 12,
            minTime: 0,
            minSamples: 1,
            fingers: [1]
        },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false }
    });
    const pans = [];

    hand.on('pan', detail => pans.push(detail.deltaX));

    hand.pointerDown(pointerEvent(node, 1, 100, 100));
    hand.pointerDown(pointerEvent(node, 2, 200, 100));
    t = 20;
    hand.pointerUp(pointerEvent(node, 2, 200, 100, { buttons: 0 }));
    t = 260;
    hand.pointerMove(pointerEvent(node, 1, 170, 100));
    hand.pointerUp(pointerEvent(node, 1, 170, 100, { buttons: 0 }));

    assert.deepStrictEqual(pans, [70]);
});

run('staggered two-finger tap stays two-finger tap', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        intent: {
            events: ['2fingertap', '1fingertap']
        },
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false }
    });
    let one = 0;
    let two = 0;

    hand.on('1fingertap', () => one++);
    hand.on('2fingertap', () => two++);

    hand.pointerDown(pointerEvent(node, 1, 100, 100));
    hand.pointerDown(pointerEvent(node, 2, 140, 100));
    t = 30;
    hand.pointerUp(pointerEvent(node, 2, 140, 100, { buttons: 0 }));
    t = 80;
    hand.pointerUp(pointerEvent(node, 1, 100, 100, { buttons: 0 }));

    assert.strictEqual(one, 0);
    assert.strictEqual(two, 1);
});

run('three-finger tap does not collapse to rolling or two-finger tap', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        intent: {
            events: ['3fingertap', '2fingertap', 'rollingtap']
        },
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false }
    });
    let two = 0;
    let three = 0;
    let rolling = 0;

    hand.on('2fingertap', () => two++);
    hand.on('3fingertap', () => three++);
    hand.on('rollingtap', () => rolling++);

    hand.pointerDown(pointerEvent(node, 1, 100, 100));
    t = 6;
    hand.pointerDown(pointerEvent(node, 2, 140, 100));
    t = 12;
    hand.pointerDown(pointerEvent(node, 3, 180, 100));
    t = 70;
    hand.pointerUp(pointerEvent(node, 2, 140, 100, { buttons: 0 }));
    t = 90;
    hand.pointerUp(pointerEvent(node, 3, 180, 100, { buttons: 0 }));
    t = 110;
    hand.pointerUp(pointerEvent(node, 1, 100, 100, { buttons: 0 }));

    assert.strictEqual(two, 0);
    assert.strictEqual(rolling, 0);
    assert.strictEqual(three, 1);
});
