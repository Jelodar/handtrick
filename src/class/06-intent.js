processMove(event) {
    if (!this.session || !this.points.size) return;
    const detail = this.detail('session:move', { originalEvent: event });
    const releaseGuarded = this.releaseGuardActive();
    detail.releaseGuarded = releaseGuarded;
    this.session.maxFingers = Math.max(this.session.maxFingers, detail.fingers);
    this.session.maxActualFingers = Math.max(this.session.maxActualFingers || 0, detail.actualFingers || this.points.size);
    this.session.center = detail.center;
    this.session.moved = this.session.moved || detail.travel > this.options.tap.maxMove;
    this.emit('session:move', detail);
    this.emit('gesture:update', Object.assign({}, detail, { gesture: this.primaryGesture() }));

    if (this.options.pressure.enabled && abs(detail.pressureDelta) >= this.options.pressure.threshold) {
        this.emit('pressure:change', detail);
    }

    if (!this.session.pressStarted && detail.travel > this.options.press.move) this.cancelPress('move');
    if (this.session.pressStarted) this.emit('press:move', detail);

    const keyboardModifierActive = this.handleKeyboardModifierMove(event);
    if (releaseGuarded) {
        this.advanceMove(detail);
        return;
    }

    if (keyboardModifierActive) {
        this.advanceMove(detail);
        return;
    }

    this.handleModifierMove(event);
    this.handlePinch(detail);
    this.handleRotate(detail);
    this.handlePan(detail);
    this.handlePath(detail);
    this.handleSwipeIntent(detail);
    this.advanceMove(detail);
}

advanceMove(detail) {
    this.recordHistory(detail);
    this.session.previousCenter = detail.center;
    this.session.previousDistance = detail.distance;
    this.session.previousAngle = detail.angle;
    this.session.previousVelocity = detail.velocity;
    this.session.previousPressure = detail.pressure;
    this.session.lastMoveTime = this.time();
}

primaryGesture() {
    if (!this.session) return 'none';
    if (this.session.rotateStarted) return 'rotate';
    if (this.session.pinchStarted) return 'pinch';
    if (this.session.panStarted) return 'pan';
    if (this.session.pathStarted) return 'path';
    if (this.session.pressStarted) return 'press';
    if (this.session.keyboardModifier && this.session.keyboardModifier.panStarted) return 'pan:mod';
    if (this.session.modifier && this.session.modifier.panStarted) return 'pan:mod';
    return 'session';
}

intentState() {
    const opt = this.options.intent || {};
    if (!opt.enabled || !opt.prune) return { pruned: false, groups: null };
    if (this.intentCache) return this.intentCache;

    const groups = new Set();
    const add = type => {
        if (isPathPatternEvent(type)) {
            groups.add('path');
            return;
        }
        if (isSequencePatternEvent(type)) {
            parseSequenceSelector(type).parsed.forEach(parsed => {
                const gesture = eventRecognizerGroup(parsed);
                if (gesture) groups.add(gesture);
            });
            return;
        }
        const gesture = eventRecognizerGroup(type);
        if (gesture) groups.add(gesture);
    };
    const explicit = Array.isArray(opt.events);

    if (explicit) {
        opt.events.forEach(add);
    }

    if (opt.useListeners !== false) {
        this.listeners.forEach((set, type) => {
            if (!set || !set.size || type === '*') return;
            add(type);
        });
    }

    this.intentCache = {
        pruned: explicit || groups.size > 0,
        groups
    };
    return this.intentCache;
}

allowsGesture(gesture) {
    const state = this.intentState();
    return !state.pruned || state.groups.has(gesture);
}

