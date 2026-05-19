/** HandTrick.js - MIT © Jelodar */
declare class HandTrick {
    constructor(target: EventTarget | HandTrick.ConstructorOptions, options?: HandTrick.PresetInput);

    target: EventTarget | null;
    enabled: boolean;
    destroyed: boolean;

    static version: string;
    static events: string[];
    static gestures: string[];
    static groups: Record<string, string[]>;
    static aliases: Record<string, string>;
    static presets: Record<string, (options?: HandTrick.Options) => HandTrick.Options>;
    static defaults: HandTrick.Options;
    static create(target: EventTarget, options?: HandTrick.PresetInput): HandTrick;
    static preset(name: HandTrick.PresetInput, options?: HandTrick.Options): HandTrick.Options;
    static region(pointOrEvent: HandTrick.Position | HandTrick.Detail | null | undefined, region: string | string[]): boolean;
    static zone(point: Partial<HandTrick.Position>, options?: { rows?: number; cols?: number }): HandTrick.Zone;
    static matches(event: HandTrick.Detail, criteria?: HandTrick.Criteria): boolean;
    static keyCombo(value: string | string[]): string;
    static path(value: string | string[]): string;

    on(type: HandTrick.EventName, handler: HandTrick.Handler): this;
    on(type: HandTrick.EventName, criteria: HandTrick.Criteria, handler: HandTrick.Handler): this;
    once(type: HandTrick.EventName, handler: HandTrick.Handler): this;
    once(type: HandTrick.EventName, criteria: HandTrick.Criteria, handler: HandTrick.Handler): this;
    off(type?: HandTrick.EventName, handler?: HandTrick.Handler): this;
    when(type: HandTrick.EventName, criteria: HandTrick.Criteria, handler: HandTrick.Handler): this;
    when(type: HandTrick.EventName, handler: HandTrick.Handler): this;
    setOptions(options?: HandTrick.PresetInput): this;
    enable(): this;
    disable(): this;
    cancel(reason?: string, extra?: Partial<HandTrick.Detail>): this;
    resetTaps(): this;
    resetSequences(): this;
    reset(options?: { taps?: boolean; gestures?: boolean; sequences?: boolean }): this;
    refreshRect(): this;
    getIntentState(): HandTrick.IntentState;
    getState(): HandTrick.State;
    destroy(): this;
}

declare namespace HandTrick {
    type EventName = KnownEventName | string;
    type Handler = (event: Detail) => void;
    type PresetInput = string | Options | ((options?: Options) => Options) | Array<string | Options | ((options?: Options) => Options)>;

    type KnownEventName =
        | '*'
        | 'start'
        | 'move'
        | 'end'
        | 'cancel'
        | 'fingerchange'
        | 'gesturestart'
        | 'gestureupdate'
        | 'gesturetransition'
        | 'gesturecommit'
        | 'gestureend'
        | 'gesturecancel'
        | 'ignored'
        | 'tap'
        | 'singletap'
        | 'doubletap'
        | 'tripletap'
        | 'tapsequence'
        | 'multitap'
        | 'press'
        | 'pressstart'
        | 'pressmove'
        | 'pressend'
        | 'presscancel'
        | 'panstart'
        | 'pan'
        | 'panend'
        | 'swipe'
        | 'swipeintent'
        | 'swipeleft'
        | 'swiperight'
        | 'swipeup'
        | 'swipedown'
        | 'swipe:left'
        | 'swipe:right'
        | 'swipe:up'
        | 'swipe:down'
        | 'flick'
        | 'pinchstart'
        | 'pinch'
        | 'pinchend'
        | 'pinchin'
        | 'pinchout'
        | 'pinch:in'
        | 'pinch:out'
        | 'rotatestart'
        | 'rotate'
        | 'rotateend'
        | 'rotateclockwise'
        | 'rotatecounterclockwise'
        | 'rotate:clockwise'
        | 'rotate:counterclockwise'
        | 'pathstart'
        | 'path'
        | 'pathend'
        | 'rollingtap'
        | 'rollingtapleft'
        | 'rollingtapright'
        | 'rollingtapup'
        | 'rollingtapdown'
        | 'rollingtap:left'
        | 'rollingtap:right'
        | 'rollingtap:up'
        | 'rollingtap:down'
        | 'roll'
        | 'roll:left'
        | 'roll:right'
        | 'roll:up'
        | 'roll:down'
        | 'modifiertap'
        | 'modifierpanstart'
        | 'modifierpan'
        | 'modifierpanend'
        | 'pressurechange'
        | 'wheel'
        | 'wheelzoom';

