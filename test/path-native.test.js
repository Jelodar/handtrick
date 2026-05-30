const { assert, HandTrick, create, target, mouseEvent, pointerEvent, run } = require('./helpers');

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
        clientX: x,
        clientY: y,
        screenX: x,
        screenY: y,
        force: 0,
        radiusX: 1,
        radiusY: 1
    }, extra);
}

run('constructor factory and setOptions accept preset shorthand', () => {
    const node = target();
    const hand = new HandTrick(node, 'media');

    assert.strictEqual(hand.options.rotate.enabled, false);
    assert.strictEqual(hand.options.path.consume, 'auto');
    assert.strictEqual(hand.options[0], undefined);
    assert.strictEqual(HandTrick.path('left>down'), 'left>down');
    assert.strictEqual(HandTrick.path('up>circle:cw'), 'up>circle:cw');
    assert.strictEqual(HandTrick.path(['up', 'circle:1x:ccw']), 'up>circle:ccw');
    assert.strictEqual(HandTrick.path('path:left>down'), '');
    assert.strictEqual(HandTrick.path('path>left>down'), '');
    assert.strictEqual(HandTrick.path(['Left', 'DOWN']), 'left>down');

    hand.setOptions(['viewer', { swipe: { enabled: true } }]);
    assert.strictEqual(hand.options.wheel.enabled, true);
    assert.strictEqual(hand.options.swipe.enabled, true);
    hand.destroy();

    const created = HandTrick.create(node, 'drawing');
    assert.strictEqual(created.options.pan.threshold, 4);
    created.destroy();
});

run('path consume accepts explicit strings and defaults invalid values to auto', () => {
    const node = target();
    const hand = new HandTrick(node, {
        path: { consume: false }
    });

    assert.strictEqual(hand.options.path.consume, 'auto');
    hand.setOptions({ path: { consume: true } });
    assert.strictEqual(hand.options.path.consume, 'auto');
    hand.setOptions({ path: { consume: null } });
    assert.strictEqual(hand.options.path.consume, 'auto');
    hand.setOptions({ path: { consume: 'never' } });
    assert.strictEqual(hand.options.path.consume, 'never');
    hand.setOptions({ path: { consume: 'unknown' } });
    assert.strictEqual(hand.options.path.consume, 'auto');
});

run('continuous path emits exact held-pointer pattern', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        intent: { events: ['down>right'] },
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        path: {
            minTime: 0,
            minSamples: 1,
            minDistance: 35,
            segmentDistance: 35,
            maxPause: 500
        }
    });
    const events = [];
    let matched = null;
    let legacyMatched = 0;

    hand.on('path:start', detail => events.push('start:' + detail.pathText));
    hand.observe('path', detail => events.push('path:' + detail.pathText));
    hand.on('down>right', detail => {
        matched = detail;
    });
    hand.on('path:down>right', () => {
        legacyMatched++;
    });
    hand.on('path', { path: 'down>right' }, detail => events.push('when:' + detail.pathText), { phase: 'observe' });
    hand.on('path', { path: 'path:down>right' }, detail => events.push('prefixed:' + detail.pathText), { phase: 'observe' });

    hand.pointerDown(pointerEvent(node, 1, 100, 100));
    t = 40;
    hand.pointerMove(pointerEvent(node, 1, 100, 150));
    t = 90;
    hand.pointerMove(pointerEvent(node, 1, 155, 150));
    hand.pointerUp(pointerEvent(node, 1, 155, 150, { buttons: 0 }));

    assert.ok(matched);
    assert.strictEqual(matched.type, 'down>right');
    assert.strictEqual(matched.pathText, 'down>right');
    assert.strictEqual(matched.pathMatched, 'down>right');
    assert.strictEqual(matched.pathSegments.length, 2);
    assert.strictEqual(legacyMatched, 0);
    assert.ok(events.includes('start:down'));
    assert.ok(events.includes('path:down>right'));
    assert.ok(events.includes('when:down>right'));
    assert.ok(!events.includes('prefixed:down>right'));
});

run('two finger path criteria routes effective finger paths', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        intent: { events: ['right>up'] },
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        path: {
            fingers: [1, 2],
            minTime: 0,
            minSamples: 1,
            minDistance: 24,
            segmentDistance: 24,
            axisRatio: 1.2,
            turnAngle: 45,
            maxPause: 500
        }
    });
    const seen = [];

    hand.on('right>up', { fingers: 2 }, detail => seen.push('two:' + detail.fingers + ':' + detail.pathMatched));
    hand.on('path', { path: 'right>up', fingers: 2 }, detail => seen.push('criteria:' + detail.fingers), { phase: 'observe' });

    hand.pointerDown(pointerEvent(node, 1, 80, 100));
    hand.pointerDown(pointerEvent(node, 2, 80, 140));
    t = 40;
    hand.pointerMove(pointerEvent(node, 1, 130, 100));
    hand.pointerMove(pointerEvent(node, 2, 130, 140));
    t = 90;
    hand.pointerMove(pointerEvent(node, 1, 130, 60));
    hand.pointerMove(pointerEvent(node, 2, 130, 100));
    hand.pointerUp(pointerEvent(node, 1, 130, 60, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 2, 130, 100, { buttons: 0 }));

    assert.ok(seen.includes('two:2:right>up'));
    assert.ok(seen.includes('criteria:2'));
});

run('path finger option rejects unconfigured two finger paths', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        intent: { events: ['right>up'] },
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        path: {
            fingers: [1],
            minTime: 0,
            minSamples: 1,
            minDistance: 24,
            segmentDistance: 24,
            axisRatio: 1.2,
            turnAngle: 45
        }
    });
    let matched = 0;

    hand.on('right>up', { fingers: 2 }, () => matched++);
    hand.observe('path', { fingers: 2 }, () => matched++);

    hand.pointerDown(pointerEvent(node, 1, 80, 100));
    hand.pointerDown(pointerEvent(node, 2, 80, 140));
    t = 40;
    hand.pointerMove(pointerEvent(node, 1, 130, 100));
    hand.pointerMove(pointerEvent(node, 2, 130, 140));
    t = 90;
    hand.pointerMove(pointerEvent(node, 1, 130, 60));
    hand.pointerMove(pointerEvent(node, 2, 130, 100));
    hand.pointerUp(pointerEvent(node, 1, 130, 60, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 2, 130, 100, { buttons: 0 }));

    assert.strictEqual(matched, 0);
});

