cancelPress(reason, ended) {
    if (!this.session) return;

    clearTimeout(this.session.pressTimer);
    clearInterval(this.session.pressRepeatTimer);
    this.session.pressTimer = null;
    this.session.pressRepeatTimer = null;

    if (this.session.pressStarted) {
        const type = ended ? 'press:end' : 'press:cancel';
        this.emit(type, this.detail(type, { reason }));
    }

    this.session.pressStarted = false;
}

resetBasis(time) {
    const points = this.pointList();
    const rect = this.rect();
    const center = this.positionDetail(this.center(points), rect);
    const distance = points.length >= 2 ? pointDistance(points[0], points[1]) : 0;
    const angle = points.length >= 2 ? pointAngle(points[0], points[1]) : 0;

    points.forEach(point => {
        point.phaseStartX = point.x;
        point.phaseStartY = point.y;
        point.phaseStartClientX = point.clientX;
        point.phaseStartClientY = point.clientY;
    });
    this.session.phaseTime = time;
    this.session.startCenter = center;
    this.session.previousCenter = center;
    this.session.center = center;
    this.session.startDistance = distance;
    this.session.previousDistance = distance;
    this.session.startAngle = angle;
    this.session.previousAngle = angle;
    this.session.previousVelocity = 0;
    this.session.previousPressure = this.pressure(points, 'pressure');
    this.session.lastMoveTime = time;
    this.session.maxFingers = Math.max(this.session.maxFingers, points.length);
    this.session.maxActualFingers = Math.max(this.session.maxActualFingers || 0, points.length);
    this.session.pinchStarted = false;
    this.session.pinchBaseDistance = null;
    this.session.pinchModified = false;
    this.session.rotateStarted = false;
    this.session.rotateBaseAngle = null;
    this.session.rotateModified = false;
    this.session.pathStarted = false;
    this.session.path = null;
    this.session.swipeIntentAt = 0;
    this.session.swipeReady = false;
    this.session.history = [];
}

pointList() {
    if (!this.pointsDirty) return this.pointCache.slice();
    this.pointCache = Array.from(this.points.values()).sort((a, b) => String(a.id).localeCompare(String(b.id)));
    this.pointsDirty = false;
    return this.pointCache.slice();
}

center(points) {
    const count = points.length || 1;
    const sum = points.reduce((acc, point) => {
        acc.x += point.x;
        acc.y += point.y;
        acc.clientX += point.clientX;
        acc.clientY += point.clientY;
        return acc;
    }, { x: 0, y: 0, clientX: 0, clientY: 0 });

    return {
        x: sum.x / count,
        y: sum.y / count,
        clientX: sum.clientX / count,
        clientY: sum.clientY / count
    };
}

rect() {
    if (this.session && this.options.rect === 'session' && this.session.rect) return Object.assign({}, this.session.rect);
    if (this.options.rect === 'static' && this.staticRect) return Object.assign({}, this.staticRect);
    if (!this.target.getBoundingClientRect) return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
    const rect = this.target.getBoundingClientRect();
    const data = {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
    };
    if (this.session && this.options.rect === 'session') this.session.rect = data;
    if (this.options.rect === 'static') this.staticRect = data;
    return Object.assign({}, data);
}

refreshRect() {
    if (this.session) this.session.rect = null;
    this.staticRect = null;
    return this;
}

