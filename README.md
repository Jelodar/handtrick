# HandTrick

HandTrick is a dependency-free gesture runtime for pointer, touch, mouse, pen, pressure, wheel, and keyboard-modified input.

It turns browser input into one event shape for tap, press, pan, swipe, pinch, rotate, held-pointer paths, rolling taps, modifier gestures, pressure, wheel zoom, lifecycle events, and exclusive composed sequences.

Runtime dependencies: none.

## Install

```sh
npm install handtrick
```

Browser global:

```html
<script src="./handtrick.js"></script>
<script>
const hand = new HandTrick(surface);
</script>
```

Browser module:

```html
<script type="module">
import HandTrick from './handtrick.mjs';
</script>
```

Bundler:

```js
import HandTrick from 'handtrick';
```

CommonJS:

```js
const HandTrick = require('handtrick');
```

## Quick Start

```js
const hand = new HandTrick(surface);

hand.on('tap', event => {
    console.log(event.tapCount, event.region, event.center.localX);
});

hand.on('swipe', event => {
    console.log(event.direction, event.startRegion, event.velocity);
});

hand.on('pinch', event => {
    console.log(event.scale);
});
```

One-line preset:

```js
const hand = new HandTrick(surface, 'media');
```

Preset with overrides:

```js
const hand = new HandTrick(surface, ['media', {
    rotate: { enabled: true, angle: 28, confidence: 1 },
    intent: { events: ['tap', 'swipe', 'pinch', 'rotate'] }
}]);
```

Filtered handlers:

```js
hand.on('tap', { region: 'left' }, previous);
hand.on('tap', { region: 'right' }, next);
hand.on('swipe:up', { startRegion: 'bottom' }, openDrawer);
```

Open [inspector/index.html](inspector/index.html) for the inspection workbench. Then move through [examples/basic.html](examples/basic.html), [examples/media.html](examples/media.html), [examples/sequences.html](examples/sequences.html), and the focused examples.

## Presets

| Preset | Best for | Main behavior |
| --- | --- | --- |
| `media` | Video/image surfaces | Tap, tap-hold pan, swipe, pinch, rolling tap, modifier gestures. Rotate is off by default. |
| `viewer` | Image/doc viewers | Pan, wheel zoom, pinch; swipe off. |
| `carousel` | Paging surfaces | Swipe-focused, with pan/pinch/rotate off. |
| `drawing` | Canvas and pressure input | Low pan threshold, pressure enabled, semantic gestures reduced. |
| `map` | Map-like canvases | Pan, pinch, rotate, wheel zoom; swipe off. |

Use `HandTrick.preset(name, overrides)` when a plain config object is easier:

```js
const options = HandTrick.preset('map', {
    rotate: { angle: 18 }
});
```

Keep `intent.events` close to the commands the app actually handles. It reduces recognition work and prevents unrelated gesture families from claiming input.

Explicit listeners extend presets. If `media` disables rotate and the app later calls `hand.on('rotate', handler)`, rotate is enabled and added to intent pruning for that instance. Direct config still wins: `{ rotate: { enabled: false } }` stays disabled until changed with `setOptions`.

## Learning Path

### 1. Defaults

```js
const hand = new HandTrick(surface);
hand.on('tap', event => console.log(event.region));
hand.on('swipe', event => console.log(event.direction));
```

This already covers mouse, touch, pen, pressure-capable pointers, wheel-capable browsers, and keyboard modifier metadata.

### 2. Preset

```js
const hand = new HandTrick(surface, 'media');
hand.on('pinch', event => setZoom(event.scale));
```

Presets are normal config. They do not hide the underlying options.

### 3. Metadata Routing

```js
hand.on('tap', { region: 'left' }, previous);
hand.on('tap', { region: 'right' }, next);
hand.on('swipe:up', { startRegion: 'bottom' }, showPanel);
```

Prefer metadata filters over many custom event names. The payload already carries where the gesture started, where it ended, finger count, keyboard substitute state, direction, and grid helpers.

### 4. Desktop Equivalents

```js
hand.on('2fingertap', fit);
hand.on('swipe', { fingers: 2, fingerSource: 'keyboard' }, changeFolder);
hand.on('rollingtap:right', cycleMode);
```

Alt defaults to two fingers, Ctrl to three. Meta defaults to keyboard rolling tap: Meta-click twice or three times in a short directional line emits `rollingtap`. Shift defaults to a modifier anchor. Every role can be changed or disabled, including a custom four-finger keyboard substitute.

