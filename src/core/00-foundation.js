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
