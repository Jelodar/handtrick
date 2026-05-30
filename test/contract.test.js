const { assert, HandTrick, target, mouseEvent, pointerEvent, run } = require('./helpers');

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

function touchEvent(node, touches, changedTouches, extra = {}) {
    return Object.assign({
        target: node,
        touches,
        changedTouches,
        cancelable: false
    }, extra);
}

function touch(id, x, y, extra = {}) {
    return Object.assign({
        identifier: id,
        target: extra.target,
        pageX: x,
        pageY: y,
        clientX: extra.clientX !== undefined ? extra.clientX : x,
        clientY: extra.clientY !== undefined ? extra.clientY : y,
        screenX: x,
        screenY: y,
        force: extra.force || 0,
        radiusX: 1,
        radiusY: 1
    }, extra);
}

run('start previous and current centers share position contract', () => {
    let t = 0;
    const { node, hand } = createMouse({
        clock: () => t,
        pan: { threshold: 8, minTime: 0, minSamples: 1 }
    });
    const positions = [];

    hand.on('pan', detail => positions.push([detail.startCenter.localY, detail.previousCenter.localY, detail.center.region, detail.center.clampedRatioX]));

    hand.mouseDown(mouseEvent(node, 40, 50));
    t = 20;
    hand.mouseMove(mouseEvent(node, 80, 50));
    t = 40;
    hand.mouseMove(mouseEvent(node, 120, 60));
    hand.mouseUp(mouseEvent(node, 120, 60, { buttons: 0 }));

    assert.strictEqual(positions[0][0], 50);
    assert.strictEqual(positions[0][1], 50);
    assert.strictEqual(positions[1][1], 50);
    assert.strictEqual(positions[1][2], 'top-left');
    assert.ok(positions[1][3] > 0);
});

run('pan axis can lock horizontal payloads', () => {
    let t = 0;
    const { node, hand } = createMouse({
        clock: () => t,
        pan: { axis: 'x', threshold: 8, minTime: 0, minSamples: 1 },
        swipe: { enabled: false }
    });
    const seen = [];

    hand.on('pan', detail => seen.push([detail.deltaX, detail.deltaY, detail.panAxis, detail.axis]));

    hand.mouseDown(mouseEvent(node, 20, 20));
    t = 20;
    hand.mouseMove(mouseEvent(node, 30, 80));
    t = 40;
    hand.mouseMove(mouseEvent(node, 120, 82));
    hand.mouseUp(mouseEvent(node, 120, 82, { buttons: 0 }));

    assert.deepStrictEqual(seen, [[100, 0, 'x', 'x']]);
});

run('mouse and touch fallback paths honor input gates', () => {
    const mouseCase = createMouse({ mouse: false });
    let mouseStarts = 0;
    mouseCase.hand.on('session:start', () => mouseStarts++);
    mouseCase.hand.mouseDown(mouseEvent(mouseCase.node, 20, 20));
    assert.strictEqual(mouseStarts, 0);

    const node = target();
    const hand = new HandTrick(node, {
        input: 'touch',
        windowEvents: false,
        preventDefault: false,
        touch: false,
        wheel: { enabled: false },
        press: { enabled: false }
    });
    let touchStarts = 0;
    hand.on('session:start', () => touchStarts++);
    const item = touch(1, 20, 20, { target: node });
    hand.touchStart(touchEvent(node, [item], [item]));
    assert.strictEqual(touchStarts, 0);
});

run('configured mouse buttons can start and changing buttons cancels', () => {
    let t = 0;
    const { node, hand } = createMouse({
        clock: () => t,
        buttons: 2,
        pan: { threshold: 8, minTime: 0, minSamples: 1 }
    });
    let taps = 0;
    let cancels = 0;
    let pans = 0;

    hand.on('tap', () => taps++);
    hand.on('session:cancel', () => cancels++);
    hand.on('pan', () => pans++);

    hand.mouseDown(mouseEvent(node, 20, 20, { button: 0, buttons: 1 }));
    hand.mouseUp(mouseEvent(node, 20, 20, { button: 0, buttons: 0 }));
    hand.mouseDown(mouseEvent(node, 20, 20, { button: 2, buttons: 2 }));
    hand.mouseUp(mouseEvent(node, 20, 20, { button: 2, buttons: 0 }));
    hand.mouseDown(mouseEvent(node, 20, 20, { button: 2, buttons: 2 }));
    t = 20;
    hand.mouseMove(mouseEvent(node, 60, 20, { button: 2, buttons: 1 }));

    assert.strictEqual(taps, 1);
    assert.strictEqual(cancels, 1);
    assert.strictEqual(pans, 0);
});

