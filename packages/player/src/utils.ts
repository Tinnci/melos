import { Pitch, NoteValue } from "@melos/core";

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
        case "maxima": beats = 32; break;
        case "long": beats = 16; break;
        case "breve": beats = 8; break;
        case "whole": beats = 4; break;
        case "half": beats = 2; break;
        case "quarter": beats = 1; break;
        case "/8": beats = 0.5; break;
        case "/16": beats = 0.25; break;
        case "/32": beats = 0.125; break;
        // mappings for strings if scheme uses them
        case "eighth" as any: beats = 0.5; break;
        case "16th" as any: beats = 0.25; break;
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