run('circle path emits clockwise direction detail', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        path: {
            minTime: 0,
            minSamples: 1,
            minDistance: 30,
            segmentDistance: 30,
            axisRatio: 1.25,
            turnAngle: 45,
            maxPause: 500
        }
    });
    const seen = [];
    let circle = null;

    hand.on('circle', detail => {
        circle = detail;
        seen.push('circle:' + detail.direction + ':' + detail.pathMatched);
    });

    const points = [[100, 100], [150, 100], [150, 150], [100, 150], [100, 100]];
    hand.pointerDown(pointerEvent(node, 1, points[0][0], points[0][1]));
    points.slice(1).forEach(point => {
        t += 40;
        hand.pointerMove(pointerEvent(node, 1, point[0], point[1]));
    });
    hand.pointerUp(pointerEvent(node, 1, 100, 100, { buttons: 0 }));

    assert.ok(circle);
    assert.strictEqual(circle.type, 'circle');
    assert.strictEqual(circle.direction, 'cw');
    assert.strictEqual(circle.circleDirection, 'cw');
    assert.deepStrictEqual(circle.circle.path, ['right', 'down', 'left', 'up']);
    assert.deepStrictEqual(seen, ['circle:cw:right>down>left>up']);
});

run('circle path accepts rotated starts and counter-clockwise direction', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        path: {
            minTime: 0,
            minSamples: 1,
            minDistance: 30,
            segmentDistance: 30,
            axisRatio: 1.25,
            turnAngle: 45,
            maxPause: 500
        }
    });
    const seen = [];

    hand.on('circle:cw', detail => seen.push('cw:' + detail.pathMatched));
    hand.on('circle:ccw', detail => seen.push('ccw:' + detail.pathMatched));

    const draw = (id, points) => {
        hand.pointerDown(pointerEvent(node, id, points[0][0], points[0][1]));
        points.slice(1).forEach(point => {
            t += 40;
            hand.pointerMove(pointerEvent(node, id, point[0], point[1]));
        });
        hand.pointerUp(pointerEvent(node, id, points[points.length - 1][0], points[points.length - 1][1], { buttons: 0 }));
        t += 500;
    };

    draw(1, [[120, 80], [120, 130], [70, 130], [70, 80], [120, 80]]);
    draw(2, [[200, 150], [250, 150], [250, 100], [200, 100], [200, 150]]);
    draw(3, [[260, 80], [310, 80], [310, 130], [310, 80], [260, 80]]);

    assert.deepStrictEqual(seen, ['cw:down>left>up>right', 'ccw:right>up>left>down']);
});

run('circle macro works inside combined path commands and criteria', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        path: {
            minTime: 0,
            minSamples: 1,
            minDistance: 30,
            segmentDistance: 30,
            axisRatio: 1.25,
            turnAngle: 45,
            maxPause: 500
        }
    });
    const seen = [];

    hand.on('up>circle', detail => seen.push('command:' + detail.pathMatched + ':' + detail.pathText));
    hand.on('path', { path: 'up>circle' }, detail => seen.push('criteria:' + detail.pathMatched), { phase: 'observe' });

    const points = [[100, 160], [100, 110], [150, 110], [150, 160], [100, 160], [100, 110]];
    hand.pointerDown(pointerEvent(node, 1, points[0][0], points[0][1]));
    points.slice(1).forEach(point => {
        t += 40;
        hand.pointerMove(pointerEvent(node, 1, point[0], point[1]));
    });
    hand.pointerUp(pointerEvent(node, 1, 100, 110, { buttons: 0 }));

    assert.deepStrictEqual(seen, [
        'criteria:up>circle',
        'command:up>circle:up>right>down>left>up'
    ]);
});

run('circle count selectors and finger criteria route repeated and multi-finger cycles', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        path: {
            fingers: [1, 2],
            minTime: 0,
            minSamples: 1,
            minDistance: 30,
            segmentDistance: 30,
            axisRatio: 1.25,
            turnAngle: 45,
            maxPause: 500
        }
    });
    const seen = [];

    hand.on('circle:2x:cw', detail => seen.push('count:' + detail.circleCount + ':' + detail.direction));
    hand.on('circle:cw', { fingers: 2 }, detail => seen.push('fingers:' + detail.fingers + ':' + detail.circle.count));

    const drawOne = (id, points) => {
        hand.pointerDown(pointerEvent(node, id, points[0][0], points[0][1]));
        points.slice(1).forEach(point => {
            t += 40;
            hand.pointerMove(pointerEvent(node, id, point[0], point[1]));
        });
        hand.pointerUp(pointerEvent(node, id, points[points.length - 1][0], points[points.length - 1][1], { buttons: 0 }));
        t += 500;
    };

    drawOne(1, [
        [100, 100], [150, 100], [150, 150], [100, 150], [100, 100],
        [150, 100], [150, 150], [100, 150], [100, 100]
    ]);

    hand.pointerDown(pointerEvent(node, 2, 220, 100));
    hand.pointerDown(pointerEvent(node, 3, 220, 140));
    [[270, 100], [270, 150], [220, 150], [220, 100]].forEach((point, index) => {
        t += 40;
        hand.pointerMove(pointerEvent(node, 2, point[0], point[1]));
        hand.pointerMove(pointerEvent(node, 3, point[0], point[1] + 40));
    });
    hand.pointerUp(pointerEvent(node, 2, 220, 100, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 3, 220, 140, { buttons: 0 }));

    assert.deepStrictEqual(seen, ['count:2:cw', 'fingers:2:1']);
});

