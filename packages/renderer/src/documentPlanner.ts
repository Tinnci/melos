import { getTimelineEventSource, type Note, type RhythmicPosition, type Score } from "@melos/core";
import {
    DEFAULT_RENDER_DOCUMENT_METADATA_OPTIONS,
    type RenderDocumentMetadata,
    type RenderDocumentMetadataOptions,
} from "./documentMetadata";
import type {
    EventAnchor,
    MeasureOverlay,
    MeasureOverlayEnd,
    NoteAdornmentContext,
    NoteLayout,
    PlannedEvent,
    SourceItem,
    TremoloValue,
} from "./documentPlannerTypes";
import type { RenderPlan, RenderPlanMeasure } from "./plan";
import { solveMeasureSpacing, type MeasureSpacing, type SpacingEventPosition } from "./spacing";
import type { RenderBox, RenderBoxRole, RenderDiagnostic, RenderSpan } from "./renderDocument";

export {
    DEFAULT_RENDER_DOCUMENT_METADATA_OPTIONS,
    type RenderDocumentMetadata,
    type RenderDocumentMetadataOptions,
} from "./documentMetadata";

export function createRenderDocumentMetadata(
    score: Score,
    plan: RenderPlan,
    options: RenderDocumentMetadataOptions = DEFAULT_RENDER_DOCUMENT_METADATA_OPTIONS,
): RenderDocumentMetadata {
    return new RenderDocumentMetadataBuilder(score, plan, options).create();
}

class RenderDocumentMetadataBuilder {
    private readonly score: Score;
    private readonly plan: RenderPlan;
    private readonly options: RenderDocumentMetadataOptions;
    private readonly boxes: RenderBox[] = [];
    private readonly spans: RenderSpan[] = [];
    private readonly diagnostics: RenderDiagnostic[] = [];
    private readonly events: PlannedEvent[] = [];
    private readonly anchors = new Map<string, EventAnchor>();

    constructor(score: Score, plan: RenderPlan, options: RenderDocumentMetadataOptions) {
        this.score = score;
        this.plan = plan;
        this.options = options;
    }

    create(): RenderDocumentMetadata {
        for (const system of this.plan.systems) {
            for (const measure of system.measures) {
                this.collectStructuralBoxes(measure);
                this.collectMeasureEvents(measure);
                this.collectMeasureOverlays(measure);
            }
        }

        this.collectEventLinkedSpans();

        return {
            boxes: this.boxes,
            spans: this.spans,
            diagnostics: this.diagnostics,
        };
    }

    private collectStructuralBoxes(measure: RenderPlanMeasure): void {
        const measurePath = measureSourcePath(measure);
        this.addBox({
            id: `measure:${measure.partIndex}:${measure.measureIndex}`,
            role: "measure",
            layer: "interaction",
            x: measure.x,
            y: measure.y - 14,
            width: measure.width,
            height: this.options.lineSpacing * 4 + 84,
            partIndex: measure.partIndex,
            measureIndex: measure.measureIndex,
            partId: measure.partId,
            sourcePath: measurePath,
        });
        this.addBox({
            id: `stave:${measure.partIndex}:${measure.measureIndex}`,
            role: "stave",
            layer: "staff",
            x: measure.x,
            y: measure.y,
            width: measure.width,
            height: this.options.lineSpacing * 4,
            partIndex: measure.partIndex,
            measureIndex: measure.measureIndex,
            partId: measure.partId,
            sourcePath: measurePath,
        });

        const partMeasure = this.getPartMeasure(measure);
        if (partMeasure?.multimeasureRest) {
            this.addBox({
                id: `multimeasure-rest:${measure.partIndex}:${measure.measureIndex}`,
                role: "rest",
                layer: "notation",
                x: measure.contentX,
                y: measure.y + this.options.lineSpacing * 1.5,
                width: measure.contentWidth,
                height: this.options.lineSpacing,
                partIndex: measure.partIndex,
                measureIndex: measure.measureIndex,
                partId: measure.partId,
                sourcePath: `${measurePath}.multimeasureRest`,
            });
        }
    }

