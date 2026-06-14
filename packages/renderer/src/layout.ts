import type { NoteValue, RhythmicPosition, Score } from "@melos/core";
import { buildMeasureTimeline } from "@melos/core";

export type SpacingContributionKind = "hard" | "soft" | "overlay";

export type SpacingContributionRole =
    | "barline"
    | "clef"
    | "keySignature"
    | "timeSignature"
    | "note"
    | "rest"
    | "grace"
    | "tuplet"
    | "dynamic"
    | "wedge"
    | "ottava"
    | "pedal"
    | "multimeasureRest";

export interface SpacingContribution {
    id: string;
    kind: SpacingContributionKind;
    role: SpacingContributionRole;
    width: number;
    path: string;
    sequenceIndex?: number;
    duration?: NoteValue;
    position?: RhythmicPosition;
}

export type LayoutDiagnosticSeverity = "info" | "warning" | "error";

export interface LayoutDiagnostic {
    severity: LayoutDiagnosticSeverity;
    code: string;
    message: string;
    path: string;
}

export interface MeasureLayoutAnalysis {
    partId?: string;
    partIndex: number;
    measureIndex: number;
    expectedBeats: number;
    sequenceBeats: number[];
    hardWidth: number;
    softWidth: number;
    overlayCount: number;
    estimatedWidth: number;
    contributions: SpacingContribution[];
    diagnostics: LayoutDiagnostic[];
}

export interface MeasureLayoutOptions {
    measurePadding?: number;
    minMeasureWidth?: number;
}

const DEFAULT_MEASURE_PADDING = 15;
const DEFAULT_MIN_MEASURE_WIDTH = 60;
const CLEF_WIDTH = 40;
const KEY_SIGNATURE_BASE_WIDTH = 10;
const KEY_SIGNATURE_ACCIDENTAL_WIDTH = 12;
const TIME_SIGNATURE_WIDTH = 30;
const BARLINE_WIDTH = 1;
const OVERLAY_WIDTH = 0;
const GRACE_EVENT_WIDTH = 20;

export function analyzeMeasureLayout(
    score: Score,
    partIndex: number,
    measureIndex: number,
    options: MeasureLayoutOptions = {}
): MeasureLayoutAnalysis {
    const part = score.parts[partIndex];
    const globalMeasure = score.global.measures[measureIndex];
    const measure = part?.measures[measureIndex];
    const measurePadding = options.measurePadding ?? DEFAULT_MEASURE_PADDING;
    const minMeasureWidth = options.minMeasureWidth ?? DEFAULT_MIN_MEASURE_WIDTH;
    const contributions: SpacingContribution[] = [];
    const diagnostics: LayoutDiagnostic[] = [];

    if (!part || !measure) {
        diagnostics.push({
            severity: "error",
            code: "layout-missing-measure",
            message: `Missing part ${partIndex + 1} or measure ${measureIndex + 1}.`,
            path: `parts[${partIndex}].measures[${measureIndex}]`
        });

        return {
            partId: part?.id,
            partIndex,
            measureIndex,
            expectedBeats: 0,
            sequenceBeats: [],
            hardWidth: 0,
            softWidth: 0,
            overlayCount: 0,
            estimatedWidth: minMeasureWidth,
            contributions,
            diagnostics
        };
    }

    const measurePath = `parts[${partIndex}].measures[${measureIndex}]`;
    contributions.push({
        id: `${measurePath}.startBarline`,
        kind: "hard",
        role: "barline",
        width: BARLINE_WIDTH,
        path: `${measurePath}.startBarline`
    });

    for (const [clefIndex, clef] of (measure.clefs || []).entries()) {
        contributions.push({
            id: `${measurePath}.clefs[${clefIndex}]`,
            kind: "hard",
            role: "clef",
            width: CLEF_WIDTH,
            path: `${measurePath}.clefs[${clefIndex}]`,
            position: clef.position
        });
    }

    if (globalMeasure?.key) {
        contributions.push({
            id: `global.measures[${measureIndex}].key`,
            kind: "hard",
            role: "keySignature",
            width: KEY_SIGNATURE_BASE_WIDTH + Math.abs(globalMeasure.key.fifths || 0) * KEY_SIGNATURE_ACCIDENTAL_WIDTH,
            path: `global.measures[${measureIndex}].key`
        });
    }

    if (globalMeasure?.time) {
        contributions.push({
            id: `global.measures[${measureIndex}].time`,
            kind: "hard",
            role: "timeSignature",
            width: TIME_SIGNATURE_WIDTH,
            path: `global.measures[${measureIndex}].time`
        });
    }

    const sequenceWidths: number[] = [];
    for (const [sequenceIndex, sequence] of measure.sequences.entries()) {
        const sequencePath = `${measurePath}.sequences[${sequenceIndex}]`;
        sequenceWidths.push(collectContentContributions(
            sequence.content,
            sequencePath,
            sequenceIndex,
            contributions
        ));
    }

    if (measure.multimeasureRest) {
        contributions.push({
            id: `${measurePath}.multimeasureRest`,
            kind: "soft",
            role: "multimeasureRest",
            width: minMeasureWidth,
            path: `${measurePath}.multimeasureRest`
        });
    }

    collectMeasureOverlays(measure, measurePath, contributions);

    contributions.push({
        id: `${measurePath}.endBarline`,
        kind: "hard",
        role: "barline",
        width: BARLINE_WIDTH,
        path: `${measurePath}.endBarline`
    });

    const timeline = buildMeasureTimeline(score, partIndex, measureIndex);
    const sequenceBeats = timeline.sequences.map((sequence) => sequence.usedBeats);
    const expectedBeats = timeline.expectedBeats;
    diagnostics.push(...timeline.diagnostics);

    const hardWidth = sumContributionWidths(contributions, "hard");
    const softWidth = sumContributionWidths(contributions, "soft");
    const overlayCount = contributions.filter((contribution) => contribution.kind === "overlay").length;
    const contentWidth = Math.max(...sequenceWidths, measure.multimeasureRest ? minMeasureWidth : 0, 0);
    const estimatedWidth = Math.max(
        minMeasureWidth,
        hardWidth + measurePadding * 2 + contentWidth
    );

    return {
        partId: part.id,
        partIndex,
        measureIndex,
        expectedBeats,
        sequenceBeats,
        hardWidth,
        softWidth,
        overlayCount,
        estimatedWidth,
        contributions,
        diagnostics
    };
}

