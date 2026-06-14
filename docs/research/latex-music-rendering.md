# LaTeX Music Rendering Source Notes

Date: 2026-06-14

This note records what was learned from the source code of common TeX/LaTeX
music notation projects. It is intentionally a research note, not an
implementation plan. Melos remains a browser-native TypeScript renderer with
MNX-style JSON as its canonical model.

## Source Cache

Sources were downloaded under:

`C:\Users\shiso\melos\.codex-research\latex-music-sources`

The cache contains MusiXTeX, PMX, M-Tx, LilyPond, LyLuaTeX, and
GregorioTeX/Gregorio. It is ignored by git and should not be committed unless
there is a separate license review and vendoring decision.

## Comparison Summary

| Project | Architecture | What Melos should reuse | What Melos should avoid |
| --- | --- | --- | --- |
| MusiXTeX | TeX macros plus `musixflx` multi-pass spacing | Hard vs soft spacing contributions | TeX macro state and multi-pass TeX runtime |
| PMX | ASCII DSL preprocessor that emits MusiXTeX | Edge-case inventory for beams, slurs, ties, graces, voices | Monolithic stateful preprocessor design |
| M-Tx | Higher-level preprocessor over PMX | Lyrics and melisma as semantic state | Treating lyrics as late-stage text decorations |
| LilyPond | Full compiler: parser, contexts, engravers, grobs, spacing, backends | Timed event/context pipeline, paper columns, springs/rods, regression fixtures | Required external compiler in web preview |
| lilypond-book | Document preprocessor invoking LilyPond | Optional comparison/export bridge pattern | Regex document parsing as app architecture |
| LyLuaTeX | LuaLaTeX bridge invoking LilyPond with cache | Content-addressed external artifact cache | Shell escape in normal editor preview |
| Gregorio | Domain-specific chant compiler | Isolated specialist notation adapters | Mixing chant rules into common notation core |

## Evidence From Source

MusiXTeX explicitly separates fixed and scalable spacing:

- `musixtex.tex:2460-2463`: soft material is scalable, hard material is
  absolute.
- `musixflx.lua:374-378`: `musixflx` reads bar-length contributions as hard or
  soft records.

PMX is valuable mostly as an edge-case list. Its change history names cases
that should become Melos fixtures: line-break slurs and ties, beams over
barlines, staff-crossing beams, grace spacing, graces inside tuplets, 24 voices,
and simultaneous beams.

M-Tx source focuses heavily on lyric state. `lyrics.c` tracks beam/slur
melisma markers and reports invalid melisma endings. This supports modeling
lyrics and melisma in `@melos/core` before renderer placement.

LilyPond is the strongest architecture reference:

- `paper-column-engraver.cc` creates musical and non-musical columns and stores
  measure length at measure starts.
- `spacing-spanner.cc` generates pair spacing, merges spacing wishes, adjusts
  grace spacing, and applies spring/rod constraints.
- `input/regression` provides many small notation fixtures.

LyLuaTeX shows that external render bridges need careful quoting, executable
detection, content hashing, and failure reporting. That belongs in optional
developer tooling, not the web bundle.

Gregorio parses `gabc`, builds a chant score, applies chant-specific fixes, and
then writes GregorioTeX. The relevant lesson is plugin isolation for specialist
notation domains.

## Melos Takeaways

1. Keep `@melos/core` as the canonical semantic layer.
2. Keep MusicXML, MEI, and future dialects as adapters.
3. Use a normalized timeline before layout.
4. Separate hard, soft, and overlay spacing contributions before drawing.
5. Keep SMuFL glyph resolution separate from layout and parsing.
6. Treat external engines as optional comparison tools only.
7. Grow fixtures from real edge cases, with license review before copying
   upstream tests.

See `docs/architecture/api-boundaries.md` for package boundaries and
`docs/architecture/rendering-pipeline.md` for the renderer implementation plan.