positionDetail(point, rect) {
    const width = rect.width || 1;
    const height = rect.height || 1;
    const clientX = point.clientX !== undefined ? point.clientX : point.x;
    const clientY = point.clientY !== undefined ? point.clientY : point.y;
    const pageX = point.pageX !== undefined ? point.pageX : point.x;
    const pageY = point.pageY !== undefined ? point.pageY : point.y;
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const edgeSize = this.options.edge.size;
    const ratioX = localX / width;
    const ratioY = localY / height;
    const clampedRatioX = clamp(ratioX, 0, 1);
    const clampedRatioY = clamp(ratioY, 0, 1);
    const thirdX = clampedRatioX < 1 / 3 ? 'left' : clampedRatioX > 2 / 3 ? 'right' : 'center';
    const thirdY = clampedRatioY < 1 / 3 ? 'top' : clampedRatioY > 2 / 3 ? 'bottom' : 'middle';
    const region = thirdX === 'center' && thirdY === 'middle' ? 'center' : thirdY + '-' + thirdX;
    const edge = {
        top: localY <= edgeSize,
        right: width - localX <= edgeSize,
        bottom: height - localY <= edgeSize,
        left: localX <= edgeSize
    };
    const edgeY = edge.top ? 'top' : edge.bottom ? 'bottom' : '';
    const edgeX = edge.left ? 'left' : edge.right ? 'right' : '';
    const edgeRegion = edgeY && edgeX ? edgeY + '-' + edgeX : edgeY || edgeX || 'none';
    const halfX = clampedRatioX < 0.45 ? 'left' : clampedRatioX > 0.55 ? 'right' : 'center';
    const halfY = clampedRatioY < 0.45 ? 'top' : clampedRatioY > 0.55 ? 'bottom' : 'middle';
    const halfRegion = halfX === 'center' && halfY === 'middle' ? 'center' : halfY === 'middle' ? halfX : halfX === 'center' ? halfY : halfY + '-' + halfX;
    const inside = ratioX >= 0 && ratioX <= 1 && ratioY >= 0 && ratioY <= 1;
    const area = !inside ? 'outside' : edgeRegion !== 'none' ? 'edge' : halfRegion === 'center' ? 'center' : 'inside';
    const gridPoint = { ratioX, ratioY, clampedRatioX, clampedRatioY };

    return {
        x: clientX,
        y: clientY,
        pageX,
        pageY,
        clientX,
        clientY,
        localX,
        localY,
        ratioX,
        ratioY,
        clampedRatioX,
        clampedRatioY,
        inside,
        area,
        edge,
        edgeRegion,
        halfX,
        halfY,
        halfRegion,
        thirdX,
        thirdY,
        region,
        zone: region,
        grid: (rows, cols) => gridFor(gridPoint, { rows, cols })
    };
}

exportPoint(point, rect) {
    if (!point) return null;
    const position = rect ? this.positionDetail(point, rect) : null;
    const startPosition = rect ? this.positionDetail({
        x: point.startX,
        y: point.startY,
        clientX: point.startClientX,
        clientY: point.startClientY
    }, rect) : null;
    return Object.assign({
        id: point.id,
        target: point.target,
        pointerType: point.pointerType,
        x: point.x,
        y: point.y,
        pageX: point.x,
        pageY: point.y,
        clientX: point.clientX,
        clientY: point.clientY,
        screenX: point.screenX,
        screenY: point.screenY,
        startX: point.startX,
        startY: point.startY,
        startClientX: point.startClientX,
        startClientY: point.startClientY,
        phaseStartX: point.phaseStartX,
        phaseStartY: point.phaseStartY,
        deltaX: point.x - point.startX,
        deltaY: point.y - point.startY,
        phaseDeltaX: phaseDX(point),
        phaseDeltaY: phaseDY(point),
        pressure: point.pressure,
        normalizedPressure: clamp(point.pressure || 0, 0, 1),
        pressureDelta: point.pressure - point.previousPressure,
        tangentialPressure: point.tangentialPressure,
        tiltX: point.tiltX,
        tiltY: point.tiltY,
        twist: point.twist,
        width: point.width,
        height: point.height
    }, position ? {
        localX: position.localX,
        localY: position.localY,
        ratioX: position.ratioX,
        ratioY: position.ratioY,
        clampedRatioX: position.clampedRatioX,
        clampedRatioY: position.clampedRatioY,
        inside: position.inside,
        area: position.area,
        edge: position.edge,
        edgeRegion: position.edgeRegion,
        halfX: position.halfX,
        halfY: position.halfY,
        halfRegion: position.halfRegion,
        thirdX: position.thirdX,
        thirdY: position.thirdY,
        region: position.region,
        zone: position.zone,
        grid: position.grid
    } : {}, startPosition ? {
        startLocalX: startPosition.localX,
        startLocalY: startPosition.localY,
        startRatioX: startPosition.ratioX,
        startRatioY: startPosition.ratioY,
        startArea: startPosition.area,
        startEdge: startPosition.edge,
        startEdgeRegion: startPosition.edgeRegion,
        startHalfX: startPosition.halfX,
        startHalfY: startPosition.halfY,
        startHalfRegion: startPosition.halfRegion,
        startRegion: startPosition.region,
        startZone: startPosition.zone
    } : {});
}

pressure(points, key) {
    if (!points.length) return 0;
    return points.reduce((sum, point) => sum + (point[key] || 0), 0) / points.length;
}

