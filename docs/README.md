# Melos Documentation

This directory separates decisions from evidence:

- Architecture docs define package boundaries and implementation direction.
- Research docs record source evidence from external projects.
- Capability docs track product gaps and fixture priorities.

## Reading Order

1. `architecture/api-boundaries.md`: package ownership, dependency direction,
   and public API boundaries.
2. `architecture/rendering-pipeline.md`: renderer phases, spacing model, and
   glyph-plan migration.
3. `research/notation-capability-matrix.md`: current capability status,
   priority gaps, and fixture targets.

## Research Notes

- `research/latex-music-rendering.md`: source-code lessons from MusiXTeX, PMX,
  M-Tx, LilyPond, LyLuaTeX, and Gregorio.
- `research/notation-api-comparison.md`: source-level API comparison with
  VexFlow, OpenSheetMusicDisplay, abcjs, and LilyPond.
- `research/rendering-engine-comparison.md`: rendering pipeline lessons and
  Melos-specific abstraction plan from VexFlow, OpenSheetMusicDisplay, abcjs,
  and LilyPond source code.

Keep implementation plans out of research notes unless they are direct
takeaways from the source evidence.