    private collectMeasureEvents(measure: RenderPlanMeasure): void {
        const spacing = solveMeasureSpacing(this.score, measure);
        for (const position of spacing.events) {
            const source = asSourceItem(getTimelineEventSource(this.score, position.event));
            this.events.push({ measure, position, source });
            this.collectEventBoxes(measure, position, source, spacing);
        }
    }

    private collectEventBoxes(
        measure: RenderPlanMeasure,
        position: SpacingEventPosition,
        source: SourceItem | undefined,
        spacing: MeasureSpacing,
    ): void {
        switch (position.event.kind) {
            case "note":
                this.collectNoteEventBox(measure, position, source);
                return;
            case "rest":
                this.collectRestEventBox(measure, position, source);
                return;
            case "dynamic":
                this.collectDynamicEventBox(measure, position, source);
                return;
            case "tuplet":
            case "grace":
                this.collectContainerEventBox(measure, position, source, spacing);
                return;
        }
    }

    private collectNoteEventBox(
        measure: RenderPlanMeasure,
        position: SpacingEventPosition,
        source: SourceItem | undefined,
    ): void {
        if (!source?.notes?.length) return;
        this.collectNoteBoxes(measure, position, source);
    }

    private collectRestEventBox(
        measure: RenderPlanMeasure,
        position: SpacingEventPosition,
        source: SourceItem | undefined,
    ): void {
        if (!source?.rest || source.rest.hidden) return;

        this.addTimedEventBox(measure, position, source, "rest", {
            x: position.x - 8,
            y: measure.y,
            width: 42,
            height: 56,
        });
        this.addEventAnchor(measure, position, source, measure.y + 2 * this.options.lineSpacing);
    }

    private collectDynamicEventBox(
        measure: RenderPlanMeasure,
        position: SpacingEventPosition,
        source: SourceItem | undefined,
    ): void {
        if (!source?.value) return;

        this.addTimedEventBox(measure, position, source, "dynamic", {
            x: position.x - 8,
            y: measure.y + this.options.dynamicOffsetY - 28,
            width: 72,
            height: 38,
        });
        this.addEventAnchor(measure, position, source, measure.y + this.options.dynamicOffsetY);
    }

    private collectContainerEventBox(
        measure: RenderPlanMeasure,
        position: SpacingEventPosition,
        source: SourceItem | undefined,
        spacing: MeasureSpacing,
    ): void {
        const width = Math.max(position.visualWidth, spacing.contentWidth * 0.1, 20);
        this.addTimedEventBox(measure, position, source, position.event.kind, {
            x: position.x,
            y: measure.y - 30,
            width,
            height: 24,
        });
    }

    private collectNoteBoxes(
        measure: RenderPlanMeasure,
        position: SpacingEventPosition,
        source: SourceItem,
    ): void {
        const layout = this.planNoteLayout(
            source.notes ?? [],
            measure.y,
            position.event.grace,
            source.duration?.base,
        );
        const top = Math.min(layout.minY, layout.stemTipY) - 14 * layout.scale;
        const bottom = Math.max(layout.maxY, layout.stemTipY) + 20 * layout.scale;

        this.addTimedEventBox(measure, position, source, position.event.grace ? "grace" : "note", {
            x: position.x - 24 * layout.scale,
            y: top,
            width: 48 * layout.scale,
            height: bottom - top,
        });
        this.addEventAnchor(measure, position, source, (layout.minY + layout.maxY) / 2);

        source.notes?.forEach((note, noteIndex) => {
            const noteY = this.calculateY(note, measure.y);
            if (note.id) {
                this.anchors.set(note.id, {
                    id: note.id,
                    x: position.x,
                    y: noteY,
                    partIndex: measure.partIndex,
                    measureIndex: measure.measureIndex,
                    partId: measure.partId,
                    sourcePath: `${position.event.path}.notes[${noteIndex}]`,
                });
            }
            this.collectNoteAdornmentBoxes({
                measure,
                position,
                source,
                note,
                noteIndex,
                noteY,
                layout,
            });
        });
    }

