handlePan(detail) {
    const opt = this.options.pan;
    if (!this.allowsGesture('pan')) return;
    if (!opt.enabled || this.session.pinchStarted || this.session.rotateStarted) return;
    if (this.session.pressStarted && this.options.press.allowsPan === false) return;
    if (!this.session.panStarted && this.session.consumed) return;
    if (!toArray(opt.fingers).includes(detail.fingers)) return;

    if (!this.session.panStarted) {
        if (detail.confidences.pan < 1) return;
        if (!this.intentReady(detail, opt, 'pan')) return;
        const axis = this.resolvePanAxis(detail);
        if (axis === false) return;
        const panDetail = this.panDetail(detail, axis);
        if (typeof opt.canStart === 'function' && !opt.canStart(panDetail, this)) return;
        this.session.panStarted = true;
        this.session.panAxis = axis || null;
        this.session.consumed = true;
        this.cancelPress('pan');
        this.commit('pan', panDetail, panDetail.confidences.pan);
        this.emit('pan:start', panDetail);
    }

    const panDetail = this.panDetail(detail, this.session.panAxis);
    this.claim(panDetail, panDetail.confidences.pan);
    this.emit('pan', panDetail);
}

resolvePanAxis(detail) {
    const axis = String(this.options.pan.axis || 'free').toLowerCase();
    if (axis === 'free') return null;
    if (axis === 'x' || axis === 'lock-x') return detail.axis === 'x' ? 'x' : false;
    if (axis === 'y' || axis === 'lock-y') return detail.axis === 'y' ? 'y' : false;
    if (axis === 'dominant') return detail.axis === 'x' || detail.axis === 'y' ? detail.axis : false;
    return null;
}

panDetail(detail, axis) {
    if (!axis) return detail;
    const out = Object.assign({}, detail, {
        panAxis: axis,
        rawDeltaX: detail.deltaX,
        rawDeltaY: detail.deltaY,
        rawStepX: detail.stepX,
        rawStepY: detail.stepY
    });
    if (axis === 'x') {
        out.deltaY = 0;
        out.stepY = 0;
        out.absY = 0;
        out.travel = abs(out.deltaX);
        out.stepDistance = abs(out.stepX);
        out.direction = out.deltaX >= 0 ? 'right' : 'left';
        out.axis = 'x';
    } else {
        out.deltaX = 0;
        out.stepX = 0;
        out.absX = 0;
        out.travel = abs(out.deltaY);
        out.stepDistance = abs(out.stepY);
        out.direction = out.deltaY >= 0 ? 'down' : 'up';
        out.axis = 'y';
    }
    return out;
}

handlePath(detail) {
    const opt = this.options.path;
    const consumeMode = this.pathConsumeMode();
    if (!this.allowsGesture('path')) return;
    if (!opt.enabled || !toArray(opt.fingers).includes(detail.fingers)) return;
    if (this.session.pinchStarted || this.session.rotateStarted) return;
    if (!this.intentReady(detail, opt, 'path')) return;

    let path = this.session.path;
    if (!path) path = this.session.path = this.createPathState(detail);

    const time = this.time();
    if (path.lastTime && opt.maxPause && time - path.lastTime > opt.maxPause && path.segments.length) {
        this.emitPathEnd(this.pathDetail(detail, { reason: 'pause' }));
        path = this.session.path = this.createPathState(detail, detail.center);
    }

    const dx = detail.center.pageX - path.origin.pageX;
    const dy = detail.center.pageY - path.origin.pageY;
    const distance = hypot(dx, dy);
    const minDistance = path.segments.length ? opt.segmentDistance : opt.minDistance;
    if (distance < minDistance) return;

    const direction = strictDirectionFrom(dx, dy, opt.axisRatio || this.options.swipe.axisRatio);
    if (direction === 'none') return;

    const last = path.segments[path.segments.length - 1] || null;
    if (last && direction === last.direction) {
        this.updatePathSegment(last, detail.center, time);
        path.origin = pointSnapshot(detail.center);
        path.lastTime = time;
        this.emitPathWithConsumption(this.pathDetail(detail));
        return;
    }

    if (last && directionTurn(last.direction, direction) < opt.turnAngle) return;

    const segment = this.createPathSegment(direction, path.origin, detail.center, time);
    path.segments.push(segment);
    while (path.segments.length > this.pathSegmentLimit()) path.segments.shift();
    path.origin = pointSnapshot(detail.center);
    path.lastTime = time;

    const pathDetail = this.pathDetail(detail);
    if (!this.session.pathStarted) {
        this.session.pathStarted = true;
        if (consumeMode === 'eager') this.session.consumed = true;
        this.commit('path', pathDetail, 1);
        this.emit('path:start', pathDetail);
    } else if (consumeMode === 'auto' && path.segments.length > 1) {
        this.session.consumed = true;
    }
    this.emitPathWithConsumption(pathDetail);
}

