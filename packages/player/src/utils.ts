import type { Pitch } from "@melos/core";
export { getDurationInBeats, getNoteValueQuantityInBeats, getTupletScale } from "@melos/core";

const NOTE_OFFSETS: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
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
