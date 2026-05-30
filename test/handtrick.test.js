const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const { assert, HandTrick, target, mouseEvent, pointerEvent, run } = require('./helpers');

function create(options = {}) {
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

run('exports constructor and defaults', () => {
    assert.strictEqual(typeof HandTrick, 'function');
    assert.strictEqual(typeof HandTrick.create, 'function');
    assert.strictEqual(HandTrick.defaults.tap.maxTime, 420);
});

run('ES module entry exports default and named constructor without a global bridge', () => {
    ['handtrick.mjs', 'handtrick.min.mjs'].forEach(file => {
        const moduleSource = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
        assert.ok(!moduleSource.includes('globalThis'));
        assert.ok(!moduleSource.includes("import './handtrick.js'"));

        childProcess.execFileSync(process.execPath, [
            '--input-type=module',
            '-e',
            "delete global.HandTrick; const mod = await import('./" + file + "'); if (mod.default !== mod.HandTrick || typeof mod.default.create !== 'function') throw new Error('bad module export'); if (global.HandTrick !== undefined) throw new Error('module wrote global');"
        ], { cwd: path.resolve(__dirname, '..') });
    });
});

run('single and double tap emit enriched detail', () => {
    const { node, hand } = create();
    const seen = [];

    hand.observe('tap', detail => seen.push(['tap', detail.tapCount, detail.center.ratioX]));
    hand.on('tap:2x', detail => seen.push(['tap:2x', detail.tapCount, detail.fingers]));

    hand.mouseDown(mouseEvent(node, 40, 50));
    hand.mouseUp(mouseEvent(node, 40, 50, { buttons: 0 }));
    hand.mouseDown(mouseEvent(node, 42, 50));
    hand.mouseUp(mouseEvent(node, 42, 50, { buttons: 0 }));

    assert.deepStrictEqual(seen.map(item => item[0]), ['tap', 'tap', 'tap:2x']);
    assert.strictEqual(seen[0][1], 1);
    assert.strictEqual(seen[1][1], 2);
    assert.strictEqual(seen[2][2], 1);
    assert.ok(seen[0][2] > 0);
});

run('swipe can emit after pan when configured', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        pan: { canStart: () => true },
        swipe: { distanceByFingers: { 1: 80 }, allowAfterPan: true }
    });
    const seen = [];

    hand.on('pan:start', detail => seen.push('pan:start:' + detail.direction));
    hand.on('pan', detail => seen.push('pan:' + detail.direction));
    hand.on('pan:end', detail => seen.push('pan:end:' + detail.direction));
    hand.observe('swipe', detail => seen.push('swipe:' + detail.direction));
    hand.on('swipe:right', detail => seen.push('swipe:right:' + detail.axis));

    hand.mouseDown(mouseEvent(node, 20, 20));
    t = 50;
    hand.mouseMove(mouseEvent(node, 150, 25));
    t = 100;
    hand.mouseMove(mouseEvent(node, 170, 25));
    t = 120;
    hand.mouseUp(mouseEvent(node, 170, 25, { buttons: 0 }));

    assert.deepStrictEqual(seen, ['pan:start:right', 'pan:right', 'pan:end:right', 'swipe:right', 'swipe:right:x']);
});

run('pinch reports activation-rebased scale', () => {
    let t = 0;
    const node = target();
    const hand = new HandTrick(node, {
        input: 'pointer',
        clock: () => t,
        windowEvents: false,
        preventDefault: false,
        wheel: { enabled: false },
        press: { enabled: false },
        rotate: { enabled: false }
    });
    const scales = [];

    hand.on('pinch', detail => scales.push(Number(detail.scale.toFixed(2))));
    hand.pointerDown(pointerEvent(node, 1, 100, 100));
    hand.pointerDown(pointerEvent(node, 2, 200, 100));
    t = 70;
    hand.pointerMove(pointerEvent(node, 1, 80, 100));
    t = 90;
    hand.pointerMove(pointerEvent(node, 1, 80, 100));
    t = 120;
    hand.pointerMove(pointerEvent(node, 2, 220, 100));
    hand.pointerUp(pointerEvent(node, 1, 80, 100, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 2, 220, 100, { buttons: 0 }));

    assert.deepStrictEqual(scales, [1, 1.17]);
});

