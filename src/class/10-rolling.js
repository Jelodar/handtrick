keyboardRollingRole(detail) {
    const keyboardOpt = this.keyboardModifierOptions();
    if (!keyboardOpt || !detail || !detail.keyCombo) return null;
    const roles = keyboardOpt.roles || keyboardOpt.substitute || {};
    const combo = roles.rollingTap !== undefined ? roles.rollingTap : roles.rolling;
    if (!comboEquals(detail.keyCombo, combo)) return null;
    const keyboard = detail.keyboard || keyboardState(detail.originalEvent);
    const keys = keyboard && keyboard.keys ? keyboard.keys.slice() : [];
    return {
        role: 'rollingTap',
        combo: detail.keyCombo,
        keys,
        keyboard: Object.assign({}, keyboard, { keys })
    };
}

keyboardRollingWindow() {
    const opt = this.options.rolling || {};
    const delay = opt.keyboardMaxDelay !== undefined && opt.keyboardMaxDelay !== null ? opt.keyboardMaxDelay : this.options.tap.interval || opt.maxDelay || 0;
    return Math.max(0, delay);
}

rollingContactGeometry(points, opt, limits) {
    const canContinue = !!limits.canContinue;
    const delays = [];
    const maxDelay = limits.maxDelay !== undefined ? limits.maxDelay : opt.maxDelay;
    const maxGap = limits.maxGap !== undefined ? limits.maxGap : opt.maxGap;
    const minSpan = limits.minSpan !== undefined ? limits.minSpan : opt.minSpan;
    const minStep = limits.minStep !== undefined ? limits.minStep : opt.minStep;

    for (let index = 1; index < points.length; index++) {
        const delay = points[index].downTime - points[index - 1].downTime;
        delays.push(delay);
        if (delay < opt.minDelay || delay > maxDelay) return null;
    }

    const first = points[0];
    const last = points[points.length - 1];
    const totalX = last.x - first.x;
    const totalY = last.y - first.y;
    const absX = abs(totalX);
    const absY = abs(totalY);
    const axis = absX >= absY * opt.directionRatio ? 'x' : absY >= absX * opt.directionRatio ? 'y' : 'none';
    if (axis === 'none') return canContinue ? { possible: true } : null;

    const direction = axis === 'x' ? totalX > 0 ? 'right' : 'left' : totalY > 0 ? 'down' : 'up';
    const span = axis === 'x' ? absX : absY;
    if (span < minSpan) return canContinue ? { possible: true } : null;

    const gaps = [];
    for (let index = 1; index < points.length; index++) {
        const previous = points[index - 1];
        const point = points[index];
        const dx = point.x - previous.x;
        const dy = point.y - previous.y;
        const axisDelta = axis === 'x' ? dx : dy;
        const offAxis = abs(axis === 'x' ? dy : dx);
        const gap = hypot(dx, dy);
        gaps.push(gap);
        if (gap > maxGap) return null;
        if (abs(axisDelta) < minStep) return null;
        if ((axisDelta > 0) !== (axis === 'x' ? totalX > 0 : totalY > 0)) return null;
        if (offAxis > Math.max(minStep, abs(axisDelta) * opt.offAxisRatio)) return null;
    }

    return {
        ready: true,
        possible: canContinue,
        source: limits.source || 'pointer',
        count: points.length,
        direction,
        axis,
        delays,
        gaps,
        span,
        duration: (last.upTime === null || last.upTime === undefined ? last.downTime : last.upTime) - first.downTime,
        maxMove: points.reduce((max, point) => Math.max(max, point.maxMove || 0), 0),
        overlapCount: limits.overlaps ? limits.overlaps.length : 0,
        overlaps: limits.overlaps ? limits.overlaps.map(item => Object.assign({}, item)) : [],
        points: points.map(point => ({
            id: point.id,
            downTime: point.downTime,
            upTime: point.upTime === undefined ? null : point.upTime,
            x: point.x,
            y: point.y,
            clientX: point.clientX,
            clientY: point.clientY
        }))
    };
}

