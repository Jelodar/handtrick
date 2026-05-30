function selectorResult(raw, data) {
    const out = Object.assign({
        raw,
        canonical: raw,
        valid: false,
        opaque: true,
        family: null,
        recognizer: null,
        mode: null,
        state: null,
        direction: null,
        fingers: null,
        count: null,
        pathPattern: null
    }, data || {});
    out.recognizer = out.valid ? selectorRecognizer(out) : null;
    return out;
}

function invalidSelector(raw) {
    return selectorResult(raw, null);
}

function selectorRecognizer(parsed) {
    if (!parsed || !parsed.valid) return null;
    if (parsed.family === 'session' || parsed.family === 'input' || parsed.family === 'gesture' || parsed.family === 'fingers') return null;
    if (parsed.family === 'tap' && parsed.mode === 'mod') return 'modifier';
    if (parsed.family === 'pan' && parsed.mode === 'mod') return 'modifier';
    if (parsed.family === 'circle') return 'path';
    if (parsed.family === 'arc') return 'path';
    if (parsed.family === 'path') return 'path';
    return activatableRecognizers[parsed.family] ? parsed.family : null;
}

function eventRecognizerGroup(parsedOrType) {
    const parsed = typeof parsedOrType === 'string' ? parseEventSelector(canonicalEventType(parsedOrType)) : parsedOrType;
    return selectorRecognizer(parsed);
}

function parseEventSelector(value) {
    const raw = String(value === undefined || value === null ? '' : value).toLowerCase().trim();
    if (!raw || raw === '*') return invalidSelector(raw);

    const pathPattern = pathPatternFromEvent(raw);
    if (pathPattern) {
        return selectorResult(raw, {
            canonical: pathPattern,
            valid: true,
            opaque: false,
            family: 'path',
            pathPattern
        });
    }

    if (raw.indexOf('>') >= 0) return invalidSelector(raw);

    const parts = raw.split(':').map(item => item.trim());
    const family = parts.shift();
    if (!family || !selectorFamilyAllowed(family) || parts.some(item => !item)) return invalidSelector(raw);

    const parsed = {
        raw,
        family,
        mode: null,
        state: null,
        direction: null,
        fingers: null,
        count: null
    };
    const seen = {};

    for (let index = 0; index < parts.length; index++) {
        const token = parts[index];
        let match = token.match(/^([1-9]\d*)f$/);
        if (match) {
            if (seen.fingers) return invalidSelector(raw);
            seen.fingers = true;
            parsed.fingers = parseInt(match[1], 10);
            continue;
        }
        match = token.match(/^([1-9]\d*)x$/);
        if (match) {
            if (seen.count) return invalidSelector(raw);
            seen.count = true;
            parsed.count = parseInt(match[1], 10);
            continue;
        }
        if (selectorModeAllowed(token)) {
            if (seen.mode) return invalidSelector(raw);
            seen.mode = true;
            parsed.mode = token;
            continue;
        }
        if (selectorStateAllowed(token)) {
            if (seen.state) return invalidSelector(raw);
            seen.state = true;
            parsed.state = token;
            continue;
        }
        if (selectorDirectionAllowed(token)) {
            if (seen.direction) return invalidSelector(raw);
            seen.direction = true;
            parsed.direction = token;
            continue;
        }
        return invalidSelector(raw);
    }

    if (!selectorShapeAllowed(parsed)) return invalidSelector(raw);

    const canonical = [family];
    if (parsed.mode) canonical.push(parsed.mode);
    if (parsed.fingers !== null) canonical.push(parsed.fingers + 'f');
    if (parsed.count !== null && !(family === 'circle' && parsed.count === 1)) canonical.push(parsed.count + 'x');
    if (parsed.direction) canonical.push(parsed.direction);
    if (parsed.state) canonical.push(parsed.state);
    return selectorResult(raw, Object.assign({}, parsed, {
        canonical: canonical.join(':'),
        valid: true,
        opaque: false
    }));
}

function selectorFamilyAllowed(family) {
    return !!{
        session: true,
        input: true,
        gesture: true,
        fingers: true,
        tap: true,
        press: true,
        pan: true,
        swipe: true,
        pinch: true,
        rotate: true,
        path: true,
        circle: true,
        arc: true,
        rolling: true,
        pressure: true,
        wheel: true
    }[family];
}

function selectorModeAllowed(token) {
    return !!{
        mod: true,
        multi: true,
        sequence: true,
        intent: true,
        zoom: true
    }[token];
}

function selectorStateAllowed(token) {
    return !!{
        start: true,
        move: true,
        change: true,
        update: true,
        transition: true,
        commit: true,
        end: true,
        cancel: true,
        ignored: true
    }[token];
}

function selectorDirectionAllowed(token) {
    return !!selectorDirectionSet[token];
}