run('rolling tap emits directional cascading contact', () => {
    let t = 0;
    const node = target();
    const hand = new HandTrick(node, {
        input: 'pointer',
        clock: () => t,
        windowEvents: false,
        preventDefault: false,
        wheel: { enabled: false },
        press: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false }
    });
    let rolling = null;
    let generic = 0;

    hand.on('rolling', () => generic++);
    hand.on('rolling:right', detail => {
        rolling = detail;
    });

    hand.pointerDown(pointerEvent(node, 1, 100, 100));
    t = 45;
    hand.pointerDown(pointerEvent(node, 2, 132, 102));
    t = 90;
    hand.pointerDown(pointerEvent(node, 3, 164, 104));
    t = 130;
    hand.pointerUp(pointerEvent(node, 3, 164, 104, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 2, 132, 102, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 1, 100, 100, { buttons: 0 }));

    assert.ok(rolling);
    assert.strictEqual(generic, 0);
    assert.strictEqual(rolling.direction, 'right');
    assert.strictEqual(rolling.rolling.count, 3);
    assert.deepStrictEqual(rolling.rolling.delays, [45, 45]);
    assert.strictEqual(rolling.rolling.source, 'pointer');
    assert.ok(rolling.rolling.overlapCount >= 2);
});

run('pinch command picks direction alias while observers stay additive', () => {
    let t = 0;
    const { node, hand } = create({
        input: 'pointer',
        clock: () => t,
        intent: { events: ['pinch', 'pinch:out'] },
        swipe: { enabled: false },
        rotate: { enabled: false },
        pinch: {
            distance: 8,
            scale: 0.02,
            minTime: 0,
            minSamples: 1,
            dominance: 0.1
        }
    });
    const commands = [];
    const observed = [];

    hand.command('pinch', () => commands.push('pinch'));
    hand.command('pinch:out', () => commands.push('out'));
    hand.observe('pinch', () => observed.push('pinch'));
    hand.observe('pinch:out', () => observed.push('out'));

    hand.pointerDown(pointerEvent(node, 1, 100, 100));
    hand.pointerDown(pointerEvent(node, 2, 140, 100));
    t = 40;
    hand.pointerMove(pointerEvent(node, 2, 180, 100));

    assert.ok(commands.length > 0);
    assert.ok(commands.every(item => item === 'out'));
    assert.ok(observed.includes('pinch'));
    assert.ok(observed.includes('out'));
});

run('rolling tap rejects adjacent lift gap during a touch wave', () => {
    let t = 0;
    const node = target();
    const hand = new HandTrick(node, {
        input: 'pointer',
        clock: () => t,
        windowEvents: false,
        preventDefault: false,
        wheel: { enabled: false },
        press: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false }
    });
    let rolling = null;
    let tap = 0;

    hand.on('rolling:right', detail => {
        rolling = detail;
    });
    hand.on('tap', { fingers: 3 }, () => tap++);

    hand.pointerDown(pointerEvent(node, 1, 100, 100));
    t = 70;
    hand.pointerDown(pointerEvent(node, 2, 132, 101));
    t = 100;
    hand.pointerUp(pointerEvent(node, 2, 132, 101, { buttons: 0 }));
    t = 135;
    hand.pointerDown(pointerEvent(node, 3, 164, 102));
    t = 190;
    hand.pointerUp(pointerEvent(node, 3, 164, 102, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 1, 100, 100, { buttons: 0 }));

    assert.strictEqual(rolling, null);
    assert.strictEqual(tap, 0);
});

run('quick two-finger roll beats two-finger tap with wider same-hand gap', () => {
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
        intent: { events: ['rolling', 'tap'] }
    });
    let rolling = 0;
    let tap = 0;

    hand.on('rolling:right', () => rolling++);
    hand.on('tap', { fingers: 2 }, () => tap++);

    hand.pointerDown(pointerEvent(node, 1, 80, 100));
    t = 12;
    hand.pointerDown(pointerEvent(node, 2, 240, 102));
    t = 80;
    hand.pointerUp(pointerEvent(node, 2, 240, 102, { buttons: 0 }));
    t = 120;
    hand.pointerUp(pointerEvent(node, 1, 80, 100, { buttons: 0 }));

    assert.strictEqual(rolling, 1);
    assert.strictEqual(tap, 0);
});