    private collectNoteAdornmentBoxes(context: NoteAdornmentContext): void {
        const { measure, position, source, note, noteIndex, noteY, layout } = context;
        const eventId = source.id ?? position.event.id;
        const sourcePath = `${position.event.path}.notes[${noteIndex}]`;
        if (note.accidentalDisplay?.show && note.pitch?.alter !== undefined) {
            this.addBox({
                id: `${position.event.path}:accidental:${noteIndex}`,
                role: "accidental",
                layer: "notation",
                x: position.x - 26 * layout.scale,
                y: noteY - 18 * layout.scale,
                width: 18 * layout.scale,
                height: 30 * layout.scale,
                partIndex: measure.partIndex,
                measureIndex: measure.measureIndex,
                partId: measure.partId,
                eventId,
                sourcePath,
            });
        }

        const dots = source.duration?.dots ?? 0;
        if (dots > 0) {
            this.addBox({
                id: `${position.event.path}:dots:${noteIndex}`,
                role: "augmentationDot",
                layer: "notation",
                x: position.x + 14 * layout.scale,
                y: this.dotYForStaffPosition(noteY, measure.y) - 4,
                width: dots * 6 * layout.scale + 4,
                height: 8,
                partIndex: measure.partIndex,
                measureIndex: measure.measureIndex,
                partId: measure.partId,
                eventId,
                sourcePath,
            });
        }

        this.collectArticulationBoxes(measure, position, source, layout);
        this.collectTremoloBox(measure, position, source, layout);
    }

    private collectArticulationBoxes(
        measure: RenderPlanMeasure,
        position: SpacingEventPosition,
        source: SourceItem,
        layout: NoteLayout,
    ): void {
        const articulations = source.articulations ?? [];
        if (articulations.length === 0) return;

        const placement = layout.stemUp ? "below" : "above";
        const baseY = placement === "above" ? layout.minY - 10 : layout.maxY + 16;
        const direction = placement === "above" ? -1 : 1;

        articulations.forEach((_articulation, articulationIndex) => {
            const y = baseY + articulationIndex * 11 * direction;
            this.addBox({
                id: `${position.event.path}:articulation:${articulationIndex}`,
                role: "articulation",
                layer: "notation",
                x: position.x - 8,
                y: y - 14,
                width: 20,
                height: 20,
                partIndex: measure.partIndex,
                measureIndex: measure.measureIndex,
                partId: measure.partId,
                eventId: source.id ?? position.event.id,
                sourcePath: `${position.event.path}.articulations[${articulationIndex}]`,
            });
        });
    }

    private collectTremoloBox(
        measure: RenderPlanMeasure,
        position: SpacingEventPosition,
        source: SourceItem,
        layout: NoteLayout,
    ): void {
        if (!source.tremolo || !isSingleNoteTremolo(source.tremolo)) return;

        const centerY = layout.stemTipY + (layout.stemUp ? 15 : -15);
        this.addBox({
            id: `${position.event.path}:tremolo`,
            role: "tremolo",
            layer: "notation",
            x: position.x - 8,
            y: centerY - 12,
            width: 20,
            height: 24,
            partIndex: measure.partIndex,
            measureIndex: measure.measureIndex,
            partId: measure.partId,
            eventId: source.id ?? position.event.id,
            sourcePath: `${position.event.path}.tremolo`,
        });
    }

    private collectMeasureOverlays(measure: RenderPlanMeasure): void {
        const partMeasure = this.getPartMeasure(measure);
        if (!partMeasure) return;

        this.collectPedalOverlays(measure, partMeasure.pedals ?? []);
        this.collectOttavaOverlays(measure, partMeasure.ottavas ?? []);
        this.collectWedgeOverlays(measure, partMeasure.wedges ?? []);
    }