possibleGestures(detail) {
    const out = [];
    motionCandidateRecognizers.forEach(gesture => {
        if (!this.allowsGesture(gesture)) return;
        const opt = this.options[gesture];
        if (!opt || !opt.enabled) return;
        if (gesture === 'pan' && !toArray(opt.fingers).includes(detail.fingers)) return;
        if ((gesture === 'pinch' || gesture === 'rotate') && detail.fingers !== 2) return;
        out.push(gesture);
    });
    if (this.allowsGesture('tap') && this.options.tap.enabled) out.push('tap');
    if (this.allowsGesture('press') && this.options.press.enabled) out.push('press');
    if (this.allowsGesture('path') && this.options.path.enabled && toArray(this.options.path.fingers).includes(detail.fingers)) out.push('path');
    if (this.allowsGesture('rolling') && this.options.rolling.enabled && toArray(this.options.rolling.fingers).includes(detail.fingers)) out.push('rolling');
    if (this.allowsGesture('modifier') && this.options.modifier.enabled) out.push('modifier');
    return out;
}

continuousCandidates(detail) {
    return motionCandidateRecognizers.filter(gesture => {
        if (!this.allowsGesture(gesture)) return false;
        const opt = this.options[gesture];
        if (!opt || !opt.enabled) return false;
        if (gesture === 'pan') return toArray(opt.fingers).includes(detail.fingers);
        if (gesture === 'swipe') return detail.direction !== 'none';
        return detail.fingers === 2;
    });
}

claim(detail, confidence) {
    const opt = this.options.claim;
    if (!this.session || !opt.enabled || this.session.claimed) return;
    if (confidence < opt.threshold) return;
    this.session.claimed = true;
    if (opt.preventDefault) detail.preventDefault();
    if (opt.stopPropagation) detail.stopPropagation();
}

commit(gesture, detail, confidence) {
    if (!this.session) return { matched: false, possible: false };
    this.claim(detail, confidence);
    if (this.session.commits[gesture]) return { matched: false, possible: false };
    this.session.commits[gesture] = true;
    this.session.intent.gesture = gesture;
    this.session.intent.committedAt = this.time();
    this.emit('gesture:commit', Object.assign({}, detail, { gesture, confidence }));
    return this.recordGestureSequence(gesture, detail, confidence);
}

dispatchCommittedEvents(gesture, detail, confidence, events, delay) {
    const sequence = this.commit(gesture, detail, confidence);
    if (sequence.matched) return sequence;
    if (sequence.possible || delay !== undefined) this.queueDirectEmits(events, delay);
    else this.emitDirectEmits(events);
    return sequence;
}

recordGestureSequence(gesture, detail, confidence) {
    const opt = this.options.intent || {};
    const time = this.time();
    const windowTime = opt.sequenceWindow || 0;
    const max = Math.max(1, opt.sequenceMax || 1);
    const last = this.gestureSequence[this.gestureSequence.length - 1];
    const parsed = parseEventSelector(gesture);
    const baseGesture = eventRecognizerGroup(parsed) || parsed.family || gesture;

    if (last && windowTime && time - last.time > windowTime) this.gestureSequence = [];

    this.gestureSequence.push({
        event: gesture,
        gesture: baseGesture,
        family: parsed.family,
        mode: parsed.mode,
        state: parsed.state,
        time,
        fingers: parsed.fingers !== null ? parsed.fingers : detail.fingers,
        actualFingers: detail.actualFingers,
        syntheticFingers: detail.syntheticFingers,
        fingerSource: detail.fingerSource,
        keyboardRole: detail.keyboardSubstitute && detail.keyboardSubstitute.role || '',
        keys: detail.keys ? detail.keys.slice() : [],
        keyCombo: detail.keyCombo || '',
        direction: detail.direction,
        tapCount: detail.tapCount || 0,
        center: detail.center
    });
    while (this.gestureSequence.length > max) this.gestureSequence.shift();

    return this.resolveGestureSequence(gesture, detail, confidence, time);
}

