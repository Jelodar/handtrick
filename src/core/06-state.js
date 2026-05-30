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