pathConsumeMode() {
    return normalizePathConsumeMode(this.options.path && this.options.path.consume);
}

emitPathWithConsumption(detail) {
    const winner = this.emitPath(detail);
    this.consumePathWinner(winner);
    return winner;
}

consumePathWinner(winner) {
    if (winner && this.pathConsumeMode() === 'auto' && this.session) this.session.consumed = true;
}

createPathState(detail, origin) {
    return {
        origin: pointSnapshot(origin || detail.startCenter || detail.center),
        segments: [],
        lastTime: 0,
        matched: {},
        observed: {},
        resolved: [],
        pending: []
    };
}

createPathSegment(direction, start, end, time) {
    const segment = {
        direction,
        start,
        end: pointSnapshot(end),
        startedAt: time,
        endedAt: time,
        deltaX: 0,
        deltaY: 0,
        distance: 0
    };
    this.updatePathSegment(segment, end, time);
    return segment;
}

updatePathSegment(segment, end, time) {
    segment.end = pointSnapshot(end);
    segment.endedAt = time;
    segment.deltaX = segment.end.pageX - segment.start.pageX;
    segment.deltaY = segment.end.pageY - segment.start.pageY;
    segment.distance = hypot(segment.deltaX, segment.deltaY);
}

pathDetail(detail, extra) {
    const path = this.session && this.session.path;
    const segments = path ? path.segments.map(segment => Object.assign({}, segment, {
        start: Object.assign({}, segment.start),
        end: Object.assign({}, segment.end)
    })) : [];
    const directions = segments.map(segment => segment.direction);
    const pathText = directions.join('>');
    const pathDistance = segments.reduce((sum, segment) => sum + segment.distance, 0);
    return Object.assign({}, detail, extra || {}, {
        path: directions,
        pathText,
        pathSegments: segments,
        pathDistance,
        pathMatched: extra && extra.pathMatched ? extra.pathMatched : null
    });
}

emitPath(detail) {
    const patternItems = this.pathPatternItems(detail);
    this.emitObservedItems([{ type: 'path', detail }]);
    return this.resolvePathEvents(detail, patternItems);
}