    interface ConstructorOptions extends Options {
        target: EventTarget;
    }

    interface Options {
        preset?: PresetInput;
        presets?: PresetInput;
        enabled?: boolean;
        input?: 'auto' | 'pointer' | 'touch' | 'mouse' | 'hybrid';
        touch?: boolean;
        mouse?: boolean;
        pen?: boolean;
        mouseTouchDelay?: number;
        buttons?: number;
        preventDefault?: boolean;
        stopPropagation?: boolean;
        capture?: boolean;
        windowEvents?: boolean;
        ignore?: string | ((target: EventTarget | null, originalEvent: Event, instance: HandTrick) => boolean);
        callbacks?: Record<string, Handler | Handler[]>;
        clock?: (() => number) | null;
        rect?: 'session' | 'live' | 'static';
        dom?: Partial<DomOptions>;
        intent?: Partial<IntentOptions>;
        claim?: Partial<ClaimOptions>;
        tap?: Partial<TapOptions>;
        tapHold?: Partial<TapHoldOptions>;
        press?: Partial<PressOptions>;
        pan?: Partial<PanOptions>;
        swipe?: Partial<SwipeOptions>;
        pinch?: Partial<PinchOptions>;
        rotate?: Partial<RotateOptions>;
        path?: Partial<PathOptions>;
        rolling?: Partial<RollingOptions>;
        modifier?: Partial<ModifierOptions>;
        pressure?: Partial<PressureOptions>;
        wheel?: Partial<WheelOptions>;
        edge?: Partial<EdgeOptions>;
        [callbackAlias: `on${string}`]: unknown;
    }

    interface DomOptions {
        enabled: boolean;
        target: boolean;
        active: boolean;
        touchAction: string | false;
        userSelect: string | false;
        webkitUserSelect: string | false;
        webkitTouchCallout: string | false;
        webkitUserDrag: string | false;
        webkitTapHighlightColor: string | false;
        selectionGuard: boolean;
        clearSelection: boolean;
        tapGuard: boolean;
        tapGuardDelay: number | null;
        tapGuardDistance: number | null;
        overscrollBehavior: string | false;
    }

    interface IntentOptions {
        history: number;
        enabled: boolean;
        prune: boolean;
        useCallbacks: boolean;
        events: string[] | null;
        fastPath: boolean;
        fastPathMaxCandidates: number;
        fastPathTime: number;
        fastPathSamples: number;
        releaseGuard: number;
        releaseDistance: number;
        sequenceWindow: number;
        sequenceMax: number;
    }

    interface ClaimOptions {
        enabled: boolean;
        threshold: number;
        preventDefault: boolean;
        stopPropagation: boolean;
    }

    interface TapOptions {
        enabled: boolean;
        maxTime: number;
        maxMove: number;
        interval: number;
        distance: number;
    }

    interface TapHoldOptions {
        enabled: boolean;
        window: number;
        distance: number;
        maxRestTime: number;
    }

    interface PressOptions {
        enabled: boolean;
        delay: number;
        move: number;
        repeat: number;
        consumesTap: boolean;
        allowsPan: boolean;
    }

    interface PanOptions {
        enabled: boolean;
        threshold: number;
        minTime: number;
        minSamples: number;
        fingers: number | number[];
        axis: 'free' | 'x' | 'y' | 'lock-x' | 'lock-y' | 'dominant';
        canStart: ((event: Detail, instance: HandTrick) => boolean) | null;
    }

    interface SwipeOptions {
        enabled: boolean;
        distance: number;
        distanceByFingers: Record<number, number>;
        velocity: number;
        axisRatio: number;
        confidenceDelay: number;
        intentDistance: number;
        minTime: number;
        minSamples: number;
        allowAfterPan: boolean;
    }

