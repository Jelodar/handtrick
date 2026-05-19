const { assert, HandTrick, target, mouseEvent, pointerEvent, run } = require('./helpers');

function createMouse(options = {}) {
    const node = target();
    const hand = new HandTrick(node, Object.assign({
        input: 'mouse',
        windowEvents: false,
        preventDefault: false,
        wheel: { enabled: false },
        press: { enabled: false },
        tapHold: { enabled: false },
        pan: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        swipe: {
            distanceByFingers: { 1: 60 },
            minTime: 0,
            minSamples: 1,
            confidenceDelay: 0,
            intentDistance: 20
        }
    }, options));

    return { node, hand };
}

run('tap tap swipe sequence callback receives composed payload', () => {
    let t = 0;
    const { node, hand } = createMouse({
        clock: () => t,
        intent: {
            sequenceWindow: 900
        }
    });
    let sequence = null;

    hand.on('tap>tap>swipe', detail => {
        sequence = detail;
    });

    hand.mouseDown(mouseEvent(node, 40, 50));
    hand.mouseUp(mouseEvent(node, 40, 50, { buttons: 0 }));
    t = 120;
    hand.mouseDown(mouseEvent(node, 42, 50));
    hand.mouseUp(mouseEvent(node, 42, 50, { buttons: 0 }));
    t = 240;
    hand.mouseDown(mouseEvent(node, 50, 50));
    t = 300;
    hand.mouseMove(mouseEvent(node, 150, 52));
    hand.mouseUp(mouseEvent(node, 150, 52, { buttons: 0 }));

    assert.ok(sequence);
    assert.strictEqual(sequence.type, 'tap>tap>swipe');
    assert.deepStrictEqual(sequence.sequence, ['tap', 'tap', 'swipe']);
    assert.strictEqual(sequence.gestureSequence.gestures.length, 3);
    assert.strictEqual(sequence.direction, 'right');
});

run('legacy colon sequence listeners are not supported', () => {
    let t = 0;
    const { node, hand } = createMouse({
        clock: () => t
    });
    let legacy = 0;

    hand.on('tap:swipe', () => {
        legacy++;
    });

    hand.mouseDown(mouseEvent(node, 40, 50));
    hand.mouseUp(mouseEvent(node, 40, 50, { buttons: 0 }));
    t = 120;
    hand.mouseDown(mouseEvent(node, 50, 50));
    t = 180;
    hand.mouseMove(mouseEvent(node, 150, 52));
    hand.mouseUp(mouseEvent(node, 150, 52, { buttons: 0 }));

    assert.strictEqual(legacy, 0);
});

run('sequence callback respects sequence window', () => {
    let t = 0;
    const { node, hand } = createMouse({
        clock: () => t,
        intent: {
            sequenceWindow: 100
        }
    });
    let count = 0;

    hand.on('tap>tap>swipe', () => count++);

    hand.mouseDown(mouseEvent(node, 40, 50));
    hand.mouseUp(mouseEvent(node, 40, 50, { buttons: 0 }));
    t = 220;
    hand.mouseDown(mouseEvent(node, 42, 50));
    hand.mouseUp(mouseEvent(node, 42, 50, { buttons: 0 }));
    t = 280;
    hand.mouseDown(mouseEvent(node, 50, 50));
    t = 340;
    hand.mouseMove(mouseEvent(node, 150, 52));
    hand.mouseUp(mouseEvent(node, 150, 52, { buttons: 0 }));

    assert.strictEqual(count, 0);
});

run('sequence direction-specific swipes use explicit tap atoms', () => {
    let t = 0;
    const { node, hand } = createMouse({
        clock: () => t
    });
    let matched = 0;

    hand.on('tap>tap>swiperight', () => matched++);

    hand.mouseDown(mouseEvent(node, 40, 50));
    hand.mouseUp(mouseEvent(node, 40, 50, { buttons: 0 }));
    t = 120;
    hand.mouseDown(mouseEvent(node, 42, 50));
    hand.mouseUp(mouseEvent(node, 42, 50, { buttons: 0 }));
    t = 240;
    hand.mouseDown(mouseEvent(node, 50, 50));
    t = 300;
    hand.mouseMove(mouseEvent(node, 150, 52));
    hand.mouseUp(mouseEvent(node, 150, 52, { buttons: 0 }));

    assert.strictEqual(matched, 1);
});