motionShape(points, travel, distanceDelta, rotation) {
    if (points.length < 2) {
        return {
            parallel: 1,
            opposition: 0,
            moved: points.filter(point => hypot(phaseDX(point), phaseDY(point)) > this.options.tap.maxMove).length,
            rotationArc: 0,
            translationShare: travel ? 1 : 0
        };
    }

    const a = points[0];
    const b = points[1];
    const ax = phaseDX(a);
    const ay = phaseDY(a);
    const bx = phaseDX(b);
    const by = phaseDY(b);
    const am = hypot(ax, ay);
    const bm = hypot(bx, by);
    const dot = am && bm ? (ax * bx + ay * by) / (am * bm) : 0;
    const span = pointDistance(a, b);
    const rotationArc = span * abs(rotation) * PI / 360;
    const drift = travel + abs(distanceDelta) * 0.5;

    return {
        parallel: clamp(dot, -1, 1),
        opposition: clamp(-dot, 0, 1),
        moved: points.filter(point => hypot(phaseDX(point), phaseDY(point)) > this.options.tap.maxMove).length,
        rotationArc,
        translationShare: drift ? travel / Math.max(1, drift + rotationArc) : 0
    };
}

phaseFor(type) {
    if (type === 'session:cancel' || type.endsWith('cancel') || type.endsWith(':cancel')) return 'cancelled';
    if (type === 'session:end' || type.endsWith('end') || type.endsWith(':end')) return 'ended';
    if (type === 'finish') return 'settling';
    if (type.endsWith('start') || type.endsWith(':start')) return 'began';
    if (type === 'tap' || type === 'swipe' || type === 'rolling' || type === 'tap:mod' || type.indexOf('tap:') === 0 || type.indexOf('rolling:') === 0 || type.indexOf('swipe:') === 0) return 'committed';
    if (type === 'session:move' || type.endsWith('move') || type.endsWith(':move') || type === 'pan' || type === 'pan:mod' || type === 'pinch' || type === 'rotate') return 'active';
    return 'possible';
}

intentReady(detail, opt, gesture) {
    const scale = gesture ? this.intentSpeedScale(detail, gesture) : 1;
    const minTime = opt && opt.minTime ? Math.ceil(opt.minTime * scale) : 0;
    const baseSamples = opt && opt.minSamples ? opt.minSamples : 0;
    const minSamples = scale < 1 ? Math.max(this.options.intent.fastPathSamples || 1, Math.ceil(baseSamples * scale)) : baseSamples;
    if (minTime && detail.elapsed < minTime) return false;
    if (minSamples && detail.sampleCount < minSamples) return false;
    return true;
}

intentSpeedScale(detail, gesture) {
    const opt = this.options.intent || {};
    if (!opt.enabled || !opt.prune || !opt.fastPath) return 1;
    const state = this.intentState();
    if (!state.pruned || !state.groups.has(gesture)) return 1;
    const candidates = this.continuousCandidates(detail);
    if (!candidates.length || candidates.length > (opt.fastPathMaxCandidates || 1)) return 1;
    return Math.max(0.1, Math.min(1, opt.fastPathTime || 1));
}

recordHistory(detail) {
    if (!this.session) return;
    const limit = Math.max(1, this.options.intent.history || 1);
    this.session.history.push({
        time: this.time(),
        fingers: detail.fingers,
        center: { x: detail.center.pageX, y: detail.center.pageY },
        deltaX: detail.deltaX,
        deltaY: detail.deltaY,
        travel: detail.travel,
        direction: detail.direction,
        distance: detail.distance,
        distanceDelta: detail.distanceDelta,
        scale: detail.scale,
        rotation: detail.rotation,
        velocity: detail.velocity,
        angularVelocity: detail.angularVelocity
    });
    while (this.session.history.length > limit) this.session.history.shift();
}

