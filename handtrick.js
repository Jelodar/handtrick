/** HandTrick.js - MIT © Jelodar */
(function (root, factory) {
    const value = factory();
    if (typeof module === 'object' && module.exports) module.exports = value;
    if (typeof define === 'function' && define.amd) define(function () { return value; });
    root.HandTrick = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const KEY_SHIFT = 'shift', KEY_ALT = 'alt', KEY_CTRL = 'ctrl', KEY_META = 'meta';
    const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
    const abs = Math.abs;
    const hypot = Math.hypot;
    const atan2 = Math.atan2;
    const PI = Math.PI;
    const styleMemory = new WeakMap();
    const pathDirectionSet = { left: true, right: true, up: true, down: true };
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
        fourFingers: null,
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

    const eventRegistry = {
        lifecycle: ['start', 'move', 'end', 'cancel', 'fingerchange', 'gesturestart', 'gestureupdate', 'gesturetransition', 'gesturecommit', 'gestureend', 'gesturecancel', 'ignored'],
        tap: ['tap', 'singletap', 'doubletap', 'tripletap', 'tapsequence', 'multitap'],
        press: ['press', 'pressstart', 'pressmove', 'pressend', 'presscancel'],
        pan: ['panstart', 'pan', 'panend'],
        swipe: ['swipe', 'swipeintent', 'swipeleft', 'swiperight', 'swipeup', 'swipedown', 'flick'],
        pinch: ['pinchstart', 'pinch', 'pinchend', 'pinchin', 'pinchout'],
        rotate: ['rotatestart', 'rotate', 'rotateend', 'rotateclockwise', 'rotatecounterclockwise'],
        path: ['pathstart', 'path', 'pathend'],
        rolling: ['rollingtap', 'rollingtapleft', 'rollingtapright', 'rollingtapup', 'rollingtapdown'],
        modifier: ['modifiertap', 'modifierpanstart', 'modifierpan', 'modifierpanend'],
        pressure: ['pressurechange'],
        wheel: ['wheel', 'wheelzoom']
    };

    const eventNames = Object.keys(eventRegistry).reduce((out, group) => out.concat(eventRegistry[group]), []);
    const activatableGestures = {
        tap: true,
        press: true,
        pan: true,
        swipe: true,
        pinch: true,
        rotate: true,
        path: true,
        rolling: true,
        modifier: true,
        pressure: true,
        wheel: true
    };
    const specificEventAliases = {
        'swipe:left': 'swipeleft',
        'swipe:right': 'swiperight',
        'swipe:up': 'swipeup',
        'swipe:down': 'swipedown',
        'rollingtap:left': 'rollingtapleft',
        'rollingtap:right': 'rollingtapright',
        'rollingtap:up': 'rollingtapup',
        'rollingtap:down': 'rollingtapdown',
        'pinch:in': 'pinchin',
        'pinch:out': 'pinchout',
        'rotate:clockwise': 'rotateclockwise',
        'rotate:counterclockwise': 'rotatecounterclockwise',
        roll: 'rollingtap',
        'roll:left': 'rollingtapleft',
        'roll:right': 'rollingtapright',
        'roll:up': 'rollingtapup',
        'roll:down': 'rollingtapdown'
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
        callbacks: {},
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
            useCallbacks: true,
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
            fingers: 2,
            distance: 10,
            scale: 0.03,
            minTime: 70,
            minSamples: 2,
            dominance: 0.35
        },
        rotate: {
            enabled: true,
            fingers: 2,
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
            minTime: 80,
            minSamples: 2,
            consume: true
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

    const eventAliases = {
        onStart: 'start',
        onMove: 'move',
        onEnd: 'end',
        onCancel: 'cancel',
        onGestureStart: 'gesturestart',
        onGestureUpdate: 'gestureupdate',
        onGestureTransition: 'gesturetransition',
        onGestureCommit: 'gesturecommit',
        onGestureEnd: 'gestureend',
        onGestureCancel: 'gesturecancel',
        onTap: 'tap',
        onDoubleTap: 'doubletap',
        onTripleTap: 'tripletap',
        onTapSequence: 'tapsequence',
        onMultiTap: 'multitap',
        onPress: 'press',
        onPressStart: 'pressstart',
        onPressMove: 'pressmove',
        onPressEnd: 'pressend',
        onPressCancel: 'presscancel',
        onPanStart: 'panstart',
        onPan: 'pan',
        onPanEnd: 'panend',
        onSwipe: 'swipe',
        onSwipeIntent: 'swipeintent',
        onPinchStart: 'pinchstart',
        onPinch: 'pinch',
        onPinchEnd: 'pinchend',
        onRotateStart: 'rotatestart',
        onRotate: 'rotate',
        onRotateEnd: 'rotateend',
        onPathStart: 'pathstart',
        onPath: 'path',
        onPathEnd: 'pathend',
        onRollingTap: 'rollingtap',
        onModifierTap: 'modifiertap',
        onModifierPanStart: 'modifierpanstart',
        onModifierPan: 'modifierpan',
        onModifierPanEnd: 'modifierpanend',
        onPressureChange: 'pressurechange',
        onWheel: 'wheel',
        onWheelZoom: 'wheelzoom',
        onFingerChange: 'fingerchange',
        onIgnored: 'ignored'
    };

    const gestureEvents = Object.keys(eventRegistry).reduce((out, group) => {
        if (group === 'lifecycle' || group === 'pressure') return out;
        eventRegistry[group].forEach(type => {
            out[type] = group;
        });
        return out;
    }, {});

    const continuousGestures = ['pan', 'swipe', 'pinch', 'rotate'];

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

    function isPathDirection(value) {
        return !!pathDirectionSet[String(value || '').toLowerCase()];
    }

    function normalizeEventType(type) {
        const key = String(type || '').toLowerCase();
        return specificEventAliases[key] || type;
    }

    function isPathPatternEvent(type) {
        const tokens = pathTokens(type);
        return tokens.length > 0;
    }

    function pathPatternFromEvent(type) {
        return isPathPatternEvent(type) ? pathText(type) : '';
    }

    function isSequencePatternEvent(type) {
        const value = String(type || '');
        if (isPathPatternEvent(value)) return false;
        return value.indexOf('>') >= 0;
    }

    function gestureForEvent(type) {
        const value = String(normalizeEventType(type) || '').toLowerCase();
        if (isPathPatternEvent(value)) return 'path';
        if (gestureEvents[value]) return gestureEvents[value];
        if (/^\d+finger(tap|doubletap|tripletap|\d+tap)$/.test(value)) return 'tap';
        if (/^\d+fingerrollingtap$/.test(value)) return 'rolling';
        return null;
    }

    function sequenceTokens(type) {
        const value = String(type || '');
        return value.split('>').map(item => item.trim()).filter(Boolean);
    }

    function tapSequenceMatchers(raw, count, fingers) {
        const out = [];
        for (let i = 1; i <= count; i++) {
            out.push({
                raw,
                token: 'tap',
                tapCount: i === count ? count : null,
                fingers: fingers || null
            });
        }
        return out;
    }

    function namedTapCount(value) {
        if (value === 'single') return 1;
        if (value === 'double') return 2;
        if (value === 'triple') return 3;
        return null;
    }

    function sequenceTapAlias(value) {
        let match = value.match(/^(single|double|triple)tap$/);
        if (match) return { count: namedTapCount(match[1]), fingers: null };
        match = value.match(/^(\d+)finger(?:(single|double|triple)tap|(\d+)tap)$/);
        if (!match) return null;
        return {
            count: match[3] ? parseInt(match[3], 10) : namedTapCount(match[2]),
            fingers: parseInt(match[1], 10)
        };
    }

    function sequenceMatcher(raw) {
        const value = String(normalizeEventType(raw) || '').toLowerCase();
        const tapAlias = sequenceTapAlias(value);
        if (tapAlias && tapAlias.count) return tapSequenceMatchers(value, tapAlias.count, tapAlias.fingers);
        let match;
        const matcher = {
            raw: value,
            token: gestureForEvent(value) || value,
            tapCount: null,
            fingers: null,
            direction: null,
            multitap: false
        };
        if (value === 'multitap') {
            matcher.token = 'tap';
            matcher.multitap = true;
        }
        if (value.indexOf('swipe') === 0 && value.length > 5) {
            matcher.token = 'swipe';
            matcher.direction = value.slice(5);
        }
        if (value.indexOf('rollingtap') === 0 && value.length > 10) {
            matcher.token = 'rolling';
            matcher.direction = value.slice(10);
        }
        match = value.match(/^(\d+)fingertap$/);
        if (match) {
            matcher.token = 'tap';
            matcher.fingers = parseInt(match[1], 10);
        }
        match = value.match(/^(\d+)fingerrollingtap$/);
        if (match) {
            matcher.token = 'rolling';
            matcher.fingers = parseInt(match[1], 10);
        }
        return [matcher];
    }

    function sequencePattern(tokens) {
        return tokens.reduce((out, token) => out.concat(sequenceMatcher(token)), []);
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

    function pathMatches(value, expected) {
        if (expected === undefined || expected === null) return true;
        if (Array.isArray(expected)) return expected.some(item => pathMatches(value, item));
        const current = pathTokens(value);
        const wanted = pathTokens(expected);
        if (!wanted.length || wanted.length > current.length) return false;
        const start = current.length - wanted.length;
        return wanted.every((token, index) => current[start + index] === token);
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
        return merge(merge(defaults, collectPresetOptions(preset)), source);
    }

    function resolvePartialOptions(options) {
        const source = clone(normalizeOptionsInput(options));
        const preset = source.preset !== undefined ? source.preset : source.presets;
        delete source.preset;
        delete source.presets;
        return merge(collectPresetOptions(preset), source);
    }

    const presetRegistry = {
        media(options) {
            return merge({
                preventDefault: false,
                claim: { enabled: true, threshold: 0.5, preventDefault: true },
                intent: { events: ['tap', 'pan', 'swipe', 'pinch', 'rollingtap', 'modifiertap', 'modifierpan'] },
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
                intent: { events: ['swipe'] },
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
            this.optionListeners = [];
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

            this.bindOptionCallbacks(this.options);
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
            return merge(collectPresetOptions(name), options || {});
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

        bindOptionCallbacks(options) {
            this.unbindOptionCallbacks();
            Object.keys(eventAliases).forEach(key => {
                if (typeof options[key] === 'function') this.addOptionCallback(eventAliases[key], options[key]);
            });

            if (options.callbacks) {
                Object.keys(options.callbacks).forEach(type => {
                    const handlers = toArray(options.callbacks[type]);
                    handlers.forEach(handler => {
                        if (typeof handler === 'function') this.addOptionCallback(type, handler);
                    });
                });
            }
        }

        addOptionCallback(type, handler) {
            this.on(type, handler);
            this.optionListeners.push({ type, handler });
        }

        unbindOptionCallbacks() {
            if (!this.optionListeners || !this.optionListeners.length) return;
            this.optionListeners.forEach(item => {
                const set = this.listeners.get(item.type);
                if (set) set.delete(item.handler);
            });
            this.optionListeners = [];
            this.invalidateIntent();
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

        on(type, criteria, handler) {
            if (this.destroyed) return this;
            if (typeof criteria === 'function' && handler === undefined) {
                handler = criteria;
                criteria = null;
            }
            if (typeof handler !== 'function') throw new TypeError('HandTrick handler must be a function');
            type = normalizeEventType(type);
            const listener = criteria ? detail => {
                if (HandTrick.matches(detail, criteria || {})) handler(detail);
            } : handler;
            if (!this.listeners.has(type)) this.listeners.set(type, new Set());
            this.listeners.get(type).add(listener);
            this.activateListener(type);
            this.invalidateIntent();
            return this;
        }

        once(type, criteria, handler) {
            if (this.destroyed) return this;
            if (typeof criteria === 'function' && handler === undefined) {
                handler = criteria;
                criteria = null;
            }
            if (typeof handler !== 'function') throw new TypeError('HandTrick handler must be a function');
            type = normalizeEventType(type);
            const wrap = detail => {
                if (criteria && !HandTrick.matches(detail, criteria || {})) return;
                this.off(type, handler);
                handler(detail);
            };
            if (!this.onceWrappers.has(type)) this.onceWrappers.set(type, new Map());
            this.onceWrappers.get(type).set(handler, wrap);
            return this.on(type, wrap);
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
                set.delete(wrap || handler);
                if (wraps) wraps.delete(handler);
            } else {
                set.clear();
                this.onceWrappers.delete(type);
            }
            this.invalidateIntent();
            return this;
        }

        when(type, criteria, handler) {
            if (typeof criteria === 'function' && handler === undefined) return this.on(type, criteria);
            return this.on(type, criteria, handler);
        }

        emit(type, detail) {
            if (this.destroyed) return detail || {};
            const data = Object.assign({}, detail || {}, { type });
            Object.defineProperty(data, 'instance', {
                value: this,
                enumerable: false,
                configurable: true
            });
            const run = eventType => {
                const set = this.listeners.get(eventType);
                if (!set) return;
                Array.from(set).forEach(handler => handler(data));
            };

            run(type);
            run('*');
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
            this.bindOptionCallbacks(this.options);
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
                    if (!activatableGestures[key] || !isPlainObject(value[key]) || value[key].enabled === undefined) return;
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
                const group = gestureForEvent(value);
                if (group) groups.add(group);
            };
            if (!type || type === '*') return [];
            if (isSequencePatternEvent(type)) sequenceTokens(type).forEach(add);
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
            if (!options || opt.gestures || opt.sequences) this.resetSequences();
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
            this.optionListeners = [];
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
                const detail = this.detail('cancel', Object.assign({ reason: reason || 'cancel' }, extra || {}));
                this.emit('gesturecancel', Object.assign({}, detail, { gesture: this.primaryGesture() }));
                this.emit('cancel', detail);
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
            const detail = this.detail(name + 'end', Object.assign({ originalEvent: event }, extra || {}));
            if (name === 'path') this.emitPathEnd(detail);
            else this.emit(name + 'end', detail);
            if (reset && name !== 'path') this.session[flag] = false;
        }

        emitStartedEnds(event, extra, reset) {
            ['pan', 'pinch', 'rotate', 'path'].forEach(name => this.emitStartedEnd(name, event, extra, reset));
        }

        emitModifierPanEnd(kind, event, reset) {
            const mod = this.session && this.session[kind];
            if (!mod || !mod.panStarted) return;
            const point = this.points.get(mod.actionId);
            const detail = kind === 'keyboardModifier' ? this.keyboardModifierDetail('modifierpanend', event, point) : this.modifierDetail('modifierpanend', event, point);
            this.emit('modifierpanend', detail);
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
                events: this.options.intent && Array.isArray(this.options.intent.events) ? this.options.intent.events.slice() : null
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
                this.emit('ignored', { originalEvent: event, target });
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
            const releaseDetail = this.detail(cancelled ? 'cancel' : 'end', {
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
            const endingDetail = this.detail('end', {
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
                this.emit('ignored', {
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
                    gesture: scale !== 1 ? 'wheelzoom' : 'wheel',
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

            this.emit('gesturecommit', Object.assign({}, detail, { gesture: scale !== 1 ? 'wheelzoom' : 'wheel' }));
            this.recordGestureSequence(scale !== 1 ? 'wheelzoom' : 'wheel', detail, 1);
            this.emit('wheel', detail);
            if (scale !== 1) this.emit('wheelzoom', detail);
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
            if (this.session) this.endRunningGestures(event);

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
                const detail = this.detail('start', { originalEvent: event, added: 1, removed: 0, changedPointer: this.exportPoint(point, this.rect()) });
                this.emit('start', detail);
                this.emit('gesturestart', Object.assign({}, detail, { gesture: 'session' }));
            } else {
                this.cancelPress('fingerchange');
                this.session.releaseGuard = null;
                this.startModifier(id, point, activeBefore, time);
                this.addRollingPoint(id, point, time);
                this.resetBasis(time);
                const detail = this.detail('fingerchange', { originalEvent: event, change: 'add', added: 1, removed: 0, changedPointer: this.exportPoint(point, this.rect()) });
                this.emit('fingerchange', detail);
                this.emit('gesturetransition', Object.assign({}, detail, { gesture: 'topology' }));
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
                rotateStarted: false,
                rotateBaseAngle: null,
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
                    const detail = this.detail('fingerchange', { originalEvent: event, change: 'cancel', added: 0, removed: 1, changedPointer });
                    this.emit('fingerchange', detail);
                    this.emit('gesturetransition', Object.assign({}, detail, { gesture: 'topology' }));
                }
                return;
            }

            this.endKeyboardModifier(id, point, event);
            this.endModifier(id, point, event);
            this.endRollingPoint(id, this.time());
            const releaseDetail = this.detail('end', { originalEvent: event, changedPointer });

            if (countBefore > 1 && !this.session.consumed && this.isSwipe(releaseDetail)) {
                this.emitSwipe(releaseDetail);
            }

            this.points.delete(id);
            this.pointsDirty = true;

            if (this.points.size) {
                this.cancelPress('fingerchange');
                this.endRunningGestures(event);
                this.markReleaseGuard(countBefore);
                this.resetBasis(this.time());
                const detail = this.detail('fingerchange', { originalEvent: event, change: 'remove', added: 0, removed: 1, changedPointer });
                this.emit('fingerchange', detail);
                this.emit('gesturetransition', Object.assign({}, detail, { gesture: 'topology' }));
                return;
            }

            const endingDetail = this.detail('end', {
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
            this.emit('gestureend', Object.assign({}, endDetail, { gesture: this.primaryGesture() }));
            this.emit('end', endDetail);
            this.session = null;
            this.releaseGestureStyles();
        }

        processMove(event) {
            if (!this.session || !this.points.size) return;
            const detail = this.detail('move', { originalEvent: event });
            const releaseGuarded = this.releaseGuardActive();
            detail.releaseGuarded = releaseGuarded;
            this.session.maxFingers = Math.max(this.session.maxFingers, detail.fingers);
            this.session.maxActualFingers = Math.max(this.session.maxActualFingers || 0, detail.actualFingers || this.points.size);
            this.session.center = detail.center;
            this.session.moved = this.session.moved || detail.travel > this.options.tap.maxMove;
            this.emit('move', detail);
            this.emit('gestureupdate', Object.assign({}, detail, { gesture: this.primaryGesture() }));

            if (this.options.pressure.enabled && abs(detail.pressureDelta) >= this.options.pressure.threshold) {
                this.emit('pressurechange', detail);
            }

            if (!this.session.pressStarted && detail.travel > this.options.press.move) this.cancelPress('move');
            if (this.session.pressStarted) this.emit('pressmove', detail);

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
            if (this.session.keyboardModifier && this.session.keyboardModifier.panStarted) return 'modifierpan';
            if (this.session.modifier && this.session.modifier.panStarted) return 'modifierpan';
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
                sequenceTokens(type).forEach(token => {
                    const gesture = gestureForEvent(token);
                    if (gesture) groups.add(gesture);
                });
            };
            const explicit = Array.isArray(opt.events);

            if (explicit) {
                opt.events.forEach(add);
            }

            if (opt.useCallbacks !== false) {
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
            continuousGestures.forEach(gesture => {
                if (!this.allowsGesture(gesture)) return;
                const opt = this.options[gesture];
                if (!opt || !opt.enabled) return;
                if (gesture === 'pan' && !toArray(opt.fingers).includes(detail.fingers)) return;
                if ((gesture === 'pinch' || gesture === 'rotate') && detail.fingers !== opt.fingers) return;
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
            return continuousGestures.filter(gesture => {
                if (!this.allowsGesture(gesture)) return false;
                const opt = this.options[gesture];
                if (!opt || !opt.enabled) return false;
                if (gesture === 'pan') return toArray(opt.fingers).includes(detail.fingers);
                if (gesture === 'swipe') return detail.direction !== 'none';
                return detail.fingers === opt.fingers;
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
            this.emit('gesturecommit', Object.assign({}, detail, { gesture, confidence }));
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
            const baseGesture = gestureForEvent(gesture) || gesture;

            if (last && windowTime && time - last.time > windowTime) this.gestureSequence = [];

            this.gestureSequence.push({
                event: gesture,
                gesture: baseGesture,
                time,
                fingers: detail.fingers,
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
                matches.push({
                    type,
                    rawTokens,
                    pattern,
                    sequence,
                    order,
                    specificity: this.sequenceSpecificity(pattern),
                    detail: Object.assign({}, detail, {
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
                    })
                });
                order++;
            });

            matches.sort((a, b) => b.pattern.length - a.pattern.length || b.specificity - a.specificity || a.order - b.order);
            const best = matches[0] || null;

            if (best) {
                this.clearPendingEmits();
                if (possible) this.queueDirectEmits([{ type: best.type, detail: best.detail }]);
                else this.emit(best.type, best.detail);
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
            if (matcher.tapCount !== null && item.tapCount !== matcher.tapCount) return false;
            if (matcher.multitap && item.tapCount < 2) return false;
            if (matcher.direction && item.direction !== matcher.direction) return false;
            if (matcher.fingers !== null && item.fingers !== matcher.fingers) return false;
            return true;
        }

        sequenceSpecificity(pattern) {
            return pattern.reduce((score, matcher) => {
                let value = score;
                if (matcher.direction) value += 3;
                if (matcher.fingers !== null) value += 2;
                if (matcher.tapCount !== null) value += 2;
                if (matcher.multitap) value += 1;
                if (matcher.raw !== matcher.token) value += 1;
                return value;
            }, 0);
        }

        queueDirectEmits(items, delay) {
            if (!items || !items.length || this.destroyed) return;
            this.pendingEmits = this.pendingEmits.concat(items.map(item => ({
                type: item.type,
                detail: item.detail
            })));
            this.schedulePendingEmits(delay);
        }

        emitDirectEmits(items) {
            if (!items || !items.length) return;
            items.forEach(item => this.emit(item.type, item.detail));
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
            const detail = this.modifierDetail('modifiermove', event, action);
            if (!mod.panStarted) {
                if (detail.actionTravel < this.options.modifier.panThreshold) return;
                if (this.time() - mod.startTime < this.options.modifier.panDelay) return;
                mod.panStarted = true;
                this.session.consumed = true;
                this.cancelPress('modifierpan');
                this.commit('modifierpan', detail, 1);
                this.emit('modifierpanstart', detail);
            }
            this.emit('modifierpan', detail);
        }

        handleKeyboardModifierMove(event) {
            const mod = this.session && this.session.keyboardModifier;
            if (!mod || mod.ended || mod.cancelled) return false;
            const action = this.points.get(mod.actionId);
            if (!action) return false;
            const detail = this.keyboardModifierDetail('modifiermove', event, action);

            if (!mod.panStarted) {
                if (detail.actionTravel < this.options.modifier.panThreshold) return true;
                if (this.time() - mod.startTime < this.options.modifier.panDelay) return true;
                mod.panStarted = true;
                this.session.consumed = true;
                this.cancelPress('keyboardmodifierpan');
                this.commit('modifierpan', detail, 1);
                this.emit('modifierpanstart', detail);
            }

            this.emit('modifierpan', detail);
            return true;
        }

        endModifier(id, point, event) {
            const mod = this.session && this.session.modifier;
            if (!mod || mod.actionId !== id || mod.ended || mod.cancelled) return;
            mod.ended = true;
            const detail = this.modifierDetail(mod.panStarted ? 'modifierpanend' : 'modifiertap', event, point);

            if (mod.panStarted) {
                this.emit('modifierpanend', detail);
                mod.panStarted = false;
            } else if (
                this.time() - mod.startTime <= this.options.modifier.maxTapTime &&
                detail.actionTravel <= this.options.modifier.maxTapMove
            ) {
                if (this.hasRollingTapCandidate(event)) return;
                this.session.consumed = true;
                this.commit('modifiertap', detail, 1);
                this.emit('modifiertap', detail);
            }
        }

        endKeyboardModifier(id, point, event) {
            const mod = this.session && this.session.keyboardModifier;
            if (!mod || mod.actionId !== id || mod.ended || mod.cancelled) return;
            mod.ended = true;
            const detail = this.keyboardModifierDetail(mod.panStarted ? 'modifierpanend' : 'modifiertap', event, point);

            if (mod.panStarted) {
                this.emit('modifierpanend', detail);
                mod.panStarted = false;
            } else if (
                this.time() - mod.startTime <= this.options.modifier.maxTapTime &&
                detail.actionTravel <= this.options.modifier.maxTapMove
            ) {
                this.session.consumed = true;
                this.commit('modifiertap', detail, 1);
                this.emit('modifiertap', detail);
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
                this.emit('panstart', panDetail);
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
                this.emitPath(this.pathDetail(detail));
                return;
            }

            if (last && directionTurn(last.direction, direction) < opt.turnAngle) return;

            const segment = this.createPathSegment(direction, path.origin, detail.center, time);
            path.segments.push(segment);
            while (path.segments.length > Math.max(1, opt.maxSegments || 1)) path.segments.shift();
            path.origin = pointSnapshot(detail.center);
            path.lastTime = time;

            const pathDetail = this.pathDetail(detail);
            if (!this.session.pathStarted) {
                this.session.pathStarted = true;
                if (opt.consume) this.session.consumed = true;
                this.commit('path', pathDetail, 1);
                this.emit('pathstart', pathDetail);
            }
            this.emitPath(pathDetail);
        }

        createPathState(detail, origin) {
            return {
                origin: pointSnapshot(origin || detail.startCenter || detail.center),
                segments: [],
                lastTime: 0,
                matched: {}
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
            this.emit('path', detail);
            this.emitPathPatterns(detail);
        }

        emitPathPatterns(detail) {
            const path = this.session && this.session.path;
            if (!path || !detail.path || !detail.path.length) return;

            this.listeners.forEach((set, type) => {
                if (!set || !set.size || !isPathPatternEvent(type)) return;
                const pattern = pathPatternFromEvent(type);
                if (!pathMatches(detail.path, pattern)) return;
                const key = type + '|' + detail.path.length;
                if (path.matched[key]) return;
                path.matched[key] = true;
                this.emit(type, this.pathDetail(detail, { pathMatched: pattern }));
            });
        }

        emitPathEnd(detail) {
            const pathDetail = this.pathDetail(detail);
            this.emit('pathend', pathDetail);
            if (this.session) {
                this.session.pathStarted = false;
                this.session.path = null;
            }
        }

        handlePinch(detail) {
            const opt = this.options.pinch;
            if (this.session.modifier && this.session.modifier.panStarted) return;
            if (!this.allowsGesture('pinch')) return;
            if (!opt.enabled || detail.fingers !== opt.fingers || !detail.distance || this.session.panStarted) return;

            const distanceDelta = abs(detail.distance - detail.startDistance);
            const scaleDelta = abs(detail.scale - 1);

            if (!this.session.pinchStarted) {
                if (detail.confidences.pinch < 1) return;
                if (distanceDelta < opt.distance && scaleDelta < opt.scale) return;
                if (detail.motion.parallel > 0.72 && detail.motion.translationShare > 0.5) return;
                if (distanceDelta <= detail.travel * opt.dominance) return;
                this.session.pinchStarted = true;
                this.session.pinchBaseDistance = detail.distance || 0;
                this.session.consumed = true;
                this.cancelPress('pinch');
                detail = this.rebasedTransformDetail(detail);
                this.commit('pinch', detail, detail.confidences.pinch);
                this.emit('pinchstart', detail);
            }

            detail = this.rebasedTransformDetail(detail);
            this.claim(detail, detail.confidences.pinch);
            this.emit('pinch', detail);
            this.emit(detail.scale >= 1 ? 'pinchout' : 'pinchin', detail);
        }

        handleRotate(detail) {
            const opt = this.options.rotate;
            if (this.session.modifier && this.session.modifier.panStarted) return;
            if (!this.allowsGesture('rotate')) return;
            if (!opt.enabled || detail.fingers !== opt.fingers || this.session.panStarted) return;

            if (!this.session.rotateStarted) {
                if (detail.confidences.rotate < opt.confidence) return;
                this.session.rotateStarted = true;
                this.session.rotateBaseAngle = detail.angle;
                this.session.consumed = true;
                this.cancelPress('rotate');
                detail = this.rebasedTransformDetail(detail);
                this.commit('rotate', detail, detail.confidences.rotate);
                this.emit('rotatestart', detail);
            }

            detail = this.rebasedTransformDetail(detail);
            this.claim(detail, detail.confidences.rotate);
            this.emit('rotate', detail);
            this.emit((detail.rawRotation !== undefined ? detail.rawRotation : detail.rotation) >= 0 ? 'rotateclockwise' : 'rotatecounterclockwise', detail);
        }

        handleSwipeIntent(detail) {
            const opt = this.options.swipe;
            if (!this.allowsGesture('swipe')) return;
            if (!opt.enabled || this.session.consumed || this.session.pinchStarted || this.session.rotateStarted || this.session.panStarted) return;
            if (detail.travel < opt.intentDistance) return;
            if (!this.intentReady(detail, opt, 'swipe')) return;
            if (!this.session.swipeIntentAt) {
                this.session.swipeIntentAt = this.time();
                this.emit('swipeintent', detail);
                return;
            }
            if (this.time() - this.session.swipeIntentAt >= opt.confidenceDelay) this.session.swipeReady = true;
        }

        emitSwipe(detail) {
            this.session.consumed = true;
            const events = [{ type: 'swipe', detail }];
            if (detail.direction !== 'none') events.push({ type: 'swipe' + detail.direction, detail });
            if (detail.velocity >= this.options.swipe.velocity * 2) events.push({ type: 'flick', detail });
            this.dispatchCommittedEvents('swipe', detail, detail.confidences.swipe, events);
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
            const countAlias = rolling.count + 'fingerrollingtap';
            return [
                { type: 'rollingtap', detail },
                { type: 'rollingtap' + rolling.direction, detail },
                { type: countAlias, detail }
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
            this.dispatchCommittedEvents('rollingtap', rollingDetail, 1, events, rolling.possible ? this.keyboardRollingWindow() : undefined);
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

            if (keyboardRolling && keyboardRolling.ready) {
                this.emitKeyboardRollingTap(tapDetail, keyboardRolling);
                this.rememberLastTap(detail);
                return;
            }

            const countAlias = detail.fingers + 'finger' + (count === 1 ? 'tap' : count === 2 ? 'doubletap' : count === 3 ? 'tripletap' : count + 'tap');
            const events = [
                { type: 'tap', detail: tapDetail },
                { type: 'tapsequence', detail: tapDetail }
            ];
            if (count > 1) events.push({ type: 'multitap', detail: tapDetail });
            events.push({ type: count === 2 ? 'doubletap' : count === 3 ? 'tripletap' : 'singletap', detail: tapDetail });
            const fingerAlias = detail.fingers + 'fingertap';
            events.push({ type: countAlias, detail: tapDetail });
            if (fingerAlias !== countAlias) events.push({ type: fingerAlias, detail: tapDetail });

            if (keyboardRolling && keyboardRolling.possible) {
                this.queueDirectEmits(events, this.keyboardRollingWindow());
                this.rememberLastTap(detail);
                return;
            }

            const sequenceState = this.commit(countAlias, tapDetail, 1);
            if (sequenceState.matched) {
                this.rememberLastTap(detail);
                return;
            }
            if (sequenceState.possible) this.queueDirectEmits(events);
            else this.emitDirectEmits(events);

            this.rememberLastTap(detail);
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
            this.dispatchCommittedEvents('rollingtap', rollingDetail, 1, events);
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
                const detail = this.detail('pressstart', { originalEvent: event });
                this.commit('press', detail, 1);
                this.emit('pressstart', detail);
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
                const type = ended ? 'pressend' : 'presscancel';
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
            this.session.rotateStarted = false;
            this.session.rotateBaseAngle = null;
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
            if (type === 'cancel' || type.endsWith('cancel')) return 'cancelled';
            if (type === 'end' || type.endsWith('end')) return 'ended';
            if (type === 'finish') return 'settling';
            if (type.endsWith('start')) return 'began';
            if (type === 'tap' || type === 'swipe' || type === 'rollingtap' || type === 'modifiertap') return 'committed';
            if (type === 'move' || type.endsWith('move') || type === 'pan' || type === 'pinch' || type === 'rotate') return 'active';
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
            const pinchReady = this.allowsGesture('pinch') && pinchOpt.enabled && detail.fingers === pinchOpt.fingers && this.intentReady(detail, pinchOpt, 'pinch');
            const pinchDistance = pinchReady ? abs(detail.distanceDelta) / Math.max(1, pinchOpt.distance) : 0;
            const pinchScale = pinchReady ? abs(detail.scaleDelta) / Math.max(0.001, pinchOpt.scale) : 0;
            const pinchDominance = pinchReady && detail.travel ? abs(detail.distanceDelta) / Math.max(1, detail.travel * pinchOpt.dominance) : Math.max(pinchDistance, pinchScale);
            let rotate = 0;

            if (this.allowsGesture('rotate') && rotateOpt.enabled && detail.fingers === rotateOpt.fingers && this.intentReady(detail, rotateOpt, 'rotate')) {
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

    HandTrick.version = '1.0.0';
    HandTrick.events = eventNames.slice();
    HandTrick.gestures = Object.keys(eventRegistry).filter(group => group !== 'lifecycle' && group !== 'pressure');
    HandTrick.groups = merge(eventRegistry);
    HandTrick.aliases = merge(eventAliases);
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
        return pathText(value);
    };
    HandTrick.matches = function (event, criteria) {
        const opt = criteria || {};
        if (!event) return false;
        const modifier = event.modifier || null;
        const modifierPoint = modifier && modifier.position ? modifier.position.source : null;
        if (opt.region && !HandTrick.region(event, opt.region)) return false;
        if (opt.startRegion && !HandTrick.region(event && event.startCenter, opt.startRegion)) return false;
        if (opt.area && !matchValue(event.area, opt.area)) return false;
        if (opt.startArea && !matchValue(event.startArea, opt.startArea)) return false;
        if (opt.modifierRegion && !HandTrick.region(modifierPoint, opt.modifierRegion)) return false;
        if (opt.modifierArea && !matchValue(modifier && modifier.area, opt.modifierArea)) return false;
        if (opt.modifierSource && !matchValue(modifier && modifier.source, opt.modifierSource)) return false;
        if (opt.modifierName && !matchValue(modifier && modifier.name, opt.modifierName)) return false;
        if (opt.key && !toArray(opt.key).every(key => (event.keys || []).includes(canonicalKey(key)))) return false;
        if (opt.keys && !matchCombo(event.keyCombo, opt.keys)) return false;
        if (opt.combo && !matchCombo(event.keyCombo, opt.combo)) return false;
        if (opt.modifierKeys && !matchCombo(modifier && modifier.keyCombo, opt.modifierKeys)) return false;
        if (opt.direction && !matchValue(event.direction, opt.direction)) return false;
        if (opt.axis && !matchValue(event.axis, opt.axis)) return false;
        if (opt.path && !pathMatches(event.path || event.pathText, opt.path)) return false;
        if (opt.pathText && !pathMatches(event.path || event.pathText, opt.pathText)) return false;
        if (opt.fingers !== undefined && !matchValue(event.fingers, opt.fingers)) return false;
        if (opt.actualFingers !== undefined && !matchValue(event.actualFingers, opt.actualFingers)) return false;
        if (opt.syntheticFingers !== undefined && !matchValue(event.syntheticFingers, opt.syntheticFingers)) return false;
        if (opt.fingerSource && !matchValue(event.fingerSource, opt.fingerSource)) return false;
        if (opt.keyboardRole && !matchValue(event.keyboardSubstitute && event.keyboardSubstitute.role, opt.keyboardRole)) return false;
        if (opt.pointerType && !matchValue(event.pointerType, opt.pointerType)) return false;
        if (opt.tapCount !== undefined && !matchValue(event.tapCount, opt.tapCount)) return false;
        if (opt.edge && !HandTrick.region(event, opt.edge)) return false;
        return true;
    };
    HandTrick.presets = presetRegistry;
    HandTrick.keyCombo = normalizeCombo;
    return HandTrick;
});
