const { assert, HandTrick, target, mouseEvent, run } = require('./helpers');

function createMouse(options = {}) {
    const node = target();
    const hand = new HandTrick(node, Object.assign({
        input: 'mouse',
        windowEvents: false,
        preventDefault: false,
        wheel: { enabled: false },
        press: { enabled: false },
        pan: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        swipe: {
            distanceByFingers: { 1: 60, 2: 60, 3: 60 },
            minTime: 0,
            minSamples: 1,
            confidenceDelay: 0,
            intentDistance: 20
        }
    }, options));
    return { node, hand };
}

run('conditional on filters through the primary listener API', () => {
    let t = 0;
    const { node, hand } = createMouse({ clock: () => t });
    const seen = [];

    hand.on('swipe:right', { startRegion: 'top-left', fingers: 1 }, detail => {
        seen.push(detail.direction + ':' + detail.startRegion);
    });

    hand.mouseDown(mouseEvent(node, 40, 40));
    t = 40;
    hand.mouseMove(mouseEvent(node, 130, 40));
    hand.mouseUp(mouseEvent(node, 130, 40, { buttons: 0 }));
    t = 200;
    hand.mouseDown(mouseEvent(node, 220, 220));
    t = 240;
    hand.mouseMove(mouseEvent(node, 310, 220));
    hand.mouseUp(mouseEvent(node, 310, 220, { buttons: 0 }));

    assert.deepStrictEqual(seen, ['right:top-left']);
});

run('explicit listener activates a preset-disabled gesture family', () => {
    const node = target();
    const hand = new HandTrick(node, {
        preset: 'media',
        input: 'mouse',
        windowEvents: false,
        wheel: { enabled: false }
    });

    assert.strictEqual(hand.options.rotate.enabled, false);
    hand.on('rotate', () => {});

    assert.strictEqual(hand.options.rotate.enabled, true);
    assert.ok(hand.getIntentState().groups.includes('rotate'));
});

run('specific event aliases preserve compact event behavior', () => {
    let t = 0;
    const { node, hand } = createMouse({ clock: () => t });
    let alias = 0;
    let compact = 0;

    hand.on('swipe:right', () => alias++);
    hand.on('swiperight', () => compact++);
    hand.mouseDown(mouseEvent(node, 40, 40));
    t = 40;
    hand.mouseMove(mouseEvent(node, 130, 40));
    hand.mouseUp(mouseEvent(node, 130, 40, { buttons: 0 }));

    assert.strictEqual(alias, 1);
    assert.strictEqual(compact, 1);
});

run('meta click pair emits keyboard rolling tap and suppresses taps', () => {
    let t = 0;
    const { node, hand } = createMouse({
        clock: () => t,
        intent: { events: ['rollingtap', 'tap', 'doubletap'] },
        rolling: { fingers: [2] }
    });
    let rolling = null;
    let taps = 0;
    let doubletaps = 0;

    hand.on('rollingtap:right', detail => {
        rolling = detail;
    });
    hand.on('tap', () => taps++);
    hand.on('doubletap', () => doubletaps++);

    hand.mouseDown(mouseEvent(node, 60, 60, { metaKey: true }));
    hand.mouseUp(mouseEvent(node, 60, 60, { buttons: 0, metaKey: true }));
    t = 120;
    hand.mouseDown(mouseEvent(node, 96, 60, { metaKey: true }));
    hand.mouseUp(mouseEvent(node, 96, 60, { buttons: 0, metaKey: true }));

    assert.ok(rolling);
    assert.strictEqual(rolling.fingers, 2);
    assert.strictEqual(rolling.actualFingers, 1);
    assert.strictEqual(rolling.syntheticFingers, 2);
    assert.strictEqual(rolling.fingerSource, 'keyboard');
    assert.strictEqual(rolling.keyboardSubstitute.role, 'rollingTap');
    assert.strictEqual(rolling.rolling.source, 'keyboard');
    assert.strictEqual(taps, 0);
    assert.strictEqual(doubletaps, 0);
});

run('meta click triple can resolve as three-finger keyboard rolling tap', () => {
    let t = 0;
    const { node, hand } = createMouse({
        clock: () => t,
        intent: { events: ['3fingerrollingtap', 'tap', 'doubletap', 'tripletap'] },
        rolling: { fingers: [3] }
    });
    let rolling = null;
    let direct = 0;

    hand.on('3fingerrollingtap', detail => {
        rolling = detail;
    });
    hand.on('tap', () => direct++);
    hand.on('doubletap', () => direct++);
    hand.on('tripletap', () => direct++);

    hand.mouseDown(mouseEvent(node, 60, 60, { metaKey: true }));
    hand.mouseUp(mouseEvent(node, 60, 60, { buttons: 0, metaKey: true }));
    t = 100;
    hand.mouseDown(mouseEvent(node, 92, 60, { metaKey: true }));
    hand.mouseUp(mouseEvent(node, 92, 60, { buttons: 0, metaKey: true }));
    t = 200;
    hand.mouseDown(mouseEvent(node, 126, 61, { metaKey: true }));
    hand.mouseUp(mouseEvent(node, 126, 61, { buttons: 0, metaKey: true }));

    assert.ok(rolling);
    assert.strictEqual(rolling.rolling.count, 3);
    assert.deepStrictEqual(rolling.rolling.delays, [100, 100]);
    assert.strictEqual(direct, 0);
});

run('meta clicks without directional proof fall back to normal tap chain', () => {
    let t = 0;
    const { node, hand } = createMouse({
        clock: () => t,
        intent: { events: ['rollingtap', 'tap', 'doubletap'] },
        rolling: { fingers: [2] }
    });
    let rolling = 0;
    let taps = 0;
    let doubletaps = 0;

    hand.on('rollingtap', () => rolling++);
    hand.on('tap', () => taps++);
    hand.on('doubletap', () => doubletaps++);

    hand.mouseDown(mouseEvent(node, 60, 60, { metaKey: true }));
    hand.mouseUp(mouseEvent(node, 60, 60, { buttons: 0, metaKey: true }));
    t = 120;
    hand.mouseDown(mouseEvent(node, 62, 61, { metaKey: true }));
    hand.mouseUp(mouseEvent(node, 62, 61, { buttons: 0, metaKey: true }));

    assert.strictEqual(rolling, 0);
    assert.strictEqual(taps, 2);
    assert.strictEqual(doubletaps, 1);
});