### 5. Sequences

```js
hand.on('tap>tap>swipe', fastForward);
hand.on('doubletap>swipe', fastForward);
```

`doubletap>swipe` normalizes to the same committed shape as `tap>tap>swipe`. Explicit tap atoms are still easiest to reason about, but aggregate aliases are safe and deterministic.

## Supported Events

| Family | Events | Main config | Description |
| --- | --- | --- | --- |
| Lifecycle | `start`, `move`, `end`, `cancel`, `fingerchange`, `gesturestart`, `gestureupdate`, `gesturetransition`, `gesturecommit`, `gestureend`, `gesturecancel`, `ignored` | `enabled`, `input`, `ignore`, `windowEvents` | Session flow and low-level state. |
| Tap | `tap`, `singletap`, `doubletap`, `tripletap`, `tapsequence`, `multitap`, generated aliases like `2fingertap`, `1finger4tap` | `tap.maxTime`, `tap.maxMove`, `tap.interval`, `tap.distance` | Single and multi-finger tap chains. |
| Press | `press`, `pressstart`, `pressmove`, `pressend`, `presscancel` | `press.delay`, `press.move`, `press.repeat`, `press.consumesTap` | Long press with optional repeats. |
| Pan | `panstart`, `pan`, `panend` | `pan.threshold`, `pan.fingers`, `pan.axis`, `pan.canStart` | Continuous translation. |
| Swipe | `swipe`, `swipeintent`, `swipeleft`, `swiperight`, `swipeup`, `swipedown`, `swipe:left`, `swipe:right`, `swipe:up`, `swipe:down`, `flick` | `swipe.distance`, `swipe.distanceByFingers`, `swipe.velocity`, `swipe.axisRatio` | Directional release gesture. |
| Pinch | `pinchstart`, `pinch`, `pinchend`, `pinchin`, `pinchout`, `pinch:in`, `pinch:out` | `pinch.distance`, `pinch.scale`, `pinch.dominance` | Two-pointer scale, rebased to `1` at activation. |
| Rotate | `rotatestart`, `rotate`, `rotateend`, `rotateclockwise`, `rotatecounterclockwise`, `rotate:clockwise`, `rotate:counterclockwise` | `rotate.angle`, `rotate.minAngularVelocity`, `rotate.dominance`, `rotate.confidence` | Two-pointer rotation, rebased to `0` at activation. |
| Path | `pathstart`, `path`, `pathend`, bare direction listeners such as `left>down` | `path.minDistance`, `path.segmentDistance`, `path.axisRatio`, `path.turnAngle`, `path.maxPause` | Held-pointer direction transitions such as L-shapes and zig-zags. |
| Rolling Tap | `rollingtap`, `rollingtapleft`, `rollingtapright`, `rollingtapup`, `rollingtapdown`, `rollingtap:left`, `rollingtap:right`, `rollingtap:up`, `rollingtap:down`, `roll`, `roll:right`, generated aliases like `3fingerrollingtap` | `rolling.minDelay`, `rolling.maxDelay`, `rolling.keyboardMaxDelay`, `rolling.maxHold`, `rolling.maxMove`, `rolling.maxGap` | Staggered same-hand tap wave, with Meta-click keyboard substitute by default. |
| Modifier | `modifiertap`, `modifierpanstart`, `modifierpan`, `modifierpanend` | `modifier.anchorDelay`, `modifier.panThreshold`, `modifier.keyboard.roles`, `modifier.keyboard.combos` | Held pointer or keyboard modifier plus action pointer. |
| Pressure | `pressurechange` | `pressure.threshold` | Aggregate pointer pressure changes. |
| Wheel | `wheel`, `wheelzoom` | `wheel.preventDefault`, `wheel.zoomFactor`, `wheel.normalize` | Wheel payload normalized into the common shape. |
| Sequence | `tap>swipe`, `tap>tap>swipe`, `doubletap>swipe`, `2fingerdoubletap>swipe`, `rollingtap>modifiertap` | `intent.sequenceWindow`, `intent.sequenceMax` | Exclusive committed gesture chains. |

## Event Payload

Handlers receive one `detail` object. Common fields first:

