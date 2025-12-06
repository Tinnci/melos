import { XMLParser } from "fast-xml-parser";
import type { Score, GlobalMeasure, Part, PartMeasure, Sequence, Event, Note, AccidentalDisplaySchema } from "@melos/core";

// Helper to generate IDs
let eventIdCounter = 0;
function generateEventId() {
    return `ev${++eventIdCounter}`;
}

export class MusicXMLToMNX {
    private xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

    convert(xmlContent: string): Score {
        eventIdCounter = 0; // Reset counter
        const xmlObj = this.xmlParser.parse(xmlContent);
        const root = xmlObj["score-partwise"];

        if (!root) {
            throw new Error("Invalid MusicXML: Missing score-partwise");
        }

        // 1. Build Global Track (Time, Key) 
        const partsArray = Array.isArray(root.part) ? root.part : [root.part];
        const firstPartMeasures = Array.isArray(partsArray[0]?.measure) ? partsArray[0].measure : [partsArray[0]?.measure];

        const globalMeasures: GlobalMeasure[] = [];

        firstPartMeasures.forEach((m: any, index: number) => {
            const gm: GlobalMeasure = {}; // Removed index, implicit in array order usually, but schema has it optionally

            // Extract Time Signature
            if (m.attributes && m.attributes.time) {
                gm.time = {
                    count: parseInt(m.attributes.time.beats),
                    unit: parseInt(m.attributes.time["beat-type"])
                };
            }

            // Extract Key Signature
            if (m.attributes && m.attributes.key) {
                gm.key = {
                    fifths: parseInt(m.attributes.key.fifths)
                };
                // Simplify mode handling for now
                if (m.attributes.key.mode) {
                    gm.key.mode = m.attributes.key.mode;
                }
            }

            // Extract Barline
            if (m.barline) {
                const style = m.barline["bar-style"];
                if (style === "light-heavy") {
                    gm.barline = { type: "final" }; // Mapping approximate
                }
            }

            globalMeasures.push(gm);
        });

        // 2. Build Parts
        const mnxParts: Part[] = partsArray.map((p: any, pIndex: number) => {
            const partMeasuresRaw = Array.isArray(p.measure) ? p.measure : [p.measure];

            const mnxMeasures: PartMeasure[] = partMeasuresRaw.map((m: any, mIndex: number) => {
                const events: Event[] = [];
                let currentEvent: Event | null = null;

                // Notes mapping
                const xmlNotes = m.note ? (Array.isArray(m.note) ? m.note : [m.note]) : [];

                for (const xNote of xmlNotes) {
                    const isRest = xNote.rest !== undefined;
                    const isChord = xNote.chord !== undefined;

                    // --- Duration Logic ---
                    const durBase: any = xNote.type || "quarter";
                    // Handle dots (MusicXML can have multiple <dot/> elements)
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
                                show: true // Simplified: if explicit accidental exists, show it
                            };
                            // MusicXML accidental values: sharp, flat, natural, etc.
                            // MNX relies on 'alter' for sound and 'accidentalDisplay' for visual
                        }

                        // Ties
                        if (xNote.tie) {
                            const ties = Array.isArray(xNote.tie) ? xNote.tie : [xNote.tie];
                            // Logic for ties is complex: MusicXML has start/stop.
                            // MNX only marks the "source" note with a target ID.
                            // This requires a second pass or state tracking. 
                            // For MVP we just placeholder this structure.
                            // Ideally we'd look ahead or back.
                        }
                    }

                    // --- Event Grouping (Chords) ---
                    if (isChord && currentEvent && !isRest) {
                        // Normalize duration: chords share duration
                        if (noteObj && currentEvent.notes) {
                            currentEvent.notes.push(noteObj);
                        }
                    } else {
                        // New Event
                        const evt: Event = {
                            id: generateEventId(),
                            duration: { base: durBase, dots: dots }
                        };

                        if (isRest) {
                            evt.rest = {};
                        } else if (noteObj) {
                            evt.notes = [noteObj];
                        }

                        currentEvent = evt;
                        events.push(evt);
                    }
                }

                // Clefs
                let clefs = undefined;
                if (m.attributes && m.attributes.clef) {
                    const c = m.attributes.clef;
                    clefs = [{
                        clef: {
                            sign: c.sign,
                            line: c.line ? parseInt(c.line) : undefined
                        },
                        staff: 1 // Default to staff 1
                    }];
                }

                return {
                    sequences: [{ content: events }],
                    clefs: clefs
                };
            });

            return {
                id: `P${pIndex + 1}`,
                name: `Part ${pIndex + 1}`,
                measures: mnxMeasures
            };
        });

        return {
            mnx: { version: 1 },
            global: { measures: globalMeasures },
            parts: mnxParts
        };
    }
}
