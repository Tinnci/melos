# Rendering Engine Comparison

Date: 2026-06-14

This note compares Melos renderer layering against inspected source code from
established engraving/rendering projects. Local source copies are under
`.codex-research/` and are ignored by git.

## Source Evidence

| Project | Inspected source | Observed abstraction |
| --- | --- | --- |
| VexFlow | `.codex-research/notation-api-sources/vexflow/src/formatter.ts`, `tickcontext.ts`, `svgcontext.ts` | `Formatter` builds `TickContext` alignment state before rendering to a backend context. The useful idea is explicit timing columns and inspectable x placement state. |
| OpenSheetMusicDisplay | `.codex-research/notation-api-sources/opensheetmusicdisplay/src/OpenSheetMusicDisplay/OpenSheetMusicDisplay.ts`, `MusicalScore/Graphical/GraphicalMusicSheet.ts`, `MusicSheetCalculator.ts`, `MusicSheetDrawer.ts` | Public `load()` / `render()` facade hides a separate semantic sheet, graphical sheet, calculator, and drawer. The useful idea is separating model, graphical geometry, and backend drawing. |
| abcjs | `.codex-research/notation-api-sources/abcjs/src/api/abc_tunebook_svg.js`, `src/write/engraver-controller.js`, `src/write/draw/voice.js`, `types/index.d.ts` | Web facade returns retained engraving state, including selectables and absolute elements. The useful idea is retaining visual indexes for selection and interaction. |
| LilyPond | `.codex-research/latex-music-sources/lilypond/lily/*-engraver.cc`, `accidental-placement.cc`, `spacing-interface.cc`, `spacing-engraver.cc`, `spacing-loose-columns.cc`, `slur-engraver.cc` | Compiler-like engravers create graphical objects, spacing code solves constraints, and stencils/backends emit output. The useful idea is pass separation plus explicit collision/spacing objects. |

## Difference From Melos Today

Melos already has the semantic side in better shape than its drawing side:

- `@melos/core` owns rhythm, tuplets, grace timing, inherited meter, and
  timeline indexes.
- `@melos/renderer` has `MeasureLayoutAnalysis`, `RenderPlan`, and
  `MeasureSpacing`, similar in spirit to VexFlow tick contexts and OSMD
  graphical measure state.
- `GlyphPlanner` resolves common SMuFL names, but most geometry and SVG
  primitives still live in `Renderer`.
- There is no collision pass comparable to LilyPond accidental placement,
  skyline spacing, or OSMD bounding boxes.
- Interaction metadata exists in SVG output, but there is no retained visual
  index equivalent to abcjs selectables.

## Defects To Fix

1. Renderer state was hard to inspect without parsing SVG.
   `Renderer.createPipeline(score)` now exposes input summary, stage statuses,
   `RenderPlan`, `MeasureLayoutAnalysis`, `MeasureSpacing`, and SVG output
   dimensions.
2. `Renderer` still mixes orchestration, geometry, fallback glyph shapes,
   hitboxes, curves, and SVG serialization.
3. Collision policy is implicit. Accidentals, dots, articulations, lyrics,
   dynamics, pedals, ottavas, ties, and slurs need explicit boxes/spans before
   they can be resolved predictably.
4. The backend layer is helper-level. A real `RenderDocument` / `RenderElement`
   layer should become the contract that SVG, future Canvas/PDF, and snapshot
   tests consume.

## Better Abstraction Direction

The most defensible next layering is:

```text
Score
  -> core timeline
  -> MeasureLayoutAnalysis
  -> RenderPlan
  -> MeasureSpacing
  -> GlyphPlan / BoxPlan / SpanPlan
  -> CollisionResolver
  -> RenderDocument
  -> SvgRenderBackend
```

This follows the common pattern across the inspected projects:

- VexFlow supports explicit formatter state before backend drawing.
- OSMD separates semantic and graphical score objects.
- abcjs keeps selectable visual structures for browser workflows.
- LilyPond separates engraving objects, spacing, collision, and output stencils.

For Melos, the right tradeoff is not to import those engines. The browser editor
needs control over MNX data, selection, and future editing commands. The better
path is to keep dependencies small and gradually move `Renderer` internals into
named passes with typed intermediate outputs.

## Milestone Plan

GitHub milestone: `Renderer pipeline abstraction`.

Planned batches:

1. Pipeline inspection API. Done: `Renderer.createPipeline()` and
   `createRenderPipeline()`.
2. `RenderDocument` and structured `RenderElement` union for text, SMuFL glyph,
   path, line, rect, group, and hitbox output. Done for the contract:
   `SvgRenderBackend` now
   serializes structured documents and `Renderer.createDocument()` exposes the
   current document before SVG output.
3. Move stave lines, barlines, measure hitboxes, event hitboxes, and SMUFL text
   from raw strings to structured elements. Started for SMuFL text, custom
   dynamic text, event hitboxes, measure hitboxes, and groups.
4. Add box/span planning for accidentals, dots, articulations, dynamics,
   pedals, ottavas, ties, slurs, and tremolos. Done as conservative metadata in
   `documentPlanner.ts`.
5. Add a simple collision resolver and diagnostics:
   `collision-unresolved`, `span-endpoint-missing`, and `measure-overfull`.
   Done as detection-only diagnostics in `collisionResolver.ts`.
6. Add backend-neutral snapshot tests for `RenderDocument` before SVG output.
   Done for boxes, spans, endpoint diagnostics, collision diagnostics, and
   measure overflow.

## Milestone Closeout

Milestone `Renderer pipeline abstraction` now has the minimum complete
abstraction chain:

```text
Score
  -> core timeline
  -> MeasureLayoutAnalysis
  -> RenderPlan
  -> MeasureSpacing
  -> RenderDocument metadata boxes/spans
  -> Collision diagnostics
  -> SvgRenderBackend
```

Remaining renderer work should move to follow-up milestones:

- Replace raw SVG bridges with structured `RenderElement` primitives for
  staves, barlines, stems, flags, beams, fallback noteheads, and curves.
- Turn collision diagnostics into layout-mutating placement passes for
  accidentals, lyrics, articulations, dynamics, and spans.
- Add Canvas/PDF/test backends only after `RenderDocument` no longer depends on
  raw SVG for core primitives.

## Follow-Up Milestones

GitHub milestone: `Renderer structured primitive migration` (#2).

Scope:

1. Move low-risk line/path/rect primitives behind `SvgRenderBackend` helpers.
   Started: staff lines, barline line segments, ending brackets, jump text,
   ottava lines, multimeasure rests, stems, flags, beams, ledger lines,
   tremolos, rest bars/paths, curves, and pedal bracket lines now use
   structured backend helpers.
2. Add missing primitive element types for circle, ellipse, polygon, and
   polyline before migrating repeat dots and fallback notehead shapes.
3. Reduce the `RenderDocument` raw SVG bridge by returning structured
   `RenderElement` children from more renderer paths.
4. Keep `Renderer.render(score): string` stable until structured output reaches
   parity.