| Field | Type | Description |
| --- | --- | --- |
| `type` | `string` | Event name, such as `tap`, `swipe`, or `left>down`. |
| `target` | `EventTarget` | Original target for the active pointer. |
| `currentTarget` | `EventTarget` | Element bound to HandTrick. |
| `pointerType` | `string` | `mouse`, `touch`, `pen`, `wheel`, or `none`. |
| `fingers` | `number` | Effective pointer count, including keyboard substitution. |
| `actualFingers` | `number` | Real pointer count. |
| `syntheticFingers` | `number` | Keyboard-substituted finger count, or `0`. |
| `fingerSource` | `string` | `pointer`, `keyboard`, or `none`. |
| `maxFingers` | `number` | Maximum effective pointer count seen in the session. |
| `center`, `startCenter`, `previousCenter` | `Position` | Current, phase-start, and previous aggregate positions. |
| `deltaX`, `deltaY` | `number` | Translation from `startCenter`. |
| `direction` | `string` | `right`, `left`, `up`, `down`, or `none`. |
| `axis` | `string` | `x`, `y`, or `none`. |
| `velocity` | `number` | Travel velocity in px/ms. |
| `region`, `startRegion` | `string` | Position aliases from current and start centers. |
| `keys`, `keyCombo`, `keyboard` | Keyboard state | Session keyboard snapshot. |
| `preventDefault()` | `function` | Prevent native event when possible. |
| `stopPropagation()` | `function` | Stop native event when possible. |

Gesture-specific fields:

| Field | Appears on | Description |
| --- | --- | --- |
| `tapCount`, `tapSequence` | Tap family | Cumulative tap count and tap-chain details. |
| `scale`, `scaleDelta` | Pinch, wheelzoom | Rebased scale and delta. `rawScale` keeps pre-rebase diagnostic value. |
| `rotation`, `angularVelocity` | Rotate | Rebased signed degrees and angular velocity. `rawRotation` keeps pre-rebase diagnostic value. |
| `path`, `pathText`, `pathSegments`, `pathMatched` | Path | Direction list, direction string, segment data, and matched bare pattern. |
| `rolling`, `rollingCount`, `rollingDirection` | Rolling tap | Source, direction, count, delays, gaps, span, duration, overlap diagnostics, and contact order. |
| `actionPointer`, `modifierPointers`, `modifier` | Modifier | Action pointer, held anchors, source/name/keyboard metadata. |
| `keyboardSubstitute` | Keyboard role sessions | Role, combo, key list, and substituted finger count. |
| `gestureSequence` | Sequence listeners | Historical gestures, raw listener pattern, duration, and `resolution: 'exclusive'`. |

Diagnostics:

| Field | Description |
| --- | --- |
| `elapsed`, `totalElapsed`, `sampleCount` | Timing and sample gates. |
| `confidence`, `confidences` | Recognition scores for pan, pinch, rotate, and swipe. |
| `intent` | Commitment state, possible gestures, pruning state, sample count. |
| `motion` | Two-pointer motion shape: parallelism, opposition, rotation arc, translation share. |
| `topology` | Pointer add/remove counts and max pointer count. |
| `rect` | Target bounding rect used for position metadata. |

## Position Metadata

`center`, `startCenter`, `previousCenter`, pointers, and modifier positions expose:

| Property | Description |
| --- | --- |
| `pageX`, `pageY` | Document coordinates. |
| `clientX`, `clientY` | Viewport coordinates. |
| `localX`, `localY` | Coordinates relative to `currentTarget`. |
| `ratioX`, `ratioY` | Unclamped normalized local coordinates. |
| `clampedRatioX`, `clampedRatioY` | 0..1 normalized coordinates. |
| `inside` | Whether the point is inside the target rect. |
| `area` | `center`, `edge`, `inside`, or `outside`. |
| `region` | 3x3 zone: `top-left`, `center`, `bottom-right`, etc. |
| `halfRegion` | Coarse region: `top`, `bottom`, `left`, `right`, `center`, etc. |
| `edgeRegion` | Specific edge/corner or `none`. |
| `zone` | Same stable string as `region`. |
| `grid(rows, cols)` | Custom grid lookup returning `{ row, col, rows, cols, index }`. |

```js
hand.on('tap', { region: 'left' }, previous);
hand.on('swipe:up', { startRegion: 'bottom' }, showControls);

hand.on('tap', event => {
    const cell = event.center.grid(4, 4);
    console.log(cell.row, cell.col, cell.index);
});
```

## Paths

Paths are held-pointer direction chains. Public path definitions are bare directions only:

```js
hand.on('down>right', event => {
    openCommand(event.pathSegments);
});

hand.on('path', { path: 'left>up' }, event => {
    undoAt(event.center);
});

const command = HandTrick.path('left>down'); // left>down
```
The recognizer is conservative: a new segment needs enough distance, a clear axis, a real turn, and no long pause.

## Sequences

Sequences use `>` between committed gestures after releases:

```js
hand.on('tap>tap>swipe', event => {
    console.log(event.gestureSequence.duration);
});
```

Rules:

- Sequences are exclusive. If `tap>tap>swipe` wins, shorter pending `tap`, `doubletap`, `tap>swipe`, and direct `swipe` handlers for the same chain do not fire.
- Longest match wins. Ties prefer higher specificity, such as `swiperight` over `swipe`.
- Aggregate tap aliases expand into tap atoms. `doubletap>swipe` is equivalent to `tap>tap>swipe`; `tripletap>swipe` is equivalent to `tap>tap>tap>swipe`.
- Explicit atoms remain the clearest style when documenting app commands.
- Direction-specific swipe aliases work: `swipeleft`, `swiperight`, `swipeup`, `swipedown`, and `swipe:left` style names.
- Finger aliases work: `2fingertap>swipe`, `2fingerdoubletap>swipe`, `3fingertap>tap`.
- Gap must fit `intent.sequenceWindow` (default `1200` ms).
- Use `hand.resetSequences()` after consuming a command when you want a hard boundary.

## Rolling Tap

A rolling tap is a staggered, overlapping same-hand tap wave. It is not a modifier and not a simultaneous multi-finger tap.

```js
hand.on('rollingtap:right', event => {
    console.log(event.rolling.count, event.rolling.delays);
});

hand.on('roll:right', nextMode);
hand.on('rollingtap:left', { fingers: 3 }, command);
```

Default proof:

- Exactly 2, 3, or 4 contacts.
- Adjacent down events are 10..500 ms apart.
- Each adjacent contact overlaps: pointer N must go down before pointer N-1 lifts.
- Each finger holds no more than 780 ms.
- Movement stays under 18 px.
- Contact order is monotonic and directional.
- Total directional span is at least 24 px and each adjacent step is at least 10 px by default.
- Adjacent contacts stay within same-hand gap bounds.

Near-simultaneous contacts below `rolling.minDelay` stay normal multi-finger taps. Slow stagger above `rolling.maxDelay` becomes separate tap/modifier input. `rollingtap` remains the clearest name for docs; `roll` is a short alias for apps that prefer compact listener names.

Rolling proof runs before multi-finger tap fallback. When a directional two- or three-finger roll is plausible, it can suppress `2fingertap`, `3fingertap`, and modifier-tap fallback for the same overlapping contacts.

Three- and four-finger rolls get wider default bounds through ratio-derived maps: `rolling.maxDelayByFingers`, `rolling.maxGapByFingers`, and `rolling.maxHoldByFingers`. The seeds are the two-finger defaults, then 3F/4F expand from those seeds so the tuning stays maintainable.

`event.rolling.source` is `pointer` or `keyboard`. Pointer rolls include `overlapCount` and `overlaps`; keyboard rolls report `overlapCount: 0` so apps can distinguish diagnostics without changing handlers.

Separate one-finger taps never resolve as `rollingtap`. A physical roll needs simultaneous overlap across distinct pointer IDs. On desktop, Meta-clicks are the explicit keyboard substitute and use the same output shape without pretending contacts overlap. Meta-click twice in a short directional line emits a two-finger keyboard rolling tap; Meta-click three times emits a three-finger one. Invalid or non-directional Meta clicks fall back to the normal tap chain after the pending window.

## Keyboard Roles

Keyboard roles make desktop testing and mouse-first apps close to touch without faking pointer coordinates.

| Role | Default combo | Emits |
| --- | --- | --- |
| `modifier` | `shift` | `modifiertap`, `modifierpanstart`, `modifierpan`, `modifierpanend` |
| `twoFingers` | `alt` | One pointer reports `fingers: 2`; aliases such as `2fingertap` work. |
| `threeFingers` | `ctrl` | One pointer reports `fingers: 3`; aliases such as `3fingertap` work. |
| `rollingTap` | `meta` | Directional Meta-click chains emit `rollingtap` with keyboard source metadata. |
| `fourFingers` | off | Available by config when an app needs a four-finger desktop substitute. |