run('circle path atoms support count direction and finger criteria inside combined paths', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        path: {
            fingers: [2],
            minTime: 0,
            minSamples: 1,
            minDistance: 30,
            segmentDistance: 30,
            axisRatio: 1.25,
            turnAngle: 45,
            maxPause: 500
        }
    });
    const seen = [];
    let command = null;

    hand.on('up>circle:2x:cw', { fingers: 2 }, detail => {
        command = detail;
        seen.push('command:' + detail.matchPattern + ':' + detail.matchedPathText);
    });
    hand.on('path', { path: 'up>circle:2x:cw', fingers: 2 }, detail => {
        seen.push('criteria:' + detail.circle.count + ':' + detail.circleDirection);
    }, { phase: 'observe' });

    const centers = [
        [100, 180],
        [100, 130],
        [150, 130],
        [150, 180],
        [100, 180],
        [100, 130],
        [100, 180],
        [50, 180],
        [50, 130],
        [100, 130]
    ];

    hand.pointerDown(pointerEvent(node, 1, centers[0][0], centers[0][1] - 20));
    hand.pointerDown(pointerEvent(node, 2, centers[0][0], centers[0][1] + 20));
    centers.slice(1).forEach(point => {
        t += 40;
        hand.pointerMove(pointerEvent(node, 1, point[0], point[1] - 20));
        hand.pointerMove(pointerEvent(node, 2, point[0], point[1] + 20));
    });
    hand.pointerUp(pointerEvent(node, 1, centers[centers.length - 1][0], centers[centers.length - 1][1] - 20, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 2, centers[centers.length - 1][0], centers[centers.length - 1][1] + 20, { buttons: 0 }));

    assert.ok(command);
    assert.strictEqual(command.pathMatched, 'up>circle:2x:cw');
    assert.strictEqual(command.matchPattern, 'up>circle:2x:cw');
    assert.strictEqual(command.matchedPathText, 'up>right>down>left>up>down>left>up>right');
    assert.strictEqual(command.circle.start, 1);
    assert.strictEqual(command.circle.count, 2);
    assert.deepStrictEqual(command.circle.cycles.map(cycle => cycle.startDirection), ['right', 'down']);
    assert.deepStrictEqual(seen, [
        'criteria:2:cw',
        'command:up>circle:2x:cw:up>right>down>left>up>down>left>up>right'
    ]);
});

run('circle path finger selector sugar is invalid', () => {
    assert.strictEqual(HandTrick.isEvent('circle:2f:cw'), false);
    assert.strictEqual(HandTrick.path('up>circle:2f:cw'), '');
});

run('arc path atom matches three-segment cardinal arcs', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        path: {
            minTime: 0,
            minSamples: 1,
            minDistance: 30,
            segmentDistance: 30,
            axisRatio: 1.25,
            turnAngle: 45,
            maxPause: 500
        }
    });
    const seen = [];

    hand.on('arc:up', detail => seen.push('arc:' + detail.type + ':' + detail.arcDirection + ':' + detail.arc.pathText));
    hand.on('path', { path: 'arc:up' }, detail => seen.push('criteria:' + detail.matchPattern + ':' + detail.arcDirection), { phase: 'observe' });

    [[100, 160], [100, 110], [150, 110], [150, 160]].forEach((point, index) => {
        if (index === 0) hand.pointerDown(pointerEvent(node, 1, point[0], point[1]));
        else {
            t += 40;
            hand.pointerMove(pointerEvent(node, 1, point[0], point[1]));
        }
    });
    hand.pointerUp(pointerEvent(node, 1, 150, 160, { buttons: 0 }));

    assert.deepStrictEqual(seen, [
        'criteria:arc:up:up',
        'arc:arc:up:up:up>right>down'
    ]);
});

run('arc path atom supports generic combined and rejected patterns', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        path: {
            minTime: 0,
            minSamples: 1,
            minDistance: 30,
            segmentDistance: 30,
            axisRatio: 1.25,
            turnAngle: 45,
            maxPause: 500
        }
    });
    const seen = [];
    const draw = points => {
        hand.pointerDown(pointerEvent(node, 1, points[0][0], points[0][1]));
        points.slice(1).forEach(point => {
            t += 40;
            hand.pointerMove(pointerEvent(node, 1, point[0], point[1]));
        });
        hand.pointerUp(pointerEvent(node, 1, points[points.length - 1][0], points[points.length - 1][1], { buttons: 0 }));
        t += 300;
    };

    hand.observe('arc', detail => seen.push('generic:' + detail.arcDirection + ':' + detail.arc.pathText));
    hand.on('right>arc:down', detail => seen.push('combined:' + detail.pathMatched + ':' + detail.arcDirection));
    hand.on('arc:right', () => seen.push('wrong'));

    draw([[180, 120], [130, 120], [130, 70], [180, 70]]);
    draw([[100, 100], [150, 100], [150, 150], [100, 150], [100, 100]]);
    draw([[220, 120], [270, 120], [220, 120], [220, 70]]);

    assert.deepStrictEqual(seen, [
        'generic:left:left>up>right',
        'combined:right>arc:down:down'
    ]);
});

run('circle command waits for registered repeated circle count', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        path: {
            minTime: 0,
            minSamples: 1,
            minDistance: 30,
            segmentDistance: 30,
            axisRatio: 1.25,
            turnAngle: 45,
            maxPause: 500
        }
    });
    const seen = [];
    const draw = points => {
        hand.pointerDown(pointerEvent(node, 1, points[0][0], points[0][1]));
        points.slice(1).forEach(point => {
            t += 40;
            hand.pointerMove(pointerEvent(node, 1, point[0], point[1]));
        });
        hand.pointerUp(pointerEvent(node, 1, points[points.length - 1][0], points[points.length - 1][1], { buttons: 0 }));
        t += 600;
    };

    hand.on('circle', () => seen.push('single'));
    hand.on('circle:2x', detail => seen.push('double:' + detail.circle.cycles.map(cycle => cycle.startDirection).join(',')));

    draw([
        [100, 100],
        [150, 100],
        [150, 150],
        [100, 150],
        [100, 100],
        [100, 150],
        [50, 150],
        [50, 100],
        [100, 100]
    ]);

    draw([[220, 100], [270, 100], [270, 150], [220, 150], [220, 100]]);

    assert.deepStrictEqual(seen, ['double:right,down', 'single']);
});