    interface PinchOptions {
        enabled: boolean;
        fingers: number;
        distance: number;
        scale: number;
        minTime: number;
        minSamples: number;
        dominance: number;
    }

    interface RotateOptions {
        enabled: boolean;
        fingers: number;
        angle: number;
        minTime: number;
        minSamples: number;
        lateAngle: number;
        maxSoftStart: number;
        minAngularVelocity: number;
        requireMovedFingers: boolean;
        dominance: number;
        confidence: number;
    }

    interface PathOptions {
        enabled: boolean;
        fingers: number | number[];
        minDistance: number;
        segmentDistance: number;
        axisRatio: number;
        turnAngle: number;
        maxPause: number;
        maxSegments: number;
        minTime: number;
        minSamples: number;
        consume: boolean;
    }

    interface RollingOptions {
        enabled: boolean;
        fingers: number[];
        minDelay: number;
        maxDelay: number;
        maxDelayByFingers: Record<number, number>;
        keyboardMaxDelay: number;
        maxHold: number;
        maxHoldByFingers: Record<number, number>;
        maxMove: number;
        minSpan: number;
        minStep: number;
        maxGap: number;
        maxGapByFingers: Record<number, number>;
        directionRatio: number;
        offAxisRatio: number;
        consumesTap: boolean;
    }

    interface ModifierOptions {
        enabled: boolean;
        anchorMove: number;
        anchorDelay: number;
        panDelay: number;
        maxTapTime: number;
        maxTapMove: number;
        panThreshold: number;
        keyboard: false | Partial<KeyboardModifierOptions>;
    }

    interface KeyboardModifierOptions {
        enabled: boolean;
        preventNative: boolean;
        roles?: Partial<KeyboardRoleOptions>;
        substitute?: Partial<KeyboardRoleOptions>;
        combos?: Record<string, string | string[]>;
        keys?: Record<string, string | string[]>;
    }

    interface KeyboardRoleOptions {
        modifier: string | string[] | null | false;
        twoFingers: string | string[] | null | false;
        threeFingers: string | string[] | null | false;
        fourFingers: string | string[] | null | false;
        rollingTap: string | string[] | null | false;
        rolling?: string | string[] | null | false;
    }

    interface PressureOptions {
        enabled: boolean;
        threshold: number;
    }

    interface WheelOptions {
        enabled: boolean;
        preventDefault: boolean;
        zoomFactor: number;
        normalize: boolean;
        lineHeight: number;
        pageHeight: number;
    }

    interface EdgeOptions {
        size: number;
    }

    interface Criteria {
        region?: string | string[];
        startRegion?: string | string[];
        area?: string | string[];
        startArea?: string | string[];
        edge?: string | string[];
        modifierRegion?: string | string[];
        modifierArea?: string | string[];
        modifierSource?: string | string[];
        modifierName?: string | string[];
        key?: string | string[];
        keys?: string | string[];
        combo?: string | string[];
        modifierKeys?: string | string[];
        direction?: string | string[];
        axis?: string | string[];
        path?: string | string[];
        pathText?: string | string[];
        fingers?: number | number[];
        actualFingers?: number | number[];
        syntheticFingers?: number | number[];
        fingerSource?: string | string[];
        keyboardRole?: string | string[];
        pointerType?: string | string[];
        tapCount?: number | number[];
    }

