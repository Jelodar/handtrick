startModifier(id, point, activeBefore, time) {
    if (!this.options.modifier.enabled || !this.allowsGesture('modifier') || !this.session || !activeBefore.length) return;
    const opt = this.options.modifier;
    if (!activeBefore.every(item => time - item.startTime >= opt.anchorDelay)) return;
    this.session.modifier = {
        actionId: id,
        target: point.target,
        startTime: time,
        startX: point.x,
        startY: point.y,
        startClientX: point.clientX,
        startClientY: point.clientY,
        anchorIds: activeBefore.map(item => item.id),
        anchors: activeBefore.map(item => ({ id: item.id, x: item.x, y: item.y })),
        anchorAge: Math.min.apply(null, activeBefore.map(item => time - item.startTime)),
        panStarted: false
    };
}

startKeyboardModifier(id, point, event, time) {
    if (!this.options.modifier.enabled || !this.allowsGesture('modifier') || !this.session) return;
    const keyboard = this.matchKeyboardModifier(event);
    if (!keyboard) return;
    this.session.keyboardModifier = {
        actionId: id,
        target: point.target,
        startTime: time,
        startX: point.x,
        startY: point.y,
        startClientX: point.clientX,
        startClientY: point.clientY,
        keyboard,
        panStarted: false
    };
    this.session.consumed = true;
    this.cancelPress('keyboardmodifier');
}

keyboardModifierOptions() {
    const keyboardOpt = this.options.modifier && this.options.modifier.keyboard;
    if (!keyboardOpt || keyboardOpt.enabled === false) return null;
    return keyboardOpt;
}

keyboardComboPayload(name, state) {
    return {
        name,
        combo: state.combo,
        keys: state.keys.slice(),
        shift: state.shift,
        alt: state.alt,
        ctrl: state.ctrl,
        meta: state.meta,
        command: state.command
    };
}

matchKeyboardModifier(event) {
    const keyboardOpt = this.keyboardModifierOptions();
    if (!keyboardOpt) return null;
    const state = keyboardState(event);
    if (!state.combo) return null;
    const source = keyboardOpt.combos || keyboardOpt.keys || {};
    let match = null;

    Object.keys(source).forEach(name => {
        if (comboEquals(state.combo, source[name])) match = this.keyboardComboPayload(name, state);
    });

    if (match) return match;

    const roles = keyboardOpt.roles || keyboardOpt.substitute || {};
    if (comboEquals(state.combo, roles.modifier)) return this.keyboardComboPayload('modifier', state);

    return null;
}

matchKeyboardFingerSubstitute(event, keyboard) {
    const keyboardOpt = this.keyboardModifierOptions();
    if (!keyboardOpt) return null;
    const state = keyboard || keyboardState(event);
    if (!state.combo) return null;
    const roles = keyboardOpt.roles || keyboardOpt.substitute || {};
    const candidates = [
        ['twoFingers', 2],
        ['threeFingers', 3],
        ['fourFingers', 4]
    ];
    let match = null;

    candidates.forEach(item => {
        if (match) return;
        if (comboEquals(state.combo, roles[item[0]])) match = {
            role: item[0],
            fingers: item[1],
            combo: state.combo,
            keys: state.keys.slice(),
            keyboard: Object.assign({}, state, { keys: state.keys.slice() })
        };
    });

    return match;
}

handleModifierMove(event) {
    const mod = this.session && this.session.modifier;
    if (!mod || mod.ended || mod.cancelled) return;
    const action = this.points.get(mod.actionId);
    if (!action) return;
    const anchorMoved = mod.anchors.some(anchor => {
        const point = this.points.get(anchor.id);
        return !point || hypot(point.x - anchor.x, point.y - anchor.y) > this.options.modifier.anchorMove;
    });
    if (anchorMoved) {
        mod.cancelled = true;
        return;
    }
    const detail = this.modifierDetail('pan:mod', event, action);
    if (!mod.panStarted) {
        if (detail.actionTravel < this.options.modifier.panThreshold) return;
        if (this.time() - mod.startTime < this.options.modifier.panDelay) return;
        mod.panStarted = true;
        this.session.consumed = true;
        this.cancelPress('pan:mod');
        this.commit('pan:mod', detail, 1);
        this.emit('pan:mod:start', detail);
    }
    this.emit('pan:mod', detail);
}

handleKeyboardModifierMove(event) {
    const mod = this.session && this.session.keyboardModifier;
    if (!mod || mod.ended || mod.cancelled) return false;
    const action = this.points.get(mod.actionId);
    if (!action) return false;
    const detail = this.keyboardModifierDetail('pan:mod', event, action);

    if (!mod.panStarted) {
        if (detail.actionTravel < this.options.modifier.panThreshold) return true;
        if (this.time() - mod.startTime < this.options.modifier.panDelay) return true;
        mod.panStarted = true;
        this.session.consumed = true;
        this.cancelPress('keyboard-pan:mod');
        this.commit('pan:mod', detail, 1);
        this.emit('pan:mod:start', detail);
    }

    this.emit('pan:mod', detail);
    return true;
}

