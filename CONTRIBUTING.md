# Contributing

This file is for people changing HandTrick internals. The README is for app developers using the runtime. [ARCHITECTURE.md](ARCHITECTURE.md) explains the runtime model in detail.

HandTrick ships generated runtime files, but source lives in `src/`. Behavior changes start in source, then build output, declarations, docs, examples, and tests are brought back into agreement.

## Contributor Rules

- Keep public selectors canonical and deterministic.
- Prefer small helpers over broad rewrites.
- Change source in `src/`; do not patch generated runtimes by hand for behavior.
- Keep generated output in sync: `src/` -> `handtrick.js`, `handtrick.mjs`, `handtrick.min.js`, `handtrick.min.mjs`.
- Update `index.d.ts` and README when a public event, selector, option, payload field, helper, or entry point changes.
- Update examples when a public pattern or gotcha changes.
- Add a regression for every behavior fix. If the bug was browser-shaped, include pointer/touch/native-event coverage where practical.
- Do not remove existing events, listener APIs, aliases, payload fields, or options unless explicitly required.

## Contract Model

A change is incomplete until affected contracts agree:

| Contract | Files | What must stay true |
| --- | --- | --- |
| Runtime behavior | `src/`, generated runtimes, `test/` | Same gesture input produces intended semantic events across readable and minified builds. |
| Public API | `README.md`, `index.d.ts`, examples, inspector | Selectors, options, criteria, payload fields, helpers, and entry points are documented with canonical names. |
| Package shape | `package.json`, generated entries, `scripts/build.js` | Browser global, CommonJS, direct ESM, minified global, and minified ESM remain loadable. |

Treat bug fixes as contract updates, not isolated patches. If recognizer overlap changes, update tests and docs even when the code change is one threshold.

## Normal Workflow

1. Define the observable behavior in consumer terms.
2. Find the owner in `src/`. Use [ARCHITECTURE.md](ARCHITECTURE.md) for source order and recognizer ownership.
3. Add or adjust focused tests before broad rewrites.
4. Edit `src/` and any public docs/types/examples affected by the change.
5. Run `npm run build` when runtime source changed.
6. Run `npm test`; run `npm run test:min` when selector parsing, exports, minification, generated output, or package shape is touched.
7. Inspect generated entries only to confirm wrapper/export behavior.

Generated files are artifacts. If a generated file differs because `src/` changed, keep it. If only generated files changed, rebuild from source or revert your artifact-only edit.

## Source Order

The runtime is built by concatenating sections, not by module imports. Section order is implementation:

| Section | Role |
| --- | --- |
| `core/00-foundation.js` | Constants, default keyboard roles, event registry helpers. |
| `core/01-events.js` | Public event groups and recognizer registries. |
| `core/02-defaults.js` | Default options, including recognizer thresholds and ownership flags. |
| `core/03-aliases.js` | Motion candidate recognizer groups. |
| `core/04-math.js` | Direction, axis, geometry, and numeric helpers. |
| `core/05-selectors.js` | Selector parser, specificity, sequence/path detection. |
| `core/06-state.js` | Option resolution, merge behavior, state helpers. |
| `core/07-keyboard.js` | Keyboard combo normalization and role matching. |
| `core/08-matching.js` | Path tokenization, path matching, sequence matching primitives. |
| `core/09-regions.js` | Region, grid, edge, and zone helpers. |
| `core/10-presets.js` | Named preset construction. |
| `class/00-setup.js` to `class/11-detail.js` | Constructor, listeners, session lifecycle, recognizers, dispatch, payload assembly. |
| `core/11-static.js` | Static API attached after the class exists. |

When adding a source file, update `scripts/build.js` and verify all generated entries.

## Public API Changes

A public API change includes any event name, selector grammar, criteria field, option shape, payload field, static helper, entry point, preset behavior, example pattern, or declaration update.

Checklist:

- Update `src/`.
- Update `index.d.ts`.
- Update README examples, tables, and gotchas.
- Update focused examples or inspector labels if users learn the behavior there.
- Add tests for source and minified behavior when parsing, exports, or compression could matter.
- Regenerate all runtime entries with `npm run build`.
- Preserve existing aliases unless removal was explicitly requested.

Public docs should name only supported canonical selectors. Legacy-looking names may remain accepted only when already part of the explicit compatibility contract.

## Test Selection

Test the behavior, not the private helper name. Prefer small deterministic clock-driven tests.

| Change type | Minimum tests to inspect or add |
| --- | --- |
| Selector grammar, aliases, specificity | `naming-grammar.test.js`, `api-dx.test.js`, focused selector cases. |
| Intent pruning or listener activation | `intent-pruning.test.js`, plus one app-shaped listener-derived regression. |
| Swipe, release fallback, finger count | `swipe-directions.test.js`, `release-guard.test.js`, `edge-scenarios.test.js`. |
| Path recognition or path arbitration | `path-native.test.js`, `path-consume.test.js`, and `swipe-directions.test.js` when one-finger swipe can overlap. |
| Tap chains and released sequences | `sequence.test.js`, `handtrick.test.js`, minified parity when aliases are involved. |
| Modifier or keyboard substitutes | `modifier-position-keyboard.test.js`, `keyboard-substitute.test.js`. |
| Payload fields or criteria | `contract.test.js`, `api-dx.test.js`, a direct `HandTrick.matches` case if useful. |
| DOM/native suppression | `lifecycle-edge.test.js`, `path-native.test.js`, browser-shaped helper routes. |
| Distribution or build output | `npm run build`, syntax checks for generated entries, `npm run test:min`, package dry run. |

Regression shape for recognizer overlap:

1. Register the same listener mix that triggered the bug.
2. Use the same finger count and approximate threshold distances.
3. Assert the exact event list, not just that one handler ran.
4. Include a competing gesture negative when double-fire is possible.

For browser-shaped bugs, prefer public methods that mirror native routes: `pointerDown`, `touchStart`, `mouseDown`, `wheel`.

## Build And Verification

After runtime source changes:

```sh
npm run build
node -c handtrick.js
node -c handtrick.mjs
node -c handtrick.min.js
node -c handtrick.min.mjs
npm test
npm run test:min
```