run('delayed two-finger roll beats modifier and two-finger tap fallback', () => {
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
        intent: { events: ['rolling', 'tap', 'tap:mod'] }
    });
    let rolling = 0;
    let tap = 0;
    let modifier = 0;

    hand.on('rolling:right', () => rolling++);
    hand.on('tap', { fingers: 2 }, () => tap++);
    hand.on('tap:mod', () => modifier++);

    hand.pointerDown(pointerEvent(node, 1, 80, 100));
    t = 190;
    hand.pointerDown(pointerEvent(node, 2, 310, 102));
    t = 260;
    hand.pointerUp(pointerEvent(node, 2, 310, 102, { buttons: 0 }));
    t = 320;
    hand.pointerUp(pointerEvent(node, 1, 80, 100, { buttons: 0 }));

    assert.strictEqual(rolling, 1);
    assert.strictEqual(tap, 0);
    assert.strictEqual(modifier, 0);
});

run('slow overlapping two-finger roll accepts 500ms down spacing', () => {
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
        intent: { events: ['rolling', 'tap'] }
    });
    let rolling = null;
    let tap = 0;

    hand.on('rolling:right', detail => {
        rolling = detail;
    });
    hand.on('tap', { fingers: 2 }, () => tap++);

    hand.pointerDown(pointerEvent(node, 1, 80, 100));
    t = 500;
    hand.pointerDown(pointerEvent(node, 2, 180, 102));
    t = 540;
    hand.pointerUp(pointerEvent(node, 2, 180, 102, { buttons: 0 }));
    t = 560;
    hand.pointerUp(pointerEvent(node, 1, 80, 100, { buttons: 0 }));

    assert.ok(rolling);
    assert.deepStrictEqual(rolling.rolling.delays, [500]);
    assert.strictEqual(tap, 0);
});

run('wide delayed three-finger roll beats three-finger tap fallback', () => {
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
        intent: { events: ['rolling', 'tap'] }
    });
    let rolling = null;
    let tap = 0;

    hand.on('rolling:right', detail => {
        rolling = detail;
    });
    hand.on('tap', { fingers: 3 }, () => tap++);

    hand.pointerDown(pointerEvent(node, 1, 40, 100));
    t = 180;
    hand.pointerDown(pointerEvent(node, 2, 270, 103));
    t = 360;
    hand.pointerDown(pointerEvent(node, 3, 500, 106));
    t = 400;
    hand.pointerUp(pointerEvent(node, 3, 500, 106, { buttons: 0 }));
    t = 410;
    hand.pointerUp(pointerEvent(node, 2, 270, 103, { buttons: 0 }));
    t = 420;
    hand.pointerUp(pointerEvent(node, 1, 40, 100, { buttons: 0 }));

    assert.ok(rolling);
    assert.strictEqual(rolling.rolling.count, 3);
    assert.deepStrictEqual(rolling.rolling.delays, [180, 180]);
    assert.strictEqual(tap, 0);
});

run('extra-wide three-finger roll uses relaxed three-finger bounds', () => {
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
        intent: { events: ['rolling', 'tap'] }
    });
    let two = 0;
    let three = null;
    let tap = 0;

    hand.on('rolling', { fingers: 2 }, () => two++);
    hand.on('rolling', { fingers: 3 }, detail => {
        three = detail;
    });
    hand.on('tap', { fingers: 3 }, () => tap++);

    hand.pointerDown(pointerEvent(node, 1, 20, 100));
    t = 250;
    hand.pointerDown(pointerEvent(node, 2, 320, 105));
    t = 500;
    hand.pointerDown(pointerEvent(node, 3, 620, 110));
    t = 520;
    hand.pointerUp(pointerEvent(node, 3, 620, 110, { buttons: 0 }));
    t = 540;
    hand.pointerUp(pointerEvent(node, 2, 320, 105, { buttons: 0 }));
    t = 560;
    hand.pointerUp(pointerEvent(node, 1, 20, 100, { buttons: 0 }));

    assert.strictEqual(two, 0);
    assert.ok(three);
    assert.strictEqual(three.rolling.count, 3);
    assert.deepStrictEqual(three.rolling.delays, [250, 250]);
    assert.strictEqual(tap, 0);
});

run('isolated one-finger tap chain does not become rolling tap', () => {
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
        rolling: { fingers: [2, 3] },
        intent: { events: ['rolling', 'tap', 'tap:2x', 'tap:3x'] }
    });
    let rolling = 0;
    let tap = 0;

    hand.on('rolling', () => rolling++);
    hand.on('tap', () => tap++);

    hand.pointerDown(pointerEvent(node, 1, 90, 100));
    t = 35;
    hand.pointerUp(pointerEvent(node, 1, 90, 100, { buttons: 0 }));
    t = 155;
    hand.pointerDown(pointerEvent(node, 1, 260, 104));
    t = 190;
    hand.pointerUp(pointerEvent(node, 1, 260, 104, { buttons: 0 }));
    t = 300;
    hand.pointerDown(pointerEvent(node, 1, 430, 108));
    t = 335;
    hand.pointerUp(pointerEvent(node, 1, 430, 108, { buttons: 0 }));

    assert.strictEqual(rolling, 0);
    assert.strictEqual(tap, 3);
});

