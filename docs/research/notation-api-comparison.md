# Notation API Comparison

Date: 2026-06-14

This note records source-level API lessons from browser and engraving
libraries. It supports the package decisions in
`docs/architecture/api-boundaries.md`; it is not the backlog.

## Sources Inspected

Local research copies live under `.codex-research/notation-api-sources/` and
are ignored by git.

| Project | Source area inspected | Useful pattern |
| --- | --- | --- |
| VexFlow | `src/voice.ts`, `src/formatter.ts`, `src/factory.ts` | Explicit low-level objects for voices, tick contexts, and formatting passes. |
| OpenSheetMusicDisplay | `src/OpenSheetMusicDisplay/OpenSheetMusicDisplay.ts` | High-level `load()` / `render()` facade over separate semantic and graphical score objects. |
| abcjs | `src/api/abc_tunebook_svg.js`, `src/write/README.md`, `src/data/abc_tune.js` | Compact parse/render API plus retained visual, selection, timing, and synth indexes. |
| LilyPond | Earlier LaTeX research copy | Compiler-style pass separation for source, timing, engraving objects, spacing, and output. |

## API Lessons

VexFlow favors control. Callers assemble notes and voices, then pass them
through formatter objects that create alignment contexts before assigning x
positions. This is powerful for a renderer backend, but too low-level for
Melos core APIs.

OpenSheetMusicDisplay favors a product facade. `load()` and `render()` are
convenient public entry points, while `MusicSheet` and `GraphicalMusicSheet`
remain separate internally. Melos Studio can expose similar convenience without
collapsing source parsing, semantics, and graphics into one package.

abcjs favors web embedding. `renderAbc()` hides parser and engraver setup, but
the resulting tune keeps visual and timing data for selection, animation, and
audio. Melos should keep that retained-index idea while avoiding mutation of
parsed source objects.

LilyPond favors compiler passes. The relevant lesson is pass separation, not an
external dependency: semantic timing, engraving objects, spacing, and output
should stay distinct.

## Rendering Pipeline Differences

| Project | Rendering pipeline shape | Melos implication |
| --- | --- | --- |
| VexFlow | Caller-created notes/voices -> `Formatter` -> `TickContext` x positions -> backend drawing | Keep low-level geometry state explicit and inspectable. |
| OpenSheetMusicDisplay | MusicXML -> `MusicSheet` -> `GraphicalMusicSheet` via calculator -> drawer | Separate semantic score data from graphical geometry. |
| abcjs | Parser tune -> abstract engraving elements -> layout assigns coordinates -> draw creates SVG/selectables | Add a retained plan between parsing/layout and SVG output. |
| LilyPond | Source -> music interpretation -> engraving objects -> spacing -> output backend | Keep passes composable instead of embedding all decisions in one renderer method. |

## Melos Decision Supported

The comparison supports a small query layer between semantic data and
consumers:

- Timeline builders create normalized timing data.
- Timeline indexes provide lookup by measure, sequence, id, and path.
- Render plans expose systems and measure geometry before SVG serialization.
- Measure spacing exposes timeline-aligned event columns before glyph drawing.
- Renderers, players, and editor selection use indexes instead of inventing
  local traversal rules.
- Duplicate event ids are represented as multiple matches rather than silently
  overwritten.

See `docs/architecture/api-boundaries.md` for the current API surface and
`docs/research/notation-capability-matrix.md` for priority gaps.
