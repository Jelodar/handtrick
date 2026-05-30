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