run('tap tap swipe wins over direct doubletap and swipe handlers', () => {
    let t = 0;
    const { node, hand } = createMouse({
        clock: () => t,
        intent: {
            events: ['tap>tap>swipe', 'doubletap', 'swiperight']
        }
    });
    let sequence = 0;
    let directDouble = 0;
    let directSwipe = 0;
    let sequenceDetail = null;

    hand.on('tap>tap>swipe', detail => {
        sequence++;
        sequenceDetail = detail;
    });
    hand.on('doubletap', () => directDouble++);
    hand.on('swiperight', () => directSwipe++);

    hand.mouseDown(mouseEvent(node, 40, 50));
    hand.mouseUp(mouseEvent(node, 40, 50, { buttons: 0 }));
    t = 100;
    hand.mouseDown(mouseEvent(node, 42, 50));
    hand.mouseUp(mouseEvent(node, 42, 50, { buttons: 0 }));
    t = 220;
    hand.mouseDown(mouseEvent(node, 50, 50));
    t = 270;
    hand.mouseMove(mouseEvent(node, 150, 50));
    hand.mouseUp(mouseEvent(node, 150, 50, { buttons: 0 }));

    assert.strictEqual(sequence, 1);
    assert.strictEqual(directDouble, 0);
    assert.strictEqual(directSwipe, 0);
    assert.deepStrictEqual(sequenceDetail.sequence, ['tap', 'tap', 'swipe']);
    assert.deepStrictEqual(sequenceDetail.gestureSequence.pattern, ['tap', 'tap', 'swipe']);
    assert.strictEqual(sequenceDetail.gestureSequence.gestures.length, 3);
});

run('doubletap sequence alias requires two taps and beats tap swipe', () => {
    let t = 0;
    const { node, hand } = createMouse({
        clock: () => t,
        intent: {
            events: ['tap>swiperight', 'doubletap>swiperight', 'doubletap', 'swiperight']
        }
    });
    let tapSwipe = 0;
    let doubleSwipe = null;
    let directDouble = 0;
    let directSwipe = 0;

    hand.on('tap>swiperight', () => tapSwipe++);
    hand.on('doubletap>swiperight', detail => {
        doubleSwipe = detail;
    });
    hand.on('doubletap', () => directDouble++);
    hand.on('swiperight', () => directSwipe++);

    hand.mouseDown(mouseEvent(node, 40, 50));
    hand.mouseUp(mouseEvent(node, 40, 50, { buttons: 0 }));
    t = 100;
    hand.mouseDown(mouseEvent(node, 42, 50));
    hand.mouseUp(mouseEvent(node, 42, 50, { buttons: 0 }));
    t = 220;
    hand.mouseDown(mouseEvent(node, 50, 50));
    t = 270;
    hand.mouseMove(mouseEvent(node, 150, 50));
    hand.mouseUp(mouseEvent(node, 150, 50, { buttons: 0 }));

    assert.strictEqual(tapSwipe, 0);
    assert.ok(doubleSwipe);
    assert.deepStrictEqual(doubleSwipe.sequence, ['tap', 'tap', 'swipe']);
    assert.deepStrictEqual(doubleSwipe.gestureSequence.pattern, ['doubletap', 'swiperight']);
    assert.strictEqual(directDouble, 0);
    assert.strictEqual(directSwipe, 0);
});

run('doubletap sequence alias does not match a single tap swipe', () => {
    let t = 0;
    const { node, hand } = createMouse({
        clock: () => t,
        intent: {
            events: ['doubletap>swiperight', 'swiperight']
        }
    });
    let doubleSwipe = 0;
    let directSwipe = 0;

    hand.on('doubletap>swiperight', () => doubleSwipe++);
    hand.on('swiperight', () => directSwipe++);

    hand.mouseDown(mouseEvent(node, 40, 50));
    hand.mouseUp(mouseEvent(node, 40, 50, { buttons: 0 }));
    t = 120;
    hand.mouseDown(mouseEvent(node, 50, 50));
    t = 180;
    hand.mouseMove(mouseEvent(node, 150, 50));
    hand.mouseUp(mouseEvent(node, 150, 50, { buttons: 0 }));

    assert.strictEqual(doubleSwipe, 0);
    assert.strictEqual(directSwipe, 1);
});