pathPatternItems(detail) {
    const path = this.session && this.session.path;
    const items = [];
    if (!path || !detail.path || !detail.path.length) return items;

    this.pathPatternRecords().forEach(record => {
        const match = pathPatternSuffixMatch(detail.path, record.matcher, detail);
        if (!match) return;
        const key = this.pathMatchKey(record.type, record.pattern, match.start, match.length, record.record);
        if (path.matched[key]) return;
        const item = {
            type: record.type,
            pattern: record.pattern,
            tokens: match.tokens,
            start: match.start,
            length: match.length,
            key,
            record: record.record || null,
            detail: this.pathMatchDetail(detail, match, record.type, record.displayPattern || record.pattern)
        };
        if (this.pathItemBlockedByResolved(item)) return;
        items.push(item);
    });
    this.circlePatternRecords().forEach(record => {
        const match = pathPatternSuffixMatch(detail.path, record.matcher, detail);
        if (!match) return;
        const key = this.pathMatchKey(record.type, record.pattern, match.start, match.length, record.record);
        if (path.matched[key]) return;
        const item = {
            type: record.type,
            pattern: record.pattern,
            tokens: match.tokens,
            start: match.start,
            length: match.length,
            key,
            record: record.record || null,
            detail: this.pathMatchDetail(detail, match, record.type, record.displayPattern || record.pattern)
        };
        if (this.pathItemBlockedByResolved(item)) return;
        items.push(item);
    });
    this.arcPatternRecords().forEach(record => {
        const match = pathPatternSuffixMatch(detail.path, record.matcher, detail);
        if (!match) return;
        const key = this.pathMatchKey(record.type, record.pattern, match.start, match.length, record.record);
        if (path.matched[key]) return;
        const item = {
            type: record.type,
            pattern: record.pattern,
            tokens: match.tokens,
            start: match.start,
            length: match.length,
            key,
            record: record.record || null,
            detail: this.pathMatchDetail(detail, match, record.type, record.displayPattern || record.pattern)
        };
        if (this.pathItemBlockedByResolved(item)) return;
        items.push(item);
    });
    return items.filter(item => this.hasPathListener(item));
}

circlePatternRecords() {
    const records = [];
    this.listeners.forEach((set, type) => {
        if (!set || !set.size) return;
        const parsed = parseEventSelector(type);
        if (!parsed.valid || parsed.family !== 'circle') return;
        const matcher = parsePathPattern(parsed.canonical);
        if (!matcher.valid || !this.pathPatternAllowed(matcher)) return;
        records.push({
            type,
            pattern: matcher.canonical,
            displayPattern: parsed.canonical,
            matcher,
            length: matcher.length,
            record: null
        });
    });
    return records;
}

arcPatternRecords() {
    const records = [];
    this.listeners.forEach((set, type) => {
        if (!set || !set.size) return;
        const parsed = parseEventSelector(type);
        if (!parsed.valid || parsed.family !== 'arc') return;
        const matcher = parsePathPattern(parsed.canonical);
        if (!matcher.valid) return;
        records.push({
            type,
            pattern: matcher.canonical,
            displayPattern: parsed.canonical,
            matcher,
            length: matcher.length,
            record: null
        });
    });
    return records;
}

pathMatchDetail(detail, match, type, displayPattern) {
    const parsed = parseEventSelector(type);
    const circle = match.circle || null;
    const arc = match.arc || null;
    const isCircleEvent = parsed.valid && parsed.family === 'circle';
    const isArcEvent = parsed.valid && parsed.family === 'arc';
    const extra = {
        pathMatched: isCircleEvent && circle ? circle.pathText : displayPattern || match.pattern,
        matchPattern: displayPattern || match.pattern,
        matchedPathText: match.pathText
    };
    if (circle) {
        extra.circleDirection = circle.direction;
        extra.circleCount = circle.count;
        extra.circle = {
            direction: circle.direction,
            count: circle.count,
            path: circle.path.slice(),
            pathText: circle.pathText,
            start: circle.start,
            length: circle.length,
            startDirection: circle.startDirection,
            endDirection: circle.endDirection,
            cycles: circle.cycles.map(cycle => Object.assign({}, cycle, {
                path: cycle.path.slice()
            }))
        };
        if (isCircleEvent) extra.direction = circle.direction;
    }
    if (arc) {
        extra.arcDirection = arc.direction;
        extra.arc = {
            direction: arc.direction,
            path: arc.path.slice(),
            pathText: arc.pathText,
            start: arc.start,
            length: arc.length,
            startDirection: arc.startDirection,
            endDirection: arc.endDirection
        };
        if (isArcEvent) {
            extra.direction = arc.direction;
            extra.pathMatched = arc.pathText;
        }
    }
    return this.pathDetail(detail, extra);
}

pathItemBlockedByResolved(item) {
    const path = this.session && this.session.path;
    if (!path || !path.resolved || !path.resolved.length) return false;
    return path.resolved.some(winner => winner.length > item.length);
}