run('ignore selector blocks input and resets cleanly', () => {
    const node = target();
    const ignored = {
        closest(selector) {
            return selector === '.ignore' ? this : null;
        }
    };
    const hand = new HandTrick(node, {
        input: 'mouse',
        windowEvents: false,
        preventDefault: false,
        ignore: '.ignore',
        wheel: { enabled: false },
        press: { enabled: false }
    });
    let ignoredCount = 0;
    let tapCount = 0;

    hand.on('input:ignored', () => ignoredCount++);
    hand.on('tap', () => tapCount++);
    hand.mouseDown(mouseEvent(ignored, 10, 10));
    hand.mouseUp(mouseEvent(ignored, 10, 10, { buttons: 0 }));
    hand.mouseDown(mouseEvent(node, 10, 10));
    hand.mouseUp(mouseEvent(node, 10, 10, { buttons: 0 }));

    assert.strictEqual(ignoredCount, 1);
    assert.strictEqual(tapCount, 1);
});

run('destroy removes native listeners', () => {
    const { node, hand } = create();
    const before = Array.from(node.listeners.values()).reduce((total, set) => total + set.size, 0);

    hand.destroy();

    const after = Array.from(node.listeners.values()).reduce((total, set) => total + set.size, 0);
    assert.ok(before > 0);
    assert.strictEqual(after, 0);
});

run('tap then tap and move keeps pan continuous', () => {
    const { node, hand } = create({
        pan: {
            threshold: 10,
            minTime: 0,
            minSamples: 1,
            canStart: detail => detail.tapHold
        }
    });
    const deltas = [];

    hand.on('pan', detail => deltas.push(detail.deltaX));

    hand.mouseDown(mouseEvent(node, 50, 50));
    hand.mouseUp(mouseEvent(node, 50, 50, { buttons: 0 }));
    hand.mouseDown(mouseEvent(node, 50, 50));
    hand.mouseMove(mouseEvent(node, 70, 50));
    hand.mouseMove(mouseEvent(node, 90, 50));
    hand.mouseUp(mouseEvent(node, 90, 50, { buttons: 0 }));

    assert.deepStrictEqual(deltas, [20, 40]);
});

run('held finger plus second tap emits modifier tap', () => {
    let t = 0;
    const node = target();
    const hand = new HandTrick(node, {
        input: 'pointer',
        clock: () => t,
        windowEvents: false,
        preventDefault: false,
        wheel: { enabled: false },
        press: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false }
    });
    let modifier = null;

    hand.on('tap:mod', detail => {
        modifier = detail;
    });

    hand.pointerDown(pointerEvent(node, 1, 80, 80));
    t = 200;
    hand.pointerDown(pointerEvent(node, 2, 160, 80));
    t = 230;
    hand.pointerUp(pointerEvent(node, 2, 160, 80, { buttons: 0 }));
    t = 240;
    hand.pointerUp(pointerEvent(node, 1, 80, 80, { buttons: 0 }));

    assert.ok(modifier);
    assert.strictEqual(modifier.modifier.fingers, 1);
    assert.strictEqual(modifier.actionPointer.id, 2);
});

run('held finger plus second drag emits modifier pan without pinch', () => {
    let t = 0;
    const node = target();
    const hand = new HandTrick(node, {
        input: 'pointer',
        clock: () => t,
        windowEvents: false,
        preventDefault: false,
        wheel: { enabled: false },
        press: { enabled: false },
        rotate: { enabled: false }
    });
    const pans = [];
    let pinches = 0;

    hand.on('pan:mod', detail => pans.push(detail.actionDeltaX));
    hand.on('pinch', () => pinches++);

    hand.pointerDown(pointerEvent(node, 1, 80, 80));
    t = 200;
    hand.pointerDown(pointerEvent(node, 2, 120, 80));
    t = 240;
    hand.pointerMove(pointerEvent(node, 2, 150, 80));
    t = 280;
    hand.pointerMove(pointerEvent(node, 2, 170, 80));
    hand.pointerUp(pointerEvent(node, 2, 170, 80, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 1, 80, 80, { buttons: 0 }));

    assert.deepStrictEqual(pans, [50]);
    assert.strictEqual(pinches, 0);
});

