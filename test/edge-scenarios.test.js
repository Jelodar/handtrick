const { assert, HandTrick, target, mouseEvent, pointerEvent, create, run } = require('./helpers');

function createMouse(options = {}) {
    const node = target();
    const hand = new HandTrick(node, Object.assign({
        input: 'mouse',
        windowEvents: false,
        preventDefault: false,
        wheel: { enabled: false },
        press: { enabled: false }
    }, options));
    return { node, hand };
}

function tap(hand, node, x, y, extra = {}) {
    hand.mouseDown(mouseEvent(node, x, y, extra));
    hand.mouseUp(mouseEvent(node, x, y, Object.assign({}, extra, { buttons: 0 })));
}

run('static helpers normalize common user input', () => {
    const point = {
        region: 'top-left',
        zone: 'top-left',
        halfRegion: 'left',
        edgeRegion: 'none',
        area: 'inside',
        halfX: 'left',
        halfY: 'top',
        thirdX: 'left',
        thirdY: 'top',
        edge: { top: false, right: false, bottom: false, left: false }
    };

    assert.strictEqual(HandTrick.keyCombo('command+option+shift'), 'shift+alt+meta');
    assert.strictEqual(HandTrick.path('Left>DOWN'), 'left>down');
    assert.strictEqual(HandTrick.path('path:Left>DOWN'), '');
    assert.strictEqual(HandTrick.path('path>left:up'), '');
    assert.strictEqual(HandTrick.region(point, ['right', 'left']), true);
    assert.strictEqual(HandTrick.zone({ ratioX: 0.51, ratioY: 0.99 }, { rows: 5, cols: 2 }).index, 9);
});

run('criteria arrays route multiple regions and finger counts', () => {
    const { node, hand } = createMouse();
    const seen = [];

    hand.when('tap', { region: ['left', 'right'], fingers: [1, 2] }, event => {
        seen.push(event.region);
    });

    tap(hand, node, 20, 20);
    tap(hand, node, 380, 20);

    assert.deepStrictEqual(seen, ['top-left', 'top-right']);
});

run('tap chain distance and interval prevent false double tap', () => {
    let t = 0;
    const { node, hand } = createMouse({ clock: () => t });
    let doubles = 0;

    hand.on('doubletap', () => doubles++);

    tap(hand, node, 20, 20);
    t = 100;
    tap(hand, node, 260, 20);
    t = 1000;
    tap(hand, node, 40, 40);
    t = 1500;
    tap(hand, node, 42, 40);

    assert.strictEqual(doubles, 0);
});

run('open-ended tap aliases emit fourth tap without extra configuration', () => {
    let t = 0;
    const { node, hand } = createMouse({ clock: () => t });
    let four = 0;
    const counts = [];

    hand.on('1finger4tap', detail => {
        four++;
        counts.push(detail.tapCount);
    });

    for (let i = 0; i < 4; i++) {
        tap(hand, node, 80, 80);
        t += 90;
    }

    assert.strictEqual(four, 1);
    assert.deepStrictEqual(counts, [4]);
});

run('path criteria accepts normalized alternatives and rejects wrong turns', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        intent: { events: ['left>down', 'down>right'] },
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        path: {
            minTime: 0,
            minSamples: 1,
            minDistance: 35,
            segmentDistance: 35
        }
    });
    let wrong = 0;
    let matched = 0;
    let criteria = 0;

    hand.on('left>down', () => wrong++);
    hand.on('down>right', () => matched++);
    hand.when('path', { path: ['left>down', 'down>right'] }, () => criteria++);

    hand.pointerDown(pointerEvent(node, 1, 100, 100));
    t = 40;
    hand.pointerMove(pointerEvent(node, 1, 100, 150));
    t = 80;
    hand.pointerMove(pointerEvent(node, 1, 160, 150));
    hand.pointerUp(pointerEvent(node, 1, 160, 150, { buttons: 0 }));

    assert.strictEqual(wrong, 0);
    assert.strictEqual(matched, 1);
    assert.ok(criteria >= 1);
});

run('rolling tap movement cancels rolling recognition', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        intent: { events: ['rollingtap'] },
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        rolling: { maxMove: 10 }
    });
    let rolling = 0;

    hand.on('rollingtap', () => rolling++);

    hand.pointerDown(pointerEvent(node, 1, 100, 100));
    t = 45;
    hand.pointerDown(pointerEvent(node, 2, 132, 100));
    t = 140;
    hand.pointerMove(pointerEvent(node, 2, 150, 100));
    hand.pointerUp(pointerEvent(node, 2, 150, 100, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 1, 100, 100, { buttons: 0 }));

    assert.strictEqual(rolling, 0);
});

run('slow staggered two-finger input remains a normal tap when rolling is unregistered', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        intent: { events: ['2fingertap'] },
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        rolling: { enabled: false },
        modifier: { anchorDelay: 180 }
    });
    let two = 0;
    let rolling = 0;

    hand.on('2fingertap', () => two++);
    hand.on('rollingtap', () => rolling++);

    hand.pointerDown(pointerEvent(node, 1, 100, 100));
    t = 110;
    hand.pointerDown(pointerEvent(node, 2, 130, 100));
    t = 140;
    hand.pointerUp(pointerEvent(node, 2, 130, 100, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 1, 100, 100, { buttons: 0 }));

    assert.strictEqual(two, 1);
    assert.strictEqual(rolling, 0);
});