run('circle selectors accept reordered count direction adjusters with finger criteria', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        path: {
            fingers: [2],
            minTime: 0,
            minSamples: 1,
            minDistance: 30,
            segmentDistance: 30,
            axisRatio: 1.25,
            turnAngle: 45,
            maxPause: 500
        }
    });
    const seen = [];
    let command = null;

    hand.on('right>circle:ccw:2x', { fingers: 2 }, detail => {
        command = detail;
        seen.push('command:' + detail.type + ':' + detail.circle.cycles.map(cycle => cycle.startDirection).join(','));
    });
    hand.on('path', { path: 'right>circle:ccw:2x', fingers: 2 }, detail => {
        seen.push('criteria:' + detail.matchPattern);
    }, { phase: 'observe' });

    const centers = [
        [100, 100],
        [150, 100],
        [150, 50],
        [100, 50],
        [100, 100],
        [150, 100],
        [100, 100],
        [100, 150],
        [150, 150],
        [150, 100]
    ];

    hand.pointerDown(pointerEvent(node, 1, centers[0][0], centers[0][1] - 20));
    hand.pointerDown(pointerEvent(node, 2, centers[0][0], centers[0][1] + 20));
    centers.slice(1).forEach(point => {
        t += 40;
        hand.pointerMove(pointerEvent(node, 1, point[0], point[1] - 20));
        hand.pointerMove(pointerEvent(node, 2, point[0], point[1] + 20));
    });
    hand.pointerUp(pointerEvent(node, 1, centers[centers.length - 1][0], centers[centers.length - 1][1] - 20, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 2, centers[centers.length - 1][0], centers[centers.length - 1][1] + 20, { buttons: 0 }));

    assert.ok(command);
    assert.strictEqual(command.type, 'right>circle:2x:ccw');
    assert.strictEqual(command.circleDirection, 'ccw');
    assert.strictEqual(command.circle.count, 2);
    assert.deepStrictEqual(command.circle.cycles.map(cycle => cycle.startDirection), ['up', 'left']);
    assert.ok(HandTrick.matches(command, { path: 'right>circle:ccw:2x', fingers: 2 }));
    assert.ok(HandTrick.matches(command, { path: 'circle:ccw:2x', fingers: 2 }));
    assert.ok(!HandTrick.matches(command, { path: 'right>circle:cw:2x', fingers: 2 }));
    assert.deepStrictEqual(seen, [
        'criteria:right>circle:2x:ccw',
        'command:right>circle:2x:ccw:up,left'
    ]);
});

run('reordered circle path selectors share canonical once and off keys', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        path: {
            fingers: [2],
            minTime: 0,
            minSamples: 1,
            minDistance: 30,
            segmentDistance: 30,
            axisRatio: 1.25,
            turnAngle: 45,
            maxPause: 500
        }
    });
    let calls = 0;
    const handler = () => calls++;
    const draw = offset => {
        const centers = [
            [100 + offset, 100],
            [150 + offset, 100],
            [150 + offset, 50],
            [100 + offset, 50],
            [100 + offset, 100],
            [150 + offset, 100],
            [100 + offset, 100],
            [100 + offset, 150],
            [150 + offset, 150],
            [150 + offset, 100]
        ];
        hand.pointerDown(pointerEvent(node, 1, centers[0][0], centers[0][1] - 20));
        hand.pointerDown(pointerEvent(node, 2, centers[0][0], centers[0][1] + 20));
        centers.slice(1).forEach(point => {
            t += 40;
            hand.pointerMove(pointerEvent(node, 1, point[0], point[1] - 20));
            hand.pointerMove(pointerEvent(node, 2, point[0], point[1] + 20));
        });
        hand.pointerUp(pointerEvent(node, 1, centers[centers.length - 1][0], centers[centers.length - 1][1] - 20, { buttons: 0 }));
        hand.pointerUp(pointerEvent(node, 2, centers[centers.length - 1][0], centers[centers.length - 1][1] + 20, { buttons: 0 }));
        t += 600;
    };

    hand.on('right>circle:ccw:2x', handler);
    hand.off('right>circle:2x:ccw', handler);
    draw(0);
    assert.strictEqual(calls, 0);

    hand.once('right>circle:2x:ccw', handler);
    hand.off('right>circle:2x:ccw', handler);
    draw(180);
    assert.strictEqual(calls, 0);

    hand.once('right>circle:ccw:2x', handler);
    draw(360);
    draw(540);
    assert.strictEqual(calls, 1);
});

run('circle count rejects mixed directions wrong counts and wrong fingers', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        path: {
            fingers: [1, 2],
            minTime: 0,
            minSamples: 1,
            minDistance: 30,
            segmentDistance: 30,
            axisRatio: 1.25,
            turnAngle: 45,
            maxPause: 500
        }
    });
    const seen = [];
    const drawOne = points => {
        hand.pointerDown(pointerEvent(node, 1, points[0][0], points[0][1]));
        points.slice(1).forEach(point => {
            t += 40;
            hand.pointerMove(pointerEvent(node, 1, point[0], point[1]));
        });
        hand.pointerUp(pointerEvent(node, 1, points[points.length - 1][0], points[points.length - 1][1], { buttons: 0 }));
        t += 600;
    };
    const drawTwo = points => {
        hand.pointerDown(pointerEvent(node, 2, points[0][0], points[0][1] - 20));
        hand.pointerDown(pointerEvent(node, 3, points[0][0], points[0][1] + 20));
        points.slice(1).forEach(point => {
            t += 40;
            hand.pointerMove(pointerEvent(node, 2, point[0], point[1] - 20));
            hand.pointerMove(pointerEvent(node, 3, point[0], point[1] + 20));
        });
        hand.pointerUp(pointerEvent(node, 2, points[points.length - 1][0], points[points.length - 1][1] - 20, { buttons: 0 }));
        hand.pointerUp(pointerEvent(node, 3, points[points.length - 1][0], points[points.length - 1][1] + 20, { buttons: 0 }));
        t += 600;
    };

    const mixedCount = () => seen.push('mixed-count');
    hand.on('circle:2x', mixedCount);
    const wrongFinger = () => seen.push('wrong-finger');
    hand.on('up>circle', { fingers: 2 }, wrongFinger);
    hand.on('circle:3x', () => seen.push('wrong-count'));
    hand.on('up>circle:2x:3x', () => seen.push('invalid-duplicate-count'));

    drawOne([
        [100, 100],
        [150, 100],
        [150, 150],
        [100, 150],
        [100, 100],
        [150, 100],
        [150, 50],
        [100, 50],
        [100, 100]
    ]);
    hand.off('circle:2x', mixedCount);
    drawOne([[220, 180], [220, 130], [270, 130], [270, 180], [220, 180], [220, 130]]);
    hand.off('up>circle', wrongFinger);
    drawTwo([
        [320, 100],
        [370, 100],
        [370, 150],
        [320, 150],
        [320, 100],
        [370, 100],
        [370, 150],
        [320, 150],
        [320, 100]
    ]);

    assert.deepStrictEqual(seen, []);
});

