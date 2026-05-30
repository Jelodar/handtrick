acceptsPointer(event) {
    const type = event.pointerType || 'mouse';
    if (type === 'mouse' && !this.options.mouse) return false;
    if (type === 'touch' && !this.options.touch) return false;
    if (type === 'pen' && !this.options.pen) return false;
    if (type === 'mouse' && !this.acceptsButtons(event)) return false;
    return true;
}

acceptsButtons(event) {
    const expected = this.options.buttons || 1;
    const mask = buttonMask(event);
    if (event.type === 'pointerup' || event.type === 'mouseup') return true;
    if (event.type === 'pointerdown' || event.type === 'mousedown') {
        if (event.buttons !== undefined && event.buttons !== null) return mask === expected;
        return (buttonBit(event.button) & expected) !== 0;
    }
    return mask === expected;
}

isIgnored(event, target) {
    const ignore = this.options.ignore;
    if (!ignore) return false;
    if (typeof ignore === 'function') return !!ignore(target, event, this);
    if (typeof ignore === 'string') return !!(target && target.closest && target.closest(ignore));
    return false;
}

guard(event, target) {
    if (!this.enabled) return false;
    if (this.isIgnored(event, target)) {
        this.emit('input:ignored', { originalEvent: event, target });
        return false;
    }
    this.prepareEvent(event, this.options.preventDefault);
    return true;
}

prepareEvent(event, prevent) {
    if (prevent && event.cancelable && typeof event.preventDefault === 'function') event.preventDefault();
    if (this.options.stopPropagation) {
        if (typeof event.stopPropagation === 'function') event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    }
}

suppressNative(event) {
    if (!event) return;
    const claim = this.options.claim || {};
    const claimEnabled = claim.enabled !== false;
    if ((this.options.preventDefault || (claimEnabled && claim.preventDefault)) && event.cancelable && typeof event.preventDefault === 'function') event.preventDefault();
    if (this.options.stopPropagation || (claimEnabled && claim.stopPropagation)) {
        if (typeof event.stopPropagation === 'function') event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    }
}

pointerDown(event) {
    if (!this.acceptsPointer(event) || !this.guard(event, event.target)) return;
    if (this.options.capture && event.target.setPointerCapture) {
        try {
            event.target.setPointerCapture(event.pointerId);
        } catch (error) { }
    }
    this.addPoint(this.pointerId(event), this.eventPoint(event), event);
}

pointerMove(event) {
    const id = this.pointerId(event);
    if (!this.points.has(id)) return;
    if (!this.acceptsPointer(event)) {
        this.endPoint(id, event, true);
        return;
    }
    this.prepareEvent(event, this.options.preventDefault);
    this.updatePoint(id, this.eventPoint(event), event);
    this.processMove(event);
}

pointerUp(event) {
    const id = this.pointerId(event);
    if (!this.points.has(id)) return;
    this.prepareEvent(event, this.options.preventDefault);
    this.updatePoint(id, this.eventPoint(event), event);
    this.endPoint(id, event, false);
}

pointerCancel(event) {
    const id = this.pointerId(event);
    if (!this.points.has(id)) return;
    this.updatePoint(id, this.eventPoint(event), event);
    this.endPoint(id, event, true);
}

mouseDown(event) {
    if (this.time() - this.lastTouchInput < this.options.mouseTouchDelay) return;
    if (!this.options.mouse || !this.acceptsButtons(event) || !this.guard(event, event.target)) return;
    this.addPoint('mouse', this.eventPoint(event), event);
}

mouseMove(event) {
    if (!this.points.has('mouse')) return;
    if (!this.options.mouse || !this.acceptsButtons(event)) {
        this.endPoint('mouse', event, true);
        return;
    }
    this.prepareEvent(event, this.options.preventDefault);
    this.updatePoint('mouse', this.eventPoint(event), event);
    this.processMove(event);
}

mouseUp(event) {
    if (!this.points.has('mouse')) return;
    this.prepareEvent(event, this.options.preventDefault);
    this.updatePoint('mouse', this.eventPoint(event), event);
    this.endPoint('mouse', event, false);
}

touchStart(event) {
    this.lastTouchInput = this.time();
    if (!this.options.touch) return;
    if (!event.changedTouches.length || !this.guard(event, event.target)) return;
    Array.from(event.changedTouches).forEach(touch => {
        this.addPoint('touch-' + touch.identifier, this.touchPoint(touch), event, touch);
    });
}

touchMove(event) {
    if (!this.points.size) return;
    if (!this.options.touch) return;
    this.prepareEvent(event, this.options.preventDefault);
    Array.from(event.touches).forEach(touch => {
        const id = 'touch-' + touch.identifier;
        if (this.points.has(id)) this.updatePoint(id, this.touchPoint(touch), event, touch);
    });
    this.processMove(event);
}

touchEnd(event) {
    if (!this.points.size) return;
    if (!this.options.touch) return;
    this.prepareEvent(event, this.options.preventDefault);
    const changes = Array.from(event.changedTouches).map(touch => ({
        id: 'touch-' + touch.identifier,
        touch
    })).filter(item => this.points.has(item.id));
    changes.forEach(item => this.updatePoint(item.id, this.touchPoint(item.touch), event, item.touch));
    if (changes.length > 1 && changes.length === this.points.size) {
        this.endAllPoints(changes.map(item => item.id), event, false);
        return;
    }
    changes.forEach(item => {
        this.endPoint(item.id, event, false, item.touch);
    });
}

touchCancel(event) {
    if (!this.points.size) return;
    if (!this.options.touch) return;
    const changes = Array.from(event.changedTouches).map(touch => ({
        id: 'touch-' + touch.identifier,
        touch
    })).filter(item => this.points.has(item.id));
    changes.forEach(item => this.updatePoint(item.id, this.touchPoint(item.touch), event, item.touch));
    if (changes.length > 1 && changes.length === this.points.size) {
        this.endAllPoints(changes.map(item => item.id), event, true);
        return;
    }
    changes.forEach(item => {
        this.endPoint(item.id, event, true, item.touch);
    });
}

endAllPoints(ids, event, cancelled) {
    if (!this.session || !ids.length) return;
    const rect = this.rect();
    const time = this.time();
    const changedPointers = ids.map(id => this.exportPoint(this.points.get(id), rect)).filter(Boolean);
    const changedPointer = changedPointers[changedPointers.length - 1] || null;
    const countBefore = this.points.size;
    const releaseDetail = this.detail(cancelled ? 'session:cancel' : 'session:end', {
        originalEvent: event,
        changedPointer,
        changedPointers
    });

    if (cancelled) {
        this.points.clear();
        this.pointsDirty = true;
        this.pointCache = [];
        this.cancel('native', {
            originalEvent: event,
            changedPointer,
            changedPointers,
            added: 0,
            removed: countBefore,
            fingers: 0,
            activePointers: [],
            pointers: []
        });
        return;
    }

    ids.forEach(id => this.endRollingPoint(id, time));

    if (!this.session.consumed && this.isSwipe(releaseDetail)) this.emitSwipe(releaseDetail);

    this.points.clear();
    this.pointsDirty = true;
    this.pointCache = [];
    const endingDetail = this.detail('session:end', {
        originalEvent: event,
        changedPointer,
        changedPointers,
        added: 0,
        removed: countBefore,
        fingers: 0,
        activePointers: [],
        pointers: []
    });
    this.finishSession(event, endingDetail);
}