pathMatchKey(type, pattern, start, length, record) {
    return type + '|' + pattern + '|' + start + '|' + length + '|' + (record ? record.order : '');
}

pathSegmentLimit() {
    const opt = this.options.path || {};
    return Math.max(1, opt.maxSegments || 1, this.longestPathPatternLength());
}

pathMaxCircleCount() {
    const value = Number(this.options.path && this.options.path.maxCircleCount);
    return value > 0 ? value : Infinity;
}

pathPatternAllowed(pattern) {
    return pathPatternMaxCircleCount(pattern) <= this.pathMaxCircleCount();
}

longestPathPatternLength() {
    const pathMax = this.pathPatternRecords().reduce((max, record) => Math.max(max, record.length), 0);
    const circleMax = this.circlePatternRecords().reduce((max, record) => Math.max(max, record.length), 0);
    const arcMax = this.arcPatternRecords().reduce((max, record) => Math.max(max, record.length), 0);
    return Math.max(pathMax, circleMax, arcMax);
}

matchingPathListeners(item) {
    const set = this.listeners.get(item.type);
    if (!set) return [];
    const data = Object.assign({}, item.detail, { type: item.type });
    return Array.from(set).filter(record => this.listenerMatches(record, data));
}

hasPathListener(item) {
    if (item.record) {
        const data = Object.assign({}, item.detail, { type: item.type });
        return this.listenerMatches(item.record, data, { pathArbitrated: true });
    }
    return this.matchingPathListeners(item).length > 0;
}

addPendingPathItems(items) {
    const path = this.session && this.session.path;
    if (!path) return [];
    items.forEach(item => {
        if (path.matched[item.key] || this.pathItemBlockedByResolved(item) || path.pending.some(pending => pending.key === item.key)) return;
        path.pending.push(item);
    });
    return path.pending.slice();
}

pathPatternRecords() {
    const patterns = [];
    this.listeners.forEach((set, type) => {
        if (!set || !set.size) return;
        if (isPathPatternEvent(type)) {
            const pattern = pathPatternFromEvent(type);
            const matcher = parsePathPattern(pattern);
            if (matcher.valid && this.pathPatternAllowed(matcher)) patterns.push({ type, pattern: matcher.canonical, displayPattern: pattern, matcher, length: matcher.length, record: null });
            return;
        }
        if (type !== 'path') return;
        Array.from(set).forEach(record => {
            this.pathCriteriaPatterns(record.criteria).forEach(item => {
                patterns.push({ type, pattern: item.matcher.canonical, displayPattern: item.displayPattern, matcher: item.matcher, length: item.matcher.length, record });
            });
        });
    });
    return patterns;
}

pathCriteriaPatterns(criteria) {
    if (!criteria || !isPlainObject(criteria)) return [];
    const values = [];
    if (criteria.path !== undefined && criteria.path !== null) values.push(criteria.path);
    if (criteria.pathText !== undefined && criteria.pathText !== null) values.push(criteria.pathText);
    const out = [];
    const seen = {};
    values.forEach(value => {
        const items = isPathPatternTokenArray(value) ? [value] : toArray(value);
        items.forEach(item => {
            const displayPattern = pathPatternText(item);
            const matcher = parsePathPattern(displayPattern);
            const key = displayPattern;
            if (!matcher.valid || !this.pathPatternAllowed(matcher) || seen[key]) return;
            seen[key] = true;
            out.push({ pattern: matcher.canonical, displayPattern, matcher });
        });
    });
    return out;
}

pathContinuationRecords() {
    return this.pathPatternRecords().concat(this.circlePatternRecords(), this.arcPatternRecords());
}

pendingPathCanContinue(item, currentPath, patterns, detail) {
    if (!item.tokens.every((token, index) => currentPath[item.start + index] === token)) return false;
    const progress = currentPath.slice(item.start);
    return patterns.some(pattern => (
        pattern.length > progress.length &&
        pathPatternProgressMatches(pattern.matcher, progress, detail)
    ));
}

