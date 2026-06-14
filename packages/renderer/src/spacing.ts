import { buildMeasureTimeline, type TimedEventRef, type Score } from "@melos/core";
import type { RenderPlanMeasure } from "./plan";

export interface MeasureSpacing {
    partIndex: number;
    measureIndex: number;
    contentX: number;
    contentWidth: number;
    durationBeats: number;
    pixelsPerBeat: number;
    columns: SpacingColumn[];
    events: SpacingEventPosition[];
    eventsById: ReadonlyMap<string, readonly SpacingEventPosition[]>;
    eventsByPath: ReadonlyMap<string, SpacingEventPosition>;
}

export interface SpacingColumn {
    beat: number;
    x: number;
    events: SpacingEventPosition[];
}

export interface SpacingEventPosition {
    event: TimedEventRef;
    x: number;
    columnIndex: number;
    visualWidth: number;
}

export interface MeasureSpacingOptions {
    fallbackDurationBeats?: number;
}

const DEFAULT_SPACING_OPTIONS: Required<MeasureSpacingOptions> = {
    fallbackDurationBeats: 1
};

export function solveMeasureSpacing(
    score: Score,
    measure: RenderPlanMeasure,
    options: MeasureSpacingOptions = {}
): MeasureSpacing {
    const resolvedOptions = { ...DEFAULT_SPACING_OPTIONS, ...options };
    const timeline = buildMeasureTimeline(score, measure.partIndex, measure.measureIndex, {
        includeRhythmDiagnostics: false
    });
    const durationBeats = resolveMeasureDurationBeats(timeline, resolvedOptions.fallbackDurationBeats);
    const pixelsPerBeat = durationBeats > 0 ? measure.contentWidth / durationBeats : 0;
    const visualWidthsByPath = new Map(measure.layout.contributions.map((contribution) => [
        contribution.path,
        contribution.width
    ]));
    const columnsByBeat = new Map<string, SpacingColumn>();
    const events: SpacingEventPosition[] = [];
    const eventsById = new Map<string, SpacingEventPosition[]>();
    const eventsByPath = new Map<string, SpacingEventPosition>();

    for (const sequence of timeline.sequences) {
        for (const event of sequence.events) {
            const beat = normalizeBeat(event.startBeat);
            const x = measure.contentX + (beat * pixelsPerBeat);
            const column = getOrCreateColumn(columnsByBeat, beat, x);
            const positionedEvent: SpacingEventPosition = {
                event,
                x,
                columnIndex: -1,
                visualWidth: visualWidthsByPath.get(event.path) ?? 0
            };

            column.events.push(positionedEvent);
            events.push(positionedEvent);
            eventsByPath.set(event.path, positionedEvent);
            if (event.id) {
                pushMapArray(eventsById, event.id, positionedEvent);
            }
        }
    }

    const columns = Array.from(columnsByBeat.values()).sort((left, right) => left.beat - right.beat);
    columns.forEach((column, columnIndex) => {
        column.events.forEach((event) => {
            event.columnIndex = columnIndex;
        });
    });

    events.sort((left, right) => (
        left.event.partIndex - right.event.partIndex
        || left.event.measureIndex - right.event.measureIndex
        || left.event.sequenceIndex - right.event.sequenceIndex
        || left.event.startBeat - right.event.startBeat
        || left.event.path.localeCompare(right.event.path)
    ));

    return {
        partIndex: measure.partIndex,
        measureIndex: measure.measureIndex,
        contentX: measure.contentX,
        contentWidth: measure.contentWidth,
        durationBeats,
        pixelsPerBeat,
        columns,
        events,
        eventsById,
        eventsByPath
    };
}

function resolveMeasureDurationBeats(
    timeline: ReturnType<typeof buildMeasureTimeline>,
    fallbackDurationBeats: number
): number {
    const usedBeats = timeline.sequences.map((sequence) => sequence.usedBeats);
    const durationBeats = Math.max(timeline.expectedBeats, ...usedBeats, 0);
    return durationBeats > 0 ? durationBeats : fallbackDurationBeats;
}

function getOrCreateColumn(
    columnsByBeat: Map<string, SpacingColumn>,
    beat: number,
    x: number
): SpacingColumn {
    const key = beat.toString();
    const existing = columnsByBeat.get(key);
    if (existing) return existing;

    const column: SpacingColumn = { beat, x, events: [] };
    columnsByBeat.set(key, column);
    return column;
}

function normalizeBeat(value: number): number {
    return Math.max(0, Math.round((value + Number.EPSILON) * 1000000) / 1000000);
}

function pushMapArray<K, V>(map: Map<K, V[]>, key: K, value: V): void {
    const values = map.get(key);
    if (values) {
        values.push(value);
        return;
    }

    map.set(key, [value]);
}
