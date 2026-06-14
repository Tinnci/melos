import type { NoteValue, RhythmicPosition, Score } from "./schema";
import {
    getDurationInBeats,
    getTimeSignatureBeats,
    getTupletScale
} from "./rhythm";

export type TimelineEventKind = "note" | "rest" | "dynamic" | "tuplet" | "grace";
export type TimelineDiagnosticSeverity = "info" | "warning" | "error";

export interface TimelineDiagnostic {
    severity: TimelineDiagnosticSeverity;
    code: string;
    message: string;
    path: string;
}

export interface TimedEventRef {
    id?: string;
    kind: TimelineEventKind;
    partIndex: number;
    measureIndex: number;
    sequenceIndex: number;
    contentPath: number[];
    path: string;
    startBeat: number;
    durationBeats: number;
    nominalDurationBeats: number;
    scale: number;
    grace: boolean;
    hidden?: boolean;
    staff?: number;
    position: RhythmicPosition;
}

export interface SequenceTimeline {
    sequenceIndex: number;
    expectedBeats: number;
    usedBeats: number;
    events: TimedEventRef[];
    diagnostics: TimelineDiagnostic[];
}

export interface MeasureTimeline {
    partId?: string;
    partIndex: number;
    measureIndex: number;
    measureNumber: number;
    expectedBeats: number;
    sequences: SequenceTimeline[];
    diagnostics: TimelineDiagnostic[];
}

export interface ScoreTimeline {
    measures: MeasureTimeline[];
    diagnostics: TimelineDiagnostic[];
}

export interface TimelineMeasureSelector {
    partIndex: number;
    measureIndex: number;
}

export interface TimelineSequenceSelector extends TimelineMeasureSelector {
    sequenceIndex: number;
}

export interface ScoreTimelineIndex {
    timeline: ScoreTimeline;
    events: readonly TimedEventRef[];
    measuresByKey: ReadonlyMap<string, MeasureTimeline>;
    eventsByMeasure: ReadonlyMap<string, readonly TimedEventRef[]>;
    eventsBySequence: ReadonlyMap<string, readonly TimedEventRef[]>;
    eventsById: ReadonlyMap<string, readonly TimedEventRef[]>;
    eventsByPath: ReadonlyMap<string, TimedEventRef>;
}

export interface TimelineBuildOptions {
    includeRhythmDiagnostics?: boolean;
    allowPickupMeasure?: boolean;
    rhythmEpsilon?: number;
    fallbackBeats?: number;
}

const DEFAULT_TIMELINE_OPTIONS: Required<TimelineBuildOptions> = {
    includeRhythmDiagnostics: true,
    allowPickupMeasure: false,
    rhythmEpsilon: 0.000001,
    fallbackBeats: 4
};

export function buildScoreTimeline(score: Score, options: TimelineBuildOptions = {}): ScoreTimeline {
    const resolvedOptions = resolveTimelineOptions(options);
    const measures: MeasureTimeline[] = [];
    const diagnostics: TimelineDiagnostic[] = [];

    score.parts.forEach((part, partIndex) => {
        part.measures.forEach((_measure, measureIndex) => {
            const measureTimeline = buildMeasureTimeline(score, partIndex, measureIndex, resolvedOptions);
            measures.push(measureTimeline);
            diagnostics.push(...measureTimeline.diagnostics);
        });
    });

    return { measures, diagnostics };
}

export function buildScoreTimelineIndex(score: Score, options: TimelineBuildOptions = {}): ScoreTimelineIndex {
    return indexScoreTimeline(buildScoreTimeline(score, options));
}

export function indexScoreTimeline(timeline: ScoreTimeline): ScoreTimelineIndex {
    const events: TimedEventRef[] = [];
    const measuresByKey = new Map<string, MeasureTimeline>();
    const eventsByMeasure = new Map<string, TimedEventRef[]>();
    const eventsBySequence = new Map<string, TimedEventRef[]>();
    const eventsById = new Map<string, TimedEventRef[]>();
    const eventsByPath = new Map<string, TimedEventRef>();

    for (const measure of timeline.measures) {
        const measureKey = createTimelineMeasureKey(measure);
        measuresByKey.set(measureKey, measure);

        for (const sequence of measure.sequences) {
            const sequenceKey = createTimelineSequenceKey({
                partIndex: measure.partIndex,
                measureIndex: measure.measureIndex,
                sequenceIndex: sequence.sequenceIndex
            });

            for (const event of sequence.events) {
                events.push(event);
                pushMapArray(eventsByMeasure, measureKey, event);
                pushMapArray(eventsBySequence, sequenceKey, event);

                if (event.id) {
                    pushMapArray(eventsById, event.id, event);
                }

                eventsByPath.set(event.path, event);
            }
        }
    }

    return {
        timeline,
        events,
        measuresByKey,
        eventsByMeasure,
        eventsBySequence,
        eventsById,
        eventsByPath
    };
}