    private collectPedalOverlays(measure: RenderPlanMeasure, pedals: MeasureOverlay[]): void {
        pedals.forEach((pedal, index) => {
            const sourcePath = `${measureSourcePath(measure)}.pedals[${index}]`;
            const startX = this.rhythmicPositionToX(measure, pedal.position);
            if (pedal.sign || pedal.type === "stop" || !pedal.line) {
                this.addBox({
                    id: `${sourcePath}:sign`,
                    role: "pedal",
                    layer: "span",
                    x: startX,
                    y: measure.y + this.options.pedalSignOffsetY - 24,
                    width: pedal.type === "stop" ? 20 : 32,
                    height: 30,
                    partIndex: measure.partIndex,
                    measureIndex: measure.measureIndex,
                    partId: measure.partId,
                    sourcePath,
                });
            }

            if (pedal.type !== "start" || !pedal.line) return;

            const endpoint = this.resolveOverlayEndpoint(measure, pedal.end, sourcePath);
            const measureEndX = measure.x + measure.width - this.options.measurePadding;
            const lineStartX = startX + (pedal.sign ? 32 : 0);
            const lineEndX = Math.max(lineStartX + 16, Math.min(endpoint.x, measureEndX));
            const lineY = measure.y + this.options.pedalLineOffsetY;

            this.spans.push({
                id: `${sourcePath}:line`,
                role: "pedal",
                partIndex: measure.partIndex,
                measureIndex: measure.measureIndex,
                partId: measure.partId,
                startX: lineStartX,
                startY: lineY,
                endX: lineEndX,
                endY: endpoint.y + this.options.pedalLineOffsetY,
                sourcePath,
            });
        });
    }

    private collectOttavaOverlays(measure: RenderPlanMeasure, ottavas: MeasureOverlay[]): void {
        ottavas.forEach((ottava, index) => {
            const sourcePath = `${measureSourcePath(measure)}.ottavas[${index}]`;
            const startX = this.rhythmicPositionToX(measure, ottava.position);
            const endpoint = this.resolveOverlayEndpoint(measure, ottava.end, sourcePath);
            const above = (ottava.value ?? 1) > 0;
            const lineY = above ? measure.y - 20 : measure.y + 4 * this.options.lineSpacing + 20;
            const textY = above ? lineY - 17 : lineY - 2;

            this.addBox({
                id: `${sourcePath}:label`,
                role: "ottava",
                layer: "span",
                x: startX,
                y: textY,
                width: 32,
                height: 18,
                partIndex: measure.partIndex,
                measureIndex: measure.measureIndex,
                partId: measure.partId,
                sourcePath,
            });
            this.spans.push({
                id: `${sourcePath}:line`,
                role: "ottava",
                partIndex: measure.partIndex,
                measureIndex: measure.measureIndex,
                partId: measure.partId,
                startX: startX + 25,
                startY: lineY,
                endX: endpoint.x,
                endY: endpoint.y + (lineY - measure.y),
                sourcePath,
            });
        });
    }

    private collectWedgeOverlays(measure: RenderPlanMeasure, wedges: MeasureOverlay[]): void {
        wedges.forEach((wedge, index) => {
            const sourcePath = `${measureSourcePath(measure)}.wedges[${index}]`;
            const startX = this.rhythmicPositionToX(measure, wedge.position);
            const endpoint = this.resolveOverlayEndpoint(measure, wedge.end, sourcePath);
            const y = measure.y + this.options.dynamicOffsetY - 18;
            this.spans.push({
                id: `${sourcePath}:line`,
                role: "wedge",
                partIndex: measure.partIndex,
                measureIndex: measure.measureIndex,
                partId: measure.partId,
                startX,
                startY: y,
                endX: endpoint.x,
                endY: endpoint.y + (y - measure.y),
                sourcePath,
            });
        });
    }

    private collectEventLinkedSpans(): void {
        const pendingTremolos = new Map<string, { sourceId: string; path: string }>();

        for (const event of this.events) {
            const source = event.source;
            if (!source) continue;

            this.collectSlurSpans(event, source);
            this.collectTieSpans(event, source);
            this.collectTremoloSpans(event, source, pendingTremolos);
        }
    }

    private collectSlurSpans(event: PlannedEvent, source: SourceItem): void {
        const sourceId = source.id ?? event.position.event.id;
        if (!sourceId || !source.slurs) return;

        source.slurs.forEach((slur, slurIndex) => {
            if (!slur.target) return;
            this.addLinkedSpan(
                "slur",
                sourceId,
                slur.target,
                `${event.position.event.path}.slurs[${slurIndex}]`,
            );
        });
    }