resolveGestureSequence(gesture, detail, confidence, time) {
    const matches = [];
    let possible = false;
    let order = 0;

    this.listeners.forEach((set, type) => {
        if (!set || !set.size || !isSequencePatternEvent(type)) return;
        const records = Array.from(set).filter(record => record.phase === 'command');
        if (!records.length) return;
        const rawTokens = sequenceTokens(type);
        const pattern = sequencePattern(rawTokens);
        if (!pattern.length) return;
        const matched = pattern.length <= this.gestureSequence.length && this.sequenceMatchesAt(pattern, this.gestureSequence.length - pattern.length);
        const canContinue = this.sequenceCanContinue(pattern);
        if (canContinue) possible = true;
        if (!matched) {
            order++;
            return;
        }
        const start = this.gestureSequence.length - pattern.length;
        const sequence = this.gestureSequence.slice(start).map(item => Object.assign({}, item));
        records.forEach(record => {
            const sequenceDetail = Object.assign({}, detail, {
                gesture,
                confidence,
                sequence: pattern.map(item => item.token),
                gestureSequence: {
                    type,
                    pattern: rawTokens,
                    gestures: sequence,
                    startedAt: sequence[0].time,
                    endedAt: time,
                    duration: time - sequence[0].time,
                    resolution: 'exclusive'
                }
            });
            const eventData = Object.assign({}, sequenceDetail, { type });
            if (!this.listenerMatches(record, eventData)) return;
            matches.push({
                type,
                rawTokens,
                pattern,
                sequence,
                order: record.order,
                specificity: this.sequenceSpecificity(pattern) + this.criteriaSpecificity(record.criteria),
                detail: sequenceDetail,
                record
            });
        });
        order++;
    });

    matches.sort((a, b) => b.pattern.length - a.pattern.length || b.specificity - a.specificity || a.order - b.order);
    const best = matches[0] || null;

    if (best) {
        this.clearPendingEmits();
        this.emit(best.type, best.detail, { phases: ['observe', 'intent', 'update'] });
        this.emitCommandRecord(best.record, best.type, best.detail);
        return { matched: true, possible, type: best.type };
    }

    if (!possible) this.flushPendingEmits();
    return { matched: false, possible };
}

sequenceMatchesAt(pattern, start) {
    if (start < 0) return false;
    return pattern.every((matcher, index) => this.sequenceItemMatches(this.gestureSequence[start + index], matcher));
}

sequenceCanContinue(pattern) {
    const max = Math.min(pattern.length - 1, this.gestureSequence.length);
    for (let length = max; length > 0; length--) {
        const start = this.gestureSequence.length - length;
        let matched = true;
        for (let index = 0; index < length; index++) {
            if (!this.sequenceItemMatches(this.gestureSequence[start + index], pattern[index])) {
                matched = false;
                break;
            }
        }
        if (matched) return true;
    }
    return false;
}

sequenceItemMatches(item, matcher) {
    if (!item || !matcher) return false;
    const token = matcher.token;
    if (item.gesture !== token && item.event !== token) return false;
    if (matcher.mode && matcher.mode !== 'sequence' && matcher.mode !== 'multi' && item.mode !== matcher.mode) return false;
    if (matcher.state && item.state !== matcher.state) return false;
    if (matcher.tapCount !== null && item.tapCount !== matcher.tapCount) return false;
    if (matcher.multiTap && item.tapCount < 2) return false;
    if (matcher.direction && item.direction !== matcher.direction) return false;
    if (matcher.fingers !== null && item.fingers !== matcher.fingers) return false;
    return true;
}

sequenceSpecificity(pattern) {
    return pattern.reduce((score, matcher) => {
        return score + (matcher.specificity || 100);
    }, 0);
}

criteriaSpecificity(criteria) {
    if (!criteria || !isPlainObject(criteria)) return 0;
    return Object.keys(criteria).reduce((score, key) => {
        const value = criteria[key];
        if (value === undefined || value === null) return score;
        if (Array.isArray(value)) return score + Math.max(1, 4 - value.length);
        if (isPlainObject(value)) return score + 2 + Object.keys(value).length;
        return score + 2;
    }, 0);
}

criteriaKey(criteria) {
    if (!criteria || !isPlainObject(criteria)) return '';
    return this.criteriaValueKey(criteria);
}

criteriaValueKey(value) {
    if (Array.isArray(value)) return '[' + value.map(item => this.criteriaValueKey(item)).sort().join('|') + ']';
    if (isPlainObject(value)) {
        return '{' + Object.keys(value).sort().map(key => {
            const item = value[key];
            if (item === undefined || item === null) return '';
            return key + ':' + this.criteriaValueKey(item);
        }).filter(Boolean).join('|') + '}';
    }
    return typeof value + ':' + String(value);
}

