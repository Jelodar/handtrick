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