```js
const hand = new HandTrick(surface, {
    modifier: {
        keyboard: {
            roles: {
                modifier: 'shift+alt',
                twoFingers: 'alt',
                threeFingers: 'ctrl',
                rollingTap: 'meta',
                fourFingers: 'shift+meta'
            },
            combos: {
                resize: 'shift+alt'
            }
        }
    }
});

hand.on('modifierpan', { modifierName: 'resize' }, resize);
hand.on('swipe', { fingers: 2, fingerSource: 'keyboard' }, desktopTwoFingerSwipe);
```

Role rules:

- Combos are exact after normalization.
- Set a role to `null` or `false` to free the combo.
- Named `keyboard.combos` label modifier gestures.
- Keyboard substitution changes `fingers` and `maxFingers`; `actualFingers` stays the real pointer count.
- Keyboard rolling sets `keyboardSubstitute.role` to `rollingTap` and `rolling.source` to `keyboard`.

## 28Tuning cookbook:

| Symptom | First change | Why |
| --- | --- | --- |
| Tap misses on mobile | Raise `tap.maxMove`, then `tap.distance`. | Finger landings drift more than mouse clicks. |
| Double tap too easy | Lower `tap.interval` or `tap.distance`. | Multi-tap chains should stay nearby and recent. |
| Swipe fires during short drags | Raise `swipe.distanceByFingers[1]` and `swipe.intentDistance`. | Distance is a stronger guard than velocity alone. |
| Two-finger swipe feels too hard | Lower `swipe.distanceByFingers[2]`, not global `swipe.distance`. | Multi-finger travel is naturally shorter. |
| Pinch fires during two-finger pan | Raise `pinch.distance` or `pinch.dominance`. | Parallel movement should stay translation. |
| Rotate fires during pinch | Raise `rotate.angle`, `rotate.confidence`, and `rotate.dominance`. | App commands need more proof than visual rotation previews. |
| Path commands trigger on shaky swipes | Raise `path.axisRatio`, `path.segmentDistance`, or `path.turnAngle`. | Paths need clean cardinal movement and real turns. |
| Rolling tap misses | Raise `rolling.maxDelay` slightly before lowering `rolling.minDelay`. | Too-low min delay collides with simultaneous multi-finger taps. |
| Native page scroll leaks through | Keep `dom.touchAction: 'none'` and `claim.preventDefault: true`. | Browser gestures must be stopped before semantic gestures commit. |

Avoid lowering `minTime` and `minSamples` together unless the app owns the whole surface and false positives are acceptable.

## Native Selection And iOS Loupe

HandTrick applies DOM suppression by default:

```js
new HandTrick(surface, {
    dom: {
        enabled: true,
        selectionGuard: true,
        tapGuard: true,
        touchAction: 'none',
        userSelect: 'none',
        webkitUserSelect: 'none',
        webkitTouchCallout: 'none'
    }
});
```

`tapGuard` prevents the second nearby rapid native tap at capture time. This matters for iOS text selection/loupe because clearing selection after WebKit starts the callout is often too late.

Disable it only when the target intentionally contains selectable text:

```js
new HandTrick(editor, {
    dom: { tapGuard: false, selectionGuard: false }
});
```

## API

### Constructor

```js
new HandTrick(target, options);
new HandTrick(target, 'media');
new HandTrick({ target, preset: 'media' });
```

### Instance Methods

| Method | Description |
| --- | --- |
| `on(type, handler)` | Listen for an event, wildcard `*`, sequence, bare path chain, or `event:specific` alias. |
| `on(type, criteria, handler)` | Conditional listener using the same matcher as `HandTrick.matches`. |
| `once(type, handler)` / `once(type, criteria, handler)` | Listen once, optionally with criteria. |
| `off(type?, handler?)` | Remove listeners. |
| `when(type, criteria, handler)` | Compatibility alias for conditional `on`. |
| `setOptions(options)` | Merge options or preset at runtime. |
| `enable()` / `disable()` | Toggle monitoring and DOM suppression. |
| `cancel(reason?)` | Cancel active session. |
| `resetTaps()` | Clear tap-chain memory. |
| `resetSequences()` | Clear released gesture sequence memory and pending exclusive events. |
| `reset(options?)` | Reset `taps`, `gestures`, or `sequences`. |
| `refreshRect()` | Clear cached rect data. |
| `getState()` | Inspect runtime state. |
| `getIntentState()` | Inspect pruning state. |
| `destroy()` | Remove listeners, restore styles, clear state. |

