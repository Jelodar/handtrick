const fs = require('fs');
const path = require('path');
const { assert, HandTrick, create, pointerEvent, run } = require('./helpers');

run('public event registry contains documented gesture families', () => {
    ['tap', 'swipe', 'swipe:mod', 'swipe:mod:left', 'pinch', 'pinch:mod', 'rotate', 'rotate:mod', 'path', 'circle', 'circle:cw', 'circle:ccw', 'arc', 'arc:up', 'wheel:zoom', 'input:ignored'].forEach(type => {
        assert.ok(HandTrick.events.includes(type));
    });
    ['swipe:flick', 'swipe:flick:left', 'swipe:slow:right', 'swipe:normal:right', 'circle:2f', 'circle:2f:cw', 'circle:2f:2x', 'swipe:2f', 'swipe:2f:left', 'swipe:flick:2f:left', 'swipe:mod:2f:left'].forEach(type => {
        assert.ok(!HandTrick.events.includes(type));
        assert.strictEqual(HandTrick.isEvent(type), false);
    });
    assert.strictEqual(HandTrick.event('up>circle:2f:ccw'), '');
    assert.strictEqual(HandTrick.isEvent('circle:4x'), true);
    assert.strictEqual(HandTrick.events.includes('circle:4x'), false);
    assert.strictEqual(HandTrick.isEvent('tap:swipe'), false);
    ['tap', 'press', 'pan', 'swipe', 'pinch', 'rotate', 'path', 'rolling', 'modifier', 'pressure', 'wheel'].forEach(type => {
        assert.ok(HandTrick.recognizers.includes(type));
    });
    ['circle', 'arc', 'pressure'].forEach(type => {
        assert.ok(HandTrick.families.includes(type));
    });
    assert.strictEqual('commonEvents' in HandTrick, false);
    assert.strictEqual('gestures' in HandTrick, false);
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
            events: ['tap']
        },
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false }
    });
    let one = 0;
    let two = 0;

    hand.on('tap', { fingers: 1 }, () => one++);
    hand.on('tap', { fingers: 2 }, () => two++);

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
            events: ['tap', 'rolling']
        },
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false }
    });
    let two = 0;
    let three = 0;
    let rolling = 0;

    hand.on('tap', { fingers: 2 }, () => two++);
    hand.on('tap', { fingers: 3 }, () => three++);
    hand.on('rolling', () => rolling++);

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