run('tap tap tap swipe uses explicit tap atoms', () => {
    let t = 0;
    const { node, hand } = createMouse({
        clock: () => t,
        intent: {
            events: ['tap>tap>tap>swiperight']
        }
    });
    let matched = 0;
    let matchedDetail = null;

    hand.on('tap>tap>tap>swiperight', detail => {
        matched++;
        matchedDetail = detail;
    });

    hand.mouseDown(mouseEvent(node, 40, 50));
    hand.mouseUp(mouseEvent(node, 40, 50, { buttons: 0 }));
    t = 100;
    hand.mouseDown(mouseEvent(node, 42, 50));
    hand.mouseUp(mouseEvent(node, 42, 50, { buttons: 0 }));
    t = 200;
    hand.mouseDown(mouseEvent(node, 44, 50));
    hand.mouseUp(mouseEvent(node, 44, 50, { buttons: 0 }));
    t = 320;
    hand.mouseDown(mouseEvent(node, 50, 50));
    t = 370;
    hand.mouseMove(mouseEvent(node, 150, 50));
    hand.mouseUp(mouseEvent(node, 150, 50, { buttons: 0 }));

    assert.strictEqual(matched, 1);
    assert.deepStrictEqual(matchedDetail.sequence, ['tap', 'tap', 'tap', 'swipe']);
    assert.deepStrictEqual(matchedDetail.gestureSequence.pattern, ['tap', 'tap', 'tap', 'swiperight']);
    assert.strictEqual(matchedDetail.gestureSequence.gestures.length, 4);
});

run('tripletap sequence alias beats doubletap sequence alias', () => {
    let t = 0;
    const { node, hand } = createMouse({
        clock: () => t,
        intent: {
            events: ['doubletap>swiperight', 'tripletap>swiperight']
        }
    });
    let doubleSwipe = 0;
    let tripleSwipe = null;

    hand.on('doubletap>swiperight', () => doubleSwipe++);
    hand.on('tripletap>swiperight', detail => {
        tripleSwipe = detail;
    });

    hand.mouseDown(mouseEvent(node, 40, 50));
    hand.mouseUp(mouseEvent(node, 40, 50, { buttons: 0 }));
    t = 90;
    hand.mouseDown(mouseEvent(node, 42, 50));
    hand.mouseUp(mouseEvent(node, 42, 50, { buttons: 0 }));
    t = 180;
    hand.mouseDown(mouseEvent(node, 44, 50));
    hand.mouseUp(mouseEvent(node, 44, 50, { buttons: 0 }));
    t = 300;
    hand.mouseDown(mouseEvent(node, 50, 50));
    t = 350;
    hand.mouseMove(mouseEvent(node, 150, 50));
    hand.mouseUp(mouseEvent(node, 150, 50, { buttons: 0 }));

    assert.strictEqual(doubleSwipe, 0);
    assert.ok(tripleSwipe);
    assert.deepStrictEqual(tripleSwipe.sequence, ['tap', 'tap', 'tap', 'swipe']);
    assert.deepStrictEqual(tripleSwipe.gestureSequence.pattern, ['tripletap', 'swiperight']);
});

run('sequence callbacks match rolling and modifier base gestures', () => {
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
        rotate: { enabled: false },
        intent: {
            events: ['rollingtap', 'modifiertap']
        }
    });
    let rollingSequence = 0;
    let modifierSequence = 0;

    hand.on('rollingtap>modifiertap', () => {
        rollingSequence++;
    });
    hand.on('rolling>modifier', () => {
        modifierSequence++;
    });

    hand.pointerDown(pointerEvent(node, 1, 80, 80));
    t = 45;
    hand.pointerDown(pointerEvent(node, 2, 112, 80));
    t = 130;
    hand.pointerUp(pointerEvent(node, 2, 112, 80, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 1, 80, 80, { buttons: 0 }));
    t = 400;
    hand.pointerDown(pointerEvent(node, 3, 80, 80));
    t = 960;
    hand.pointerDown(pointerEvent(node, 4, 120, 80));
    t = 990;
    hand.pointerUp(pointerEvent(node, 4, 120, 80, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 3, 80, 80, { buttons: 0 }));

    assert.strictEqual(rollingSequence, 1);
    assert.strictEqual(modifierSequence, 0);
});

