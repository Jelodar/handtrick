# HandTrick

HandTrick is a dependency-free browser gesture runtime for pointer, touch, mouse, pen, pressure, wheel, and keyboard-modified input.

It turns raw browser input into one event shape for tap, press, pan, swipe, pinch, rotate, held-pointer paths, rolling taps, modifier gestures, pressure, wheel zoom, lifecycle events, and exclusive released sequences.

Runtime dependencies: none.

## Contents

- [Install](#install)
- [Start](#start)
- [Mental Model](#mental-model)
- [Presets](#presets)
- [Events](#events)
- [Payload](#payload)
- [Position Metadata](#position-metadata)
- [Criteria](#criteria)
- [Paths](#paths)
- [Sequences](#sequences)
- [Rolling Tap](#rolling-tap)
- [Keyboard Roles](#keyboard-roles)
- [Intent And Activation](#intent-and-activation)
- [Ownership And Native Suppression](#ownership-and-native-suppression)
- [Tuning](#tuning)
- [API](#api)
- [Configuration](#configuration)
- [Recipes](#recipes)
- [Examples](#examples)
- [Build And Test](#build-and-test)

## Install

```sh
npm install handtrick
```

The package ships browser global, CommonJS, readable ESM, minified global, minified ESM, typings, examples, inspector, source, scripts, and tests.

Pick the entry by loading style:

| Loader | Use | Do not use |
| --- | --- | --- |
| `<script src>` | `handtrick.js` or `handtrick.min.js` | `.mjs` |
| Browser module script | `handtrick.mjs` or `handtrick.min.mjs` | `handtrick.js` |
| Bundler | `import HandTrick from 'handtrick'` | `handtrick.min.mjs` |
| CommonJS | `require('handtrick')` | `.mjs` |

Browser global:

```html
<script src="handtrick.js"></script>
<script>
const hand = new HandTrick(surface);
</script>
```

Local browser module:

```html
<script type="module">
import HandTrick from './handtrick.mjs';
</script>
```

CDN browser module:

```html
<script type="module">
import HandTrick from 'https://cdn.jsdelivr.net/npm/handtrick/handtrick.min.mjs';
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

CDN global:

```html
<script src="https://unpkg.com/handtrick/handtrick.min.js"></script>
```

Package entries:

| File | Purpose |
| --- | --- |
| `handtrick.js` | Browser global and CommonJS readable runtime. |
| `handtrick.mjs` | Browser or direct ESM readable runtime. |
| `handtrick.min.js` | Minified browser global. |
| `handtrick.min.mjs` | Minified direct ESM, good for CDN module scripts. |
| `index.d.ts` | TypeScript declarations. |

Gotchas:

- Use `.mjs` for `type="module"` scripts. `handtrick.js` is the UMD/global and CommonJS entry.
- Bundlers should import `handtrick`, not a minified file. Let the bundler choose export and compression.
- `unpkg` and `jsdelivr` package fields point at the global build. Use the explicit `.min.mjs` URL when the page is a module page.

## Start

Smallest useful setup:

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

Media-style setup:

```js
const hand = new HandTrick(surface, 'media');
```

Preset plus overrides:

```js
const hand = new HandTrick(surface, ['media', {
    rotate: { enabled: true, angle: 28, confidence: 1 }
}]);
```

Route with criteria instead of creating many event names:

```js
hand.on('tap', { region: 'left' }, previous);
hand.on('tap', { region: 'right' }, next);
hand.on('swipe:up', { startRegion: 'bottom' }, openDrawer);
hand.on('tap:2x', { grid: { rows: 3, cols: 3, cell: 'center' } }, focus);
```

Use the right phase:

```js
hand.command('swipe:right', next);
hand.command('tap:2x', play);
hand.observe('pan', updatePreview);
hand.observe('tap', { region: 'left' }, log);
```

Rules:

- `command` is the primary form for state-changing app actions: navigation, media state, editing commands, selection changes.
- `on` is the general registration API. It uses the event's default phase, so it fits code that intentionally follows HandTrick's phase model.
- `observe` is additive. Use it for live UI, diagnostics, cursor trails, and logging.
- Lifecycle, progress, start/end, pressure, wheel, and `swipe:intent` events are observe/additive by default. Use `observe` for these unless you deliberately need to force command phase.
- Criteria belong in the object argument: `hand.command('swipe:left', { fingers: 2 }, previous)`.

> Tip: `command()` on lifecycle, wheel, pressure, pan progress, or start/end events only forces phase. It does not make those streams exclusive like released tap/swipe/path/sequence commands.

Shortest path:

| Need | Use | Avoid |
| --- | --- | --- |
| Browser global or CommonJS | `handtrick.js` / `handtrick.min.js` | `.mjs` in classic scripts. |
| Browser module or CDN module | `handtrick.mjs` / `handtrick.min.mjs` | UMD globals. |
| App command | `hand.command(selector, criteria?, handler)` | Putting criteria in selector text. |
| Telemetry/live UI | `hand.observe(selector, criteria?, handler)` | Command phase unless state changes. |
| Runtime registry | `recognizers` for option blocks, `families` for emitted buckets, `groups` for concrete events. | Treating `events` as full grammar. |
| Filters | Criteria object argument. | Unknown criteria keys; they never match. |

## Mental Model

HandTrick has four layers:

1. Browser input is normalized into session state: points, timing, target rect, keyboard state, pressure, wheel deltas.
2. Recognizers build semantic candidates: tap, press, pan, swipe, pinch, rotate, path, rolling, modifier, wheel.
3. Additive listeners run for observation and progress.
4. Command listeners arbitrate. Longest sequence/path, most specific selector, then registration order decide the winner.

Important rules:

- App actions belong in `command` handlers.
- Visual feedback and telemetry belong in `observe`.
- Criteria filter handlers after recognition. They do not stop a recognizer from starting, consuming, or building payload.
- Command handlers with the same winning selector and semantically equal criteria run as one group.
- Registered listeners activate recognizer families. You usually do not need `intent.events`.
- Direct config wins over listener activation. If `rotate.enabled` is `false`, a rotate listener cannot revive rotate until `setOptions` changes it.
- Every handler receives a cloned detail object. Do not depend on private session state.

> Tip: option gates and criteria are different. `path.fingers`, `pan.fingers`, and enabled recognizer options decide whether a recognizer can start. `{ fingers: 2 }` on a listener only filters a detail after recognition.

## Presets

| Preset | Best for | Main behavior | Example |
| --- | --- | --- | --- |
| `media` | Video/image surfaces | Tap, tap-hold pan, swipe, pinch, rolling tap, modifier gestures. Rotate off by default. | `new HandTrick(video, 'media')` |
| `viewer` | Image/doc viewers | Pan, wheel zoom, pinch; swipe off. | `new HandTrick(canvas, 'viewer')` |
| `carousel` | Paging surfaces | Swipe-focused, with pan/pinch/rotate off. | `new HandTrick(slides, 'carousel')` |
| `drawing` | Canvas and pressure input | Low pan threshold, pressure enabled, semantic gestures reduced. | `new HandTrick(canvas, 'drawing')` |
| `map` | Map-like canvases | Pan, pinch, rotate, wheel zoom; swipe off. | `new HandTrick(mapEl, 'map')` |

Create a preset object when a plain config is easier:

```js
const options = HandTrick.preset('map', {
    rotate: { angle: 18 }
});
```

Preset and listener interaction:

- Presets are normal config; they do not hide the underlying options.
- Explicit listeners extend preset intent. If `media` starts with rotate disabled by preset, `hand.on('rotate', handler)` can enable the family unless direct config set `rotate.enabled: false`.
- Direct disabled options stay disabled until `setOptions` changes them.
- Presets do not ship manual `intent.events` lists. Listener-derived activation stays the default app pattern.

## Events

Selectors are lowercase, colon-separated, and deterministic. Invalid selector shapes stay opaque strings; they do not accidentally activate recognizers.

### Lifecycle

| Event | Description | Example |
| --- | --- | --- |
| `session:start` | First pointer starts a session. | `hand.observe('session:start', startInk)` |
| `session:move` | Any tracked pointer moves. | `hand.observe('session:move', trackCursor)` |
| `session:end` | Last tracked pointer releases. | `hand.observe('session:end', settleUi)` |
| `session:cancel` | Native cancel, disable, or manual cancel. | `hand.observe('session:cancel', clearPreview)` |
| `fingers:change` | Effective pointer count changed. | `hand.observe('fingers:change', showCount)` |
| `gesture:start` | A gesture crosses activation threshold. | `hand.observe('gesture:start', lockUi)` |
| `gesture:update` | Active gesture gets movement. | `hand.observe('gesture:update', updateHud)` |
| `gesture:transition` | Runtime transitions between active gesture states. | `hand.observe('gesture:transition', inspect)` |
| `gesture:commit` | Runtime commits a semantic candidate. | `hand.observe('gesture:commit', inspect)` |
| `gesture:end` | Active gesture ended normally. | `hand.observe('gesture:end', unlockUi)` |
| `gesture:cancel` | Active gesture cancelled. | `hand.observe('gesture:cancel', resetUi)` |
| `input:ignored` | Native input matched `ignore`. | `hand.observe('input:ignored', markIgnored)` |

### Tap

Tap events cover single taps, tap chains, and effective finger count.

| Event | Description | Example |
| --- | --- | --- |
| `tap` | Any successful tap. | `hand.on('tap', toggleChrome)` |
| `tap:1x`, `tap:2x`, `tap:3x` | Tap count inside one nearby, recent chain. | `hand.on('tap:2x', zoomIn)` |
| `tap:sequence` | Every tap in a chain, with `tapSequence`. | `hand.observe('tap:sequence', drawTrail)` |
| `tap:multi` | Second and later taps in a chain. | `hand.on('tap:multi', cycleSelection)` |
| `tap:mod` | Tap while a modifier anchor/key is active. | `hand.on('tap:mod', alternatePick)` |

```js
hand.on('tap:2x', { fingers: 1 }, event => {
    console.log(event.tapCount, event.center.localX, event.center.localY);
});
```

`tap:2x` means the second tap in one tap chain. It is not two unrelated `tap` handlers that happened close together.

> Tip: finger count is criteria. Use `hand.command('tap', { fingers: 2 }, fit)` or `hand.command('tap:2x', { fingers: 2 }, compare)`.

### Press

| Event | Description | Example |
| --- | --- | --- |
| `press` | Long press threshold met. | `hand.on('press', openMenu)` |
| `press:start` | Press activated. | `hand.observe('press:start', primeTooltip)` |
| `press:move` | Movement during a held press. | `hand.observe('press:move', moveMagnifier)` |
| `press:end` | Pointer released after press. | `hand.observe('press:end', closeMagnifier)` |
| `press:cancel` | Press cancelled by movement or ownership. | `hand.observe('press:cancel', hideTooltip)` |

### Pan

| Event | Description | Example |
| --- | --- | --- |
| `pan:start` | Movement passed `pan.threshold`. | `hand.observe('pan:start', grabCanvas)` |
| `pan` | Continuous movement updates. | `hand.on('pan', dragCanvas)` |
| `pan:end` | Pan ended. | `hand.observe('pan:end', persistOffset)` |
| `pan:mod:start`, `pan:mod`, `pan:mod:end` | Pan with pointer or keyboard modifier. | `hand.on('pan:mod', resizeSelection)` |

```js
hand.on('pan', event => {
    element.style.transform = `translate(${event.deltaX}px, ${event.deltaY}px)`;
});
```

> Tip: `pan` is a continuous movement channel. It can update state before a later path or release command resolves, so keep pan handlers reversible or scoped to live movement.

### Swipe

Swipe is a release gesture. Use `pan` or `swipe:intent` for live movement.

| Event | Description | Example |
| --- | --- | --- |
| `swipe` | Any directional swipe. | `hand.on('swipe', routeByDirection)` |
| `swipe:left`, `swipe:right`, `swipe:up`, `swipe:down` | Directional swipe. | `hand.on('swipe:right', nextPhoto)` |
| `swipe:mod` | Swipe while modifier keys are active. | `hand.on('swipe:mod', duplicateMove)` |
| `swipe:mod:{direction}` | Directional modified swipe. | `hand.on('swipe:mod:right', cloneToNext)` |
| `swipe:intent`, `swipe:intent:{direction}` | Preliminary direction before release. | `hand.observe('swipe:intent', previewPageTurn)` |

Finger count and speed are criteria for swipe:

```js
hand.on('swipe:left', { fingers: 2 }, previousAlbum);
hand.on('swipe:up', { fingers: 3, speed: 'flick' }, archiveStack);
hand.on('swipe:mod:right', { fingers: 2 }, cloneToNext);
```

Speed is a release label:

```js
hand.on('swipe:left', { speed: 'slow' }, preciseMove);
hand.on('swipe:left', { speed: ['normal', 'flick'] }, next);
```

`slow` means distance-qualified but below `swipe.velocity`; `normal` means at least `swipe.velocity`; `flick` means at least 2x `swipe.velocity`.

If another recognizer consumes the session first, final `swipe:*` commands do not fire unless that recognizer intentionally allows fallback.

### Pinch

Pinch is a two-finger transform. Use pan, path, rolling, or criteria-routed tap/swipe for other finger counts.

| Event | Description | Example |
| --- | --- | --- |
| `pinch:start` | Scaling passed threshold. | `hand.observe('pinch:start', cacheZoomStart)` |
| `pinch` | Continuous scale updates, rebased to `1`. | `hand.on('pinch', applyZoom)` |
| `pinch:in`, `pinch:out` | Directional pinch. | `hand.on('pinch:out', zoomIn)` |
| `pinch:mod` | Pinch while non-substitute modifier keys are active. | `hand.on('pinch:mod', precisionZoom)` |
| `pinch:mod:start`, `pinch:mod:end` | Modified pinch lifecycle. | `hand.observe('pinch:mod:end', commit)` |
| `pinch:mod:in`, `pinch:mod:out` | Directional modified pinch. | `hand.on('pinch:mod:out', zoomSelection)` |
| `pinch:end` | Pinch ended. | `hand.observe('pinch:end', commitZoom)` |

### Rotate

Rotate is a two-finger transform. Its proof is angular movement between the two active contacts.

| Event | Description | Example |
| --- | --- | --- |
| `rotate:start` | Rotation passed threshold. | `hand.observe('rotate:start', cacheAngle)` |
| `rotate` | Continuous rotation updates, rebased to `0`. | `hand.on('rotate', applyRotation)` |
| `rotate:cw`, `rotate:ccw` | Directional rotation. | `hand.on('rotate:cw', rotateRight)` |
| `rotate:mod` | Rotate while non-substitute modifier keys are active. | `hand.on('rotate:mod', precisionRotate)` |
| `rotate:mod:start`, `rotate:mod:end` | Modified rotate lifecycle. | `hand.observe('rotate:mod:end', snapAngle)` |
| `rotate:mod:cw`, `rotate:mod:ccw` | Directional modified rotate. | `hand.on('rotate:mod:cw', rotateCopyRight)` |
| `rotate:end` | Rotate ended. | `hand.observe('rotate:end', snapAngle)` |

Rotate uses angular proof plus moved-finger proof. Raise `rotate.angle`, `rotate.confidence`, or `rotate.dominance` when two-finger pans or pinches create false rotation.

### Path

Held-pointer direction chains use bare directions:

```js
hand.on('left>down', undo);
hand.on('right>up', redo);
```

| Event | Description | Example |
| --- | --- | --- |
| `path:start` | First segment recognized. | `hand.observe('path:start', beginPreview)` |
| `path` | Path updated with new segments. | `hand.observe('path', updatePreview)` |
| `path:end` | Path session ended. | `hand.observe('path:end', clearPreview)` |
| `{direction}>{direction}` | Bare path command. | `hand.on('right>down>left>up', addPanel)` |
| `circle`, `circle:cw`, `circle:ccw` | Four-turn path circle alias with direction. | `hand.on('circle:cw', rotateTool)` |
| `circle:Nx`, `circle:Nx:{direction}` | Count-qualified circle. Use criteria for fingers. | `hand.on('circle:2x:cw', { fingers: 2 }, command)` |
| `{direction}>circle:Nx:{direction}` | Circle atom inside a longer path. Use criteria for fingers. | `hand.on('up>circle:2x:cw', { fingers: 2 }, command)` |
| `arc`, `arc:{direction}` | Three-segment path arc. Use criteria for fingers. | `hand.on('arc:up', openTray)` |

Do not write `path:right>down`. Prefixed path syntax is invalid by design.

### Rolling Tap

A rolling tap is a staggered, overlapping same-hand tap wave. It is not a modifier and not a simultaneous multi-finger tap.

| Event | Description | Example |
| --- | --- | --- |
| `rolling` | Any directional rolling tap. | `hand.on('rolling', routeByRollDirection)` |
| `rolling:left`, `rolling:right`, `rolling:up`, `rolling:down` | Directional roll. | `hand.on('rolling:right', nextLayer)` |

Use criteria for roll count:

```js
hand.command('rolling:right', { fingers: 3 }, nextTool);
```

### Modifier

Modifier is input context. A held anchor pointer or a keyboard modifier key can route the next action without changing the underlying gesture shape.

| Event | Description | Example |
| --- | --- | --- |
| `tap:mod` | Tap while holding modifier. Use criteria for modifier/action counts. | `hand.on('tap:mod', alternatePick)` |
| `pan:mod:start` | Modifier pan started. | `hand.observe('pan:mod:start', showConstraint)` |
| `pan:mod` | Modifier pan movement. | `hand.on('pan:mod', resizeSelection)` |
| `pan:mod:end` | Modifier pan ended. | `hand.observe('pan:mod:end', commitResize)` |
| `pinch:mod`, `rotate:mod`, `swipe:mod` | Modified transforms/swipes. | `hand.on('rotate:mod:cw', rotateDuplicate)` |

For transforms and swipes, prefer criteria when the route depends on which modifier was active:

```js
hand.on('swipe:mod:right', { combo: 'alt' }, duplicateToNext);
hand.on('pinch:mod:out', { combo: 'alt' }, zoomSelection);
hand.on('rotate:mod:cw', { keys: 'shift+meta' }, rotateCopyRight);
```

`swipe:mod:right`, `pinch:mod:out`, and `rotate:mod:cw` are separate command types from their unmodified forms. Observers on base events can still see modified payloads through `event.modified`.

Modifier fingers and action fingers are separate. In `tap:mod`, the held anchor/key is modifier context; the action pointer is the tap. Use `{ modifierFingers }`, `{ actionFingers }`, or `{ totalFingers }` when that distinction matters.

### Pressure, Wheel, Sequence

| Family | Event | Description | Example |
| --- | --- | --- | --- |
| Pressure | `pressure:change` | Aggregate pointer pressure changed. | `hand.observe('pressure:change', setBrushWeight)` |
| Wheel | `wheel` | Normalized wheel event. | `hand.observe('wheel', scrollTimeline)` |
| Wheel | `wheel:zoom` | Wheel mapped to scale. | `hand.on('wheel:zoom', zoomAtCursor)` |
| Sequence | `{gesture}>{gesture}` | Released gesture sequence. | `hand.on('tap:2x>swipe:right', fastForward)` |

## Payload

Handlers receive one detail object. Session gesture details share these fields:

| Field | Type | Description |
| --- | --- | --- |
| `type` | `string` | Event name, such as `swipe:right`, `tap:2x`, or `left>down`. |
| `originalEvent` | `Event\|null` | Native event when available. |
| `target` | `EventTarget\|null` | Original target for active pointer/input. |
| `currentTarget` | `EventTarget\|null` | Element bound to HandTrick. |
| `pointerType` | `string` | `mouse`, `touch`, `pen`, `wheel`, or `none`. |
| `fingers` | `number` | Effective pointer count, including keyboard substitution. |
| `actualFingers` | `number` | Physical active pointer count. |
| `syntheticFingers` | `number` | Keyboard-substituted count, or `0`. |
| `fingerSource` | `string` | `pointer`, `keyboard`, or `none`. Criteria may use `auto` as no source filter. |
| `maxFingers`, `maxActualFingers` | `number` | Max effective and physical pointer counts seen in session. |
| `pointers`, `activePointers`, `changedPointer`, `changedPointers` | positions | Pointer snapshots. |
| `center`, `startCenter`, `previousCenter` | positions | Current, phase-start, and previous aggregate positions. |
| `region`, `startRegion`, `previousRegion` | `string` | Position aliases from center snapshots. |
| `area`, `startArea`, `edge`, `startEdge`, `edgeRegion`, `startEdgeRegion` | position metadata | Broad area and edge state. |
| `halfX`, `halfY`, `halfRegion`, `thirdX`, `thirdY` | `string` | Coarse position buckets. |
| `deltaX`, `deltaY`, `absX`, `absY`, `travel` | `number` | Translation and movement distance from phase start. |
| `stepX`, `stepY`, `stepDistance`, `stepElapsed` | `number` | Last-sample movement. |
| `velocityX`, `velocityY`, `velocity`, `stepVelocity` | `number` | Motion speed in px/ms. |
| `direction`, `axis` | `string` | Dominant direction and axis. |
| `keys`, `keyCombo`, `keyboard` | keyboard state | Keyboard snapshot. |
| `confidence`, `confidences` | recognition scores | Pan, pinch, rotate, and swipe confidence. |
| `phase` | `string` | Runtime/session phase such as `began`, `active`, `settling`, `ended`, or `cancelled`; not listener phase. |
| `intent` | object | Commitment state, possible gestures, pruning state, sample count. |
| `motion` | object | Two-pointer motion shape. |
| `topology` | object | Pointer add/remove counts and max pointer count. |
| `rect` | object | Target rect used for position metadata. |
| `claimed`, `consumed`, `releaseGuarded`, `tapHold`, `tapChain` | booleans | Ownership and gesture state diagnostics. |
| `preventDefault()` | function | Prevent native event when possible. |
| `stopPropagation()` | function | Stop native event when possible. |

Gesture-specific fields:

| Field | Appears on | Description |
| --- | --- | --- |
| `tapCount`, `tapSequence` | Tap | Cumulative tap count and tap-chain details. |
| `sequence`, `gestureSequence` | Released sequences | Matched gesture list, raw listener pattern, duration, and resolution. |
| `scale`, `scaleDelta`, `rawScale`, `rawScaleDelta` | Pinch, wheel zoom | Rebased scale and raw diagnostics. |
| `angle`, `previousAngle`, `rotation`, `rawRotation`, `angularVelocity` | Rotate | Rebased signed degrees and angular speed. |
| `pressure`, `previousPressure`, `pressureDelta`, `normalizedPressure` | Pressure/pointer detail | Aggregate pressure values. |
| `path`, `pathText`, `pathSegments`, `matchPattern`, `matchedPathText`, `pathDistance` | Path | Direction list/string, segment data, canonical matched command, physical matched slice. |
| `circle`, `circleDirection`, `circleCount` | Circle path | Cycle metadata, repeated count, and `cw`/`ccw` direction. |
| `arc`, `arcDirection` | Arc path | Three-segment arc metadata and cardinal direction. |
| `rolling`, `rollingCount`, `rollingDirection` | Rolling | Source, direction, count, timing, span, contact order. |
| `actionPointer`, `modifierPointers`, `modifier` | Modifier | Action pointer, anchor pointers, source/name/keyboard metadata. |
| `actionDeltaX`, `actionDeltaY`, `actionTravel`, `actionDirection` | Modifier pan | Movement of the action pointer from modifier start. |
| `keyboardSubstitute` | Keyboard roles | Role, combo, keys, and substituted finger count. |
| `rawDeltaX`, `rawDeltaY`, `rawDeltaZ`, `deltaMode` | Wheel | Native wheel deltas before semantic mapping. |
| `panAxis` | Pan | Axis lock/dominant axis result when relevant. |

Payload invariants:

- `instance` is non-enumerable.
- `center`, `startCenter`, `previousCenter`, and pointer fields are snapshots, not live internal points.
- Gesture-specific fields are additive. Existing payload fields should not disappear from a family.
- Criteria read public payload fields; do not route on private runtime state.
- Wheel and `input:ignored` can be thinner because they may be emitted outside an active pointer session.

## Position Metadata

`center`, `startCenter`, `previousCenter`, pointers, and modifier positions expose:

| Property | Description |
| --- | --- |
| `x`, `y` | Alias coordinates for page position. |
| `pageX`, `pageY` | Document coordinates. |
| `clientX`, `clientY` | Viewport coordinates. |
| `localX`, `localY` | Coordinates relative to `currentTarget`. |
| `ratioX`, `ratioY` | Unclamped normalized local coordinates. |
| `clampedRatioX`, `clampedRatioY` | `0..1` normalized local coordinates. |
| `inside` | Whether point is inside target rect. |
| `area` | `center`, `edge`, `inside`, or `outside`. |
| `edge` | `{ top, right, bottom, left }` booleans. |
| `edgeRegion` | Specific edge/corner or `none`. |
| `halfX`, `halfY`, `halfRegion` | Coarse halves: `left`, `right`, `top`, `bottom`, `center`. |
| `thirdX`, `thirdY`, `region`, `zone` | 3x3 region. `zone` is the same stable string as `region`. |
| `grid(rows, cols)` | Custom grid lookup returning `{ row, col, rows, cols, index }`. |

3x3 region names:

| Row | Col 0 | Col 1 | Col 2 |
| --- | --- | --- | --- |
| 0 | `top-left` | `top` | `top-right` |
| 1 | `left` | `center` | `right` |
| 2 | `bottom-left` | `bottom` | `bottom-right` |

```js
hand.on('tap', { region: 'left' }, previous);
hand.on('swipe:up', { startRegion: 'bottom' }, showControls);
hand.on('tap:2x', { grid: { rows: 3, cols: 3, cell: 'center' } }, focus);

hand.on('tap', event => {
    const cell = event.center.grid(4, 4);
    console.log(cell.row, cell.col, cell.index);
});
```

## Criteria

Criteria are handler filters. They do not stop recognizers from running.
Unknown criteria keys never match. That makes typos fail closed instead of broadening a handler.

```js
hand.on('tap', {
    region: ['left', 'right'],
    fingers: 1,
    tapCount: 2
}, event => {});

hand.on('pan:mod', {
    modifierSource: 'keyboard',
    modifierName: 'shiftAlt',
    modifierKeys: 'shift+alt'
}, event => {});

hand.on('path', {
    path: 'down>right'
}, event => {});
```

Selector text names the gesture shape. Criteria names filters such as fingers, regions, speed, source, and path suffixes. Do not put finger count or swipe speed in selector text.

> Tip: `hand.on('swipe:left:2f', fn)`, `hand.on('swipe:flick:left', fn)`, and `hand.on('circle:2f:cw', fn)` are invalid. Use `hand.command('swipe:left', { fingers: 2 }, fn)`, `hand.command('swipe:left', { speed: 'flick' }, fn)`, and `hand.command('circle:cw', { fingers: 2 }, fn)`.

Common criteria:

| Criteria | Checks | Example |
| --- | --- | --- |
| `region` | Current 3x3/half/edge alias. | `{ region: ['left', 'right'] }` |
| `startRegion` | Gesture phase start region. | `{ startRegion: 'bottom' }` |
| `tapStartRegion` | First tap center in active tap chain. | `{ tapStartRegion: 'left' }` |
| `grid` | Current custom grid cell. | `{ grid: { rows: 3, cols: 3, cell: 'center' } }` |
| `startGrid` | Starting custom grid cell. | `{ startGrid: { rows: 2, cols: 2, index: 3 } }` |
| `tapStartGrid` | First tap grid cell in active tap chain. | `{ tapStartGrid: { rows: 3, cols: 3, col: 0 } }` |
| `sequenceStartGrid` | First committed gesture cell in released sequence. | `{ sequenceStartGrid: { rows: 3, cols: 3, col: 2 } }` |
| `sequence` | Per-step filters for released sequences. | `{ sequence: [{ fingers: 3 }, { fingers: 1 }] }` |
| `area`, `startArea`, `tapStartArea` | Broad area. | `{ area: 'edge' }` |
| `edge` | Current edge region. | `{ edge: 'top' }` |
| `modifierRegion`, `modifierArea` | Modifier anchor position. | `{ modifierRegion: 'top-left' }` |
| `modifierFingers`, `actionFingers`, `totalFingers` | Modifier anchor/action counts. | `{ actionFingers: 1 }` |
| `direction` | Direction on swipe, rolling, path detail, or movement. | `{ direction: 'up' }` |
| `axis` | Dominant axis. | `{ axis: 'x' }` |
| `speed` | Swipe speed label: `slow`, `normal`, or `flick`. | `{ speed: ['normal', 'flick'] }` |
| `modified` | Swipe, pinch, or rotate used modifier context. | `{ modified: true }` |
| `path`, `pathText` | Held-pointer path suffix, with long-path arbitration. | `{ path: ['down>right', 'right>up'] }` |
| `fingers` | Effective finger count. | `{ fingers: [2, 3] }` |
| `actualFingers` | Physical pointer count. | `{ actualFingers: 1 }` |
| `syntheticFingers` | Keyboard-substituted count. | `{ syntheticFingers: 2 }` |
| `fingerSource` | `pointer`, `keyboard`, `none`, or `auto`. | `{ fingerSource: 'keyboard' }` |
| `keyboardRole` | Matched keyboard substitute role. | `{ keyboardRole: 'twoFingers' }` |
| `modifierName` | Named modifier combo or role. | `{ modifierName: 'shiftAlt' }` |
| `modifierSource` | Modifier origin. | `{ modifierSource: 'keyboard' }` |
| `key`, `keys`, `combo`, `modifierKeys` | Keyboard/combo values. | `{ combo: 'shift+alt' }` |
| `tapCount` | Tap-chain count. | `{ tapCount: 3 }` |
| `pointerType` | Browser pointer type. | `{ pointerType: 'pen' }` |

`fingerSource` meanings:

| Value | Meaning |
| --- | --- |
| omitted | Accept pointer, keyboard, or none. |
| `auto` | Same as omitted; useful for generated criteria. |
| `pointer` | Real pointer/touch/pen only. |
| `keyboard` | Keyboard-substituted input only. |
| `none` | Events without active pointer source, such as wheel-only events. |

## Paths

Paths are held-pointer direction chains made from direction atoms and documented path atoms:

```js
hand.on('down>right', event => {
    openCommand(event.pathSegments);
});

hand.on('path', { path: 'left>up' }, event => {
    undoAt(event.center);
});

const command = HandTrick.path('left>down'); // left>down
```

Multi-finger paths are regular path commands plus `path.fingers` and criteria:

```js
const hand = new HandTrick(surface, {
    path: { fingers: [1, 2] }
});

hand.on('right>up', { fingers: 2 }, twoFingerCorner);
hand.observe('path', { path: 'right>up', fingers: 2 }, previewTwoFingerCorner);
```

Circle paths are path-derived events. Any four-segment cycle that follows `right>down>left>up` from any starting side emits clockwise; the opposite cycle emits counter-clockwise:

```js
hand.on('circle:cw', event => {
    rotateTool(event.direction, event.circle.pathText);
});

hand.on('circle:ccw', undoRotateTool);
hand.on('circle', { fingers: 2 }, twoFingerCircle);
hand.on('circle:2x:cw', { fingers: 2 }, doubleClockwiseCircle);
```

Examples:

- `right>down>left>up` -> `circle:cw`
- `down>left>up>right` -> `circle:cw`
- `left>up>right>down` -> `circle:cw`
- `right>up>left>down` -> `circle:ccw`
- `up>right>down>left` -> `circle:ccw`

Top-level circle events resolve when the path ends by release or pause. They do not fire while the pointer is still drawing, so overlapping suffixes inside `down>right>up>left>down` cannot double-count. A single-count selector such as `circle:ccw` emits once for each non-overlapping complete loop; incomplete trailing segments are ignored. A counted selector such as `circle:2x:cw` wins as one command over its overlapping single-circle loops when it is registered.

Circle events keep normal path data: `path`, `pathText`, `pathSegments`, `matchPattern`, and `matchedPathText`. They also set `direction` and `circleDirection` to `cw` or `ccw`, with `event.circle` carrying `{ direction, count, path, pathText, start, length, startDirection, endDirection, cycles }`.

Circle uses the path recognizer. Tune `path.minDistance`, `path.segmentDistance`, `path.axisRatio`, `path.turnAngle`, and `path.maxPause` when circles feel too eager or too hard. There is no separate freehand-circle recognizer.

Circle also works as a path atom inside bare path commands and path criteria:

```js
hand.on('up>circle', openRadialMenu);
hand.observe('path', { path: 'left>circle:ccw' }, previewCounterClockwise);
hand.on('up>circle:2x:cw', openAfterTwoClockwiseLoops);
hand.observe('path', { path: 'up>circle:2x:cw', fingers: 2 }, previewTwoFingerLoops);
```

`circle:Nx` means N complete four-segment cycles in the same direction. Each cycle may start on a different side, but every complete cycle must resolve to the requested direction. `right>down>left>up>down>left>up>right` is valid `circle:2x:cw` because `right>down>left>up` and `down>left>up>right` are both clockwise. Finger count is a criterion, not part of the path string: use `hand.on('circle:cw', { fingers: 2 }, fn)` or `hand.observe('path', { path: 'up>circle:2x:cw', fingers: 2 }, fn)`.

Circle atoms inside longer path patterns belong to that path pattern. For example, `up>circle:cw` owns the circle it contains; top-level `circle:cw` does not also fire for the same equal-length atom.

Adjuster order is flexible. `circle:ccw:2x` and `circle:2x:ccw` canonicalize to the same selector. In paths, the same rule applies: `right>circle:ccw:2x` is stored and emitted as `right>circle:2x:ccw`.

Multi-finger paths use the effective pointer count and the shared center path. `{ fingers: 2 }` does not mean each finger draws its own circle; it means the path recognizer saw a two-finger path and the center movement matched the circle atom. `path.fingers` must allow that count, e.g. `{ path: { fingers: [1, 2] } }`, before a two-finger path can start.

`path.maxCircleCount` guards accidental huge selectors. The default is `6`, so `circle:7x` does not become an active path record unless configured with `{ path: { maxCircleCount: 7 } }` or higher.

Arc paths are three-segment path atoms. Direction is the first segment direction, so both `up>right>down` and `up>left>down` match `arc:up`; both `down>left>up` and `down>right>up` match `arc:down`.

```js
hand.on('arc:up', openTopTray);
hand.on('right>arc:down', openAfterDownArc);
hand.observe('path', { path: 'arc:left', fingers: 2 }, previewTwoFingerLeftArc);
```

Recognizer proof:

- New segment needs enough distance.
- Axis must be clear enough.
- Turns must be real, not jitter.
- Long pauses break path continuity.
- Straight one-segment movement is deliberately conservative because it can also be a swipe.

Path consumption:

| Mode | Meaning | Use when |
| --- | --- | --- |
| `auto` | Default. Single straight segment can still become a swipe; turns and path command winners own the session. | Most apps, especially media surfaces. |
| `eager` | First path segment owns the session. | Paths must beat swipes immediately. |
| `never` | Path never consumes by itself. | Path telemetry/commands may intentionally coexist with release gestures. |

Only explicit string modes are supported. Invalid values, including booleans and `null`, fall back to `auto`.

Path and swipe gotcha:

- Listener-derived intent means any path listener can activate the path recognizer.
- Criteria such as `startGrid` are command filters, not recognizer start gates.
- `path.consume: 'eager'` can consume a straight one-finger swipe before release.
- `hand.command('path', { path: 'right' }, fn)` can consume a straight one-segment swipe when it wins; observe/default path criteria do not.
- Two-finger swipes avoid that specific conflict because default paths use `path.fingers: [1]`.
- `path.consume: 'never'` can allow a path command and a final swipe from the same release if both qualify.
- Circle and arc are path-derived event families. Tune `path.minDistance`, `path.segmentDistance`, `path.axisRatio`, and `path.turnAngle` when their proof feels too strict or too loose.

For media viewers that need normal one-finger swipes plus path commands:

```js
const hand = new HandTrick(surface, ['media', {
    intent: { events: null },
    path: { consume: 'auto' }
}]);
```

Longest bare path command wins:

```js
hand.on('right>down>left>up', addWorkspace);
hand.on('right>down>left>up>right>down>left>up', spreadWorkspace);
```

If the user draws eight segments, `spreadWorkspace` runs and `addWorkspace` does not. If the user stops after four segments, `addWorkspace` runs when the path session ends. HandTrick keeps enough path history for registered long paths even when `path.maxSegments` is lower.

Path criteria use the same arbitration:

```js
hand.observe('path', { path: 'right>down>left>up' }, addWorkspace);
hand.observe('path', { path: 'right>down>left>up>right>down>left>up' }, spreadWorkspace);
```

The shorter criteria pattern does not fire for the trailing half of the longer path.

## Sequences

Sequences use `>` between committed gestures after releases:

```js
hand.on('tap>tap>swipe', event => {
    console.log(event.gestureSequence.duration);
});

hand.on('tap:2x>swipe:right', fastForward);
```

Rules:

- Sequences are exclusive. If `tap>tap>swipe` wins, shorter pending `tap`, `tap:2x`, `tap>swipe`, and direct `swipe` handlers for the same chain do not fire.
- Longest match wins.
- Ties prefer higher specificity, such as `swipe:right` over `swipe`.
- Aggregate tap aliases expand into tap atoms. `tap:2x>swipe` equals `tap>tap>swipe`; `tap:3x>swipe` equals `tap>tap>tap>swipe`.
- Explicit atoms are clearest when documenting commands.
- Direction-specific swipe aliases work inside sequences.
- Gap must fit `intent.sequenceWindow` (default `1200` ms).
- Use `hand.resetSequences()` after consuming a command when app state needs a hard boundary.

> Tip: sequence selectors do not carry per-atom criteria. Put step filters in sequence criteria, such as `{ sequence: [{ fingers: 3 }, { direction: 'left' }] }`.

> Tip: a direct `swipe:right` listener can be suppressed by a pending `tap>tap>swipe:right` command. That is intentional. Sequence handlers get a short window to win before shorter fallbacks fire.

Paths and sequences cannot be merged into one selector.

```js
hand.on('tap>swipe:left>right>up', handler); // invalid for "tap, swipe, then path"
```

Why: `tap>swipe:left` is a released sequence; `right>up` is a held-pointer path. A sequence atom must be a valid event selector, and a bare path is its own continuous recognizer, not one released sequence atom.

Use two commands and app state when a workflow needs both:

```js
let pathArmed = false;

hand.on('tap>swipe:left', () => {
    pathArmed = true;
});

hand.on('right>up', { fingers: 1 }, event => {
    if (!pathArmed) return;
    pathArmed = false;
    openCornerCommand(event);
});
```

Reset that state on timeout, route change, or `session:cancel` in real apps.

## Rolling Tap

A rolling tap is proven by stagger plus overlap.

Default proof:

- Exactly 2, 3, or 4 contacts.
- Adjacent down events are `10..500` ms apart.
- Each adjacent contact overlaps: pointer N goes down before pointer N-1 lifts.
- Each finger holds no more than `780` ms.
- Movement stays under `28` px.
- Contact order is monotonic and directional.
- Total directional span is at least `24` px.
- Each adjacent step is at least `10` px.
- Adjacent contacts stay within same-hand gap bounds.

```js
hand.on('rolling:right', event => {
    console.log(event.rolling.count, event.rolling.delays);
});

hand.on('rolling:left', { fingers: 3 }, command);
```

Near-simultaneous contacts below `rolling.minDelay` stay normal multi-finger taps. Slow stagger above `rolling.maxDelay` becomes separate tap/modifier input.

Rolling proof runs before multi-finger tap fallback. When a directional two- or three-finger roll is plausible, it can suppress `tap` handlers filtered with `{ fingers: 2 }` or `{ fingers: 3 }`, and modifier-tap fallback for the same overlapping contacts.

Three- and four-finger rolls get wider default bounds through `rolling.maxDelayByFingers`, `rolling.maxGapByFingers`, and `rolling.maxHoldByFingers`.

`event.rolling.source` is `pointer` or `keyboard`. Pointer rolls include `overlapCount` and `overlaps`; keyboard rolls report `overlapCount: 0` so apps can distinguish diagnostics without changing handlers.

Separate one-finger taps never resolve as `rolling`. A physical roll needs overlap across distinct pointer IDs. On desktop, Meta-click chains are the explicit keyboard substitute. Meta-click twice in a short directional line emits a two-finger keyboard rolling tap; Meta-click three times emits a three-finger one. Invalid or non-directional Meta clicks fall back to the normal tap chain after the pending window.

## Keyboard Roles

Keyboard roles make desktop testing and mouse-first apps close to touch without faking pointer coordinates.

| Role | Default combo | Emits | Example |
| --- | --- | --- | --- |
| `modifier` | `shift` | `tap:mod`, `pan:mod:start`, `pan:mod`, `pan:mod:end` | Shift-drag resizes instead of moves. |
| `twoFingers` | `alt` | One pointer reports `fingers: 2`. | Alt-swipe changes folder on desktop. |
| `threeFingers` | `ctrl` | One pointer reports `fingers: 3`. | Ctrl-tap opens compare. |
| `fourFingers` | `shift+meta` | One pointer reports `fingers: 4`. | Shift+Meta-tap opens app command. |
| `rollingTap` | `meta` | Directional Meta-click chains emit `rolling`. | Meta-click left-to-right cycles layers. |

```js
const hand = new HandTrick(surface, {
    modifier: {
        keyboard: {
            roles: {
                modifier: 'shift+alt',
                twoFingers: 'alt',
                threeFingers: 'ctrl',
                fourFingers: 'shift+meta',
                rollingTap: 'meta'
            },
            combos: {
                resize: 'shift+alt'
            }
        }
    }
});

hand.on('pan:mod', { modifierName: 'resize' }, resize);
hand.on('swipe', { fingers: 2, fingerSource: 'keyboard' }, desktopTwoFingerSwipe);
hand.on('tap', { fingers: 4 }, fourFingerCommand);
```

Rules:

- Combos are exact after normalization.
- Set a role to `null` or `false` to free the combo.
- Named `keyboard.combos` label modifier gestures.
- Keyboard substitution changes `fingers` and `maxFingers`; `actualFingers` stays physical pointer count.
- Omitted `fingerSource` criteria accepts pointer and keyboard input.
- `{ fingerSource: 'auto' }` is an explicit no-filter form.
- Use `fingerSource: 'pointer'` or `keyboard` only when the command must be source-specific.
- Keyboard rolling sets `keyboardSubstitute.role` to `rollingTap` and `rolling.source` to `keyboard`.

`fingers` is the effective command count. Use `actualFingers` when physical touch count matters.

Examples, from broad to specific:

```js
hand.on('tap', { fingers: 2 }, fit);
```

Accepts real two-finger tap and Alt-click by default.

```js
hand.on('tap', { fingers: 2, fingerSource: 'keyboard' }, fitFromDesktopOnly);
hand.on('tap', { fingers: 2, fingerSource: 'pointer' }, fitFromTouchOnly);
```

Splits desktop substitute from physical touch.

```js
const hand = new HandTrick(surface, {
    modifier: {
        keyboard: {
            roles: {
                twoFingers: 'alt',
                threeFingers: 'ctrl',
                fourFingers: 'shift+meta',
                rollingTap: 'meta',
                modifier: 'shift'
            },
            combos: {
                resize: 'shift+alt'
            }
        }
    }
});

hand.on('pan:mod', { modifierName: 'resize' }, resizeSelection);
hand.on('swipe:right', { combo: 'alt+meta' }, duplicateToNext);
```

Named combos label anchor/action modifier gestures such as `tap:mod` and `pan:mod`. Finger substitute roles change effective finger count for ordinary gestures, such as `hand.on('tap', { fingers: 2 }, fn)` or `hand.on('swipe:left', { fingers: 3 }, fn)`. Modified swipe/pinch/rotate handlers use `swipe:mod`, `pinch:mod`, and `rotate:mod`; add `combo` or `keys` criteria when the exact keyboard modifier matters.

Keep the three keyboard jobs separate when configuring roles:

- `modifier` is context for `tap:mod` and `pan:mod`.
- `twoFingers`, `threeFingers`, and `fourFingers` substitute effective finger count.
- `rollingTap` turns a short directional click chain into keyboard rolling.

```js
const hand = new HandTrick(surface, {
    modifier: {
        keyboard: {
            roles: {
                twoFingers: null,
                rollingTap: false
            }
        }
    }
});
```

Disables specific keyboard roles so those combos return to normal browser/app meaning.

## Intent And Activation

Recognizer activation comes from two places:

1. Explicit `intent.events`.
2. Registered listeners.

Most apps should leave `intent.events` unset:

```js
const hand = new HandTrick(surface);
hand.on('swipe:right', next);
```

That listener is enough to activate swipe and keep pruning relevant.

Use explicit `intent.events` only when:

- Commands are registered lazily and recognition must be available before listeners exist.
- A noisy full-screen surface needs a strict whitelist.
- You are building an inspector or diagnostic surface.

Manual intent lists are powerful but easy to stale. If `intent.events` omits a family, a valid listener can look broken.

```js
const hand = new HandTrick(surface, {
    intent: { events: ['tap', 'swipe:right', 'pinch'] }
});
```

Disable listener-derived pruning only for diagnostic surfaces that need every enabled recognizer considered regardless of registered routes:

```js
const hand = new HandTrick(surface, {
    intent: { useListeners: false }
});
```

`setOptions` merges options or presets, updates explicit recognizer toggles, and rebinds native listeners where needed.

## Ownership And Native Suppression

HandTrick separates native ownership from semantic ownership.

| Mechanism | Purpose | Effect |
| --- | --- | --- |
| Claim | Native event ownership. | May call `preventDefault()` / `stopPropagation()` after `claim.threshold`. |
| Consumed | Semantic gesture ownership. | Blocks release fallback such as tap, rolling tap, and swipe unless allowed. |

Most continuous commands consume once they commit. Pan, pinch, rotate, modifier pan, rolling, and press use consumption to prevent a later release gesture from firing on the same session. Swipe consumes when it emits. Path has separate `path.consume`.

DOM suppression is enabled by default:

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

Disable guards only when the target intentionally contains selectable or editable text:

```js
new HandTrick(editor, {
    dom: { tapGuard: false, selectionGuard: false }
});
```

Use `ignore` or separate targets for native islands:

```js
const hand = new HandTrick(surface, {
    ignore: '.native-control'
});

hand.observe('input:ignored', event => {
    console.log(event.pointerType);
});
```

## Tuning

Change the smallest proof that matches the symptom.

| Symptom | First change | Why |
| --- | --- | --- |
| Tap misses on mobile | Raise `tap.maxMove`, then `tap.distance`. | Finger landings drift more than mouse clicks. |
| Double tap too easy | Lower `tap.interval` or `tap.distance`. | Multi-tap chains should stay nearby and recent. |
| Swipe fires during short drags | Raise `swipe.distanceByFingers[1]` and `swipe.intentDistance`. | Distance is a stronger guard than velocity alone. |
| Two-finger swipe feels too hard | Lower `swipe.distanceByFingers[2]`, not global `swipe.distance`. | Multi-finger travel is naturally shorter. |
| Pinch fires during two-finger pan | Raise `pinch.distance` or `pinch.dominance`. | Parallel movement should stay translation. |
| Rotate fires during pinch | Raise `rotate.angle`, `rotate.confidence`, and `rotate.dominance`. | App commands need more proof than visual rotation previews. |
| One-finger swipes stop after adding paths | Use `path.consume: 'auto'`, move paths off one-finger, split surfaces, or raise path thresholds. | Eager paths consume on first segment. |
| Path commands trigger on shaky swipes | Raise `path.axisRatio`, `path.segmentDistance`, or `path.turnAngle`. | Paths need clean cardinal movement and real turns. |
| Rolling tap misses | Raise `rolling.maxDelay` slightly before lowering `rolling.minDelay`. | Too-low min delay collides with simultaneous multi-finger taps. |
| Native scroll leaks through | Keep `dom.touchAction: 'none'` and `claim.preventDefault: true`. | Browser gestures must be stopped before semantic gestures commit. |

Avoid lowering `minTime` and `minSamples` together unless the app owns the whole surface and false positives are acceptable.

Tune distance before velocity. Distance thresholds usually remove accidental gestures without making deliberate slow input feel broken.

## API

### Constructor

```js
new HandTrick(target, options);
new HandTrick(target, 'media');
new HandTrick({ target, preset: 'media' });
```

### Instance Methods

| Method | Description | Example |
| --- | --- | --- |
| `on(type, handler)` | Listen for event, wildcard `*`, sequence, or bare path chain. | `hand.on('swipe:left', previous)` |
| `on(type, criteria, handler)` | Conditional listener using `HandTrick.matches`. | `hand.on('tap:2x', { region: 'right' }, next)` |
| `once(type, handler)` / `once(type, criteria, handler)` | Listen once. | `hand.once('press', openMenu)` |
| `off(type?, handler?)` | Remove listeners. | `hand.off('swipe:left', previous)` |
| `command(type, criteria?, handler)` | Register exclusive command-phase handler. | `hand.command('tap>swipe:right', skipIntro)` |
| `observe(type, criteria?, handler)` | Register additive telemetry. | `hand.observe('path', drawPreview)` |
| `setOptions(options)` | Merge options or preset at runtime. | `hand.setOptions({ swipe: { velocity: 0.18 } })` |
| `enable()` / `disable()` | Toggle monitoring and DOM suppression. `disable` cancels active session. | `hand.disable()` |
| `cancel(reason?, extra?)` | Cancel active session. | `hand.cancel('modal')` |
| `resetTaps()` | Clear tap-chain memory. | `hand.resetTaps()` |
| `resetSequences()` | Clear released sequence memory and pending exclusive events. | `hand.resetSequences()` |
| `reset(options?)` | Reset `taps` or released `sequences`. | `hand.reset({ sequences: true })` |
| `refreshRect()` | Clear cached rect data. | `hand.refreshRect()` |
| `getState()` | Inspect runtime state. | `hand.getState().active` |
| `getIntentState()` | Inspect pruning state. | `hand.getIntentState().groups` |
| `destroy()` | Remove listeners, restore styles, clear state. Safe to call twice. | `hand.destroy()` |

### Static Helpers

| Helper | Description | Example |
| --- | --- | --- |
| `HandTrick.create(target, options)` | Factory method. | `HandTrick.create(surface, 'media')` |
| `HandTrick.preset(name, overrides?)` | Return config object. | `HandTrick.preset('map', { rotate: { angle: 20 } })` |
| `HandTrick.defaults` | Deep copy of defaults. | `HandTrick.defaults.tap.interval` |
| `HandTrick.events` | Full finite event registry. Path strings, sequences, and counted circles remain open grammar. | `HandTrick.events.includes('pinch')` |
| `HandTrick.event(value)` | Canonicalize a selector or return empty for invalid input. | `HandTrick.event('swipe:left')` |
| `HandTrick.isEvent(value)` | Check selector validity. | `HandTrick.isEvent('circle:cw')` |
| `HandTrick.recognizers` | Option-backed recognizers. | `HandTrick.recognizers.includes('path')` |
| `HandTrick.families` | Emitted event families. | `HandTrick.families.includes('arc')` |
| `HandTrick.groups` | Event groups. | `HandTrick.groups.swipe` |
| `HandTrick.matches(detail, criteria)` | Criteria matcher. | `HandTrick.matches(event, { region: 'edge' })` |
| `HandTrick.region(pointOrEvent, region)` | Region matcher. | `HandTrick.region(event, ['left', 'edge'])` |
| `HandTrick.zone(point, { rows, cols })` | Custom grid helper. | `HandTrick.zone(event.center, { rows: 4, cols: 4 })` |
| `HandTrick.keyCombo(value)` | Normalize keyboard combo strings. | `HandTrick.keyCombo('command+shift')` |
| `HandTrick.path(value)` | Normalize path definitions, including circle and arc atoms. Invalid prefixed paths return empty. | `HandTrick.path(['right', 'arc:down'])` |

Type declarations accept `EventName | string` because paths and sequences are open strings. The known-name union is autocomplete, not validation. `HandTrick.events` is a finite registry, not the full grammar; use `HandTrick.isEvent(value)` or `HandTrick.path(value)` when a tool needs runtime validation.

Use `recognizers` when deciding which option block can be enabled or tuned. Use `families` or `groups` when deciding which emitted event bucket to show in tools.

## Configuration

All values shown are library defaults. Presets override subsets.

| Namespace | Key options | Defaults | Example override |
| --- | --- | --- | --- |
| top-level | `enabled`, `input`, `preventDefault`, `stopPropagation`, `capture`, `windowEvents`, `ignore`, `rect` | `true`, `auto`, `true`, `false`, `true`, `true`, `null`, `session` | `{ input: 'pointer', ignore: '.native' }` |
| `tap` | `maxTime`, `maxMove`, `interval`, `distance` | `420`, `18`, `340`, `80` | `{ tap: { interval: 280 } }` |
| `tapHold` | `window`, `distance`, `maxRestTime` | `1200`, `160`, `320` | `{ tapHold: { window: 900 } }` |
| `press` | `delay`, `move`, `repeat`, `consumesTap`, `allowsPan` | `500`, `14`, `0`, `true`, `false` | `{ press: { repeat: 300 } }` |
| `pan` | `threshold`, `minTime`, `minSamples`, `fingers`, `axis`, `canStart` | `12`, `45`, `2`, `[1]`, `free`, `null` | `{ pan: { fingers: [1, 2], axis: 'dominant' } }` |
| `swipe` | `distance`, `distanceByFingers`, `velocity`, `axisRatio`, `intentDistance`, `allowAfterPan` | `80`, `{1:100,2:60,3:60,4:60}`, `0.25`, `1.12`, `50`, `true` | `{ swipe: { velocity: 0.18 } }` |
| `pinch` | `distance`, `scale`, `minTime`, `minSamples`, `dominance` | `10`, `0.03`, `70`, `2`, `0.35` | `{ pinch: { scale: 0.05 } }` |
| `rotate` | `angle`, `minTime`, `minSamples`, `minAngularVelocity`, `dominance`, `confidence` | `8`, `130`, `3`, `0.035`, `0.42`, `0.72` | `{ rotate: { angle: 24, confidence: 1 } }` |
| `path` | `fingers`, `minDistance`, `segmentDistance`, `axisRatio`, `turnAngle`, `maxPause`, `maxSegments`, `maxCircleCount`, `consume` | `[1]`, `44`, `42`, `1.35`, `55`, `650`, `6`, `6`, `auto` | `{ path: { consume: 'eager' } }` |
| `rolling` | `fingers`, `minDelay`, `maxDelay`, `keyboardMaxDelay`, `maxHold`, `maxMove`, `minSpan`, `minStep`, `maxGap` | `[2,3,4]`, `10`, `500`, `500`, `780`, `28`, `24`, `10`, `260`; 3F/4F bounds wider | `{ rolling: { maxDelay: 560 } }` |
| `modifier` | `anchorMove`, `anchorDelay`, `panDelay`, `maxTapTime`, `maxTapMove`, `panThreshold` | `10`, `180`, `70`, `430`, `28`, `12` | `{ modifier: { anchorDelay: 120 } }` |
| `modifier.keyboard` | `enabled`, `preventNative`, `roles`, `combos` | Shift modifier, Alt/Ctrl fingers, Shift+Meta 4F, Meta rolling | `{ modifier: { keyboard: { roles: { twoFingers: 'alt' } } } }` |
| `claim` | `enabled`, `threshold`, `preventDefault`, `stopPropagation` | `true`, `0.58`, `true`, `false` | `{ claim: { threshold: 0.7 } }` |
| `dom` | `touchAction`, `tapGuard`, `selectionGuard`, `overscrollBehavior` | `none`, `true`, `true`, `contain` | `{ dom: { tapGuard: false } }` |
| `intent` | `events`, `useListeners`, `fastPath`, `releaseGuard`, `releaseDistance`, `sequenceWindow`, `sequenceMax` | `null`, `true`, `true`, `180`, `34`, `1200`, `8` | `{ intent: { events: ['tap', 'swipe:right'] } }` |
| `wheel` | `enabled`, `preventDefault`, `zoomFactor`, `normalize`, `lineHeight`, `pageHeight` | `true`, `false`, `0.0015`, `true`, `16`, `800` | `{ wheel: { preventDefault: true } }` |
| `pressure` | `enabled`, `threshold` | `true`, `0.01` | `{ pressure: { threshold: 0.004 } }` |
| `edge` | `size` | `32` | `{ edge: { size: 44 } }` |

## Recipes

Media player with tap zones, pinch, and guarded rotate:

```js
const hand = new HandTrick(surface, ['media', {
    rotate: { enabled: true, angle: 32, minTime: 220, minSamples: 5, confidence: 1.05 }
}]);

hand.on('tap', { region: 'left', tapCount: 2 }, previous);
hand.on('tap', { region: 'right', tapCount: 2 }, next);
hand.on('pinch', event => zoom(event.scale));
hand.on('rotate:cw', event => rotate90(1, event.rawRotation));
hand.on('rotate:ccw', event => rotate90(-1, event.rawRotation));
```

Exclusive sequence:

```js
const hand = new HandTrick(surface);

hand.on('tap:2x', nextMedia);
hand.on('tap>tap>swipe', seekAhead);
hand.on('tap:2x>swipe', seekAhead);
```

If the user performs `tap>tap>swipe`, only `seekAhead` fires. If the user stops at the second tap, `tap:2x` can still fire after the sequence window closes.

Desktop multi-finger testing:

```js
hand.on('tap', { fingers: 2 }, toggleFit);
hand.on('swipe', { fingers: 2, fingerSource: 'keyboard' }, changeFolder);
```

Path plus swipe on one surface:

```js
const hand = new HandTrick(surface, {
    path: { consume: 'auto' },
    swipe: { enabled: true }
});

hand.on('right>down', openTools);
hand.on('swipe:right', nextItem);
```

Wheel zoom:

```js
const hand = new HandTrick(surface, ['viewer', {
    wheel: { preventDefault: true, zoomFactor: 0.0015 }
}]);

hand.on('wheel:zoom', event => {
    scale = clamp(scale * event.scale, 0.35, 4);
});
```

## Examples

| # | File | Focus |
| --- | --- | --- |
| 01 | [basic.html](examples/basic.html) | Tap, swipe, pinch, rotate, region, source. |
| 02 | [media.html](examples/media.html) | Media preset, tap zones, tap-hold pan, swipe, pinch, rotate override. |
| 03 | [regions.html](examples/regions.html) | 3x3 zones, halves, custom grid lookup, start-region routing. |
| 04 | [keyboard.html](examples/keyboard.html) | Alt/Ctrl/Shift+Meta roles, Meta rolling, Shift modifier drag. |
| 05 | [module.html](examples/module.html) | Direct ESM import and local/CDN module split. |
| 06 | [rolling.html](examples/rolling.html) | Rolling tap versus simultaneous multi-finger tap. |
| 07 | [sequences.html](examples/sequences.html) | Exclusive released gesture sequences. |
| 08 | [path.html](examples/path.html) | Bare path commands, two-finger paths, circle and arc paths, criteria, longer-path precedence. |
| 09 | [rotate.html](examples/rotate.html) | Rebased two-finger rotate. |
| 10 | [wheel.html](examples/wheel.html) | Normalized wheel zoom. |
| 11 | [thresholds.html](examples/thresholds.html) | Live threshold tuning. |
| 12 | [router.html](examples/router.html) | Runtime selector, method, and criteria routing. |
| 13 | [advanced.html](examples/advanced.html) | Combined routing for modifier, path, wheel, rotate, regions, rolling, sequences. |
| 14 | [Inspector Workbench](inspector/index.html) | Event stream, payload inspection, event toggles, live tuning, router panel. |

The [example hub](examples/index.html) links the examples in learning order. The [inspector workbench](inspector/index.html) is useful when debugging payloads, registered event families, and selector-plus-criteria routing without switching pages.

Most examples use the UMD/global entry `../handtrick.js`. [module.html](examples/module.html) and the inspector use `../handtrick.mjs`. Published direct-module CDN pages should use `handtrick.min.mjs`.

## Build And Test

```sh
npm test
npm run build
npm run test:min
```

`npm run build` assembles `src/` into `handtrick.js` and `handtrick.mjs`, then writes `handtrick.min.js` and `handtrick.min.mjs` from the same source graph. ESM entries export directly and do not load or write a global. Terser is a dev dependency only.

Coverage includes:

- Runtime exports, CommonJS, direct ESM entry, minified parity, package metadata sync.
- Tap chains, open-ended tap aliases, multi-finger taps, distance breaks, interval breaks, tap-hold continuity.
- Exclusive sequence dispatch, aggregate tap alias expansion, longest match, direction specificity, explicit tap atoms, and no colon/prefixed legacy syntax.
- Rolling tap positives and negatives: timing, span/step proof, overlap diagnostics, movement slop, simultaneous contacts, count aliases, Meta keyboard rolling.
- Keyboard modifier combos, keyboard finger substitution, exact combo matching, disabled roles, listener-driven preset activation.
- Pan gates, axis locks, tap-hold pan, release guard behavior, staggered multi-finger release.
- Swipe direction aliases, speed criteria, pruning, and direct-handler suppression when a longer sequence wins.
- Pinch continuity, parallel-translation rejection, rotate proof, rotate noise rejection, activation rebasing.
- Bare path listeners, path criteria longest-match arbitration, wrong-turn negatives, pause breaks, grid metadata.
- Wheel normalization, wheel zoom, ignored wheel events, pressure changes, DOM suppression, iOS tap guard, style restoration, destroy cleanup.

Contributor internals live in [CONTRIBUTING.md](CONTRIBUTING.md). Runtime architecture lives in [ARCHITECTURE.md](ARCHITECTURE.md).

## Author

[Reza Jelodar](https://jelodar.com/)

## License

MIT.
