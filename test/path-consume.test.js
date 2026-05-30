const { assert, HandTrick, target, pointerEvent, run } = require('./helpers');

function createHand(overrides = {}) {
    let t = 0;
    const node = target();
    const path = Object.assign({
        minDistance: 30,
        segmentDistance: 30,
        minTime: 0,
        minSamples: 1,
        maxPause: 500
    }, overrides.path || {});
    const swipe = Object.assign({
        distanceByFingers: { 1: 60, 2: 60 },
        intentDistance: 20,
        confidenceDelay: 0,
        minTime: 0,
        minSamples: 1
    }, overrides.swipe || {});
    const config = Object.assign({
        input: 'pointer',
        windowEvents: false,
        preventDefault: false,
        clock: () => t,
        intent: { events: null },
        press: { enabled: false },
        pan: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        swipe,
        path
    }, overrides, { path, swipe, clock: () => t });
    const hand = new HandTrick(node, ['media', config]);

    return {
        node,
        hand,
        setTime(value) {
            t = value;
        }
    };
}

function oneFingerRight(ctx) {
    ctx.hand.pointerDown(pointerEvent(ctx.node, 1, 80, 100));
    ctx.setTime(70);
    ctx.hand.pointerMove(pointerEvent(ctx.node, 1, 150, 100));
    ctx.hand.pointerUp(pointerEvent(ctx.node, 1, 150, 100, { buttons: 0 }));
}

function twoFingerRight(ctx) {
    ctx.hand.pointerDown(pointerEvent(ctx.node, 1, 80, 90));
    ctx.hand.pointerDown(pointerEvent(ctx.node, 2, 80, 110));
    ctx.setTime(70);
    ctx.hand.pointerMove(pointerEvent(ctx.node, 1, 150, 90));
    ctx.hand.pointerMove(pointerEvent(ctx.node, 2, 150, 110));
    ctx.hand.pointerUp(pointerEvent(ctx.node, 1, 150, 90, { buttons: 0 }));
    ctx.hand.pointerUp(pointerEvent(ctx.node, 2, 150, 110, { buttons: 0 }));
}

function leftUp(ctx) {
    ctx.hand.pointerDown(pointerEvent(ctx.node, 1, 250, 180));
    ctx.setTime(40);
    ctx.hand.pointerMove(pointerEvent(ctx.node, 1, 150, 180));
    ctx.setTime(80);
    ctx.hand.pointerMove(pointerEvent(ctx.node, 1, 150, 130));
    ctx.hand.pointerUp(pointerEvent(ctx.node, 1, 150, 130, { buttons: 0 }));
}

run('auto path consume is default and keeps straight one finger swipe available', () => {
    const ctx = createHand();
    const seen = [];

    assert.strictEqual(ctx.hand.options.path.consume, 'auto');
    ctx.hand.command('left>right>left', () => seen.push('path'));
    ctx.hand.command('swipe:right', detail => seen.push('swipe:' + detail.fingers));

    oneFingerRight(ctx);

    assert.deepStrictEqual(seen, ['swipe:1']);
});

run('eager path consume blocks straight one finger release swipe', () => {
    const ctx = createHand({ path: { consume: 'eager' } });
    const seen = [];

    ctx.hand.command('left>right>left', () => seen.push('path'));
    ctx.hand.command('swipe:right', () => seen.push('swipe'));

    oneFingerRight(ctx);

    assert.deepStrictEqual(seen, []);
});

run('never path consume allows completed path and release swipe coexistence', () => {
    const ctx = createHand({ path: { consume: 'never' } });
    const seen = [];

    ctx.hand.command('left>up', () => seen.push('path'));
    ctx.hand.command('swipe:left', () => seen.push('swipe'));

    leftUp(ctx);

    assert.deepStrictEqual(seen, ['path', 'swipe']);
});

run('auto path consume blocks release swipe after path turn', () => {
    const ctx = createHand({ path: { consume: 'auto' } });
    const seen = [];

    ctx.hand.command('left>up', () => seen.push('path'));
    ctx.hand.command('swipe:left', () => seen.push('swipe'));

    leftUp(ctx);

    assert.deepStrictEqual(seen, ['path']);
});

run('auto path consume blocks release swipe after command-phase path criteria match', () => {
    const ctx = createHand({ path: { consume: 'auto' } });
    const seen = [];

    ctx.hand.command('path', { path: 'right' }, () => seen.push('path'));
    ctx.hand.command('swipe:right', () => seen.push('swipe'));

    oneFingerRight(ctx);

    assert.deepStrictEqual(seen, ['path']);
});

run('auto observe-only path does not consume straight release swipe', () => {
    const ctx = createHand({ path: { consume: 'auto' } });
    const seen = [];

    ctx.hand.observe('path', detail => seen.push('path:' + detail.pathText));
    ctx.hand.command('swipe:right', () => seen.push('swipe'));

    oneFingerRight(ctx);

    assert.deepStrictEqual(seen, ['path:right', 'swipe']);
});

