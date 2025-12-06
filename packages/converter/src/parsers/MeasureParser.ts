import type { PartMeasure, Sequence, Event, Note, Beam, Tuplet, Tie, Slur, Lyric } from "@melos/core";
import { generateEventId, generateNoteId } from "./Utils";

export interface Container {
    content: any[];
    endCondition?: { type: 'tuplet'; number?: number };
}

export interface PartParsingContext {
    activeSlurs: Record<number, { sourceEvent: Event }>;
    activeTies: Record<string, { sourceNote: Note }>;
    // To track Lyric Lines found in this part. 
    // We use a Map <lineId, name/number> to eventually bubble up to Global Track
    lyricLines: Map<string, { id: string, name: string }>;
}

// Track state per Voice
interface VoiceContext {
    root: any[]; // The top-level content array for this voice
    stack: Container[];
    currentEvent: Event | null; // Last created event in this voice (for chords)
}

export class MeasureParser {
    private beams: Beam[] = [];
    private activeBeams: Record<number, { eventIds: string[] }> = {};

    // Map voice ID (string) to its context
    private voiceContexts: Map<string, VoiceContext> = new Map();

    // To preserve order of voices found
    private voiceOrder: string[] = [];

    constructor(
        private xmlMeasure: any,
        private context: PartParsingContext
    ) { }

    private getVoiceContext(voiceId: string): VoiceContext {
        let ctx = this.voiceContexts.get(voiceId);
        if (!ctx) {
            const rootContent: any[] = [];
            ctx = {
                root: rootContent,
                stack: [{ content: rootContent }],
                currentEvent: null
            };
            this.voiceContexts.set(voiceId, ctx);
            this.voiceOrder.push(voiceId);
        }
        return ctx;
    }

    parse(): PartMeasure {
        const xmlNotes = this.xmlMeasure.note ? (Array.isArray(this.xmlMeasure.note) ? this.xmlMeasure.note : [this.xmlMeasure.note]) : [];

        for (const xNote of xmlNotes) {
            // Determine Voice ID (default to "1")
            const voiceId = xNote.voice ? String(xNote.voice) : "1";
            const ctx = this.getVoiceContext(voiceId);

            // --- 0. Stack Management (Tuplet Start/Stop) ---
            let currentContainer = ctx.stack[ctx.stack.length - 1];

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
                    ctx.stack.push(newContainer);
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
            let pitchKey = "";

            if (!isRest && xNote.pitch) {
                noteObj = {
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

            if (isChord && ctx.currentEvent && !isRest) {
                if (noteObj && ctx.currentEvent.notes) {
                    ctx.currentEvent.notes.push(noteObj);
                }
                eventId = ctx.currentEvent.id!;
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

                // --- 1.1 Lyrics Logic ---
                if (xNote.lyric) {
                    const lyrics = Array.isArray(xNote.lyric) ? xNote.lyric : [xNote.lyric];
                    const eventLyrics: Lyric[] = [];

                    lyrics.forEach((l: any) => {
                        const num = l["@_number"] || "1";
                        const lineId = `line${num}`;

                        // Update Global Context if new line found
                        if (!this.context.lyricLines.has(lineId)) {
                            // Try to infer name (e.g., from 'name' attribute or 'number')
                            const name = l["@_name"] || `Verse ${num}`;
                            this.context.lyricLines.set(lineId, { id: lineId, name });
                        }

                        eventLyrics.push({
                            text: l.text,
                            syllabic: l.syllabic, // begin, single, end, middle
                            line: lineId
                        });
                    });

                    if (eventLyrics.length > 0) {
                        evt.lyrics = eventLyrics;
                    }
                }

                currentContainer.content.push(evt);
                ctx.currentEvent = evt;
            }

            // --- 1.2 Slurs Logic (Event Level) ---
            if (xNote.notations) {
                const notations = Array.isArray(xNote.notations) ? xNote.notations : [xNote.notations];

                notations.forEach((n: any) => {
                    if (n.slur) {
                        const slurs = Array.isArray(n.slur) ? n.slur : [n.slur];
                        slurs.forEach((s: any) => {
                            const number = parseInt(s["@_number"] || "1");
                            const type = s["@_type"]; // start or stop

                            if (type === "start" && ctx.currentEvent) {
                                this.context.activeSlurs[number] = { sourceEvent: ctx.currentEvent };
                            } else if (type === "stop" && ctx.currentEvent) {
                                const pending = this.context.activeSlurs[number];
                                if (pending) {
                                    const source = pending.sourceEvent;

                                    if (!source.slurs) source.slurs = [];
                                    source.slurs.push({
                                        target: ctx.currentEvent!.id!,
                                        side: s["@_placement"] === "below" ? "down" : "up"
                                    });
                                    delete this.context.activeSlurs[number];
                                }
                            }
                        });
                    }

                    if (n.tied && noteObj) {
                        const tieds = Array.isArray(n.tied) ? n.tied : [n.tied];
                        tieds.forEach((t: any) => {
                            const type = t["@_type"];
                            const key = t["@_number"] ? `num:${t["@_number"]}` : pitchKey;

                            if (type === "start") {
                                this.context.activeTies[key] = { sourceNote: noteObj! };
                            } else if (type === "stop") {
                                const pending = this.context.activeTies[key];
                                if (pending) {
                                    const source = pending.sourceNote;
                                    if (!source.ties) source.ties = [];
                                    source.ties.push({ target: noteObj!.id! });
                                    delete this.context.activeTies[key];
                                }
                            }
                        });
                    }
                });
            }

            // --- 1.5 Beam Logic (Global per Measure usually, but cross-voice beams are rare/complex) ---
            // We keep beams global to the measure for simplicity, assuming IDs are unique globally.
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
                    if (ctx.stack.length > 1 && currentContainer.endCondition?.type === 'tuplet') {
                        ctx.stack.pop();
                    }
                }
            }
        }

        // --- Assemble Result ---
        const sequences: Sequence[] = this.voiceOrder.map(vId => {
            return { content: this.voiceContexts.get(vId)!.root };
        });

        // Clefs
        let clefs = undefined;
        if (this.xmlMeasure.attributes && this.xmlMeasure.attributes.clef) {
            const clefArr = Array.isArray(this.xmlMeasure.attributes.clef)
                ? this.xmlMeasure.attributes.clef
                : [this.xmlMeasure.attributes.clef];

            clefs = clefArr.map((c: any, idx: number) => ({
                clef: {
                    sign: c.sign,
                    line: c.line ? parseInt(c.line) : undefined
                },
                staff: parseInt(c["@_number"] || (idx + 1).toString())
            }));
        }

        // If no voices found (empty measure?), ensure at least one empty sequence
        if (sequences.length === 0) {
            sequences.push({ content: [] });
        }

        return {
            sequences: sequences,
            clefs: clefs,
            beams: this.beams.length > 0 ? this.beams : undefined
        };
    }
}
