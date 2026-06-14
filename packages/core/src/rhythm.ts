import type { NoteValue } from "./schema";

interface NoteValueQuantity {
    duration?: NoteValue;
    multiple?: number;
}

interface TimeSignatureLike {
    count?: number;
    unit?: number;
}

const NOTE_VALUE_BEATS: Record<string, number> = {
    duplexMaxima: 64,
    maxima: 32,
    longa: 16,
    long: 16,
    breve: 8,
    whole: 4,
    half: 2,
    quarter: 1,
    eighth: 0.5,
    "/8": 0.5,
    "16th": 0.25,
    "/16": 0.25,
    "32nd": 0.125,
    "/32": 0.125,
    "64th": 0.0625,
    "128th": 0.03125,
    "256th": 0.015625,
    "512th": 0.0078125,
    "1024th": 0.00390625,
    "2048th": 0.001953125,
    "4096th": 0.0009765625,
};

export function getDurationInBeats(duration?: NoteValue | null): number {
    if (!duration) return 0;

    let beats = NOTE_VALUE_BEATS[duration.base] ?? 1;

    if (duration.dots) {
        let add = beats * 0.5;
        for (let index = 0; index < duration.dots; index += 1) {
            beats += add;
            add *= 0.5;
        }
    }

    return beats;
}

export function getNoteValueQuantityInBeats(value: unknown): number {
    if (!isNoteValueQuantity(value)) return 0;
    return getDurationInBeats(value.duration) * (value.multiple || 1);
}

export function getTupletScale(tuplet: unknown): number {
    if (!isRecord(tuplet)) return 1;

    const inner = getNoteValueQuantityInBeats(tuplet.inner);
    const outer = getNoteValueQuantityInBeats(tuplet.outer);
    return inner > 0 && outer > 0 ? outer / inner : 1;
}

export function getSequenceContentBeats(content: unknown[], scale = 1): number {
    let beats = 0;

    for (const item of content) {
        if (!isRecord(item)) continue;

        if (item.type === "grace" || item.type === "dynamic") {
            continue;
        }

        if (item.type === "tuplet" && Array.isArray(item.content)) {
            beats += getSequenceContentBeats(item.content, scale * getTupletScale(item));
            continue;
        }

        if (isNoteValue(item.duration)) {
            beats += getDurationInBeats(item.duration) * scale;
        }
    }

    return beats;
}

export function getTimeSignatureBeats(time?: TimeSignatureLike | null, fallbackBeats = 4): number {
    if (
        !time ||
        !Number.isFinite(time.count) ||
        !Number.isFinite(time.unit) ||
        !time.count ||
        !time.unit ||
        time.count <= 0 ||
        time.unit <= 0
    ) {
        return fallbackBeats;
    }

    return time.count * (4 / time.unit);
}

function isNoteValueQuantity(value: unknown): value is NoteValueQuantity {
    return isRecord(value) && isNoteValue(value.duration);
}

function isNoteValue(value: unknown): value is NoteValue {
    return isRecord(value) && typeof value.base === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}
