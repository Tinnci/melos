import { ScoreSchema, NoteSchema, type Score, type Note, type Event } from "@melos/core";

export class MnxParser {
    /**
     * Parse complete MNX JSON string
     */
    static parse(jsonString: string): Score {
        const rawData = JSON.parse(jsonString);
        return ScoreSchema.parse(rawData);
    }

    /**
     * Helper: Parse a single note (useful for partial updates/testing)
     */
    static parseNote(jsonString: string): Note {
        const rawData = JSON.parse(jsonString);
        return NoteSchema.parse(rawData);
    }

    /**
     * Semantic operation: Transpose a Note
     */
    static transposeNote(note: Note, semitones: number): Note {
        if (!note.pitch) return note;

        const newNote = structuredClone(note);
        if (newNote.pitch) {
            // Simplified transposition logic
            // In reality, this requires handling Key Signatures and Alterations cleanly.
            // Step mapping: C=0, D=2, E=4, F=5, G=7, A=9, B=11
            // This is a placeholder for checking structure mutability.
            newNote.pitch.octave += Math.floor(semitones / 12);
        }
        return newNote;
    }
}