confidenceScores(detail) {
    const panOpt = this.options.pan;
    const pinchOpt = this.options.pinch;
    const rotateOpt = this.options.rotate;
    const swipeOpt = this.options.swipe;
    const swipeMin = swipeOpt.distanceByFingers[detail.fingers] || swipeOpt.distance || 1;
    const pan = this.allowsGesture('pan') && panOpt.enabled && toArray(panOpt.fingers).includes(detail.fingers) && this.intentReady(detail, panOpt, 'pan') ? detail.travel / Math.max(1, panOpt.threshold) : 0;
    const pinchReady = this.allowsGesture('pinch') && pinchOpt.enabled && detail.fingers === 2 && this.intentReady(detail, pinchOpt, 'pinch');
    const pinchDistance = pinchReady ? abs(detail.distanceDelta) / Math.max(1, pinchOpt.distance) : 0;
    const pinchScale = pinchReady ? abs(detail.scaleDelta) / Math.max(0.001, pinchOpt.scale) : 0;
    const pinchDominance = pinchReady && detail.travel ? abs(detail.distanceDelta) / Math.max(1, detail.travel * pinchOpt.dominance) : Math.max(pinchDistance, pinchScale);
    let rotate = 0;

    if (this.allowsGesture('rotate') && rotateOpt.enabled && detail.fingers === 2 && this.intentReady(detail, rotateOpt, 'rotate')) {
        const angleScore = abs(detail.rotation) / Math.max(1, rotateOpt.angle);
        const speedScore = detail.angularVelocity / Math.max(0.001, rotateOpt.minAngularVelocity);
        const late = detail.elapsed > rotateOpt.maxSoftStart && abs(detail.rotation) < rotateOpt.lateAngle;
        const rotationArc = detail.motion.rotationArc || Math.max(detail.startDistance, detail.distance) * abs(detail.rotation) * PI / 360;
        const drift = detail.travel + abs(detail.distanceDelta) * 0.5;
        const balance = rotationArc ? rotationArc / Math.max(1, rotationArc + drift) : 0;
        const dominance = balance / Math.max(0.001, rotateOpt.dominance);
        rotate = late ? Math.min(angleScore, speedScore) * 0.35 : Math.max(angleScore * 0.68, Math.min(angleScore, speedScore));
        rotate = Math.min(rotate, dominance);
        if (detail.motion.parallel > 0.72 && detail.motion.translationShare > 0.5) rotate *= 0.18;
        if (rotateOpt.requireMovedFingers) {
            if (detail.motion.moved < detail.fingers) rotate = 0;
        }
    }

    return {
        pan,
        pinch: Math.min(Math.max(pinchDistance, pinchScale), pinchDominance),
        rotate,
        swipe: this.allowsGesture('swipe') && swipeOpt.enabled && this.intentReady(detail, swipeOpt, 'swipe') ? Math.max(detail.travel / Math.max(1, swipeMin), detail.velocity / Math.max(0.001, swipeOpt.velocity)) : 0
    };
}

