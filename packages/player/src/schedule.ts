import {
    buildScoreTimelineIndex,
    getTimelineEventsForMeasure,
    getTimelineMeasure,
    getTimelineEventSource,
    type Note,
    type Pitch,
    type Score
} from "@melos/core";

export interface ScheduledNote {
    pitch: Pitch;
    startTime: number;
    duration: number;
    partIndex: number;
    measureIndex: number;
    sequenceIndex: number;
    eventId?: string;
    noteId?: string;
}

export interface PlaybackScheduleOptions {
    tempo?: number;
    startTime?: number;
}

const DEFAULT_TEMPO = 120;

export function createPlaybackSchedule(
    score: Score,
    options: PlaybackScheduleOptions = {}
): ScheduledNote[] {
    const tempo = options.tempo ?? DEFAULT_TEMPO;
    const startTime = options.startTime ?? 0;
    const secondsPerBeat = 60 / tempo;
    const notes: ScheduledNote[] = [];
    const timelineIndex = buildScoreTimelineIndex(score, {
        includeRhythmDiagnostics: false
    });

    score.parts.forEach((part, partIndex) => {
        let partStartBeat = 0;

        part.measures.forEach((_measure, measureIndex) => {
            const timeline = getTimelineMeasure(timelineIndex, { partIndex, measureIndex });
            const measureDurationBeats = Math.max(
                timeline?.expectedBeats ?? 0,
                ...(timeline?.sequences.map((sequence) => sequence.usedBeats) ?? []),
                0
            );

            for (const event of getTimelineEventsForMeasure(timelineIndex, { partIndex, measureIndex })) {
                if (event.kind !== "note" || event.grace || event.durationBeats <= 0) continue;

                const source = getTimelineEventSource(score, event);
                if (!isPlayableEvent(source)) continue;

                source.notes.forEach((note) => {
                    if (!note.pitch) return;

                    notes.push({
                        pitch: note.pitch,
                        startTime: startTime + ((partStartBeat + event.startBeat) * secondsPerBeat),
                        duration: event.durationBeats * secondsPerBeat,
                        partIndex,
                        measureIndex,
                        sequenceIndex: event.sequenceIndex,
                        eventId: event.id,
                        noteId: note.id
                    });
                });
            }

            partStartBeat += measureDurationBeats;
        });
    });

    return notes.sort((left, right) => left.startTime - right.startTime);
}

function isPlayableEvent(value: unknown): value is { notes: Note[] } {
    return typeof value === "object"
        && value !== null
        && Array.isArray((value as { notes?: unknown }).notes);
}
