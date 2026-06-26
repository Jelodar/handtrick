# HandTrick

HandTrick is a dependency-free browser gesture runtime. It turns pointer, touch, mouse, pen, wheel, pressure, and keyboard-modified input into one stable event detail shape.

It supports mapping gestures to application commands for media controls, viewers, canvases, maps, carousels, inspectors, and other touch-first tools that require effective desktop alternatives.

Runtime dependencies: none.

Runtime language: plain JavaScript. Type declarations are included for editors and TypeScript consumers.

## Contents

- [Install](#install)
- [Quick Start](#quick-start)
- [How To Think About HandTrick](#how-to-think-about-handtrick)
- [Package Entries](#package-entries)
- [Presets](#presets)
- [Listeners And Phases](#listeners-and-phases)
- [Selectors](#selectors)
- [Events](#events)
- [Criteria](#criteria)
- [Position, Regions, And Grids](#position-regions-and-grids)
- [Paths, Circles, And Arcs](#paths-circles-and-arcs)
- [Released Sequences](#released-sequences)
- [Rolling Tap](#rolling-tap)
- [Keyboard Roles And Modifiers](#keyboard-roles-and-modifiers)
- [Payload](#payload)
- [Options](#options)
- [Ownership And Native Input](#ownership-and-native-input)
- [API Reference](#api-reference)
- [Recipes](#recipes)
- [Examples](#examples)
- [Development](#development)
- [License](#license)

## Install

```sh
npm install handtrick
```

For direct browser use, load one of the shipped files:

```html
<script src="./handtrick.min.js"></script>
<script>
const hand = new HandTrick(surface);
</script>
```

Or as a browser module:

```html
<script type="module">
import HandTrick from './handtrick.min.mjs';

const hand = new HandTrick(surface);
</script>
```

## Quick Start

```js
import HandTrick from 'handtrick';

const hand = new HandTrick(surface);

hand.command('tap', { region: 'center' }, togglePlay);
hand.command('tap:2x', { region: 'left' }, rewind);
hand.command('tap:2x', { region: 'right' }, forward);
hand.command('swipe:up', { startRegion: 'bottom' }, showControls);

hand.observe('pinch', event => {
    zoomBy(event.scale);
});
```

The important split:

- Selector text names the gesture shape: `tap:2x`, `swipe:right`, `pinch:out`, `right>down`, `tap>swipe:left`.
- Criteria filter where, how many fingers, which source, which speed, or which path suffix: `{ region: 'right' }`, `{ fingers: 2 }`, `{ speed: 'flick' }`.
- `command()` is for app actions that should arbitrate against competing commands.
- `observe()` is for additive work such as previews, telemetry, cursors, HUDs, and debugging.

Media surface setup:

```js
const hand = new HandTrick(video, 'media');

hand.command('tap', { region: 'center' }, togglePlay);
hand.command('tap', { region: 'left' }, previous);
hand.command('tap', { region: 'right' }, next);
hand.command('swipe:left', next);
hand.command('swipe:right', previous);
```

Preset plus overrides:

```js
const hand = new HandTrick(surface, ['media', {
    rotate: { enabled: true, angle: 28, confidence: 1 },
    path: { consume: 'auto' }
}]);
```

## How To Think About HandTrick

HandTrick has four practical layers:

1. Native input enters as pointer, touch, mouse, wheel, or keyboard state.
2. Session state tracks active points, centers, timing, target rect, topology, keyboard substitution, and ownership.
3. Recognizers produce semantic details: tap, press, pan, swipe, pinch, rotate, path, circle, arc, rolling, modifier, pressure, wheel.
4. Dispatch runs additive listeners and command arbitration.

The rules that prevent most integration bugs:

- Use `command()` for state-changing app actions.
- Use `observe()` for live feedback and diagnostics.
- Criteria run after recognition. They do not stop recognizers from starting, consuming, claiming native input, or building payloads.
- Registered selectors activate recognizer families. Criteria do not activate recognizers by themselves.
- Direct options win over listener activation. If you set `rotate.enabled: false`, a rotate listener cannot re-enable rotate until `setOptions()` changes that option.
- Handler details are public snapshots. Do not depend on private session state.

Command arbitration picks the best command candidate by combined selector-plus-criteria specificity, then later emitted item when several committed items are dispatched together, then registration order. Handlers with the same winning type, combined specificity, and criteria key fan out as one group.

Released sequences and held paths add one more rule before that sort: longer matching sequence/path patterns win over shorter overlapping ones.

## Package Entries

| Loader | Use | Notes |
| --- | --- | --- |
| Classic browser script | `handtrick.js`, `handtrick.min.js` | Exposes `globalThis.HandTrick`. |
| Browser module script | `handtrick.mjs`, `handtrick.min.mjs` | Use with `type="module"`. |
| Bundler ESM | `import HandTrick from 'handtrick'` | Prefer the package root. |
| CommonJS | `const HandTrick = require('handtrick')` | Uses the readable global/CommonJS build. |
| Types | `index.d.ts` | Declarations only. Runtime stays JavaScript. |

CDN global:

```html
<script src="https://unpkg.com/handtrick/handtrick.min.js"></script>
```

CDN module:

```html
<script type="module">
import HandTrick from 'https://cdn.jsdelivr.net/npm/handtrick/handtrick.min.mjs';
</script>
```

Package files:

| File | Purpose |
| --- | --- |
| `handtrick.js` | Readable browser global and CommonJS runtime. |
| `handtrick.mjs` | Readable direct ESM runtime. |
| `handtrick.min.js` | Minified browser global and CommonJS runtime. |
| `handtrick.min.mjs` | Minified direct ESM runtime. |
| `index.d.ts` | Public declarations. |

Use `.mjs` for module scripts. Bundlers should import `handtrick`, not minified files.

## Presets

Presets are normal options. Later overrides win.

| Preset | Best For | Main Behavior |
| --- | --- | --- |
| `media` | Video and image surfaces | Tap zones, tap-hold pan, swipe, pinch, rolling tap, modifier gestures. Rotate off by default. |
| `viewer` | Image and document viewers | Pan, wheel zoom, pinch. Swipe off. |
| `carousel` | Paging surfaces | Swipe-focused. Pan, pinch, rotate off. |
| `drawing` | Canvas and pressure input | Low pan threshold, pressure enabled, semantic gestures reduced. |
| `map` | Map-like canvases | Pan, pinch, rotate, wheel zoom. Swipe off. |

```js
const hand = new HandTrick(surface, 'viewer');
```

Preset arrays merge left to right:

```js
const hand = new HandTrick(surface, ['map', {
    rotate: { angle: 18 },
    wheel: { preventDefault: true }
}]);
```

Create an options object without constructing:

```js
const options = HandTrick.preset('media', {
    swipe: { velocity: 0.18 }
});
```

Preset and listener interaction:

- Presets can disable recognizers as defaults.
- A listener can activate a recognizer disabled by a preset when that disable was not an explicit user option.
- A direct `enabled: false` option stays disabled until `setOptions()` changes it.
- Leave `intent.events` unset for normal apps so registered listeners drive activation.

## Listeners And Phases

```js
hand.on(type, handler, options);
hand.on(type, criteria, handler, options);
hand.once(type, handler, options);
hand.once(type, criteria, handler, options);
hand.off(type, handler);
hand.off(type);
hand.off();

hand.command(type, handler);
hand.command(type, criteria, handler);
hand.observe(type, handler);
hand.observe(type, criteria, handler);
```

`type` is a selector. `criteria` is checked with `HandTrick.matches(detail, criteria)`.

Phases:

| Phase | Meaning |
| --- | --- |
| `command` | Exclusive app command candidate. |
| `observe` | Additive listener. |
| `intent` | Additive pre-command phase. |
| `update` | Additive update phase. |

Default phase:

- `*` is observe.
- Lifecycle, progress, start/end, pressure, wheel, and `swipe:intent` events are observe.
- Final semantic events such as `tap`, `swipe:right`, `circle:cw`, and released sequence selectors are command.
- `command()` always forces command phase.
- `observe()` always forces observe phase.

Examples:

```js
hand.command('swipe:left', previous);
hand.command('tap:2x', { region: 'right' }, forward);

hand.observe('pan', updateDragPreview);
hand.observe('session:move', updatePointerHud);
hand.observe('*', logEvent);
```

> Note: forcing command phase on continuous or lifecycle streams does not make them behave like released exclusive commands. It only changes which listener phase is used.

## Selectors

Selectors are normalized to lowercase canonical text. Supported canonical shape:

```txt
family[:mode][:count][:direction][:state]
```

Not every slot is valid for every family. Invalid selectors remain inert; they do not accidentally activate recognizers.

Families:

```txt
tap
press
pan
swipe
pinch
rotate
path
circle
arc
rolling
pressure
wheel
session
gesture
fingers
input
```

Direction values:

| Family | Directions |
| --- | --- |
| Swipe, path, rolling, arc | `left`, `right`, `up`, `down` |
| Pinch | `in`, `out` |
| Rotate, circle | `cw`, `ccw` |

Valid selector examples:

```js
hand.command('tap:2x', fn);
hand.command('swipe:right', fn);
hand.observe('swipe:intent:left', preview);
hand.command('pinch:out', fn);
hand.command('rotate:mod:cw', fn);
hand.command('circle:2x:ccw', fn);
hand.command('tap:2x>swipe:right', fn);
hand.command('right>down>left', fn);
```

Invalid selector examples:

```js
hand.on('swipe:right:2f', fn);
hand.on('swipe:flick:right', fn);
hand.on('swipe:slow:right', fn);
hand.on('tap:2f', fn);
hand.on('rolling:3f:right', fn);
hand.on('tap:swipe', fn);
hand.on('path:right>down', fn);
```

Use criteria instead:

```js
hand.command('swipe:right', { fingers: 2 }, fn);
hand.command('swipe:right', { speed: 'flick' }, fn);
hand.command('circle:cw', { fingers: 2 }, fn);
```

Runtime validation:

```js
HandTrick.event('Swipe:Right');          // 'swipe:right'
HandTrick.event('tap:2x>swipe:right');  // 'tap:2x>swipe:right'
HandTrick.path('Right>Down');           // 'right>down'
HandTrick.isEvent('swipe:right:2f');    // false
```

`HandTrick.events` is a finite registry. Open grammar such as `tap:4x`, `circle:3x:cw`, bare paths, and released sequences is validated by `HandTrick.event()` or `HandTrick.path()`.

## Events

### Lifecycle

| Selector | Fires |
| --- | --- |
| `session:start` | First accepted pointer/touch/mouse input starts a session. |
| `session:move` | A tracked pointer/touch/mouse input moves. |
| `session:end` | Last tracked pointer/touch/mouse input ends normally. |
| `session:cancel` | Session is cancelled by native cancel, disable, destroy, or manual cancel. |
| `fingers:change` | Effective pointer count changes during a session. |
| `gesture:start` | A tracked session begins. |
| `gesture:update` | Active session receives movement/update. |
| `gesture:transition` | Runtime transitions between gesture states, often topology changes. |
| `gesture:commit` | Runtime commits a semantic candidate. |
| `gesture:end` | Active gesture/session ended normally. |
| `gesture:cancel` | Active gesture/session cancelled. |
| `input:ignored` | Native input matched `ignore`. |

### Tap

| Selector | Meaning |
| --- | --- |
| `tap` | Any successful tap. |
| `tap:1x` | First tap in a tap chain. |
| `tap:2x` | Second tap in a nearby, recent tap chain. |
| `tap:3x` | Third tap in a tap chain. |
| `tap:${number}x` | Open-ended tap count alias. |
| `tap:sequence` | Additive tap-chain detail for every tap. |
| `tap:multi` | Second or later tap in a tap chain. |
| `tap:mod` | Tap while pointer or keyboard modifier context is active. |

```js
hand.command('tap', toggle);
hand.command('tap:2x', zoom);
hand.command('tap:4x', secretCommand);
hand.observe('tap:sequence', drawTapTrail);
hand.command('tap:mod', alternatePick);
```

`tap:2x` is the second tap in one chain. It is not two unrelated `tap` handlers.

### Press

| Selector | Meaning |
| --- | --- |
| `press` | Long press threshold met. |
| `press:start` | Press activated. |
| `press:move` | Held press moved while still valid. |
| `press:end` | Pointer released after press. |
| `press:cancel` | Press cancelled by movement, competing ownership, or session cancel. |

### Pan

| Selector | Meaning |
| --- | --- |
| `pan:start` | Movement passed pan proof. |
| `pan` | Continuous pan update. |
| `pan:end` | Pan ended. |
| `pan:mod:start` | Modifier pan started. |
| `pan:mod` | Pan while pointer/keyboard modifier context is active. |
| `pan:mod:end` | Modifier pan ended. |

`pan` is continuous. Keep pan handlers reversible or scoped to live UI when a later path or release command can still win.

### Swipe

Swipe is a release gesture. Use `pan` or `swipe:intent` for live movement.

| Selector | Meaning |
| --- | --- |
| `swipe` | Any committed swipe. |
| `swipe:left`, `swipe:right`, `swipe:up`, `swipe:down` | Directional swipe. |
| `swipe:intent` | Preliminary swipe candidate. |
| `swipe:intent:left`, `swipe:intent:right`, `swipe:intent:up`, `swipe:intent:down` | Directional swipe intent. |
| `swipe:mod` | Swipe while modifier context is active. |
| `swipe:mod:left`, `swipe:mod:right`, `swipe:mod:up`, `swipe:mod:down` | Directional modified swipe. |

```js
hand.command('swipe:left', previous);
hand.command('swipe:right', { fingers: 2 }, nextAlbum);
hand.command('swipe:up', { speed: 'flick' }, archive);
hand.observe('swipe:intent', previewPageTurn);
```

Speed labels:

| Speed | Meaning |
| --- | --- |
| `slow` | Distance-qualified but below `swipe.velocity`. |
| `normal` | At least `swipe.velocity`. |
| `flick` | At least 2x `swipe.velocity`. |

### Pinch

Pinch is a two-finger transform.

| Selector | Meaning |
| --- | --- |
| `pinch:start` | Pinch started. |
| `pinch` | Continuous pinch update. |
| `pinch:end` | Pinch ended. |
| `pinch:in`, `pinch:out` | Directional pinch. |
| `pinch:mod` | Modified pinch. |
| `pinch:mod:start`, `pinch:mod:end` | Modified pinch lifecycle. |
| `pinch:mod:in`, `pinch:mod:out` | Directional modified pinch. |

### Rotate

Rotate is a two-finger transform based on angular movement between active contacts.

| Selector | Meaning |
| --- | --- |
| `rotate:start` | Rotate started. |
| `rotate` | Continuous rotate update. |
| `rotate:end` | Rotate ended. |
| `rotate:cw`, `rotate:ccw` | Directional rotate. |
| `rotate:mod` | Modified rotate. |
| `rotate:mod:start`, `rotate:mod:end` | Modified rotate lifecycle. |
| `rotate:mod:cw`, `rotate:mod:ccw` | Directional modified rotate. |

Raise `rotate.angle`, `rotate.confidence`, or `rotate.dominance` when two-finger pans or pinches create false rotation.

### Path, Circle, Arc

| Selector | Meaning |
| --- | --- |
| `path:start` | First path segment recognized. |
| `path` | Path update. |
| `path:end` | Path session ended. |
| `left>down` | Bare path command. |
| `circle`, `circle:cw`, `circle:ccw`, `circle:2x:cw` | Path-derived circle commands. |
| `arc`, `arc:up`, `arc:right` | Path-derived arc commands. |

Full path behavior is covered in [Paths, Circles, And Arcs](#paths-circles-and-arcs).

### Rolling

| Selector | Meaning |
| --- | --- |
| `rolling` | Any directional rolling tap. |
| `rolling:left`, `rolling:right`, `rolling:up`, `rolling:down` | Directional rolling tap. |

Use criteria for count:

```js
hand.command('rolling:right', { fingers: 3 }, nextTool);
```

### Pressure And Wheel

| Selector | Meaning |
| --- | --- |
| `pressure:change` | Aggregate pressure changed past threshold. |
| `wheel` | Normalized wheel input. |
| `wheel:zoom` | Wheel mapped to scale. |

```js
hand.observe('pressure:change', setBrushWeight);
hand.observe('wheel', scrollTimeline);
hand.command('wheel:zoom', zoomAtPointer);
```

## Criteria

Criteria live in the second argument:

```js
hand.command('swipe:left', { fingers: 2, speed: 'flick' }, previousFast);
```

Core rules:

- Omitted or `null` criteria match.
- Unknown top-level criteria keys never match.
- Arrays are OR.
- Different keys are AND.
- Criteria filter public detail fields after recognition.

```js
HandTrick.matches(detail) === true;
HandTrick.matches(detail, null) === true;
HandTrick.matches(detail, { typo: true }) === false;
```

Common examples:

```js
hand.command('tap', { region: ['left', 'right'] }, edgeTap);
hand.command('tap:2x', { tapStartRegion: 'left', region: 'right' }, crossSideDouble);
hand.command('swipe:right', { region: { start: 'left', current: 'right' } }, leftToRight);
hand.command('tap:2x', { grid: { rows: 4, cols: 4, current: 15, tapStart: 12 } }, rangeTap);
hand.command('swipe:right', { fingers: 2, fingerSource: 'keyboard' }, desktopSwipe);
hand.command('pan:mod', { modifierName: 'shiftAlt' }, resize);
hand.observe('path', { path: 'down>right' }, preview);
```

Current top-level criteria keys:

```txt
region
startRegion
tapStartRegion
grid
startGrid
tapStartGrid
sequenceStartGrid
sequence
area
startArea
tapStartArea
edge
modifierRegion
modifierArea
modifierSource
modifierName
modifierFingers
actionFingers
totalFingers
key
keys
combo
modifierKeys
direction
axis
speed
modified
path
pathText
fingers
actualFingers
syntheticFingers
fingerSource
keyboardRole
pointerType
tapCount
```

### Location Criteria

Simple location filters use the existing top-level keys:

```js
{ region: 'left' }
{ startRegion: 'bottom' }
{ grid: { rows: 4, cols: 4, index: 15 } }
{ tapStartGrid: { rows: 4, cols: 4, index: 12 } }
```

Compound location filters keep shared configuration once and compare multiple phases:

```js
{ region: { start: 'left', current: 'right' } }
{ area: { current: 'edge', start: 'inside' } }
{ grid: { rows: 4, cols: 4, current: 15, tapStart: 12 } }
{ grid: { rows: 4, cols: 4, current: { col: 3 }, start: { row: 0 } } }
```

Phase keys:

| Key | Checks |
| --- | --- |
| `current` | Current event center. Same phase as `region`, `grid`, and `area`. |
| `start` | Gesture phase start center. Not the full browser input session start. |
| `tapStart` | First tap center in the active tap chain. Fails when no tap-chain data exists. |
| `sequenceStart` | First committed gesture center in released sequence detail. Fails outside released sequence detail. |

`sequenceStart` location shortcuts normalize into `sequence.start`. Use full `sequence` criteria when filtering more than first-step location:

```js
hand.command('tap>swipe:right', {
    sequence: {
        start: {
            fingers: 3,
            grid: { rows: 4, cols: 4, index: 0 }
        },
        end: { direction: 'right' }
    }
}, command);
```

Compound grid phase values accept numbers, strings, grid leaf objects, or arrays of those values. A number means flat index:

```js
{ grid: 4 }
{ startGrid: 0 }
{ grid: { rows: 4, cols: 4, current: 15 } }
```

Compound grid string tokens are semantic:

| Token | Meaning |
| --- | --- |
| `any` | Any cell in this phase grid. |
| `top`, `bottom` | First or last row. |
| `left`, `right` | First or last column. |
| `center` | Center cell for odd grids, center block for even grids. |
| `edge` | Grid border: first or last row or column. |
| `top-left`, `top-right`, `bottom-left`, `bottom-right` | Corner cells. |
| `rowN`, `colN` | Zero-based row or column. |
| `rowN-colM` | Exact zero-based row and column pair. |

Gotchas:

- Criteria filter handlers after recognition. They do not activate recognizers or stop native input by themselves.
- `region: 'edge'` means the physical edge band from `edge.size`; `grid: { current: 'edge' }` means grid border.
- Top-level `rows` and `cols` are not criteria. Put them inside `grid`.
- Legacy `grid: 'top'` and `grid: { cell: 'top' }` keep exact cell-name behavior. Compound `grid: { current: 'top' }` means the full top row.
- Unknown nested `region`, `area`, or `grid` phase keys fail closed.
- Grid objects with only `rows` and `cols`, or only unknown leaf fields, fail closed.
- Empty arrays never match.

### Criteria Reference

| Criteria | Checks |
| --- | --- |
| `region` | Current center via region matcher. |
| `startRegion` | Gesture phase start center. |
| `tapStartRegion` | First tap center in the current tap chain. |
| `grid` | Current custom grid cell. |
| `startGrid` | Start center custom grid cell. |
| `tapStartGrid` | First tap custom grid cell in the current tap chain. |
| `sequenceStartGrid` | First committed gesture center in a released sequence. Normalizes through `sequence.start.grid`. |
| `sequence` | Per-step filters for released sequence detail. |
| `area`, `startArea`, `tapStartArea` | Broad area: `center`, `edge`, `inside`, `outside`. `area` also accepts compound phase criteria. |
| `edge` | Current edge region. |
| `modifierRegion`, `modifierArea` | Modifier anchor/source position. |
| `modifierSource` | `touch` or `keyboard`. |
| `modifierName` | Named modifier combo or modifier role. |
| `modifierFingers` | Modifier anchor finger count. |
| `actionFingers` | Action pointer finger count. |
| `totalFingers` | Modifier plus action fingers. |
| `key` | Every listed canonical key is present. |
| `keys`, `combo` | Combo match against `event.keyCombo`. |
| `modifierKeys` | Combo match against `event.modifier.keyCombo`. |
| `direction` | Event direction. |
| `axis` | Event axis. |
| `speed` | Swipe speed label. |
| `modified` | Boolean modifier context flag. |
| `path`, `pathText` | Path suffix/pattern match. |
| `fingers` | Effective finger count. |
| `actualFingers` | Physical pointer count. |
| `syntheticFingers` | Keyboard-substituted count. |
| `fingerSource` | `pointer`, `keyboard`, `none`, `auto`. |
| `keyboardRole` | Keyboard substitute role. |
| `pointerType` | `mouse`, `touch`, `pen`, `wheel`, `none`, or browser source. |
| `tapCount` | Tap-chain count. |

`fingerSource` values:

| Value | Meaning |
| --- | --- |
| omitted | Accept pointer, keyboard, or none. |
| `auto` | Same as omitted. Useful for generated criteria. |
| `pointer` | Physical pointer/touch/pen/mouse source. |
| `keyboard` | Keyboard substitution supplied the effective finger count. |
| `none` | No active pointer source, such as wheel-only events. |

### Sequence Criteria

`sequence` filters released sequence detail. It does not define the sequence selector.

Array form checks steps by index:

```js
hand.command('tap>swipe:left', {
    sequence: [
        { fingers: 3, fingerSource: 'keyboard' },
        { direction: 'left' }
    ]
}, fn);
```

Object form:

```js
hand.command('tap>swipe:left', {
    sequence: {
        start: { fingers: 3 },
        end: { direction: 'left' },
        steps: [
            { family: 'tap' },
            { family: 'swipe', direction: 'left' }
        ]
    }
}, fn);
```

Sequence step criteria keys:

```txt
event
gesture
family
mode
state
direction
fingers
actualFingers
syntheticFingers
fingerSource
keyboardRole
keys
combo
tapCount
region
grid
area
```

Rules:

- Empty sequence arrays never match.
- Unknown keys inside a `sequence` object never match.
- Object form must contain `start`, `end`, or `steps`.
- Step arrays can be shorter than the actual sequence. Checked entries must match.
- There is no top-level `sequenceStartRegion` or `sequenceStartArea`.

## Position, Regions, And Grids

Every center or pointer position exposes:

| Field | Meaning |
| --- | --- |
| `x`, `y` | Alias coordinates for the current point. |
| `pageX`, `pageY` | Document coordinates. |
| `clientX`, `clientY` | Viewport coordinates. |
| `localX`, `localY` | Coordinates relative to `currentTarget`. |
| `ratioX`, `ratioY` | Unclamped local ratio. |
| `clampedRatioX`, `clampedRatioY` | `0..1` local ratio. |
| `inside` | Whether the point is inside the target rect. |
| `area` | `center`, `edge`, `inside`, or `outside`. |
| `edge` | `{ top, right, bottom, left }` booleans. |
| `edgeRegion` | Edge/corner name or `none`. |
| `halfX`, `halfY`, `halfRegion` | Half-axis buckets with a center dead zone. |
| `thirdX`, `thirdY`, `region`, `zone` | 3x3 region. `zone` equals `region`. |
| `grid(rows, cols)` | Custom grid lookup. |

3x3 region names:

| Row | Col 0 | Col 1 | Col 2 |
| --- | --- | --- | --- |
| 0 | `top-left` | `top` | `top-right` |
| 1 | `left` | `center` | `right` |
| 2 | `bottom-left` | `bottom` | `bottom-right` |

Region matching uses `HandTrick.region(pointOrEvent, value)`. A value may match multiple position aliases:

- `left` may match a third, half, or edge alias.
- `top-left` may match 3x3 region, half region, or edge corner.
- `edge` means the physical edge band, not a grid border.
- `any` matches every non-null point.

Examples:

```js
hand.command('tap', { region: 'left' }, previous);
hand.command('swipe:up', { startRegion: 'bottom' }, showControls);

hand.on('tap', event => {
    const cell = event.center.grid(4, 4);
    console.log(cell.row, cell.col, cell.index);
});
```

### Grid Criteria

Grid object fields:

| Field | Meaning |
| --- | --- |
| `rows` | Grid row count. Default `3`. Minimum effective value `1`. |
| `cols` | Grid column count. Default `3`. Minimum effective value `1`. |
| `row` | Zero-based row index or array. |
| `col` | Zero-based column index or array. |
| `index` | Flat index, `row * cols + col`, or array. |
| `cell` | Generated cell name or array. |

```js
hand.command('tap', { grid: { rows: 4, cols: 4, index: 15 } }, bottomRight);
hand.command('tap', { grid: { rows: 4, cols: 4, row: 0 } }, topRow);
hand.command('tap', { grid: { rows: 4, cols: 4, col: 0 } }, leftColumn);
hand.command('tap:2x', {
    grid: { rows: 3, cols: 3, current: { col: 2 }, tapStart: { col: 2 } }
}, sameSideDoubleTap);
```

Grid string behavior:

- A non-object grid value is treated as `{ cell: value }`.
- A number grid value is treated as `{ index: value }`.
- `grid: 'top'` in a 3x3 grid means top-center cell, not the entire top row.
- `grid: 'left'` in a 3x3 grid means center-left cell, not the entire left column.
- In compound grid phase values, strings are semantic. `grid: { current: 'top' }` means the top row.

Avoid broad-match quirks:

```js
{ grid: 15 }                  // flat index in the default 3x3 grid
{ grid: { index: 15 } }       // same index form with room for rows and cols
{ grid: { rows: 4, cols: 4 } } // configures lookup but does not filter
{ grid: { idx: 15 } }         // unknown leaf field; never matches
```

## Paths, Circles, And Arcs

Paths are held-pointer cardinal direction chains.

```js
hand.command('down>right', event => {
    openCommand(event.pathSegments);
});

hand.observe('path', { path: 'left>up' }, preview);
```

Do not prefix a path command with `path:`:

```js
hand.command('path:left>up', fn); // invalid
hand.command('left>up', fn);      // valid
```

Multi-finger paths require both recognizer configuration and criteria:

```js
const hand = new HandTrick(surface, {
    path: { fingers: [1, 2] }
});

hand.command('right>up', { fingers: 2 }, twoFingerCorner);
hand.observe('path', { path: 'right>up', fingers: 2 }, previewTwoFingerCorner);
```

`{ fingers: 2 }` means the shared center movement of a two-finger path. It does not mean each finger drew its own path.

### Circle

Circle is path-derived. A four-segment cycle following `right>down>left>up` from any starting side is clockwise. The reverse cycle is counter-clockwise.

```js
hand.command('circle:cw', redo);
hand.command('circle:ccw', undo);
hand.command('circle:2x:cw', { fingers: 2 }, doubleClockwise);
```

Clockwise examples:

```txt
right>down>left>up
down>left>up>right
left>up>right>down
```

Counter-clockwise examples:

```txt
right>up>left>down
up>left>down>right
left>down>right>up
```

Circle atoms work inside longer paths and criteria:

```js
hand.command('up>circle', openRadialMenu);
hand.command('up>circle:2x:cw', openAfterTwoLoops);
hand.observe('path', { path: 'left>circle:ccw' }, preview);
```

Details:

- `circle:Nx` means N complete four-segment cycles in the same direction.
- Adjuster order is flexible: `circle:ccw:2x` canonicalizes to `circle:2x:ccw`.
- `circle:1x:cw` canonicalizes to `circle:cw`.
- `path.maxCircleCount` limits very large count selectors. Default is `6`.
- Circle events keep normal path fields and add `circle`, `circleDirection`, and `circleCount`.

### Arc

Arc is a three-segment path atom. Direction is the first segment direction.

```js
hand.command('arc:up', openTopTray);
hand.command('right>arc:down', openAfterDownArc);
hand.observe('path', { path: 'arc:left', fingers: 2 }, previewTwoFingerLeftArc);
```

Both `up>right>down` and `up>left>down` match `arc:up`.

### Path Proof

Recognizer proof:

- New segments need enough distance.
- Axis must be clear enough.
- Turns must be real, not jitter.
- Long pauses break path continuity.
- Straight one-segment movement is conservative because it can also be a swipe.

Tune these when paths feel wrong:

| Option | Effect |
| --- | --- |
| `path.minDistance` | Distance before first segment. |
| `path.segmentDistance` | Distance before later segments. |
| `path.axisRatio` | How clean a cardinal direction must be. |
| `path.turnAngle` | How strong a turn must be. |
| `path.maxPause` | Pause limit between segments. |

### Path Consumption

| Mode | Meaning | Use When |
| --- | --- | --- |
| `auto` | Default. A single straight segment allows release gestures unless a turn or command-phase path winner consumes. | Most apps. |
| `eager` | First path segment consumes immediately and blocks release tap/swipe fallback. | Path-heavy surfaces. |
| `never` | Path does not consume by itself. Path commands and release gestures may both fire. | Diagnostics or deliberate coexistence. |

Only string modes are supported. Invalid values, including booleans and `null`, fall back to `auto`.

Path/swipe gotchas:

- Any path listener can activate the path recognizer.
- Criteria such as `{ startGrid }` are filters, not start gates.
- `path.consume: 'eager'` can consume a straight one-finger swipe before release.
- In `auto`, `hand.command('path', { path: 'right' }, fn)` can consume a straight one-segment swipe when it wins.
- Observe-only path criteria do not consume a straight release swipe in `auto`.
- `path.consume: 'never'` can allow both a path command and a final swipe from the same release.
- Default `path.fingers: [1]` means two-finger swipes avoid the one-finger path conflict unless you enable two-finger paths.

For media viewers that need one-finger swipes plus path commands:

```js
const hand = new HandTrick(surface, ['media', {
    path: { consume: 'auto' }
}]);
```

### Path Arbitration

Longest path wins:

```js
hand.command('right>down>left>up', addWorkspace);
hand.command('right>down>left>up>right>down>left>up', spreadWorkspace);
```

If the user draws eight segments, only `spreadWorkspace` runs. If the user stops after four, `addWorkspace` runs when the path session ends.

Path criteria use the same arbitration:

```js
hand.observe('path', { path: 'right>down>left>up' }, addWorkspace);
hand.observe('path', { path: 'right>down>left>up>right>down>left>up' }, spreadWorkspace);
```

## Released Sequences

Released sequences join committed gestures with `>`:

```js
hand.command('tap>tap>swipe:right', fn);
hand.command('tap:2x>swipe:right', fn);
hand.command('rolling>tap:mod', fn);
```

Rules:

- Sequence atoms must be valid event selectors.
- `tap:2x>swipe:right` expands to two tap steps followed by a right swipe.
- Direction-specific swipes work inside sequences.
- Legacy colon style such as `tap:swipe` is not supported.
- Finger aliases inside sequences are invalid. Use sequence criteria.
- Sequences are exclusive while the sequence window is open.
- Longest match wins, then specificity.
- A direct fallback such as `swipe:right` may be delayed or suppressed by a pending longer sequence.
- Gap must fit `intent.sequenceWindow`, default `1200` ms.
- Retained history is bounded by `intent.sequenceMax`, default `8`.

```js
hand.command('tap:2x', nextMedia);
hand.command('tap>tap>swipe:right', seekAhead);
hand.command('tap:2x>swipe:right', seekAhead);
```

If the user performs `tap>tap>swipe:right`, the sequence command wins and direct `tap:2x` / `swipe:right` fallbacks for that chain do not run. If the user stops after the second tap, `tap:2x` can still fire after the pending window closes.

Step criteria:

```js
hand.command('tap>swipe:left', {
    sequence: [
        {
            fingers: 3,
            fingerSource: 'keyboard',
            keyboardRole: 'threeFingers'
        },
        { direction: 'left' }
    ]
}, command);
```

Paths and sequences are separate recognizers. This is invalid for "tap, swipe, then path":

```js
hand.on('tap>swipe:left>right>up', handler);
```

Use app state when a workflow needs both:

```js
let armed = false;

hand.command('tap>swipe:left', () => {
    armed = true;
});

hand.command('right>up', event => {
    if (!armed) return;
    armed = false;
    openCornerCommand(event);
});

hand.observe('session:cancel', () => {
    armed = false;
});
```

## Rolling Tap

A rolling tap is a staggered, overlapping same-hand tap wave. It is not a simultaneous multi-finger tap and not a modifier.

Default proof:

- 2, 3, or 4 contacts.
- Adjacent down events are `10..500` ms apart.
- Each adjacent contact overlaps: pointer N goes down before pointer N-1 lifts.
- Each finger holds no more than `780` ms.
- Movement stays under `28` px.
- Contact order is monotonic and directional.
- Directional span is at least `24` px.
- Each adjacent step is at least `10` px.
- Adjacent contacts stay within same-hand gap bounds.

```js
hand.command('rolling:right', event => {
    console.log(event.rolling.count, event.rolling.delays);
});

hand.command('rolling:left', { fingers: 3 }, command);
```

Near-simultaneous contacts below `rolling.minDelay` remain normal multi-finger taps. Slow stagger above `rolling.maxDelay` becomes separate tap/modifier input.

Three- and four-finger rolls get wider defaults through `rolling.maxDelayByFingers`, `rolling.maxGapByFingers`, and `rolling.maxHoldByFingers`.

Desktop substitute: Meta-click chains can emit keyboard rolling. A short directional Meta-click line with two or three clicks emits a keyboard rolling tap. Invalid or non-directional Meta clicks fall back to the normal tap chain after the pending window.

`event.rolling.source` is `pointer` or `keyboard`.

## Keyboard Roles And Modifiers

Keyboard roles make desktop testing and mouse-first apps closer to touch without faking pointer coordinates.

Default roles:

| Role | Default Combo | Effect |
| --- | --- | --- |
| `modifier` | `shift` | Routes `tap:mod` and `pan:mod`. |
| `twoFingers` | `alt` | One pointer reports `fingers: 2`. |
| `threeFingers` | `ctrl` | One pointer reports `fingers: 3`. |
| `fourFingers` | `shift+meta` | One pointer reports `fingers: 4`. |
| `rollingTap` | `meta` | Directional Meta-click chains emit `rolling`. |

```js
hand.command('tap', { fingers: 2 }, fit);
hand.command('tap', { fingers: 2, fingerSource: 'keyboard' }, fitFromDesktopOnly);
hand.command('tap', { fingers: 2, fingerSource: 'pointer' }, fitFromTouchOnly);
```

Keyboard substitution changes:

- `fingers`
- `maxFingers`
- `syntheticFingers`
- `fingerSource`
- `keyboardSubstitute`

It does not change `actualFingers`.

Customize roles:

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

hand.command('pan:mod', { modifierName: 'resize' }, resizeSelection);
hand.command('swipe:left', { fingers: 3 }, previousGroup);
```

Disable a role by setting it to `null` or `false`:

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

Keep the jobs separate:

- `modifier` labels modifier gestures such as `tap:mod` and `pan:mod`.
- `twoFingers`, `threeFingers`, and `fourFingers` substitute effective finger count for ordinary gestures.
- `rollingTap` turns a short directional click chain into keyboard rolling.
- `keyboard.combos` assigns names to keyboard modifier gestures.

Modifier criteria:

```js
hand.command('tap:mod', {
    modifierSource: 'keyboard',
    modifierName: 'resize',
    modifierKeys: 'shift+alt'
}, alternatePick);

hand.command('tap:mod', {
    modifierRegion: 'top-left',
    modifierArea: 'edge',
    modifierFingers: 1,
    actionFingers: 1,
    totalFingers: 2
}, alternatePick);
```

Modified swipe, pinch, and rotate have their own selector forms:

```js
hand.command('swipe:mod:right', { combo: 'alt' }, duplicateToNext);
hand.command('pinch:mod:out', { combo: 'alt' }, zoomSelection);
hand.command('rotate:mod:cw', { keys: 'shift+meta' }, rotateCopyRight);
```

`HandTrick.keyCombo()` normalizes exact combo text:

```js
HandTrick.keyCombo('command+option+shift'); // 'shift+alt+meta'
```

## Payload

Handlers receive one detail object. Common fields:

| Field | Meaning |
| --- | --- |
| `type` | Emitted event type. |
| `originalEvent` | Native event when available. |
| `target` | Original target for active input. |
| `currentTarget` | Element bound to HandTrick. |
| `instance` | Non-enumerable HandTrick instance. |
| `pointerType` | `mouse`, `touch`, `pen`, `wheel`, or `none`. |
| `fingers` | Effective pointer count. |
| `actualFingers` | Physical active pointer count. |
| `syntheticFingers` | Keyboard-substituted count, or `0`. |
| `fingerSource` | `pointer`, `keyboard`, or `none`. |
| `maxFingers`, `maxActualFingers` | Max effective/physical count seen in session. |
| `pointers`, `activePointers` | Pointer snapshots. |
| `changedPointer`, `changedPointers` | Changed pointer snapshots when available. |
| `actionPointer`, `modifierPointers` | Modifier action/anchor snapshots when relevant. |
| `center`, `startCenter`, `previousCenter` | Current, phase-start, and previous aggregate positions. |
| `region`, `startRegion`, `previousRegion` | Position aliases from center snapshots. |
| `area`, `startArea`, `edge`, `startEdge`, `edgeRegion`, `startEdgeRegion` | Area and edge metadata. |
| `halfX`, `halfY`, `halfRegion`, `thirdX`, `thirdY` | Coarse position buckets. |
| `keys`, `keyCombo`, `keyboard`, `keyboardSubstitute` | Keyboard snapshots. |
| `deltaX`, `deltaY`, `absX`, `absY`, `travel` | Translation from phase start. |
| `stepX`, `stepY`, `stepDistance`, `stepElapsed` | Last-sample movement. |
| `velocityX`, `velocityY`, `velocity`, `stepVelocity` | Motion speed in px/ms. |
| `direction`, `axis`, `speed` | Direction, axis, and swipe speed label when present. |
| `distance`, `scale`, `rotation`, `angle` | Transform and movement values. |
| `pressure`, `previousPressure`, `pressureDelta`, `normalizedPressure` | Pressure values. |
| `confidence`, `confidences` | Recognition confidence scores. |
| `motion` | Two-pointer motion shape. |
| `phase` | Runtime/session phase, not listener phase. |
| `intent` | Commitment/pruning snapshot. |
| `topology` | Pointer add/remove/max metadata. |
| `rect` | Target rect used for position metadata. |
| `claimed`, `consumed`, `releaseGuarded`, `tapHold`, `tapChain` | Ownership and gesture diagnostics. |
| `preventDefault()` | Prevent native event when possible. |
| `stopPropagation()` | Stop native event when possible. |

Gesture-specific fields:

| Field | Appears On | Meaning |
| --- | --- | --- |
| `tapCount`, `tapSequence` | Tap | Tap count and tap-chain details. |
| `sequence`, `gestureSequence` | Released sequences, tap chains | Matched gesture list and sequence metadata. |
| `scale`, `scaleDelta`, `rawScale`, `rawScaleDelta` | Pinch, wheel zoom | Rebased scale and raw diagnostics. |
| `rotation`, `rawRotation`, `angularVelocity` | Rotate | Rebased signed degrees and angular speed. |
| `path`, `pathText`, `pathSegments`, `pathDistance` | Path | Direction list/string and segment data. |
| `matchPattern`, `matchedPathText`, `pathMatched` | Path/circle/arc | Matched pattern and physical matched slice. |
| `circle`, `circleDirection`, `circleCount` | Circle | Cycle metadata. |
| `arc`, `arcDirection` | Arc | Arc metadata. |
| `rolling`, `rollingCount`, `rollingDirection` | Rolling | Source, count, direction, timing, contact order. |
| `modifier` | Modifier | Source, name, fingers, regions, keys, position breakdown. |
| `actionDeltaX`, `actionDeltaY`, `actionTravel`, `actionDirection` | Modifier pan | Action pointer movement. |
| `rawDeltaX`, `rawDeltaY`, `rawDeltaZ`, `deltaMode` | Wheel | Native wheel deltas. |
| `panAxis` | Pan | Axis lock/dominant axis result. |

Payload invariants:

- `instance` is non-enumerable.
- Position and pointer fields are snapshots.
- Gesture-specific fields are additive.
- Wheel and `input:ignored` can be thinner because they may be emitted outside an active pointer session.

## Options

Constructor forms:

```js
new HandTrick(target);
new HandTrick(target, options);
new HandTrick(target, 'media');
new HandTrick(target, ['media', { rotate: { enabled: true } }]);
new HandTrick({ target, input: 'mouse' });
HandTrick.create(target, options);
```

Top-level option fields:

```txt
preset
presets
enabled
input
touch
mouse
pen
mouseTouchDelay
buttons
preventDefault
stopPropagation
capture
windowEvents
ignore
clock
rect
dom
intent
claim
tap
tapHold
press
pan
swipe
pinch
rotate
path
rolling
modifier
pressure
wheel
edge
```

### Defaults

All values shown are library defaults before presets.

| Namespace | Important Defaults |
| --- | --- |
| top-level | `enabled: true`, `input: 'auto'`, `preventDefault: true`, `stopPropagation: false`, `capture: true`, `windowEvents: true`, `rect: 'session'` |
| `tap` | `maxTime: 420`, `maxMove: 18`, `interval: 340`, `distance: 80` |
| `tapHold` | `window: 1200`, `distance: 160`, `maxRestTime: 320` |
| `press` | `delay: 500`, `move: 14`, `repeat: 0`, `consumesTap: true`, `allowsPan: false` |
| `pan` | `threshold: 12`, `minTime: 45`, `minSamples: 2`, `fingers: [1]`, `axis: 'free'` |
| `swipe` | `distance: 80`, `distanceByFingers: { 1: 100, 2: 60, 3: 60, 4: 60 }`, `velocity: 0.25`, `axisRatio: 1.12`, `intentDistance: 50` |
| `pinch` | `distance: 10`, `scale: 0.03`, `minTime: 70`, `minSamples: 2`, `dominance: 0.35` |
| `rotate` | `angle: 8`, `minTime: 130`, `minSamples: 3`, `lateAngle: 22`, `minAngularVelocity: 0.035`, `dominance: 0.42`, `confidence: 0.72` |
| `path` | `fingers: [1]`, `minDistance: 44`, `segmentDistance: 42`, `axisRatio: 1.35`, `turnAngle: 55`, `maxPause: 650`, `maxSegments: 6`, `maxCircleCount: 6`, `consume: 'auto'` |
| `rolling` | `fingers: [2, 3, 4]`, `minDelay: 10`, `maxDelay: 500`, `keyboardMaxDelay: 500`, `maxHold: 780`, `maxMove: 28`, `minSpan: 24`, `minStep: 10`, `maxGap: 260` |
| `modifier` | `anchorMove: 10`, `anchorDelay: 180`, `panDelay: 70`, `maxTapTime: 430`, `maxTapMove: 28`, `panThreshold: 12` |
| `modifier.keyboard` | enabled, native prevention enabled, Shift modifier, Alt 2F, Ctrl 3F, Shift+Meta 4F, Meta rolling |
| `pressure` | `threshold: 0.01` |
| `wheel` | `enabled: true`, `preventDefault: false`, `zoomFactor: 0.0015`, `normalize: true`, `lineHeight: 16`, `pageHeight: 800` |
| `claim` | `enabled: true`, `threshold: 0.58`, `preventDefault: true`, `stopPropagation: false` |
| `intent` | `history: 12`, `enabled: true`, `prune: true`, `useListeners: true`, `events: null`, `releaseGuard: 180`, `releaseDistance: 34`, `sequenceWindow: 1200`, `sequenceMax: 8` |
| `dom` | touch/selection/callout guards enabled, `touchAction: 'none'`, `overscrollBehavior: 'contain'` |
| `edge` | `size: 32` |

### Input And Rect

Input modes:

| Mode | Native routes |
| --- | --- |
| `pointer` | Pointer events only. |
| `touch` | Touch events only. |
| `mouse` | Mouse events only. |
| `hybrid` | Touch and mouse. |
| `auto` | Pointer events when available, else hybrid. |

Rect modes:

| Mode | Behavior |
| --- | --- |
| `session` | Cache target rect for the current session. |
| `live` | Re-read rect when detail is built. |
| `static` | Cache until `refreshRect()`. |

Use `ignore` for native child controls:

```js
const hand = new HandTrick(surface, {
    ignore: target => target && target.closest && target.closest('button,input,textarea,select')
});
```

### Intent

Recognizer activation comes from explicit `intent.events` and registered listeners.

Most apps should leave `intent.events` unset:

```js
const hand = new HandTrick(surface);
hand.command('swipe:right', next);
```

That listener activates swipe. Use explicit intent lists only when commands are registered lazily, you need a strict whitelist, or you are building an inspector.

```js
const hand = new HandTrick(surface, {
    intent: {
        events: ['tap', 'tap>tap>swipe:right', 'swipe:right'],
        sequenceWindow: 900
    }
});
```

Manual intent lists can become stale. If a valid listener appears broken, check whether `intent.events` omitted that recognizer family.

### DOM Options

`dom` controls target styles and native guards:

```txt
enabled
target
active
touchAction
userSelect
webkitUserSelect
webkitTouchCallout
webkitUserDrag
webkitTapHighlightColor
selectionGuard
clearSelection
tapGuard
tapGuardDelay
tapGuardDistance
overscrollBehavior
```

String fields may be CSS values or `false` to skip applying that style.

```js
new HandTrick(surface, {
    dom: {
        touchAction: 'none',
        userSelect: 'none',
        overscrollBehavior: 'contain'
    }
});
```

Disable guards when the target intentionally contains selectable or editable text:

```js
new HandTrick(editor, {
    dom: {
        tapGuard: false,
        selectionGuard: false,
        touchAction: false,
        userSelect: false
    }
});
```

## Ownership And Native Input

HandTrick separates native ownership from semantic ownership.

| Mechanism | Purpose | Effect |
| --- | --- | --- |
| `ignore` | Keep native areas outside HandTrick processing. | Ignored input emits `input:ignored`. |
| Top-level suppression | Default `preventDefault` / `stopPropagation` behavior. | Runs while preparing native events. |
| `dom` | CSS interaction suppression and guards. | Prevents browser gestures/selection where configured. |
| Claim | Native event ownership after confidence threshold. | May call `preventDefault()` / `stopPropagation()`. |
| Consumed | Semantic gesture ownership. | Blocks release fallback such as tap, rolling tap, and swipe unless allowed. |
| `path.consume` | Path-specific semantic ownership. | Controls path/swipe coexistence. |

Most continuous commands consume once they commit. Pan, pinch, rotate, modifier pan, rolling, and press use consumption to prevent later release gestures from firing on the same session. Swipe consumes when it emits. Path uses `path.consume`.

Release guard prevents accidental one-finger gestures immediately after a multi-finger session ends. When one finger lifts later than the other after pinch/rotate, `intent.releaseGuard` and `intent.releaseDistance` suppress stray one-finger movement for a short window.

Tuning guide:

| Symptom | First Change | Why |
| --- | --- | --- |
| Tap misses on mobile | Raise `tap.maxMove`, then `tap.distance`. | Finger landings drift more than mouse clicks. |
| Double tap too easy | Lower `tap.interval` or `tap.distance`. | Multi-tap chains should stay nearby and recent. |
| Swipe fires during short drags | Raise `swipe.distanceByFingers[1]` and `swipe.intentDistance`. | Distance is a stronger guard than velocity alone. |
| Two-finger swipe feels too hard | Lower `swipe.distanceByFingers[2]`, not global `swipe.distance`. | Multi-finger travel is naturally shorter. |
| Pinch fires during two-finger pan | Raise `pinch.distance` or `pinch.dominance`. | Parallel movement should stay translation. |
| Rotate fires during pinch | Raise `rotate.angle`, `rotate.confidence`, and `rotate.dominance`. | Commands need stronger proof than visual previews. |
| One-finger swipes stop after adding paths | Use `path.consume: 'auto'`, move paths off one-finger, split surfaces, or raise path thresholds. | Eager paths consume on first segment. |
| Path commands trigger on shaky swipes | Raise `path.axisRatio`, `path.segmentDistance`, or `path.turnAngle`. | Paths need clean cardinal movement and real turns. |
| Rolling tap misses | Raise `rolling.maxDelay` slightly before lowering `rolling.minDelay`. | Too-low min delay collides with simultaneous multi-finger taps. |
| Native scroll leaks through | Keep `dom.touchAction: 'none'` and `claim.preventDefault: true`. | Browser gestures must be stopped early. |

Tune distance before velocity. Distance thresholds usually remove accidental gestures without making deliberate slow input feel broken.

## API Reference

### Static

```js
HandTrick.events
HandTrick.recognizers
HandTrick.families
HandTrick.groups
HandTrick.presets
HandTrick.defaults
HandTrick.create(target, options)
HandTrick.preset(nameOrInput, overrides)
HandTrick.region(pointOrEvent, region)
HandTrick.zone(point, { rows, cols })
HandTrick.matches(detail, criteria)
HandTrick.keyCombo(value)
HandTrick.path(value)
HandTrick.event(value)
HandTrick.isEvent(value)
```

| Helper | Returns |
| --- | --- |
| `HandTrick.defaults` | Deep copy of default options. |
| `HandTrick.events` | Finite event registry. |
| `HandTrick.recognizers` | Option-backed recognizer names. |
| `HandTrick.families` | Emitted event families. |
| `HandTrick.groups` | Event group map. |
| `HandTrick.presets` | Named preset builders. |
| `HandTrick.create(target, options)` | New instance. |
| `HandTrick.preset(name, overrides)` | Resolved partial options. |
| `HandTrick.region(pointOrEvent, region)` | Boolean region match. |
| `HandTrick.zone(point, { rows, cols })` | `{ row, col, rows, cols, index }`. |
| `HandTrick.matches(detail, criteria)` | Boolean criteria match. |
| `HandTrick.keyCombo(value)` | Canonical combo string. |
| `HandTrick.path(value)` | Canonical path pattern or empty string. |
| `HandTrick.event(value)` | Canonical selector or empty string. |
| `HandTrick.isEvent(value)` | Boolean selector validity. |

No current static `gestures` or `commonEvents` contract exists.

### Instance

```js
const hand = new HandTrick(target, options);
```

State fields:

```js
hand.target
hand.enabled
hand.destroyed
```

Methods:

| Method | Meaning |
| --- | --- |
| `on(type, handler, options)` | Register default-phase listener. |
| `on(type, criteria, handler, options)` | Register filtered default-phase listener. |
| `once(type, handler, options)` | Register one-shot listener. |
| `once(type, criteria, handler, options)` | Register filtered one-shot listener. |
| `off(type, handler)` | Remove one handler for a type. |
| `off(type)` | Remove listeners for a type. |
| `off()` | Remove all listeners. |
| `command(type, handler)` | Register command-phase listener. |
| `command(type, criteria, handler)` | Register filtered command listener. |
| `observe(type, handler)` | Register observe-phase listener. |
| `observe(type, criteria, handler)` | Register filtered observe listener. |
| `setOptions(options)` | Merge options/presets, update toggles, rebind native listeners when needed. |
| `enable()` | Enable runtime and apply target styles. |
| `disable()` | Disable runtime, cancel active session, release target styles. |
| `cancel(reason, extra)` | Cancel active session. |
| `resetTaps()` | Clear tap chain memory. |
| `resetSequences()` | Clear released sequence memory and pending direct emits. |
| `reset(options)` | Reset taps and/or sequences. |
| `refreshRect()` | Clear cached rect data. |
| `getState()` | Runtime state snapshot. |
| `getIntentState()` | Intent/pruning state snapshot. |
| `destroy()` | Unbind, restore styles, clear state. Safe to call twice. |

## Recipes

### Media Tap Zones

```js
const hand = new HandTrick(video, 'media');

hand.command('tap', { region: 'left' }, previous);
hand.command('tap', { region: 'center' }, togglePlay);
hand.command('tap', { region: 'right' }, next);
hand.command('tap:2x', { region: 'left' }, rewind);
hand.command('tap:2x', { region: 'right' }, forward);
hand.command('swipe:up', { startRegion: 'bottom' }, showControls);
```

### Same-Side Double Tap

```js
hand.command('tap:2x', {
    grid: { rows: 3, cols: 3, col: 2 },
    tapStartGrid: { rows: 3, cols: 3, col: 2 }
}, rightSideDouble);
```

### Path With Preview

```js
hand.observe('path', { path: 'down>right' }, preview);
hand.command('down>right', commit);
```

### Wheel Zoom

```js
const hand = new HandTrick(surface, ['viewer', {
    wheel: { preventDefault: true, zoomFactor: 0.0015 }
}]);

hand.command('wheel:zoom', event => {
    scale = clamp(scale * event.scale, 0.35, 4);
});
```

### Desktop Multi-Finger Routes

```js
hand.command('tap', { fingers: 2 }, toggleFit);
hand.command('swipe:left', { fingers: 3, fingerSource: 'keyboard' }, previousGroup);
```

### Modifier Tap From Top Left

```js
hand.command('tap:mod', {
    modifierRegion: 'top-left',
    modifierArea: 'edge',
    modifierFingers: 1,
    actionFingers: 1,
    totalFingers: 2
}, alternatePick);
```

### Sequence With First-Step Criteria

```js
hand.command('tap>swipe:left', {
    sequence: [
        {
            fingers: 3,
            fingerSource: 'keyboard',
            keyboardRole: 'threeFingers'
        }
    ]
}, command);
```

## Examples

The example hub is [examples/index.html](examples/index.html).

| File | Focus |
| --- | --- |
| [basic.html](examples/basic.html) | Tap, swipe, pinch, rotate, region, source. |
| [media.html](examples/media.html) | Media preset, tap zones, tap-hold pan, swipe, pinch, rotate override. |
| [regions.html](examples/regions.html) | 3x3 zones, halves, custom grid lookup, start-region routing. |
| [keyboard.html](examples/keyboard.html) | Alt/Ctrl/Shift+Meta roles, Meta rolling, Shift modifier drag. |
| [module.html](examples/module.html) | Direct ESM import and local/CDN module split. |
| [rolling.html](examples/rolling.html) | Rolling tap versus simultaneous multi-finger tap. |
| [sequences.html](examples/sequences.html) | Exclusive released gesture sequences. |
| [path.html](examples/path.html) | Bare path commands, two-finger paths, circle and arc paths, path criteria. |
| [rotate.html](examples/rotate.html) | Rebased two-finger rotate. |
| [wheel.html](examples/wheel.html) | Normalized wheel zoom. |
| [thresholds.html](examples/thresholds.html) | Live threshold tuning. |
| [router.html](examples/router.html) | Runtime selector, method, and criteria routing. |
| [advanced.html](examples/advanced.html) | Combined routing for modifier, path, wheel, rotate, regions, rolling, sequences. |
| [inspector/index.html](inspector/index.html) | Event stream, payload inspection, event toggles, live tuning, router panel. |

Most examples use `../handtrick.js`. Module examples use `../handtrick.mjs`. Published CDN module pages should use `handtrick.min.mjs`.

## Development

Consumer runtime has no dependencies. Local package scripts require Node `>=24` as declared in `package.json`.

Common checks:

```sh
npm test
npm run test:min
```

Build command for maintainers:

```sh
npm run build
```

`npm run build` assembles `src/` into `handtrick.js` and `handtrick.mjs`, then writes `handtrick.min.js` and `handtrick.min.mjs` from the same source graph.

When changing public behavior, keep these in sync:

- `src/`
- generated runtimes
- `index.d.ts`
- examples
- tests
- README/docs

Contributor workflow lives in [CONTRIBUTING.md](CONTRIBUTING.md). Runtime internals live in [ARCHITECTURE.md](ARCHITECTURE.md).

## Author

[Reza Jelodar](https://jelodar.com/)

## License

MIT.
