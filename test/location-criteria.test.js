const { assert, HandTrick, target, mouseEvent, run } = require('./helpers');

function point(x, y, region, area = 'inside', edge = {}) {
    return {
        pageX: x,
        pageY: y,
        clientX: x,
        clientY: y,
        localX: x,
        localY: y,
        ratioX: x,
        ratioY: y,
        clampedRatioX: x,
        clampedRatioY: y,
        region,
        zone: region,
        halfRegion: region,
        edgeRegion: edge.top || edge.right || edge.bottom || edge.left ? region : 'none',
        area,
        edge: Object.assign({ top: false, right: false, bottom: false, left: false }, edge)
    };
}

function detail(current, start = current, tapStart = null, sequenceStart = null) {
    return {
        type: 'swipe:right',
        center: current,
        startCenter: start,
        region: current.region,
        startRegion: start.region,
        area: current.area,
        startArea: start.area,
        direction: 'right',
        fingers: 1,
        tapSequence: tapStart ? { taps: [{ center: tapStart }] } : null,
        gestureSequence: sequenceStart ? {
            gestures: [{
                event: 'tap',
                gesture: 'tap',
                family: 'tap',
                direction: 'none',
                fingers: 3,
                center: sequenceStart
            }]
        } : null
    };
}

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

run('compound region and area criteria match current start tap and sequence phases', () => {
    const current = point(0.92, 0.50, 'right', 'edge', { right: true });
    const start = point(0.08, 0.50, 'left', 'inside');
    const tapStart = point(0.50, 0.08, 'top', 'center');
    const sequenceStart = point(0.08, 0.08, 'top-left', 'edge', { top: true, left: true });
    const event = detail(current, start, tapStart, sequenceStart);

    assert.strictEqual(HandTrick.matches(event, { region: { current: 'right', start: 'left', tapStart: 'top', sequenceStart: 'top-left' } }), true);
    assert.strictEqual(HandTrick.matches(event, { area: { current: 'edge', start: 'inside', tapStart: 'center', sequenceStart: 'edge' } }), true);
    assert.strictEqual(HandTrick.matches(event, { region: { at: 'right' } }), false);
    assert.strictEqual(HandTrick.matches(event, { area: { from: 'inside' } }), false);
    assert.strictEqual(HandTrick.matches(detail(current, start), { region: { tapStart: 'top' } }), false);
    assert.strictEqual(HandTrick.matches(detail(current, start), { area: { sequenceStart: 'edge' } }), false);
});

run('compound grid criteria match current start tap and sequence phases', () => {
    const current = point(0.94, 0.94, 'bottom-right');
    const start = point(0.06, 0.06, 'top-left');
    const tapStart = point(0.06, 0.94, 'bottom-left');
    const sequenceStart = point(0.94, 0.06, 'top-right');
    const event = detail(current, start, tapStart, sequenceStart);

    assert.strictEqual(HandTrick.matches(event, {
        grid: { rows: 4, cols: 4, current: 15, start: 0, tapStart: 12, sequenceStart: 3 }
    }), true);
    assert.strictEqual(HandTrick.matches(event, {
        grid: { rows: 4, cols: 4, index: 15, start: 0 }
    }), true);
    assert.strictEqual(HandTrick.matches(event, {
        grid: { rows: 4, cols: 4, index: 15, current: 12 }
    }), false);
    assert.strictEqual(HandTrick.matches(event, { grid: { rows: 4, cols: 4, idx: 15 } }), false);
    assert.strictEqual(HandTrick.matches(event, { grid: { rows: 4, cols: 4 } }), false);
    assert.strictEqual(HandTrick.matches(event, { grid: { rows: 4, cols: 4, current: { rows: 2, cols: 2 } } }), false);
});

run('grid number shorthand and semantic current tokens stay distinct from legacy cells', () => {
    const topLeft = detail(point(0.06, 0.06, 'top-left'));
    const center = detail(point(0.50, 0.50, 'center'));
    const edge = detail(point(0.06, 0.50, 'left'));

    assert.strictEqual(HandTrick.matches(topLeft, { grid: 0 }), true);
    assert.strictEqual(HandTrick.matches(topLeft, { startGrid: 0 }), true);
    assert.strictEqual(HandTrick.matches(topLeft, { grid: 'top' }), false);
    assert.strictEqual(HandTrick.matches(topLeft, { grid: { rows: 3, cols: 3, current: 'top' } }), true);
    assert.strictEqual(HandTrick.matches(center, { grid: { rows: 4, cols: 4, current: 'center' } }), true);
    assert.strictEqual(HandTrick.matches(edge, { grid: { rows: 4, cols: 4, current: 'edge' } }), true);
    assert.strictEqual(HandTrick.matches(center, { grid: { rows: 4, cols: 4, current: 'edge' } }), false);
    assert.strictEqual(HandTrick.matches(center, { grid: { rows: 4, cols: 4, current: ['edge', 10] } }), true);
    assert.strictEqual(HandTrick.matches(center, { grid: { rows: 4, cols: 4, current: [] } }), false);
    assert.strictEqual(HandTrick.matches(center, { grid: [] }), false);
});

run('sequenceStart aliases merge with existing sequence criteria', () => {
    const current = point(0.94, 0.50, 'right');
    const sequenceStart = point(0.06, 0.06, 'top-left');
    const event = detail(current, current, null, sequenceStart);

    assert.strictEqual(HandTrick.matches(event, {
        sequence: { start: { fingers: 3 } },
        region: { sequenceStart: 'top-left' },
        grid: { rows: 4, cols: 4, sequenceStart: 0 },
        area: { sequenceStart: 'inside' }
    }), true);
    assert.strictEqual(HandTrick.matches(event, {
        sequence: { start: { fingers: 2 } },
        region: { sequenceStart: 'top-left' }
    }), false);
    assert.strictEqual(HandTrick.matches(event, {
        sequence: [{ fingers: 3 }],
        sequenceStartGrid: { rows: 4, cols: 4, index: 0 }
    }), true);
});

run('equivalent legacy and compound criteria share command fan-out', () => {
    let t = 0;
    const regionCase = createMouse({
        clock: () => t,
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
    });
    const regionSeen = [];

    regionCase.hand.command('swipe:right', { region: 'right' }, () => regionSeen.push('legacy-region'));
    regionCase.hand.command('swipe:right', { region: { current: 'right' } }, () => regionSeen.push('compound-region'));

    regionCase.hand.mouseDown(mouseEvent(regionCase.node, 40, 150));
    t = 40;
    regionCase.hand.mouseMove(mouseEvent(regionCase.node, 360, 150));
    regionCase.hand.mouseUp(mouseEvent(regionCase.node, 360, 150, { buttons: 0 }));

    assert.deepStrictEqual(regionSeen, ['legacy-region', 'compound-region']);

    t = 0;
    const gridCase = createMouse({
        clock: () => t,
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
    });
    const gridSeen = [];

    gridCase.hand.command('swipe:right', { grid: { rows: 4, cols: 4, col: 3 } }, () => gridSeen.push('legacy-grid'));
    gridCase.hand.command('swipe:right', { grid: { rows: 4, cols: 4, current: { col: 3 } } }, () => gridSeen.push('compound-grid'));

    gridCase.hand.mouseDown(mouseEvent(gridCase.node, 40, 150));
    t = 40;
    gridCase.hand.mouseMove(mouseEvent(gridCase.node, 360, 150));
    gridCase.hand.mouseUp(mouseEvent(gridCase.node, 360, 150, { buttons: 0 }));

    assert.deepStrictEqual(gridSeen, ['legacy-grid', 'compound-grid']);
});
