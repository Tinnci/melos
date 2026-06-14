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
- `renderer/src/plan.ts` wraps measures into systems from layout analysis.
- `renderer/src/smufl.ts` resolves common SMuFL glyph names.
- `renderer/src/layout.ts` analyzes hard, soft, and overlay spacing
  contributions from `@melos/core` timeline data.

Still coupled:

- Glyph planning, curves, hitboxes, and SVG string serialization live mostly in
  `Renderer`.
- Collision avoidance is not a separate pass.
- SVG is the only backend.

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
| Spacing solver | Horizontal positions, stretch/compression, wrapping | Missing |
| Glyph planner | SMuFL glyphs, text items, stems, beams, curves, hitboxes | Partly inside `Renderer` |
| Collision resolver | Accidentals, dots, lyrics, articulations, dynamics, spans | Missing |
| Render backend | SVG/canvas/PDF/test serialization | SVG inline in `Renderer` |

## Current Inputs And Outputs

Renderer input:

```ts
Renderer.render(score: Score): string
Renderer.createPlan(score: Score): RenderPlan
```

Intermediate outputs:

- `MeasureLayoutAnalysis`: per-measure spacing contributions and diagnostics.
- `RenderPlan`: part systems, measure geometry, content x-ranges, and collected
  layout diagnostics.

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
4. Add `SpacingSolver` for column positions and stretch/compression.
5. Add `GlyphPlanner` and make SVG output a backend.
6. Add collision passes for accidentals, dots, lyrics, articulations, dynamics,
   pedals, and ottavas.
7. Add backend-neutral glyph-plan snapshot tests.

Broader notation priorities belong in
`docs/research/notation-capability-matrix.md`; this file only tracks renderer
pipeline work.