### Static Helpers

| Helper | Description |
| --- | --- |
| `HandTrick.create(target, options)` | Factory method. |
| `HandTrick.preset(name, overrides?)` | Return config object. |
| `HandTrick.defaults` | Deep copy of defaults. |
| `HandTrick.events` | Public event names. |
| `HandTrick.gestures` | Gesture families. |
| `HandTrick.groups` | Event groups. |
| `HandTrick.aliases` | Callback aliases, such as `onTap`. |
| `HandTrick.matches(detail, criteria)` | Criteria matcher used by `when`. |
| `HandTrick.region(pointOrEvent, region)` | Region matcher. |
| `HandTrick.zone(point, { rows, cols })` | Custom grid helper. |
| `HandTrick.keyCombo(value)` | Normalize keyboard combo strings. |
| `HandTrick.path(value)` | Normalize bare path definitions to `left>down` form. Invalid prefixed path strings return empty. |

## Configuration Quick Reference

| Namespace | Key options | Defaults |
| --- | --- | --- |
| `tap` | `maxTime`, `maxMove`, `interval`, `distance` | `420`, `18`, `340`, `80` |
| `tapHold` | `window`, `distance`, `maxRestTime` | `1200`, `160`, `320` |
| `press` | `delay`, `move`, `repeat`, `consumesTap` | `500`, `14`, `0`, `true` |
| `pan` | `threshold`, `fingers`, `axis`, `canStart` | `12`, `[1]`, `free`, `null` |
| `swipe` | `distance`, `distanceByFingers`, `velocity`, `axisRatio` | `80`, `{1:100,2:60,3:60,4:60}`, `0.25`, `1.12` |
| `pinch` | `distance`, `scale`, `dominance` | `10`, `0.03`, `0.35` |
| `rotate` | `angle`, `minAngularVelocity`, `dominance`, `confidence` | `8`, `0.035`, `0.42`, `0.72` |
| `path` | `minDistance`, `segmentDistance`, `axisRatio`, `turnAngle`, `maxPause`, `consume` | `44`, `42`, `1.35`, `55`, `650`, `true` |
| `rolling` | `minDelay`, `maxDelay`, `keyboardMaxDelay`, `maxHold`, `maxMove`, `minSpan`, `minStep`, `maxGap` | `10`, `500`, `500`, `780`, `28`, `24`, `10`, `260`; 3F/4F bounds are wider |
| `modifier` | `anchorDelay`, `panDelay`, `panThreshold` | `180`, `70`, `12` |
| `modifier.keyboard` | `roles`, `combos` | Shift modifier, Alt/Ctrl fingers, Meta rolling |
| `claim` | `enabled`, `threshold`, `preventDefault` | `true`, `0.58`, `true` |
| `dom` | `touchAction`, `tapGuard`, `selectionGuard` | `none`, `true`, `true` |
| `intent` | `events`, `fastPath`, `releaseGuard`, `sequenceWindow` | `null`, `true`, `180`, `1200` |
| `wheel` | `enabled`, `zoomFactor`, `normalize`, `preventDefault` | `true`, `0.0015`, `true`, `false` |
| `pressure` | `enabled`, `threshold` | `true`, `0.01` |
| `edge` | `size` | `32` |

All values shown are library defaults. Presets override subsets of these.

## Criteria

`when` supports the fields most apps route on:

```js
hand.on('tap', {
    region: ['left', 'right'],
    fingers: 1,
    tapCount: 2
}, event => {});

hand.on('modifierpan', {
    modifierSource: 'keyboard',
    modifierName: 'shiftAlt',
    modifierKeys: 'shift+alt'
}, event => {});

hand.on('path', {
    path: 'down>right'
}, event => {});
```

Supported criteria include `region`, `startRegion`, `area`, `startArea`, `edge`, `modifierRegion`, `modifierArea`, `modifierSource`, `modifierName`, `key`, `keys`, `combo`, `modifierKeys`, `direction`, `axis`, `path`, `pathText`, `fingers`, `actualFingers`, `syntheticFingers`, `fingerSource`, `keyboardRole`, `pointerType`, and `tapCount`.

## Recipes

Media player:

