import { describe, expect, it } from "bun:test";
import {
    dynamicEvent,
    measureWithContent,
    noteEvent,
    restEvent,
    singlePartScore,
} from "../../../test/fixtures/score";
import { createRenderPipeline, Renderer } from "../src/index";

describe("renderer pipeline inspection", () => {
    it("exposes input, intermediate layout/spacing, and SVG output contracts", () => {
        const score = singlePartScore({
            globalMeasures: [{ time: { count: 4, unit: 4 } }],
            measures: [
                measureWithContent([
                    dynamicEvent({ id: "dyn-1", value: "mf" }),
                    noteEvent({ id: "note-1" }),
                    restEvent({ id: "rest-1" }),
                ]),
            ],
        });

        const pipeline = new Renderer().createPipeline(score);
        const measure = pipeline.measures[0];
        if (!measure) throw new Error("Expected one pipeline measure");

        expect(pipeline.input).toEqual({
            kind: "score",
            parts: 1,
            globalMeasures: 1,
            partMeasures: 1,
        });
        expect(pipeline.stages.map((stage) => stage.name)).toEqual([
            "score-input",
            "core-timeline",
            "measure-layout",
            "render-plan",
            "measure-spacing",
            "glyph-planning",
            "collision-resolution",
            "svg-output",
        ]);
        expect(measure.layout.contributions.map((contribution) => contribution.role)).toEqual(
            expect.arrayContaining(["timeSignature", "dynamic", "note", "rest"]),
        );
        expect(measure.spacing.eventsById.get("note-1")).toHaveLength(1);
        expect(measure.spacing.eventsById.get("rest-1")).toHaveLength(1);
        expect(pipeline.output).toEqual({
            kind: "svg",
            backend: "SvgRenderBackend",
            width: pipeline.plan.width,
            height: pipeline.plan.height,
        });
    });

    it("keeps the standalone pipeline factory aligned with Renderer defaults when options match", () => {
        const score = singlePartScore({
            measures: [measureWithContent([noteEvent({ id: "note-1" })])],
        });
        const renderer = new Renderer();
        const rendererPipeline = renderer.createPipeline(score);
        const standalonePipeline = createRenderPipeline(score, {
            pageWidth: 800,
            minPageWidth: 420,
            paddingX: 40,
            paddingY: 50,
            bottomPadding: 32,
            systemSpacing: 145,
            measurePadding: 15,
            minMeasureWidth: 60,
            systemHeaderWidth: renderer.createPlan(score).systems[0].headerWidth,
        });

        expect(standalonePipeline.plan.width).toBe(rendererPipeline.plan.width);
        expect(standalonePipeline.plan.height).toBe(rendererPipeline.plan.height);
        expect(standalonePipeline.measures[0]?.spacing.eventsById.has("note-1")).toBe(true);
    });
});
