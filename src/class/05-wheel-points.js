wheel(event) {
    if (!this.enabled) return;
    if (this.isIgnored(event, event.target)) {
        this.emit('input:ignored', {
            originalEvent: event,
            target: event.target,
            currentTarget: this.target,
            pointerType: 'wheel',
            reason: 'ignore',
            phase: 'cancelled'
        });
        return;
    }
    if (!this.allowsGesture('wheel')) return;
    this.prepareEvent(event, this.options.wheel.preventDefault);

    const rect = this.rect();
    const rawDeltaX = event.deltaX || 0;
    const rawDeltaY = event.deltaY || event.detail || 0;
    const rawDeltaZ = event.deltaZ || 0;
    const mode = event.deltaMode || 0;
    const deltaX = this.wheelPixels(rawDeltaX, mode, rect);
    const delta = this.wheelPixels(rawDeltaY, mode, rect);
    const deltaZ = this.wheelPixels(rawDeltaZ, mode, rect);
    const scale = Math.exp(-delta * this.options.wheel.zoomFactor);
    const center = this.positionDetail({
        x: event.pageX !== undefined ? event.pageX : event.clientX,
        y: event.pageY !== undefined ? event.pageY : event.clientY,
        clientX: event.clientX || 0,
        clientY: event.clientY || 0
    }, rect);
    const keyboard = keyboardState(event);
    const detail = {
        type: 'wheel',
        originalEvent: event,
        target: event.target,
        currentTarget: this.target,
        pointerType: 'wheel',
        fingers: 0,
        maxFingers: 0,
        pointers: [],
        activePointers: [],
        deltaX,
        deltaY: delta,
        deltaZ,
        rawDeltaX,
        rawDeltaY,
        rawDeltaZ,
        deltaMode: mode,
        scale,
        scaleDelta: scale - 1,
        center,
        startCenter: Object.assign({}, center),
        previousCenter: Object.assign({}, center),
        region: center.region,
        startRegion: center.region,
        previousRegion: center.region,
        area: center.area,
        startArea: center.area,
        edge: center.edge,
        startEdge: center.edge,
        edgeRegion: center.edgeRegion,
        startEdgeRegion: center.edgeRegion,
        halfX: center.halfX,
        halfY: center.halfY,
        halfRegion: center.halfRegion,
        thirdX: center.thirdX,
        thirdY: center.thirdY,
        keys: keyboard.keys.slice(),
        keyCombo: keyboard.combo,
        keyboard: Object.assign({}, keyboard, { keys: keyboard.keys.slice() }),
        direction: directionFrom(deltaX, delta, this.options.swipe.axisRatio),
        axis: axisFrom(directionFrom(deltaX, delta, this.options.swipe.axisRatio)),
        phase: 'active',
        intent: {
            gesture: scale !== 1 ? 'wheel:zoom' : 'wheel',
            committedAt: this.time(),
            possible: ['wheel'],
            pruned: this.intentState().pruned,
            samples: 1
        },
        confidence: 1,
        confidences: { pan: 0, pinch: 0, rotate: 0, swipe: 0 },
        topology: {
            added: 0,
            removed: 0,
            total: 0,
            max: 0
        },
        rect,
        preventDefault: () => {
            if (event.cancelable) event.preventDefault();
        },
        stopPropagation: () => {
            if (event.stopPropagation) event.stopPropagation();
        }
    };

    this.emit('gesture:commit', Object.assign({}, detail, { gesture: scale !== 1 ? 'wheel:zoom' : 'wheel' }));
    this.recordGestureSequence(scale !== 1 ? 'wheel:zoom' : 'wheel', detail, 1);
    this.emit('wheel', detail);
    if (scale !== 1) this.emit('wheel:zoom', detail);
}

wheelPixels(value, mode, rect) {
    if (!this.options.wheel.normalize) return value;
    if (mode === 1) return value * (this.options.wheel.lineHeight || 16);
    if (mode === 2) return value * (rect.height || this.options.wheel.pageHeight || 800);
    return value;
}

pointerId(event) {
    return event.pointerId !== undefined ? event.pointerId : 'mouse';
}

eventPoint(event) {
    return {
        x: event.pageX,
        y: event.pageY,
        clientX: event.clientX,
        clientY: event.clientY,
        screenX: event.screenX || 0,
        screenY: event.screenY || 0,
        pointerType: event.pointerType || 'mouse',
        pressure: event.pressure || 0,
        tangentialPressure: event.tangentialPressure || 0,
        tiltX: event.tiltX || 0,
        tiltY: event.tiltY || 0,
        twist: event.twist || 0,
        width: event.width || 1,
        height: event.height || 1
    };
}

touchPoint(touch) {
    return {
        x: touch.pageX,
        y: touch.pageY,
        clientX: touch.clientX,
        clientY: touch.clientY,
        screenX: touch.screenX || 0,
        screenY: touch.screenY || 0,
        pointerType: 'touch',
        pressure: touch.force || 0,
        tangentialPressure: 0,
        tiltX: 0,
        tiltY: 0,
        twist: 0,
        width: touch.radiusX || 1,
        height: touch.radiusY || 1
    };
}