endModifier(id, point, event) {
    const mod = this.session && this.session.modifier;
    if (!mod || mod.actionId !== id || mod.ended || mod.cancelled) return;
    mod.ended = true;
    const tapType = 'tap:mod';
    const detail = this.modifierDetail(mod.panStarted ? 'pan:mod:end' : tapType, event, point);

    if (mod.panStarted) {
        this.emit('pan:mod:end', detail);
        mod.panStarted = false;
    } else if (
        this.time() - mod.startTime <= this.options.modifier.maxTapTime &&
        detail.actionTravel <= this.options.modifier.maxTapMove
    ) {
        if (this.hasRollingTapCandidate(event)) return;
        this.session.consumed = true;
        this.dispatchCommittedEvents(tapType, detail, 1, [{ type: tapType, detail }]);
    }
}

endKeyboardModifier(id, point, event) {
    const mod = this.session && this.session.keyboardModifier;
    if (!mod || mod.actionId !== id || mod.ended || mod.cancelled) return;
    mod.ended = true;
    const tapType = 'tap:mod';
    const detail = this.keyboardModifierDetail(mod.panStarted ? 'pan:mod:end' : tapType, event, point);

    if (mod.panStarted) {
        this.emit('pan:mod:end', detail);
        mod.panStarted = false;
    } else if (
        this.time() - mod.startTime <= this.options.modifier.maxTapTime &&
        detail.actionTravel <= this.options.modifier.maxTapMove
    ) {
        this.session.consumed = true;
        this.dispatchCommittedEvents(tapType, detail, 1, [{ type: tapType, detail }]);
    }
}

hasRollingTapCandidate(event) {
    if (!this.session || !this.session.rolling || this.session.rolling.cancelled) return false;
    return !!this.rollingTapData(this.detail('finish', { originalEvent: event }));
}

modifierDetail(type, event, action) {
    const mod = this.session.modifier;
    const anchors = mod.anchorIds.map(id => this.points.get(id)).filter(Boolean);
    const rect = this.rect();
    const actionPointer = action ? this.exportPoint(action, rect) : null;
    const modifierPointers = anchors.map(point => this.exportPoint(point, rect));
    const modifier = this.modifierMeta('touch', 'touch', null, actionPointer, modifierPointers);
    return this.modifierActionDetail(type, event, mod, actionPointer, modifierPointers, modifier);
}

keyboardModifierDetail(type, event, action) {
    const mod = this.session.keyboardModifier;
    const rect = this.rect();
    const actionPointer = action ? this.exportPoint(action, rect) : null;
    const modifier = this.modifierMeta('keyboard', mod.keyboard.name, mod.keyboard, actionPointer, []);
    return this.modifierActionDetail(type, event, mod, actionPointer, [], modifier);
}

modifierActionDetail(type, event, mod, actionPointer, modifierPointers, modifier) {
    const dx = actionPointer ? actionPointer.pageX - mod.startX : 0;
    const dy = actionPointer ? actionPointer.pageY - mod.startY : 0;
    const detail = this.detail(type, {
        originalEvent: event,
        target: mod.target,
        changedPointer: actionPointer,
        actionPointer,
        modifierPointers,
        actionDeltaX: dx,
        actionDeltaY: dy,
        actionTravel: hypot(dx, dy),
        actionDirection: directionFrom(dx, dy, this.options.swipe.axisRatio),
        modifier
    });
    detail.modifier.axis = axisFrom(detail.actionDirection);
    return detail;
}

modifierMeta(source, name, keyboard, actionPointer, modifierPointers) {
    const anchors = modifierPointers || [];
    const primary = anchors[0] || actionPointer || null;
    const keys = keyboard && keyboard.keys ? keyboard.keys.slice() : [];
    const keyCombo = keyboard ? keyboard.combo : '';
    return {
        source,
        name,
        fingers: anchors.length,
        actionFingers: actionPointer ? 1 : 0,
        totalFingers: anchors.length + (actionPointer ? 1 : 0),
        region: primary ? primary.region : 'none',
        area: primary ? primary.area : 'none',
        edge: primary ? primary.edge : null,
        halfX: primary ? primary.halfX : 'center',
        halfY: primary ? primary.halfY : 'middle',
        halfRegion: primary ? primary.halfRegion : 'center',
        edgeRegion: primary ? primary.edgeRegion : 'none',
        keys,
        keyCombo,
        keyboard: keyboard ? Object.assign({}, keyboard, { keys }) : null,
        position: {
            source: primary,
            action: actionPointer || null,
            anchor: anchors[0] || null,
            anchors: anchors.slice()
        }
    };
}

rebasedTransformDetail(detail) {
    if (!this.session) return detail;
    const out = Object.assign({}, detail);
    if (this.session.pinchStarted && this.session.pinchBaseDistance) {
        out.rawStartDistance = out.startDistance;
        out.rawDistanceDelta = out.distanceDelta;
        out.rawScale = out.scale;
        out.rawScaleDelta = out.scaleDelta;
        out.startDistance = this.session.pinchBaseDistance;
        out.distanceDelta = out.distance - this.session.pinchBaseDistance;
        out.scale = this.session.pinchBaseDistance ? out.distance / this.session.pinchBaseDistance : 1;
        out.scaleDelta = out.scale - 1;
    }
    if (this.session.rotateStarted && this.session.rotateBaseAngle !== null) {
        out.rawRotation = out.rotation;
        out.rotation = normalizeAngle(out.angle - this.session.rotateBaseAngle);
    }
    return out;
}
