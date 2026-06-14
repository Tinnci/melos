# Notation API Comparison

Date: 2026-06-14

This note compares Melos API boundaries with source-level patterns in mature
open-source notation projects. The goal is not to copy their object models, but
to identify which abstractions survive real rendering, playback, selection, and
conversion pressure.

## Source References

Local research copies live under `.codex-research/notation-api-sources/` and
are intentionally ignored by git.

| Project | Source area inspected | API lesson |
| --- | --- | --- |
| VexFlow | `src/voice.ts`, `src/formatter.ts`, `src/factory.ts` | Low-level engraving works best when voices, tick contexts, and formatting passes are explicit objects. |
| OpenSheetMusicDisplay | `src/OpenSheetMusicDisplay/OpenSheetMusicDisplay.ts` | A high-level facade is useful, but semantic and graphical score object graphs remain separate. |
| abcjs | `src/api/abc_tunebook_svg.js`, `src/write/README.md`, `src/data/abc_tune.js` | Browser APIs benefit from compact parse/render calls, but selection, wrapping, animation, and synth need retained visual/timing indexes. |
| LilyPond | `lily/`, `scm/` in the earlier LaTeX research copy | Compiler-style pipelines keep semantic timing, engraving objects, spacing, and output stages separate. |

## API Shapes Observed

VexFlow is a low-level rendering toolkit. A caller builds notes and voices,
then passes voices through `Formatter`, which creates `TickContext` alignment
objects before assigning positions. This gives strong control, but the caller
owns orchestration and must understand the engraving model.

OpenSheetMusicDisplay is an application-level MusicXML renderer. Its public
API allows `load()` and `render()`, while internal state still separates parsed
`MusicSheet` data from `GraphicalMusicSheet`. This is a useful pattern for
Melos Studio, but too coarse for core package APIs.

abcjs is optimized for web embedding. `renderAbc()` hides parser and engraver
setup, but the resulting tune keeps engraver/selectable/timing objects for
interaction and audio. The lesson for Melos is that convenient facades still
need stable indexes behind them.

LilyPond is closer to a compiler than a UI library. Its strength is pass
separation: source parsing, music interpretation, grob creation, spacing, and
output do not collapse into one API. Melos should keep this discipline while
remaining browser-native.

## Melos Gap Found

Before this update, Melos had a normalized core timeline, but consumers still
had to choose between:

- building a full score timeline and manually scanning nested arrays;
- rebuilding per-measure timelines in loops;
- resolving source content separately through event refs;
- treating event ids as unique even though imported real-world sources may not
  guarantee that.

That made `@melos/player`, `@melos/renderer`, and `@melos/web` drift toward
consumer-specific traversal code. It also made future hit testing and selection
APIs harder, because every layer could invent a different event lookup model.

## Decision

Keep timeline construction and timeline querying separate:

- `buildScoreTimeline()` and `buildMeasureTimeline()` remain pure timeline
  construction APIs.
- `indexScoreTimeline()` indexes an existing timeline without rebuilding it.
- `buildScoreTimelineIndex()` is the convenience facade for callers that want
  both steps.
- Query helpers hide map key formats and return arrays for id lookup, because
  duplicate ids must be represented rather than overwritten.

This mirrors the useful parts of the references:

- VexFlow's explicit alignment contexts, without adopting its renderer object
  model in core.
- OSMD's separate semantic and graphical score objects, without making core a
  DOM-facing facade.
- abcjs's retained visual/timing data for interaction and synth, without
  mutating parsed source objects.
- LilyPond's pass separation, adapted to TypeScript packages.

## Next API Work

- Add a renderer `GlyphPlanIndex` that mirrors the timeline index for hit
  testing, cursor lookup, and selection boxes.
- Add structured converter diagnostics that can reference timeline paths after
  import.
- Add lyric and melisma spans to core as semantic ranges instead of renderer
  annotations.
- Consider moving editor mutation helpers behind a score-edit command API once
  insert/delete/update behavior needs stronger invariants.
