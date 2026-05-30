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
