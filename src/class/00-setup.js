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
