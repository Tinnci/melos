import type { PartMeasure, Sequence, Event, Note, Beam, Tuplet } from "@melos/core";
import { generateEventId } from "./Utils";

// Container interface for handling nested structures like Tuplets
export interface Container {
    content: any[];
    // To track if this container corresponds to a MusicXML tuplet start/stop
    endCondition?: { type: 'tuplet'; number?: number };
}

export class MeasureParser {
    private beams: Beam[] = [];

    // Track active beams
    private activeBeams: Record<number, { eventIds: string[] }> = {};

    constructor(private xmlMeasure: any) { }

    parse(): PartMeasure {
        const rootContent: any[] = [];
        // The Stack: starts with the root sequence content
        const containerStack: Container[] = [{ content: rootContent }];

        let currentEvent: Event | null = null;

        // Notes mapping
        const xmlNotes = this.xmlMeasure.note ? (Array.isArray(this.xmlMeasure.note) ? this.xmlMeasure.note : [this.xmlMeasure.note]) : [];

        for (const xNote of xmlNotes) {
            // --- 0. Stack Management (Tuplet Start/Stop) ---

            // Get current container (Top of Stack)
            let currentContainer = containerStack[containerStack.length - 1];

            // Handle Tuplet START
            // Look for <notations><tuplet type="start">
            if (xNote.notations) {
                const notations = Array.isArray(xNote.notations) ? xNote.notations : [xNote.notations];
                const tupletStartNode = notations.find((n: any) => n?.tuplet?.["@_type"] === "start");

                if (tupletStartNode) {
                    // Calculate timings if available (MusicXML <time-modification>)
                    let outerDur = { base: xNote.type || "quarter", dots: 0 };
                    let innerDur = { base: xNote.type || "quarter", dots: 0 };

                    // Simple heuristic for now: usually you want to display the note type (inner) 
                    // and calculating outer is complex without more context.
                    // For MVP we create the structure.

                    const newTuplet: Tuplet = {
                        type: "tuplet",
                        // outer/inner calculations would go here based on <time-modification>
                        // <actual-notes>3</actual-notes> in the time of <normal-notes>2</normal-notes>
                        content: []
                    };

                    // Add to current container
                    currentContainer.content.push(newTuplet);

                    // Push to stack -> it becomes the new current container
                    const newContainer: Container = {
                        content: newTuplet.content,
                        endCondition: { type: 'tuplet' } // Could track number/ID if XML provides
                    };
                    containerStack.push(newContainer);
                    currentContainer = newContainer;
                }
            }


            // --- 1. Event / Note Logic ---
            const isRest = xNote.rest !== undefined;
            const isChord = xNote.chord !== undefined;
            const durBase: any = xNote.type || "quarter";

            // Handle dots
            let dots = 0;
            if (xNote.dot) {
                dots = Array.isArray(xNote.dot) ? xNote.dot.length : 1;
            }

            // Pitch Logic
            let noteObj: Note | null = null;
            if (!isRest && xNote.pitch) {
                noteObj = {
                    pitch: {
                        step: xNote.pitch.step,
                        octave: parseInt(xNote.pitch.octave),
                        alter: xNote.pitch.alter ? parseInt(xNote.pitch.alter) : undefined
                    }
                };
                if (xNote.accidental) {
                    noteObj.accidentalDisplay = { show: true };
                }
            }

            // Event Generation
            let eventId: string;

            if (isChord && currentEvent && !isRest) {
                // Determine if we are still in same container as previous event?
                // Chords should share the event, so we just modify currentEvent.
                // NOTE: Chords crossing tuplet boundaries is theoretically invalid MusicXML usually.

                if (noteObj && currentEvent.notes) {
                    currentEvent.notes.push(noteObj);
                }
                eventId = currentEvent.id!;
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

                // Add event to the CURRENT container (which might be a Tuplet)
                currentContainer.content.push(evt);
                currentEvent = evt;
            }


            // --- 2. Tuplet STOP Logic ---
            // Look for <notations><tuplet type="stop">
            // Important: Logic order matters. 
            // - Start Tuplet: affects THIS note and subsequent
            // - Stop Tuplet: affects THIS note (it's the last one IN the tuplet), then we pop.

            if (xNote.notations) {
                const notations = Array.isArray(xNote.notations) ? xNote.notations : [xNote.notations];
                const tupletStopNode = notations.find((n: any) => n?.tuplet?.["@_type"] === "stop");

                if (tupletStopNode) {
                    // Logic check: ensure we are actually inside a tuplet
                    if (containerStack.length > 1 && currentContainer.endCondition?.type === 'tuplet') {
                        containerStack.pop();
                        // currentContainer automatically updates next loop iteration or we reset it now roughly
                        // currentContainer = containerStack[containerStack.length - 1]; 
                    }
                }
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
            sequences: [{ content: rootContent }], // content now has nested Tuplets!
            clefs: clefs,
            beams: this.beams.length > 0 ? this.beams : undefined
        };
    }
}