run('circle criteria distinguish reordered ccw multifinger count from near misses', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        path: {
            fingers: [2],
            minTime: 0,
            minSamples: 1,
            minDistance: 30,
            segmentDistance: 30,
            axisRatio: 1.25,
            turnAngle: 45,
            maxPause: 500
        }
    });
    const seen = [];

    hand.on('path', { path: 'circle:ccw:2x', fingers: 2 }, detail => seen.push('ccw:' + detail.circle.count), { phase: 'observe' });
    hand.on('path', { path: 'circle:cw:2x', fingers: 2 }, () => seen.push('cw'), { phase: 'observe' });
    hand.on('path', { path: 'circle:ccw:2x', fingers: 1 }, () => seen.push('one-finger'), { phase: 'observe' });

    const centers = [
        [120, 120],
        [120, 70],
        [70, 70],
        [70, 120],
        [120, 120],
        [70, 120],
        [70, 170],
        [120, 170],
        [120, 120]
    ];

    hand.pointerDown(pointerEvent(node, 1, centers[0][0], centers[0][1] - 20));
    hand.pointerDown(pointerEvent(node, 2, centers[0][0], centers[0][1] + 20));
    centers.slice(1).forEach(point => {
        t += 40;
        hand.pointerMove(pointerEvent(node, 1, point[0], point[1] - 20));
        hand.pointerMove(pointerEvent(node, 2, point[0], point[1] + 20));
    });
    hand.pointerUp(pointerEvent(node, 1, centers[centers.length - 1][0], centers[centers.length - 1][1] - 20, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 2, centers[centers.length - 1][0], centers[centers.length - 1][1] + 20, { buttons: 0 }));

    assert.deepStrictEqual(seen, ['ccw:2']);
});

run('circle path criteria alternatives combine with finger and direction filters', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        path: {
            fingers: [1, 2],
            minTime: 0,
            minSamples: 1,
            minDistance: 30,
            segmentDistance: 30,
            axisRatio: 1.25,
            turnAngle: 45,
            maxPause: 500
        }
    });
    const seen = [];

    hand.on('path', {
        path: ['left>circle:cw', 'circle:ccw'],
        fingers: [2]
    }, detail => seen.push(detail.matchPattern + ':' + detail.fingers + ':' + detail.circleDirection), { phase: 'observe' });
    hand.on('path', {
        path: ['left>circle:ccw', 'circle:cw'],
        fingers: [2]
    }, () => seen.push('wrong'), { phase: 'observe' });

    const centers = [
        [120, 120],
        [120, 70],
        [70, 70],
        [70, 120],
        [120, 120]
    ];

    hand.pointerDown(pointerEvent(node, 1, centers[0][0], centers[0][1] - 20));
    hand.pointerDown(pointerEvent(node, 2, centers[0][0], centers[0][1] + 20));
    centers.slice(1).forEach(point => {
        t += 40;
        hand.pointerMove(pointerEvent(node, 1, point[0], point[1] - 20));
        hand.pointerMove(pointerEvent(node, 2, point[0], point[1] + 20));
    });
    hand.pointerUp(pointerEvent(node, 1, centers[centers.length - 1][0], centers[centers.length - 1][1] - 20, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 2, centers[centers.length - 1][0], centers[centers.length - 1][1] + 20, { buttons: 0 }));

    assert.deepStrictEqual(seen, ['circle:ccw:2:ccw']);
});

run('circle command specificity prefers constrained selectors over generic circle', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        path: {
            fingers: [2],
            minTime: 0,
            minSamples: 1,
            minDistance: 30,
            segmentDistance: 30,
            axisRatio: 1.25,
            turnAngle: 45,
            maxPause: 500
        }
    });
    const seen = [];

    hand.on('circle', () => seen.push('generic'));
    hand.on('circle:ccw', () => seen.push('direction'));
    hand.on('circle:ccw', { fingers: 2 }, detail => seen.push('specific:' + detail.type + ':' + detail.fingers));

    const centers = [
        [120, 120],
        [120, 70],
        [70, 70],
        [70, 120],
        [120, 120]
    ];

    hand.pointerDown(pointerEvent(node, 1, centers[0][0], centers[0][1] - 20));
    hand.pointerDown(pointerEvent(node, 2, centers[0][0], centers[0][1] + 20));
    centers.slice(1).forEach(point => {
        t += 40;
        hand.pointerMove(pointerEvent(node, 1, point[0], point[1] - 20));
        hand.pointerMove(pointerEvent(node, 2, point[0], point[1] + 20));
    });
    hand.pointerUp(pointerEvent(node, 1, centers[centers.length - 1][0], centers[centers.length - 1][1] - 20, { buttons: 0 }));
    hand.pointerUp(pointerEvent(node, 2, centers[centers.length - 1][0], centers[centers.length - 1][1] + 20, { buttons: 0 }));

    assert.deepStrictEqual(seen, ['specific:circle:ccw:2']);
});

run('circle one-count selectors canonicalize across top-level and path atoms', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        path: {
            minTime: 0,
            minSamples: 1,
            minDistance: 30,
            segmentDistance: 30,
            axisRatio: 1.25,
            turnAngle: 45,
            maxPause: 500
        }
    });
    const seen = [];
    const draw = points => {
        hand.pointerDown(pointerEvent(node, 1, points[0][0], points[0][1]));
        points.slice(1).forEach(point => {
            t += 40;
            hand.pointerMove(pointerEvent(node, 1, point[0], point[1]));
        });
        hand.pointerUp(pointerEvent(node, 1, points[points.length - 1][0], points[points.length - 1][1], { buttons: 0 }));
        t += 600;
    };
    const removed = () => seen.push('removed');

    hand.on('circle:1x:cw', removed);
    hand.off('circle:cw', removed);
    draw([[100, 100], [150, 100], [150, 150], [100, 150], [100, 100]]);

    hand.on('circle:1x:cw', detail => seen.push('circle:' + detail.type));
    draw([[200, 100], [250, 100], [250, 150], [200, 150], [200, 100]]);

    hand.on('up>circle:1x:cw', detail => {
        seen.push('path:' + detail.type + ':' + detail.matchPattern);
        assert.ok(HandTrick.matches(detail, { path: ['up', 'circle:1x:cw'] }));
    });
    draw([[320, 160], [320, 110], [370, 110], [370, 160], [320, 160], [320, 110]]);

    assert.deepStrictEqual(seen, [
        'circle:circle:cw',
        'path:up>circle:cw:up>circle:cw'
    ]);
});

