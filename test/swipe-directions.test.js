const { assert, HandTrick, target, mouseEvent, pointerEvent, run } = require('./helpers');

function createPointer(options = {}) {
    const node = target();
    const hand = new HandTrick(node, Object.assign({
        input: 'pointer',
        windowEvents: false,
        preventDefault: false,
        wheel: { enabled: false },
        press: { enabled: false },
        tapHold: { enabled: false },
        pan: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        swipe: {
            distanceByFingers: { 1: 60, 2: 60, 3: 60, 4: 60 },
            minTime: 0,
            minSamples: 1,
            confidenceDelay: 0,
            intentDistance: 20
        }
    }, options));
    return { node, hand };
}

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
            distanceByFingers: { 1: 60, 2: 60, 3: 60, 4: 60 },
            minTime: 0,
            minSamples: 1,
            confidenceDelay: 0,
            intentDistance: 20
        }
    }, options));
    return { node, hand };
}

function createMediaPathSwipe(consume) {
    let t = 0;
    const node = target();
    const hand = new HandTrick(node, ['media', {
        input: 'pointer',
        windowEvents: false,
        preventDefault: false,
        clock: () => t,
        intent: { events: null },
        press: { enabled: false },
        pan: { enabled: false },
        swipe: {
            distanceByFingers: { 1: 60 },
            intentDistance: 30,
            confidenceDelay: 50,
            minTime: 60,
            minSamples: 1
        },
        path: {
            minDistance: 36,
            segmentDistance: 34,
            minTime: 0,
            minSamples: 1,
            maxPause: 520,
            consume
        },
        pinch: { enabled: false },
        rotate: { enabled: false }
    }]);
    return {
        node,
        hand,
        setTime(value) {
            t = value;
        }
    };
}

run('direct swipe directions carry canonical direction and axis', () => {
    let t = 0;
    const { node, hand } = createPointer({
        clock: () => t,
        intent: { events: ['swipe:left', 'swipe:right', 'swipe:up', 'swipe:down'] }
    });
    const seen = [];

    ['left', 'right', 'up', 'down'].forEach(direction => {
        hand.on('swipe:' + direction, detail => {
            seen.push(detail.direction + ':' + detail.axis + ':' + detail.fingers);
        });
    });

    [
        [1, 160, 100, 60, 100],
        [2, 60, 100, 160, 100],
        [3, 100, 160, 100, 60],
        [4, 100, 60, 100, 160]
    ].forEach(item => {
        hand.pointerDown(pointerEvent(node, item[0], item[1], item[2]));
        t += 420;
        hand.pointerMove(pointerEvent(node, item[0], item[3], item[4]));
        hand.pointerUp(pointerEvent(node, item[0], item[3], item[4], { buttons: 0 }));
        t += 500;
    });

    assert.deepStrictEqual(seen, [
        'left:x:1',
        'right:x:1',
        'up:y:1',
        'down:y:1'
    ]);
});

run('tap swipe sequences preserve canonical directions', () => {
    let t = 0;
    const { node, hand } = createMouse({
        clock: () => t,
        intent: { events: ['tap>swipe:left', 'tap>swipe:right', 'tap>swipe:up', 'tap>swipe:down'] }
    });
    const seen = [];

    ['left', 'right', 'up', 'down'].forEach(direction => {
        hand.on('tap>swipe:' + direction, detail => {
            seen.push(detail.direction + ':' + detail.gestureSequence.pattern.join('|'));
        });
    });

    [
        [160, 100, 60, 100],
        [60, 100, 160, 100],
        [100, 160, 100, 60],
        [100, 60, 100, 160]
    ].forEach(item => {
        hand.mouseDown(mouseEvent(node, 40, 40));
        hand.mouseUp(mouseEvent(node, 40, 40, { buttons: 0 }));
        t += 160;
        hand.mouseDown(mouseEvent(node, item[0], item[1]));
        t += 420;
        hand.mouseMove(mouseEvent(node, item[2], item[3]));
        hand.mouseUp(mouseEvent(node, item[2], item[3], { buttons: 0 }));
        t += 500;
    });

    assert.deepStrictEqual(seen, [
        'left:tap|swipe:left',
        'right:tap|swipe:right',
        'up:tap|swipe:up',
        'down:tap|swipe:down'
    ]);
});

run('keyboard two finger swipes preserve direction metadata', () => {
    let t = 0;
    const { node, hand } = createMouse({
        clock: () => t,
        intent: { events: ['swipe'] },
        swipe: {
            distanceByFingers: { 2: 60 },
            minTime: 0,
            minSamples: 1,
            confidenceDelay: 0,
            intentDistance: 20
        }
    });
    const seen = [];

    hand.on('swipe', { fingers: 2, actualFingers: 1, fingerSource: 'keyboard', keyboardRole: 'twoFingers' }, detail => {
        seen.push(detail.direction + ':' + detail.fingers + ':' + detail.syntheticFingers + ':' + detail.fingerSource);
    });

    [
        [160, 100, 60, 100],
        [60, 100, 160, 100],
        [100, 160, 100, 60],
        [100, 60, 100, 160]
    ].forEach(item => {
        hand.mouseDown(mouseEvent(node, item[0], item[1], { altKey: true }));
        t += 420;
        hand.mouseMove(mouseEvent(node, item[2], item[3], { altKey: true }));
        hand.mouseUp(mouseEvent(node, item[2], item[3], { buttons: 0, altKey: true }));
        t += 500;
    });

    assert.deepStrictEqual(seen, [
        'left:2:2:keyboard',
        'right:2:2:keyboard',
        'up:2:2:keyboard',
        'down:2:2:keyboard'
    ]);
});

