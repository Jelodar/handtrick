setOptions(options) {
    if (this.destroyed) return this;
    const before = this.listenerKey();
    this.updateExplicitGestureToggles(options || {});
    this.options = merge(this.options, resolvePartialOptions(options || {}));
    const after = this.listenerKey();
    this.invalidateIntent();
    this.staticRect = null;
    if (before !== after) {
        this.cancel('rebind');
        this.unbindNative();
        this.pointerMode = this.resolveInputMode();
        this.bind();
    }
    this.releaseTargetStyles();
    if (this.enabled) this.applyTargetStyles();
    return this;
}

listenerKey() {
    const wheel = this.options.wheel || {};
    return [
        this.options.input,
        this.options.windowEvents,
        this.options.capture,
        this.options.mouse,
        this.options.touch,
        this.options.pen,
        wheel.enabled,
        wheel.preventDefault,
        this.resolveInputMode()
    ].join('|');
}

invalidateIntent() {
    this.intentCache = null;
    return this;
}

updateExplicitGestureToggles(options) {
    const scan = value => {
        if (!value) return;
        if (Array.isArray(value)) {
            value.forEach(scan);
            return;
        }
        if (typeof value === 'function' || typeof value === 'string') return;
        if (!isPlainObject(value)) return;
        Object.keys(value).forEach(key => {
            if (key === 'preset' || key === 'presets') {
                scan(value[key]);
                return;
            }
            if (!activatableRecognizers[key] || !isPlainObject(value[key]) || value[key].enabled === undefined) return;
            if (value[key].enabled === false) this.explicitGestureDisabled.add(key);
            else this.explicitGestureDisabled.delete(key);
        });
    };
    scan(normalizeOptionsInput(options));
}

activateListener(type) {
    this.listenerGestureGroups(type).forEach(group => {
        const opt = this.options && this.options[group];
        if (opt && opt.enabled === false && !this.explicitGestureDisabled.has(group)) opt.enabled = true;
    });
}

listenerGestureGroups(type) {
    const groups = new Set();
    const add = value => {
        const group = eventRecognizerGroup(value);
        if (group) groups.add(group);
    };
    if (!type || type === '*') return [];
    if (isSequencePatternEvent(type)) parseSequenceSelector(type).parsed.forEach(parsed => {
        const group = eventRecognizerGroup(parsed);
        if (group) groups.add(group);
    });
    else add(type);
    return Array.from(groups);
}

enable() {
    if (this.destroyed) return this;
    this.enabled = true;
    this.applyTargetStyles();
    return this;
}

resetTaps() {
    this.tapMemory = null;
    this.lastTap = null;
    return this;
}

resetSequences() {
    this.gestureSequence = [];
    this.clearPendingEmits();
    return this;
}

reset(options) {
    const opt = options || {};
    if (!options || opt.taps) this.resetTaps();
    if (!options || opt.sequences) this.resetSequences();
    return this;
}

disable() {
    if (this.destroyed) return this;
    this.enabled = false;
    this.cancel();
    this.releaseTargetStyles();
    return this;
}

destroy() {
    if (this.destroyed) return this;
    this.cancel('destroy');
    this.enabled = false;
    this.releaseTargetStyles();
    this.unbindNative();
    this.listeners.clear();
    this.onceWrappers.clear();
    this.tapMemory = null;
    this.lastTap = null;
    this.nativeTapMemory = null;
    this.gestureSequence = [];
    this.clearPendingEmits();
    this.intentCache = null;
    this.points.clear();
    this.pointCache = [];
    this.pointsDirty = true;
    this.session = null;
    this.staticRect = null;
    this.styles = { target: [], active: [] };
    this.domNative = { target: [], active: [] };
    this.explicitGestureDisabled.clear();
    this.destroyed = true;
    this.target = null;
    this.options = null;
    return this;
}

unbindNative() {
    this.native.forEach(item => item.target.removeEventListener(item.type, item.handler, item.options));
    this.native = [];
}

cancel(reason, extra) {
    if (this.session) {
        this.cancelPress(reason || 'cancel');
        this.emitStartedEnds(extra && extra.originalEvent, { reason: reason || 'cancel' }, false);
        this.emitModifierPanEnd('keyboardModifier', extra && extra.originalEvent, false);
        this.emitModifierPanEnd('modifier', extra && extra.originalEvent, false);
        const detail = this.detail('session:cancel', Object.assign({ reason: reason || 'cancel' }, extra || {}));
        this.emit('gesture:cancel', Object.assign({}, detail, { gesture: this.primaryGesture() }));
        this.emit('session:cancel', detail);
    }

    this.points.clear();
    this.pointsDirty = true;
    this.pointCache = [];
    this.session = null;
    this.releaseGestureStyles();
    return this;
}

emitStartedEnd(name, event, extra, reset) {
    if (!this.session) return;
    const flag = name + 'Started';
    if (!this.session[flag]) return;
    const endType = name + ':end';
    const detail = this.detail(endType, Object.assign({ originalEvent: event }, extra || {}));
    if (name === 'path') this.emitPathEnd(detail);
    else {
        this.emit(endType, detail);
        if ((name === 'pinch' || name === 'rotate') && this.session[name + 'Modified']) this.emit(name + ':mod:end', detail);
    }
    if (reset && name !== 'path') this.session[flag] = false;
}

emitStartedEnds(event, extra, reset) {
    ['pan', 'pinch', 'rotate', 'path'].forEach(name => this.emitStartedEnd(name, event, extra, reset));
}

emitModifierPanEnd(kind, event, reset) {
    const mod = this.session && this.session[kind];
    if (!mod || !mod.panStarted) return;
    const point = this.points.get(mod.actionId);
    const detail = kind === 'keyboardModifier' ? this.keyboardModifierDetail('pan:mod:end', event, point) : this.modifierDetail('pan:mod:end', event, point);
    this.emit('pan:mod:end', detail);
    if (reset) mod.panStarted = false;
}

getState() {
    return {
        destroyed: !!this.destroyed,
        enabled: this.enabled,
        active: !!this.session,
        fingers: this.points.size,
        session: this.session ? this.detail('state') : null
    };
}

getIntentState() {
    if (this.destroyed || !this.options) return { pruned: false, groups: null, events: null };
    const state = this.intentState();
    return {
        pruned: state.pruned,
        groups: state.groups ? Array.from(state.groups).sort() : null,
        events: this.options.intent && Array.isArray(this.options.intent.events) ? this.options.intent.events.map(normalizeEventType) : null
    };
}