tapRollingGeometry(taps, opt, limits) {
    const idPrefix = limits.idPrefix || 'tap-';
    const points = taps.map((tap, index) => ({
        id: idPrefix + (index + 1),
        downTime: tap.time,
        upTime: tap.time,
        x: tap.center.pageX,
        y: tap.center.pageY,
        clientX: tap.center.clientX,
        clientY: tap.center.clientY,
        maxMove: 0
    }));
    return this.rollingContactGeometry(points, opt, limits);
}

keyboardRollingTapData(detail, sequence) {
    const opt = this.options.rolling;
    if (!this.allowsGesture('rolling')) return null;
    if (!opt || !opt.enabled || !sequence || !sequence.taps || !sequence.taps.length) return null;

    const role = this.keyboardRollingRole(detail);
    if (!role) return null;

    const counts = toArray(opt.fingers).filter(value => value >= 2 && value <= 4).sort((a, b) => a - b);
    const maxCount = counts[counts.length - 1] || 0;
    const count = sequence.count;
    if (!maxCount || count > maxCount) return null;
    if (!sequence.taps.every(tap => comboEquals(tap.keyCombo, role.combo))) return null;
    if (count < counts[0]) return { possible: true, role };
    if (!counts.includes(count)) return count < maxCount ? { possible: true, role } : null;

    const taps = sequence.taps.slice(-count);
    const rolling = this.tapRollingGeometry(taps, opt, {
        maxDelay: this.keyboardRollingWindow(),
        maxGap: opt.maxGap,
        canContinue: count < maxCount,
        idPrefix: 'keyboard-',
        source: 'keyboard'
    });
    if (!rolling) return null;
    return Object.assign(rolling, {
        role,
        count
    });
}

rollingPayload(rolling, extra) {
    const opt = extra || {};
    const keyboard = opt.keyboard ? copyKeyboardState(opt.keyboard) : rolling.keyboard ? copyKeyboardState(rolling.keyboard) : null;
    const payload = {
        source: opt.source || rolling.source || 'pointer',
        count: rolling.count,
        direction: rolling.direction,
        axis: rolling.axis,
        delays: rolling.delays.slice(),
        gaps: rolling.gaps.slice(),
        span: rolling.span,
        duration: rolling.duration,
        maxMove: rolling.maxMove,
        overlapCount: rolling.overlapCount || 0,
        overlaps: rolling.overlaps ? rolling.overlaps.map(item => Object.assign({}, item)) : [],
        points: rolling.points.map(point => Object.assign({}, point))
    };
    if (keyboard) payload.keyboard = keyboard;
    return payload;
}

rollingEvents(rolling, detail) {
    return [
        { type: 'rolling', detail },
        { type: 'rolling:' + rolling.direction, detail }
    ];
}

emitKeyboardRollingTap(detail, rolling) {
    if (!rolling || !rolling.ready) return false;
    this.clearPendingEmits();
    const keyboard = copyKeyboardState(rolling.role.keyboard);
    const keys = keyboard ? keyboard.keys.slice() : [];
    const keyboardSubstitute = {
        role: rolling.role.role,
        fingers: rolling.count,
        combo: rolling.role.combo,
        keys: keys.slice(),
        keyboard
    };
    const rollingPayload = this.rollingPayload(rolling, { source: 'keyboard', keyboard });
    const rollingDetail = Object.assign({}, detail, {
        fingers: rolling.count,
        syntheticFingers: rolling.count,
        fingerSource: 'keyboard',
        maxFingers: Math.max(detail.maxFingers || 0, rolling.count),
        keyboardSubstitute,
        direction: rolling.direction,
        axis: rolling.axis,
        rolling: rollingPayload,
        rollingCount: rolling.count,
        rollingDirection: rolling.direction,
        topology: Object.assign({}, detail.topology || {}, {
            total: rolling.count,
            actual: detail.actualFingers,
            max: Math.max(detail.topology && detail.topology.max || 0, rolling.count)
        })
    });

    this.session.maxFingers = Math.max(this.session.maxFingers || 0, rolling.count);
    this.session.consumed = true;
    const events = this.rollingEvents(rolling, rollingDetail);
    this.dispatchCommittedEvents('rolling:' + rolling.direction, rollingDetail, 1, events, rolling.possible ? this.keyboardRollingWindow() : undefined);
    return true;
}