function selectorShapeAllowed(parsed) {
    const state = parsed.state;
    const mode = parsed.mode;
    const direction = parsed.direction;
    const fingers = parsed.fingers;
    const count = parsed.count;
    if (parsed.family === 'session') return !mode && !direction && fingers === null && count === null && ['start', 'move', 'end', 'cancel'].includes(state);
    if (parsed.family === 'input') return !mode && !direction && fingers === null && count === null && state === 'ignored';
    if (parsed.family === 'gesture') return !mode && !direction && fingers === null && count === null && ['start', 'update', 'transition', 'commit', 'end', 'cancel'].includes(state);
    if (parsed.family === 'fingers') return !mode && !direction && fingers === null && count === null && state === 'change';
    if (parsed.family === 'tap') {
        if (state || direction) return false;
        if (fingers !== null) return false;
        if (mode === 'mod') return count === null;
        if (mode === 'multi' || mode === 'sequence') return fingers === null && count === null;
        if (mode) return false;
        return true;
    }
    if (parsed.family === 'press') return !mode && !direction && fingers === null && count === null && (!state || ['start', 'move', 'end', 'cancel'].includes(state));
    if (parsed.family === 'pan') {
        if (direction || fingers !== null || count !== null) return false;
        if (mode && mode !== 'mod') return false;
        return !state || state === 'start' || state === 'end';
    }
    if (parsed.family === 'swipe') {
        if (state || fingers !== null || count !== null) return false;
        if (mode && mode !== 'intent' && mode !== 'mod') return false;
        return !direction || isCardinalDirection(direction);
    }
    if (parsed.family === 'pinch') {
        if (mode && mode !== 'mod') return false;
        if (fingers !== null || count !== null) return false;
        if (state) return !direction && (state === 'start' || state === 'end');
        return !direction || direction === 'in' || direction === 'out';
    }
    if (parsed.family === 'rotate') {
        if (mode && mode !== 'mod') return false;
        if (fingers !== null || count !== null) return false;
        if (state) return !direction && (state === 'start' || state === 'end');
        return !direction || direction === 'cw' || direction === 'ccw';
    }
    if (parsed.family === 'path') return !mode && !direction && fingers === null && count === null && (!state || state === 'start' || state === 'end');
    if (parsed.family === 'circle') return !mode && !state && fingers === null && (!direction || direction === 'cw' || direction === 'ccw');
    if (parsed.family === 'arc') return !mode && !state && fingers === null && count === null && (!direction || isCardinalDirection(direction));
    if (parsed.family === 'rolling') return !mode && !state && fingers === null && count === null && (!direction || isCardinalDirection(direction));
    if (parsed.family === 'pressure') return !mode && !direction && fingers === null && count === null && state === 'change';
    if (parsed.family === 'wheel') return !state && !direction && fingers === null && count === null && (!mode || mode === 'zoom');
    return false;
}

function parseSequenceSelector(value) {
    const raw = String(value === undefined || value === null ? '' : value).toLowerCase().trim();
    if (!raw || raw.indexOf('>') < 0 || pathPatternFromEvent(raw)) return { raw, valid: false, canonical: raw, parsed: [], matchers: [] };
    const parsed = sequenceTokens(raw).map(parseEventSelector);
    if (parsed.length < 2 || parsed.some(item => !item.valid || item.pathPattern)) return { raw, valid: false, canonical: raw, parsed, matchers: [] };
    const canonical = parsed.map(item => item.canonical).join('>');
    return {
        raw,
        valid: true,
        canonical,
        parsed,
        matchers: parsed.reduce((out, item) => out.concat(sequenceMatchersForSelector(item)), [])
    };
}

function canonicalEventType(type) {
    const key = String(type === undefined || type === null ? '' : type).toLowerCase().trim();
    if (key === '*') return '*';
    if (key.indexOf('>') >= 0 && !pathPatternFromEvent(key)) {
        const sequence = parseSequenceSelector(key);
        return sequence.valid ? sequence.canonical : key;
    }
    return parseEventSelector(key).canonical;
}

function normalizeEventType(type) {
    return canonicalEventType(type);
}

function isPathPatternEvent(type) {
    return !!pathPatternFromEvent(canonicalEventType(type));
}

function pathPatternFromEvent(type) {
    const value = String(type || '').toLowerCase().trim();
    if (!value) return '';
    if (value.indexOf('>') >= 0) return pathPatternText(value);
    if (value.indexOf(':') < 0 && value !== 'circle') return pathText(value);
    return '';
}

function isSequencePatternEvent(type) {
    return parseSequenceSelector(canonicalEventType(type)).valid;
}

function sequenceMatchersForSelector(parsed) {
    const base = {
        raw: parsed.canonical,
        token: parsed.recognizer || parsed.family,
        family: parsed.family,
        event: parsed.canonical,
        mode: parsed.mode,
        state: parsed.state,
        tapCount: null,
        fingers: parsed.fingers,
        direction: parsed.direction,
        multiTap: false,
        specificity: selectorSpecificity(parsed)
    };

    if (parsed.family === 'tap' && parsed.mode !== 'mod' && parsed.count !== null) {
        const out = [];
        for (let index = 1; index <= parsed.count; index++) {
            out.push(Object.assign({}, base, {
                event: index === parsed.count ? parsed.canonical : 'tap',
                tapCount: index === parsed.count ? parsed.count : null,
                specificity: 100 + (index === parsed.count ? selectorSpecificity(parsed) : 10)
            }));
        }
        return out;
    }

    if (parsed.family === 'tap' && parsed.mode === 'multi') base.multiTap = true;
    base.specificity += 100;
    return [base];
}

function sequencePattern(tokens) {
    const sequence = Array.isArray(tokens) ? parseSequenceSelector(tokens.join('>')) : parseSequenceSelector(tokens);
    return sequence.matchers;
}

function selectorSpecificity(parsed) {
    if (!parsed || !parsed.valid) return 0;
    if (parsed.pathPattern) {
        const pattern = parsePathPattern(parsed.pathPattern);
        return 800 + (pattern.valid ? pattern.length : 0) * 20;
    }
    let score = 0;
    if (parsed.state) score += 40;
    if (parsed.mode === 'mod') score += 35;
    if (parsed.count !== null) score += 30;
    if (parsed.mode && parsed.mode !== 'mod') score += 20;
    if (parsed.direction) score += 20;
    if (parsed.fingers !== null) score += 15;
    if (!parsed.state && !parsed.mode && !parsed.direction && parsed.fingers === null && parsed.count === null) score += 10;
    return score || 5;
}