resolvePathEvents(detail, patternItems) {
    const path = this.session && this.session.path;
    if (!path) return null;
    const pending = this.addPendingPathItems(patternItems);
    const patterns = this.pathContinuationRecords();
    const ready = [];

    path.pending = pending.filter(item => {
        if (path.matched[item.key]) return false;
        if (this.pendingPathCanContinue(item, detail.path, patterns, detail)) return true;
        ready.push(item);
        return false;
    });

    return this.emitReadyPathItems(detail, ready);
}

flushPathEvents(detail) {
    const path = this.session && this.session.path;
    if (!path || !path.pending.length) return null;
    const pending = path.pending.slice();
    path.pending = [];
    return this.emitReadyPathItems(detail, pending, true);
}

emitReadyPathItems(detail, items, omitPathCommand) {
    const path = this.session && this.session.path;
    if (!path) return null;
    const winners = this.pathExclusiveWinners(items || []);
    const fresh = winners.filter(item => !path.observed[item.key]);
    fresh.forEach(item => {
        path.observed[item.key] = true;
    });
    this.emitPathObservedItems(fresh);
    const commandItems = omitPathCommand ? winners : [{ type: 'path', detail }].concat(winners);
    const winner = this.emitCommandWinner(commandItems);
    this.markPathWinners(winners);
    return winner;
}

emitPathObservedItems(items) {
    (items || []).forEach(item => {
        if (item.record) {
            this.emitPathRecord(item.record, item.type, item.detail, ['observe', 'intent', 'update']);
            return;
        }
        this.emit(item.type, item.detail, { phases: ['observe', 'intent', 'update'] });
    });
}

emitPathRecord(record, type, detail, phases) {
    const data = Object.assign({}, detail || {}, { type });
    Object.defineProperty(data, 'instance', {
        value: this,
        enumerable: false,
        configurable: true
    });
    if (this.listenerMatches(record, data, { phases, pathArbitrated: true })) this.runListenerRecord(record, data);
    return data;
}

pathExclusiveWinners(items) {
    const sorted = (items || []).slice().sort((a, b) => (
        b.length - a.length ||
        this.eventSpecificity(b.type, b.detail) - this.eventSpecificity(a.type, a.detail) ||
        this.pathItemOrder(a) - this.pathItemOrder(b) ||
        a.start - b.start
    ));
    const winners = [];
    sorted.forEach(item => {
        if (winners.some(winner => this.pathItemsConflict(item, winner))) return;
        winners.push(item);
    });
    return winners.sort((a, b) => a.start - b.start || b.length - a.length);
}

pathItemOrder(item) {
    return this.matchingPathListeners(item).reduce((order, record) => Math.min(order, record.order), Infinity);
}

pathItemsOverlap(a, b) {
    return a.start < b.start + b.length && a.start + a.length > b.start;
}

pathItemsSameMatch(a, b) {
    return a.start === b.start && a.length === b.length && a.pattern === b.pattern;
}

pathItemsConflict(a, b) {
    return !this.pathItemsSameMatch(a, b) && this.pathItemsOverlap(a, b);
}

markPathWinners(items) {
    const path = this.session && this.session.path;
    if (!path || !items || !items.length) return;
    items.forEach(item => {
        path.matched[item.key] = true;
        path.resolved.push({
            start: item.start,
            length: item.length
        });
    });
    path.pending = path.pending.filter(item => {
        return !items.some(winner => this.pathItemsOverlap(item, winner)) && !this.pathItemBlockedByResolved(item);
    });
}

emitPathEnd(detail) {
    const pathDetail = this.pathDetail(detail);
    const winner = !pathDetail.reason || pathDetail.reason === 'pause' ? this.flushPathEvents(pathDetail) : null;
    this.consumePathWinner(winner);
    this.emit('path:end', pathDetail);
    if (this.session) {
        this.session.pathStarted = false;
        this.session.path = null;
    }
}
