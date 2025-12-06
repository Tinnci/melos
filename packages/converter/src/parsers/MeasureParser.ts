import type { PartMeasure, Sequence, Event, Note, Beam, Tuplet, Tie, Slur, Lyric, DynamicEvent, Wedge } from "@melos/core";
import { generateEventId, generateNoteId } from "./Utils";
import { TimeTracker } from "./TimeTracker";
import { XmlEventStream, type XmlToken } from "./XmlEventStream";

export interface Container {
    content: any[];
    endCondition?: { type: 'tuplet'; number?: number };
}

interface ActiveWedgeState {
    wedgeObj: Wedge;
}

export interface PartParsingContext {
    activeSlurs: Record<number, { sourceEvent: Event }>;
    activeTies: Record<string, { sourceNote: Note }>;
    activeWedges: Record<number, ActiveWedgeState>;
    lyricLines: Map<string, { id: string, name: string }>;
}

interface VoiceContext {
    root: any[];
    stack: Container[];
    currentEvent: Event | null;
}

export class MeasureParser {
    private beams: Beam[] = [];
    private activeBeams: Record<number, { eventIds: string[] }> = {};
    private voiceContexts: Map<string, VoiceContext> = new Map();
    private voiceOrder: string[] = [];

    private timeTracker: TimeTracker;

    constructor(
        private xmlMeasure: any,
        private context: PartParsingContext,
        globalDivisions: number = 1,
        private measureIndex: number = 1
    ) {
        this.timeTracker = new TimeTracker(globalDivisions);
    }

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
        // Use the extracted logic stream
        const xmlEvents = XmlEventStream.extract(this.xmlMeasure);
        const wedges: Wedge[] = [];

        for (const token of xmlEvents) {
            const voiceId = token.voice ? String(token.voice) : "1";
            const ctx = this.getVoiceContext(voiceId);

            if (token._tag === "note") {
                this.handleNote(token, ctx);

                // Advance time tracking
                // Only non-chord notes AND non-grace notes advance time
                if (!token.chord && !token.grace && token.duration) {
                    this.timeTracker.advance(voiceId, parseInt(token.duration));
                }

            } else if (token._tag === "direction") {
                const dTypes = Array.isArray(token["direction-type"]) ? token["direction-type"] : [token["direction-type"]];

                dTypes.forEach((dt: any) => {
                    if (dt.dynamics) {
                        this.handleDynamics(dt, ctx);
                    }
                    if (dt.wedge) {
                        this.handleWedge(dt.wedge, wedges, voiceId);
                    }
                });
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

        if (sequences.length === 0) {
            sequences.push({ content: [] });
        }

        return {
            sequences: sequences,
            clefs: clefs,
            beams: this.beams.length > 0 ? this.beams : undefined,
            wedges: wedges.length > 0 ? wedges : undefined
        };
    }

    private handleWedge(wedgeXml: any, wedgesList: Wedge[], voiceId: string) {
        const type = wedgeXml["@_type"]; // crescendo | diminuendo | stop | continue
        const number = parseInt(wedgeXml["@_number"] || "1");

        if (type === "crescendo" || type === "diminuendo") {
            const wedgeObj: Wedge = {
                type: type,
                position: this.timeTracker.getCurrentPosition(voiceId),
                voice: voiceId
            };

            // Add to current measure
            wedgesList.push(wedgeObj);

            // Track active wedge
            this.context.activeWedges[number] = { wedgeObj };

        } else if (type === "stop") {
            const active = this.context.activeWedges[number];
            if (active) {
                // Update the End Position of the ORIGINAL object
                active.wedgeObj.end = {
                    measure: this.measureIndex,
                    position: this.timeTracker.getCurrentPosition(voiceId)
                };
                delete this.context.activeWedges[number];
            }
        }
    }

    private handleDynamics(directionType: any, ctx: VoiceContext) {
        const dynObj = directionType.dynamics;
        if (!dynObj) return;

        const keys = Object.keys(dynObj);
        if (keys.length > 0) {
            const value = keys[0];
            const dynamicEvent: DynamicEvent = {
                type: "dynamic",
                value: value as any
            };
            const currentContainer = ctx.stack[ctx.stack.length - 1];
            currentContainer.content.push(dynamicEvent);
        }
    }

    private handleNote(xNote: any, ctx: VoiceContext) {
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

        // --- 0.5 Grace Note Detection ---
        const isGrace = xNote.grace !== undefined;
        let graceContainer: any = null;

        if (isGrace) {
            const lastItem = currentContainer.content[currentContainer.content.length - 1];
            if (lastItem && lastItem.type === 'grace') {
                graceContainer = lastItem;
            } else {
                graceContainer = {
                    type: "grace",
                    content: []
                };
                currentContainer.content.push(graceContainer);
            }
        }

        // --- 1. Event / Note Logic ---
        const isRest = xNote.rest !== undefined;
        const isChord = xNote.chord !== undefined;
        const durBase: any = xNote.type || "quarter";

        let dots = 0;
        if (xNote.dot !== undefined) {
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

                    if (!this.context.lyricLines.has(lineId)) {
                        const name = l["@_name"] || `Verse ${num}`;
                        this.context.lyricLines.set(lineId, { id: lineId, name });
                    }

                    eventLyrics.push({
                        text: l.text,
                        syllabic: l.syllabic,
                        line: lineId
                    });
                });

                if (eventLyrics.length > 0) {
                    evt.lyrics = eventLyrics;
                }
            }

            if (isGrace) {
                graceContainer.content.push(evt);
            } else {
                currentContainer.content.push(evt);
            }
            ctx.currentEvent = evt;
        }

        // --- 1.2 Articulations Logic ---
        if (xNote.notations) {
            const notations = Array.isArray(xNote.notations) ? xNote.notations : [xNote.notations];
            const collectedArticulations: string[] = [];

            notations.forEach((n: any) => {
                // 1. Fermata
                if (n.fermata) {
                    collectedArticulations.push("fermata");
                }

                // 2. Articulations container
                if (n.articulations) {
                    const arts = n.articulations;
                    const keys = Object.keys(arts);

                    keys.forEach(key => {
                        if (key === "staccato") collectedArticulations.push("staccato");
                        else if (key === "accent") collectedArticulations.push("accent");
                        else if (key === "tenuto") collectedArticulations.push("tenuto");
                        else if (key === "strong-accent") collectedArticulations.push("strong-accent");
                        else if (key === "staccatissimo") collectedArticulations.push("staccatissimo");
                    });
                }
            });

            if (collectedArticulations.length > 0 && ctx.currentEvent) {
                ctx.currentEvent.articulations = collectedArticulations as any[];
            }
        }

        // --- 1.3 Slurs Logic (Event Level) ---
        if (xNote.notations) {
            const notations = Array.isArray(xNote.notations) ? xNote.notations : [xNote.notations];

            notations.forEach((n: any) => {
                if (n.slur) {
                    const slurs = Array.isArray(n.slur) ? n.slur : [n.slur];
                    slurs.forEach((s: any) => {
                        const number = parseInt(s["@_number"] || "1");
                        const type = s["@_type"];

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
                if (ctx.stack.length > 1 && currentContainer.endCondition?.type === 'tuplet') {
                    ctx.stack.pop();
                }
            }
        }
    }
}
