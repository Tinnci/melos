import type { Pitch, NoteValue } from "@melos/core";

interface NoteValueQuantity {
    duration?: NoteValue;
    multiple?: number;
}

const NOTE_OFFSETS: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11
};

export function pitchToMidi(pitch: Pitch): number {
    const stepVal = NOTE_OFFSETS[pitch.step] || 0;
    const octaveVal = (pitch.octave + 1) * 12;
    const alterVal = pitch.alter || 0;
    return octaveVal + stepVal + alterVal;
}

export function midiToFreq(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

export function getDurationInBeats(duration?: NoteValue): number {
    if (!duration) return 0;
    let beats = 1.0;

    switch (duration.base) {
        case "duplexMaxima": beats = 64; break;
        case "maxima": beats = 32; break;
        case "longa": beats = 16; break;
        case "breve": beats = 8; break;
        case "whole": beats = 4; break;
        case "half": beats = 2; break;
        case "quarter": beats = 1; break;
        case "eighth": beats = 0.5; break;
        case "16th": beats = 0.25; break;
        case "32nd": beats = 0.125; break;
        case "64th": beats = 0.0625; break;
        case "128th": beats = 0.03125; break;
        case "256th": beats = 0.015625; break;
        case "512th": beats = 0.0078125; break;
        case "1024th": beats = 0.00390625; break;
        case "2048th": beats = 0.001953125; break;
        case "4096th": beats = 0.0009765625; break;
        case "long" as any: beats = 16; break;
        case "/8" as any: beats = 0.5; break;
        case "/16" as any: beats = 0.25; break;
        case "/32" as any: beats = 0.125; break;
        default: beats = 1; break;
    }

    // Handle dots
    if (duration.dots) {
        let add = beats * 0.5;
        for (let i = 0; i < duration.dots; i++) {
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

function isNoteValueQuantity(value: unknown): value is NoteValueQuantity {
    return isRecord(value) && isNoteValue(value.duration);
}

function isNoteValue(value: unknown): value is NoteValue {
    return isRecord(value) && typeof value.base === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}
