const { assert, HandTrick, create, target, mouseEvent, pointerEvent, run } = require('./helpers');

run('constructor factory and setOptions accept preset shorthand', () => {
    const node = target();
    const hand = new HandTrick(node, 'media');

    assert.strictEqual(hand.options.rotate.enabled, false);
    assert.strictEqual(hand.options[0], undefined);
    assert.strictEqual(HandTrick.path('left>down'), 'left>down');
    assert.strictEqual(HandTrick.path('path:left>down'), '');
    assert.strictEqual(HandTrick.path('path>left>down'), '');
    assert.strictEqual(HandTrick.path(['Left', 'DOWN']), 'left>down');

    hand.setOptions(['viewer', { swipe: { enabled: true } }]);
    assert.strictEqual(hand.options.wheel.enabled, true);
    assert.strictEqual(hand.options.swipe.enabled, true);
    hand.destroy();

    const created = HandTrick.create(node, 'drawing');
    assert.strictEqual(created.options.pan.threshold, 4);
    created.destroy();
});

run('continuous path emits exact held-pointer pattern', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        intent: { events: ['down>right'] },
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        path: {
            minTime: 0,
            minSamples: 1,
            minDistance: 35,
            segmentDistance: 35,
            maxPause: 500
        }
    });
    const events = [];
    let matched = null;
    let legacyMatched = 0;

    hand.on('pathstart', detail => events.push('start:' + detail.pathText));
    hand.on('path', detail => events.push('path:' + detail.pathText));
    hand.on('down>right', detail => {
        matched = detail;
    });
    hand.on('path:down>right', () => {
        legacyMatched++;
    });
    hand.when('path', { path: 'down>right' }, detail => events.push('when:' + detail.pathText));
    hand.when('path', { path: 'path:down>right' }, detail => events.push('prefixed:' + detail.pathText));

    hand.pointerDown(pointerEvent(node, 1, 100, 100));
    t = 40;
    hand.pointerMove(pointerEvent(node, 1, 100, 150));
    t = 90;
    hand.pointerMove(pointerEvent(node, 1, 155, 150));
    hand.pointerUp(pointerEvent(node, 1, 155, 150, { buttons: 0 }));

    assert.ok(matched);
    assert.strictEqual(matched.type, 'down>right');
    assert.strictEqual(matched.pathText, 'down>right');
    assert.strictEqual(matched.pathMatched, 'down>right');
    assert.strictEqual(matched.pathSegments.length, 2);
    assert.strictEqual(legacyMatched, 0);
    assert.ok(events.includes('start:down'));
    assert.ok(events.includes('path:down>right'));
    assert.ok(events.includes('when:down>right'));
    assert.ok(!events.includes('prefixed:down>right'));
});

run('path detection rejects straight movement jitter and pause-joined shapes', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        intent: { events: ['down>right'] },
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        path: {
            minTime: 0,
            minSamples: 1,
            minDistance: 35,
            segmentDistance: 35,
            maxPause: 120
        }
    });
    let matched = 0;

    hand.on('down>right', () => matched++);

    hand.pointerDown(pointerEvent(node, 1, 100, 100));
    t = 40;
    hand.pointerMove(pointerEvent(node, 1, 100, 150));
    t = 80;
    hand.pointerMove(pointerEvent(node, 1, 120, 154));
    t = 260;
    hand.pointerMove(pointerEvent(node, 1, 170, 154));
    hand.pointerUp(pointerEvent(node, 1, 170, 154, { buttons: 0 }));

    hand.pointerDown(pointerEvent(node, 2, 40, 40));
    t = 320;
    hand.pointerMove(pointerEvent(node, 2, 140, 42));
    t = 360;
    hand.pointerMove(pointerEvent(node, 2, 180, 44));
    hand.pointerUp(pointerEvent(node, 2, 180, 44, { buttons: 0 }));

    assert.strictEqual(matched, 0);
});

run('matched path consumes conflicting release swipe', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        intent: { events: ['left>up', 'swipeleft'] },
        pan: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        path: {
            minTime: 0,
            minSamples: 1,
            minDistance: 35,
            segmentDistance: 35,
            consume: true
        },
        swipe: {
            distanceByFingers: { 1: 60 },
            minTime: 0,
            minSamples: 1,
            confidenceDelay: 0,
            intentDistance: 10
        }
    });
    let path = 0;
    let swipe = 0;

    hand.on('left>up', () => path++);
    hand.on('swipeleft', () => swipe++);

    hand.pointerDown(pointerEvent(node, 1, 250, 180));
    t = 40;
    hand.pointerMove(pointerEvent(node, 1, 150, 180));
    t = 80;
    hand.pointerMove(pointerEvent(node, 1, 150, 130));
    hand.pointerUp(pointerEvent(node, 1, 150, 130, { buttons: 0 }));

    assert.strictEqual(path, 1);
    assert.strictEqual(swipe, 0);
});