run('sequence specificity: direction-specific swipes', () => {
    let t = 0;
    const { node, hand } = createMouse({ clock: () => t });
    let right = 0;
    let left = 0;
    hand.on('tap>swiperight', () => right++);
    hand.on('tap>swipeleft', () => left++);

    // Tap + Swipe Right
    hand.mouseDown(mouseEvent(node, 40, 50));
    hand.mouseUp(mouseEvent(node, 40, 50, { buttons: 0 }));
    t += 100;
    hand.mouseDown(mouseEvent(node, 50, 50));
    t += 50;
    hand.mouseMove(mouseEvent(node, 150, 50));
    hand.mouseUp(mouseEvent(node, 150, 50, { buttons: 0 }));

    // Tap + Swipe Left
    t += 100;
    hand.mouseDown(mouseEvent(node, 40, 50));
    hand.mouseUp(mouseEvent(node, 40, 50, { buttons: 0 }));
    t += 100;
    hand.mouseDown(mouseEvent(node, 150, 50));
    t += 50;
    hand.mouseMove(mouseEvent(node, 50, 50));
    hand.mouseUp(mouseEvent(node, 50, 50, { buttons: 0 }));

    assert.strictEqual(right, 1);
    assert.strictEqual(left, 1);
});

run('sequence specificity: explicit tap atom counts', () => {
    let t = 0;
    const { node, hand } = createMouse({ clock: () => t });
    let single = 0;
    let double = 0;
    let triple = 0;
    hand.on('singletap>swipe', () => single++);
    hand.on('tap>tap>swipe', () => double++);
    hand.on('tap>tap>tap>swipe', () => triple++);

    const swipe = () => {
        t += 100;
        hand.mouseDown(mouseEvent(node, 50, 50));
        t += 50;
        hand.mouseMove(mouseEvent(node, 150, 50));
        hand.mouseUp(mouseEvent(node, 150, 50, { buttons: 0 }));
    };

    // singletap>swipe
    hand.mouseDown(mouseEvent(node, 40, 50));
    hand.mouseUp(mouseEvent(node, 40, 50, { buttons: 0 }));
    swipe();

    // tap>tap>swipe
    t += 1000;
    hand.mouseDown(mouseEvent(node, 40, 50));
    hand.mouseUp(mouseEvent(node, 40, 50, { buttons: 0 }));
    t += 100;
    hand.mouseDown(mouseEvent(node, 40, 50));
    hand.mouseUp(mouseEvent(node, 40, 50, { buttons: 0 }));
    swipe();

    // tap>tap>tap>swipe
    t += 1000;
    hand.mouseDown(mouseEvent(node, 40, 50));
    hand.mouseUp(mouseEvent(node, 40, 50, { buttons: 0 }));
    t += 100;
    hand.mouseDown(mouseEvent(node, 40, 50));
    hand.mouseUp(mouseEvent(node, 40, 50, { buttons: 0 }));
    t += 100;
    hand.mouseDown(mouseEvent(node, 40, 50));
    hand.mouseUp(mouseEvent(node, 40, 50, { buttons: 0 }));
    swipe();

    assert.strictEqual(single, 1);
    assert.strictEqual(double, 1);
    assert.strictEqual(triple, 1);
});

