/** HandTrick.js - MIT © Jelodar */
const KEY_SHIFT = 'shift', KEY_ALT = 'alt', KEY_CTRL = 'ctrl', KEY_META = 'meta';
const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
const abs = Math.abs;
const hypot = Math.hypot;
const atan2 = Math.atan2;
const PI = Math.PI;
const styleMemory = new WeakMap();
const cardinalDirections = ['left', 'right', 'up', 'down'];
const pathDirectionSet = listSet(cardinalDirections);
const selectorDirectionSet = listSet(cardinalDirections.concat(['in', 'out', 'cw', 'ccw']));
const swipeDirections = cardinalDirections;
const circleDirections = ['cw', 'ccw'];
const pathConsumeModes = { auto: true, eager: true, never: true };
const defaultKeyboardCombos = {
    plain: KEY_SHIFT,
    shiftAlt: KEY_SHIFT + '+' + KEY_ALT,
    shiftCommand: KEY_SHIFT + '+' + KEY_META,
    shiftAltCommand: KEY_SHIFT + '+' + KEY_ALT + '+' + KEY_META,
};
const defaultKeyboardRoles = {
    modifier: KEY_SHIFT,
    twoFingers: KEY_ALT,
    threeFingers: KEY_CTRL,
    fourFingers: KEY_SHIFT + '+' + KEY_META,
    rollingTap: KEY_META
};
const rollingDefaultSeed = {
    maxDelay: 500,
    maxHold: 780,
    maxGap: 260
};
const rollingDefaultRatio = {
    maxDelay: { 3: 1.12, 4: 1.24 },
    maxHold: { 3: 1.18, 4: 1.333 },
    maxGap: { 3: 1.31, 4: 1.31 }
};

function listSet(values) {
    return values.reduce((out, value) => {
        out[value] = true;
        return out;
    }, {});
}

function normalizePathConsumeMode(value) {
    const mode = typeof value === 'string' ? value.toLowerCase() : '';
    return pathConsumeModes[mode] ? mode : 'auto';
}

function swipeRegistryEvents() {
    const out = ['swipe', 'swipe:intent', 'swipe:mod'];
    swipeDirections.forEach(direction => out.push('swipe:intent:' + direction));
    swipeDirections.forEach(direction => out.push('swipe:' + direction));
    swipeDirections.forEach(direction => out.push('swipe:mod:' + direction));
    return out;
}

function rollingRegistryEvents() {
    const out = ['rolling'];
    swipeDirections.forEach(direction => out.push('rolling:' + direction));
    return out;
}

function transformRegistryEvents(family, directions) {
    const out = [family, family + ':start', family + ':end', family + ':mod', family + ':mod:start', family + ':mod:end'];
    directions.forEach(direction => out.push(family + ':' + direction));
    directions.forEach(direction => out.push(family + ':mod:' + direction));
    return out;
}

function circleRegistryEvents() {
    const out = ['circle'];
    circleDirections.forEach(direction => out.push('circle:' + direction));
    return out;
}

function arcRegistryEvents() {
    const out = ['arc'];
    cardinalDirections.forEach(direction => out.push('arc:' + direction));
    return out;
}

const eventRegistry = {
    lifecycle: ['session:start', 'session:move', 'session:end', 'session:cancel', 'fingers:change', 'gesture:start', 'gesture:update', 'gesture:transition', 'gesture:commit', 'gesture:end', 'gesture:cancel', 'input:ignored'],
    tap: ['tap', 'tap:1x', 'tap:2x', 'tap:3x', 'tap:sequence', 'tap:multi'],
    press: ['press', 'press:start', 'press:move', 'press:end', 'press:cancel'],
    pan: ['pan:start', 'pan', 'pan:end'],
    swipe: swipeRegistryEvents(),
    pinch: transformRegistryEvents('pinch', ['in', 'out']),
    rotate: transformRegistryEvents('rotate', ['cw', 'ccw']),
    path: ['path:start', 'path', 'path:end'],
    circle: circleRegistryEvents(),
    arc: arcRegistryEvents(),
    rolling: rollingRegistryEvents(),
    modifier: ['tap:mod', 'pan:mod:start', 'pan:mod', 'pan:mod:end'],
    pressure: ['pressure:change'],
    wheel: ['wheel', 'wheel:zoom']
};

const eventNames = Object.keys(eventRegistry).reduce((out, group) => out.concat(eventRegistry[group]), []);
const recognizerNames = ['tap', 'press', 'pan', 'swipe', 'pinch', 'rotate', 'path', 'rolling', 'modifier', 'pressure', 'wheel'];
const activatableRecognizers = listSet(recognizerNames);
const additiveEventTypes = {
    'session:start': true,
    'session:move': true,
    'session:end': true,
    'session:cancel': true,
    'fingers:change': true,
    'gesture:start': true,
    'gesture:update': true,
    'gesture:transition': true,
    'gesture:commit': true,
    'gesture:end': true,
    'gesture:cancel': true,
    'input:ignored': true,
    'tap:sequence': true,
    'press:start': true,
    'swipe:intent': true,
    'swipe:intent:left': true,
    'swipe:intent:right': true,
    'swipe:intent:up': true,
    'swipe:intent:down': true,
    'press:move': true,
    'press:end': true,
    'press:cancel': true,
    'pan:start': true,
    pan: true,
    'pan:end': true,
    'pinch:start': true,
    pinch: true,
    'pinch:end': true,
    'pinch:in': true,
    'pinch:out': true,
    'pinch:mod:start': true,
    'pinch:mod': true,
    'pinch:mod:end': true,
    'pinch:mod:in': true,
    'pinch:mod:out': true,
    'rotate:start': true,
    rotate: true,
    'rotate:end': true,
    'rotate:cw': true,
    'rotate:ccw': true,
    'rotate:mod:start': true,
    'rotate:mod': true,
    'rotate:mod:end': true,
    'rotate:mod:cw': true,
    'rotate:mod:ccw': true,
    'path:start': true,
    path: true,
    'path:end': true,
    'pan:mod:start': true,
    'pan:mod': true,
    'pan:mod:end': true,
    'pressure:change': true,
    wheel: true,
    'wheel:zoom': true
};

const defaults = {
    enabled: true,
    input: 'auto',
    touch: true,
    mouse: true,
    pen: true,
    mouseTouchDelay: 700,
    buttons: 1,
    preventDefault: true,
    stopPropagation: false,
    capture: true,
    windowEvents: true,
    ignore: null,
    clock: null,
    rect: 'session',
    dom: {
        enabled: true,
        target: true,
        active: true,
        touchAction: 'none',
        userSelect: 'none',
        webkitUserSelect: 'none',
        webkitTouchCallout: 'none',
        webkitUserDrag: 'none',
        webkitTapHighlightColor: 'transparent',
        selectionGuard: true,
        clearSelection: true,
        tapGuard: true,
        tapGuardDelay: null,
        tapGuardDistance: null,
        overscrollBehavior: 'contain'
    },
    intent: {
        history: 12,
        enabled: true,
        prune: true,
        useListeners: true,
        events: null,
        fastPath: true,
        fastPathMaxCandidates: 2,
        fastPathTime: 0.62,
        fastPathSamples: 1,
        releaseGuard: 180,
        releaseDistance: 34,
        sequenceWindow: 1200,
        sequenceMax: 8
    },
    claim: {
        enabled: true,
        threshold: 0.58,
        preventDefault: true,
        stopPropagation: false
    },
    tap: {
        enabled: true,
        maxTime: 420,
        maxMove: 18,
        interval: 340,
        distance: 80
    },
    tapHold: {
        enabled: true,
        window: 1200,
        distance: 160,
        maxRestTime: 320
    },
    press: {
        enabled: true,
        delay: 500,
        move: 14,
        repeat: 0,
        consumesTap: true,
        allowsPan: false
    },
    pan: {
        enabled: true,
        threshold: 12,
        minTime: 45,
        minSamples: 2,
        fingers: [1],
        axis: 'free',
        canStart: null
    },
    swipe: {
        enabled: true,
        distance: 80,
        distanceByFingers: { 1: 100, 2: 60, 3: 60, 4: 60 },
        velocity: 0.25,
        axisRatio: 1.12,
        confidenceDelay: 80,
        intentDistance: 50,
        minTime: 90,
        minSamples: 2,
        allowAfterPan: true
    },
    pinch: {
        enabled: true,
        distance: 10,
        scale: 0.03,
        minTime: 70,
        minSamples: 2,
        dominance: 0.35
    },
    rotate: {
        enabled: true,
        angle: 8,
        minTime: 130,
        minSamples: 3,
        lateAngle: 22,
        maxSoftStart: 650,
        minAngularVelocity: 0.035,
        requireMovedFingers: true,
        dominance: 0.42,
        confidence: 0.72
    },
    path: {
        enabled: true,
        fingers: [1],
        minDistance: 44,
        segmentDistance: 42,
        axisRatio: 1.35,
        turnAngle: 55,
        maxPause: 650,
        maxSegments: 6,
        maxCircleCount: 6,
        minTime: 80,
        minSamples: 2,
        consume: 'auto'
    },
    rolling: {
        enabled: true,
        fingers: [2, 3, 4],
        minDelay: 10,
        maxDelay: rollingDefaultSeed.maxDelay,
        maxDelayByFingers: ratioMap(rollingDefaultSeed.maxDelay, rollingDefaultRatio.maxDelay),
        keyboardMaxDelay: 500,
        maxHold: rollingDefaultSeed.maxHold,
        maxHoldByFingers: ratioMap(rollingDefaultSeed.maxHold, rollingDefaultRatio.maxHold),
        maxMove: 28,
        minSpan: 24,
        minStep: 10,
        maxGap: rollingDefaultSeed.maxGap,
        maxGapByFingers: ratioMap(rollingDefaultSeed.maxGap, rollingDefaultRatio.maxGap),
        directionRatio: 1.08,
        offAxisRatio: 1.25,
        consumesTap: true
    },
    modifier: {
        enabled: true,
        anchorMove: 10,
        anchorDelay: 180,
        panDelay: 70,
        maxTapTime: 430,
        maxTapMove: 28,
        panThreshold: 12,
        keyboard: {
            enabled: true,
            preventNative: true,
            roles: clone(defaultKeyboardRoles),
            combos: clone(defaultKeyboardCombos)
        }
    },
    pressure: {
        enabled: true,
        threshold: 0.01
    },
    wheel: {
        enabled: true,
        preventDefault: false,
        zoomFactor: 0.0015,
        normalize: true,
        lineHeight: 16,
        pageHeight: 800
    },
    edge: {
        size: 32
    }
};

const motionCandidateRecognizers = ['pan', 'swipe', 'pinch', 'rotate'];

function isPlainObject(value) {
    return value && Object.prototype.toString.call(value) === '[object Object]';
}

function merge(base, extra) {
    const out = clone(base);
    if (!extra) return out;

    Object.keys(extra).forEach(key => {
        const value = extra[key];
        if (isPlainObject(value) && isPlainObject(out[key])) {
            out[key] = merge(out[key], value);
        } else if (Array.isArray(value)) {
            out[key] = value.slice();
        } else {
            out[key] = value;
        }
    });

    return out;
}

function pointDistance(a, b) {
    return hypot(a.x - b.x, a.y - b.y);
}

function pointAngle(a, b) {
    return atan2(b.y - a.y, b.x - a.x) * 180 / PI;
}

function normalizeAngle(angle) {
    let value = angle;
    while (value > 180) value -= 360;
    while (value < -180) value += 360;
    return value;
}

function directionFrom(deltaX, deltaY, ratio) {
    const ax = abs(deltaX);
    const ay = abs(deltaY);
    if (!ax && !ay) return 'none';
    if (ax >= ay * ratio) return deltaX >= 0 ? 'right' : 'left';
    if (ay >= ax * ratio) return deltaY >= 0 ? 'down' : 'up';
    return ax >= ay ? (deltaX >= 0 ? 'right' : 'left') : (deltaY >= 0 ? 'down' : 'up');
}

function strictDirectionFrom(deltaX, deltaY, ratio) {
    const ax = abs(deltaX);
    const ay = abs(deltaY);
    if (!ax && !ay) return 'none';
    if (ax >= ay * ratio) return deltaX >= 0 ? 'right' : 'left';
    if (ay >= ax * ratio) return deltaY >= 0 ? 'down' : 'up';
    return 'none';
}

function axisFrom(direction) {
    if (direction === 'none') return 'none';
    return direction === 'left' || direction === 'right' ? 'x' : 'y';
}

function directionAngle(direction) {
    if (direction === 'right') return 0;
    if (direction === 'down') return 90;
    if (direction === 'left') return 180;
    if (direction === 'up') return -90;
    return 0;
}

function directionTurn(a, b) {
    return abs(normalizeAngle(directionAngle(b) - directionAngle(a)));
}

function oppositeDirection(direction) {
    if (direction === 'right') return 'left';
    if (direction === 'left') return 'right';
    if (direction === 'up') return 'down';
    if (direction === 'down') return 'up';
    return '';
}

function toArray(value) {
    return Array.isArray(value) ? value : [value];
}

function ratioMap(base, ratios) {
    const out = {};
    Object.keys(ratios || {}).forEach(key => {
        out[key] = Math.round(base * ratios[key]);
    });
    return out;
}