run('modifier anchor movement cancels modifier pan', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        intent: { events: ['modifierpan'] },
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        modifier: { anchorDelay: 100, anchorMove: 8, panDelay: 0, panThreshold: 8 }
    });
    let pans = 0;

    hand.on('modifierpan', () => pans++);

    hand.pointerDown(pointerEvent(node, 1, 80, 80));
    t = 140;
    hand.pointerDown(pointerEvent(node, 2, 120, 80));
    t = 180;
    hand.pointerMove(pointerEvent(node, 1, 95, 80));
    t = 220;
    hand.pointerMove(pointerEvent(node, 2, 160, 80));
    hand.pointerUp(pointerEvent(node, 2, 160, 80, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 1, 95, 80, { buttons: 0 }));

    assert.strictEqual(pans, 0);
});

run('keyboard modifier combos are exact and do not leak wider combos', () => {
    const { node, hand } = createMouse({
        modifier: {
            keyboard: {
                roles: {
                    modifier: 'shift',
                    twoFingers: null,
                    threeFingers: null,
                    fourFingers: null
                },
                combos: {
                    plain: 'shift',
                    shiftAlt: false,
                    shiftCommand: false,
                    shiftAltCommand: false
                }
            }
        },
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false }
    });
    let modifiers = 0;
    let taps = 0;

    hand.on('modifiertap', () => modifiers++);
    hand.on('tap', () => taps++);

    tap(hand, node, 50, 50, { shiftKey: true, altKey: true });

    assert.strictEqual(modifiers, 0);
    assert.strictEqual(taps, 1);
});

run('disabled keyboard finger role leaves alt tap as one pointer', () => {
    const { node, hand } = createMouse({
        modifier: {
            keyboard: {
                roles: {
                    twoFingers: null
                }
            }
        },
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false }
    });
    let detail = null;

    hand.on('tap', event => {
        detail = event;
    });

    tap(hand, node, 50, 50, { altKey: true });

    assert.ok(detail);
    assert.strictEqual(detail.fingers, 1);
    assert.strictEqual(detail.syntheticFingers, 0);
});

run('wheel page mode uses target height and can prevent native wheel', () => {
    const node = target(400, 300);
    const hand = new HandTrick(node, {
        input: 'mouse',
        windowEvents: false,
        preventDefault: false,
        intent: { events: ['wheelzoom'] },
        wheel: { enabled: true, preventDefault: true, normalize: true, zoomFactor: 0.001 },
        press: { enabled: false }
    });
    let prevented = 0;
    let detail = null;

    hand.on('wheelzoom', event => {
        detail = event;
    });
    hand.wheel(Object.assign(mouseEvent(node, 200, 150), {
        type: 'wheel',
        deltaY: 1,
        deltaMode: 2,
        cancelable: true,
        preventDefault() {
            prevented++;
        }
    }));

    assert.ok(detail);
    assert.strictEqual(detail.deltaY, 300);
    assert.strictEqual(prevented, 1);
});

run('parallel two-finger translation does not become pinch', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        intent: { events: ['pinch'] },
        pan: { enabled: false },
        swipe: { enabled: false },
        rotate: { enabled: false }
    });
    let pinches = 0;

    hand.on('pinch', () => pinches++);
    hand.pointerDown(pointerEvent(node, 1, 100, 100));
    hand.pointerDown(pointerEvent(node, 2, 200, 100));
    t = 40;
    hand.pointerMove(pointerEvent(node, 1, 130, 100));
    hand.pointerMove(pointerEvent(node, 2, 230, 100));
    t = 80;
    hand.pointerMove(pointerEvent(node, 1, 160, 100));
    hand.pointerMove(pointerEvent(node, 2, 260, 100));
    hand.pointerUp(pointerEvent(node, 1, 160, 100, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 2, 260, 100, { buttons: 0 }));

    assert.strictEqual(pinches, 0);
});

run('rotate requires moved-finger proof when configured', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        intent: { events: ['rotate'] },
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { angle: 8, minTime: 0, minSamples: 1, requireMovedFingers: true, confidence: 0.1 }
    });
    let rotates = 0;

    hand.on('rotate', () => rotates++);
    hand.pointerDown(pointerEvent(node, 1, 100, 100));
    hand.pointerDown(pointerEvent(node, 2, 200, 100));
    t = 40;
    hand.pointerMove(pointerEvent(node, 1, 130, 60));
    t = 80;
    hand.pointerMove(pointerEvent(node, 1, 150, 40));
    hand.pointerUp(pointerEvent(node, 1, 150, 40, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 2, 200, 100, { buttons: 0 }));

    assert.strictEqual(rotates, 0);
});

run('pan canStart gate blocks otherwise valid pan', () => {
    let t = 0;
    const { node, hand } = createMouse({
        clock: () => t,
        pan: { threshold: 8, minTime: 0, minSamples: 1, canStart: () => false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false }
    });
    let pans = 0;

    hand.on('pan', () => pans++);
    hand.mouseDown(mouseEvent(node, 20, 20));
    t = 40;
    hand.mouseMove(mouseEvent(node, 80, 20));
    hand.mouseUp(mouseEvent(node, 80, 20, { buttons: 0 }));

    assert.strictEqual(pans, 0);
});

run('ignore function receives target event and instance', () => {
    const node = target();
    const ignored = target();
    ignored.blocked = true;
    let received = false;
    let ignoredCount = 0;
    let hand = null;

    hand = new HandTrick(node, {
        input: 'mouse',
        windowEvents: false,
        preventDefault: false,
        wheel: { enabled: false },
        press: { enabled: false },
        ignore(targetNode, originalEvent, instance) {
            received = targetNode === ignored && originalEvent.target === ignored && instance === hand;
            return !!targetNode.blocked;
        }
    });

    hand.on('ignored', () => ignoredCount++);
    hand.mouseDown(mouseEvent(ignored, 20, 20));

    assert.strictEqual(received, true);
    assert.strictEqual(ignoredCount, 1);
});
