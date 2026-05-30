handlePinch(detail) {
    const opt = this.options.pinch;
    if (this.session.modifier && this.session.modifier.panStarted) return;
    if (!this.allowsGesture('pinch')) return;
    if (!opt.enabled || detail.fingers !== 2 || !detail.distance || this.session.panStarted) return;

    const distanceDelta = abs(detail.distance - detail.startDistance);
    const scaleDelta = abs(detail.scale - 1);

    if (!this.session.pinchStarted) {
        if (detail.confidences.pinch < 1) return;
        if (distanceDelta < opt.distance && scaleDelta < opt.scale) return;
        if (detail.motion.parallel > 0.72 && detail.motion.translationShare > 0.5) return;
        if (distanceDelta <= detail.travel * opt.dominance) return;
        this.session.pinchStarted = true;
        this.session.pinchBaseDistance = detail.distance || 0;
        this.session.pinchModified = this.isModifiedGesture(detail);
        this.session.consumed = true;
        this.cancelPress('pinch');
        detail = this.rebasedTransformDetail(detail);
        detail = Object.assign({}, detail, { modified: this.session.pinchModified });
        this.commit(this.transformCommitType('pinch', this.pinchDirection(detail), detail), detail, detail.confidences.pinch);
        this.emit('pinch:start', detail);
        if (this.session.pinchModified) this.emit('pinch:mod:start', detail);
    }

    detail = this.rebasedTransformDetail(detail);
    this.claim(detail, detail.confidences.pinch);
    this.emitDirectEmits(this.transformEvents('pinch', this.pinchDirection(detail), detail));
}

handleRotate(detail) {
    const opt = this.options.rotate;
    if (this.session.modifier && this.session.modifier.panStarted) return;
    if (!this.allowsGesture('rotate')) return;
    if (!opt.enabled || detail.fingers !== 2 || this.session.panStarted) return;

    if (!this.session.rotateStarted) {
        if (detail.confidences.rotate < opt.confidence) return;
        this.session.rotateStarted = true;
        this.session.rotateBaseAngle = detail.angle;
        this.session.rotateModified = this.isModifiedGesture(detail);
        this.session.consumed = true;
        this.cancelPress('rotate');
        detail = this.rebasedTransformDetail(detail);
        detail = Object.assign({}, detail, { modified: this.session.rotateModified });
        this.commit(this.transformCommitType('rotate', this.rotateDirection(detail), detail), detail, detail.confidences.rotate);
        this.emit('rotate:start', detail);
        if (this.session.rotateModified) this.emit('rotate:mod:start', detail);
    }

    detail = this.rebasedTransformDetail(detail);
    this.claim(detail, detail.confidences.rotate);
    this.emitDirectEmits(this.transformEvents('rotate', this.rotateDirection(detail), detail));
}

pinchDirection(detail) {
    return detail.scale >= 1 ? 'out' : 'in';
}

rotateDirection(detail) {
    return (detail.rawRotation !== undefined ? detail.rawRotation : detail.rotation) >= 0 ? 'cw' : 'ccw';
}

transformEvents(family, direction, detail) {
    const modified = this.isModifiedGesture(detail);
    const data = Object.assign({}, detail, { modified });
    const events = [
        { type: family, detail: data },
        { type: family + ':' + direction, detail: data }
    ];
    if (modified) {
        events.push({ type: family + ':mod', detail: data });
        events.push({ type: family + ':mod:' + direction, detail: data });
    }
    return events;
}

transformCommitType(family, direction, detail) {
    return family + (this.isModifiedGesture(detail) ? ':mod' : '') + ':' + direction;
}

handleSwipeIntent(detail) {
    const opt = this.options.swipe;
    if (!this.allowsGesture('swipe')) return;
    if (!opt.enabled || this.session.consumed || this.session.pinchStarted || this.session.rotateStarted || this.session.panStarted) return;
    if (detail.travel < opt.intentDistance) return;
    if (!this.intentReady(detail, opt, 'swipe')) return;
    if (!this.session.swipeIntentAt) {
        this.session.swipeIntentAt = this.time();
        this.emit('swipe:intent', detail);
        if (detail.direction !== 'none') this.emit('swipe:intent:' + detail.direction, detail);
        return;
    }
    if (this.time() - this.session.swipeIntentAt >= opt.confidenceDelay) this.session.swipeReady = true;
}

pushSwipeTypes(out, base, detail) {
    const direction = detail.direction !== 'none' ? detail.direction : '';
    out.push(base);
    if (direction) out.push(base + ':' + direction);
}

isModifiedGesture(detail) {
    if (detail.modifier) return true;
    if (!detail.keyCombo) return false;
    const substitute = detail.keyboardSubstitute;
    if (!substitute || !substitute.keys) return true;
    return detail.keys.some(key => !substitute.keys.includes(key));
}

swipeEvents(detail) {
    detail = Object.assign({}, detail, {
        speed: this.swipeSpeed(detail),
        modified: this.isModifiedGesture(detail)
    });
    const types = [];
    this.pushSwipeTypes(types, 'swipe', detail);
    if (detail.modified) this.pushSwipeTypes(types, 'swipe:mod', detail);
    return types.map(type => ({ type, detail }));
}

swipeSpeed(detail) {
    const velocity = detail.velocity || 0;
    const threshold = Math.max(0.001, this.options.swipe.velocity || 0.001);
    if (velocity >= threshold * 2) return 'flick';
    if (velocity >= threshold) return 'normal';
    return 'slow';
}

swipeCommitType(detail) {
    const direction = detail.direction !== 'none' ? detail.direction : '';
    return 'swipe' + (detail.modified ? ':mod' : '') + (direction ? ':' + direction : '');
}

emitSwipe(detail) {
    this.session.consumed = true;
    const events = this.swipeEvents(detail);
    this.dispatchCommittedEvents(this.swipeCommitType(events[0].detail), events[0].detail, detail.confidences.swipe, events);
}