export function estimateEventWidth(item: unknown, grace = false): number {
    if (!isRecord(item)) return 0;
    if (Array.isArray(item.notes) && item.notes.length > 0) {
        return grace ? GRACE_EVENT_WIDTH : estimateNoteWidth(asNoteValue(item.duration));
    }
    if (isRecord(item.rest)) {
        return grace ? GRACE_EVENT_WIDTH : estimateNoteWidth(asNoteValue(item.duration));
    }
    if ((item.type === "tuplet" || item.type === "grace") && Array.isArray(item.content)) {
        return item.content.reduce((sum, child) => sum + estimateEventWidth(child, item.type === "grace"), 0);
    }
    return 0;
}

export function estimateNoteWidth(duration?: NoteValue): number {
    let width: number;
    switch (duration?.base) {
        case "whole":
            width = 60;
            break;
        case "half":
            width = 45;
            break;
        case "quarter":
            width = 35;
            break;
        case "eighth":
            width = 25;
            break;
        default:
            width = 20;
            break;
    }

    return width + ((duration?.dots || 0) * 7);
}

function collectContentContributions(
    content: unknown[],
    path: string,
    sequenceIndex: number,
    contributions: SpacingContribution[],
    grace = false
): number {
    let width = 0;

    for (const [eventIndex, item] of content.entries()) {
        if (!isRecord(item)) continue;

        const eventPath = `${path}.content[${eventIndex}]`;
        if (Array.isArray(item.notes) && item.notes.length > 0) {
            const duration = asNoteValue(item.duration);
            const eventWidth = estimateEventWidth(item, grace);
            contributions.push({
                id: typeof item.id === "string" ? item.id : eventPath,
                kind: "soft",
                role: grace ? "grace" : "note",
                width: eventWidth,
                path: eventPath,
                sequenceIndex,
                duration
            });
            width += eventWidth;
            continue;
        }

        if (isRecord(item.rest)) {
            const duration = asNoteValue(item.duration);
            const eventWidth = estimateEventWidth(item, grace);
            contributions.push({
                id: typeof item.id === "string" ? item.id : eventPath,
                kind: "soft",
                role: grace ? "grace" : "rest",
                width: eventWidth,
                path: eventPath,
                sequenceIndex,
                duration
            });
            width += eventWidth;
            continue;
        }

        if (item.type === "dynamic") {
            contributions.push({
                id: typeof item.id === "string" ? item.id : eventPath,
                kind: "overlay",
                role: "dynamic",
                width: OVERLAY_WIDTH,
                path: eventPath,
                sequenceIndex
            });
            continue;
        }

        if ((item.type === "tuplet" || item.type === "grace") && Array.isArray(item.content)) {
            contributions.push({
                id: eventPath,
                kind: "overlay",
                role: item.type,
                width: OVERLAY_WIDTH,
                path: eventPath,
                sequenceIndex
            });
            width += collectContentContributions(
                item.content,
                eventPath,
                sequenceIndex,
                contributions,
                item.type === "grace"
            );
        }
    }

    return width;
}

function collectMeasureOverlays(
    measure: { wedges?: unknown[]; ottavas?: unknown[]; pedals?: unknown[] },
    measurePath: string,
    contributions: SpacingContribution[]
): void {
    collectOverlayArray(measure.wedges, measurePath, "wedges", "wedge", contributions);
    collectOverlayArray(measure.ottavas, measurePath, "ottavas", "ottava", contributions);
    collectOverlayArray(measure.pedals, measurePath, "pedals", "pedal", contributions);
}

function collectOverlayArray(
    items: unknown[] | undefined,
    measurePath: string,
    propertyName: string,
    role: Extract<SpacingContributionRole, "wedge" | "ottava" | "pedal">,
    contributions: SpacingContribution[]
): void {
    for (const [index, item] of (items || []).entries()) {
        const position = isRecord(item) && isRecord(item.position)
            ? item.position as RhythmicPosition
            : undefined;
        contributions.push({
            id: `${measurePath}.${propertyName}[${index}]`,
            kind: "overlay",
            role,
            width: OVERLAY_WIDTH,
            path: `${measurePath}.${propertyName}[${index}]`,
            position
        });
    }
}

function sumContributionWidths(contributions: SpacingContribution[], kind: SpacingContributionKind): number {
    return contributions
        .filter((contribution) => contribution.kind === kind)
        .reduce((sum, contribution) => sum + contribution.width, 0);
}

function asNoteValue(value: unknown): NoteValue | undefined {
    if (!isRecord(value) || typeof value.base !== "string") return undefined;
    return value as NoteValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}