emitTap(detail) {
    const sequence = this.tapSequence(detail);
    const count = sequence.count;
    const tapDetail = Object.assign({}, detail, {
        tapCount: count,
        sequence: sequence.names,
        tapSequence: sequence
    });
    const keyboardRolling = this.keyboardRollingTapData(tapDetail, sequence);

    if (count > 1) this.clearPendingEmits();

    if (keyboardRolling && keyboardRolling.ready) {
        this.emitKeyboardRollingTap(tapDetail, keyboardRolling);
        this.rememberLastTap(detail);
        return;
    }

    const countType = 'tap:' + count + 'x';
    const events = [
        { type: 'tap', detail: tapDetail },
        { type: countType, detail: tapDetail },
        { type: 'tap:sequence', detail: tapDetail }
    ];
    if (count > 1) events.push({ type: 'tap:multi', detail: tapDetail });

    if (keyboardRolling && keyboardRolling.possible) {
        this.queueDirectEmits(events, this.keyboardRollingWindow());
        this.rememberLastTap(detail);
        return;
    }

    const sequenceState = this.commit(countType, tapDetail, 1);
    if (sequenceState.matched) {
        this.rememberLastTap(detail);
        return;
    }
    if (sequenceState.possible || this.hasCompetingTapCommand(count)) this.queueDirectEmits(events, this.options.tap.interval);
    else this.emitDirectEmits(events);

    this.rememberLastTap(detail);
}

hasCompetingTapCommand(count) {
    let found = false;
    this.listeners.forEach((set, type) => {
        if (found || !set || !set.size) return;
        const hasCommand = Array.from(set).some(record => record.phase === 'command');
        if (!hasCommand) return;
        if (isSequencePatternEvent(type)) {
            const pattern = sequencePattern(type);
            if (pattern.some(matcher => matcher.family === 'tap' && matcher.mode !== 'mod' && (pattern.length > 1 || matcher.tapCount === null || matcher.tapCount > count))) found = true;
            return;
        }
        const parsed = parseEventSelector(type);
        if (!parsed.valid || parsed.family !== 'tap' || parsed.mode === 'mod') return;
        if (parsed.mode === 'multi' && count < 2) found = true;
        if (parsed.count !== null && count < parsed.count) found = true;
    });
    return found;
}

rememberLastTap(detail) {
    if (detail.fingers === 1) this.lastTap = {
        time: this.time(),
        x: detail.center.x,
        y: detail.center.y,
        pageX: detail.center.pageX,
        pageY: detail.center.pageY,
        clientX: detail.center.clientX,
        clientY: detail.center.clientY
    };
}

tapSequence(detail) {
    const time = this.time();
    let taps = [];
    const memory = this.tapMemory;
    if (
        memory &&
        memory.fingers === detail.fingers &&
        time - memory.time <= this.options.tap.interval &&
        pointDistance(memory.center, detail.center) <= this.options.tap.distance
    ) {
        taps = memory.taps.slice();
    }

    taps.push({
        time,
        elapsed: detail.elapsed,
        fingers: detail.fingers,
        center: detail.center,
        target: detail.target,
        keys: detail.keys ? detail.keys.slice() : [],
        keyCombo: detail.keyCombo || '',
        keyboard: copyKeyboardState(detail.keyboard),
        keyboardSubstitute: copyKeyboardSubstitute(detail.keyboardSubstitute)
    });

    const data = {
        time,
        count: taps.length,
        fingers: detail.fingers,
        center: detail.center,
        startedAt: taps[0].time,
        duration: time - taps[0].time,
        names: taps.map(() => 'tap'),
        taps
    };

    this.tapMemory = data;
    return data;
}