run('tap hold compares client coordinates across scroll changes', () => {
    let t = 0;
    const { node, hand } = createMouse({
        clock: () => t,
        pan: {
            threshold: 6,
            minTime: 0,
            minSamples: 1,
            canStart: detail => detail.tapHold
        }
    });
    const holds = [];

    hand.on('pan:start', detail => holds.push(detail.tapHold));
    hand.mouseDown(mouseEvent(node, 50, 200, { clientX: 50, clientY: 50 }));
    hand.mouseUp(mouseEvent(node, 50, 200, { clientX: 50, clientY: 50, buttons: 0 }));
    t = 120;
    hand.mouseDown(mouseEvent(node, 54, 480, { clientX: 54, clientY: 52 }));
    t = 140;
    hand.mouseMove(mouseEvent(node, 80, 506, { clientX: 80, clientY: 78 }));
    hand.mouseUp(mouseEvent(node, 80, 506, { clientX: 80, clientY: 78, buttons: 0 }));

    assert.deepStrictEqual(holds, [true]);
});

run('rolling tap consumes multi-finger tap by default', () => {
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
    let rolling = 0;
    let tap = 0;

    hand.on('rolling:right', () => rolling++);
    hand.on('tap', { fingers: 2 }, () => tap++);
    hand.pointerDown(pointerEvent(node, 1, 100, 100));
    t = 45;
    hand.pointerDown(pointerEvent(node, 2, 132, 100));
    t = 90;
    hand.pointerUp(pointerEvent(node, 2, 132, 100, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 1, 100, 100, { buttons: 0 }));

    assert.strictEqual(rolling, 1);
    assert.strictEqual(tap, 0);
});

run('wheel emits common payload shape and ignored wheel event', () => {
    const node = target();
    const hand = new HandTrick(node, {
        input: 'mouse',
        windowEvents: false,
        preventDefault: false,
        ignore: targetNode => targetNode && targetNode.blocked,
        intent: { events: ['wheel:zoom'] },
        wheel: { enabled: true, preventDefault: false, normalize: true },
        press: { enabled: false }
    });
    let zoom = null;
    let ignored = null;

    hand.on('wheel:zoom', detail => {
        zoom = detail;
    });
    hand.on('input:ignored', detail => {
        ignored = detail;
    });
    hand.wheel(Object.assign(mouseEvent(node, 200, 150), {
        type: 'wheel',
        deltaY: 1,
        deltaMode: 1,
        stopPropagation() {}
    }));
    hand.wheel(Object.assign(mouseEvent({ blocked: true }, 20, 20), {
        type: 'wheel',
        deltaY: 1,
        deltaMode: 0,
        stopPropagation() {}
    }));

    assert.ok(zoom);
    assert.strictEqual(zoom.pointerType, 'wheel');
    assert.strictEqual(zoom.deltaY, 16);
    assert.strictEqual(zoom.startCenter.localX, 200);
    assert.strictEqual(zoom.previousCenter.region, 'center');
    assert.strictEqual(typeof zoom.preventDefault, 'function');
    assert.strictEqual(ignored.pointerType, 'wheel');
});

run('windowEvents works without global window', () => {
    const node = target();
    const hand = new HandTrick(node, {
        input: 'mouse',
        windowEvents: true,
        preventDefault: false,
        wheel: { enabled: false },
        press: { enabled: false }
    });
    assert.ok(node.listeners.has('mousemove'));
    hand.destroy();
});

run('disabled construction does not mutate target styles', () => {
    const node = target();
    const hand = new HandTrick(node, {
        enabled: false,
        input: 'mouse',
        windowEvents: false,
        wheel: { enabled: false },
        press: { enabled: false }
    });
    assert.strictEqual(node.style.touchAction, undefined);
    hand.enable();
    assert.strictEqual(node.style.touchAction, 'none');
    hand.destroy();
});

run('shared style ownership survives multi instance teardown', () => {
    const node = target();
    const a = new HandTrick(node, { input: 'mouse', windowEvents: false, wheel: { enabled: false }, press: { enabled: false } });
    const b = new HandTrick(node, { input: 'mouse', windowEvents: false, wheel: { enabled: false }, press: { enabled: false } });

    assert.strictEqual(node.style.touchAction, 'none');
    a.destroy();
    assert.strictEqual(node.style.touchAction, 'none');
    b.destroy();
    assert.strictEqual(node.style.touchAction, undefined);
});

run('setOptions merges runtime options and rebinds wheel listeners', () => {
    const node = target();
    const hand = new HandTrick(node, {
        input: 'mouse',
        windowEvents: false,
        preventDefault: false,
        wheel: { enabled: false },
        press: { enabled: false }
    });
    let taps = 0;

    assert.ok(!node.listeners.has('wheel') || !node.listeners.get('wheel').size);
    hand.on('tap', () => taps++);
    hand.setOptions({ wheel: { enabled: true } });
    assert.strictEqual(node.listeners.get('wheel').size, 1);
    hand.mouseDown(mouseEvent(node, 20, 20));
    hand.mouseUp(mouseEvent(node, 20, 20, { buttons: 0 }));

    assert.strictEqual(taps, 1);
});

