import type { PartMeasure, Sequence, Event, Note, Beam, Tuplet, Lyric, DynamicEvent, Wedge, Ottava, Pedal, MultimeasureRest } from "@melos/core";
import { generateEventId, generateNoteId, musicXmlClefLineToStaffPosition, musicXmlNoteValue, parseInteger } from "./Utils";
import { TimeTracker } from "./TimeTracker";
import { XmlEventStream } from "./XmlEventStream";
import type { OrderedXmlNode } from "./OrderedXml";

export interface Container {
    content: any[];
    endCondition?: { type: 'tuplet'; number?: number };
}

interface ActiveWedgeState {
    wedgeObj: Wedge;
}

interface ActiveOttavaState {
    ottavaObj: Ottava;
}

export interface PartParsingContext {
    activeSlurs: Record<number, { sourceEvent: Event }>;
    activeTies: Record<string, { sourceNote: Note }>;
    activeWedges: Record<number, ActiveWedgeState>;
    activeOttavas: Record<number, ActiveOttavaState>; // [NEW] Ottava tracking
    activeTremolos: Record<number, { id: string }>; // [NEW] Multi-note Tremolo tracking
    activePedals?: { pedalObj: Pedal }; // [NEW] Pedal tracking
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
    private xmlMeasure: any;
    private orderedMeasure?: OrderedXmlNode[];
    private context: PartParsingContext;
    private measureIndex: number;
    private clefs: NonNullable<PartMeasure["clefs"]> = [];

    private timeTracker: TimeTracker;

    constructor(
        xmlMeasure: any,
        context: PartParsingContext,
        globalDivisions: number = 1,
        measureIndex: number = 1,
        orderedMeasure?: OrderedXmlNode[]
    ) {
        this.xmlMeasure = xmlMeasure;
        this.orderedMeasure = orderedMeasure;
        this.context = context;
        this.measureIndex = measureIndex;
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
        const xmlEvents = XmlEventStream.extract(this.xmlMeasure, this.orderedMeasure);
        const wedges: Wedge[] = [];
        const ottavas: Ottava[] = []; // [NEW] Ottava collection
        const pedals: Pedal[] = []; // [NEW] Pedal collection

        for (const token of xmlEvents) {
            if (token._tag === "attributes") {
                this.handleAttributes(token);
                continue;
            }

            if (token._tag === "backup") {
                const duration = parseInteger(token.duration);
                if (duration !== undefined) {
                    this.timeTracker.backup(duration);
                }
                continue;
            }

            if (token._tag === "forward") {
                const duration = parseInteger(token.duration);
                if (duration !== undefined) {
                    const voiceId = token.voice ? String(token.voice) : undefined;
                    if (voiceId) {
                        this.handleForwardRest(duration, this.getVoiceContext(voiceId), parseInteger(token.staff));
                    }
                    this.timeTracker.forward(duration, voiceId);
                }
                continue;
            }

            const voiceId = token.voice ? String(token.voice) : undefined;
            const sequenceVoiceId = voiceId || "1";
            const staff = parseInteger(token.staff);
            const ctx = this.getVoiceContext(sequenceVoiceId);

            if (token._tag === "note") {
                this.handleNote(token, ctx);

                // Advance time tracking
                // Only non-chord notes AND non-grace notes advance time
                if (!token.chord && !token.grace && token.duration) {
                    this.timeTracker.advance(sequenceVoiceId, parseInt(token.duration));
                }

            } else if (token._tag === "direction") {
                const dTypes = Array.isArray(token["direction-type"]) ? token["direction-type"] : [token["direction-type"]];

                dTypes.forEach((dt: any) => {
                    if (dt.dynamics) {
                        this.handleDynamics(dt, ctx, staff);
                    }
                    if (dt.wedge) {
                        this.handleWedge(dt.wedge, wedges, voiceId, staff);
                    }
                    if (dt["octave-shift"]) {
                        this.handleOttava(dt["octave-shift"], ottavas, voiceId, staff);
                    }
                    if (dt.pedal) {
                        this.handlePedal(dt.pedal, pedals, voiceId, staff);
                    }
                });
            }
        }

        const sequences: Sequence[] = this.voiceOrder.map(vId => {
            return { content: this.voiceContexts.get(vId)!.root };
        });

        if (sequences.length === 0) {
            sequences.push({ content: [] });
        }

        // [NEW] Multimeasure Rest Detection
        let multimeasureRest: MultimeasureRest | undefined = undefined;
        if (this.xmlMeasure.attributes?.["measure-style"]?.["multiple-rest"]) {
            const duration = parseInt(this.xmlMeasure.attributes["measure-style"]["multiple-rest"]);
            if (duration > 1) {
                multimeasureRest = {
                    start: this.measureIndex,
                    duration: duration
                };
            }
        }

        return {
            sequences: sequences,
            clefs: this.clefs.length > 0 ? this.clefs : undefined,
            beams: this.beams.length > 0 ? this.beams : undefined,
            wedges: wedges.length > 0 ? wedges : undefined,
            ottavas: ottavas.length > 0 ? ottavas : undefined,
            pedals: pedals.length > 0 ? pedals : undefined,
            multimeasureRest: multimeasureRest
        };
    }

