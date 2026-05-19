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

run('position aliases and filtered listeners match common regions', () => {
    let t = 0;
    const { node, hand } = createMouse({
        clock: () => t,
        swipe: {
            distanceByFingers: { 1: 60 },
            minTime: 0,
            minSamples: 1,
            confidenceDelay: 0,
            intentDistance: 20
        },
        pan: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false }
    });
    const seen = [];

    hand.when('tap', { region: 'top-left' }, detail => seen.push('tap:' + detail.region + ':' + detail.area));
    hand.when('swipe', { startRegion: 'bottom', direction: 'right' }, detail => seen.push('swipe:' + detail.startRegion + ':' + detail.direction));

    hand.mouseDown(mouseEvent(node, 20, 20));
    hand.mouseUp(mouseEvent(node, 20, 20, { buttons: 0 }));
    t = 500;
    hand.mouseDown(mouseEvent(node, 40, 260));
    t = 540;
    hand.mouseMove(mouseEvent(node, 140, 260));
    hand.mouseUp(mouseEvent(node, 140, 260, { buttons: 0 }));

    assert.deepStrictEqual(seen, ['tap:top-left:edge', 'swipe:bottom-left:right']);
});

run('region criteria matches current point while startRegion matches origin', () => {
    let t = 0;
    const { node, hand } = createMouse({
        clock: () => t,
        swipe: {
            distanceByFingers: { 1: 60 },
            minTime: 0,
            minSamples: 1,
            confidenceDelay: 0,
            intentDistance: 20
        },
        pan: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false }
    });
    let currentBottomLeft = 0;
    let currentBottomRight = 0;
    let startedBottomLeft = 0;

    hand.when('swipe', { region: 'bottom-left', direction: 'right' }, () => currentBottomLeft++);
    hand.when('swipe', { region: 'bottom-right', direction: 'right' }, () => currentBottomRight++);
    hand.when('swipe', { startRegion: 'bottom-left', direction: 'right' }, () => startedBottomLeft++);

    hand.mouseDown(mouseEvent(node, 40, 260));
    t = 40;
    hand.mouseMove(mouseEvent(node, 360, 260));
    hand.mouseUp(mouseEvent(node, 360, 260, { buttons: 0 }));

    assert.strictEqual(currentBottomLeft, 0);
    assert.strictEqual(currentBottomRight, 1);
    assert.strictEqual(startedBottomLeft, 1);
});

run('touch modifier payload exposes anchor position metadata', () => {
    let t = 0;
    const node = target();
    const hand = new HandTrick(node, {
        input: 'pointer',
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
    let detail = null;
    let filtered = 0;

    hand.on('modifiertap', event => {
        detail = event;
    });
    hand.when('modifiertap', { modifierRegion: 'top-left', modifierArea: 'edge' }, () => {
        filtered++;
    });

    hand.pointerDown(pointerEvent(node, 1, 20, 20));
    t = 220;
    hand.pointerDown(pointerEvent(node, 2, 160, 80));
    t = 250;
    hand.pointerUp(pointerEvent(node, 2, 160, 80, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 1, 20, 20, { buttons: 0 }));

    assert.ok(detail);
    assert.strictEqual(detail.modifier.source, 'touch');
    assert.strictEqual(detail.modifier.region, 'top-left');
    assert.strictEqual(detail.modifier.area, 'edge');
    assert.strictEqual(detail.modifier.position.anchor.region, 'top-left');
    assert.strictEqual(detail.actionPointer.region, 'top-center');
    assert.strictEqual(filtered, 1);
});

run('keyboard modifiers emit modifier tap and exact combo modifier pan', () => {
    let t = 0;
    const { node, hand } = createMouse({
        clock: () => t,
        modifier: {
            panDelay: 40,
            panThreshold: 10
        },
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false }
    });
    let tap = null;
    let plainTap = 0;
    const pans = [];

    hand.on('tap', () => {
        plainTap++;
    });
    hand.on('modifiertap', detail => {
        tap = detail;
    });
    hand.when('modifierpan', { modifierSource: 'keyboard', modifierName: 'shiftAlt', modifierKeys: 'shift+alt' }, detail => {
        pans.push(detail.actionDeltaX + ':' + detail.modifier.name);
    });

    hand.mouseDown(mouseEvent(node, 80, 80, { shiftKey: true, cancelable: true, preventDefault() {} }));
    t = 20;
    hand.mouseUp(mouseEvent(node, 80, 80, { buttons: 0, shiftKey: true }));
    t = 500;
    hand.mouseDown(mouseEvent(node, 100, 90, { shiftKey: true, altKey: true }));
    t = 560;
    hand.mouseMove(mouseEvent(node, 140, 90, { shiftKey: true, altKey: true }));
    hand.mouseUp(mouseEvent(node, 140, 90, { buttons: 0, shiftKey: true, altKey: true }));

    assert.ok(tap);
    assert.strictEqual(tap.modifier.source, 'keyboard');
    assert.strictEqual(tap.modifier.name, 'plain');
    assert.strictEqual(tap.keyCombo, 'shift');
    assert.strictEqual(plainTap, 0);
    assert.deepStrictEqual(pans, ['40:shiftAlt']);
});

run('preset shorthand and tap chain native suppression work without app code', () => {
    let t = 0;
    const node = target();
    const hand = new HandTrick(node, {
        preset: 'media',
        input: 'mouse',
        clock: () => t,
        windowEvents: false,
        wheel: { enabled: false }
    });
    let prevented = 0;
    const preventDefault = () => {
        prevented++;
    };

    hand.mouseDown(mouseEvent(node, 60, 60));
    hand.mouseUp(mouseEvent(node, 60, 60, { buttons: 0 }));
    t = 120;
    hand.mouseDown(mouseEvent(node, 62, 60, { cancelable: true, preventDefault }));

    assert.strictEqual(prevented, 1);
    assert.strictEqual(hand.options.rotate.enabled, false);
    assert.strictEqual(HandTrick.preset(['media', { rotate: { enabled: true } }]).rotate.enabled, true);
});

run('keyboard modifier combos are configurable', () => {
    const { node, hand } = createMouse({
        modifier: {
            keyboard: {
                roles: {
                    twoFingers: null
                },
                combos: {
                    plain: 'alt'
                }
            }
        },
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false }
    });
    let modifier = null;

    hand.on('modifiertap', detail => {
        modifier = detail.modifier;
    });
    hand.mouseDown(mouseEvent(node, 80, 80, { altKey: true }));
    hand.mouseUp(mouseEvent(node, 80, 80, { buttons: 0, altKey: true }));

    assert.ok(modifier);
    assert.strictEqual(modifier.name, 'plain');
    assert.strictEqual(modifier.keyCombo, 'alt');
});