run('sequence specificity: finger count aliases', () => {
    let t = 0;
    const node = target();
    const hand = new HandTrick(node, {
        input: 'pointer',
        clock: () => t,
        windowEvents: false,
        tapHold: { enabled: false },
        swipe: {
            distanceByFingers: { 1: 60, 2: 60 },
            minTime: 0,
            minSamples: 1,
            confidenceDelay: 0,
            intentDistance: 10
        },
        intent: {
            events: ['1fingertap>swipe', '2fingertap>swipe']
        }
    });
    let oneFinger = 0;
    let twoFinger = 0;
    hand.on('1fingertap>swipe', () => oneFinger++);
    hand.on('2fingertap>swipe', () => twoFinger++);

    // 1 finger tap + swipe
    hand.pointerDown(pointerEvent(node, 1, 40, 50));
    hand.pointerUp(pointerEvent(node, 1, 40, 50, { buttons: 0 }));
    t += 100;
    hand.pointerDown(pointerEvent(node, 1, 50, 50));
    t += 50;
    hand.pointerMove(pointerEvent(node, 1, 150, 50));
    hand.pointerUp(pointerEvent(node, 1, 150, 50, { buttons: 0 }));

    // 2 finger tap + swipe
    t += 1000;
    hand.pointerDown(pointerEvent(node, 1, 40, 50));
    hand.pointerDown(pointerEvent(node, 2, 60, 50));
    t += 50;
    hand.pointerUp(pointerEvent(node, 2, 60, 50, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 1, 40, 50, { buttons: 0 }));
    t += 100;
    hand.pointerDown(pointerEvent(node, 1, 50, 50));
    t += 50;
    hand.pointerMove(pointerEvent(node, 1, 150, 50));
    hand.pointerUp(pointerEvent(node, 1, 150, 50, { buttons: 0 }));

    assert.strictEqual(oneFinger, 1, 'Should match 1fingertap>swipe');
    assert.strictEqual(twoFinger, 1, 'Should match 2fingertap>swipe');
});

run('generated finger doubletap aliases work inside sequences', () => {
    let t = 0;
    const { node, hand } = createMouse({
        clock: () => t,
        intent: {
            events: ['2fingerdoubletap>swiperight']
        }
    });
    let matched = null;

    hand.on('2fingerdoubletap>swiperight', detail => {
        matched = detail;
    });

    hand.mouseDown(mouseEvent(node, 40, 50, { altKey: true }));
    hand.mouseUp(mouseEvent(node, 40, 50, { buttons: 0, altKey: true }));
    t = 110;
    hand.mouseDown(mouseEvent(node, 42, 50, { altKey: true }));
    hand.mouseUp(mouseEvent(node, 42, 50, { buttons: 0, altKey: true }));
    t = 230;
    hand.mouseDown(mouseEvent(node, 50, 50, { altKey: true }));
    t = 290;
    hand.mouseMove(mouseEvent(node, 130, 50, { altKey: true }));
    hand.mouseUp(mouseEvent(node, 130, 50, { buttons: 0, altKey: true }));

    assert.ok(matched);
    assert.strictEqual(matched.fingers, 2);
    assert.strictEqual(matched.fingerSource, 'keyboard');
    assert.deepStrictEqual(matched.gestureSequence.pattern, ['2fingerdoubletap', 'swiperight']);
});

run('sequence negative matching: length mismatch and interruption', () => {
    let t = 0;
    const { node, hand } = createMouse({ clock: () => t });
    let matched = 0;
    hand.on('tap>tap>swipe', () => matched++);

    // Only one tap then swipe
    hand.mouseDown(mouseEvent(node, 40, 50));
    hand.mouseUp(mouseEvent(node, 40, 50, { buttons: 0 }));
    t += 100;
    hand.mouseDown(mouseEvent(node, 50, 50));
    t += 50;
    hand.mouseMove(mouseEvent(node, 150, 50));
    hand.mouseUp(mouseEvent(node, 150, 50, { buttons: 0 }));

    assert.strictEqual(matched, 0, 'Should not match if too short');

    // Tap, then something else (press), then swipe
    t += 1000;
    hand.mouseDown(mouseEvent(node, 40, 50));
    hand.mouseUp(mouseEvent(node, 40, 50, { buttons: 0 }));
    t += 100;
    // Press (simulated by time)
    hand.mouseDown(mouseEvent(node, 40, 50));
    t += 600;
    hand.mouseUp(mouseEvent(node, 40, 50, { buttons: 0 }));
    t += 100;
    hand.mouseDown(mouseEvent(node, 50, 50));
    t += 50;
    hand.mouseMove(mouseEvent(node, 150, 50));
    hand.mouseUp(mouseEvent(node, 150, 50, { buttons: 0 }));

    assert.strictEqual(matched, 0, 'Should not match if interrupted by press');
});