    interface Detail {
        type: string;
        originalEvent: Event | null;
        target: EventTarget | null;
        currentTarget: EventTarget | null;
        pointerType: string;
        fingers: number;
        actualFingers: number;
        syntheticFingers: number;
        fingerSource: string;
        maxFingers: number;
        maxActualFingers: number;
        pointers: PointerDetail[];
        activePointers: PointerDetail[];
        changedPointer?: PointerDetail | null;
        changedPointers?: PointerDetail[];
        actionPointer?: PointerDetail | null;
        modifierPointers?: PointerDetail[];
        center: Position;
        startCenter: Position;
        previousCenter: Position;
        region: string;
        startRegion: string;
        previousRegion: string;
        area: string;
        startArea: string;
        edge: Edge;
        startEdge: Edge;
        edgeRegion: string;
        startEdgeRegion: string;
        halfX: string;
        halfY: string;
        halfRegion: string;
        thirdX: string;
        thirdY: string;
        keys: string[];
        keyCombo: string;
        keyboard: KeyboardState;
        keyboardSubstitute: KeyboardSubstitute | null;
        deltaX: number;
        deltaY: number;
        stepX: number;
        stepY: number;
        stepDistance: number;
        stepElapsed: number;
        absX: number;
        absY: number;
        travel: number;
        elapsed: number;
        totalElapsed: number;
        sampleCount: number;
        velocityX: number;
        velocityY: number;
        velocity: number;
        stepVelocityX: number;
        stepVelocityY: number;
        stepVelocity: number;
        acceleration: number;
        direction: string;
        axis: string;
        distance: number;
        startDistance: number;
        previousDistance: number;
        distanceDelta: number;
        distanceVelocity: number;
        scale: number;
        scaleDelta: number;
        rawScale?: number;
        rawScaleDelta?: number;
        rawStartDistance?: number;
        rawDistanceDelta?: number;
        angle: number;
        previousAngle: number;
        rotation: number;
        rawRotation?: number;
        angularVelocity: number;
        pressure: number;
        previousPressure: number;
        pressureDelta: number;
        normalizedPressure: number;
        confidence: number;
        confidences: ConfidenceScores;
        motion: Motion;
        phase: string;
        intent: IntentDetail;
        topology: Topology;
        rect: Rect;
        claimed: boolean;
        tapHold: boolean;
        tapChain: boolean;
        consumed: boolean;
        releaseGuarded: boolean;
        modifier?: ModifierDetail;
        /** The cumulative tap count for tap-family events. */
        tapCount?: number;
        /** The sequence of base gestures in a composed event (e.g. ['tap', 'swipe']). */
        sequence?: string[];
        /** Detailed breakdown of a multi-tap chain. */
        tapSequence?: TapSequence;
        /** Metadata for composed gesture sequences (e.g. 'tap>tap>swipe'). */
        gestureSequence?: GestureSequence;
        /** Continuous held-pointer path directions, e.g. ['down', 'right']. */
        path?: string[];
        /** Continuous held-pointer path string, e.g. 'down>right'. */
        pathText?: string;
        /** Path segments with start/end positions and distances. */
        pathSegments?: PathSegment[];
        /** Bare direction pattern that matched a path listener. */
        pathMatched?: string | null;
        pathDistance?: number;
        rolling?: RollingDetail;
        rollingCount?: number;
        rollingDirection?: string;
        actionDeltaX?: number;
        actionDeltaY?: number;
        actionTravel?: number;
        actionDirection?: string;
        rawDeltaX?: number;
        rawDeltaY?: number;
        rawDeltaZ?: number;
        deltaMode?: number;
        panAxis?: string;
        preventDefault(): void;
        stopPropagation(): void;
    }

    interface Position {
        x: number;
        y: number;
        pageX: number;
        pageY: number;
        clientX: number;
        clientY: number;
        localX: number;
        localY: number;
        ratioX: number;
        ratioY: number;
        clampedRatioX: number;
        clampedRatioY: number;
        inside: boolean;
        area: string;
        edge: Edge;
        edgeRegion: string;
        halfX: string;
        halfY: string;
        halfRegion: string;
        thirdX: string;
        thirdY: string;
        region: string;
        zone: string;
        grid(rows?: number, cols?: number): Zone;
    }

    interface PointerDetail extends Position {
        id: string | number;
        target: EventTarget | null;
        pointerType: string;
        screenX: number;
        screenY: number;
        startX: number;
        startY: number;
        startClientX: number;
        startClientY: number;
        phaseStartX: number;
        phaseStartY: number;
        deltaX: number;
        deltaY: number;
        phaseDeltaX: number;
        phaseDeltaY: number;
        startLocalX: number;
        startLocalY: number;
        startRatioX: number;
        startRatioY: number;
        startArea: string;
        startEdge: Edge;
        startEdgeRegion: string;
        startHalfX: string;
        startHalfY: string;
        startHalfRegion: string;
        startRegion: string;
        startZone: string;
        pressure: number;
        normalizedPressure: number;
        pressureDelta: number;
        tangentialPressure: number;
        tiltX: number;
        tiltY: number;
        twist: number;
        width: number;
        height: number;
    }