    private collectTieSpans(event: PlannedEvent, source: SourceItem): void {
        source.notes?.forEach((note, noteIndex) => {
            note.ties?.forEach((tie, tieIndex) => {
                const sourceId = note.id ?? source.id ?? event.position.event.id;
                if (!sourceId || !tie.target) return;
                this.addLinkedSpan(
                    "tie",
                    sourceId,
                    tie.target,
                    `${event.position.event.path}.notes[${noteIndex}].ties[${tieIndex}]`,
                );
            });
        });
    }

    private collectTremoloSpans(
        event: PlannedEvent,
        source: SourceItem,
        pendingTremolos: Map<string, { sourceId: string; path: string }>,
    ): void {
        const tremolo = source.tremolo;
        const eventId = source.id ?? event.position.event.id;
        if (!eventId || !tremolo || typeof tremolo !== "object" || !tremolo.id) return;

        if (tremolo.type === "start") {
            pendingTremolos.set(tremolo.id, {
                sourceId: eventId,
                path: `${event.position.event.path}.tremolo`,
            });
            return;
        }

        if (tremolo.type !== "stop") return;

        const start = pendingTremolos.get(tremolo.id);
        if (!start) {
            this.addSpanEndpointDiagnostic(
                `span:tremolo:${tremolo.id}`,
                `${event.position.event.path}.tremolo`,
                "Missing tremolo start endpoint.",
            );
            return;
        }

        this.addLinkedSpan("tremolo", start.sourceId, eventId, start.path);
        pendingTremolos.delete(tremolo.id);
    }

    private addLinkedSpan(
        role: RenderSpan["role"],
        sourceId: string,
        targetId: string,
        sourcePath: string,
    ): void {
        const spanId = `span:${role}:${sourceId}:${targetId}`;
        const source = this.anchors.get(sourceId);
        const target = this.anchors.get(targetId);
        if (!source || !target) {
            this.addSpanEndpointDiagnostic(
                spanId,
                sourcePath,
                `Missing ${role} endpoint ${!source ? sourceId : targetId}.`,
            );
            return;
        }

        this.spans.push({
            id: spanId,
            role,
            partIndex: source.partIndex,
            measureIndex: source.measureIndex,
            partId: source.partId,
            startX: source.x,
            startY: source.y,
            endX: target.x,
            endY: target.y,
            sourceId,
            targetId,
            sourcePath,
        });
    }

    private resolveOverlayEndpoint(
        measure: RenderPlanMeasure,
        end: MeasureOverlayEnd | undefined,
        sourcePath: string,
    ): { x: number; y: number } {
        const fallbackX = measure.x + measure.width - this.options.measurePadding;
        if (!end) return { x: fallbackX, y: measure.y };

        const targetMeasure = this.findMeasureByNumber(measure.partIndex, end.measure);
        if (!targetMeasure) {
            this.addSpanEndpointDiagnostic(
                `${sourcePath}:line`,
                sourcePath,
                `Missing overlay endpoint measure ${end.measure}.`,
            );
            return { x: fallbackX, y: measure.y };
        }

        return {
            x: this.rhythmicPositionToX(targetMeasure, end.position),
            y: targetMeasure.y,
        };
    }

    private findMeasureByNumber(
        partIndex: number,
        measureNumber: number | undefined,
    ): RenderPlanMeasure | undefined {
        if (measureNumber === undefined) return undefined;

        for (const system of this.plan.systems) {
            for (const measure of system.measures) {
                if (measure.partIndex !== partIndex) continue;
                if (measure.measureNumber === measureNumber) return measure;
                if (measure.measureIndex === measureNumber - 1) return measure;
            }
        }

        return undefined;
    }

    private addTimedEventBox(
        measure: RenderPlanMeasure,
        position: SpacingEventPosition,
        source: SourceItem | undefined,
        role: RenderBoxRole,
        geometry: Pick<RenderBox, "height" | "width" | "x" | "y">,
    ): void {
        this.addBox({
            id: `${position.event.path}:${role}`,
            role,
            layer: "notation",
            partIndex: measure.partIndex,
            measureIndex: measure.measureIndex,
            partId: measure.partId,
            eventId: source?.id ?? position.event.id,
            sourcePath: position.event.path,
            ...geometry,
        });
    }