run('path maxCircleCount blocks accidental huge circle selectors unless raised', () => {
    const drawTriple = (hand, node, time) => {
        const points = [
            [100, 100],
            [150, 100], [150, 150], [100, 150], [100, 100],
            [150, 100], [150, 150], [100, 150], [100, 100],
            [150, 100], [150, 150], [100, 150], [100, 100]
        ];
        hand.pointerDown(pointerEvent(node, 1, points[0][0], points[0][1]));
        points.slice(1).forEach(point => {
            time.value += 40;
            hand.pointerMove(pointerEvent(node, 1, point[0], point[1]));
        });
        hand.pointerUp(pointerEvent(node, 1, 100, 100, { buttons: 0 }));
    };
    const baseOptions = {
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        path: {
            minTime: 0,
            minSamples: 1,
            minDistance: 30,
            segmentDistance: 30,
            axisRatio: 1.25,
            turnAngle: 45,
            maxPause: 500,
            maxCircleCount: 2
        }
    };
    const blockedTime = { value: 0 };
    const blocked = create(Object.assign({ clock: () => blockedTime.value }, baseOptions));
    let blockedCount = 0;
    blocked.hand.on('circle:3x', () => blockedCount++);
    drawTriple(blocked.hand, blocked.node, blockedTime);
    assert.strictEqual(blockedCount, 0);

    const allowedTime = { value: 0 };
    const allowed = create(Object.assign({ clock: () => allowedTime.value }, baseOptions, {
        path: Object.assign({}, baseOptions.path, { maxCircleCount: 3 })
    }));
    let allowedCount = 0;
    allowed.hand.on('circle:3x', detail => {
        allowedCount++;
        assert.strictEqual(detail.circle.count, 3);
    });
    drawTriple(allowed.hand, allowed.node, allowedTime);
    assert.strictEqual(allowedCount, 1);
});

run('repeated circle suffixes can coexist with longer path command', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        path: {
            minTime: 0,
            minSamples: 1,
            minDistance: 30,
            segmentDistance: 30,
            axisRatio: 1.25,
            turnAngle: 45,
            maxPause: 500,
            maxSegments: 4
        }
    });
    const seen = [];
    const square = 'right>down>left>up';
    const doubleSquare = square + '>' + square;

    hand.on('circle:cw', () => seen.push('circle'));
    hand.on(doubleSquare, () => seen.push('double'));

    const points = [
        [100, 100], [150, 100], [150, 150], [100, 150], [100, 100],
        [150, 100], [150, 150], [100, 150], [100, 100]
    ];
    hand.pointerDown(pointerEvent(node, 1, points[0][0], points[0][1]));
    points.slice(1).forEach(point => {
        t += 40;
        hand.pointerMove(pointerEvent(node, 1, point[0], point[1]));
    });
    hand.pointerUp(pointerEvent(node, 1, 100, 100, { buttons: 0 }));

    assert.ok(seen.includes('double'));
    assert.ok(seen.filter(item => item === 'circle').length >= 1);
});

run('longer held path suppresses shorter prefix command', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        path: {
            minTime: 0,
            minSamples: 1,
            minDistance: 35,
            segmentDistance: 35,
            maxPause: 500,
            maxSegments: 4
        }
    });
    let short = 0;
    let long = 0;
    let longDetail = null;

    hand.on('right>down>left>up', () => short++);
    hand.on('right>down>left>up>right>down>left>up', detail => {
        long++;
        longDetail = detail;
    });

    const draw = (id, points) => {
        hand.pointerDown(pointerEvent(node, id, points[0][0], points[0][1]));
        points.slice(1).forEach(point => {
            t += 40;
            hand.pointerMove(pointerEvent(node, id, point[0], point[1]));
        });
        hand.pointerUp(pointerEvent(node, id, points[points.length - 1][0], points[points.length - 1][1], { buttons: 0 }));
    };

    const square = [[100, 100], [160, 100], [160, 160], [100, 160], [100, 100]];
    draw(1, square.concat(square.slice(1)));

    assert.strictEqual(short, 0);
    assert.strictEqual(long, 1);
    assert.strictEqual(longDetail.pathText, 'right>down>left>up>right>down>left>up');
    assert.strictEqual(longDetail.pathSegments.length, 8);

    draw(2, square);

    assert.strictEqual(short, 1);
    assert.strictEqual(long, 1);
});

run('longer held path stays exclusive during trailing segment moves', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        path: {
            enabled: true,
            fingers: [1],
            minDistance: 15,
            segmentDistance: 15,
            maxPause: 2000
        }
    });
    const events = [];

    hand.command('right>down>left>up', () => events.push('short'));
    hand.command('right>down>left>up>right>down>left>up', () => events.push('long'));
    hand.on('path', detail => events.push('path:' + detail.pathText));
    hand.on('path:end', detail => events.push('end:' + detail.pathText));

    const points = [
        [100, 100],
        [130, 100],
        [160, 100],
        [160, 130],
        [160, 160],
        [130, 160],
        [100, 160],
        [100, 130],
        [100, 100],
        [130, 100],
        [160, 100],
        [160, 130],
        [160, 160],
        [130, 160],
        [100, 160],
        [100, 130],
        [100, 100],
        [100, 85],
        [100, 70],
        [100, 55],
        [100, 40]
    ];

    hand.pointerDown(pointerEvent(node, 1, points[0][0], points[0][1]));
    points.slice(1).forEach(point => {
        t += 30;
        hand.pointerMove(pointerEvent(node, 1, point[0], point[1]));
    });
    hand.pointerUp(pointerEvent(node, 1, 100, 40, { buttons: 0 }));

    assert.strictEqual(events.filter(event => event === 'short').length, 0);
    assert.strictEqual(events.filter(event => event === 'long').length, 1);
    assert.ok(events.includes('end:right>down>left>up>right>down>left>up'));
});

run('longer touch path stays exclusive in priority demo shape', () => {
    let t = 0;
    const { node, hand } = create({
        input: 'touch',
        clock: () => t,
        path: {
            enabled: true,
            fingers: [1],
            minDistance: 15,
            segmentDistance: 15,
            maxPause: 2000
        }
    });
    const events = [];

    hand.command('right>down>left>up', () => events.push('short'));
    hand.command('right>down>left>up>right>down>left>up', () => events.push('long'));
    hand.on('path', detail => events.push('path:' + detail.pathText));
    hand.on('path:end', detail => events.push('end:' + detail.pathText));

    const points = [
        [100, 100],
        [130, 100],
        [160, 100],
        [160, 130],
        [160, 160],
        [130, 160],
        [100, 160],
        [100, 130],
        [100, 100],
        [130, 100],
        [160, 100],
        [160, 130],
        [160, 160],
        [130, 160],
        [100, 160],
        [100, 130],
        [100, 100],
        [100, 85],
        [100, 70],
        [100, 55],
        [100, 40]
    ];

    let current = touch(1, points[0][0], points[0][1], { target: node });
    hand.touchStart(touchEvent(node, [current], [current]));
    points.slice(1).forEach(point => {
        t += 30;
        current = touch(1, point[0], point[1], { target: node });
        hand.touchMove(touchEvent(node, [current], [current]));
    });
    hand.touchEnd(touchEvent(node, [], [current]));

    assert.strictEqual(events.filter(event => event === 'short').length, 0);
    assert.strictEqual(events.filter(event => event === 'long').length, 1);
    assert.ok(events.includes('end:right>down>left>up>right>down>left>up'));
});