```js
const hand = new HandTrick(surface, ['media', {
    rotate: { enabled: true, angle: 32, minTime: 220, minSamples: 5, confidence: 1.05 },
    intent: { events: ['tap', 'swipe', 'pinch', 'rotate', 'modifierpan'] }
}]);

hand.on('tap', { region: 'left', tapCount: 2 }, previous);
hand.on('tap', { region: 'right', tapCount: 2 }, next);
hand.on('pinch', event => zoom(event.scale));
hand.on('rotate:clockwise', { fingers: 2 }, event => rotate90(1, event.rawRotation));
hand.on('rotate:counterclockwise', { fingers: 2 }, event => rotate90(-1, event.rawRotation));
```

Exclusive sequence:

```js
const hand = new HandTrick(surface, {
    intent: { events: ['tap', 'tap>tap>swipe'] }
});

hand.on('doubletap', nextMedia);
hand.on('tap>tap>swipe', seekAhead);
hand.on('doubletap>swipe', seekAhead);
```

If the user performs `tap>tap>swipe`, only `seekAhead` fires. `doubletap>swipe` resolves to the same logical pattern. If the user stops at the second tap, `doubletap` can still fire after the sequence window closes.

Rolling tap:

```js
hand.on('rollingtap:right', event => {
    cycleMode(event.rolling.count);
});
```

Desktop multi-finger testing:

```js
hand.on('2fingertap', toggleFit);
hand.on('swipe', { fingers: 2, fingerSource: 'keyboard' }, changeFolder);
```

## Build And Test

```sh
npm test
npm run build
npm run test:min
```

`npm run build` writes `handtrick.min.js`. Terser is a dev dependency only.

Coverage includes:

- Runtime exports, CommonJS, ESM wrapper, minified parity, package metadata sync.
- Tap chains, open-ended tap aliases, multi-finger taps, distance breaks, interval breaks, tap-hold continuity.
- Exclusive sequence dispatch, aggregate tap alias expansion, longest match, direction specificity, explicit tap atoms, and no colon/prefixed legacy syntax.
- Rolling tap positives and negatives: timing, span/step proof, overlap diagnostics, movement slop, simultaneous contacts, count aliases, Meta keyboard rolling.
- Keyboard modifier combos, keyboard finger substitution, exact combo matching, disabled roles, listener-driven preset activation.
- Pan gates, axis locks, tap-hold pan, release guard behavior, staggered multi-finger release.
- Swipe direction aliases, flicks, pruning, and direct-handler suppression when a longer sequence wins.
- Pinch continuity, parallel-translation rejection, rotate proof, rotate noise rejection, activation rebasing.
- Bare path listeners, criteria, wrong-turn negatives, pause breaks, grid metadata.
- Wheel normalization, wheel zoom, ignored wheel events, pressure changes, DOM suppression, iOS tap guard, style restoration, destroy cleanup.

## Examples

| # | File | Focus |
| --- | --- | --- |
| 01 | [basic.html](examples/basic.html) | Tap, swipe, position metadata |
| 02 | [media.html](examples/media.html) | One-line `media` preset with practical handlers |
| 03 | [regions.html](examples/regions.html) | 3x3 zones, halves, custom grid lookup |
| 04 | [keyboard.html](examples/keyboard.html) | Alt/Ctrl keyboard roles for desktop multi-finger testing |
| 05 | [rolling.html](examples/rolling.html) | Rolling tap versus simultaneous multi-finger tap |
| 06 | [sequences.html](examples/sequences.html) | Exclusive released gesture sequences |
| 07 | [path.html](examples/path.html) | Bare held-pointer path commands |
| 08 | [rotate.html](examples/rotate.html) | Rebased two-finger rotate |
| 09 | [wheel.html](examples/wheel.html) | Normalized wheel zoom |
| 10 | [thresholds.html](examples/thresholds.html) | Live threshold tuning |
| 11 | [advanced.html](examples/advanced.html) | Modifier, path, wheel, rotate, region, rolling, and sequence routing |
| 12 | [Inspector Workbench](inspector/index.html) | Event stream, payload inspection, event toggles, and live tuning |

The [example hub](examples/index.html) links all examples in suggested learning order. The [inspector workbench](inspector/index.html) is useful when debugging payloads and registered event families.

All examples are plain HTML files. Open them from any static server that can serve `handtrick.js`.

## Notes

- Position-specific event names are intentionally not added. Use metadata and conditional `on` filters instead.
- `path` and `swipe` intentionally remain separate. Path is held shape recognition; swipe is release recognition.

## Author

[Reza Jelodar](https://jelodar.com/)

## License

MIT.