    private addEventAnchor(
        measure: RenderPlanMeasure,
        position: SpacingEventPosition,
        source: SourceItem | undefined,
        y: number,
    ): void {
        const eventId = source?.id ?? position.event.id;
        if (!eventId) return;

        this.anchors.set(eventId, {
            id: eventId,
            x: position.x,
            y,
            partIndex: measure.partIndex,
            measureIndex: measure.measureIndex,
            partId: measure.partId,
            sourcePath: position.event.path,
        });
    }

    private addSpanEndpointDiagnostic(spanId: string, path: string, message: string): void {
        this.diagnostics.push({
            severity: "warning",
            code: "span-endpoint-missing",
            message,
            path,
            spanId,
        });
    }

    private addBox(box: RenderBox): void {
        this.boxes.push(box);
    }

    private getPartMeasure(
        measure: RenderPlanMeasure,
    ): Score["parts"][number]["measures"][number] | undefined {
        return this.score.parts[measure.partIndex]?.measures[measure.measureIndex];
    }

    private planNoteLayout(
        notes: Note[],
        staffTopY: number,
        grace: boolean,
        duration: string | undefined,
    ): NoteLayout {
        const scale = grace ? 0.7 : 1;
        const yPositions = notes.map((note) => this.calculateY(note, staffTopY));
        const minY = Math.min(...yPositions);
        const maxY = Math.max(...yPositions);
        const stemUp = this.resolveStemDirection(minY, maxY, staffTopY);
        const hasStem = duration !== "whole";
        const stemTipY =
            stemUp && hasStem
                ? minY - this.options.stemLength * scale
                : !stemUp && hasStem
                  ? maxY + this.options.stemLength * scale
                  : stemUp
                    ? minY
                    : maxY;

        return { minY, maxY, stemUp, stemTipY, scale };
    }

    private resolveStemDirection(minY: number, maxY: number, staffTopY: number): boolean {
        const middleLineY = staffTopY + 2 * this.options.lineSpacing;
        const topDistance = Math.abs(minY - middleLineY);
        const bottomDistance = Math.abs(maxY - middleLineY);
        return bottomDistance >= topDistance;
    }

    private calculateY(note: Note, staffTopY: number): number {
        const stepMap: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
        const step = note.pitch?.step ?? note.unpitched?.step ?? "B";
        const octave = note.pitch?.octave ?? note.unpitched?.octave ?? 4;
        const absoluteStep = octave * 7 + (stepMap[step] ?? 4);
        const g4Step = 4 * 7 + 4;
        const diff = absoluteStep - g4Step;
        const g4Y = staffTopY + 3 * this.options.lineSpacing;

        return g4Y - diff * (this.options.lineSpacing / 2);
    }

    private dotYForStaffPosition(noteY: number, staffTopY: number): number {
        const halfSpace = this.options.lineSpacing / 2;
        const staffSteps = Math.round((noteY - staffTopY) / halfSpace);
        return staffSteps % 2 === 0 ? noteY - halfSpace / 2 : noteY;
    }

    private rhythmicPositionToX(
        measure: RenderPlanMeasure,
        position: RhythmicPosition | undefined,
    ): number {
        if (!position?.fraction) return measure.contentX;

        const [numerator, denominator] = position.fraction;
        if (!denominator) return measure.contentX;

        const ratio = Math.max(0, Math.min(1, numerator / denominator));
        return measure.contentX + measure.contentWidth * ratio;
    }
}

function measureSourcePath(measure: RenderPlanMeasure): string {
    return `parts[${measure.partIndex}].measures[${measure.measureIndex}]`;
}

function asSourceItem(value: unknown): SourceItem | undefined {
    return isRecord(value) ? (value as SourceItem) : undefined;
}

function isSingleNoteTremolo(value: TremoloValue): boolean {
    return typeof value === "number" || value.type === "single";
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}