run('release-completed longer path suppresses shorter prefix command', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        path: {
            minTime: 0,
            minSamples: 1,
            minDistance: 35,
            segmentDistance: 35,
            maxPause: 500,
            maxSegments: 4
        }
    });
    let short = 0;
    let long = 0;
    let longDetail = null;

    hand.on('right>down>left>up', () => short++);
    hand.on('right>down>left>up>right>down>left>up', detail => {
        long++;
        longDetail = detail;
    });

    const draw = (id, points) => {
        hand.pointerDown(pointerEvent(node, id, points[0][0], points[0][1]));
        points.slice(1, -1).forEach(point => {
            t += 40;
            hand.pointerMove(pointerEvent(node, id, point[0], point[1]));
        });
        t += 40;
        const end = points[points.length - 1];
        hand.pointerUp(pointerEvent(node, id, end[0], end[1], { buttons: 0 }));
    };

    const square = [[100, 100], [160, 100], [160, 160], [100, 160], [100, 100]];
    draw(1, square.concat(square.slice(1)));

    assert.strictEqual(short, 0);
    assert.strictEqual(long, 1);
    assert.strictEqual(longDetail.pathText, 'right>down>left>up>right>down>left>up');
    assert.strictEqual(longDetail.pathSegments.length, 8);

    draw(2, square);

    assert.strictEqual(short, 1);
    assert.strictEqual(long, 1);
});

run('longer held path suppresses shorter prefix phases', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        path: {
            minTime: 0,
            minSamples: 1,
            minDistance: 35,
            segmentDistance: 35,
            maxPause: 500,
            maxSegments: 4
        }
    });
    const events = [];

    ['observe', 'intent', 'update', 'command'].forEach(phase => {
        hand.on('right>down>left>up', () => events.push('short:' + phase), { phase });
        hand.on('right>down>left>up>right>down>left>up', () => events.push('long:' + phase), { phase });
    });

    const points = [[100, 100], [160, 100], [160, 160], [100, 160], [100, 100], [160, 100], [160, 160], [100, 160], [100, 100]];

    hand.pointerDown(pointerEvent(node, 1, 100, 100));
    points.slice(1).forEach(point => {
        t += 40;
        hand.pointerMove(pointerEvent(node, 1, point[0], point[1]));
    });
    hand.pointerUp(pointerEvent(node, 1, 100, 100, { buttons: 0 }));

    assert.deepStrictEqual(events, ['long:observe', 'long:intent', 'long:update', 'long:command']);
});

run('longer held path suppresses shorter path criteria', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        path: {
            minTime: 0,
            minSamples: 1,
            minDistance: 35,
            segmentDistance: 35,
            maxPause: 500,
            maxSegments: 4
        }
    });
    let short = 0;
    let long = 0;

    hand.on('path', { path: 'right>down>left>up' }, () => short++, { phase: 'observe' });
    hand.on('path', { path: 'right>down>left>up>right>down>left>up' }, () => long++, { phase: 'observe' });

    const draw = points => {
        hand.pointerDown(pointerEvent(node, 1, points[0][0], points[0][1]));
        points.slice(1).forEach(point => {
            t += 40;
            hand.pointerMove(pointerEvent(node, 1, point[0], point[1]));
        });
        hand.pointerUp(pointerEvent(node, 1, points[points.length - 1][0], points[points.length - 1][1], { buttons: 0 }));
    };

    const square = [[100, 100], [160, 100], [160, 160], [100, 160], [100, 100]];
    draw(square.concat(square.slice(1)));

    assert.strictEqual(short, 0);
    assert.strictEqual(long, 1);

    draw(square);

    assert.strictEqual(short, 1);
    assert.strictEqual(long, 1);
});

run('path detection rejects straight movement jitter and pause-joined shapes', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        intent: { events: ['down>right'] },
        pan: { enabled: false },
        swipe: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        path: {
            minTime: 0,
            minSamples: 1,
            minDistance: 35,
            segmentDistance: 35,
            maxPause: 120
        }
    });
    let matched = 0;

    hand.on('down>right', () => matched++);

    hand.pointerDown(pointerEvent(node, 1, 100, 100));
    t = 40;
    hand.pointerMove(pointerEvent(node, 1, 100, 150));
    t = 80;
    hand.pointerMove(pointerEvent(node, 1, 120, 154));
    t = 260;
    hand.pointerMove(pointerEvent(node, 1, 170, 154));
    hand.pointerUp(pointerEvent(node, 1, 170, 154, { buttons: 0 }));

    hand.pointerDown(pointerEvent(node, 2, 40, 40));
    t = 320;
    hand.pointerMove(pointerEvent(node, 2, 140, 42));
    t = 360;
    hand.pointerMove(pointerEvent(node, 2, 180, 44));
    hand.pointerUp(pointerEvent(node, 2, 180, 44, { buttons: 0 }));

    assert.strictEqual(matched, 0);
});

run('auto path consumes conflicting release swipe after turn', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        intent: { events: ['left>up', 'swipe:left'] },
        pan: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        path: {
            minTime: 0,
            minSamples: 1,
            minDistance: 35,
            segmentDistance: 35
        },
        swipe: {
            distanceByFingers: { 1: 60 },
            minTime: 0,
            minSamples: 1,
            confidenceDelay: 0,
            intentDistance: 10
        }
    });
    let path = 0;
    let swipe = 0;

    hand.on('left>up', () => path++);
    hand.on('swipe:left', () => swipe++);

    hand.pointerDown(pointerEvent(node, 1, 250, 180));
    t = 40;
    hand.pointerMove(pointerEvent(node, 1, 150, 180));
    t = 80;
    hand.pointerMove(pointerEvent(node, 1, 150, 130));
    hand.pointerUp(pointerEvent(node, 1, 150, 130, { buttons: 0 }));

    assert.strictEqual(path, 1);
    assert.strictEqual(swipe, 0);
});

