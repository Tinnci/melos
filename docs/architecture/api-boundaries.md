# API Boundaries

Date: 2026-06-14

This document defines package responsibilities and dependency direction for
Melos. It is the source of truth for API layering.

## Principles

Mature notation systems point to the same separation:

- LilyPond separates timing/context, engraving objects, spacing, and output.
- MusiXTeX separates fixed and scalable spacing before final layout.
- PMX shows the maintenance cost of a monolithic converter/engraver.
- M-Tx shows lyrics and melisma need semantic state.
- Gregorio shows specialist notation should be isolated by adapter/plugin.
- LyLuaTeX shows external compilers belong in optional tooling.

Melos applies those lessons with a browser-native TypeScript stack.

## Package Boundaries

| Package | Owns | Must not own |
| --- | --- | --- |
| `@melos/core` | Schema, rhythm math, normalized timeline, semantic diagnostics | DOM state, SVG coordinates, source-format parser objects |
| `@melos/mnx` | MNX JSON parsing and validation policy | Duplicate duration math, renderer layout, importer quirks |
| `@melos/converter` | MusicXML parsing, source-specific ambiguity, conversion diagnostics | Canonical rules that apply to all scores |
| `@melos/mei` | MEI parsing and mapping | Common renderer or playback logic |
| `@melos/renderer` | Layout analysis, glyph planning, collision diagnostics, preview backends | Format parsing, editor mutations, audio scheduling |
| `@melos/player` | Audio scheduling from semantic timeline events | Independent score traversal and rhythm math |
| `@melos/web` | UI state, editing commands, selection, persistence, user feedback | Notation semantics when a core API exists |

## Dependency Direction

```text
@melos/core
  -> @melos/mnx
  -> @melos/converter
  -> @melos/mei
  -> @melos/renderer
  -> @melos/player
  -> @melos/web
```

`@melos/core` must not import any other Melos package.

`@melos/renderer` may depend on `@melos/core`; it must not depend on
`@melos/converter`, `@melos/mei`, `@melos/player`, or `@melos/web`.

`@melos/web` may orchestrate all packages, but should delegate notation
semantics to lower-level APIs.

## Current Corrections

The current work corrected these layering issues:

- `@melos/core` now exposes `buildScoreTimeline()` and
  `buildMeasureTimeline()` with validation policy options.
- `@melos/renderer` layout analysis consumes the core timeline for rhythm
  data.
- `@melos/mnx` validator consumes the core timeline instead of maintaining its
  own duration table.
- `@melos/mnx` still owns validation policy such as whether pickup underfill is
  allowed by default.
- Pitch bound checks in `@melos/mnx` now recurse through nested grace/tuplet
  content.

## Public APIs

Core timeline:

```ts
buildScoreTimeline(score, options?)
buildMeasureTimeline(score, partIndex, measureIndex, options?)
resolveTimeSignatureForMeasure(score, measureIndex, measureNumber?)
```

Timeline policy:

```ts
interface TimelineBuildOptions {
  includeRhythmDiagnostics?: boolean;
  allowPickupMeasure?: boolean;
  rhythmEpsilon?: number;
  fallbackBeats?: number;
}
```

MNX validation:

```ts
MnxValidator.validate(score, options?)
```

MNX validation policy:

```ts
interface MnxValidationOptions {
  allowPickupMeasure?: boolean;
  includeRhythmDiagnostics?: boolean;
}
```

## Remaining Risks

- Web rhythm status still has local summary logic.
- Player scheduling still traverses score content directly.
- Converter diagnostics are not yet structured.
- Renderer still couples glyph planning and SVG serialization.
- Lyrics and melisma are not yet core semantic spans.

