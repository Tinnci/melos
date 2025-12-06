import type { PartMeasure, Sequence, Event, Note, Beam, Tuplet, Tie, Slur } from "@melos/core";
import { generateEventId, generateNoteId } from "./Utils";

// Container interface for handling nested structures like Tuplets
export interface Container {
    content: any[];
    endCondition?: { type: 'tuplet'; number?: number };
}

// Context to track state across measures (Slurs, Ties)
export interface PartParsingContext {
    // Key: slur number
    activeSlurs: Record<number, { sourceEvent: Event }>;
    // Key: pitch string (e.g., "C4") as tie connects same pitches usually. 
    // Or tracked by <tied number="..."> if available. 
    // Using a composite key or simple number if provided.
    activeTies: Record<string, { sourceNote: Note }>;
}

export class MeasureParser {
    private beams: Beam[] = [];
    private activeBeams: Record<number, { eventIds: string[] }> = {};

    constructor(
        private xmlMeasure: any,
        private context: PartParsingContext
    ) { }

    parse(): PartMeasure {
        const rootContent: any[] = [];
        const containerStack: Container[] = [{ content: rootContent }];

        let currentEvent: Event | null = null;

        const xmlNotes = this.xmlMeasure.note ? (Array.isArray(this.xmlMeasure.note) ? this.xmlMeasure.note : [this.xmlMeasure.note]) : [];

        for (const xNote of xmlNotes) {
            // --- 0. Stack Management (Tuplet Start/Stop) ---
            let currentContainer = containerStack[containerStack.length - 1];

            if (xNote.notations) {
                const notations = Array.isArray(xNote.notations) ? xNote.notations : [xNote.notations];
                const tupletStartNode = notations.find((n: any) => n?.tuplet?.["@_type"] === "start");

                if (tupletStartNode) {
                    const newTuplet: Tuplet = {
                        type: "tuplet",
                        content: []
                    };
                    currentContainer.content.push(newTuplet);

                    const newContainer: Container = {
                        content: newTuplet.content,
                        endCondition: { type: 'tuplet' }
                    };
                    containerStack.push(newContainer);
                    currentContainer = newContainer;
                }
            }

            // --- 1. Event / Note Logic ---
            const isRest = xNote.rest !== undefined;
            const isChord = xNote.chord !== undefined;
            const durBase: any = xNote.type || "quarter";

            let dots = 0;
            if (xNote.dot) {
                dots = Array.isArray(xNote.dot) ? xNote.dot.length : 1;
            }

            // Pitch Logic
            let noteObj: Note | null = null;
            let pitchKey = ""; // for tie tracking

            if (!isRest && xNote.pitch) {
                noteObj = {
                    // Generate ID for notes to support Ties
                    id: generateNoteId(),
                    pitch: {
                        step: xNote.pitch.step,
                        octave: parseInt(xNote.pitch.octave),
                        alter: xNote.pitch.alter ? parseInt(xNote.pitch.alter) : undefined
                    }
                };
                if (xNote.accidental) {
                    noteObj.accidentalDisplay = { show: true };
                }

                pitchKey = `${xNote.pitch.step}${xNote.pitch.octave}`;
            }

            // Event Generation
            let eventId: string;

            if (isChord && currentEvent && !isRest) {
                if (noteObj && currentEvent.notes) {
                    currentEvent.notes.push(noteObj);
                }
                eventId = currentEvent.id!;
            } else {
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

                currentContainer.content.push(evt);
                currentEvent = evt;
            }

            // --- 1.2 Slurs Logic (Event Level) ---
            if (xNote.notations) {
                const notations = Array.isArray(xNote.notations) ? xNote.notations : [xNote.notations];

                // Find all slurs
                notations.forEach((n: any) => {
                    if (n.slur) {
                        const slurs = Array.isArray(n.slur) ? n.slur : [n.slur];
                        slurs.forEach((s: any) => {
                            const number = parseInt(s["@_number"] || "1");
                            const type = s["@_type"]; // start or stop

                            if (type === "start" && currentEvent) {
                                // Record start
                                this.context.activeSlurs[number] = { sourceEvent: currentEvent };
                            } else if (type === "stop" && currentEvent) {
                                // Resolve end
                                const pending = this.context.activeSlurs[number];
                                if (pending) {
                                    // Add Slur object to SOURCE event, pointing to CURRENT event (target)
                                    const source = pending.sourceEvent;

                                    if (!source.slurs) source.slurs = [];

                                    source.slurs.push({
                                        target: currentEvent.id!,
                                        side: s["@_placement"] === "below" ? "down" : "up"
                                    });

                                    delete this.context.activeSlurs[number];
                                }
                            }
                        });
                    }

                    // --- 1.3 Ties Logic (Note Level) ---
                    // MusicXML uses <tied type="start/stop"/>
                    if (n.tied && noteObj) {
                        const tieds = Array.isArray(n.tied) ? n.tied : [n.tied];
                        tieds.forEach((t: any) => {
                            const type = t["@_type"];

                            // Use pitchKey as identifier if number not present
                            // Actually, MusicXML ties usually just link adjacent notes of same pitch
                            const key = t["@_number"] ? `num:${t["@_number"]}` : pitchKey;

                            if (type === "start") {
                                this.context.activeTies[key] = { sourceNote: noteObj! };
                            } else if (type === "stop") {
                                const pending = this.context.activeTies[key];
                                if (pending) {
                                    const source = pending.sourceNote;

                                    if (!source.ties) source.ties = [];
                                    source.ties.push({
                                        target: noteObj!.id!
                                    });

                                    delete this.context.activeTies[key];
                                }
                            }
                        });
                    }
                });
            }


            // --- 1.5 Beam Logic ---
            if (xNote.beam) {
                const beamList = Array.isArray(xNote.beam) ? xNote.beam : [xNote.beam];
                beamList.forEach((b: any) => {
                    const number = parseInt(b["@_number"] || "1");
                    const type = b["#text"];

                    if (type === "begin") {
                        this.activeBeams[number] = { eventIds: [eventId] };
                    } else if (type === "continue") {
                        if (this.activeBeams[number]) {
                            this.activeBeams[number].eventIds.push(eventId);
                        }
                    } else if (type === "end") {
                        if (this.activeBeams[number]) {
                            this.activeBeams[number].eventIds.push(eventId);
                            this.beams.push({
                                events: this.activeBeams[number].eventIds
                            });
                            delete this.activeBeams[number];
                        }
                    }
                });
            }

            // --- 2. Tuplet STOP Logic ---
            if (xNote.notations) {
                const notations = Array.isArray(xNote.notations) ? xNote.notations : [xNote.notations];
                const tupletStopNode = notations.find((n: any) => n?.tuplet?.["@_type"] === "stop");

                if (tupletStopNode) {
                    if (containerStack.length > 1 && currentContainer.endCondition?.type === 'tuplet') {
                        containerStack.pop();
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
            sequences: [{ content: rootContent }],
            clefs: clefs,
            beams: this.beams.length > 0 ? this.beams : undefined
        };
    }
}