export function getTimelineMeasure(
    index: ScoreTimelineIndex,
    selector: TimelineMeasureSelector
): MeasureTimeline | undefined {
    return index.measuresByKey.get(createTimelineMeasureKey(selector));
}

export function getTimelineEventsForMeasure(
    index: ScoreTimelineIndex,
    selector: TimelineMeasureSelector
): readonly TimedEventRef[] {
    return index.eventsByMeasure.get(createTimelineMeasureKey(selector)) ?? [];
}

export function getTimelineEventsForSequence(
    index: ScoreTimelineIndex,
    selector: TimelineSequenceSelector
): readonly TimedEventRef[] {
    return index.eventsBySequence.get(createTimelineSequenceKey(selector)) ?? [];
}

export function getTimelineEventsById(
    index: ScoreTimelineIndex,
    id: string
): readonly TimedEventRef[] {
    return index.eventsById.get(id) ?? [];
}

export function getTimelineEventByPath(
    index: ScoreTimelineIndex,
    path: string
): TimedEventRef | undefined {
    return index.eventsByPath.get(path);
}

export function buildMeasureTimeline(
    score: Score,
    partIndex: number,
    measureIndex: number,
    options: TimelineBuildOptions = {}
): MeasureTimeline {
    const resolvedOptions = resolveTimelineOptions(options);
    const part = score.parts[partIndex];
    const measure = part?.measures[measureIndex];
    const path = `parts[${partIndex}].measures[${measureIndex}]`;
    const diagnostics: TimelineDiagnostic[] = [];

    if (!part || !measure) {
        diagnostics.push({
            severity: "error",
            code: "timeline-missing-measure",
            message: `Missing part ${partIndex + 1} or measure ${measureIndex + 1}.`,
            path
        });

        return {
            partId: part?.id,
            partIndex,
            measureIndex,
            measureNumber: measureIndex + 1,
            expectedBeats: 0,
            sequences: [],
            diagnostics
        };
    }

    const measureNumber = measure.index ?? measureIndex + 1;
    const expectedBeats = getTimeSignatureBeats(
        resolveTimeSignatureForMeasure(score, measureIndex, measureNumber),
        resolvedOptions.fallbackBeats
    );
    const sequences = measure.sequences.map((sequence, sequenceIndex) => {
        const sequencePath = `${path}.sequences[${sequenceIndex}]`;
        const events: TimedEventRef[] = [];
        const usedBeats = collectTimedEvents(
            sequence.content,
            {
                partIndex,
                measureIndex,
                sequenceIndex,
                path: `${sequencePath}.content`,
                contentPath: [],
                startBeat: 0,
                scale: 1,
                grace: false
            },
            events
        );
        const sequenceDiagnostics = getSequenceDiagnostics(
            usedBeats,
            expectedBeats,
            sequencePath,
            measureIndex,
            resolvedOptions
        );
        diagnostics.push(...sequenceDiagnostics);

        return {
            sequenceIndex,
            expectedBeats,
            usedBeats,
            events,
            diagnostics: sequenceDiagnostics
        };
    });

    return {
        partId: part.id,
        partIndex,
        measureIndex,
        measureNumber,
        expectedBeats,
        sequences,
        diagnostics
    };
}

export function resolveTimeSignatureForMeasure(
    score: Score,
    measureIndex: number,
    measureNumber = measureIndex + 1
): { count?: number; unit?: number } | undefined {
    let resolved = score.global.measures[0]?.time;

    score.global.measures.forEach((globalMeasure, index) => {
        const globalMeasureNumber = globalMeasure.index ?? index + 1;
        if (globalMeasureNumber <= measureNumber && globalMeasure.time) {
            resolved = globalMeasure.time;
        }
    });

    return resolved;
}

export function getTimelineEventSource(
    score: Score,
    event: Pick<TimedEventRef, "partIndex" | "measureIndex" | "sequenceIndex" | "contentPath">
): unknown {
    let content = score.parts[event.partIndex]
        ?.measures[event.measureIndex]
        ?.sequences[event.sequenceIndex]
        ?.content as unknown[] | undefined;

    let item: unknown;
    for (let index = 0; index < event.contentPath.length; index += 1) {
        if (!Array.isArray(content)) return undefined;
        item = content[event.contentPath[index]];

        if (index < event.contentPath.length - 1) {
            content = isRecord(item) && Array.isArray(item.content)
                ? item.content
                : undefined;
        }
    }

    return item;
}

interface TimelineWalkContext {
    partIndex: number;
    measureIndex: number;
    sequenceIndex: number;
    path: string;
    contentPath: number[];
    startBeat: number;
    scale: number;
    grace: boolean;
}

