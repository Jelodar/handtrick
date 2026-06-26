bind() {
    if (this.pointerMode === 'pointer') {
        this.listen(this.target, 'pointerdown', this.bound.pointerdown, passiveOption(false));
        this.listen(this.eventRoot(), 'pointermove', this.bound.pointermove, passiveOption(false));
        this.listen(this.eventRoot(), 'pointerup', this.bound.pointerup, passiveOption(false));
        this.listen(this.eventRoot(), 'pointercancel', this.bound.pointercancel, passiveOption(false));
    } else if (this.pointerMode === 'touch') {
        this.bindTouch();
    } else if (this.pointerMode === 'mouse') {
        this.bindMouse();
    } else {
        this.bindTouch();
        this.bindMouse();
    }

    if (this.options.wheel.enabled) this.listen(this.target, 'wheel', this.bound.wheel, passiveOption(!this.options.wheel.preventDefault));
}

bindTouch() {
    this.listen(this.target, 'touchstart', this.bound.touchstart, passiveOption(false));
    this.listen(this.eventRoot(), 'touchmove', this.bound.touchmove, passiveOption(false));
    this.listen(this.eventRoot(), 'touchend', this.bound.touchend, passiveOption(false));
    this.listen(this.eventRoot(), 'touchcancel', this.bound.touchcancel, passiveOption(false));
}

bindMouse() {
    this.listen(this.target, 'mousedown', this.bound.mousedown, passiveOption(false));
    this.listen(this.eventRoot(), 'mousemove', this.bound.mousemove, passiveOption(false));
    this.listen(this.eventRoot(), 'mouseup', this.bound.mouseup, passiveOption(false));
}

listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this.native.push({ target, type, handler, options });
}

eventRoot() {
    if (!this.options.windowEvents) return this.target;
    if (this.target.ownerDocument && this.target.ownerDocument.defaultView) return this.target.ownerDocument.defaultView;
    return typeof window !== 'undefined' ? window : this.target;
}

listenerArgs(type, criteria, handler, options) {
    let phaseOptions = options || null;
    if (typeof criteria === 'function') {
        if (isPlainObject(handler)) phaseOptions = handler;
        handler = criteria;
        criteria = null;
    }
    if (typeof handler !== 'function') throw new TypeError('HandTrick handler must be a function');
    type = normalizeEventType(type);
    criteria = normalizeCriteria(criteria || null);
    const sequence = isSequencePatternEvent(type) ? parseSequenceSelector(type) : null;
    const parsed = sequence ? null : parseEventSelector(type);
    return {
        type,
        parsed,
        sequence,
        criteria: criteria || null,
        handler,
        phase: this.listenerPhase(type, phaseOptions && phaseOptions.phase)
    };
}

listenerPhase(type, phase) {
    const value = String(phase || '').toLowerCase();
    if (value === 'command' || value === 'observe' || value === 'intent' || value === 'update') return value;
    if (type === '*' || additiveEventTypes[type]) return 'observe';
    return 'command';
}

addListenerRecord(args) {
    const record = {
        type: args.type,
        criteria: args.criteria,
        handler: args.handler,
        phase: args.phase,
        parsed: args.parsed,
        sequence: args.sequence,
        order: ++this.listenerOrder
    };
    if (!this.listeners.has(record.type)) this.listeners.set(record.type, new Set());
    this.listeners.get(record.type).add(record);
    this.activateListener(record.type);
    this.invalidateIntent();
    return record;
}

on(type, criteria, handler, options) {
    if (this.destroyed) return this;
    this.addListenerRecord(this.listenerArgs(type, criteria, handler, options));
    return this;
}

once(type, criteria, handler, options) {
    if (this.destroyed) return this;
    const args = this.listenerArgs(type, criteria, handler, options);
    type = args.type;
    const original = args.handler;
    const wrap = detail => {
        this.off(type, original);
        original(detail);
    };
    if (!this.onceWrappers.has(type)) this.onceWrappers.set(type, new Map());
    this.onceWrappers.get(type).set(original, wrap);
    args.handler = wrap;
    this.addListenerRecord(args);
    return this;
}

off(type, handler) {
    if (this.destroyed) return this;
    if (!type) {
        this.listeners.clear();
        this.onceWrappers.clear();
        this.invalidateIntent();
        return this;
    }

    type = normalizeEventType(type);
    const set = this.listeners.get(type);
    if (!set) return this;
    if (handler) {
        const wraps = this.onceWrappers.get(type);
        const wrap = wraps && wraps.get(handler);
        Array.from(set).forEach(record => {
            if (record.handler === handler || record.handler === wrap) set.delete(record);
        });
        if (wraps) wraps.delete(handler);
    } else {
        set.clear();
        this.onceWrappers.delete(type);
    }
    this.invalidateIntent();
    return this;
}

command(type, criteria, handler) {
    return this.on(type, criteria, handler, { phase: 'command' });
}

observe(type, criteria, handler) {
    return this.on(type, criteria, handler, { phase: 'observe' });
}

listenerMatches(record, data, options) {
    if (!record) return false;
    if (options && options.phases && !options.phases.includes(record.phase)) return false;
    if (!(options && options.pathArbitrated) && this.pathCriteriaPatterns(record.criteria).length && data && data.type === 'path') return false;
    return this.recordCriteriaMatches(record, data);
}

recordCriteriaMatches(record, data) {
    return !record.criteria || HandTrick.matches(data, record.criteria);
}

runListenerRecord(record, data) {
    record.handler(data);
}

runListeners(type, data, options) {
    const set = this.listeners.get(type);
    if (!set) return;
    Array.from(set).forEach(record => {
        if (this.listenerMatches(record, data, options)) this.runListenerRecord(record, data);
    });
}

emit(type, detail, options) {
    if (this.destroyed) return detail || {};
    type = normalizeEventType(type);
    const data = Object.assign({}, detail || {}, { type });
    Object.defineProperty(data, 'instance', {
        value: this,
        enumerable: false,
        configurable: true
    });
    this.runListeners(type, data, options);
    this.runListeners('*', data, options);
    return data;
}
