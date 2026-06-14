# Rendering Pipeline

Date: 2026-06-14

This document defines the target renderer pipeline. Package dependency rules
are in `docs/architecture/api-boundaries.md`; capability status is in
`docs/research/notation-capability-matrix.md`.

## Renderer State

Implemented:

- `Renderer.render(score)` serializes SVG preview output.
- `Renderer.createPlan(score)` exposes system and measure geometry before SVG
  serialization.
- `Renderer.createPipeline(score)` exposes the current input summary, stage
  statuses, render plan, per-measure layout analysis, per-measure spacing, and
  output contract for debugging and tests.
- `renderer/src/plan.ts` wraps measures into systems from layout analysis.
- `renderer/src/spacing.ts` maps core timeline events to measure columns and x
  positions.
- `renderer/src/pipeline.ts` records the observable current pipeline without
  forcing callers through SVG serialization.
- `renderer/src/glyphPlanner.ts` resolves common score content to planned
  SMuFL glyph names.
- `renderer/src/svgBackend.ts` owns SMuFL glyph escaping and SVG text emission
  helpers.
- `renderer/src/smufl.ts` resolves common SMuFL glyph names.
- `renderer/src/layout.ts` analyzes hard, soft, and overlay spacing
  contributions from `@melos/core` timeline data.

Still coupled:

- Curves, hitboxes, primitive paths, fallback notehead shapes, stems, flags,
  beams, and SVG string serialization live mostly in `Renderer`.
- Collision avoidance is not a separate pass.
- SVG is still the only backend, and the current SVG backend is helper-level
  rather than a full `RenderDocument` serializer.

## Target Pipeline

```text
Score
  -> core normalized timeline
  -> MeasureLayoutAnalyzer
  -> RenderPlan
  -> SpacingSolver
  -> GlyphPlanner
  -> CollisionResolver
  -> RenderBackend
```

## Phase Contracts

| Phase | Responsibility | Status |
| --- | --- | --- |
| Core timeline | Timed event refs, inherited meter, tuplets, grace timing, rhythm diagnostics | Started in `@melos/core` |
| Measure layout analysis | Hard/soft/overlay spacing contributions | Started in `@melos/renderer` |
| Render plan | Systems, measure x/y/width, content ranges, layout diagnostics | Started in `@melos/renderer` |
| Spacing solver | Event columns and x positions from timeline beats | Started in `@melos/renderer` |
| Glyph planner | SMuFL glyph names for clefs, noteheads, rests, accidentals, dynamics, articulations, pedals | Started in `GlyphPlanner`; geometry still mostly in `Renderer` |
| Collision resolver | Accidentals, dots, lyrics, articulations, dynamics, spans | Missing |
| Render backend | SVG/canvas/PDF/test serialization | Started in `SvgRenderBackend`; many primitives remain inline in `Renderer` |

## Current Inputs And Outputs

Renderer input:

```ts
Renderer.render(score: Score): string
Renderer.createPlan(score: Score): RenderPlan
Renderer.createPipeline(score: Score): RenderPipeline
createRenderPipeline(score: Score, options?: RenderPlanOptions): RenderPipeline
solveMeasureSpacing(score: Score, measure: RenderPlanMeasure): MeasureSpacing
```

Intermediate outputs:

- `RenderPipeline`: inspectable pipeline wrapper with input summary, stage
  statuses, render plan, per-measure layout/spacing, and output contract.
- `MeasureLayoutAnalysis`: per-measure spacing contributions and diagnostics.
- `RenderPlan`: part systems, measure geometry, content x-ranges, and collected
  layout diagnostics.
- `MeasureSpacing`: timeline-aligned event columns, event x positions, and
  path/id indexes for renderer lookup.

Renderer output:

- SVG string with SMuFL text glyphs, SVG primitives, and interaction metadata.

## Spacing Model

The renderer uses three contribution kinds:

- `hard`: fixed material such as barlines, clefs, key signatures, and time
  signatures.
- `soft`: duration-bearing or scalable visual material such as notes, rests,
  grace notes, tuplets, and multimeasure rests.