function collectTimedEvents(
    content: unknown[],
    context: TimelineWalkContext,
    events: TimedEventRef[]
): number {
    let beat = context.startBeat;

    for (const [index, item] of content.entries()) {
        if (!isRecord(item)) continue;

        const contentPath = [...context.contentPath, index];
        const path = `${context.path}[${index}]`;

        if (item.type === "tuplet" && Array.isArray(item.content)) {
            const startBeat = beat;
            const childScale = context.scale * getTupletScale(item);
            const endBeat = collectTimedEvents(
                item.content,
                {
                    ...context,
                    path: `${path}.content`,
                    contentPath,
                    startBeat,
                    scale: childScale
                },
                events
            );
            events.push(createTimedEvent(item, "tuplet", context, contentPath, path, startBeat, endBeat - startBeat, 0));
            beat = endBeat;
            continue;
        }

        if (item.type === "grace" && Array.isArray(item.content)) {
            events.push(createTimedEvent(item, "grace", context, contentPath, path, beat, 0, 0, true));
            collectTimedEvents(
                item.content,
                {
                    ...context,
                    path: `${path}.content`,
                    contentPath,
                    startBeat: beat,
                    grace: true
                },
                events
            );
            continue;
        }

        if (item.type === "dynamic") {
            events.push(createTimedEvent(item, "dynamic", context, contentPath, path, beat, 0, 0));
            continue;
        }

        if (Array.isArray(item.notes) && item.notes.length > 0) {
            const nominalDurationBeats = getDurationInBeats(asNoteValue(item.duration)) * context.scale;
            const durationBeats = context.grace ? 0 : nominalDurationBeats;
            events.push(createTimedEvent(
                item,
                "note",
                context,
                contentPath,
                path,
                beat,
                durationBeats,
                nominalDurationBeats
            ));
            beat += durationBeats;
            continue;
        }

        if (isRecord(item.rest)) {
            const nominalDurationBeats = getDurationInBeats(asNoteValue(item.duration)) * context.scale;
            const durationBeats = context.grace ? 0 : nominalDurationBeats;
            events.push(createTimedEvent(
                item,
                "rest",
                context,
                contentPath,
                path,
                beat,
                durationBeats,
                nominalDurationBeats
            ));
            beat += durationBeats;
        }
    }

    return beat;
}

function createTimedEvent(
    item: Record<string, unknown>,
    kind: TimelineEventKind,
    context: TimelineWalkContext,
    contentPath: number[],
    path: string,
    startBeat: number,
    durationBeats: number,
    nominalDurationBeats: number,
    grace = context.grace
): TimedEventRef {
    return {
        id: typeof item.id === "string" ? item.id : undefined,
        kind,
        partIndex: context.partIndex,
        measureIndex: context.measureIndex,
        sequenceIndex: context.sequenceIndex,
        contentPath,
        path,
        startBeat,
        durationBeats,
        nominalDurationBeats,
        scale: context.scale,
        grace,
        hidden: isRecord(item.rest) ? item.rest.hidden === true : undefined,
        staff: resolveStaff(item),
        position: { fraction: [startBeat, 1] }
    };
}

function getSequenceDiagnostics(
    usedBeats: number,
    expectedBeats: number,
    path: string,
    measureIndex: number,
    options: Required<TimelineBuildOptions>
): TimelineDiagnostic[] {
    if (!options.includeRhythmDiagnostics) return [];
    if (!Number.isFinite(expectedBeats) || expectedBeats <= 0) return [];

    const delta = usedBeats - expectedBeats;
    if (Math.abs(delta) <= options.rhythmEpsilon) return [];
    if (options.allowPickupMeasure && measureIndex === 0 && delta < 0) return [];

    return [{
        severity: "warning",
        code: delta > 0 ? "rhythm-overfull" : "rhythm-underfull",
        message: `Sequence uses ${roundBeats(usedBeats)} beats, expected ${roundBeats(expectedBeats)}.`,
        path
    }];
}

function resolveTimelineOptions(options: TimelineBuildOptions): Required<TimelineBuildOptions> {
    return {
        ...DEFAULT_TIMELINE_OPTIONS,
        ...options
    };
}

function createTimelineMeasureKey(selector: TimelineMeasureSelector): string {
    return `${selector.partIndex}:${selector.measureIndex}`;
}

function createTimelineSequenceKey(selector: TimelineSequenceSelector): string {
    return `${selector.partIndex}:${selector.measureIndex}:${selector.sequenceIndex}`;
}

function pushMapArray<K, V>(map: Map<K, V[]>, key: K, value: V): void {
    const values = map.get(key);
    if (values) {
        values.push(value);
        return;
    }

    map.set(key, [value]);
}

function roundBeats(value: number): number {
    return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function resolveStaff(item: Record<string, unknown>): number | undefined {
    if (typeof item.staff === "number") return item.staff;
    if (Array.isArray(item.notes)) {
        const firstStaff = item.notes
            .map((note) => isRecord(note) ? note.staff : undefined)
            .find((staff): staff is number => typeof staff === "number");
        return firstStaff;
    }
    return undefined;
}

function asNoteValue(value: unknown): NoteValue | undefined {
    if (!isRecord(value) || typeof value.base !== "string") return undefined;
    return value as NoteValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}