addPoint(id, input, event, raw) {
    const time = this.time();
    const point = {
        id,
        target: raw && raw.target ? raw.target : event.target,
        startTarget: raw && raw.target ? raw.target : event.target,
        startTime: time,
        time,
        startX: input.x,
        startY: input.y,
        startClientX: input.clientX,
        startClientY: input.clientY,
        phaseStartX: input.x,
        phaseStartY: input.y,
        phaseStartClientX: input.clientX,
        phaseStartClientY: input.clientY,
        previousX: input.x,
        previousY: input.y,
        previousClientX: input.clientX,
        previousClientY: input.clientY,
        x: input.x,
        y: input.y,
        clientX: input.clientX,
        clientY: input.clientY,
        screenX: input.screenX,
        screenY: input.screenY,
        pointerType: input.pointerType,
        pressure: input.pressure,
        previousPressure: input.pressure,
        tangentialPressure: input.tangentialPressure,
        tiltX: input.tiltX,
        tiltY: input.tiltY,
        twist: input.twist,
        width: input.width,
        height: input.height
    };

    const activeBefore = this.session ? this.pointList() : [];
    if (this.session) {
        this.endRunningGestures(event);
        this.releaseKeyboardModifierForMultiTouch();
    }

    this.points.set(id, point);
    this.pointsDirty = true;

    if (!this.session) {
        this.activateGestureStyles();
        this.session = this.createSession(time, event, point);
        this.session.rolling = this.createRollingState(id, point, time);
        this.resetBasis(time);
        this.session.tapHold = this.isTapHoldStart(point, time);
        this.session.tapChain = this.isTapChainStart(point, time);
        if (!this.session.keyboardSubstitute) this.startKeyboardModifier(id, point, event, time);
        const keyboardOpt = this.options.modifier.keyboard || {};
        if (this.session.tapHold || this.session.tapChain || ((this.session.keyboardModifier || this.session.keyboardSubstitute) && keyboardOpt.preventNative !== false)) this.suppressNative(event);
        if (!this.session.keyboardModifier) this.armPress(event);
        const detail = this.detail('session:start', { originalEvent: event, added: 1, removed: 0, changedPointer: this.exportPoint(point, this.rect()) });
        this.emit('session:start', detail);
        this.emit('gesture:start', Object.assign({}, detail, { gesture: 'session' }));
    } else {
        this.cancelPress('fingers:change');
        this.session.releaseGuard = null;
        this.startModifier(id, point, activeBefore, time);
        this.addRollingPoint(id, point, time);
        this.resetBasis(time);
        const detail = this.detail('fingers:change', { originalEvent: event, change: 'add', added: 1, removed: 0, changedPointer: this.exportPoint(point, this.rect()) });
        this.emit('fingers:change', detail);
        this.emit('gesture:transition', Object.assign({}, detail, { gesture: 'topology' }));
    }
}

createSession(time, event, point) {
    const keyboard = keyboardState(event);
    const keyboardSubstitute = this.matchKeyboardFingerSubstitute(event, keyboard);
    const maxFingers = keyboardSubstitute ? keyboardSubstitute.fingers : 1;
    return {
        id: Math.random().toString(36).slice(2),
        startTime: time,
        phaseTime: time,
        event,
        target: point.target,
        pointerType: point.pointerType,
        keyboard,
        keyboardSubstitute,
        maxFingers,
        maxActualFingers: 1,
        startCenter: null,
        previousCenter: null,
        center: null,
        startDistance: 0,
        startAngle: 0,
        previousDistance: 0,
        previousAngle: 0,
        lastMoveTime: time,
        previousVelocity: 0,
        previousPressure: 0,
        moved: false,
        consumed: false,
        claimed: false,
        commits: {},
        tapHold: false,
        tapChain: false,
        pressTimer: null,
        pressRepeatTimer: null,
        pressStarted: false,
        panStarted: false,
        panAxis: null,
        pinchStarted: false,
        pinchBaseDistance: null,
        pinchModified: false,
        rotateStarted: false,
        rotateBaseAngle: null,
        rotateModified: false,
        pathStarted: false,
        path: null,
        swipeIntentAt: 0,
        swipeReady: false,
        rolling: null,
        modifier: null,
        keyboardModifier: null,
        releaseGuard: null,
        intent: {
            gesture: 'possible',
            committedAt: 0,
            possible: [],
            pruned: false
        },
        history: [],
        rect: null
    };
}

releaseKeyboardModifierForMultiTouch() {
    if (!this.session || !this.session.keyboardModifier) return;
    this.session.keyboardModifier.cancelled = true;
    this.session.keyboardModifier = null;
    if (!this.session.modifier) this.session.consumed = false;
}

updatePoint(id, input, event, raw) {
    const point = this.points.get(id);
    if (!point) return;
    point.previousX = point.x;
    point.previousY = point.y;
    point.previousClientX = point.clientX;
    point.previousClientY = point.clientY;
    point.previousPressure = point.pressure;
    point.x = input.x;
    point.y = input.y;
    point.clientX = input.clientX;
    point.clientY = input.clientY;
    point.screenX = input.screenX;
    point.screenY = input.screenY;
    point.pressure = input.pressure;
    point.tangentialPressure = input.tangentialPressure;
    point.tiltX = input.tiltX;
    point.tiltY = input.tiltY;
    point.twist = input.twist;
    point.width = input.width;
    point.height = input.height;
    point.time = this.time();
    if (raw && raw.target) point.target = raw.target;
    else if (event && event.target) point.target = event.target;
    this.updateRollingPoint(point);
}