- `overlay`: anchored material that does not advance primary spacing, such as
  dynamics, wedges, ottavas, pedals, and tuplet brackets.

This model is implemented in `renderer/src/layout.ts` and tested in
`renderer/test/layout.test.ts`.

## Render Plan Contract

`RenderPlan` is the current backend-neutral geometry layer:

```ts
interface RenderPlanMeasure {
  partIndex: number;
  measureIndex: number;
  measureNumber: number;
  x: number;
  y: number;
  width: number;
  contentX: number;
  contentWidth: number;
  layout: MeasureLayoutAnalysis;
}
```

SVG rendering now consumes this plan for system wrapping and measure geometry.

## Spacing Solver Contract

`MeasureSpacing` maps timeline events to columns before glyph drawing:

```ts
interface SpacingEventPosition {
  event: TimedEventRef;
  x: number;
  columnIndex: number;
  visualWidth: number;
}
```

The current solver is beat-proportional within the measure content range. It
aligns simultaneous events across voices and lets SVG rendering fall back to
legacy sequential positions only when a source item has no timeline event.

## Glyph Plan Contract Sketch

The next renderer abstraction should be a glyph plan before SVG output:

```ts
interface GlyphPlanItem {
  id: string;
  kind: "glyph" | "text" | "line" | "curve" | "hitbox";
  role: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  smuflGlyph?: string;
  text?: string;
  eventId?: string;
  partId?: string;
  measureIndex?: number;
}
```

SVG rendering should serialize this plan. Canvas, PDF, and snapshot tests can
then reuse the same plan.

## Pipeline Inspection Contract

`RenderPipeline` makes the currently implemented stages inspectable:

```ts
interface RenderPipeline {
  input: {
    kind: "score";
    parts: number;
    globalMeasures: number;
    partMeasures: number;
  };
  stages: readonly RenderPipelineStage[];
  plan: RenderPlan;
  measures: Array<{
    partIndex: number;
    partId?: string;
    systemIndex: number;
    measureIndex: number;
    measureNumber: number;
    geometry: {
      x: number;
      y: number;
      width: number;
      contentX: number;
      contentWidth: number;
    };
    layout: MeasureLayoutAnalysis;
    spacing: MeasureSpacing;
  }>;
  output: {
    kind: "svg";
    backend: "SvgRenderBackend";
    width: number;
    height: number;
  };
}
```

This is intentionally an inspection API, not the final drawing backend. It
keeps the current renderer stable while giving tests and future tools a direct
view of layout and spacing decisions.

## Renderer Diagnostics

Renderer diagnostics should be structured and non-fatal for normal notation
limitations:

- `layout-missing-measure`
- `rhythm-underfull`
- `rhythm-overfull`
- `unsupported-glyph`
- `span-endpoint-missing`
- `collision-unresolved`
- `measure-overfull`

Core timeline already emits rhythm diagnostics. Renderer-specific diagnostics
should stay in renderer layers.

## Renderer Migration Order

1. Keep `Renderer.render(score)` as the stable public API.
2. Expand `analyzeMeasureLayout()` until it explains current measure widths.
3. Move private width helpers from `Renderer` into layout helpers. Done for
   system wrapping and measure geometry through `RenderPlan`.
4. Add `SpacingSolver` for column positions and stretch/compression. Started
   for timeline-aligned event columns; stretch/compression still needs a fuller
   solver.
5. Add `GlyphPlanner` and make SVG output a backend. Started.
6. Add `RenderPipeline` inspection so inputs, intermediate outputs, and backend
   contracts are visible without parsing SVG. Done.
7. Add a `RenderDocument` / `RenderElement` layer and migrate SVG primitives
   out of `Renderer`.
8. Add collision passes for accidentals, dots, lyrics, articulations, dynamics,
   pedals, and ottavas.
9. Add backend-neutral glyph-plan snapshot tests.

Broader notation priorities belong in
`docs/research/notation-capability-matrix.md`; this file only tracks renderer
pipeline work.