run('near-simultaneous two-finger tap stays tap instead of rolling or modifier', () => {
    let t = 0;
    const node = target();
    const hand = new HandTrick(node, {
        input: 'pointer',
        clock: () => t,
        windowEvents: false,
        preventDefault: false,
        wheel: { enabled: false },
        press: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false }
    });
    let modifier = 0;
    let rolling = 0;
    let tap = 0;

    hand.on('tap:mod', () => modifier++);
    hand.on('rolling', () => rolling++);
    hand.on('tap', { fingers: 2 }, () => tap++);

    hand.pointerDown(pointerEvent(node, 1, 80, 80));
    t = 8;
    hand.pointerDown(pointerEvent(node, 2, 120, 80));
    t = 40;
    hand.pointerUp(pointerEvent(node, 2, 120, 80, { buttons: 0 }));
    t = 80;
    hand.pointerUp(pointerEvent(node, 1, 80, 80, { buttons: 0 }));

    assert.strictEqual(modifier, 0);
    assert.strictEqual(rolling, 0);
    assert.strictEqual(tap, 1);
});

run('late short skew does not start rotate', () => {
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
        pinch: { enabled: false }
    });
    let rotates = 0;

    hand.on('rotate', () => rotates++);

    hand.pointerDown(pointerEvent(node, 1, 100, 100));
    hand.pointerDown(pointerEvent(node, 2, 200, 100));
    t = 20;
    hand.pointerMove(pointerEvent(node, 1, 100, 20));
    t = 40;
    hand.pointerMove(pointerEvent(node, 2, 200, 20));
    t = 1100;
    hand.pointerMove(pointerEvent(node, 2, 200, 0));
    hand.pointerUp(pointerEvent(node, 1, 100, 20, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 2, 200, 0, { buttons: 0 }));

    assert.strictEqual(rotates, 0);
});

run('two finger swipe skew does not emit rotate', () => {
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
        pinch: { enabled: false }
    });
    let rotates = 0;
    let swipes = 0;

    hand.on('rotate', () => rotates++);
    hand.on('swipe:up', () => swipes++);

    hand.pointerDown(pointerEvent(node, 1, 100, 100));
    hand.pointerDown(pointerEvent(node, 2, 200, 100));
    t = 45;
    hand.pointerMove(pointerEvent(node, 1, 100, 30));
    t = 95;
    hand.pointerMove(pointerEvent(node, 2, 200, 30));
    t = 145;
    hand.pointerMove(pointerEvent(node, 1, 100, 0));
    t = 180;
    hand.pointerMove(pointerEvent(node, 2, 200, 0));
    hand.pointerUp(pointerEvent(node, 1, 100, 0, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 2, 200, 0, { buttons: 0 }));

    assert.strictEqual(rotates, 0);
    assert.strictEqual(swipes, 1);
});

run('deliberate rotate emits after temporal proof', () => {
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
        pinch: { enabled: false }
    });
    let rotates = 0;

    hand.on('rotate', () => rotates++);

    hand.pointerDown(pointerEvent(node, 1, 100, 100));
    hand.pointerDown(pointerEvent(node, 2, 200, 100));
    t = 50;
    hand.pointerMove(pointerEvent(node, 1, 110, 80));
    t = 100;
    hand.pointerMove(pointerEvent(node, 2, 190, 120));
    t = 150;
    hand.pointerMove(pointerEvent(node, 1, 120, 70));
    hand.pointerUp(pointerEvent(node, 1, 120, 70, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 2, 190, 120, { buttons: 0 }));

    assert.ok(rotates > 0);
});

run('keyboard-modified pinch and rotate emit mod selectors', () => {
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
        modifier: { keyboard: { enabled: false } },
        pinch: { minTime: 0, minSamples: 1, distance: 4, scale: 0.01 },
        rotate: { minTime: 0, minSamples: 1, angle: 4, confidence: 0.2, requireMovedFingers: false }
    });
    const events = [];

    hand.on('pinch:mod:out', detail => events.push('pinch:' + detail.keyCombo));
    hand.on('rotate:mod:cw', detail => events.push('rotate:' + detail.keyCombo));

    const keys = { shiftKey: true };
    hand.pointerDown(pointerEvent(node, 1, 100, 100, keys));
    hand.pointerDown(pointerEvent(node, 2, 200, 100, keys));
    t = 40;
    hand.pointerMove(pointerEvent(node, 1, 80, 90, keys));
    t = 80;
    hand.pointerMove(pointerEvent(node, 2, 220, 110, keys));
    hand.pointerUp(pointerEvent(node, 1, 80, 90, Object.assign({ buttons: 0 }, keys)));
    hand.pointerUp(pointerEvent(node, 2, 220, 110, Object.assign({ buttons: 0 }, keys)));

    assert.ok(events.includes('pinch:shift'));
    assert.ok(events.includes('rotate:shift'));
});

