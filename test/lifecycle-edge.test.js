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

run('double destroy is safe', () => {
    const { hand } = createMouse();
    hand.destroy();
    hand.destroy();
    assert.strictEqual(hand.destroyed, true);
});

run('enable and disable toggle cleanly', () => {
    const { node, hand } = createMouse();
    let taps = 0;
    hand.on('tap', () => taps++);

    hand.disable();
    hand.mouseDown(mouseEvent(node, 40, 50));
    hand.mouseUp(mouseEvent(node, 40, 50, { buttons: 0 }));
    assert.strictEqual(taps, 0);

    hand.enable();
    hand.mouseDown(mouseEvent(node, 40, 50));
    hand.mouseUp(mouseEvent(node, 40, 50, { buttons: 0 }));
    assert.strictEqual(taps, 1);
});

run('disable during active session emits cancel', () => {
    let t = 0;
    const { node, hand } = createMouse({
        clock: () => t,
        pan: { threshold: 8, minTime: 0, minSamples: 1 }
    });
    const seen = [];

    hand.on('panstart', () => seen.push('panstart'));
    hand.on('pan', () => seen.push('pan'));
    hand.on('cancel', () => seen.push('cancel'));

    hand.mouseDown(mouseEvent(node, 20, 20));
    t = 40;
    hand.mouseMove(mouseEvent(node, 60, 20));
    hand.disable();

    assert.ok(seen.includes('panstart'));
    assert.ok(seen.includes('cancel'));
});

run('cancel during pan emits panend', () => {
    let t = 0;
    const { node, hand } = createMouse({
        clock: () => t,
        pan: { threshold: 8, minTime: 0, minSamples: 1 }
    });
    const seen = [];

    hand.on('panstart', () => seen.push('panstart'));
    hand.on('panend', () => seen.push('panend'));
    hand.on('cancel', () => seen.push('cancel'));

    hand.mouseDown(mouseEvent(node, 20, 20));
    t = 40;
    hand.mouseMove(mouseEvent(node, 60, 20));
    hand.cancel('test');

    assert.ok(seen.includes('panstart'));
    assert.ok(seen.includes('panend'));
    assert.ok(seen.includes('cancel'));
});

run('setOptions mid-session updates thresholds', () => {
    let t = 0;
    const { node, hand } = createMouse({
        clock: () => t,
        pan: { threshold: 100, minTime: 0, minSamples: 1 }
    });
    let pans = 0;

    hand.on('pan', () => pans++);

    hand.mouseDown(mouseEvent(node, 20, 20));
    t = 40;
    hand.mouseMove(mouseEvent(node, 50, 20));
    assert.strictEqual(pans, 0);

    hand.setOptions({ pan: { threshold: 5 } });
    t = 80;
    hand.mouseMove(mouseEvent(node, 60, 20));
    hand.mouseUp(mouseEvent(node, 60, 20, { buttons: 0 }));

    assert.ok(pans > 0);
});

run('rapid tap jitter within maxMove does not reject tap', () => {
    const { node, hand } = createMouse();
    let taps = 0;

    hand.on('tap', () => taps++);

    hand.mouseDown(mouseEvent(node, 50, 50));
    hand.mouseMove(mouseEvent(node, 52, 51));
    hand.mouseMove(mouseEvent(node, 49, 50));
    hand.mouseUp(mouseEvent(node, 50, 50, { buttons: 0 }));

    assert.strictEqual(taps, 1);
});

run('movement beyond maxMove rejects tap', () => {
    const { node, hand } = createMouse();
    let taps = 0;
    let swipes = 0;

    hand.on('tap', () => taps++);
    hand.on('swipe', () => swipes++);

    hand.mouseDown(mouseEvent(node, 50, 50));
    hand.mouseMove(mouseEvent(node, 90, 50));
    hand.mouseUp(mouseEvent(node, 90, 50, { buttons: 0 }));

    assert.strictEqual(taps, 0);
});

run('resetTaps clears tap chain memory', () => {
    let t = 0;
    const { node, hand } = createMouse({ clock: () => t });
    let doubles = 0;

    hand.on('doubletap', () => doubles++);

    hand.mouseDown(mouseEvent(node, 50, 50));
    hand.mouseUp(mouseEvent(node, 50, 50, { buttons: 0 }));

    hand.resetTaps();

    t = 100;
    hand.mouseDown(mouseEvent(node, 50, 50));
    hand.mouseUp(mouseEvent(node, 50, 50, { buttons: 0 }));

    assert.strictEqual(doubles, 0);
});

run('getState reports active session and finger count', () => {
    const { node, hand } = createMouse();

    const before = hand.getState();
    assert.strictEqual(before.active, false);
    assert.strictEqual(before.fingers, 0);

    hand.mouseDown(mouseEvent(node, 50, 50));

    const during = hand.getState();
    assert.strictEqual(during.active, true);
    assert.strictEqual(during.fingers, 1);

    hand.mouseUp(mouseEvent(node, 50, 50, { buttons: 0 }));
});

run('once handler fires exactly once', () => {
    const { node, hand } = createMouse();
    let count = 0;

    hand.once('tap', () => count++);

    hand.mouseDown(mouseEvent(node, 50, 50));
    hand.mouseUp(mouseEvent(node, 50, 50, { buttons: 0 }));
    hand.mouseDown(mouseEvent(node, 50, 50));
    hand.mouseUp(mouseEvent(node, 50, 50, { buttons: 0 }));

    assert.strictEqual(count, 1);
});