isTap(detail) {
    if (!this.options.tap.enabled) return false;
    if (detail.tapHold && detail.elapsed > this.options.tapHold.maxRestTime) return false;
    if (detail.elapsed > this.options.tap.maxTime) return false;
    if (detail.travel > this.options.tap.maxMove) return false;
    return true;
}

isSwipe(detail) {
    const opt = this.options.swipe;
    if (!this.allowsGesture('swipe')) return false;
    if (detail.releaseGuarded) return false;
    if (!opt.enabled || detail.tapHold || detail.direction === 'none') return false;
    if (!this.intentReady(detail, opt, 'swipe')) return false;
    const min = opt.distanceByFingers[detail.fingers] || opt.distance;
    if (detail.travel >= min) return true;
    return this.session.swipeReady && detail.velocity >= opt.velocity;
}

createRollingState(id, point, time) {
    return {
        cancelled: false,
        points: [this.rollingPoint(id, point, time)]
    };
}

rollingPoint(id, point, time) {
    return {
        id,
        downTime: time,
        upTime: null,
        startX: point.x,
        startY: point.y,
        x: point.x,
        y: point.y,
        clientX: point.clientX,
        clientY: point.clientY,
        maxMove: 0
    };
}

addRollingPoint(id, point, time) {
    const roll = this.session && this.session.rolling;
    if (!roll || roll.cancelled) return;
    if (roll.points.length >= 4) {
        roll.cancelled = true;
        return;
    }
    roll.points.push(this.rollingPoint(id, point, time));
}

updateRollingPoint(point) {
    const roll = this.session && this.session.rolling;
    if (!roll || roll.cancelled || !point) return;
    const item = roll.points.find(entry => entry.id === point.id);
    if (!item) return;
    item.x = point.x;
    item.y = point.y;
    item.clientX = point.clientX;
    item.clientY = point.clientY;
    item.maxMove = Math.max(item.maxMove, hypot(point.x - item.startX, point.y - item.startY));
    if (item.maxMove > this.options.rolling.maxMove) roll.cancelled = true;
}

endRollingPoint(id, time) {
    const roll = this.session && this.session.rolling;
    if (!roll || roll.cancelled) return;
    const item = roll.points.find(entry => entry.id === id);
    if (item && item.upTime === null) item.upTime = time;
}

isRollingTap(detail) {
    return !!this.rollingTapData(detail);
}

rollingLimit(opt, key, count) {
    const map = opt[key + 'ByFingers'];
    if (map && map[count] !== undefined && map[count] !== null) return map[count];
    return opt[key];
}

rollingOverlaps(points, nowTime) {
    const overlaps = [];
    for (let a = 0; a < points.length; a++) {
        for (let b = a + 1; b < points.length; b++) {
            const first = points[a];
            const second = points[b];
            const startedAt = Math.max(first.downTime, second.downTime);
            const endedAt = Math.min(first.upTime === null ? nowTime : first.upTime, second.upTime === null ? nowTime : second.upTime);
            const duration = endedAt - startedAt;
            if (duration > 0) overlaps.push({
                a: first.id,
                b: second.id,
                duration,
                startedAt,
                endedAt
            });
        }
    }
    return overlaps;
}

