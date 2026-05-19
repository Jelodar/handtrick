const assert = require('assert');
const HandTrick = require(process.env.TEST_MIN ? '../handtrick.min.js' : '../handtrick.js');

function target(width = 400, height = 300) {
    const doc = {
        listeners: new Map(),
        defaultView: null,
        documentElement: { style: {} },
        body: { style: {} },
        addEventListener(type, handler) {
            if (!this.listeners.has(type)) this.listeners.set(type, new Set());
            this.listeners.get(type).add(handler);
        },
        removeEventListener(type, handler) {
            if (this.listeners.has(type)) this.listeners.get(type).delete(handler);
        },
        getSelection() {
            return {
                removeAllRanges() {}
            };
        }
    };

    return {
        listeners: new Map(),
        ownerDocument: doc,
        style: {},
        addEventListener(type, handler) {
            if (!this.listeners.has(type)) this.listeners.set(type, new Set());
            this.listeners.get(type).add(handler);
        },
        removeEventListener(type, handler) {
            if (this.listeners.has(type)) this.listeners.get(type).delete(handler);
        },
        getBoundingClientRect() {
            return { left: 0, top: 0, right: width, bottom: height, width, height };
        }
    };
}

function mouseEvent(node, x, y, extra = {}) {
    return Object.assign({
        target: node,
        pageX: x,
        pageY: y,
        clientX: x,
        clientY: y,
        screenX: x,
        screenY: y,
        cancelable: false,
        button: 0,
        buttons: 1,
        pointerType: 'mouse'
    }, extra);
}

function pointerEvent(node, id, x, y, extra = {}) {
    return mouseEvent(node, x, y, Object.assign({
        pointerId: id,
        pointerType: 'touch'
    }, extra));
}

function create(options = {}) {
    const node = target();
    const hand = new HandTrick(node, Object.assign({
        input: 'pointer',
        windowEvents: false,
        preventDefault: false,
        wheel: { enabled: false },
        press: { enabled: false }
    }, options));

    return { node, hand };
}

function run(name, fn) {
    try {
        fn();
        console.log('ok ' + name);
    } catch (error) {
        console.error('fail ' + name);
        console.error(error.stack || error.message);
        process.exitCode = 1;
    }
}

module.exports = {
    assert,
    HandTrick,
    target,
    mouseEvent,
    pointerEvent,
    create,
    run
};