run('final end reports released topology and native cancel keeps changed pointer', () => {
    const node = target();
    const hand = new HandTrick(node, {
        input: 'pointer',
        windowEvents: false,
        preventDefault: false,
        wheel: { enabled: false },
        press: { enabled: false },
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false }
    });
    let end = null;
    let cancel = null;

    hand.on('session:end', detail => {
        end = detail;
    });
    hand.pointerDown(pointerEvent(node, 1, 20, 20));
    hand.pointerUp(pointerEvent(node, 1, 20, 20, { buttons: 0 }));
    assert.strictEqual(end.fingers, 0);
    assert.strictEqual(end.topology.removed, 1);
    assert.deepStrictEqual(end.activePointers, []);

    hand.on('session:cancel', detail => {
        cancel = detail;
    });
    hand.pointerDown(pointerEvent(node, 2, 30, 30));
    hand.pointerCancel(pointerEvent(node, 2, 30, 30, { buttons: 0 }));
    assert.strictEqual(cancel.changedPointer.id, 2);
    assert.strictEqual(cancel.fingers, 0);
});

run('touch changedTouches final batch avoids intermediate fingers:change', () => {
    const node = target();
    const hand = new HandTrick(node, {
        input: 'touch',
        windowEvents: false,
        preventDefault: false,
        wheel: { enabled: false },
        press: { enabled: false },
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false }
    });
    const first = touch(1, 40, 40, { target: node });
    const second = touch(2, 80, 40, { target: node });
    let fingerChanges = 0;
    let taps = 0;
    let end = null;

    hand.on('fingers:change', () => fingerChanges++);
    hand.on('tap', { fingers: 2 }, () => taps++);
    hand.on('session:end', detail => {
        end = detail;
    });
    hand.touchStart(touchEvent(node, [first, second], [first, second]));
    hand.touchEnd(touchEvent(node, [], [first, second]));

    assert.strictEqual(fingerChanges, 1);
    assert.strictEqual(taps, 1);
    assert.strictEqual(end.topology.removed, 2);
    assert.strictEqual(end.changedPointers.length, 2);
});

run('claim disabled prevents tap-hold native suppression', () => {
    let t = 0;
    const { node, hand } = createMouse({
        clock: () => t,
        preventDefault: false,
        claim: {
            enabled: false,
            preventDefault: true
        }
    });
    let prevented = 0;

    hand.mouseDown(mouseEvent(node, 50, 50));
    hand.mouseUp(mouseEvent(node, 50, 50, { buttons: 0 }));
    t = 120;
    hand.mouseDown(mouseEvent(node, 50, 50, {
        cancelable: true,
        preventDefault() {
            prevented++;
        }
    }));

    assert.strictEqual(prevented, 0);
});

run('instance is non-enumerable and once can be removed by original handler', () => {
    const { node, hand } = createMouse();
    let calls = 0;
    const handler = () => {
        calls++;
    };
    let keys = null;

    hand.once('tap', handler);
    hand.off('tap', handler);
    hand.on('tap', detail => {
        keys = Object.keys(detail);
    });
    hand.mouseDown(mouseEvent(node, 20, 20));
    hand.mouseUp(mouseEvent(node, 20, 20, { buttons: 0 }));

    assert.strictEqual(calls, 0);
    assert.ok(!keys.includes('instance'));
});

run('region helpers presets and sequence reset are exposed', () => {
    const { node, hand } = createMouse();
    let matched = 0;

    hand.on('tap', { region: 'top-left' }, () => matched++);
    hand.mouseDown(mouseEvent(node, 20, 20));
    hand.mouseUp(mouseEvent(node, 20, 20, { buttons: 0 }));
    hand.resetSequences();

    assert.strictEqual(matched, 1);
    assert.ok(HandTrick.events.includes('wheel:zoom'));
    assert.ok(HandTrick.recognizers.includes('pinch'));
    assert.ok(HandTrick.families.includes('arc'));
    assert.strictEqual(HandTrick.zone({ ratioX: 0.9, ratioY: 0.1 }).index, 2);
    assert.strictEqual(HandTrick.presets.media().rotate.enabled, false);
});

run('destroy clears state and cannot re-enable native listeners', () => {
    const { node, hand } = createMouse();
    hand.mouseDown(mouseEvent(node, 20, 20));
    hand.destroy();
    hand.enable();

    const listenerCount = Array.from(node.listeners.values()).reduce((total, set) => total + set.size, 0);
    assert.strictEqual(hand.getState().destroyed, true);
    assert.strictEqual(listenerCount, 0);
    assert.strictEqual(node.style.touchAction, undefined);
});