run('generic swipe commands and two finger criteria stay separate', () => {
    let t = 0;
    const { node, hand } = createPointer({
        clock: () => t,
        intent: { events: ['swipe:left'] }
    });
    const seen = [];

    hand.on('swipe:left', { fingers: 1 }, detail => {
        seen.push('one:' + detail.direction + ':' + detail.fingers);
    });
    hand.on('swipe:left', { fingers: 2 }, detail => {
        seen.push('two:' + detail.direction + ':' + detail.fingers);
    });

    hand.pointerDown(pointerEvent(node, 1, 180, 100));
    t += 420;
    hand.pointerMove(pointerEvent(node, 1, 80, 100));
    hand.pointerUp(pointerEvent(node, 1, 80, 100, { buttons: 0 }));
    t += 500;
    hand.pointerDown(pointerEvent(node, 2, 180, 80));
    hand.pointerDown(pointerEvent(node, 3, 180, 120));
    t += 420;
    hand.pointerMove(pointerEvent(node, 2, 80, 80));
    hand.pointerMove(pointerEvent(node, 3, 80, 120));
    hand.pointerUp(pointerEvent(node, 2, 80, 80, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 3, 80, 120, { buttons: 0 }));

    assert.deepStrictEqual(seen, ['one:left:1', 'two:left:2']);
});

run('media-style listener intent keeps one finger swipe commands active', () => {
    let t = 0;
    const node = target();
    const hand = new HandTrick(node, ['media', {
        input: 'pointer',
        windowEvents: false,
        preventDefault: false,
        clock: () => t,
        intent: {
            events: null,
            fastPath: true,
            fastPathSamples: 1
        },
        press: {
            enabled: true,
            delay: 500,
            move: 30,
            consumesTap: false
        },
        pan: {
            threshold: 15,
            minTime: 35,
            minSamples: 2,
            fingers: [1],
            canStart: detail => detail.tapHold && detail.elapsed >= 180 && detail.velocity < 0.35
        },
        swipe: {
            distanceByFingers: { 1: 60, 2: 60 },
            intentDistance: 30,
            confidenceDelay: 50,
            minTime: 60,
            minSamples: 1
        },
        pinch: { enabled: false },
        rotate: { enabled: false }
    }]);
    const seen = [];

    hand.command('pan:start', () => seen.push('pan'));
    hand.command('swipe:left', { fingers: 1 }, detail => seen.push('one:' + detail.direction + ':' + detail.fingers));
    hand.command('swipe:left', { fingers: 2 }, detail => seen.push('two:' + detail.direction + ':' + detail.fingers));

    hand.pointerDown(pointerEvent(node, 1, 150, 100));
    t = 70;
    hand.pointerMove(pointerEvent(node, 1, 80, 100));
    hand.pointerUp(pointerEvent(node, 1, 80, 100, { buttons: 0 }));

    assert.deepStrictEqual(seen, ['one:left:1']);
});

run('auto path listeners do not block straight one finger media swipes', () => {
    const { node, hand, setTime } = createMediaPathSwipe('auto');
    const seen = [];

    hand.command('left>right>left', () => seen.push('path'));
    hand.command('swipe:right', detail => seen.push('swipe:' + detail.direction + ':' + detail.fingers));

    hand.pointerDown(pointerEvent(node, 1, 80, 100));
    setTime(70);
    hand.pointerMove(pointerEvent(node, 1, 150, 100));
    hand.pointerUp(pointerEvent(node, 1, 150, 100, { buttons: 0 }));

    assert.deepStrictEqual(seen, ['swipe:right:1']);
});

run('never path listeners do not block straight one finger media swipes', () => {
    const { node, hand, setTime } = createMediaPathSwipe('never');
    const seen = [];

    hand.command('left>right>left', () => seen.push('path'));
    hand.command('swipe:right', detail => seen.push('swipe:' + detail.direction + ':' + detail.fingers));

    hand.pointerDown(pointerEvent(node, 1, 80, 100));
    setTime(70);
    hand.pointerMove(pointerEvent(node, 1, 150, 100));
    hand.pointerUp(pointerEvent(node, 1, 150, 100, { buttons: 0 }));

    assert.deepStrictEqual(seen, ['swipe:right:1']);
});

run('eager path listeners block straight one finger media swipes', () => {
    const { node, hand, setTime } = createMediaPathSwipe('eager');
    const seen = [];

    hand.command('left>right>left', () => seen.push('path'));
    hand.command('swipe:right', detail => seen.push('swipe:' + detail.direction + ':' + detail.fingers));

    hand.pointerDown(pointerEvent(node, 1, 80, 100));
    setTime(70);
    hand.pointerMove(pointerEvent(node, 1, 150, 100));
    hand.pointerUp(pointerEvent(node, 1, 150, 100, { buttons: 0 }));

    assert.deepStrictEqual(seen, []);
});