rollingTapData(detail) {
    const opt = this.options.rolling;
    const roll = this.session && this.session.rolling;
    if (!this.allowsGesture('rolling')) return null;
    if (!opt || !opt.enabled || !roll || roll.cancelled) return null;
    const points = roll.points.slice();
    const count = points.length;
    if (!toArray(opt.fingers).includes(count)) return null;
    const maxDelay = this.rollingLimit(opt, 'maxDelay', count);
    const maxHold = this.rollingLimit(opt, 'maxHold', count);
    const maxGap = this.rollingLimit(opt, 'maxGap', count);
    const maxTotal = Math.max(this.options.tap.maxTime, maxHold + maxDelay * Math.max(0, count - 1));
    if (detail.totalElapsed > maxTotal) return null;

    const nowTime = this.time();
    for (let index = 0; index < points.length; index++) {
        const point = points[index];
        const hold = (point.upTime === null ? nowTime : point.upTime) - point.downTime;
        if (hold > maxHold) return null;
        if (point.maxMove > opt.maxMove) return null;
        if (index > 0) {
            const previousUp = points[index - 1].upTime;
            if (previousUp !== null && point.downTime >= previousUp) return null;
        }
    }

    const overlaps = this.rollingOverlaps(points, nowTime);
    if (!overlaps.length) return null;
    const contacts = points.map(point => ({
        id: point.id,
        downTime: point.downTime,
        upTime: point.upTime,
        x: point.startX,
        y: point.startY,
        clientX: point.clientX,
        clientY: point.clientY,
        maxMove: point.maxMove
    }));
    const rolling = this.rollingContactGeometry(contacts, opt, {
        maxDelay,
        maxGap,
        overlaps,
        source: 'pointer'
    });
    if (!rolling) return null;
    return Object.assign(rolling, {
        count,
        points: points.map(point => ({
            id: point.id,
            downTime: point.downTime,
            upTime: point.upTime,
            x: point.startX,
            y: point.startY,
            clientX: point.clientX,
            clientY: point.clientY
        }))
    });
}

emitRollingTap(detail) {
    const rolling = this.rollingTapData(detail);
    if (!rolling) return false;
    const rollingDetail = Object.assign({}, detail, {
        direction: rolling.direction,
        axis: rolling.axis,
        rolling: this.rollingPayload(rolling, { source: 'pointer' }),
        rollingCount: rolling.count,
        rollingDirection: rolling.direction
    });
    if (this.options.rolling.consumesTap !== false) this.session.consumed = true;
    const events = this.rollingEvents(rolling, rollingDetail);
    this.dispatchCommittedEvents('rolling:' + rolling.direction, rollingDetail, 1, events);
    return true;
}

isTapHoldStart(point, time) {
    const opt = this.options.tapHold;
    if (!opt.enabled || !this.lastTap) return false;
    if (time - this.lastTap.time > opt.window) return false;
    return hypot(point.clientX - this.lastTap.clientX, point.clientY - this.lastTap.clientY) <= opt.distance;
}

isTapChainStart(point, time) {
    const opt = this.options.tap;
    if (!opt.enabled || !this.lastTap) return false;
    if (time - this.lastTap.time > opt.interval) return false;
    return hypot(point.clientX - this.lastTap.clientX, point.clientY - this.lastTap.clientY) <= opt.distance;
}

armPress(event) {
    const opt = this.options.press;
    if (!this.allowsGesture('press')) return;
    if (!opt.enabled || !opt.delay) return;

    clearTimeout(this.session.pressTimer);
    this.session.pressTimer = setTimeout(() => {
        if (!this.session || this.session.moved || this.session.consumed) return;
        this.session.pressStarted = true;
        if (opt.consumesTap !== false) this.session.consumed = true;
        const detail = this.detail('press:start', { originalEvent: event });
        this.commit('press', detail, 1);
        this.emit('press:start', detail);
        this.emit('press', detail);

        if (opt.repeat > 0) {
            this.session.pressRepeatTimer = setInterval(() => {
                if (!this.session || !this.session.pressStarted) return;
                this.emit('press', this.detail('press', { originalEvent: event, repeat: true }));
            }, opt.repeat);
        }
    }, opt.delay);
}
