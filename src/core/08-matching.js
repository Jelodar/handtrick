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