    interface ModifierDetail {
        source: 'touch' | 'keyboard' | string;
        name: string;
        fingers: number;
        actionFingers: number;
        totalFingers: number;
        region: string;
        area: string;
        edge: Edge | null;
        halfX: string;
        halfY: string;
        halfRegion: string;
        edgeRegion: string;
        axis?: string;
        keys: string[];
        keyCombo: string;
        keyboard: KeyboardModifierState | null;
        position: {
            source: PointerDetail | null;
            action: PointerDetail | null;
            anchor: PointerDetail | null;
            anchors: PointerDetail[];
        };
    }

    interface KeyboardState {
        shift: boolean;
        alt: boolean;
        ctrl: boolean;
        meta: boolean;
        command: boolean;
        keys: string[];
        combo: string;
    }

    interface KeyboardModifierState extends KeyboardState {
        name: string;
    }

    interface KeyboardSubstitute {
        role: string;
        fingers: number;
        combo: string;
        keys: string[];
        keyboard: KeyboardState;
    }

    interface Edge {
        top: boolean;
        right: boolean;
        bottom: boolean;
        left: boolean;
    }

    interface Rect {
        left: number;
        top: number;
        right: number;
        bottom: number;
        width: number;
        height: number;
    }

    interface Zone {
        row: number;
        col: number;
        rows: number;
        cols: number;
        index: number;
    }

    interface ConfidenceScores {
        pan: number;
        pinch: number;
        rotate: number;
        swipe: number;
    }

    interface Motion {
        parallel: number;
        opposition: number;
        moved: number;
        rotationArc: number;
        translationShare: number;
    }

    interface IntentDetail {
        gesture: string;
        committedAt: number;
        possible?: string[];
        pruned?: boolean;
        samples?: number;
    }

    interface Topology {
        added: number;
        removed: number;
        total: number;
        actual: number;
        max: number;
    }

    interface TapSequence {
        time: number;
        count: number;
        fingers: number;
        center: Position;
        startedAt: number;
        duration: number;
        names: string[];
        taps: Array<{
            time: number;
            elapsed: number;
            fingers: number;
            center: Position;
            target: EventTarget | null;
            keys: string[];
            keyCombo: string;
            keyboard: KeyboardState | null;
            keyboardSubstitute: KeyboardSubstitute | null;
        }>;
    }

    interface GestureSequence {
        type: string;
        pattern?: string[];
        gestures: Array<{
            event: string;
            gesture: string;
            time: number;
            fingers: number;
            direction: string;
            tapCount: number;
            center: Position;
        }>;
        startedAt: number;
        endedAt: number;
        duration: number;
        resolution?: 'exclusive' | string;
    }

    interface RollingDetail {
        source: 'pointer' | 'keyboard' | string;
        keyboard?: KeyboardState | null;
        count: number;
        direction: string;
        axis: string;
        delays: number[];
        gaps: number[];
        span: number;
        duration: number;
        maxMove: number;
        overlapCount: number;
        overlaps: Array<{
            a: string | number;
            b: string | number;
            duration: number;
            startedAt: number;
            endedAt: number;
        }>;
        points: Array<{
            id: string | number;
            downTime: number;
            upTime: number | null;
            x: number;
            y: number;
            clientX: number;
            clientY: number;
        }>;
    }

    interface PathSegment {
        direction: string;
        start: Partial<Position>;
        end: Partial<Position>;
        startedAt: number;
        endedAt: number;
        deltaX: number;
        deltaY: number;
        distance: number;
    }

    interface IntentState {
        pruned: boolean;
        groups: string[] | null;
        events: string[] | null;
    }

    interface State {
        destroyed: boolean;
        enabled: boolean;
        active: boolean;
        fingers: number;
        session: Detail | null;
    }
}

export { HandTrick };
export default HandTrick;
export as namespace HandTrick;