eventSpecificity(type, detail) {
    if (isSequencePatternEvent(type)) return 1000 + this.sequenceSpecificity(sequencePattern(type));
    return selectorSpecificity(parseEventSelector(type));
}

commandCandidates(items) {
    const out = [];
    (items || []).forEach((item, itemIndex) => {
        const type = normalizeEventType(item.type);
        const detail = item.detail || {};
        if (item.record) {
            const data = Object.assign({}, detail, { type });
            const record = item.record;
            if (record.phase === 'command' && this.listenerMatches(record, data, { pathArbitrated: true })) {
                out.push({
                    record,
                    type,
                    detail,
                    itemIndex,
                    specificity: this.eventSpecificity(type, detail) + this.criteriaSpecificity(record.criteria),
                    criteriaKey: this.criteriaKey(record.criteria)
                });
            }
            return;
        }
        const set = this.listeners.get(type);
        if (!set) return;
        const data = Object.assign({}, detail, { type });
        Array.from(set).forEach(record => {
            if (record.phase !== 'command' || !this.listenerMatches(record, data)) return;
            out.push({
                record,
                type,
                detail,
                itemIndex,
                specificity: this.eventSpecificity(type, detail) + this.criteriaSpecificity(record.criteria),
                criteriaKey: this.criteriaKey(record.criteria)
            });
        });
    });
    return out;
}

emitCommandRecord(record, type, detail) {
    const data = this.emit(type, detail, { phases: [] });
    this.runListenerRecord(record, data);
    return data;
}

emitCommandWinner(items) {
    const candidates = this.commandCandidates(items);
    if (!candidates.length) return null;
    candidates.sort((a, b) => b.specificity - a.specificity || b.itemIndex - a.itemIndex || a.record.order - b.record.order);
    const winner = candidates[0];
    candidates.filter(item => (
        item.type === winner.type &&
        item.specificity === winner.specificity &&
        item.criteriaKey === winner.criteriaKey
    )).sort((a, b) => a.record.order - b.record.order).forEach(item => {
        this.emitCommandRecord(item.record, item.type, item.detail);
    });
    return winner;
}

emitObservedItems(items) {
    (items || []).forEach(item => {
        this.emit(item.type, item.detail, { phases: ['observe', 'intent', 'update'] });
    });
}

queueDirectEmits(items, delay) {
    if (!items || !items.length || this.destroyed) return;
    this.emitObservedItems(items);
    this.pendingEmits = this.pendingEmits.concat(items.map(item => ({
        type: item.type,
        detail: item.detail,
        observed: true
    })));
    this.schedulePendingEmits(delay);
}

emitDirectEmits(items) {
    if (!items || !items.length) return;
    const fresh = items.filter(item => !item.observed);
    if (fresh.length) this.emitObservedItems(fresh);
    this.emitCommandWinner(items);
}

schedulePendingEmits(delay) {
    if (this.pendingEmitTimer) clearTimeout(this.pendingEmitTimer);
    const wait = delay !== undefined ? Math.max(0, delay) : Math.max(0, (this.options.intent && this.options.intent.sequenceWindow) || 0);
    if (!wait) {
        this.flushPendingEmits();
        return;
    }
    this.pendingEmitTimer = setTimeout(() => this.flushPendingEmits(), wait);
}

clearPendingEmits() {
    if (this.pendingEmitTimer) clearTimeout(this.pendingEmitTimer);
    this.pendingEmitTimer = null;
    this.pendingEmits = [];
}

flushPendingEmits() {
    if (!this.pendingEmits || !this.pendingEmits.length) {
        if (this.pendingEmitTimer) clearTimeout(this.pendingEmitTimer);
        this.pendingEmitTimer = null;
        return;
    }
    if (this.pendingEmitTimer) clearTimeout(this.pendingEmitTimer);
    this.pendingEmitTimer = null;
    const pending = this.pendingEmits.slice();
    this.pendingEmits = [];
    this.emitDirectEmits(pending);
}
