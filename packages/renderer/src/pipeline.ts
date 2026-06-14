import type { Score } from "@melos/core";
import {
    createRenderPlan,
    type RenderPlan,
    type RenderPlanMeasure,
    type RenderPlanOptions,
} from "./plan";
import { solveMeasureSpacing, type MeasureSpacing } from "./spacing";

export type RenderPipelineStageStatus = "implemented" | "partial" | "missing";

export interface RenderPipelineStage {
    name: string;
    status: RenderPipelineStageStatus;
    input: string;
    output: string;
    owner: string;
}

export interface RenderPipelineInput {
    kind: "score";
    parts: number;
    globalMeasures: number;
    partMeasures: number;
}

export interface RenderPipelineOutput {
    kind: "svg";
    backend: "SvgRenderBackend";
    width: number;
    height: number;
}

export interface RenderPipelineMeasure {
    partIndex: number;
    partId?: string;
    systemIndex: number;
    measureIndex: number;
    measureNumber: number;
    geometry: Pick<RenderPlanMeasure, "x" | "y" | "width" | "contentX" | "contentWidth">;
    layout: RenderPlanMeasure["layout"];
    spacing: MeasureSpacing;
}

export interface RenderPipeline {
    input: RenderPipelineInput;
    stages: readonly RenderPipelineStage[];
    plan: RenderPlan;
    measures: RenderPipelineMeasure[];
    output: RenderPipelineOutput;
}

export const RENDER_PIPELINE_STAGES: readonly RenderPipelineStage[] = [
    {
        name: "score-input",
        status: "implemented",
        input: "Score",
        output: "core score model",
        owner: "@melos/core",
    },
    {
        name: "core-timeline",
        status: "implemented",
        input: "score part measure",
        output: "timed event refs and rhythm diagnostics",
        owner: "@melos/core",
    },
    {
        name: "measure-layout",
        status: "implemented",
        input: "score measure and timeline diagnostics",
        output: "spacing contributions and estimated width",
        owner: "@melos/renderer",
    },
    {
        name: "render-plan",
        status: "implemented",
        input: "measure layout analyses",
        output: "systems, measure geometry, and page size",
        owner: "@melos/renderer",
    },
    {
        name: "measure-spacing",
        status: "implemented",
        input: "render plan measure and core timeline",
        output: "timeline-aligned columns and event x positions",
        owner: "@melos/renderer",
    },
    {
        name: "glyph-planning",
        status: "partial",
        input: "score content and measure spacing",
        output: "planned SMuFL glyph names for common notation items",
        owner: "@melos/renderer",
    },
    {
        name: "collision-resolution",
        status: "missing",
        input: "planned glyphs, boxes, and spans",
        output: "adjusted glyph positions and collision diagnostics",
        owner: "@melos/renderer",
    },
    {
        name: "svg-output",
        status: "partial",
        input: "renderer SVG chunks and planned glyphs",
        output: "SVG preview string with interaction metadata",
        owner: "@melos/renderer",
    },
];

export function createRenderPipeline(
    score: Score,
    options: RenderPlanOptions = {},
): RenderPipeline {
    const plan = createRenderPlan(score, options);
    return {
        input: summarizeInput(score),
        stages: RENDER_PIPELINE_STAGES,
        plan,
        measures: collectPipelineMeasures(score, plan),
        output: {
            kind: "svg",
            backend: "SvgRenderBackend",
            width: plan.width,
            height: plan.height,
        },
    };
}

function summarizeInput(score: Score): RenderPipelineInput {
    return {
        kind: "score",
        parts: score.parts.length,
        globalMeasures: score.global.measures.length,
        partMeasures: score.parts.reduce((sum, part) => sum + part.measures.length, 0),
    };
}

function collectPipelineMeasures(score: Score, plan: RenderPlan): RenderPipelineMeasure[] {
    return plan.systems.flatMap((system) =>
        system.measures.map((measure) => ({
            partIndex: measure.partIndex,
            partId: measure.partId,
            systemIndex: system.systemIndex,
            measureIndex: measure.measureIndex,
            measureNumber: measure.measureNumber,
            geometry: {
                x: measure.x,
                y: measure.y,
                width: measure.width,
                contentX: measure.contentX,
                contentWidth: measure.contentWidth,
            },
            layout: measure.layout,
            spacing: solveMeasureSpacing(score, measure),
        })),
    );
}