detail(type, extra) {
    const session = this.session;
    const points = this.pointList();
    const rect = this.rect();
    const rawCenter = points.length ? this.center(points) : (session && session.center ? session.center : { x: 0, y: 0, clientX: 0, clientY: 0 });
    const center = rawCenter.localX !== undefined ? rawCenter : this.positionDetail(rawCenter, rect);
    const startCenter = session && session.startCenter ? session.startCenter : center;
    const previousCenter = session && session.previousCenter ? session.previousCenter : center;
    const deltaX = center.pageX - startCenter.pageX;
    const deltaY = center.pageY - startCenter.pageY;
    const stepX = center.pageX - previousCenter.pageX;
    const stepY = center.pageY - previousCenter.pageY;
    const distance = points.length >= 2 ? pointDistance(points[0], points[1]) : 0;
    const angle = points.length >= 2 ? pointAngle(points[0], points[1]) : 0;
    const startDistance = session && session.pinchStarted && session.pinchBaseDistance ? session.pinchBaseDistance : session ? session.startDistance : 0;
    const previousDistance = session ? session.previousDistance : distance;
    const previousAngle = session ? session.previousAngle : angle;
    const scale = startDistance ? distance / startDistance : 1;
    const startAngle = session && session.rotateStarted && session.rotateBaseAngle !== null ? session.rotateBaseAngle : session ? session.startAngle : angle;
    const rotation = session ? normalizeAngle(angle - startAngle) : 0;
    const sampleTime = this.time();
    const elapsed = session ? sampleTime - session.phaseTime : 0;
    const totalElapsed = session ? sampleTime - session.startTime : 0;
    const stepElapsed = session ? Math.max(0, sampleTime - session.lastMoveTime) : 0;
    const sampleCount = session ? session.history.length + 1 : 0;
    const travel = hypot(deltaX, deltaY);
    const stepDistance = hypot(stepX, stepY);
    const distanceDelta = distance - startDistance;
    const velocityX = elapsed ? deltaX / elapsed : 0;
    const velocityY = elapsed ? deltaY / elapsed : 0;
    const velocity = elapsed ? travel / elapsed : 0;
    const stepVelocityX = stepElapsed ? stepX / stepElapsed : 0;
    const stepVelocityY = stepElapsed ? stepY / stepElapsed : 0;
    const stepVelocity = stepElapsed ? stepDistance / stepElapsed : 0;
    const acceleration = stepElapsed ? (velocity - (session ? session.previousVelocity : 0)) / stepElapsed : 0;
    const distanceVelocity = stepElapsed ? (distance - previousDistance) / stepElapsed : 0;
    const angularVelocity = stepElapsed ? abs(normalizeAngle(angle - previousAngle)) / stepElapsed : 0;
    const direction = directionFrom(deltaX, deltaY, this.options.swipe.axisRatio);
    const first = points[0] || null;
    const pressure = this.pressure(points, 'pressure');
    const previousPressure = this.pressure(points, 'previousPressure');
    const pressureDelta = pressure - previousPressure;
    const motion = this.motionShape(points, travel, distanceDelta, rotation);
    const activePointers = points.map(point => this.exportPoint(point, rect));
    const keyboard = session && session.keyboard ? session.keyboard : keyboardState(extra && extra.originalEvent);
    const keyboardSubstitute = copyKeyboardSubstitute(session && session.keyboardSubstitute);
    const actualFingers = points.length || (session ? session.maxActualFingers || 0 : 0);
    const syntheticFingers = keyboardSubstitute ? keyboardSubstitute.fingers : 0;
    const effectiveFingers = points.length ? Math.max(points.length, syntheticFingers || 0) : (session ? session.maxFingers : points.length);
    const fingerSource = syntheticFingers && syntheticFingers > actualFingers ? 'keyboard' : actualFingers ? 'pointer' : 'none';

    const data = Object.assign({
        type,
        originalEvent: session ? session.event : null,
        target: first ? first.target : (session ? session.target : this.target),
        currentTarget: this.target,
        pointerType: first ? first.pointerType : (session ? session.pointerType : 'none'),
        fingers: effectiveFingers,
        actualFingers,
        syntheticFingers,
        fingerSource,
        maxFingers: session ? session.maxFingers : points.length,
        maxActualFingers: session ? session.maxActualFingers || actualFingers : actualFingers,
        pointers: activePointers,
        activePointers,
        center: Object.assign({}, center),
        startCenter: Object.assign({}, startCenter),
        previousCenter: Object.assign({}, previousCenter),
        region: center.region,
        startRegion: startCenter.region,
        previousRegion: previousCenter.region,
        area: center.area,
        startArea: startCenter.area,
        edge: center.edge,
        startEdge: startCenter.edge,
        edgeRegion: center.edgeRegion,
        startEdgeRegion: startCenter.edgeRegion,
        halfX: center.halfX,
        halfY: center.halfY,
        halfRegion: center.halfRegion,
        thirdX: center.thirdX,
        thirdY: center.thirdY,
        keys: keyboard.keys.slice(),
        keyCombo: keyboard.combo,
        keyboard: copyKeyboardState(keyboard),
        keyboardSubstitute,
        deltaX,
        deltaY,
        stepX,
        stepY,
        stepDistance,
        stepElapsed,
        absX: abs(deltaX),
        absY: abs(deltaY),
        travel,
        elapsed,
        totalElapsed,
        sampleCount,
        velocityX,
        velocityY,
        velocity,
        stepVelocityX,
        stepVelocityY,
        stepVelocity,
        acceleration,
        direction,
        axis: axisFrom(direction),
        distance,
        startDistance,
        previousDistance,
        distanceDelta,
        distanceVelocity,
        scale,
        scaleDelta: scale - 1,
        angle,
        previousAngle,
        rotation,
        angularVelocity,
        pressure,
        previousPressure,
        pressureDelta,
        normalizedPressure: clamp(pressure || 0, 0, 1),
        motion,
        rect,
        phase: this.phaseFor(type),
        intent: session ? Object.assign({}, session.intent, { samples: sampleCount }) : { gesture: 'none', committedAt: 0, samples: 0 },
        claimed: !!(session && session.claimed),
        tapHold: !!(session && session.tapHold),
        tapChain: !!(session && session.tapChain),
        consumed: !!(session && session.consumed),
        releaseGuarded: !!(session && session.releaseGuard),
        topology: {
            added: extra && extra.added ? extra.added : 0,
            removed: extra && extra.removed ? extra.removed : 0,
            total: effectiveFingers,
            actual: points.length,
            max: session ? session.maxFingers : points.length
        },
        preventDefault: () => {
            if (extra && extra.originalEvent && extra.originalEvent.cancelable) extra.originalEvent.preventDefault();
        },
        stopPropagation: () => {
            if (extra && extra.originalEvent) {
                if (typeof extra.originalEvent.stopPropagation === 'function') extra.originalEvent.stopPropagation();
                if (typeof extra.originalEvent.stopImmediatePropagation === 'function') extra.originalEvent.stopImmediatePropagation();
            }
        }
    }, extra || {});

    data.confidences = this.confidenceScores(data);
    data.confidence = Math.max(data.confidences.pan, data.confidences.pinch, data.confidences.rotate, data.confidences.swipe);
    data.intent.possible = this.possibleGestures(data);
    data.intent.pruned = this.intentState().pruned;
    return data;
}
