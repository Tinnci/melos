import type { PartMeasure, Sequence, Event, Note, Beam } from "@melos/core";
import { generateEventId } from "./Utils";

// Container interface for handling nested structures like Tuplets
export interface Container {
    content: any[];
    // To track if this container corresponds to a MusicXML tuplet start/stop
    endCondition?: { type: 'tuplet'; number?: number };
}

export class MeasureParser {
    private events: (Event | any)[] = []; // Allow Tuplets in the future
    private beams: Beam[] = [];

    // Track active beams for ID association
    // key: beam number (MusicXML supports nested beams 1, 2, 3...)
    private activeBeams: Record<number, { eventIds: string[] }> = {};

    constructor(private xmlMeasure: any) { }

    parse(): PartMeasure {
        const rootContent: any[] = [];
        let currentEvent: Event | null = null;

        // Notes mapping
        const xmlNotes = this.xmlMeasure.note ? (Array.isArray(this.xmlMeasure.note) ? this.xmlMeasure.note : [this.xmlMeasure.note]) : [];

        for (const xNote of xmlNotes) {
            const isRest = xNote.rest !== undefined;
            const isChord = xNote.chord !== undefined;

            // --- Duration Logic ---
            const durBase: any = xNote.type || "quarter";
            // Handle dots
            let dots = 0;
            if (xNote.dot) {
                dots = Array.isArray(xNote.dot) ? xNote.dot.length : 1;
            }

            // --- Pitch / Note Logic ---
            let noteObj: Note | null = null;
            if (!isRest && xNote.pitch) {
                noteObj = {
                    pitch: {
                        step: xNote.pitch.step,
                        octave: parseInt(xNote.pitch.octave),
                        alter: xNote.pitch.alter ? parseInt(xNote.pitch.alter) : undefined
                    }
                };

                // Accidentals
                if (xNote.accidental) {
                    noteObj.accidentalDisplay = {
                        show: true
                    };
                }
            }

            // --- Event Generation & Grouping (Chords) ---
            let eventId: string;

            if (isChord && currentEvent && !isRest) {
                // Add note to existing event (Chord)
                if (noteObj && currentEvent.notes) {
                    currentEvent.notes.push(noteObj);
                }
                eventId = currentEvent.id!; // Reuse ID for beams logic? No, beams usually span events. But wait, chord notes share event.
            } else {
                // New Event
                eventId = generateEventId();
                const evt: Event = {
                    id: eventId,
                    duration: { base: durBase, dots: dots }
                };

                if (isRest) {
                    evt.rest = {};
                } else if (noteObj) {
                    evt.notes = [noteObj];
                }

                currentEvent = evt;
                rootContent.push(evt);
            }
        }

        // Clefs
        let clefs = undefined;
        if (this.xmlMeasure.attributes && this.xmlMeasure.attributes.clef) {
            const c = this.xmlMeasure.attributes.clef;
            clefs = [{
                clef: {
                    sign: c.sign,
                    line: c.line ? parseInt(c.line) : undefined
                },
                staff: 1
            }];
        }

        return {
            sequences: [{ content: rootContent }],
            clefs: clefs,
            beams: this.beams.length > 0 ? this.beams : undefined
        };
    }
}