run('tap sequence emits open-ended count metadata', () => {
    let t = 0;
    const { node, hand } = create({ clock: () => t });
    const counts = [];
    let triple = 0;

    hand.observe('tap:sequence', detail => counts.push([detail.tapCount, detail.sequence.length]));
    hand.on('tap:3x', () => triple++);

    hand.mouseDown(mouseEvent(node, 40, 50));
    hand.mouseUp(mouseEvent(node, 40, 50, { buttons: 0 }));
    t = 120;
    hand.mouseDown(mouseEvent(node, 42, 50));
    hand.mouseUp(mouseEvent(node, 42, 50, { buttons: 0 }));
    t = 240;
    hand.mouseDown(mouseEvent(node, 44, 50));
    hand.mouseUp(mouseEvent(node, 44, 50, { buttons: 0 }));

    assert.deepStrictEqual(counts, [[1, 1], [2, 2], [3, 3]]);
    assert.strictEqual(triple, 1);
});

run('pressure change emits aggregate pressure delta', () => {
    const node = target();
    const hand = new HandTrick(node, {
        input: 'pointer',
        windowEvents: false,
        preventDefault: false,
        wheel: { enabled: false },
        press: { enabled: false }
    });
    let pressure = null;

    hand.on('pressure:change', detail => {
        pressure = detail.pressureDelta;
    });

    hand.pointerDown(pointerEvent(node, 1, 100, 100, { pressure: 0.2 }));
    hand.pointerMove(pointerEvent(node, 1, 100, 100, { pressure: 0.5 }));
    hand.pointerUp(pointerEvent(node, 1, 100, 100, { buttons: 0, pressure: 0.5 }));

    assert.ok(pressure > 0.29);
});

run('default DOM suppression applies and restores target and active styles', () => {
    const { node, hand } = create();

    assert.strictEqual(node.style.touchAction, 'none');
    hand.mouseDown(mouseEvent(node, 10, 10));
    assert.strictEqual(node.ownerDocument.documentElement.style.userSelect, 'none');
    hand.mouseUp(mouseEvent(node, 10, 10, { buttons: 0 }));
    assert.strictEqual(node.ownerDocument.documentElement.style.userSelect, undefined);
    hand.destroy();
    assert.strictEqual(node.style.touchAction, undefined);
});

run('tap hold start suppresses native selection when claim is deferred', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        preventDefault: false,
        claim: {
            enabled: true,
            threshold: 0.5,
            preventDefault: true
        }
    });
    let prevented = 0;
    const preventDefault = () => {
        prevented++;
    };

    hand.mouseDown(mouseEvent(node, 50, 50));
    t = 20;
    hand.mouseUp(mouseEvent(node, 50, 50, { buttons: 0 }));
    t = 200;
    hand.mouseDown(mouseEvent(node, 50, 50, { cancelable: true, preventDefault }));

    assert.strictEqual(prevented, 1);
    hand.mouseUp(mouseEvent(node, 50, 50, { buttons: 0 }));
});

run('claim prevents default only after confidence threshold when configured', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        preventDefault: false,
        claim: {
            enabled: true,
            threshold: 0.5,
            preventDefault: true
        },
        pan: {
            threshold: 20
        }
    });
    let prevented = 0;
    const preventDefault = () => {
        prevented++;
    };

    hand.mouseDown(mouseEvent(node, 40, 50, { cancelable: true, preventDefault }));
    t = 20;
    hand.mouseMove(mouseEvent(node, 45, 50, { cancelable: true, preventDefault }));
    assert.strictEqual(prevented, 0);
    t = 50;
    hand.mouseMove(mouseEvent(node, 65, 50, { cancelable: true, preventDefault }));
    assert.strictEqual(prevented, 1);
    hand.mouseUp(mouseEvent(node, 65, 50, { buttons: 0, cancelable: true, preventDefault }));
});