    private handleAttributes(attributesXml: any) {
        if (!attributesXml.clef) return;

        const clefArr = Array.isArray(attributesXml.clef)
            ? attributesXml.clef
            : [attributesXml.clef];

        const position = this.timeTracker.getCurrentPosition();
        const isMeasureStart = position.fraction[0] === 0;

        clefArr.forEach((c: any, idx: number) => {
            const clefEntry: NonNullable<PartMeasure["clefs"]>[number] = {
                clef: {
                    sign: c.sign,
                    staffPosition: musicXmlClefLineToStaffPosition(c.line)
                },
                staff: parseInteger(c["@_number"]) || idx + 1
            };

            if (!isMeasureStart) {
                clefEntry.position = position;
            }

            this.clefs.push(clefEntry);
        });
    }

    private handleForwardRest(durationTicks: number, ctx: VoiceContext, staff?: number) {
        const currentContainer = ctx.stack[ctx.stack.length - 1];
        const restEvent: Event = {
            id: generateEventId(),
            duration: musicXmlNoteValue(undefined, durationTicks, this.timeTracker.getDivisions(), 0),
            rest: { hidden: true },
            staff
        };

        currentContainer.content.push(restEvent);
        ctx.currentEvent = null;
    }

    private handleWedge(wedgeXml: any, wedgesList: Wedge[], voiceId?: string, staff?: number) {
        const type = wedgeXml["@_type"]; // crescendo | diminuendo | stop | continue
        const number = parseInt(wedgeXml["@_number"] || "1");

        if (type === "crescendo" || type === "diminuendo") {
            const wedgeObj: Wedge = {
                type: type,
                position: this.timeTracker.getCurrentPosition(voiceId),
                staff,
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

    /**
     * Handle octave-shift (8va, 8vb, 15ma, etc.)
     * MusicXML: <octave-shift type="up|down|stop" size="8|15|22" number="n"/>
     * MNX: { value: 1|-1|2|-2, position, end }
     */
    private handleOttava(octaveShiftXml: any, ottavasList: Ottava[], voiceId?: string, staff?: number) {
        const type = octaveShiftXml["@_type"]; // up | down | stop | continue
        const size = parseInt(octaveShiftXml["@_size"] || "8"); // 8, 15, or 22
        const number = parseInt(octaveShiftXml["@_number"] || "1");

        // Convert size to MNX value: 8=1, 15=2, 22=3
        // Direction: up means play higher (value positive), down means value negative
        let valueAbs = 1;
        if (size === 15) valueAbs = 2;
        else if (size === 22) valueAbs = 3;

        if (type === "up" || type === "down") {
            const value = (type === "up" ? valueAbs : -valueAbs) as 1 | -1 | 2 | -2 | 3 | -3;

            const ottavaObj: Ottava = {
                value: value,
                position: this.timeTracker.getCurrentPosition(voiceId),
                end: { measure: this.measureIndex, position: this.timeTracker.getCurrentPosition(voiceId) }, // Placeholder, will be updated on stop
                staff,
                voice: voiceId
            };

            // Add to current measure
            ottavasList.push(ottavaObj);

            // Track active ottava
            this.context.activeOttavas[number] = { ottavaObj };

        } else if (type === "stop") {
            const active = this.context.activeOttavas[number];
            if (active) {
                // Update the End Position of the ORIGINAL object
                active.ottavaObj.end = {
                    measure: this.measureIndex,
                    position: this.timeTracker.getCurrentPosition(voiceId)
                };
                delete this.context.activeOttavas[number];
            }
        }
    }

    private handlePedal(pedalXml: any, pedalsList: Pedal[], voiceId?: string, staff?: number) {
        const type = pedalXml["@_type"]; // start | stop | change | continue
        const line = pedalXml["@_line"] === "yes";
        const sign = pedalXml["@_sign"] === "yes" || !line;

        if (type === "start") {
            const pedalObj: Pedal = {
                type: "start",
                position: this.timeTracker.getCurrentPosition(voiceId),
                line: line,
                sign: sign,
                staff,
                voice: voiceId
            };
            pedalsList.push(pedalObj);
            this.context.activePedals = { pedalObj };

        } else if (type === "stop") {
            const active = this.context.activePedals;
            if (active) {
                if (active.pedalObj.line) {
                    active.pedalObj.end = {
                        measure: this.measureIndex,
                        position: this.timeTracker.getCurrentPosition(voiceId)
                    };
                    delete this.context.activePedals; // Clear active
                } else {
                    // Sign pedal stop
                    const pedalStop: Pedal = {
                        type: "stop",
                        position: this.timeTracker.getCurrentPosition(voiceId),
                        staff,
                        voice: voiceId
                    };
                    pedalsList.push(pedalStop);
                    delete this.context.activePedals;
                }
            } else {
                // Orphan stop
                pedalsList.push({
                    type: "stop",
                    position: this.timeTracker.getCurrentPosition(voiceId),
                    staff,
                    voice: voiceId
                });
            }

        } else if (type === "change") {
            const active = this.context.activePedals;
            const pos = this.timeTracker.getCurrentPosition(voiceId);

            if (active && active.pedalObj.line) {
                active.pedalObj.end = { measure: this.measureIndex, position: pos };
            } else {
                pedalsList.push({ type: "stop", position: pos, staff, voice: voiceId });
            }

            const newPedal: Pedal = {
                type: "start",
                position: pos,
                line: line,
                sign: sign,
                staff,
                voice: voiceId
            };
            pedalsList.push(newPedal);
            this.context.activePedals = { pedalObj: newPedal };
        }
    }

    private handleDynamics(directionType: any, ctx: VoiceContext, staff?: number) {
        const dynObj = directionType.dynamics;
        if (!dynObj) return;

        const keys = Object.keys(dynObj);
        if (keys.length > 0) {
            const value = keys[0];
            const dynamicEvent: DynamicEvent = {
                type: "dynamic",
                value: value as any,
                staff
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
            const tupletStartNode = this.findTupletNotation(notations, "start");

            if (tupletStartNode) {
                const newTuplet = this.createTuplet(xNote, tupletStartNode);
                currentContainer.content.push(newTuplet);

                const newContainer: Container = {
                    content: newTuplet.content,
                    endCondition: { type: "tuplet", number: parseInteger(tupletStartNode["@_number"]) }
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
        const staff = parseInteger(xNote.staff);

        let dots = 0;
        if (xNote.dot !== undefined) {
            dots = Array.isArray(xNote.dot) ? xNote.dot.length : 1;
        }
        const duration = musicXmlNoteValue(xNote.type, xNote.duration, this.timeTracker.getDivisions(), dots);
        // Pitch Logic
        let noteObj: Note | null = null;
        let pitchKey = "";

        if (!isRest) {
            if (xNote.pitch) {
                noteObj = {
                    id: generateNoteId(),
                    pitch: {
                        step: xNote.pitch.step,
                        octave: parseInt(xNote.pitch.octave),
                        alter: xNote.pitch.alter ? parseInt(xNote.pitch.alter) : undefined
                    },
                    staff
                };
                if (xNote.accidental) {
                    const accObj = typeof xNote.accidental === 'object' ? xNote.accidental : { "#text": xNote.accidental };
                    noteObj.accidentalDisplay = {
                        show: true,
                        cautionary: accObj["@_parentheses"] === "yes" || accObj["@_cautionary"] === "yes",
                        editorial: accObj["@_editorial"] === "yes"
                    };
                }
                pitchKey = `${noteObj.pitch!.step}${noteObj.pitch!.octave}`;

            } else if (xNote.unpitched) {
                noteObj = {
                    id: generateNoteId(),
                    unpitched: {
                        step: xNote.unpitched["display-step"] || "C",
                        octave: parseInt(xNote.unpitched["display-octave"] || "4")
                    },
                    staff
                };
                pitchKey = "unpitched";
            }

            if (noteObj && xNote.notehead) {
                const nh = typeof xNote.notehead === 'string' ? xNote.notehead : xNote.notehead["#text"];
                if (["x", "diamond", "triangle", "slash", "square", "circle-x", "normal"].includes(nh)) {
                    noteObj.notehead = nh;
                }
            }
            if (noteObj && xNote["@_color"]) {
                noteObj.color = xNote["@_color"];
            }
        }

        // Event Generation
        let eventId: string;

        if (isChord && ctx.currentEvent && !isRest) {
            if (noteObj && ctx.currentEvent.notes) {
                ctx.currentEvent.notes.push(noteObj);
            }
            if (staff !== undefined && ctx.currentEvent.staff === undefined) {
                ctx.currentEvent.staff = staff;
            }
            eventId = ctx.currentEvent.id!;
        } else {
            eventId = generateEventId();
            const evt: Event = {
                id: eventId,
                duration,
                staff
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

            // [NEW] Tremolo parsing from ornaments
            notations.forEach((n: any) => {
                if (n.ornaments?.tremolo) {
                    const tremolo = n.ornaments.tremolo;
                    // Get the number value (slashes count)
                    const marks = parseInt(tremolo["#text"] || tremolo || "3");
                    const type = tremolo["@_type"]; // "single", "start", or "stop"

                    // [UPDATED] Multi-note Tremolo Support
                    if (type === "single" || type === undefined) {
                        if (ctx.currentEvent) {
                            ctx.currentEvent.tremolo = marks; // Keep as number for single
                        }
                    } else if (type === "start") {
                        const id = `trem-${generateEventId()}`;
                        if (ctx.currentEvent) {
                            ctx.currentEvent.tremolo = { type: "start", marks, id };
                        }
                        this.context.activeTremolos[1] = { id };
                    } else if (type === "stop") {
                        const active = this.context.activeTremolos[1];
                        if (active && ctx.currentEvent) {
                            ctx.currentEvent.tremolo = { type: "stop", marks, id: active.id };
                            delete this.context.activeTremolos[1];
                        }
                    }
                }
            });
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
            const tupletStopNode = this.findTupletNotation(notations, "stop");

            if (tupletStopNode) {
                if (ctx.stack.length > 1 && currentContainer.endCondition?.type === 'tuplet') {
                    ctx.stack.pop();
                }
            }
        }
    }

    private createTuplet(xNote: any, _tupletXml: any): Tuplet {
        const timeModification = xNote["time-modification"];
        const actualNotes = parseInteger(timeModification?.["actual-notes"]) || 3;
        const normalNotes = parseInteger(timeModification?.["normal-notes"]) || 2;
        const quantityType = timeModification?.["normal-type"] || xNote.type;
        const quantityDuration = musicXmlNoteValue(quantityType, undefined, this.timeTracker.getDivisions(), 0);

        return {
            type: "tuplet",
            inner: {
                duration: quantityDuration,
                multiple: actualNotes
            },
            outer: {
                duration: quantityDuration,
                multiple: normalNotes
            },
            content: []
        };
    }

    private findTupletNotation(notations: any[], type: "start" | "stop"): any | undefined {
        for (const notation of notations) {
            const tuplets = Array.isArray(notation?.tuplet) ? notation.tuplet : [notation?.tuplet];
            const match = tuplets.find((tuplet: any) => tuplet?.["@_type"] === type);
            if (match) return match;
        }

        return undefined;
    }
}