run('position grid helper exists on payloads and static rect can refresh', () => {
    const node = target(300, 300);
    const hand = new HandTrick(node, {
        input: 'mouse',
        windowEvents: false,
        preventDefault: false,
        wheel: { enabled: false },
        press: { enabled: false },
        rect: 'static'
    });
    let grid = null;

    hand.on('tap', detail => {
        grid = detail.center.grid(4, 4);
    });
    hand.mouseDown(mouseEvent(node, 250, 250));
    hand.mouseUp(mouseEvent(node, 250, 250, { buttons: 0 }));

    assert.deepStrictEqual(grid, { row: 3, col: 3, rows: 4, cols: 4, index: 15 });
    assert.strictEqual(HandTrick.zone({ ratioX: 0.9, ratioY: 0.1 }, { rows: 2, cols: 5 }).index, 4);

    let width = 300;
    node.getBoundingClientRect = () => ({ left: 0, top: 0, right: width, bottom: 300, width, height: 300 });
    assert.strictEqual(hand.rect().width, 300);
    width = 500;
    assert.strictEqual(hand.rect().width, 300);
    hand.refreshRect();
    assert.strictEqual(hand.rect().width, 500);
});

run('dom tap guard prevents only nearby rapid native taps', () => {
    let t = 0;
    const node = target();
    const hand = new HandTrick(node, {
        input: 'mouse',
        clock: () => t,
        windowEvents: false,
        preventDefault: false,
        wheel: { enabled: false },
        press: { enabled: false }
    });
    const handlers = Array.from(node.listeners.get('touchstart') || []);
    let prevented = 0;
    const event = (x, y) => ({
        type: 'touchstart',
        target: node,
        cancelable: true,
        changedTouches: [{ clientX: x, clientY: y }],
        preventDefault() {
            prevented++;
        }
    });

    handlers.forEach(handler => handler(event(40, 40)));
    t = 120;
    handlers.forEach(handler => handler(event(44, 42)));
    t = 240;
    handlers.forEach(handler => handler(event(240, 240)));

    assert.strictEqual(prevented, 1);
    hand.destroy();
});

run('dom tap guard works when selection guard is disabled', () => {
    let t = 0;
    const node = target();
    const hand = new HandTrick(node, {
        input: 'mouse',
        clock: () => t,
        windowEvents: false,
        preventDefault: false,
        dom: {
            selectionGuard: false,
            tapGuard: true
        },
        wheel: { enabled: false },
        press: { enabled: false }
    });
    const handlers = Array.from(node.listeners.get('touchstart') || []);
    let prevented = 0;
    const event = x => ({
        type: 'touchstart',
        target: node,
        cancelable: true,
        changedTouches: [{ clientX: x, clientY: 40 }],
        preventDefault() {
            prevented++;
        }
    });

    assert.ok(handlers.length > 0);
    assert.ok(!node.listeners.has('selectstart') || node.listeners.get('selectstart').size === 0);
    handlers.forEach(handler => handler(event(40)));
    t = 120;
    handlers.forEach(handler => handler(event(42)));

    assert.strictEqual(prevented, 1);
    hand.destroy();
});

run('dom tap guard skips first touchend and blocks native double tap edges', () => {
    let t = 0;
    const node = target();
    const hand = new HandTrick(node, {
        input: 'mouse',
        clock: () => t,
        windowEvents: false,
        preventDefault: false,
        wheel: { enabled: false },
        press: { enabled: false }
    });
    const handlers = type => Array.from(node.listeners.get(type) || []);
    let prevented = 0;
    const touchEvent = (type, x, id) => ({
        type,
        target: node,
        cancelable: true,
        changedTouches: [{ identifier: id, clientX: x, clientY: 40 }],
        preventDefault() {
            prevented++;
        }
    });
    const dblclick = {
        type: 'dblclick',
        target: node,
        cancelable: true,
        button: 0,
        clientX: 80,
        clientY: 80,
        preventDefault() {
            prevented++;
        }
    };

    handlers('touchstart').forEach(handler => handler(touchEvent('touchstart', 40, 1)));
    t = 220;
    handlers('touchend').forEach(handler => handler(touchEvent('touchend', 40, 1)));
    assert.strictEqual(prevented, 0);

    t = 280;
    handlers('touchstart').forEach(handler => handler(touchEvent('touchstart', 42, 2)));
    assert.strictEqual(prevented, 1);

    t = 760;
    handlers('touchstart').forEach(handler => handler(touchEvent('touchstart', 260, 3)));
    assert.strictEqual(prevented, 1);

    handlers('dblclick').forEach(handler => handler(dblclick));
    assert.strictEqual(prevented, 2);
    hand.destroy();
});
