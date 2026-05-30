styleDocument() {
    if (this.target.ownerDocument) return this.target.ownerDocument;
    return typeof document !== 'undefined' ? document : null;
}

rememberStyle(group, element, prop, value) {
    if (!element || !element.style || value === false || value === null || value === undefined) return;
    let props = styleMemory.get(element);
    if (!props) {
        props = new Map();
        styleMemory.set(element, props);
    }
    let state = props.get(prop);
    if (!state) {
        state = { value: element.style[prop], count: 0 };
        props.set(prop, state);
    }
    state.count++;
    group.push({ element, prop });
    element.style[prop] = value;
}

applyTargetStyles() {
    const opt = this.options.dom;
    if (!opt || !opt.enabled || !opt.target || this.styles.target.length) return;
    const elements = [this.target];
    this.applyStyleSet(this.styles.target, elements, opt);
    this.bindDomSuppression(this.domNative.target, elements, opt, false);
}

releaseTargetStyles() {
    this.unbindDomSuppression(this.domNative.target);
    this.restoreStyleSet(this.styles.target);
}

activateGestureStyles() {
    const opt = this.options.dom;
    if (!opt || !opt.enabled || !opt.active || this.styles.active.length) return;
    const doc = this.styleDocument();
    const elements = [];
    if (doc && doc.documentElement) elements.push(doc.documentElement);
    if (doc && doc.body) elements.push(doc.body);
    this.applyStyleSet(this.styles.active, elements, opt);
    this.bindDomSuppression(this.domNative.active, elements, opt, true);
}

releaseGestureStyles() {
    this.unbindDomSuppression(this.domNative.active);
    this.restoreStyleSet(this.styles.active);
}

applyStyleSet(group, elements, opt) {
    elements.forEach(element => {
        this.rememberStyle(group, element, 'touchAction', opt.touchAction);
        this.rememberStyle(group, element, 'userSelect', opt.userSelect);
        this.rememberStyle(group, element, 'webkitUserSelect', opt.webkitUserSelect);
        this.rememberStyle(group, element, 'webkitTouchCallout', opt.webkitTouchCallout);
        this.rememberStyle(group, element, 'webkitUserDrag', opt.webkitUserDrag);
        this.rememberStyle(group, element, 'webkitTapHighlightColor', opt.webkitTapHighlightColor);
        this.rememberStyle(group, element, 'overscrollBehavior', opt.overscrollBehavior);
    });
}

bindDomSuppression(group, elements, opt, active) {
    if (!opt || group.length) return;
    if (opt.selectionGuard) {
        ['selectstart', 'dragstart', 'contextmenu', 'gesturestart'].forEach(type => {
            elements.forEach(element => this.listenDom(group, element, type, this.bound.suppressselection, passiveOption(false, true)));
        });
    }
    if (opt.tapGuard !== false) {
        ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'dblclick'].forEach(type => {
            elements.forEach(element => this.listenDom(group, element, type, this.bound.tapguard, passiveOption(false, true)));
        });
    }
    const doc = this.styleDocument();
    if (active && opt.clearSelection && doc && (opt.selectionGuard || opt.tapGuard !== false)) this.listenDom(group, doc, 'selectionchange', this.bound.clearselection, passiveOption(true));
}

listenDom(group, target, type, handler, options) {
    if (!target || !target.addEventListener) return;
    target.addEventListener(type, handler, options);
    group.push({ target, type, handler, options });
}

unbindDomSuppression(group) {
    while (group.length) {
        const item = group.pop();
        if (item.target && item.target.removeEventListener) item.target.removeEventListener(item.type, item.handler, item.options);
    }
}

suppressNativeSelection(event) {
    if (event && event.cancelable && typeof event.preventDefault === 'function') event.preventDefault();
    this.clearNativeSelection();
}

guardNativeTap(event) {
    if (!event || !this.enabled || !this.options || !this.options.dom || this.options.dom.tapGuard === false) return;
    if ((event.type === 'mousedown' || event.type === 'dblclick') && event.button !== undefined && event.button !== 0) return;
    if (this.isIgnored(event, event.target)) return;

    const point = this.nativeTapPoint(event);
    if (!point) return;

    const time = this.time();
    const memory = this.nativeTapMemory;
    const delay = this.options.dom.tapGuardDelay !== null && this.options.dom.tapGuardDelay !== undefined ? this.options.dom.tapGuardDelay : this.options.tap.interval;
    const distance = this.options.dom.tapGuardDistance !== null && this.options.dom.tapGuardDistance !== undefined ? this.options.dom.tapGuardDistance : this.options.tap.distance;
    const distanceFromMemory = memory ? hypot(point.clientX - memory.clientX, point.clientY - memory.clientY) : Infinity;

    if (memory && memory.contact === point.contact && memory.phase === 'start' && point.phase === 'end') {
        this.nativeTapMemory = Object.assign({ time }, point);
        return;
    }

    if (memory && memory.source !== point.source && time - memory.time < 40 && distanceFromMemory < 2) {
        this.nativeTapMemory = Object.assign({ time }, point);
        return;
    }

    if (event.type === 'dblclick' || (memory && time - memory.time <= delay && distanceFromMemory <= distance)) {
        if (event.cancelable && typeof event.preventDefault === 'function') event.preventDefault();
        this.clearNativeSelection();
    }

    this.nativeTapMemory = Object.assign({ time }, point);
}

nativeTapPoint(event) {
    const type = event.type || '';
    const source = type.indexOf('touch') === 0 ? 'touch' : event.pointerType || type || 'mouse';
    const phase = type === 'dblclick' ? 'double' : type.indexOf('end') >= 0 || type.indexOf('up') >= 0 ? 'end' : 'start';
    const touch = event.changedTouches && event.changedTouches[0] ? event.changedTouches[0] : event.touches && event.touches[0] ? event.touches[0] : null;
    const point = touch || event;
    if (point.clientX === undefined || point.clientY === undefined) return null;
    return {
        source,
        phase,
        contact: touch && touch.identifier !== undefined ? 'touch-' + touch.identifier : event.pointerId !== undefined ? 'pointer-' + event.pointerId : source,
        clientX: point.clientX,
        clientY: point.clientY
    };
}

clearNativeSelection() {
    const doc = this.styleDocument();
    const view = doc && doc.defaultView;
    const selection = doc && doc.getSelection ? doc.getSelection() : view && view.getSelection ? view.getSelection() : null;
    if (selection && selection.removeAllRanges) selection.removeAllRanges();
}

restoreStyleSet(group) {
    while (group.length) {
        const item = group.pop();
        const props = styleMemory.get(item.element);
        const state = props && props.get(item.prop);
        if (!state) continue;
        state.count--;
        if (state.count <= 0) {
            item.element.style[item.prop] = state.value;
            props.delete(item.prop);
        }
    }
}
