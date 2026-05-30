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

run('specific event syntax supports multiple handlers for one command', () => {
    let t = 0;
    const { node, hand } = createMouse({ clock: () => t });
    let alias = 0;
    let compact = 0;

    hand.on('swipe:right', () => alias++);
    hand.on('swipe:right', () => compact++);
    hand.mouseDown(mouseEvent(node, 40, 40));
    t = 40;
    hand.mouseMove(mouseEvent(node, 130, 40));
    hand.mouseUp(mouseEvent(node, 130, 40, { buttons: 0 }));

    assert.strictEqual(alias, 1);
    assert.strictEqual(compact, 1);
});

run('command arbitration picks specific swipe while observe sees aliases', () => {
    let t = 0;
    const { node, hand } = createMouse({ clock: () => t });
    const commands = [];
    const observed = [];

    hand.on('swipe', () => commands.push('swipe'));
    hand.on('swipe:right', () => commands.push('right'));
    hand.observe('swipe', detail => observed.push('swipe:' + detail.direction));
    hand.observe('swipe:right', detail => observed.push('right:' + detail.axis));

    hand.mouseDown(mouseEvent(node, 40, 40));
    t = 40;
    hand.mouseMove(mouseEvent(node, 130, 40));
    hand.mouseUp(mouseEvent(node, 130, 40, { buttons: 0 }));

    assert.deepStrictEqual(commands, ['right']);
    assert.deepStrictEqual(observed, ['swipe:right', 'right:x']);
});

run('on and command are equivalent command phase for final gesture selectors', () => {
    let t = 0;
    const { node, hand } = createMouse({ clock: () => t });
    let onCount = 0;
    let commandCount = 0;
    let observeCount = 0;

    hand.on('swipe:right', () => onCount++);
    hand.command('swipe:right', () => commandCount++);
    hand.observe('swipe:right', () => observeCount++);

    hand.mouseDown(mouseEvent(node, 40, 40));
    t = 40;
    hand.mouseMove(mouseEvent(node, 130, 40));
    hand.mouseUp(mouseEvent(node, 130, 40, { buttons: 0 }));

    assert.strictEqual(onCount, 1);
    assert.strictEqual(commandCount, 1);
    assert.strictEqual(observeCount, 1);
});

run('command fan-out groups semantically equal criteria', () => {
    let t = 0;
    const { node, hand } = createMouse({ clock: () => t });
    const seen = [];

    hand.command('swipe:right', { fingers: [1, 2] }, () => seen.push('a'));
    hand.command('swipe:right', { fingers: [2, 1] }, () => seen.push('b'));
    hand.mouseDown(mouseEvent(node, 40, 40));
    t = 40;
    hand.mouseMove(mouseEvent(node, 130, 40));
    hand.mouseUp(mouseEvent(node, 130, 40, { buttons: 0 }));

    assert.deepStrictEqual(seen, ['a', 'b']);
});

run('modified swipe command beats unmodified command', () => {
    let t = 0;
    const { node, hand } = createMouse({ clock: () => t });
    const seen = [];

    hand.command('swipe:right', () => seen.push('base'));
    hand.command('swipe:mod:right', () => seen.push('mod'));
    hand.mouseDown(mouseEvent(node, 40, 40, { shiftKey: true }));
    t = 40;
    hand.mouseMove(mouseEvent(node, 130, 40, { shiftKey: true }));
    hand.mouseUp(mouseEvent(node, 130, 40, { buttons: 0, shiftKey: true }));

    assert.deepStrictEqual(seen, ['mod']);
});

run('mixed released sequence and held path selector is opaque', () => {
    const { hand } = createMouse();
    let mixed = 0;

    hand.on('tap>swipe:left>right>up', () => mixed++);

    const intent = hand.getIntentState();
    assert.ok(!intent.groups.includes('tap'));
    assert.ok(!intent.groups.includes('swipe'));
    assert.ok(!intent.groups.includes('path'));
    assert.strictEqual(HandTrick.path('tap>swipe:left>right>up'), '');
    assert.strictEqual(mixed, 0);
});