endPoint(id, event, cancelled) {
    if (!this.session) return;
    const point = this.points.get(id);
    const rect = this.rect();
    const changedPointer = point ? this.exportPoint(point, rect) : null;
    const countBefore = this.points.size;

    if (cancelled) {
        this.points.delete(id);
        this.pointsDirty = true;
        if (!this.points.size) this.cancel('native', {
            originalEvent: event,
            changedPointer,
            added: 0,
            removed: 1,
            fingers: 0,
            activePointers: [],
            pointers: []
        });
        else {
            const detail = this.detail('fingers:change', { originalEvent: event, change: 'cancel', added: 0, removed: 1, changedPointer });
            this.emit('fingers:change', detail);
            this.emit('gesture:transition', Object.assign({}, detail, { gesture: 'topology' }));
        }
        return;
    }

    this.endKeyboardModifier(id, point, event);
    this.endModifier(id, point, event);
    this.endRollingPoint(id, this.time());
    const releaseDetail = this.detail('session:end', { originalEvent: event, changedPointer });
    this.resolvePathRelease(releaseDetail);

    if (countBefore > 1 && !this.session.consumed && this.isSwipe(releaseDetail)) {
        this.emitSwipe(releaseDetail);
    }

    this.points.delete(id);
    this.pointsDirty = true;

    if (this.points.size) {
        this.cancelPress('fingers:change');
        this.endRunningGestures(event);
        this.markReleaseGuard(countBefore);
        this.resetBasis(this.time());
        const detail = this.detail('fingers:change', { originalEvent: event, change: 'remove', added: 0, removed: 1, changedPointer });
        this.emit('fingers:change', detail);
        this.emit('gesture:transition', Object.assign({}, detail, { gesture: 'topology' }));
        return;
    }

    const endingDetail = this.detail('session:end', {
        originalEvent: event,
        changedPointer,
        added: 0,
        removed: 1,
        fingers: 0,
        activePointers: [],
        pointers: []
    });
    this.finishSession(event, endingDetail);
}

endRunningGestures(event) {
    if (!this.session) return;
    this.emitStartedEnds(event, null, true);
    this.emitModifierPanEnd('keyboardModifier', event, true);
    this.emitModifierPanEnd('modifier', event, true);
}

markReleaseGuard(countBefore) {
    if (!this.session || countBefore <= 1) return;
    const opt = this.options.intent || {};
    if (!opt.releaseGuard) return;
    const time = this.time();
    this.session.releaseGuard = {
        time,
        until: time + opt.releaseGuard,
        fromFingers: countBefore,
        points: this.pointList().map(point => ({
            id: point.id,
            x: point.x,
            y: point.y
        }))
    };
}

releaseGuardTravel() {
    const guard = this.session && this.session.releaseGuard;
    if (!guard) return 0;
    return guard.points.reduce((max, item) => {
        const point = this.points.get(item.id);
        if (!point) return max;
        return Math.max(max, hypot(point.x - item.x, point.y - item.y));
    }, 0);
}

releaseGuardActive() {
    const guard = this.session && this.session.releaseGuard;
    if (!guard) return false;
    const opt = this.options.intent || {};
    const time = this.time();
    const distance = opt.releaseDistance || 0;
    const guarded = time <= guard.until || this.releaseGuardTravel() <= distance;
    if (!guarded) this.session.releaseGuard = null;
    return guarded;
}

resolvePathRelease(detail) {
    const path = this.session && this.session.path;
    if (!path || !path.segments.length) return;
    this.handlePath(detail);
}

finishSession(event, endingDetail) {
    const session = this.session;
    if (!session) return;

    this.cancelPress('end', true);

    this.emitStartedEnds(event, null, false);

    const detail = this.detail('finish', { originalEvent: event });
    detail.releaseGuarded = this.releaseGuardActive();

    const swipeAfterPan = session.panStarted && this.options.swipe.allowAfterPan;

    if (!session.consumed && this.isRollingTap(detail)) {
        this.emitRollingTap(detail);
    } else if (!detail.releaseGuarded && (!session.consumed || swipeAfterPan) && this.isSwipe(detail)) {
        this.emitSwipe(detail);
    } else if (!session.consumed && this.isTap(detail)) {
        if (this.allowsGesture('tap')) this.emitTap(detail);
        else this.rememberLastTap(detail);
    } else if (session.tapHold && detail.elapsed > this.options.tapHold.maxRestTime) {
        this.tapMemory = null;
    }

    const endDetail = endingDetail || detail;
    this.emit('gesture:end', Object.assign({}, endDetail, { gesture: this.primaryGesture() }));
    this.emit('session:end', endDetail);
    this.session = null;
    this.releaseGestureStyles();
}