run('never path mode allows matched path and release swipe coexistence', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        intent: { events: ['left>up', 'swipe:left'] },
        pan: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        path: {
            minTime: 0,
            minSamples: 1,
            minDistance: 35,
            segmentDistance: 35,
            consume: 'never'
        },
        swipe: {
            distanceByFingers: { 1: 60 },
            minTime: 0,
            minSamples: 1,
            confidenceDelay: 0,
            intentDistance: 10
        }
    });
    const seen = [];

    hand.on('left>up', () => seen.push('path'));
    hand.on('swipe:left', () => seen.push('swipe'));

    hand.pointerDown(pointerEvent(node, 1, 250, 180));
    t = 40;
    hand.pointerMove(pointerEvent(node, 1, 150, 180));
    t = 80;
    hand.pointerMove(pointerEvent(node, 1, 150, 130));
    hand.pointerUp(pointerEvent(node, 1, 150, 130, { buttons: 0 }));

    assert.deepStrictEqual(seen, ['path', 'swipe']);
});

run('auto path consumes command-phase path criteria match', () => {
    let t = 0;
    const { node, hand } = create({
        clock: () => t,
        intent: { events: null },
        pan: { enabled: false },
        pinch: { enabled: false },
        rotate: { enabled: false },
        path: {
            minTime: 0,
            minSamples: 1,
            minDistance: 35,
            segmentDistance: 35
        },
        swipe: {
            distanceByFingers: { 1: 60 },
            minTime: 0,
            minSamples: 1,
            confidenceDelay: 0,
            intentDistance: 10
        }
    });
    const seen = [];

    hand.command('path', { path: 'right' }, () => seen.push('path'));
    hand.on('swipe:right', () => seen.push('swipe'));

    hand.pointerDown(pointerEvent(node, 1, 80, 100));
    t = 70;
    hand.pointerMove(pointerEvent(node, 1, 150, 100));
    hand.pointerUp(pointerEvent(node, 1, 150, 100, { buttons: 0 }));

    assert.deepStrictEqual(seen, ['path']);
});

run('position grid helper exists on payloads and static rect can refresh', () => {
    const node = target(300, 300);
    const hand = new HandTrick(node, {
        input: 'mouse',
        windowEvents: false,
        preventDefault: false,
        wheel: { enabled: false },
        press: { enabled: false },
        rect: 'static'
    });
    let grid = null;

    hand.on('tap', detail => {
        grid = detail.center.grid(4, 4);
    });
    hand.mouseDown(mouseEvent(node, 250, 250));
    hand.mouseUp(mouseEvent(node, 250, 250, { buttons: 0 }));

    assert.deepStrictEqual(grid, { row: 3, col: 3, rows: 4, cols: 4, index: 15 });
    assert.strictEqual(HandTrick.zone({ ratioX: 0.9, ratioY: 0.1 }, { rows: 2, cols: 5 }).index, 4);

    let width = 300;
    node.getBoundingClientRect = () => ({ left: 0, top: 0, right: width, bottom: 300, width, height: 300 });
    assert.strictEqual(hand.rect().width, 300);
    width = 500;
    assert.strictEqual(hand.rect().width, 300);
    hand.refreshRect();
    assert.strictEqual(hand.rect().width, 500);
});

run('dom tap guard prevents only nearby rapid native taps', () => {
    let t = 0;
    const node = target();
    const hand = new HandTrick(node, {
        input: 'mouse',
        clock: () => t,
        windowEvents: false,
        preventDefault: false,
        wheel: { enabled: false },
        press: { enabled: false }
    });
    const handlers = Array.from(node.listeners.get('touchstart') || []);
    let prevented = 0;
    const event = (x, y) => ({
        type: 'touchstart',
        target: node,
        cancelable: true,
        changedTouches: [{ clientX: x, clientY: y }],
        preventDefault() {
            prevented++;
        }
    });

    handlers.forEach(handler => handler(event(40, 40)));
    t = 120;
    handlers.forEach(handler => handler(event(44, 42)));
    t = 240;
    handlers.forEach(handler => handler(event(240, 240)));

    assert.strictEqual(prevented, 1);
    hand.destroy();
});

run('dom tap guard works when selection guard is disabled', () => {
    let t = 0;
    const node = target();
    const hand = new HandTrick(node, {
        input: 'mouse',
        clock: () => t,
        windowEvents: false,
        preventDefault: false,
        dom: {
            selectionGuard: false,
            tapGuard: true
        },
        wheel: { enabled: false },
        press: { enabled: false }
    });
    const handlers = Array.from(node.listeners.get('touchstart') || []);
    let prevented = 0;
    const event = x => ({
        type: 'touchstart',
        target: node,
        cancelable: true,
        changedTouches: [{ clientX: x, clientY: 40 }],
        preventDefault() {
            prevented++;
        }
    });

    assert.ok(handlers.length > 0);
    assert.ok(!node.listeners.has('selectstart') || node.listeners.get('selectstart').size === 0);
    handlers.forEach(handler => handler(event(40)));
    t = 120;
    handlers.forEach(handler => handler(event(42)));

    assert.strictEqual(prevented, 1);
    hand.destroy();
});

run('dom tap guard skips first touchend and blocks native double tap edges', () => {
    let t = 0;
    const node = target();
    const hand = new HandTrick(node, {
        input: 'mouse',
        clock: () => t,
        windowEvents: false,
        preventDefault: false,
        wheel: { enabled: false },
        press: { enabled: false }
    });
    const handlers = type => Array.from(node.listeners.get(type) || []);
    let prevented = 0;
    const touchEvent = (type, x, id) => ({
        type,
        target: node,
        cancelable: true,
        changedTouches: [{ identifier: id, clientX: x, clientY: 40 }],
        preventDefault() {
            prevented++;
        }
    });
    const dblclick = {
        type: 'dblclick',
        target: node,
        cancelable: true,
        button: 0,
        clientX: 80,
        clientY: 80,
        preventDefault() {
            prevented++;
        }
    };

    handlers('touchstart').forEach(handler => handler(touchEvent('touchstart', 40, 1)));
    t = 220;
    handlers('touchend').forEach(handler => handler(touchEvent('touchend', 40, 1)));
    assert.strictEqual(prevented, 0);

    t = 280;
    handlers('touchstart').forEach(handler => handler(touchEvent('touchstart', 42, 2)));
    assert.strictEqual(prevented, 1);

    t = 760;
    handlers('touchstart').forEach(handler => handler(touchEvent('touchstart', 260, 3)));
    assert.strictEqual(prevented, 1);

    handlers('dblclick').forEach(handler => handler(dblclick));
    assert.strictEqual(prevented, 2);
    hand.destroy();
});
