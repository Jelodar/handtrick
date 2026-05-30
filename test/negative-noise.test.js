const { assert, create, pointerEvent, run } = require('./helpers');

run('parallel two-finger swipe does not rotate when rotate is registered', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        intent: {
            events: ['swipe', 'rotate']
        },
        pan: { enabled: false },
        pinch: { enabled: false },
        swipe: {
            distanceByFingers: { 2: 60 },
            minTime: 60,
            minSamples: 2
        }
    });
    let rotates = 0;
    let swipes = 0;

    hand.on('rotate', () => rotates++);
    hand.on('swipe:up', () => swipes++);

    hand.pointerDown(pointerEvent(node, 1, 100, 120));
    hand.pointerDown(pointerEvent(node, 2, 200, 120));
    t = 45;
    hand.pointerMove(pointerEvent(node, 1, 100, 55));
    t = 90;
    hand.pointerMove(pointerEvent(node, 2, 200, 55));
    t = 140;
    hand.pointerMove(pointerEvent(node, 1, 100, 20));
    t = 180;
    hand.pointerMove(pointerEvent(node, 2, 200, 20));
    hand.pointerUp(pointerEvent(node, 1, 100, 20, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 2, 200, 20, { buttons: 0 }));

    assert.strictEqual(rotates, 0);
    assert.strictEqual(swipes, 1);
});

run('modifier pan blocks pinch noise from anchor plus action finger', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        intent: {
            events: ['pan:mod', 'pinch']
        },
        pan: { enabled: false },
        rotate: { enabled: false },
        modifier: {
            anchorDelay: 120,
            panDelay: 30,
            panThreshold: 10
        },
        pinch: {
            minTime: 0,
            minSamples: 1,
            distance: 8,
            dominance: 0.2
        }
    });
    const pans = [];
    let pinches = 0;

    hand.on('pan:mod', detail => pans.push(detail.actionDeltaX));
    hand.on('pinch', () => pinches++);

    hand.pointerDown(pointerEvent(node, 1, 80, 80));
    t = 150;
    hand.pointerDown(pointerEvent(node, 2, 120, 80));
    t = 190;
    hand.pointerMove(pointerEvent(node, 2, 160, 80));
    t = 230;
    hand.pointerMove(pointerEvent(node, 2, 190, 80));
    hand.pointerUp(pointerEvent(node, 2, 190, 80, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 1, 80, 80, { buttons: 0 }));

    assert.deepStrictEqual(pans, [40, 70]);
    assert.strictEqual(pinches, 0);
});

run('near-simultaneous second finger remains two-finger tap instead of rolling or modifier', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        intent: {
            events: ['tap:mod', 'rolling', 'tap']
        },
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        modifier: {
            anchorDelay: 180
        }
    });
    let modifier = 0;
    let rolling = 0;
    let tap = 0;

    hand.on('tap:mod', () => modifier++);
    hand.on('rolling', () => rolling++);
    hand.on('tap', { fingers: 2 }, () => tap++);

    hand.pointerDown(pointerEvent(node, 1, 80, 80));
    t = 8;
    hand.pointerDown(pointerEvent(node, 2, 120, 80));
    t = 40;
    hand.pointerUp(pointerEvent(node, 2, 120, 80, { buttons: 0 }));
    t = 100;
    hand.pointerUp(pointerEvent(node, 1, 80, 80, { buttons: 0 }));

    assert.strictEqual(modifier, 0);
    assert.strictEqual(rolling, 0);
    assert.strictEqual(tap, 1);
});

run('staggered nearby two-finger contact is too short for rolling tap', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        intent: {
            events: ['rolling', 'tap']
        },
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false }
    });
    let rolling = 0;
    let tap = 0;

    hand.on('rolling', () => rolling++);
    hand.on('tap', { fingers: 2 }, () => tap++);

    hand.pointerDown(pointerEvent(node, 1, 100, 100));
    t = 70;
    hand.pointerDown(pointerEvent(node, 2, 112, 101));
    t = 115;
    hand.pointerUp(pointerEvent(node, 2, 112, 101, { buttons: 0 }));
    t = 140;
    hand.pointerUp(pointerEvent(node, 1, 100, 100, { buttons: 0 }));

    assert.strictEqual(rolling, 0);
    assert.strictEqual(tap, 1);
});