run('compact directional event names are not registered aliases', () => {
    let t = 0;
    const { node, hand } = createMouse({ clock: () => t });
    let compact = 0;
    let canonical = 0;

    hand.on('swiperight', () => compact++);
    hand.on('swipe:right', () => canonical++);

    hand.mouseDown(mouseEvent(node, 40, 40));
    t = 40;
    hand.mouseMove(mouseEvent(node, 130, 40));
    hand.mouseUp(mouseEvent(node, 130, 40, { buttons: 0 }));

    assert.strictEqual(compact, 0);
    assert.strictEqual(canonical, 1);
});

run('grid criteria routes center double tap', () => {
    let t = 0;
    const { node, hand } = createMouse({ clock: () => t });
    let center = 0;
    let side = 0;

    hand.on('tap:2x', { grid: { rows: 3, cols: 3, cell: 'center' } }, () => center++);
    hand.on('tap:2x', { grid: { rows: 3, cols: 3, cell: 'left' } }, () => side++);

    hand.mouseDown(mouseEvent(node, 200, 150));
    hand.mouseUp(mouseEvent(node, 200, 150, { buttons: 0 }));
    t = 120;
    hand.mouseDown(mouseEvent(node, 202, 151));
    hand.mouseUp(mouseEvent(node, 202, 151, { buttons: 0 }));

    assert.strictEqual(center, 1);
    assert.strictEqual(side, 0);
});

run('tap start grid criteria requires same-side double tap', () => {
    let t = 0;
    const { node, hand } = createMouse({ clock: () => t });
    let right = 0;

    hand.on('tap:2x', {
        grid: { rows: 3, cols: 3, col: 2 },
        tapStartGrid: { rows: 3, cols: 3, col: 2 }
    }, () => right++);

    hand.mouseDown(mouseEvent(node, 40, 150));
    hand.mouseUp(mouseEvent(node, 40, 150, { buttons: 0 }));
    t = 120;
    hand.mouseDown(mouseEvent(node, 360, 150));
    hand.mouseUp(mouseEvent(node, 360, 150, { buttons: 0 }));

    t = 600;
    hand.mouseDown(mouseEvent(node, 360, 150));
    hand.mouseUp(mouseEvent(node, 360, 150, { buttons: 0 }));
    t = 720;
    hand.mouseDown(mouseEvent(node, 362, 150));
    hand.mouseUp(mouseEvent(node, 362, 150, { buttons: 0 }));

    assert.strictEqual(right, 1);
});

run('meta click pair emits keyboard rolling tap and suppresses taps', () => {
    let t = 0;
    const { node, hand } = createMouse({
        clock: () => t,
        intent: { events: ['rolling', 'tap', 'tap:2x'] },
        rolling: { fingers: [2] }
    });
    let rolling = null;
    let taps = 0;
    let doubleTaps = 0;

    hand.on('rolling:right', detail => {
        rolling = detail;
    });
    hand.on('tap', () => taps++);
    hand.on('tap:2x', () => doubleTaps++);

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
    assert.strictEqual(doubleTaps, 0);
});

run('meta click triple can resolve as three-finger keyboard rolling tap', () => {
    let t = 0;
    const { node, hand } = createMouse({
        clock: () => t,
        intent: { events: ['rolling', 'tap', 'tap:2x', 'tap:3x'] },
        rolling: { fingers: [3] }
    });
    let rolling = null;
    let direct = 0;

    hand.on('rolling', { fingers: 3 }, detail => {
        rolling = detail;
    });
    hand.on('tap', () => direct++);
    hand.on('tap:2x', () => direct++);
    hand.on('tap:3x', () => direct++);

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
        intent: { events: ['rolling', 'tap', 'tap:2x'] },
        rolling: { fingers: [2] }
    });
    let rolling = 0;
    let taps = 0;
    let doubleTaps = 0;

    hand.on('rolling', () => rolling++);
    hand.observe('tap', () => taps++);
    hand.on('tap:2x', () => doubleTaps++);

    hand.mouseDown(mouseEvent(node, 60, 60, { metaKey: true }));
    hand.mouseUp(mouseEvent(node, 60, 60, { buttons: 0, metaKey: true }));
    t = 120;
    hand.mouseDown(mouseEvent(node, 62, 61, { metaKey: true }));
    hand.mouseUp(mouseEvent(node, 62, 61, { buttons: 0, metaKey: true }));

    assert.strictEqual(rolling, 0);
    assert.strictEqual(taps, 2);
    assert.strictEqual(doubleTaps, 1);
});