run('path consume accepts explicit strings and defaults invalid values to auto', () => {
    const ctx = createHand({ path: { consume: true } });

    assert.strictEqual(ctx.hand.options.path.consume, 'auto');
    ctx.hand.setOptions({ path: { consume: false } });
    assert.strictEqual(ctx.hand.options.path.consume, 'auto');
    ctx.hand.setOptions({ path: { consume: null } });
    assert.strictEqual(ctx.hand.options.path.consume, 'auto');
    ctx.hand.setOptions({ path: { consume: 'NEVER' } });
    assert.strictEqual(ctx.hand.options.path.consume, 'never');
    ctx.hand.setOptions({ path: { consume: 'wat' } });
    assert.strictEqual(ctx.hand.options.path.consume, 'auto');
});

run('one finger eager path listeners do not block two finger swipe channel', () => {
    const ctx = createHand({ path: { consume: 'eager' } });
    const seen = [];

    ctx.hand.command('left>right>left', () => seen.push('path'));
    ctx.hand.command('swipe:right', { fingers: 2 }, detail => seen.push('swipe:' + detail.fingers));

    twoFingerRight(ctx);

    assert.deepStrictEqual(seen, ['swipe:2']);
});

run('auto release-flushed one segment path command consumes before release swipe', () => {
    const ctx = createHand({ path: { consume: 'auto' } });
    const seen = [];

    ctx.hand.command('right', () => seen.push('path:right'));
    ctx.hand.command('right>down', () => seen.push('path:long'));
    ctx.hand.command('swipe:right', () => seen.push('swipe'));

    oneFingerRight(ctx);

    assert.deepStrictEqual(seen, ['path:right']);
});

run('auto observe-only pending path criteria does not consume release swipe', () => {
    const ctx = createHand({ path: { consume: 'auto' } });
    const seen = [];

    ctx.hand.on('path', { path: 'right' }, () => seen.push('path:observe'), { phase: 'observe' });
    ctx.hand.command('right>down', () => seen.push('path:long'));
    ctx.hand.command('swipe:right', () => seen.push('swipe'));

    oneFingerRight(ctx);

    assert.deepStrictEqual(seen, ['path:observe', 'swipe']);
});

run('auto bare one segment path command consumes straight release swipe immediately', () => {
    const ctx = createHand({ path: { consume: 'auto' } });
    const seen = [];

    ctx.hand.command('right', () => seen.push('path:right'));
    ctx.hand.command('swipe:right', () => seen.push('swipe'));

    oneFingerRight(ctx);

    assert.deepStrictEqual(seen, ['path:right']);
});

run('boolean true consume is invalid and falls back to auto', () => {
    const ctx = createHand({ path: { consume: true } });
    const seen = [];

    ctx.hand.command('left>right>left', () => seen.push('path'));
    ctx.hand.command('swipe:right', () => seen.push('swipe'));

    oneFingerRight(ctx);

    assert.deepStrictEqual(seen, ['swipe']);
});

run('boolean false consume is invalid and falls back to auto', () => {
    const ctx = createHand({ path: { consume: false } });
    const seen = [];

    ctx.hand.command('left>up', () => seen.push('path'));
    ctx.hand.command('swipe:left', () => seen.push('swipe'));

    leftUp(ctx);

    assert.deepStrictEqual(seen, ['path']);
});

run('null consume is invalid and falls back to auto', () => {
    const ctx = createHand({ path: { consume: null } });
    const seen = [];

    ctx.hand.command('left>up', () => seen.push('path'));
    ctx.hand.command('swipe:left', () => seen.push('swipe'));

    leftUp(ctx);

    assert.deepStrictEqual(seen, ['path']);
});

run('explicitly disabled path does not consume even with eager mode and path listeners', () => {
    const ctx = createHand({ path: { enabled: false, consume: 'eager' } });
    const seen = [];

    ctx.hand.command('left>right>left', () => seen.push('path'));
    ctx.hand.command('swipe:right', () => seen.push('swipe'));

    oneFingerRight(ctx);

    assert.deepStrictEqual(seen, ['swipe']);
});

run('path finger channel controls which swipe channel can be consumed', () => {
    const oneFinger = createHand({ path: { fingers: [2], consume: 'eager' } });
    const twoFinger = createHand({ path: { fingers: [2], consume: 'eager' } });
    const seenOne = [];
    const seenTwo = [];

    oneFinger.hand.command('left>right>left', () => seenOne.push('path'));
    oneFinger.hand.command('swipe:right', detail => seenOne.push('swipe:' + detail.fingers));
    twoFinger.hand.command('left>right>left', () => seenTwo.push('path'));
    twoFinger.hand.command('swipe:right', { fingers: 2 }, detail => seenTwo.push('swipe:' + detail.fingers));

    oneFingerRight(oneFinger);
    twoFingerRight(twoFinger);

    assert.deepStrictEqual(seenOne, ['swipe:1']);
    assert.deepStrictEqual(seenTwo, []);
});
