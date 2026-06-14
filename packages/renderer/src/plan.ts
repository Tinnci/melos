import type { Score } from "@melos/core";
import { analyzeMeasureLayout, type LayoutDiagnostic, type MeasureLayoutAnalysis } from "./layout";

export interface RenderPlanOptions {
    pageWidth?: number;
    minPageWidth?: number;
    paddingX?: number;
    paddingY?: number;
    bottomPadding?: number;
    systemSpacing?: number;
    measurePadding?: number;
    minMeasureWidth?: number;
    systemHeaderWidth?: number;
}

export interface RenderPlan {
    width: number;
    height: number;
    parts: RenderPlanPart[];
    systems: RenderPlanSystem[];
    diagnostics: LayoutDiagnostic[];
}

export interface RenderPlanPart {
    partIndex: number;
    partId?: string;
    name?: string;
    systems: RenderPlanSystem[];
}

export interface RenderPlanSystem {
    partIndex: number;
    partId?: string;
    systemIndex: number;
    x: number;
    y: number;
    contentStartX: number;
    endX: number;
    width: number;
    headerWidth: number;
    measures: RenderPlanMeasure[];
}

export interface RenderPlanMeasure {
    partIndex: number;
    partId?: string;
    measureIndex: number;
    measureNumber: number;
    x: number;
    y: number;
    width: number;
    contentX: number;
    contentWidth: number;
    layout: MeasureLayoutAnalysis;
    diagnostics: LayoutDiagnostic[];
}

const DEFAULT_PLAN_OPTIONS: Required<RenderPlanOptions> = {
    pageWidth: 800,
    minPageWidth: 420,
    paddingX: 40,
    paddingY: 50,
    bottomPadding: 32,
    systemSpacing: 145,
    measurePadding: 15,
    minMeasureWidth: 60,
    systemHeaderWidth: 0,
};

export function createRenderPlan(score: Score, options: RenderPlanOptions = {}): RenderPlan {
    const resolvedOptions = { ...DEFAULT_PLAN_OPTIONS, ...options };
    const parts: RenderPlanPart[] = [];
    const systems: RenderPlanSystem[] = [];
    const diagnostics: LayoutDiagnostic[] = [];
    let currentY = resolvedOptions.paddingY;
    let maxX = resolvedOptions.paddingX;

    score.parts.forEach((part, partIndex) => {
        const partSystems: RenderPlanSystem[] = [];
        let currentSystem = createSystemPlan(
            partIndex,
            part.id,
            partSystems.length,
            currentY,
            resolvedOptions,
        );

        part.measures.forEach((measure, measureIndex) => {
            const layout = analyzeMeasureLayout(score, partIndex, measureIndex, {
                measurePadding: resolvedOptions.measurePadding,
                minMeasureWidth: resolvedOptions.minMeasureWidth,
            });
            diagnostics.push(...layout.diagnostics);

            const measureWidth = Math.max(resolvedOptions.minMeasureWidth, layout.estimatedWidth);
            if (
                currentSystem.measures.length > 0 &&
                currentSystem.endX + measureWidth >
                    resolvedOptions.pageWidth + resolvedOptions.paddingX
            ) {
                finalizeSystem(currentSystem, partSystems, systems);
                maxX = Math.max(maxX, currentSystem.endX);
                currentY += resolvedOptions.systemSpacing;
                currentSystem = createSystemPlan(
                    partIndex,
                    part.id,
                    partSystems.length,
                    currentY,
                    resolvedOptions,
                );
            }

            const measurePlan: RenderPlanMeasure = {
                partIndex,
                partId: part.id,
                measureIndex,
                measureNumber: measure.index ?? measureIndex + 1,
                x: currentSystem.endX,
                y: currentSystem.y,
                width: measureWidth,
                contentX: currentSystem.endX + resolvedOptions.measurePadding,
                contentWidth: Math.max(0, measureWidth - resolvedOptions.measurePadding * 2),
                layout,
                diagnostics: layout.diagnostics,
            };

            currentSystem.measures.push(measurePlan);
            currentSystem.endX += measureWidth;
            currentSystem.width = currentSystem.endX - currentSystem.x;
        });

        finalizeSystem(currentSystem, partSystems, systems);
        maxX = Math.max(maxX, currentSystem.endX);
        parts.push({
            partIndex,
            partId: part.id,
            name: part.name,
            systems: partSystems,
        });
        currentY += resolvedOptions.systemSpacing;
    });

    return {
        width: Math.max(maxX + resolvedOptions.paddingX, resolvedOptions.minPageWidth),
        height: currentY + resolvedOptions.bottomPadding,
        parts,
        systems,
        diagnostics,
    };
}

function createSystemPlan(
    partIndex: number,
    partId: string | undefined,
    systemIndex: number,
    y: number,
    options: Required<RenderPlanOptions>,
): RenderPlanSystem {
    const contentStartX = options.paddingX + options.systemHeaderWidth;
    return {
        partIndex,
        partId,
        systemIndex,
        x: options.paddingX,
        y,
        contentStartX,
        endX: contentStartX,
        width: options.systemHeaderWidth,
        headerWidth: options.systemHeaderWidth,
        measures: [],
    };
}

function finalizeSystem(
    system: RenderPlanSystem,
    partSystems: RenderPlanSystem[],
    systems: RenderPlanSystem[],
): void {
    if (system.measures.length === 0) return;
    system.width = system.endX - system.x;
    partSystems.push(system);
    systems.push(system);
}
