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
        rotate: { enabled: false }
    }, options));
    return { node, hand };
}

run('keyboard roles substitute two and three finger taps', () => {
    let t = 0;
    const { node, hand } = createMouse({ clock: () => t });
    const seen = [];
    let modifier = 0;

    hand.on('2fingertap', detail => seen.push(['2', detail.fingers, detail.actualFingers, detail.syntheticFingers, detail.fingerSource, detail.keyboardSubstitute.role]));
    hand.on('3fingertap', detail => seen.push(['3', detail.fingers, detail.actualFingers, detail.syntheticFingers, detail.fingerSource, detail.keyboardSubstitute.role]));
    hand.on('modifiertap', () => modifier++);

    hand.mouseDown(mouseEvent(node, 60, 60, { altKey: true }));
    hand.mouseUp(mouseEvent(node, 60, 60, { buttons: 0, altKey: true }));
    t = 500;
    hand.mouseDown(mouseEvent(node, 70, 70, { ctrlKey: true }));
    hand.mouseUp(mouseEvent(node, 70, 70, { buttons: 0, ctrlKey: true }));

    assert.deepStrictEqual(seen, [
        ['2', 2, 1, 2, 'keyboard', 'twoFingers'],
        ['3', 3, 1, 3, 'keyboard', 'threeFingers']
    ]);
    assert.strictEqual(modifier, 0);
});

run('keyboard role swipe uses substituted finger count and criteria', () => {
    let t = 0;
    const { node, hand } = createMouse({
        clock: () => t,
        intent: { events: ['swipe', '2fingertap>swipe'] },
        swipe: {
            distanceByFingers: { 2: 60 },
            minTime: 0,
            minSamples: 1,
            confidenceDelay: 0,
            intentDistance: 20
        }
    });
    const swipes = [];
    let sequence = 0;

    hand.when('swipe', { fingers: 2, actualFingers: 1, fingerSource: 'keyboard', keyboardRole: 'twoFingers' }, detail => {
        swipes.push(detail.direction + ':' + detail.fingers + ':' + detail.syntheticFingers);
    });
    hand.on('2fingertap>swipe', () => {
        sequence++;
    });

    hand.mouseDown(mouseEvent(node, 40, 50, { altKey: true }));
    hand.mouseUp(mouseEvent(node, 40, 50, { buttons: 0, altKey: true }));
    t = 160;
    hand.mouseDown(mouseEvent(node, 50, 50, { altKey: true }));
    t = 220;
    hand.mouseMove(mouseEvent(node, 130, 50, { altKey: true }));
    hand.mouseUp(mouseEvent(node, 130, 50, { buttons: 0, altKey: true }));

    assert.deepStrictEqual(swipes, []);
    assert.strictEqual(sequence, 1);
});

run('keyboard roles can be customized and disabled per combo', () => {
    const { node, hand } = createMouse({
        modifier: {
            keyboard: {
                roles: {
                    modifier: 'shift+alt',
                    twoFingers: null,
                    threeFingers: 'alt+ctrl'
                },
                combos: {
                    custom: 'shift+alt'
                }
            }
        }
    });
    let modifier = null;
    let three = null;
    let two = 0;

    hand.on('modifiertap', detail => {
        modifier = detail.modifier;
    });
    hand.on('3fingertap', detail => {
        three = detail;
    });
    hand.on('2fingertap', () => {
        two++;
    });

    hand.mouseDown(mouseEvent(node, 40, 40, { shiftKey: true, altKey: true }));
    hand.mouseUp(mouseEvent(node, 40, 40, { buttons: 0, shiftKey: true, altKey: true }));
    hand.mouseDown(mouseEvent(node, 60, 60, { altKey: true }));
    hand.mouseUp(mouseEvent(node, 60, 60, { buttons: 0, altKey: true }));
    hand.mouseDown(mouseEvent(node, 80, 80, { altKey: true, ctrlKey: true }));
    hand.mouseUp(mouseEvent(node, 80, 80, { buttons: 0, altKey: true, ctrlKey: true }));

    assert.ok(modifier);
    assert.strictEqual(modifier.name, 'custom');
    assert.strictEqual(two, 0);
    assert.ok(three);
    assert.strictEqual(three.keyboardSubstitute.role, 'threeFingers');
});
