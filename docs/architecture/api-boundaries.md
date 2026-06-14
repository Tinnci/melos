# API Boundaries

Date: 2026-06-14

This document defines package responsibilities and dependency direction for
Melos. It is the source of truth for API layering.

## Design Rules

Source evidence lives in the research notes. The architecture decision for
Melos is:

- `@melos/core` owns canonical semantics, rhythm math, and timeline queries.
- Source formats are adapters into the core score model.
- Rendering and playback consume core timeline data instead of traversing score
  content independently.
- UI packages orchestrate workflows but delegate notation semantics downward.
- External engines are optional comparison/export tooling, not runtime
  dependencies for the browser editor.

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

## Implemented Shared APIs

The current shared surface is intentionally small:

- `@melos/core` exposes normalized timeline construction and timeline indexes.
- `@melos/mnx`, `@melos/renderer`, `@melos/player`, and `@melos/web` consume
  the core timeline for rhythm-sensitive behavior.
- `@melos/mnx` keeps validation policy, such as pickup-measure tolerance, while
  reusing core rhythm diagnostics.
- `@melos/web` uses the timeline index for selection reads, including duplicate
  event ids scoped by part.

## Public APIs

Core timeline:

```ts
buildScoreTimeline(score, options?)
buildMeasureTimeline(score, partIndex, measureIndex, options?)
buildScoreTimelineIndex(score, options?)
indexScoreTimeline(timeline)
getTimelineMeasure(index, selector)
getTimelineEventsForMeasure(index, selector)
getTimelineEventsForSequence(index, selector)
getTimelineEventsById(index, id)
getTimelineEventByPath(index, path)
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

Player scheduling:

```ts
createPlaybackSchedule(score, options?)
```

## Remaining Risks

- Converter diagnostics are not yet structured.
- Renderer still couples glyph planning and SVG serialization.
- Lyrics and melisma are not yet core semantic spans.