function isCardinalDirection(value) {
    return !!pathDirectionSet[String(value || '').toLowerCase()];
}

function isPathDirection(value) {
    return isCardinalDirection(value);
}

function sequenceTokens(type) {
    const value = String(type || '').toLowerCase().trim();
    return value.split('>').map(item => item.trim()).filter(Boolean);
}

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

function clone(value) {
    if (Array.isArray(value)) return value.map(item => clone(item));
    if (isPlainObject(value)) {
        const out = {};
        Object.keys(value).forEach(key => {
            out[key] = clone(value[key]);
        });
        return out;
    }
    return value;
}

function copyKeyboardState(value) {
    if (!value) return null;
    const keys = value.keys ? value.keys.slice() : [];
    return Object.assign({}, value, { keys });
}

function copyKeyboardSubstitute(value) {
    if (!value) return null;
    return Object.assign({}, value, {
        keys: value.keys ? value.keys.slice() : [],
        keyboard: copyKeyboardState(value.keyboard)
    });
}

function normalizeOptionsInput(options) {
    if (options === undefined || options === null) return {};
    if (typeof options === 'string' || typeof options === 'function' || Array.isArray(options)) return { preset: options };
    if (isPlainObject(options)) return options;
    return {};
}

function passiveOption(passive, capture) {
    return { passive: !!passive, capture: !!capture };
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function buttonBit(button) {
    if (button === 0) return 1;
    if (button === 1) return 4;
    if (button === 2) return 2;
    if (button === 3) return 8;
    if (button === 4) return 16;
    return 0;
}

function buttonMask(event) {
    if (event.buttons !== undefined && event.buttons !== null) return event.buttons;
    return buttonBit(event.button);
}

const keyOrder = [KEY_SHIFT, KEY_ALT, KEY_CTRL, KEY_META];
const keyAlias = {
    option: KEY_ALT,
    control: KEY_CTRL,
    cmd: KEY_META,
    command: KEY_META,
    win: KEY_META,
    super: KEY_META
};

function canonicalKey(value) {
    const key = String(value || '').trim().toLowerCase();
    return keyAlias[key] || key;
}

function normalizeCombo(value) {
    const keys = Array.isArray(value) ? value : String(value || '').split('+');
    const set = new Set();
    keys.forEach(key => {
        const normalized = canonicalKey(key);
        if (keyOrder.includes(normalized)) set.add(normalized);
    });
    return keyOrder.filter(key => set.has(key)).join('+');
}

function keyboardState(event) {
    const set = new Set();
    if (event && event.shiftKey) set.add(KEY_SHIFT);
    if (event && event.altKey) set.add(KEY_ALT);
    if (event && event.ctrlKey) set.add(KEY_CTRL);
    if (event && event.metaKey) set.add(KEY_META);
    const keys = keyOrder.filter(key => set.has(key));
    return {
        shift: set.has(KEY_SHIFT),
        alt: set.has(KEY_ALT),
        ctrl: set.has(KEY_CTRL),
        meta: set.has(KEY_META),
        command: set.has(KEY_META),
        keys,
        combo: keys.join('+')
    };
}

function matchValue(value, expected) {
    if (expected === undefined || expected === null) return true;
    if (Array.isArray(expected)) return expected.some(item => matchValue(value, item));
    return value === expected;
}

function matchFingerSource(value, expected) {
    if (expected === undefined || expected === null) return true;
    if (Array.isArray(expected)) return expected.some(item => matchFingerSource(value, item));
    if (expected === 'auto' || expected === 'any') return true;
    return value === expected;
}

function matchCombo(value, expected) {
    if (expected === undefined || expected === null) return true;
    if (Array.isArray(expected)) return expected.some(item => matchCombo(value, item));
    return value === normalizeCombo(expected);
}

function comboEquals(value, expected) {
    if (expected === undefined || expected === null || expected === false) return false;
    if (Array.isArray(expected)) return expected.some(item => comboEquals(value, item));
    return value === normalizeCombo(expected);
}

function pathTokens(value) {
    if (Array.isArray(value)) {
        const tokens = value.map(item => String(item || '').toLowerCase().trim()).filter(Boolean);
        return tokens.length && tokens.every(isPathDirection) ? tokens : [];
    }
    const raw = String(value || '').toLowerCase().trim();
    if (!raw) return [];
    const tokens = raw.split('>').map(item => item.trim()).filter(Boolean);
    return tokens.length && tokens.every(isPathDirection) ? tokens : [];
}

function pathText(value) {
    return pathTokens(value).join('>');
}

function invalidPathPattern(raw) {
    return {
        raw,
        valid: false,
        atoms: [],
        length: 0,
        canonical: ''
    };
}

function parsePathPattern(value) {
    const raw = Array.isArray(value) ? value.map(item => String(item || '').toLowerCase().trim()).filter(Boolean).join('>') : String(value || '').toLowerCase().trim();
    if (!raw) return invalidPathPattern(raw);
    const parts = raw.split('>').map(item => item.trim()).filter(Boolean);
    if (!parts.length) return invalidPathPattern(raw);
    const atoms = [];
    for (let index = 0; index < parts.length; index++) {
        const part = parts[index];
        if (isPathDirection(part)) {
            atoms.push({
                kind: 'direction',
                direction: part,
                length: 1,
                canonical: part
            });
            continue;
        }
        const circle = parseCirclePathToken(part);
        if (circle.valid) {
            atoms.push(circle.atom);
            continue;
        }
        const arc = parseArcPathToken(part);
        if (!arc.valid) return invalidPathPattern(raw);
        atoms.push(arc.atom);
    }
    const canonical = atoms.map(atom => atom.canonical).join('>');
    return {
        raw,
        valid: true,
        atoms,
        length: atoms.reduce((sum, atom) => sum + atom.length, 0),
        canonical
    };
}

function pathPatternText(value) {
    const pattern = parsePathPattern(value);
    return pattern.valid ? pattern.canonical : '';
}

function isPathPatternTokenArray(value) {
    return Array.isArray(value) && value.length > 0 && value.every(item => String(item || '').indexOf('>') < 0) && parsePathPattern(value).valid;
}

function parseCirclePathToken(value) {
    const raw = String(value || '').toLowerCase().trim();
    const parts = raw.split(':').map(item => item.trim());
    if (parts.shift() !== 'circle' || parts.some(item => !item)) return { valid: false };
    const atom = {
        kind: 'circle',
        direction: '',
        count: 1,
        length: 4,
        canonical: 'circle'
    };
    const seen = {};
    for (let index = 0; index < parts.length; index++) {
        const token = parts[index];
        let match = token.match(/^([1-9]\d*)x$/);
        if (match) {
            if (seen.count) return { valid: false };
            seen.count = true;
            atom.count = parseInt(match[1], 10);
            atom.length = atom.count * 4;
            continue;
        }
        if (token === 'cw' || token === 'ccw') {
            if (seen.direction) return { valid: false };
            seen.direction = true;
            atom.direction = token;
            continue;
        }
        return { valid: false };
    }
    atom.canonical = circleAtomText(atom);
    return { valid: true, atom };
}

function circleAtomText(atom) {
    const out = ['circle'];
    if (atom.count !== null && atom.count !== undefined && atom.count !== 1) out.push(atom.count + 'x');
    if (atom.direction) out.push(atom.direction);
    return out.join(':');
}

function parseArcPathToken(value) {
    const raw = String(value || '').toLowerCase().trim();
    const parts = raw.split(':').map(item => item.trim());
    if (parts.shift() !== 'arc' || parts.some(item => !item)) return { valid: false };
    const atom = {
        kind: 'arc',
        direction: '',
        length: 3,
        canonical: 'arc'
    };
    const seen = {};
    for (let index = 0; index < parts.length; index++) {
        const token = parts[index];
        if (isCardinalDirection(token)) {
            if (seen.direction) return { valid: false };
            seen.direction = true;
            atom.direction = token;
            continue;
        }
        return { valid: false };
    }
    atom.canonical = arcAtomText(atom);
    return { valid: true, atom };
}

function arcAtomText(atom) {
    const out = ['arc'];
    if (atom.direction) out.push(atom.direction);
    return out.join(':');
}

function pathMatches(value, expected, detail) {
    if (expected === undefined || expected === null) return true;
    if (Array.isArray(expected) && !isPathPatternTokenArray(expected)) return expected.some(item => pathMatches(value, item, detail));
    const current = pathTokens(value);
    return !!pathPatternSuffixMatch(current, expected, detail);
}

function pathPatternMaxCircleCount(pattern) {
    const parsed = pattern && pattern.valid !== undefined ? pattern : parsePathPattern(pattern);
    if (!parsed.valid) return 0;
    return parsed.atoms.reduce((max, atom) => atom.kind === 'circle' ? Math.max(max, atom.count || 1) : max, 0);
}

function pathPatternSuffixMatch(path, pattern, detail) {
    const parsed = pattern && pattern.valid !== undefined ? pattern : parsePathPattern(pattern);
    if (!parsed.valid || !path || parsed.length > path.length) return null;
    return pathPatternMatchAt(path, parsed, path.length - parsed.length, detail);
}

function pathPatternMatchAt(path, pattern, start, detail) {
    const parsed = pattern && pattern.valid !== undefined ? pattern : parsePathPattern(pattern);
    if (!parsed.valid || !path || start < 0 || start + parsed.length > path.length) return null;
    let index = start;
    const circles = [];
    const arcs = [];
    for (let atomIndex = 0; atomIndex < parsed.atoms.length; atomIndex++) {
        const atom = parsed.atoms[atomIndex];
        if (atom.kind === 'direction') {
            if (path[index] !== atom.direction) return null;
            index++;
            continue;
        }
        const match = atom.kind === 'circle' ? circleAtomMatch(path.slice(index, index + atom.length), atom) : arcAtomMatch(path.slice(index, index + atom.length), atom);
        if (!match) return null;
        const item = Object.assign({}, match, {
            pattern: atom.canonical,
            start: index,
            length: atom.length
        });
        if (atom.kind === 'circle') {
            item.cycles = match.cycles.map(cycle => Object.assign({}, cycle, {
                start: index + cycle.start
            }));
            circles.push(item);
        } else {
            arcs.push(item);
        }
        index += atom.length;
    }
    const tokens = path.slice(start, start + parsed.length);
    return {
        pattern: parsed.canonical,
        start,
        length: parsed.length,
        tokens,
        pathText: tokens.join('>'),
        circles,
        circle: circles[circles.length - 1] || null,
        arcs,
        arc: arcs[arcs.length - 1] || null
    };
}

function pathPatternProgressMatches(pattern, progress, detail) {
    const parsed = pattern && pattern.valid !== undefined ? pattern : parsePathPattern(pattern);
    if (!parsed.valid || !progress || progress.length > parsed.length) return false;
    let offset = 0;
    for (let index = 0; index < parsed.atoms.length; index++) {
        const atom = parsed.atoms[index];
        const remaining = progress.length - offset;
        if (remaining <= 0) return true;
        if (atom.kind === 'direction') {
            if (progress[offset] !== atom.direction) return false;
            offset++;
            continue;
        }
        const length = Math.min(atom.length, remaining);
        const tokens = progress.slice(offset, offset + length);
        if (atom.kind === 'circle' && !circleAtomPrefixMatch(tokens, atom)) return false;
        if (atom.kind === 'arc' && !arcAtomPrefixMatch(tokens, atom)) return false;
        offset += length;
    }
    return offset === progress.length;
}

function circleAtomMatch(tokens, atom) {
    if (!tokens || tokens.length !== atom.length) return null;
    const match = circleTokensMatch(tokens, atom.count, atom.direction, false);
    if (!match) return null;
    return Object.assign(match, {
        path: tokens.slice(),
        pathText: tokens.join('>'),
        startDirection: tokens[0],
        endDirection: tokens[tokens.length - 1]
    });
}

function circleAtomPrefixMatch(tokens, atom) {
    if (!tokens || tokens.length > atom.length) return false;
    return !!circleTokensMatch(tokens, atom.count, atom.direction, true);
}

function arcAtomMatch(tokens, atom) {
    if (!tokens || tokens.length !== atom.length) return null;
    const match = arcTokensMatch(tokens, atom.direction, false);
    if (!match) return null;
    return Object.assign(match, {
        path: tokens.slice(),
        pathText: tokens.join('>'),
        startDirection: tokens[0],
        endDirection: tokens[tokens.length - 1]
    });
}

function arcAtomPrefixMatch(tokens, atom) {
    if (!tokens || tokens.length > atom.length) return false;
    return !!arcTokensMatch(tokens, atom.direction, true);
}

function arcTokensMatch(tokens, direction, partial) {
    if (!partial && (!tokens || tokens.length !== 3)) return null;
    if (partial && (!tokens || tokens.length > 3)) return null;
    const candidates = arcCandidates(direction);
    const match = candidates.find(candidate => tokens.every((token, index) => token === candidate[index]));
    if (!match) return null;
    return {
        direction: match[0],
        tokens: tokens.slice()
    };
}

function arcCandidates(direction) {
    const starts = direction ? [direction] : cardinalDirections;
    const out = [];
    starts.forEach(start => {
        if (!isCardinalDirection(start)) return;
        const end = oppositeDirection(start);
        cardinalDirections.forEach(middle => {
            if (middle !== start && middle !== end) out.push([start, middle, end]);
        });
    });
    return out;
}

function circleTokensMatch(tokens, count, direction, partial) {
    const circleCount = Math.max(1, count || 1);
    const maxLength = circleCount * 4;
    if (!partial && tokens.length !== maxLength) return null;
    if (partial && tokens.length > maxLength) return null;
    let resolved = '';
    const cycles = [];
    for (let index = 0; index < tokens.length; index += 4) {
        const cycle = tokens.slice(index, Math.min(index + 4, tokens.length));
        if (cycle.length < 4) {
            if (!circleCyclePrefixMatches(cycle, direction || resolved)) return null;
            return {
                direction: resolved || direction || '',
                count: circleCount,
                tokens: tokens.slice(),
                cycles
            };
        }
        const cycleDirection = circleDirection(cycle);
        if (!cycleDirection) return null;
        if (direction && cycleDirection !== direction) return null;
        if (resolved && cycleDirection !== resolved) return null;
        resolved = cycleDirection;
        cycles.push({
            direction: cycleDirection,
            startDirection: cycle[0],
            endDirection: cycle[cycle.length - 1],
            path: cycle.slice(),
            pathText: cycle.join('>'),
            start: index,
            length: 4
        });
    }
    return {
        direction: resolved || direction || '',
        count: circleCount,
        tokens: tokens.slice(),
        cycles
    };
}

function circleCyclePrefixMatches(tokens, direction) {
    if (!tokens || !tokens.length) return true;
    const directions = direction ? [direction] : circleDirections;
    return directions.some(item => {
        const cycle = circleCycle(item);
        return cycle.some((_, index) => tokens.every((token, offset) => token === cycle[(index + offset) % cycle.length]));
    });
}

function circleCycle(direction) {
    return direction === 'ccw' ? ['right', 'up', 'left', 'down'] : ['right', 'down', 'left', 'up'];
}

function circleDirection(tokens) {
    const path = pathTokens(tokens);
    if (path.length !== 4) return '';
    const cw = circleCycle('cw');
    const ccw = circleCycle('ccw');
    if (circleCycleMatches(path, cw)) return 'cw';
    if (circleCycleMatches(path, ccw)) return 'ccw';
    return '';
}

function circleCycleMatches(path, cycle) {
    const start = cycle.indexOf(path[0]);
    if (start < 0) return false;
    return path.every((token, index) => token === cycle[(start + index) % cycle.length]);
}

function pointSnapshot(point) {
    return {
        pageX: point.pageX,
        pageY: point.pageY,
        clientX: point.clientX,
        clientY: point.clientY,
        localX: point.localX,
        localY: point.localY,
        ratioX: point.ratioX,
        ratioY: point.ratioY,
        clampedRatioX: point.clampedRatioX,
        clampedRatioY: point.clampedRatioY,
        region: point.region,
        halfRegion: point.halfRegion,
        edgeRegion: point.edgeRegion,
        area: point.area
    };
}

function phaseDX(point) {
    return point.x - (point.phaseStartX !== undefined ? point.phaseStartX : point.startX);
}

function phaseDY(point) {
    return point.y - (point.phaseStartY !== undefined ? point.phaseStartY : point.startY);
}

function gridFor(point, options) {
    const opt = options || {};
    const rows = Math.max(1, opt.rows || 3);
    const cols = Math.max(1, opt.cols || 3);
    const x = clamp(point && point.clampedRatioX !== undefined ? point.clampedRatioX : point && point.ratioX !== undefined ? point.ratioX : 0, 0, 1);
    const y = clamp(point && point.clampedRatioY !== undefined ? point.clampedRatioY : point && point.ratioY !== undefined ? point.ratioY : 0, 0, 1);
    const col = Math.min(cols - 1, Math.floor(x * cols));
    const row = Math.min(rows - 1, Math.floor(y * rows));
    return {
        row,
        col,
        rows,
        cols,
        index: row * cols + col
    };
}

function gridCellName(cell) {
    const rowName = cell.row === 0 ? 'top' : cell.row === cell.rows - 1 ? 'bottom' : cell.rows % 2 === 1 && cell.row === Math.floor(cell.rows / 2) ? 'center' : 'row' + cell.row;
    const colName = cell.col === 0 ? 'left' : cell.col === cell.cols - 1 ? 'right' : cell.cols % 2 === 1 && cell.col === Math.floor(cell.cols / 2) ? 'center' : 'col' + cell.col;
    if (rowName === 'center' && colName === 'center') return 'center';
    if (rowName === 'center') return colName;
    if (colName === 'center') return rowName;
    return rowName + '-' + colName;
}

const invalidCriteria = Object.freeze({ __handtrickInvalidCriteria: true });
const locationPhaseKeys = listSet(['current', 'start', 'tapStart', 'sequenceStart']);
const gridCriteriaKeys = listSet(['rows', 'cols', 'row', 'col', 'index', 'cell']);
const gridFilterKeys = ['row', 'col', 'index', 'cell'];
const compoundGridKeys = listSet(['rows', 'cols', 'row', 'col', 'index', 'cell', 'current', 'start', 'tapStart', 'sequenceStart']);

function isInvalidCriteria(value) {
    return value === invalidCriteria || !!(value && value.__handtrickInvalidCriteria);
}

function cloneCriteriaValue(value) {
    if (Array.isArray(value)) return value.map(cloneCriteriaValue);
    if (isPlainObject(value)) {
        const out = {};
        Object.keys(value).forEach(key => {
            out[key] = cloneCriteriaValue(value[key]);
        });
        return out;
    }
    return value;
}

function criteriaValueStableKey(value) {
    if (Array.isArray(value)) return '[' + value.map(criteriaValueStableKey).sort().join('|') + ']';
    if (isPlainObject(value)) return '{' + Object.keys(value).sort().map(key => key + ':' + criteriaValueStableKey(value[key])).join('|') + '}';
    return typeof value + ':' + String(value);
}

function criteriaValuesEqual(a, b) {
    return criteriaValueStableKey(a) === criteriaValueStableKey(b);
}

function gridHasFilter(value) {
    return gridFilterKeys.some(key => value[key] !== undefined && value[key] !== null);
}

function gridObjectKeysKnown(value) {
    return isPlainObject(value) && Object.keys(value).every(key => gridCriteriaKeys[key]);
}

function normalizeGridLeafObject(value, parent) {
    if (!gridObjectKeysKnown(value)) return { valid: false };
    const out = {};
    const inherited = parent || {};
    if (value.rows !== undefined) out.rows = cloneCriteriaValue(value.rows);
    else if (inherited.rows !== undefined) out.rows = cloneCriteriaValue(inherited.rows);
    if (value.cols !== undefined) out.cols = cloneCriteriaValue(value.cols);
    else if (inherited.cols !== undefined) out.cols = cloneCriteriaValue(inherited.cols);
    gridFilterKeys.forEach(key => {
        if (value[key] !== undefined && value[key] !== null) out[key] = cloneCriteriaValue(value[key]);
    });
    if (!gridHasFilter(out)) return { valid: false };
    return { valid: true, value: out };
}

function gridLeafFromCompound(value) {
    const out = {};
    ['rows', 'cols'].concat(gridFilterKeys).forEach(key => {
        if (value[key] !== undefined && value[key] !== null) out[key] = cloneCriteriaValue(value[key]);
    });
    return out;
}

function normalizeLegacyGridCriteria(criteria) {
    if (criteria === undefined || criteria === null) return { valid: true, value: criteria };
    if (Array.isArray(criteria)) {
        const out = [];
        for (let index = 0; index < criteria.length; index++) {
            const item = normalizeLegacyGridCriteria(criteria[index]);
            if (!item.valid) return { valid: false };
            out.push(item.value);
        }
        return { valid: true, value: out };
    }
    if (typeof criteria === 'number') return { valid: true, value: { index: criteria } };
    if (typeof criteria === 'string') return { valid: true, value: criteria };
    if (isPlainObject(criteria)) return normalizeGridLeafObject(criteria);
    return { valid: true, value: { cell: criteria } };
}

function gridContext(parent) {
    const opt = parent || {};
    const hasRows = opt.rows !== undefined && opt.rows !== null;
    const hasCols = opt.cols !== undefined && opt.cols !== null;
    const rows = Math.max(1, opt.rows || 3);
    const cols = Math.max(1, opt.cols || 3);
    const base = {};
    if (hasRows) base.rows = cloneCriteriaValue(opt.rows);
    if (hasCols) base.cols = cloneCriteriaValue(opt.cols);
    return { rows, cols, base };
}

function uniqueNumbers(values) {
    const seen = {};
    return values.filter(value => {
        const key = String(value);
        if (seen[key]) return false;
        seen[key] = true;
        return true;
    });
}

function singleOrArray(values) {
    const out = uniqueNumbers(values);
    return out.length === 1 ? out[0] : out;
}

function middleCells(size) {
    const mid = Math.floor(size / 2);
    return size % 2 ? [mid] : [mid - 1, mid];
}

function gridTokenCriteria(value, parent) {
    const token = String(value || '').toLowerCase().trim();
    const context = gridContext(parent);
    const rows = context.rows;
    const cols = context.cols;
    const base = context.base;
    const rowLast = rows - 1;
    const colLast = cols - 1;
    const corner = token.match(/^(top|bottom)-(left|right)$/);
    const rowMatch = token.match(/^row(\d+)$/);
    const colMatch = token.match(/^col(\d+)$/);
    const cellMatch = token.match(/^row(\d+)-col(\d+)$/);

    if (token === 'any') return Object.assign({}, base, { row: singleOrArray(Array.from({ length: rows }, (_, index) => index)) });
    if (token === 'top') return Object.assign({}, base, { row: 0 });
    if (token === 'bottom') return Object.assign({}, base, { row: rowLast });
    if (token === 'left') return Object.assign({}, base, { col: 0 });
    if (token === 'right') return Object.assign({}, base, { col: colLast });
    if (token === 'center') return Object.assign({}, base, { row: singleOrArray(middleCells(rows)), col: singleOrArray(middleCells(cols)) });
    if (token === 'edge') return [
        Object.assign({}, base, { row: singleOrArray([0, rowLast]) }),
        Object.assign({}, base, { col: singleOrArray([0, colLast]) })
    ];
    if (corner) {
        return Object.assign({}, base, {
            row: corner[1] === 'top' ? 0 : rowLast,
            col: corner[2] === 'left' ? 0 : colLast
        });
    }
    if (rowMatch) return Object.assign({}, base, { row: parseInt(rowMatch[1], 10) });
    if (colMatch) return Object.assign({}, base, { col: parseInt(colMatch[1], 10) });
    if (cellMatch) return Object.assign({}, base, { row: parseInt(cellMatch[1], 10), col: parseInt(cellMatch[2], 10) });
    return null;
}

function normalizeGridPhaseLocation(value, parent) {
    if (Array.isArray(value)) {
        const out = [];
        for (let index = 0; index < value.length; index++) {
            const item = normalizeGridPhaseLocation(value[index], parent);
            if (!item.valid) return { valid: false };
            if (Array.isArray(item.value)) out.push.apply(out, item.value);
            else out.push(item.value);
        }
        return { valid: true, value: out };
    }
    if (typeof value === 'number') return { valid: true, value: Object.assign({}, parent || {}, { index: value }) };
    if (typeof value === 'string') {
        const criteria = gridTokenCriteria(value, parent);
        return criteria ? { valid: true, value: criteria } : { valid: false };
    }
    if (isPlainObject(value)) return normalizeGridLeafObject(value, parent);
    return { valid: false };
}

function intersectCriteriaValue(a, b) {
    if (criteriaValuesEqual(a, b)) return { valid: true, value: cloneCriteriaValue(a) };
    const left = Array.isArray(a) ? a : [a];
    const right = Array.isArray(b) ? b : [b];
    const rightSet = right.reduce((out, item) => {
        out[criteriaValueStableKey(item)] = true;
        return out;
    }, {});
    const intersection = left.filter(item => rightSet[criteriaValueStableKey(item)]);
    if (!intersection.length) return { valid: false };
    return { valid: true, value: intersection.length === 1 ? cloneCriteriaValue(intersection[0]) : intersection.map(cloneCriteriaValue) };
}

function mergeGridLeafObjects(a, b) {
    const left = normalizeLegacyGridCriteria(a);
    const right = normalizeLegacyGridCriteria(b);
    if (!left.valid || !right.valid || !isPlainObject(left.value) || !isPlainObject(right.value)) return { valid: false };
    const out = {};
    const keys = ['rows', 'cols'].concat(gridFilterKeys);
    for (let index = 0; index < keys.length; index++) {
        const key = keys[index];
        const leftValue = left.value[key];
        const rightValue = right.value[key];
        if (leftValue === undefined || leftValue === null) {
            if (rightValue !== undefined && rightValue !== null) out[key] = cloneCriteriaValue(rightValue);
            continue;
        }
        if (rightValue === undefined || rightValue === null) {
            out[key] = cloneCriteriaValue(leftValue);
            continue;
        }
        const merged = intersectCriteriaValue(leftValue, rightValue);
        if (!merged.valid) return { valid: false };
        out[key] = merged.value;
    }
    return gridHasFilter(out) ? { valid: true, value: out } : { valid: false };
}

function mergeGridCriteria(a, b) {
    if (a === undefined || a === null) return { valid: true, value: cloneCriteriaValue(b) };
    if (b === undefined || b === null) return { valid: true, value: cloneCriteriaValue(a) };
    const left = Array.isArray(a) ? a : [a];
    const right = Array.isArray(b) ? b : [b];
    const out = [];
    const seen = {};
    for (let leftIndex = 0; leftIndex < left.length; leftIndex++) {
        for (let rightIndex = 0; rightIndex < right.length; rightIndex++) {
            const merged = mergeGridLeafObjects(left[leftIndex], right[rightIndex]);
            if (!merged.valid) continue;
            const key = criteriaValueStableKey(merged.value);
            if (seen[key]) continue;
            seen[key] = true;
            out.push(merged.value);
        }
    }
    if (!out.length) return { valid: false };
    return { valid: true, value: out.length === 1 ? out[0] : out };
}

function normalizeGridCriteria(value) {
    if (!isPlainObject(value)) {
        const legacy = normalizeLegacyGridCriteria(value);
        return legacy.valid ? { valid: true, filters: { grid: legacy.value } } : { valid: false };
    }
    if (!Object.keys(value).every(key => compoundGridKeys[key])) return { valid: false };
    const hasPhase = Object.keys(locationPhaseKeys).some(key => value[key] !== undefined && value[key] !== null);
    const hasLegacyFilter = gridFilterKeys.some(key => value[key] !== undefined && value[key] !== null);

    if (!hasPhase) {
        const legacy = normalizeLegacyGridCriteria(value);
        return legacy.valid ? { valid: true, filters: { grid: legacy.value } } : { valid: false };
    }

    const parent = {};
    if (value.rows !== undefined && value.rows !== null) parent.rows = cloneCriteriaValue(value.rows);
    if (value.cols !== undefined && value.cols !== null) parent.cols = cloneCriteriaValue(value.cols);

    const filters = {};
    if (hasLegacyFilter) {
        const current = normalizeGridLeafObject(gridLeafFromCompound(value));
        if (!current.valid) return { valid: false };
        filters.grid = current.value;
    }

    const phaseMap = {
        current: 'grid',
        start: 'startGrid',
        tapStart: 'tapStartGrid',
        sequenceStart: 'sequenceStartGrid'
    };

    for (let index = 0; index < Object.keys(phaseMap).length; index++) {
        const phase = Object.keys(phaseMap)[index];
        if (value[phase] === undefined || value[phase] === null) continue;
        const normalized = normalizeGridPhaseLocation(value[phase], parent);
        if (!normalized.valid) return { valid: false };
        const key = phaseMap[phase];
        if (filters[key] === undefined) {
            filters[key] = normalized.value;
            continue;
        }
        const merged = mergeGridCriteria(filters[key], normalized.value);
        if (!merged.valid) return { valid: false };
        filters[key] = merged.value;
    }

    return Object.keys(filters).length ? { valid: true, filters } : { valid: false };
}

function normalizePhaseLocation(value, keys) {
    if (!isPlainObject(value)) return { valid: true, filters: { current: cloneCriteriaValue(value) } };
    if (!Object.keys(value).every(key => locationPhaseKeys[key])) return { valid: false };
    const filters = {};
    Object.keys(locationPhaseKeys).forEach(key => {
        if (value[key] !== undefined && value[key] !== null) filters[key] = cloneCriteriaValue(value[key]);
    });
    return Object.keys(filters).length ? { valid: true, filters } : { valid: false };
}

function mergeSimpleCriteria(existing, value) {
    if (existing === undefined || existing === null) return { valid: true, value: cloneCriteriaValue(value) };
    if (value === undefined || value === null) return { valid: true, value: cloneCriteriaValue(existing) };
    return intersectCriteriaValue(existing, value);
}

function addSimpleCriteria(out, key, value) {
    if (value === undefined || value === null) return true;
    const merged = mergeSimpleCriteria(out[key], value);
    if (!merged.valid) return false;
    out[key] = merged.value;
    return true;
}

function addGridCriteria(out, key, value) {
    if (value === undefined || value === null) return true;
    if (out[key] === undefined) {
        out[key] = cloneCriteriaValue(value);
        return true;
    }
    const merged = mergeGridCriteria(out[key], value);
    if (!merged.valid) return false;
    out[key] = merged.value;
    return true;
}

function mergeSequenceStepCriteria(a, b) {
    if (!a) return { valid: true, value: cloneCriteriaValue(b) };
    if (!b) return { valid: true, value: cloneCriteriaValue(a) };
    if (!criteriaKeysKnown(a, sequenceStepCriteriaKeys) || !criteriaKeysKnown(b, sequenceStepCriteriaKeys)) return { valid: false };
    const out = cloneCriteriaValue(a);
    const keys = Object.keys(b);
    for (let index = 0; index < keys.length; index++) {
        const key = keys[index];
        if (key === 'grid') {
            const merged = mergeGridCriteria(out.grid, b.grid);
            if (!merged.valid) return { valid: false };
            out.grid = merged.value;
        } else {
            const merged = mergeSimpleCriteria(out[key], b[key]);
            if (!merged.valid) return { valid: false };
            out[key] = merged.value;
        }
    }
    return { valid: true, value: out };
}

function mergeSequenceCriteria(existing, incoming) {
    if (existing === undefined || existing === null) return { valid: true, value: cloneCriteriaValue(incoming) };
    if (incoming === undefined || incoming === null) return { valid: true, value: cloneCriteriaValue(existing) };
    if (Array.isArray(existing) && isPlainObject(incoming)) {
        if (!criteriaKeysKnown(incoming, sequenceCriteriaKeys)) return { valid: false };
        const out = cloneCriteriaValue(incoming);
        if (out.steps !== undefined) return { valid: false };
        out.steps = cloneCriteriaValue(existing);
        return { valid: true, value: out };
    }
    if (Array.isArray(incoming) && isPlainObject(existing)) {
        if (!criteriaKeysKnown(existing, sequenceCriteriaKeys)) return { valid: false };
        const out = cloneCriteriaValue(existing);
        if (out.steps !== undefined) return { valid: false };
        out.steps = cloneCriteriaValue(incoming);
        return { valid: true, value: out };
    }
    if (!isPlainObject(existing) || !isPlainObject(incoming) || !criteriaKeysKnown(existing, sequenceCriteriaKeys) || !criteriaKeysKnown(incoming, sequenceCriteriaKeys)) return { valid: false };
    const out = cloneCriteriaValue(existing);
    const keys = Object.keys(incoming);
    for (let index = 0; index < keys.length; index++) {
        const key = keys[index];
        if (key === 'start' || key === 'end') {
            const merged = mergeSequenceStepCriteria(out[key], incoming[key]);
            if (!merged.valid) return { valid: false };
            out[key] = merged.value;
        } else if (out[key] === undefined) {
            out[key] = cloneCriteriaValue(incoming[key]);
        } else if (!criteriaValuesEqual(out[key], incoming[key])) {
            return { valid: false };
        }
    }
    return { valid: true, value: out };
}

function addSequenceCriteria(out, value) {
    const merged = mergeSequenceCriteria(out.sequence, value);
    if (!merged.valid) return false;
    out.sequence = merged.value;
    return true;
}

function addSequenceStartCriteria(out, key, value) {
    return addSequenceCriteria(out, { start: { [key]: value } });
}

function normalizeCriteria(criteria) {
    if (criteria === undefined || criteria === null) return null;
    if (isInvalidCriteria(criteria)) return invalidCriteria;
    if (!criteriaKeysKnown(criteria, criteriaKeys)) return invalidCriteria;

    const out = {};
    const keys = Object.keys(criteria);
    for (let index = 0; index < keys.length; index++) {
        const key = keys[index];
        const value = criteria[key];

        if (key === 'region' || key === 'area') {
            const normalized = normalizePhaseLocation(value);
            if (!normalized.valid) return invalidCriteria;
            const topKey = key;
            const startKey = key === 'region' ? 'startRegion' : 'startArea';
            const tapStartKey = key === 'region' ? 'tapStartRegion' : 'tapStartArea';
            if (!addSimpleCriteria(out, topKey, normalized.filters.current)) return invalidCriteria;
            if (!addSimpleCriteria(out, startKey, normalized.filters.start)) return invalidCriteria;
            if (!addSimpleCriteria(out, tapStartKey, normalized.filters.tapStart)) return invalidCriteria;
            if (normalized.filters.sequenceStart !== undefined && !addSequenceStartCriteria(out, key, normalized.filters.sequenceStart)) return invalidCriteria;
            continue;
        }

        if (key === 'grid') {
            const normalized = normalizeGridCriteria(value);
            if (!normalized.valid) return invalidCriteria;
            if (!addGridCriteria(out, 'grid', normalized.filters.grid)) return invalidCriteria;
            if (!addGridCriteria(out, 'startGrid', normalized.filters.startGrid)) return invalidCriteria;
            if (!addGridCriteria(out, 'tapStartGrid', normalized.filters.tapStartGrid)) return invalidCriteria;
            if (normalized.filters.sequenceStartGrid !== undefined && !addSequenceStartCriteria(out, 'grid', normalized.filters.sequenceStartGrid)) return invalidCriteria;
            continue;
        }

        if (key === 'startGrid' || key === 'tapStartGrid') {
            const normalized = normalizeLegacyGridCriteria(value);
            if (!normalized.valid || !addGridCriteria(out, key, normalized.value)) return invalidCriteria;
            continue;
        }

        if (key === 'sequenceStartGrid') {
            const normalized = normalizeLegacyGridCriteria(value);
            if (!normalized.valid || !addSequenceStartCriteria(out, 'grid', normalized.value)) return invalidCriteria;
            continue;
        }

        if (key === 'sequence') {
            if (!addSequenceCriteria(out, value)) return invalidCriteria;
            continue;
        }

        if (!addSimpleCriteria(out, key, value)) return invalidCriteria;
    }

    return out;
}

function gridMatchesNormalized(point, criteria) {
    const opt = isPlainObject(criteria) ? criteria : { cell: criteria };
    if (!gridObjectKeysKnown(opt) || !gridHasFilter(opt)) return false;
    const cell = gridFor(point, { rows: opt.rows || 3, cols: opt.cols || 3 });
    if (opt.index !== undefined && !matchValue(cell.index, opt.index)) return false;
    if (opt.row !== undefined && !matchValue(cell.row, opt.row)) return false;
    if (opt.col !== undefined && !matchValue(cell.col, opt.col)) return false;
    if (opt.cell !== undefined && !matchValue(gridCellName(cell), opt.cell)) return false;
    return true;
}

function gridMatches(point, criteria) {
    if (!point || criteria === undefined || criteria === null) return false;
    const normalized = normalizeLegacyGridCriteria(criteria);
    if (!normalized.valid) return false;
    if (Array.isArray(normalized.value)) return normalized.value.length > 0 && normalized.value.some(item => gridMatchesNormalized(point, item));
    return gridMatchesNormalized(point, normalized.value);
}

function tapStartPoint(event) {
    const taps = event && event.tapSequence && event.tapSequence.taps;
    return taps && taps[0] ? taps[0].center : null;
}

function collectPresetOptions(preset) {
    let out = {};
    if (preset === undefined || preset === null || preset === false) return out;
    toArray(preset).forEach(item => {
        if (!item) return;
        if (typeof item === 'string') {
            if (!presetRegistry[item]) throw new Error('Unknown HandTrick preset: ' + item);
            out = merge(out, presetRegistry[item]());
        } else if (typeof item === 'function') {
            out = merge(out, item());
        } else if (isPlainObject(item)) {
            out = merge(out, item);
        }
    });
    return out;
}

function resolveOptions(options) {
    const source = clone(normalizeOptionsInput(options));
    const preset = source.preset !== undefined ? source.preset : source.presets;
    delete source.preset;
    delete source.presets;
    return normalizeResolvedOptions(merge(merge(defaults, collectPresetOptions(preset)), source));
}

function resolvePartialOptions(options) {
    const source = clone(normalizeOptionsInput(options));
    const preset = source.preset !== undefined ? source.preset : source.presets;
    delete source.preset;
    delete source.presets;
    return normalizeResolvedOptions(merge(collectPresetOptions(preset), source));
}

function normalizeResolvedOptions(options) {
    if (options && options.path && options.path.consume !== undefined) {
        options.path.consume = normalizePathConsumeMode(options.path.consume);
    }
    return options;
}

const presetRegistry = {
    media(options) {
        return merge({
            preventDefault: false,
            claim: { enabled: true, threshold: 0.5, preventDefault: true },
            press: { enabled: false },
            pan: { threshold: 15, fingers: [1], canStart: event => event.tapHold },
            rotate: { enabled: false }
        }, options || {});
    },
    viewer(options) {
        return merge({
            wheel: { enabled: true, preventDefault: true },
            pan: { axis: 'free', fingers: [1], canStart: () => true },
            swipe: { enabled: false }
        }, options || {});
    },
    carousel(options) {
        return merge({
            preventDefault: false,
            claim: { enabled: true, threshold: 0.55, preventDefault: true },
            pan: { enabled: false },
            pinch: { enabled: false },
            rotate: { enabled: false },
            swipe: { axisRatio: 1.25 }
        }, options || {});
    },
    drawing(options) {
        return merge({
            pan: { threshold: 4, minTime: 0, minSamples: 1, fingers: [1] },
            swipe: { enabled: false },
            pinch: { enabled: false },
            rotate: { enabled: false },
            pressure: { enabled: true, threshold: 0.005 }
        }, options || {});
    },
    map(options) {
        return merge({
            wheel: { enabled: true, preventDefault: true },
            pan: { fingers: [1, 2], canStart: () => true },
            pinch: { enabled: true },
            rotate: { enabled: true },
            swipe: { enabled: false }
        }, options || {});
    }
};

class HandTrick {
    constructor(target, options) {
        if (target && target.target) {
            options = target;
            target = options.target;
        }

        if (!target || !target.addEventListener) {
            throw new Error('HandTrick requires an EventTarget');
        }

        this.target = target;
        this.explicitGestureDisabled = new Set();
        this.updateExplicitGestureToggles(options || {});
        this.options = resolveOptions(options || {});
        this.listeners = new Map();
        this.listenerOrder = 0;
        this.onceWrappers = new Map();
        this.native = [];
        this.points = new Map();
        this.pointCache = [];
        this.pointsDirty = true;
        this.session = null;
        this.staticRect = null;
        this.tapMemory = null;
        this.gestureSequence = [];
        this.pendingEmits = [];
        this.pendingEmitTimer = null;
        this.intentCache = null;
        this.lastTap = null;
        this.nativeTapMemory = null;
        this.lastTouchInput = -Infinity;
        this.destroyed = false;
        this.styles = {
            target: [],
            active: []
        };
        this.domNative = {
            target: [],
            active: []
        };
        this.enabled = !!this.options.enabled;
        this.pointerMode = this.resolveInputMode();
        this.bound = {
            pointerdown: event => this.pointerDown(event),
            pointermove: event => this.pointerMove(event),
            pointerup: event => this.pointerUp(event),
            pointercancel: event => this.pointerCancel(event),
            mousedown: event => this.mouseDown(event),
            mousemove: event => this.mouseMove(event),
            mouseup: event => this.mouseUp(event),
            touchstart: event => this.touchStart(event),
            touchmove: event => this.touchMove(event),
            touchend: event => this.touchEnd(event),
            touchcancel: event => this.touchCancel(event),
            wheel: event => this.wheel(event),
            tapguard: event => this.guardNativeTap(event),
            suppressselection: event => this.suppressNativeSelection(event),
            clearselection: () => this.clearNativeSelection()
        };

        if (this.enabled) this.applyTargetStyles();
        this.bind();
    }

    static get defaults() {
        return merge(defaults);
    }

    static create(target, options) {
        return new HandTrick(target, options);
    }

    static preset(name, options) {
        return resolvePartialOptions(options === undefined ? name : [name, options]);
    }

    time() {
        return typeof this.options.clock === 'function' ? this.options.clock() : now();
    }

    resolveInputMode() {
        if (this.options.input === 'pointer') return 'pointer';
        if (this.options.input === 'touch') return 'touch';
        if (this.options.input === 'mouse') return 'mouse';
        if (this.options.input === 'hybrid') return 'hybrid';
        return typeof PointerEvent !== 'undefined' ? 'pointer' : 'hybrid';
    }

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

    wheel(event) {
        if (!this.enabled) return;
        if (this.isIgnored(event, event.target)) {
            this.emit('input:ignored', {
                originalEvent: event,
                target: event.target,
                currentTarget: this.target,
                pointerType: 'wheel',
                reason: 'ignore',
                phase: 'cancelled'
            });
            return;
        }
        if (!this.allowsGesture('wheel')) return;
        this.prepareEvent(event, this.options.wheel.preventDefault);

        const rect = this.rect();
        const rawDeltaX = event.deltaX || 0;
        const rawDeltaY = event.deltaY || event.detail || 0;
        const rawDeltaZ = event.deltaZ || 0;
        const mode = event.deltaMode || 0;
        const deltaX = this.wheelPixels(rawDeltaX, mode, rect);
        const delta = this.wheelPixels(rawDeltaY, mode, rect);
        const deltaZ = this.wheelPixels(rawDeltaZ, mode, rect);
        const scale = Math.exp(-delta * this.options.wheel.zoomFactor);
        const center = this.positionDetail({
            x: event.pageX !== undefined ? event.pageX : event.clientX,
            y: event.pageY !== undefined ? event.pageY : event.clientY,
            clientX: event.clientX || 0,
            clientY: event.clientY || 0
        }, rect);
        const keyboard = keyboardState(event);
        const detail = {
            type: 'wheel',
            originalEvent: event,
            target: event.target,
            currentTarget: this.target,
            pointerType: 'wheel',
            fingers: 0,
            maxFingers: 0,
            pointers: [],
            activePointers: [],
            deltaX,
            deltaY: delta,
            deltaZ,
            rawDeltaX,
            rawDeltaY,
            rawDeltaZ,
            deltaMode: mode,
            scale,
            scaleDelta: scale - 1,
            center,
            startCenter: Object.assign({}, center),
            previousCenter: Object.assign({}, center),
            region: center.region,
            startRegion: center.region,
            previousRegion: center.region,
            area: center.area,
            startArea: center.area,
            edge: center.edge,
            startEdge: center.edge,
            edgeRegion: center.edgeRegion,
            startEdgeRegion: center.edgeRegion,
            halfX: center.halfX,
            halfY: center.halfY,
            halfRegion: center.halfRegion,
            thirdX: center.thirdX,
            thirdY: center.thirdY,
            keys: keyboard.keys.slice(),
            keyCombo: keyboard.combo,
            keyboard: Object.assign({}, keyboard, { keys: keyboard.keys.slice() }),
            direction: directionFrom(deltaX, delta, this.options.swipe.axisRatio),
            axis: axisFrom(directionFrom(deltaX, delta, this.options.swipe.axisRatio)),
            phase: 'active',
            intent: {
                gesture: scale !== 1 ? 'wheel:zoom' : 'wheel',
                committedAt: this.time(),
                possible: ['wheel'],
                pruned: this.intentState().pruned,
                samples: 1
            },
            confidence: 1,
            confidences: { pan: 0, pinch: 0, rotate: 0, swipe: 0 },
            topology: {
                added: 0,
                removed: 0,
                total: 0,
                max: 0
            },
            rect,
            preventDefault: () => {
                if (event.cancelable) event.preventDefault();
            },
            stopPropagation: () => {
                if (event.stopPropagation) event.stopPropagation();
            }
        };

        this.emit('gesture:commit', Object.assign({}, detail, { gesture: scale !== 1 ? 'wheel:zoom' : 'wheel' }));
        this.recordGestureSequence(scale !== 1 ? 'wheel:zoom' : 'wheel', detail, 1);
        this.emit('wheel', detail);
        if (scale !== 1) this.emit('wheel:zoom', detail);
    }

    wheelPixels(value, mode, rect) {
        if (!this.options.wheel.normalize) return value;
        if (mode === 1) return value * (this.options.wheel.lineHeight || 16);
        if (mode === 2) return value * (rect.height || this.options.wheel.pageHeight || 800);
        return value;
    }

    pointerId(event) {
        return event.pointerId !== undefined ? event.pointerId : 'mouse';
    }

    eventPoint(event) {
        return {
            x: event.pageX,
            y: event.pageY,
            clientX: event.clientX,
            clientY: event.clientY,
            screenX: event.screenX || 0,
            screenY: event.screenY || 0,
            pointerType: event.pointerType || 'mouse',
            pressure: event.pressure || 0,
            tangentialPressure: event.tangentialPressure || 0,
            tiltX: event.tiltX || 0,
            tiltY: event.tiltY || 0,
            twist: event.twist || 0,
            width: event.width || 1,
            height: event.height || 1
        };
    }

    touchPoint(touch) {
        return {
            x: touch.pageX,
            y: touch.pageY,
            clientX: touch.clientX,
            clientY: touch.clientY,
            screenX: touch.screenX || 0,
            screenY: touch.screenY || 0,
            pointerType: 'touch',
            pressure: touch.force || 0,
            tangentialPressure: 0,
            tiltX: 0,
            tiltY: 0,
            twist: 0,
            width: touch.radiusX || 1,
            height: touch.radiusY || 1
        };
    }

    addPoint(id, input, event, raw) {
        const time = this.time();
        const point = {
            id,
            target: raw && raw.target ? raw.target : event.target,
            startTarget: raw && raw.target ? raw.target : event.target,
            startTime: time,
            time,
            startX: input.x,
            startY: input.y,
            startClientX: input.clientX,
            startClientY: input.clientY,
            phaseStartX: input.x,
            phaseStartY: input.y,
            phaseStartClientX: input.clientX,
            phaseStartClientY: input.clientY,
            previousX: input.x,
            previousY: input.y,
            previousClientX: input.clientX,
            previousClientY: input.clientY,
            x: input.x,
            y: input.y,
            clientX: input.clientX,
            clientY: input.clientY,
            screenX: input.screenX,
            screenY: input.screenY,
            pointerType: input.pointerType,
            pressure: input.pressure,
            previousPressure: input.pressure,
            tangentialPressure: input.tangentialPressure,
            tiltX: input.tiltX,
            tiltY: input.tiltY,
            twist: input.twist,
            width: input.width,
            height: input.height
        };

        const activeBefore = this.session ? this.pointList() : [];
        if (this.session) {
            this.endRunningGestures(event);
            this.releaseKeyboardModifierForMultiTouch();
        }

        this.points.set(id, point);
        this.pointsDirty = true;

        if (!this.session) {
            this.activateGestureStyles();
            this.session = this.createSession(time, event, point);
            this.session.rolling = this.createRollingState(id, point, time);
            this.resetBasis(time);
            this.session.tapHold = this.isTapHoldStart(point, time);
            this.session.tapChain = this.isTapChainStart(point, time);
            if (!this.session.keyboardSubstitute) this.startKeyboardModifier(id, point, event, time);
            const keyboardOpt = this.options.modifier.keyboard || {};
            if (this.session.tapHold || this.session.tapChain || ((this.session.keyboardModifier || this.session.keyboardSubstitute) && keyboardOpt.preventNative !== false)) this.suppressNative(event);
            if (!this.session.keyboardModifier) this.armPress(event);
            const detail = this.detail('session:start', { originalEvent: event, added: 1, removed: 0, changedPointer: this.exportPoint(point, this.rect()) });
            this.emit('session:start', detail);
            this.emit('gesture:start', Object.assign({}, detail, { gesture: 'session' }));
        } else {
            this.cancelPress('fingers:change');
            this.session.releaseGuard = null;
            this.startModifier(id, point, activeBefore, time);
            this.addRollingPoint(id, point, time);
            this.resetBasis(time);
            const detail = this.detail('fingers:change', { originalEvent: event, change: 'add', added: 1, removed: 0, changedPointer: this.exportPoint(point, this.rect()) });
            this.emit('fingers:change', detail);
            this.emit('gesture:transition', Object.assign({}, detail, { gesture: 'topology' }));
        }
    }

    createSession(time, event, point) {
        const keyboard = keyboardState(event);
        const keyboardSubstitute = this.matchKeyboardFingerSubstitute(event, keyboard);
        const maxFingers = keyboardSubstitute ? keyboardSubstitute.fingers : 1;
        return {
            id: Math.random().toString(36).slice(2),
            startTime: time,
            phaseTime: time,
            event,
            target: point.target,
            pointerType: point.pointerType,
            keyboard,
            keyboardSubstitute,
            maxFingers,
            maxActualFingers: 1,
            startCenter: null,
            previousCenter: null,
            center: null,
            startDistance: 0,
            startAngle: 0,
            previousDistance: 0,
            previousAngle: 0,
            lastMoveTime: time,
            previousVelocity: 0,
            previousPressure: 0,
            moved: false,
            consumed: false,
            claimed: false,
            commits: {},
            tapHold: false,
            tapChain: false,
            pressTimer: null,
            pressRepeatTimer: null,
            pressStarted: false,
            panStarted: false,
            panAxis: null,
            pinchStarted: false,
            pinchBaseDistance: null,
            pinchModified: false,
            rotateStarted: false,
            rotateBaseAngle: null,
            rotateModified: false,
            pathStarted: false,
            path: null,
            swipeIntentAt: 0,
            swipeReady: false,
            rolling: null,
            modifier: null,
            keyboardModifier: null,
            releaseGuard: null,
            intent: {
                gesture: 'possible',
                committedAt: 0,
                possible: [],
                pruned: false
            },
            history: [],
            rect: null
        };
    }

    releaseKeyboardModifierForMultiTouch() {
        if (!this.session || !this.session.keyboardModifier) return;
        this.session.keyboardModifier.cancelled = true;
        this.session.keyboardModifier = null;
        if (!this.session.modifier) this.session.consumed = false;
    }

    updatePoint(id, input, event, raw) {
        const point = this.points.get(id);
        if (!point) return;
        point.previousX = point.x;
        point.previousY = point.y;
        point.previousClientX = point.clientX;
        point.previousClientY = point.clientY;
        point.previousPressure = point.pressure;
        point.x = input.x;
        point.y = input.y;
        point.clientX = input.clientX;
        point.clientY = input.clientY;
        point.screenX = input.screenX;
        point.screenY = input.screenY;
        point.pressure = input.pressure;
        point.tangentialPressure = input.tangentialPressure;
        point.tiltX = input.tiltX;
        point.tiltY = input.tiltY;
        point.twist = input.twist;
        point.width = input.width;
        point.height = input.height;
        point.time = this.time();
        if (raw && raw.target) point.target = raw.target;
        else if (event && event.target) point.target = event.target;
        this.updateRollingPoint(point);
    }

    endPoint(id, event, cancelled) {
        if (!this.session) return;
        const point = this.points.get(id);
        const rect = this.rect();
        const changedPointer = point ? this.exportPoint(point, rect) : null;
        const countBefore = this.points.size;

        if (cancelled) {
            this.points.delete(id);
            this.pointsDirty = true;
            if (!this.points.size) this.cancel('native', {
                originalEvent: event,
                changedPointer,
                added: 0,
                removed: 1,
                fingers: 0,
                activePointers: [],
                pointers: []
            });
            else {
                const detail = this.detail('fingers:change', { originalEvent: event, change: 'cancel', added: 0, removed: 1, changedPointer });
                this.emit('fingers:change', detail);
                this.emit('gesture:transition', Object.assign({}, detail, { gesture: 'topology' }));
            }
            return;
        }

        this.endKeyboardModifier(id, point, event);
        this.endModifier(id, point, event);
        this.endRollingPoint(id, this.time());
        const releaseDetail = this.detail('session:end', { originalEvent: event, changedPointer });
        this.resolvePathRelease(releaseDetail);

        if (countBefore > 1 && !this.session.consumed && this.isSwipe(releaseDetail)) {
            this.emitSwipe(releaseDetail);
        }

        this.points.delete(id);
        this.pointsDirty = true;

        if (this.points.size) {
            this.cancelPress('fingers:change');
            this.endRunningGestures(event);
            this.markReleaseGuard(countBefore);
            this.resetBasis(this.time());
            const detail = this.detail('fingers:change', { originalEvent: event, change: 'remove', added: 0, removed: 1, changedPointer });
            this.emit('fingers:change', detail);
            this.emit('gesture:transition', Object.assign({}, detail, { gesture: 'topology' }));
            return;
        }

        const endingDetail = this.detail('session:end', {
            originalEvent: event,
            changedPointer,
            added: 0,
            removed: 1,
            fingers: 0,
            activePointers: [],
            pointers: []
        });
        this.finishSession(event, endingDetail);
    }

    endRunningGestures(event) {
        if (!this.session) return;
        this.emitStartedEnds(event, null, true);
        this.emitModifierPanEnd('keyboardModifier', event, true);
        this.emitModifierPanEnd('modifier', event, true);
    }

    markReleaseGuard(countBefore) {
        if (!this.session || countBefore <= 1) return;
        const opt = this.options.intent || {};
        if (!opt.releaseGuard) return;
        const time = this.time();
        this.session.releaseGuard = {
            time,
            until: time + opt.releaseGuard,
            fromFingers: countBefore,
            points: this.pointList().map(point => ({
                id: point.id,
                x: point.x,
                y: point.y
            }))
        };
    }

    releaseGuardTravel() {
        const guard = this.session && this.session.releaseGuard;
        if (!guard) return 0;
        return guard.points.reduce((max, item) => {
            const point = this.points.get(item.id);
            if (!point) return max;
            return Math.max(max, hypot(point.x - item.x, point.y - item.y));
        }, 0);
    }

    releaseGuardActive() {
        const guard = this.session && this.session.releaseGuard;
        if (!guard) return false;
        const opt = this.options.intent || {};
        const time = this.time();
        const distance = opt.releaseDistance || 0;
        const guarded = time <= guard.until || this.releaseGuardTravel() <= distance;
        if (!guarded) this.session.releaseGuard = null;
        return guarded;
    }

    resolvePathRelease(detail) {
        const path = this.session && this.session.path;
        if (!path || !path.segments.length) return;
        this.handlePath(detail);
    }

    finishSession(event, endingDetail) {
        const session = this.session;
        if (!session) return;

        this.cancelPress('end', true);

        this.emitStartedEnds(event, null, false);

        const detail = this.detail('finish', { originalEvent: event });
        detail.releaseGuarded = this.releaseGuardActive();

        const swipeAfterPan = session.panStarted && this.options.swipe.allowAfterPan;

        if (!session.consumed && this.isRollingTap(detail)) {
            this.emitRollingTap(detail);
        } else if (!detail.releaseGuarded && (!session.consumed || swipeAfterPan) && this.isSwipe(detail)) {
            this.emitSwipe(detail);
        } else if (!session.consumed && this.isTap(detail)) {
            if (this.allowsGesture('tap')) this.emitTap(detail);
            else this.rememberLastTap(detail);
        } else if (session.tapHold && detail.elapsed > this.options.tapHold.maxRestTime) {
            this.tapMemory = null;
        }

        const endDetail = endingDetail || detail;
        this.emit('gesture:end', Object.assign({}, endDetail, { gesture: this.primaryGesture() }));
        this.emit('session:end', endDetail);
        this.session = null;
        this.releaseGestureStyles();
    }

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
        return path.resolved.some(winner => winner.length > item.length && this.pathItemsConflict(item, winner));
    }

    pathMatchKey(type, pattern, start, length, record) {
        return type + '|' + pattern + '|' + start + '|' + length + '|' + (record ? record.order : '');
    }

    pathSegmentLimit() {
        const opt = this.options.path || {};
        const circleLimit = this.circlePatternRecords().length ? this.pathMaxCircleCount() * 4 : 0;
        return Math.max(1, opt.maxSegments || 1, this.longestPathPatternLength(), circleLimit);
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
            if (this.pathItemDefersUntilEnd(item)) return true;
            if (this.pendingPathCanContinue(item, detail.path, patterns, detail)) return true;
            ready.push(item);
            return false;
        });

        return this.emitReadyPathItems(detail, ready);
    }

    pathItemDefersUntilEnd(item) {
        return this.pathItemIsCircle(item);
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
        const winner = this.emitPathCommandWinners(commandItems);
        this.markPathWinners(winners);
        return winner;
    }

    emitPathCommandWinners(items) {
        const circleItems = [];
        const otherItems = [];
        (items || []).forEach(item => {
            if (this.pathItemIsCircle(item)) circleItems.push(item);
            else otherItems.push(item);
        });
        const circleWinner = this.emitCommandWinner(circleItems);
        const otherWinner = this.emitCommandWinner(otherItems);
        return otherWinner || circleWinner;
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
        if (this.pathItemsCanCoexist(a, b)) return false;
        return !this.pathItemsSameMatch(a, b) && this.pathItemsOverlap(a, b);
    }

    pathItemsCanCoexist(a, b) {
        const aCircle = this.pathItemIsCircle(a);
        const bCircle = this.pathItemIsCircle(b);
        if (aCircle === bCircle) return false;
        const circle = aCircle ? a : b;
        const other = aCircle ? b : a;
        return other.length > circle.length && !this.pathItemContainsCircleAtom(other);
    }

    pathItemIsCircle(item) {
        const parsed = parseEventSelector(item && item.type);
        return parsed.valid && parsed.family === 'circle';
    }

    pathItemContainsCircleAtom(item) {
        const pattern = parsePathPattern(item && item.pattern);
        return pattern.valid && pattern.atoms.some(atom => atom.kind === 'circle');
    }

    markPathWinners(items) {
        const path = this.session && this.session.path;
        if (!path || !items || !items.length) return;
        items.forEach(item => {
            path.matched[item.key] = true;
            path.resolved.push({
                start: item.start,
                length: item.length,
                type: item.type,
                pattern: item.pattern
            });
        });
        path.pending = path.pending.filter(item => {
            return !items.some(winner => this.pathItemsConflict(item, winner)) && !this.pathItemBlockedByResolved(item);
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

    cancelPress(reason, ended) {
        if (!this.session) return;

        clearTimeout(this.session.pressTimer);
        clearInterval(this.session.pressRepeatTimer);
        this.session.pressTimer = null;
        this.session.pressRepeatTimer = null;

        if (this.session.pressStarted) {
            const type = ended ? 'press:end' : 'press:cancel';
            this.emit(type, this.detail(type, { reason }));
        }

        this.session.pressStarted = false;
    }

    resetBasis(time) {
        const points = this.pointList();
        const rect = this.rect();
        const center = this.positionDetail(this.center(points), rect);
        const distance = points.length >= 2 ? pointDistance(points[0], points[1]) : 0;
        const angle = points.length >= 2 ? pointAngle(points[0], points[1]) : 0;

        points.forEach(point => {
            point.phaseStartX = point.x;
            point.phaseStartY = point.y;
            point.phaseStartClientX = point.clientX;
            point.phaseStartClientY = point.clientY;
        });
        this.session.phaseTime = time;
        this.session.startCenter = center;
        this.session.previousCenter = center;
        this.session.center = center;
        this.session.startDistance = distance;
        this.session.previousDistance = distance;
        this.session.startAngle = angle;
        this.session.previousAngle = angle;
        this.session.previousVelocity = 0;
        this.session.previousPressure = this.pressure(points, 'pressure');
        this.session.lastMoveTime = time;
        this.session.maxFingers = Math.max(this.session.maxFingers, points.length);
        this.session.maxActualFingers = Math.max(this.session.maxActualFingers || 0, points.length);
        this.session.pinchStarted = false;
        this.session.pinchBaseDistance = null;
        this.session.pinchModified = false;
        this.session.rotateStarted = false;
        this.session.rotateBaseAngle = null;
        this.session.rotateModified = false;
        this.session.pathStarted = false;
        this.session.path = null;
        this.session.swipeIntentAt = 0;
        this.session.swipeReady = false;
        this.session.history = [];
    }

    pointList() {
        if (!this.pointsDirty) return this.pointCache.slice();
        this.pointCache = Array.from(this.points.values()).sort((a, b) => String(a.id).localeCompare(String(b.id)));
        this.pointsDirty = false;
        return this.pointCache.slice();
    }

    center(points) {
        const count = points.length || 1;
        const sum = points.reduce((acc, point) => {
            acc.x += point.x;
            acc.y += point.y;
            acc.clientX += point.clientX;
            acc.clientY += point.clientY;
            return acc;
        }, { x: 0, y: 0, clientX: 0, clientY: 0 });

        return {
            x: sum.x / count,
            y: sum.y / count,
            clientX: sum.clientX / count,
            clientY: sum.clientY / count
        };
    }

    rect() {
        if (this.session && this.options.rect === 'session' && this.session.rect) return Object.assign({}, this.session.rect);
        if (this.options.rect === 'static' && this.staticRect) return Object.assign({}, this.staticRect);
        if (!this.target.getBoundingClientRect) return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
        const rect = this.target.getBoundingClientRect();
        const data = {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height
        };
        if (this.session && this.options.rect === 'session') this.session.rect = data;
        if (this.options.rect === 'static') this.staticRect = data;
        return Object.assign({}, data);
    }

    refreshRect() {
        if (this.session) this.session.rect = null;
        this.staticRect = null;
        return this;
    }

    positionDetail(point, rect) {
        const width = rect.width || 1;
        const height = rect.height || 1;
        const clientX = point.clientX !== undefined ? point.clientX : point.x;
        const clientY = point.clientY !== undefined ? point.clientY : point.y;
        const pageX = point.pageX !== undefined ? point.pageX : point.x;
        const pageY = point.pageY !== undefined ? point.pageY : point.y;
        const localX = clientX - rect.left;
        const localY = clientY - rect.top;
        const edgeSize = this.options.edge.size;
        const ratioX = localX / width;
        const ratioY = localY / height;
        const clampedRatioX = clamp(ratioX, 0, 1);
        const clampedRatioY = clamp(ratioY, 0, 1);
        const thirdX = clampedRatioX < 1 / 3 ? 'left' : clampedRatioX > 2 / 3 ? 'right' : 'center';
        const thirdY = clampedRatioY < 1 / 3 ? 'top' : clampedRatioY > 2 / 3 ? 'bottom' : 'middle';
        const region = thirdX === 'center' && thirdY === 'middle' ? 'center' : thirdY + '-' + thirdX;
        const edge = {
            top: localY <= edgeSize,
            right: width - localX <= edgeSize,
            bottom: height - localY <= edgeSize,
            left: localX <= edgeSize
        };
        const edgeY = edge.top ? 'top' : edge.bottom ? 'bottom' : '';
        const edgeX = edge.left ? 'left' : edge.right ? 'right' : '';
        const edgeRegion = edgeY && edgeX ? edgeY + '-' + edgeX : edgeY || edgeX || 'none';
        const halfX = clampedRatioX < 0.45 ? 'left' : clampedRatioX > 0.55 ? 'right' : 'center';
        const halfY = clampedRatioY < 0.45 ? 'top' : clampedRatioY > 0.55 ? 'bottom' : 'middle';
        const halfRegion = halfX === 'center' && halfY === 'middle' ? 'center' : halfY === 'middle' ? halfX : halfX === 'center' ? halfY : halfY + '-' + halfX;
        const inside = ratioX >= 0 && ratioX <= 1 && ratioY >= 0 && ratioY <= 1;
        const area = !inside ? 'outside' : edgeRegion !== 'none' ? 'edge' : halfRegion === 'center' ? 'center' : 'inside';
        const gridPoint = { ratioX, ratioY, clampedRatioX, clampedRatioY };

        return {
            x: clientX,
            y: clientY,
            pageX,
            pageY,
            clientX,
            clientY,
            localX,
            localY,
            ratioX,
            ratioY,
            clampedRatioX,
            clampedRatioY,
            inside,
            area,
            edge,
            edgeRegion,
            halfX,
            halfY,
            halfRegion,
            thirdX,
            thirdY,
            region,
            zone: region,
            grid: (rows, cols) => gridFor(gridPoint, { rows, cols })
        };
    }

    exportPoint(point, rect) {
        if (!point) return null;
        const position = rect ? this.positionDetail(point, rect) : null;
        const startPosition = rect ? this.positionDetail({
            x: point.startX,
            y: point.startY,
            clientX: point.startClientX,
            clientY: point.startClientY
        }, rect) : null;
        return Object.assign({
            id: point.id,
            target: point.target,
            pointerType: point.pointerType,
            x: point.x,
            y: point.y,
            pageX: point.x,
            pageY: point.y,
            clientX: point.clientX,
            clientY: point.clientY,
            screenX: point.screenX,
            screenY: point.screenY,
            startX: point.startX,
            startY: point.startY,
            startClientX: point.startClientX,
            startClientY: point.startClientY,
            phaseStartX: point.phaseStartX,
            phaseStartY: point.phaseStartY,
            deltaX: point.x - point.startX,
            deltaY: point.y - point.startY,
            phaseDeltaX: phaseDX(point),
            phaseDeltaY: phaseDY(point),
            pressure: point.pressure,
            normalizedPressure: clamp(point.pressure || 0, 0, 1),
            pressureDelta: point.pressure - point.previousPressure,
            tangentialPressure: point.tangentialPressure,
            tiltX: point.tiltX,
            tiltY: point.tiltY,
            twist: point.twist,
            width: point.width,
            height: point.height
        }, position ? {
            localX: position.localX,
            localY: position.localY,
            ratioX: position.ratioX,
            ratioY: position.ratioY,
            clampedRatioX: position.clampedRatioX,
            clampedRatioY: position.clampedRatioY,
            inside: position.inside,
            area: position.area,
            edge: position.edge,
            edgeRegion: position.edgeRegion,
            halfX: position.halfX,
            halfY: position.halfY,
            halfRegion: position.halfRegion,
            thirdX: position.thirdX,
            thirdY: position.thirdY,
            region: position.region,
            zone: position.zone,
            grid: position.grid
        } : {}, startPosition ? {
            startLocalX: startPosition.localX,
            startLocalY: startPosition.localY,
            startRatioX: startPosition.ratioX,
            startRatioY: startPosition.ratioY,
            startArea: startPosition.area,
            startEdge: startPosition.edge,
            startEdgeRegion: startPosition.edgeRegion,
            startHalfX: startPosition.halfX,
            startHalfY: startPosition.halfY,
            startHalfRegion: startPosition.halfRegion,
            startRegion: startPosition.region,
            startZone: startPosition.zone
        } : {});
    }

    pressure(points, key) {
        if (!points.length) return 0;
        return points.reduce((sum, point) => sum + (point[key] || 0), 0) / points.length;
    }

    motionShape(points, travel, distanceDelta, rotation) {
        if (points.length < 2) {
            return {
                parallel: 1,
                opposition: 0,
                moved: points.filter(point => hypot(phaseDX(point), phaseDY(point)) > this.options.tap.maxMove).length,
                rotationArc: 0,
                translationShare: travel ? 1 : 0
            };
        }

        const a = points[0];
        const b = points[1];
        const ax = phaseDX(a);
        const ay = phaseDY(a);
        const bx = phaseDX(b);
        const by = phaseDY(b);
        const am = hypot(ax, ay);
        const bm = hypot(bx, by);
        const dot = am && bm ? (ax * bx + ay * by) / (am * bm) : 0;
        const span = pointDistance(a, b);
        const rotationArc = span * abs(rotation) * PI / 360;
        const drift = travel + abs(distanceDelta) * 0.5;

        return {
            parallel: clamp(dot, -1, 1),
            opposition: clamp(-dot, 0, 1),
            moved: points.filter(point => hypot(phaseDX(point), phaseDY(point)) > this.options.tap.maxMove).length,
            rotationArc,
            translationShare: drift ? travel / Math.max(1, drift + rotationArc) : 0
        };
    }

    phaseFor(type) {
        if (type === 'session:cancel' || type.endsWith('cancel') || type.endsWith(':cancel')) return 'cancelled';
        if (type === 'session:end' || type.endsWith('end') || type.endsWith(':end')) return 'ended';
        if (type === 'finish') return 'settling';
        if (type.endsWith('start') || type.endsWith(':start')) return 'began';
        if (type === 'tap' || type === 'swipe' || type === 'rolling' || type === 'tap:mod' || type.indexOf('tap:') === 0 || type.indexOf('rolling:') === 0 || type.indexOf('swipe:') === 0) return 'committed';
        if (type === 'session:move' || type.endsWith('move') || type.endsWith(':move') || type === 'pan' || type === 'pan:mod' || type === 'pinch' || type === 'rotate') return 'active';
        return 'possible';
    }

    intentReady(detail, opt, gesture) {
        const scale = gesture ? this.intentSpeedScale(detail, gesture) : 1;
        const minTime = opt && opt.minTime ? Math.ceil(opt.minTime * scale) : 0;
        const baseSamples = opt && opt.minSamples ? opt.minSamples : 0;
        const minSamples = scale < 1 ? Math.max(this.options.intent.fastPathSamples || 1, Math.ceil(baseSamples * scale)) : baseSamples;
        if (minTime && detail.elapsed < minTime) return false;
        if (minSamples && detail.sampleCount < minSamples) return false;
        return true;
    }

    intentSpeedScale(detail, gesture) {
        const opt = this.options.intent || {};
        if (!opt.enabled || !opt.prune || !opt.fastPath) return 1;
        const state = this.intentState();
        if (!state.pruned || !state.groups.has(gesture)) return 1;
        const candidates = this.continuousCandidates(detail);
        if (!candidates.length || candidates.length > (opt.fastPathMaxCandidates || 1)) return 1;
        return Math.max(0.1, Math.min(1, opt.fastPathTime || 1));
    }

    recordHistory(detail) {
        if (!this.session) return;
        const limit = Math.max(1, this.options.intent.history || 1);
        this.session.history.push({
            time: this.time(),
            fingers: detail.fingers,
            center: { x: detail.center.pageX, y: detail.center.pageY },
            deltaX: detail.deltaX,
            deltaY: detail.deltaY,
            travel: detail.travel,
            direction: detail.direction,
            distance: detail.distance,
            distanceDelta: detail.distanceDelta,
            scale: detail.scale,
            rotation: detail.rotation,
            velocity: detail.velocity,
            angularVelocity: detail.angularVelocity
        });
        while (this.session.history.length > limit) this.session.history.shift();
    }

    confidenceScores(detail) {
        const panOpt = this.options.pan;
        const pinchOpt = this.options.pinch;
        const rotateOpt = this.options.rotate;
        const swipeOpt = this.options.swipe;
        const swipeMin = swipeOpt.distanceByFingers[detail.fingers] || swipeOpt.distance || 1;
        const pan = this.allowsGesture('pan') && panOpt.enabled && toArray(panOpt.fingers).includes(detail.fingers) && this.intentReady(detail, panOpt, 'pan') ? detail.travel / Math.max(1, panOpt.threshold) : 0;
        const pinchReady = this.allowsGesture('pinch') && pinchOpt.enabled && detail.fingers === 2 && this.intentReady(detail, pinchOpt, 'pinch');
        const pinchDistance = pinchReady ? abs(detail.distanceDelta) / Math.max(1, pinchOpt.distance) : 0;
        const pinchScale = pinchReady ? abs(detail.scaleDelta) / Math.max(0.001, pinchOpt.scale) : 0;
        const pinchDominance = pinchReady && detail.travel ? abs(detail.distanceDelta) / Math.max(1, detail.travel * pinchOpt.dominance) : Math.max(pinchDistance, pinchScale);
        let rotate = 0;

        if (this.allowsGesture('rotate') && rotateOpt.enabled && detail.fingers === 2 && this.intentReady(detail, rotateOpt, 'rotate')) {
            const angleScore = abs(detail.rotation) / Math.max(1, rotateOpt.angle);
            const speedScore = detail.angularVelocity / Math.max(0.001, rotateOpt.minAngularVelocity);
            const late = detail.elapsed > rotateOpt.maxSoftStart && abs(detail.rotation) < rotateOpt.lateAngle;
            const rotationArc = detail.motion.rotationArc || Math.max(detail.startDistance, detail.distance) * abs(detail.rotation) * PI / 360;
            const drift = detail.travel + abs(detail.distanceDelta) * 0.5;
            const balance = rotationArc ? rotationArc / Math.max(1, rotationArc + drift) : 0;
            const dominance = balance / Math.max(0.001, rotateOpt.dominance);
            rotate = late ? Math.min(angleScore, speedScore) * 0.35 : Math.max(angleScore * 0.68, Math.min(angleScore, speedScore));
            rotate = Math.min(rotate, dominance);
            if (detail.motion.parallel > 0.72 && detail.motion.translationShare > 0.5) rotate *= 0.18;
            if (rotateOpt.requireMovedFingers) {
                if (detail.motion.moved < detail.fingers) rotate = 0;
            }
        }

        return {
            pan,
            pinch: Math.min(Math.max(pinchDistance, pinchScale), pinchDominance),
            rotate,
            swipe: this.allowsGesture('swipe') && swipeOpt.enabled && this.intentReady(detail, swipeOpt, 'swipe') ? Math.max(detail.travel / Math.max(1, swipeMin), detail.velocity / Math.max(0.001, swipeOpt.velocity)) : 0
        };
    }

    detail(type, extra) {
        const session = this.session;
        const points = this.pointList();
        const rect = this.rect();
        const rawCenter = points.length ? this.center(points) : (session && session.center ? session.center : { x: 0, y: 0, clientX: 0, clientY: 0 });
        const center = rawCenter.localX !== undefined ? rawCenter : this.positionDetail(rawCenter, rect);
        const startCenter = session && session.startCenter ? session.startCenter : center;
        const previousCenter = session && session.previousCenter ? session.previousCenter : center;
        const deltaX = center.pageX - startCenter.pageX;
        const deltaY = center.pageY - startCenter.pageY;
        const stepX = center.pageX - previousCenter.pageX;
        const stepY = center.pageY - previousCenter.pageY;
        const distance = points.length >= 2 ? pointDistance(points[0], points[1]) : 0;
        const angle = points.length >= 2 ? pointAngle(points[0], points[1]) : 0;
        const startDistance = session && session.pinchStarted && session.pinchBaseDistance ? session.pinchBaseDistance : session ? session.startDistance : 0;
        const previousDistance = session ? session.previousDistance : distance;
        const previousAngle = session ? session.previousAngle : angle;
        const scale = startDistance ? distance / startDistance : 1;
        const startAngle = session && session.rotateStarted && session.rotateBaseAngle !== null ? session.rotateBaseAngle : session ? session.startAngle : angle;
        const rotation = session ? normalizeAngle(angle - startAngle) : 0;
        const sampleTime = this.time();
        const elapsed = session ? sampleTime - session.phaseTime : 0;
        const totalElapsed = session ? sampleTime - session.startTime : 0;
        const stepElapsed = session ? Math.max(0, sampleTime - session.lastMoveTime) : 0;
        const sampleCount = session ? session.history.length + 1 : 0;
        const travel = hypot(deltaX, deltaY);
        const stepDistance = hypot(stepX, stepY);
        const distanceDelta = distance - startDistance;
        const velocityX = elapsed ? deltaX / elapsed : 0;
        const velocityY = elapsed ? deltaY / elapsed : 0;
        const velocity = elapsed ? travel / elapsed : 0;
        const stepVelocityX = stepElapsed ? stepX / stepElapsed : 0;
        const stepVelocityY = stepElapsed ? stepY / stepElapsed : 0;
        const stepVelocity = stepElapsed ? stepDistance / stepElapsed : 0;
        const acceleration = stepElapsed ? (velocity - (session ? session.previousVelocity : 0)) / stepElapsed : 0;
        const distanceVelocity = stepElapsed ? (distance - previousDistance) / stepElapsed : 0;
        const angularVelocity = stepElapsed ? abs(normalizeAngle(angle - previousAngle)) / stepElapsed : 0;
        const direction = directionFrom(deltaX, deltaY, this.options.swipe.axisRatio);
        const first = points[0] || null;
        const pressure = this.pressure(points, 'pressure');
        const previousPressure = this.pressure(points, 'previousPressure');
        const pressureDelta = pressure - previousPressure;
        const motion = this.motionShape(points, travel, distanceDelta, rotation);
        const activePointers = points.map(point => this.exportPoint(point, rect));
        const keyboard = session && session.keyboard ? session.keyboard : keyboardState(extra && extra.originalEvent);
        const keyboardSubstitute = copyKeyboardSubstitute(session && session.keyboardSubstitute);
        const actualFingers = points.length || (session ? session.maxActualFingers || 0 : 0);
        const syntheticFingers = keyboardSubstitute ? keyboardSubstitute.fingers : 0;
        const effectiveFingers = points.length ? Math.max(points.length, syntheticFingers || 0) : (session ? session.maxFingers : points.length);
        const fingerSource = syntheticFingers && syntheticFingers > actualFingers ? 'keyboard' : actualFingers ? 'pointer' : 'none';

        const data = Object.assign({
            type,
            originalEvent: session ? session.event : null,
            target: first ? first.target : (session ? session.target : this.target),
            currentTarget: this.target,
            pointerType: first ? first.pointerType : (session ? session.pointerType : 'none'),
            fingers: effectiveFingers,
            actualFingers,
            syntheticFingers,
            fingerSource,
            maxFingers: session ? session.maxFingers : points.length,
            maxActualFingers: session ? session.maxActualFingers || actualFingers : actualFingers,
            pointers: activePointers,
            activePointers,
            center: Object.assign({}, center),
            startCenter: Object.assign({}, startCenter),
            previousCenter: Object.assign({}, previousCenter),
            region: center.region,
            startRegion: startCenter.region,
            previousRegion: previousCenter.region,
            area: center.area,
            startArea: startCenter.area,
            edge: center.edge,
            startEdge: startCenter.edge,
            edgeRegion: center.edgeRegion,
            startEdgeRegion: startCenter.edgeRegion,
            halfX: center.halfX,
            halfY: center.halfY,
            halfRegion: center.halfRegion,
            thirdX: center.thirdX,
            thirdY: center.thirdY,
            keys: keyboard.keys.slice(),
            keyCombo: keyboard.combo,
            keyboard: copyKeyboardState(keyboard),
            keyboardSubstitute,
            deltaX,
            deltaY,
            stepX,
            stepY,
            stepDistance,
            stepElapsed,
            absX: abs(deltaX),
            absY: abs(deltaY),
            travel,
            elapsed,
            totalElapsed,
            sampleCount,
            velocityX,
            velocityY,
            velocity,
            stepVelocityX,
            stepVelocityY,
            stepVelocity,
            acceleration,
            direction,
            axis: axisFrom(direction),
            distance,
            startDistance,
            previousDistance,
            distanceDelta,
            distanceVelocity,
            scale,
            scaleDelta: scale - 1,
            angle,
            previousAngle,
            rotation,
            angularVelocity,
            pressure,
            previousPressure,
            pressureDelta,
            normalizedPressure: clamp(pressure || 0, 0, 1),
            motion,
            rect,
            phase: this.phaseFor(type),
            intent: session ? Object.assign({}, session.intent, { samples: sampleCount }) : { gesture: 'none', committedAt: 0, samples: 0 },
            claimed: !!(session && session.claimed),
            tapHold: !!(session && session.tapHold),
            tapChain: !!(session && session.tapChain),
            consumed: !!(session && session.consumed),
            releaseGuarded: !!(session && session.releaseGuard),
            topology: {
                added: extra && extra.added ? extra.added : 0,
                removed: extra && extra.removed ? extra.removed : 0,
                total: effectiveFingers,
                actual: points.length,
                max: session ? session.maxFingers : points.length
            },
            preventDefault: () => {
                if (extra && extra.originalEvent && extra.originalEvent.cancelable) extra.originalEvent.preventDefault();
            },
            stopPropagation: () => {
                if (extra && extra.originalEvent) {
                    if (typeof extra.originalEvent.stopPropagation === 'function') extra.originalEvent.stopPropagation();
                    if (typeof extra.originalEvent.stopImmediatePropagation === 'function') extra.originalEvent.stopImmediatePropagation();
                }
            }
        }, extra || {});

        data.confidences = this.confidenceScores(data);
        data.confidence = Math.max(data.confidences.pan, data.confidences.pinch, data.confidences.rotate, data.confidences.swipe);
        data.intent.possible = this.possibleGestures(data);
        data.intent.pruned = this.intentState().pruned;
        return data;
    }
}

const criteriaKeys = listSet([
    'region',
    'startRegion',
    'tapStartRegion',
    'grid',
    'startGrid',
    'tapStartGrid',
    'sequenceStartGrid',
    'sequence',
    'area',
    'startArea',
    'tapStartArea',
    'edge',
    'modifierRegion',
    'modifierArea',
    'modifierSource',
    'modifierName',
    'modifierFingers',
    'actionFingers',
    'totalFingers',
    'key',
    'keys',
    'combo',
    'modifierKeys',
    'direction',
    'axis',
    'speed',
    'modified',
    'path',
    'pathText',
    'fingers',
    'actualFingers',
    'syntheticFingers',
    'fingerSource',
    'keyboardRole',
    'pointerType',
    'tapCount'
]);

const sequenceCriteriaKeys = listSet(['start', 'end', 'steps']);
const sequenceStepCriteriaKeys = listSet([
    'event',
    'gesture',
    'family',
    'mode',
    'state',
    'direction',
    'fingers',
    'actualFingers',
    'syntheticFingers',
    'fingerSource',
    'keyboardRole',
    'keys',
    'combo',
    'tapCount',
    'region',
    'grid',
    'area'
]);

function criteriaKeysKnown(criteria, allowed) {
    if (!isPlainObject(criteria)) return false;
    return Object.keys(criteria).every(key => allowed[key]);
}

function sequenceCriteriaMatches(event, expected) {
    const gestures = event && event.gestureSequence && event.gestureSequence.gestures;
    if (!gestures || !gestures.length) return false;
    if (Array.isArray(expected)) return expected.length > 0 && expected.every((criteria, index) => sequenceStepCriteriaMatches(gestures[index], criteria));
    if (!criteriaKeysKnown(expected, sequenceCriteriaKeys)) return false;
    if (expected.start && !sequenceStepCriteriaMatches(gestures[0], expected.start)) return false;
    if (expected.end && !sequenceStepCriteriaMatches(gestures[gestures.length - 1], expected.end)) return false;
    if (expected.steps !== undefined && !sequenceCriteriaMatches(event, expected.steps)) return false;
    return !!(expected.start || expected.end || expected.steps !== undefined);
}

function sequenceStepCriteriaMatches(step, criteria) {
    if (criteria === undefined || criteria === null) return true;
    if (!step || !criteriaKeysKnown(criteria, sequenceStepCriteriaKeys)) return false;
    if (criteria.event && !matchValue(step.event, criteria.event)) return false;
    if (criteria.gesture && !matchValue(step.gesture, criteria.gesture)) return false;
    if (criteria.family && !matchValue(step.family, criteria.family)) return false;
    if (criteria.mode && !matchValue(step.mode, criteria.mode)) return false;
    if (criteria.state && !matchValue(step.state, criteria.state)) return false;
    if (criteria.direction && !matchValue(step.direction, criteria.direction)) return false;
    if (criteria.fingers !== undefined && !matchValue(step.fingers, criteria.fingers)) return false;
    if (criteria.actualFingers !== undefined && !matchValue(step.actualFingers, criteria.actualFingers)) return false;
    if (criteria.syntheticFingers !== undefined && !matchValue(step.syntheticFingers, criteria.syntheticFingers)) return false;
    if (criteria.fingerSource !== undefined && criteria.fingerSource !== null && !matchFingerSource(step.fingerSource, criteria.fingerSource)) return false;
    if (criteria.keyboardRole && !matchValue(step.keyboardRole, criteria.keyboardRole)) return false;
    if (criteria.keys && !matchCombo(step.keyCombo, criteria.keys)) return false;
    if (criteria.combo && !matchCombo(step.keyCombo, criteria.combo)) return false;
    if (criteria.tapCount !== undefined && !matchValue(step.tapCount, criteria.tapCount)) return false;
    if (criteria.region && !HandTrick.region(step.center, criteria.region)) return false;
    if (criteria.grid && !gridMatches(step.center, criteria.grid)) return false;
    if (criteria.area && !matchValue(step.center && step.center.area, criteria.area)) return false;
    return true;
}

HandTrick.events = eventNames.slice();
HandTrick.recognizers = recognizerNames.slice();
HandTrick.families = Object.keys(eventRegistry).filter(group => group !== 'lifecycle');
HandTrick.groups = merge(eventRegistry);
HandTrick.region = function (event, region) {
    const point = event && event.center ? event.center : event;
    if (!point) return false;
    if (Array.isArray(region)) return region.some(item => HandTrick.region(point, item));
    if (region === 'any') return true;
    if (region === point.region) return true;
    if (region === point.zone || region === point.halfRegion || region === point.edgeRegion || region === point.area) return true;
    if (region === point.halfX || region === point.halfY || region === point.thirdX || region === point.thirdY) return true;
    if (region === 'edge') return !!(point.edge && (point.edge.top || point.edge.right || point.edge.bottom || point.edge.left));
    return !!(point.edge && point.edge[region]);
};
HandTrick.zone = function (point, options) {
    return gridFor(point, options);
};
HandTrick.path = function (value) {
    return pathPatternText(value);
};
HandTrick.matches = function (event, criteria) {
    if (!event) return false;
    if (criteria === undefined || criteria === null) return true;
    const opt = normalizeCriteria(criteria);
    if (isInvalidCriteria(opt)) return false;
    if (!opt) return true;
    const modifier = event.modifier || null;
    const modifierPoint = modifier && modifier.position ? modifier.position.source : null;
    const tapStart = tapStartPoint(event);
    if (opt.region && !HandTrick.region(event, opt.region)) return false;
    if (opt.startRegion && !HandTrick.region(event && event.startCenter, opt.startRegion)) return false;
    if (opt.tapStartRegion && !HandTrick.region(tapStart, opt.tapStartRegion)) return false;
    if (opt.grid && !gridMatches(event && event.center, opt.grid)) return false;
    if (opt.startGrid && !gridMatches(event && event.startCenter, opt.startGrid)) return false;
    if (opt.tapStartGrid && !gridMatches(tapStart, opt.tapStartGrid)) return false;
    if (opt.sequence && !sequenceCriteriaMatches(event, opt.sequence)) return false;
    if (opt.area && !matchValue(event.area, opt.area)) return false;
    if (opt.startArea && !matchValue(event.startArea, opt.startArea)) return false;
    if (opt.tapStartArea && !matchValue(tapStart && tapStart.area, opt.tapStartArea)) return false;
    if (opt.modifierRegion && !HandTrick.region(modifierPoint, opt.modifierRegion)) return false;
    if (opt.modifierArea && !matchValue(modifier && modifier.area, opt.modifierArea)) return false;
    if (opt.modifierSource && !matchValue(modifier && modifier.source, opt.modifierSource)) return false;
    if (opt.modifierName && !matchValue(modifier && modifier.name, opt.modifierName)) return false;
    if (opt.modifierFingers !== undefined && !matchValue(modifier && modifier.fingers, opt.modifierFingers)) return false;
    if (opt.actionFingers !== undefined && !matchValue(modifier && modifier.actionFingers, opt.actionFingers)) return false;
    if (opt.totalFingers !== undefined && !matchValue(modifier && modifier.totalFingers, opt.totalFingers)) return false;
    if (opt.key && !toArray(opt.key).every(key => (event.keys || []).includes(canonicalKey(key)))) return false;
    if (opt.keys && !matchCombo(event.keyCombo, opt.keys)) return false;
    if (opt.combo && !matchCombo(event.keyCombo, opt.combo)) return false;
    if (opt.modifierKeys && !matchCombo(modifier && modifier.keyCombo, opt.modifierKeys)) return false;
    if (opt.direction && !matchValue(event.direction, opt.direction)) return false;
    if (opt.axis && !matchValue(event.axis, opt.axis)) return false;
    if (opt.speed && !matchValue(event.speed, opt.speed)) return false;
    if (opt.modified !== undefined && !!event.modified !== !!opt.modified) return false;
    if (opt.path && !pathMatches(event.path || event.pathText, opt.path, event)) return false;
    if (opt.pathText && !pathMatches(event.path || event.pathText, opt.pathText, event)) return false;
    if (opt.fingers !== undefined && !matchValue(event.fingers, opt.fingers)) return false;
    if (opt.actualFingers !== undefined && !matchValue(event.actualFingers, opt.actualFingers)) return false;
    if (opt.syntheticFingers !== undefined && !matchValue(event.syntheticFingers, opt.syntheticFingers)) return false;
    if (opt.fingerSource !== undefined && opt.fingerSource !== null && !matchFingerSource(event.fingerSource, opt.fingerSource)) return false;
    if (opt.keyboardRole && !matchValue(event.keyboardSubstitute && event.keyboardSubstitute.role, opt.keyboardRole)) return false;
    if (opt.pointerType && !matchValue(event.pointerType, opt.pointerType)) return false;
    if (opt.tapCount !== undefined && !matchValue(event.tapCount, opt.tapCount)) return false;
    if (opt.edge && !HandTrick.region(event, opt.edge)) return false;
    return true;
};
HandTrick.presets = presetRegistry;
HandTrick.keyCombo = normalizeCombo;
HandTrick.event = function (value) {
    const key = canonicalEventType(value);
    if (key === '*') return '*';
    const path = pathPatternFromEvent(key);
    if (path) return path;
    const sequence = parseSequenceSelector(key);
    if (sequence.valid) return sequence.canonical;
    const parsed = parseEventSelector(key);
    return parsed.valid ? parsed.canonical : '';
};
HandTrick.isEvent = function (value) {
    return !!HandTrick.event(value);
};

export { HandTrick };
export default HandTrick;
