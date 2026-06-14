import type {
    PartMeasure,
    Sequence,
    Event,
    Note,
    Grace,
    Beam,
    Tuplet,
    Lyric,
    DynamicEvent,
    Wedge,
    Ottava,
    Pedal,
    MultimeasureRest,
} from "@melos/core";
import {
    generateEventId,
    generateNoteId,
    musicXmlClefLineToStaffPosition,
    musicXmlNoteValue,
    parseInteger,
} from "./Utils";
import { TimeTracker } from "./TimeTracker";
import { XmlEventStream } from "./XmlEventStream";
import {
    hasXmlValue,
    isXmlRecord,
    type OrderedXmlNode,
    type XmlRecord,
    xmlRecords,
    xmlText,
} from "./OrderedXml";

type SequenceItem = Sequence["content"][number];
type GraceContainer = Grace;
type NoteParseResult = {
    eventId: string;
    note: Note | null;
    pitchKey: string;
    currentContainer: Container;
};
type NotationLinkContext = {
    event: Event | null;
    note: Note | null;
    pitchKey: string;
};
type PitchStep = NonNullable<Note["pitch"]>["step"];
type LyricSyllabic = NonNullable<Lyric["syllabic"]>;
type EventArticulation = NonNullable<Event["articulations"]>[number];

export interface Container {
    content: SequenceItem[];
    endCondition?: { type: "tuplet"; number?: number };
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
    lyricLines: Map<string, { id: string; name: string }>;
}

interface VoiceContext {
    root: SequenceItem[];
    stack: Container[];
    currentEvent: Event | null;
}

export class MeasureParser {
    private beams: Beam[] = [];
    private activeBeams: Record<number, { eventIds: string[] }> = {};
    private voiceContexts: Map<string, VoiceContext> = new Map();
    private voiceOrder: string[] = [];
    private xmlMeasure: XmlRecord;
    private orderedMeasure?: OrderedXmlNode[];
    private context: PartParsingContext;
    private measureIndex: number;
    private clefs: NonNullable<PartMeasure["clefs"]> = [];

    private timeTracker: TimeTracker;

    constructor(
        xmlMeasure: XmlRecord,
        context: PartParsingContext,
        globalDivisions: number = 1,
        measureIndex: number = 1,
        orderedMeasure?: OrderedXmlNode[],
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
            const rootContent: SequenceItem[] = [];
            ctx = {
                root: rootContent,
                stack: [{ content: rootContent }],
                currentEvent: null,
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
                    const voiceId = xmlText(token.voice) || undefined;
                    if (voiceId) {
                        this.handleForwardRest(
                            duration,
                            this.getVoiceContext(voiceId),
                            parseInteger(token.staff),
                        );
                    }
                    this.timeTracker.forward(duration, voiceId);
                }
                continue;
            }

            const voiceId = xmlText(token.voice) || undefined;
            const sequenceVoiceId = voiceId || "1";
            const staff = parseInteger(token.staff);
            const ctx = this.getVoiceContext(sequenceVoiceId);

            if (token._tag === "note") {
                this.handleNote(token, ctx);

                // Advance time tracking
                // Only non-chord notes AND non-grace notes advance time
                const duration = parseInteger(token.duration);
                if (
                    !hasXmlValue(token.chord) &&
                    !hasXmlValue(token.grace) &&
                    duration !== undefined
                ) {
                    this.timeTracker.advance(sequenceVoiceId, duration);
                }
            } else if (token._tag === "direction") {
                const dTypes = xmlRecords(token["direction-type"]);
                dTypes.forEach((dt) => {
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

        const sequences: Sequence[] = this.voiceOrder.map((vId) => {
            return { content: this.voiceContexts.get(vId)!.root };
        });

        if (sequences.length === 0) {
            sequences.push({ content: [] });
        }

        // [NEW] Multimeasure Rest Detection
        let multimeasureRest: MultimeasureRest | undefined = undefined;
        const measureStyle = xmlRecords(this.xmlMeasure.attributes)
            .flatMap((attribute) => xmlRecords(attribute["measure-style"]))
            .find((style) => hasXmlValue(style["multiple-rest"]));
        if (measureStyle) {
            const duration = parseInteger(measureStyle["multiple-rest"]);
            if (duration !== undefined && duration > 1) {
                multimeasureRest = {
                    start: this.measureIndex,
                    duration: duration,
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
            multimeasureRest: multimeasureRest,
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
                    staffPosition: musicXmlClefLineToStaffPosition(c.line),
                },
                staff: parseInteger(c["@_number"]) || idx + 1,
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
            duration: musicXmlNoteValue(
                undefined,
                durationTicks,
                this.timeTracker.getDivisions(),
                0,
            ),
            rest: { hidden: true },
            staff,
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
                voice: voiceId,
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
                    position: this.timeTracker.getCurrentPosition(voiceId),
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
    private handleOttava(
        octaveShiftXml: any,
        ottavasList: Ottava[],
        voiceId?: string,
        staff?: number,
    ) {
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
                end: {
                    measure: this.measureIndex,
                    position: this.timeTracker.getCurrentPosition(voiceId),
                }, // Placeholder, will be updated on stop
                staff,
                voice: voiceId,
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
                    position: this.timeTracker.getCurrentPosition(voiceId),
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
                voice: voiceId,
            };
            pedalsList.push(pedalObj);
            this.context.activePedals = { pedalObj };
        } else if (type === "stop") {
            const active = this.context.activePedals;
            if (active) {
                if (active.pedalObj.line) {
                    active.pedalObj.end = {
                        measure: this.measureIndex,
                        position: this.timeTracker.getCurrentPosition(voiceId),
                    };
                    delete this.context.activePedals; // Clear active
                } else {
                    // Sign pedal stop
                    const pedalStop: Pedal = {
                        type: "stop",
                        position: this.timeTracker.getCurrentPosition(voiceId),
                        staff,
                        voice: voiceId,
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
                    voice: voiceId,
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
                voice: voiceId,
            };
            pedalsList.push(newPedal);
            this.context.activePedals = { pedalObj: newPedal };
        }
    }

    private handleDynamics(directionType: XmlRecord, ctx: VoiceContext, staff?: number) {
        const dynObj = directionType.dynamics;
        if (!isXmlRecord(dynObj)) return;

        const keys = Object.keys(dynObj).filter((key) => !key.startsWith("@_"));
        if (keys.length > 0) {
            const key = keys[0];
            const value = key === "other-dynamics" ? xmlText(dynObj[key]) || key : key;
            const dynamicEvent: DynamicEvent = {
                type: "dynamic",
                value,
                staff,
            };
            const currentContainer = ctx.stack[ctx.stack.length - 1];
            currentContainer.content.push(dynamicEvent);
        }
    }

    private handleNote(noteXml: XmlRecord, ctx: VoiceContext) {
        const notations = xmlRecords(noteXml.notations);
        const currentContainer = this.openTupletContainer(noteXml, notations, ctx);
        const parseResult = this.createOrExtendEvent(noteXml, ctx, currentContainer);
        const linkContext: NotationLinkContext = {
            event: ctx.currentEvent,
            note: parseResult.note,
            pitchKey: parseResult.pitchKey,
        };

        this.applyArticulations(notations, linkContext.event);
        this.applyTremolo(notations, linkContext.event);
        this.applySlursAndTies(notations, linkContext);
        this.applyBeams(noteXml, parseResult.eventId);
        this.closeTupletContainer(notations, ctx, parseResult.currentContainer);
    }

    private openTupletContainer(
        noteXml: XmlRecord,
        notations: XmlRecord[],
        ctx: VoiceContext,
    ): Container {
        const currentContainer = ctx.stack[ctx.stack.length - 1];
        const tupletStartNode = this.findTupletNotation(notations, "start");
        if (!tupletStartNode) return currentContainer;

        const newTuplet = this.createTuplet(noteXml, tupletStartNode);
        currentContainer.content.push(newTuplet);

        const newContainer: Container = {
            content: newTuplet.content,
            endCondition: {
                type: "tuplet",
                number: parseInteger(tupletStartNode["@_number"]),
            },
        };
        ctx.stack.push(newContainer);
        return newContainer;
    }

    private createOrExtendEvent(
        noteXml: XmlRecord,
        ctx: VoiceContext,
        currentContainer: Container,
    ): NoteParseResult {
        const isRest = hasXmlValue(noteXml.rest);
        const isChord = hasXmlValue(noteXml.chord);
        const isGrace = hasXmlValue(noteXml.grace);
        const staff = parseInteger(noteXml.staff);
        const { note, pitchKey } = this.createNoteObject(noteXml, isRest, staff);

        if (isChord && ctx.currentEvent && !isRest) {
            this.appendChordNote(ctx.currentEvent, note, staff);
            return {
                eventId: ctx.currentEvent.id || "",
                note,
                pitchKey,
                currentContainer,
            };
        }

        const event = this.createEvent(noteXml, note, isRest, staff);
        this.applyLyrics(noteXml, event);
        this.appendEvent(event, currentContainer, isGrace);
        ctx.currentEvent = event;

        return {
            eventId: event.id || "",
            note,
            pitchKey,
            currentContainer,
        };
    }

    private createNoteObject(
        noteXml: XmlRecord,
        isRest: boolean,
        staff?: number,
    ): { note: Note | null; pitchKey: string } {
        if (isRest) return { note: null, pitchKey: "" };

        const note =
            this.createPitchedNote(noteXml, staff) || this.createUnpitchedNote(noteXml, staff);
        if (!note) return { note: null, pitchKey: "" };

        this.applyNoteheadAndColor(noteXml, note);

        if (note.pitch) {
            return { note, pitchKey: `${note.pitch.step}${note.pitch.octave}` };
        }

        return { note, pitchKey: "unpitched" };
    }

    private createPitchedNote(noteXml: XmlRecord, staff?: number): Note | null {
        const pitch = noteXml.pitch;
        if (!isXmlRecord(pitch)) return null;

        const step = asPitchStep(xmlText(pitch.step));
        const octave = parseInteger(pitch.octave);
        if (!step || octave === undefined) return null;

        const note: Note = {
            id: generateNoteId(),
            pitch: {
                step,
                octave,
                alter: parseInteger(pitch.alter),
            },
            staff,
        };

        this.applyAccidentalDisplay(noteXml, note);
        return note;
    }

    private createUnpitchedNote(noteXml: XmlRecord, staff?: number): Note | null {
        const unpitched = noteXml.unpitched;
        if (!isXmlRecord(unpitched)) return null;

        return {
            id: generateNoteId(),
            unpitched: {
                step: xmlText(unpitched["display-step"]) || "C",
                octave: parseInteger(unpitched["display-octave"]) || 4,
            },
            staff,
        };
    }

    private applyAccidentalDisplay(noteXml: XmlRecord, note: Note) {
        const accidental = noteXml.accidental;
        if (!hasXmlValue(accidental)) return;

        const accObj = isXmlRecord(accidental) ? accidental : {};
        note.accidentalDisplay = {
            show: true,
            cautionary:
                xmlText(accObj["@_parentheses"]) === "yes" ||
                xmlText(accObj["@_cautionary"]) === "yes",
            editorial: xmlText(accObj["@_editorial"]) === "yes",
        };
    }

    private applyNoteheadAndColor(noteXml: XmlRecord, note: Note) {
        const notehead = noteXml.notehead;
        if (hasXmlValue(notehead)) {
            const normalized = this.normalizeNotehead(xmlText(notehead));
            if (normalized) {
                note.notehead = normalized;
            }
            if (isXmlRecord(notehead)) {
                const color = xmlText(notehead["@_color"]);
                if (color) {
                    note.color = color;
                }
            }
        }

        const color = xmlText(noteXml["@_color"]);
        if (color) {
            note.color = color;
        }
    }

    private createEvent(
        noteXml: XmlRecord,
        note: Note | null,
        isRest: boolean,
        staff?: number,
    ): Event {
        const event: Event = {
            id: generateEventId(),
            duration: musicXmlNoteValue(
                noteXml.type,
                noteXml.duration,
                this.timeTracker.getDivisions(),
                countXmlItems(noteXml.dot),
            ),
            staff,
        };

        if (isRest) {
            event.rest = {};
        } else if (note) {
            event.notes = [note];
        }

        return event;
    }

    private appendChordNote(event: Event, note: Note | null, staff?: number) {
        if (note && event.notes) {
            event.notes.push(note);
        }
        if (staff !== undefined && event.staff === undefined) {
            event.staff = staff;
        }
    }

    private appendEvent(event: Event, currentContainer: Container, isGrace: boolean) {
        if (isGrace) {
            this.getGraceContainer(currentContainer).content.push(event);
            return;
        }

        currentContainer.content.push(event);
    }

    private getGraceContainer(currentContainer: Container): GraceContainer {
        const lastItem = currentContainer.content[currentContainer.content.length - 1];
        if (isGraceContainer(lastItem)) {
            return lastItem;
        }

        const graceContainer: GraceContainer = {
            type: "grace",
            content: [],
        };
        currentContainer.content.push(graceContainer);
        return graceContainer;
    }

    private applyLyrics(noteXml: XmlRecord, event: Event) {
        const eventLyrics: Lyric[] = xmlRecords(noteXml.lyric).map((lyricXml) => {
            const number = xmlText(lyricXml["@_number"]) || "1";
            const lineId = `line${number}`;

            if (!this.context.lyricLines.has(lineId)) {
                const name = xmlText(lyricXml["@_name"]) || `Verse ${number}`;
                this.context.lyricLines.set(lineId, { id: lineId, name });
            }

            return {
                text: xmlText(lyricXml.text) || "",
                syllabic: asLyricSyllabic(xmlText(lyricXml.syllabic)),
                line: lineId,
            };
        });

        if (eventLyrics.length > 0) {
            event.lyrics = eventLyrics;
        }
    }

    private applyArticulations(notations: XmlRecord[], event: Event | null) {
        if (!event) return;

        const articulations = collectArticulations(notations);
        if (articulations.length > 0) {
            event.articulations = articulations;
        }
    }

    private applyTremolo(notations: XmlRecord[], event: Event | null) {
        if (!event) return;

        notations.forEach((notation) => {
            const ornaments = notation.ornaments;
            if (!isXmlRecord(ornaments)) return;

            xmlRecords(ornaments.tremolo).forEach((tremolo) => {
                const marks = parseInteger(tremolo["#text"]) || 3;
                const type = xmlText(tremolo["@_type"]);

                if (type === "start") {
                    const id = `trem-${generateEventId()}`;
                    event.tremolo = { type: "start", marks, id };
                    this.context.activeTremolos[1] = { id };
                } else if (type === "stop") {
                    const active = this.context.activeTremolos[1];
                    if (active) {
                        event.tremolo = { type: "stop", marks, id: active.id };
                        delete this.context.activeTremolos[1];
                    }
                } else {
                    event.tremolo = marks;
                }
            });
        });
    }

    private applySlursAndTies(notations: XmlRecord[], linkContext: NotationLinkContext) {
        notations.forEach((notation) => {
            this.applySlurs(notation, linkContext.event);
            if (linkContext.note) {
                this.applyTies(notation, linkContext.note, linkContext.pitchKey);
            }
        });
    }

    private applySlurs(notation: XmlRecord, event: Event | null) {
        if (!event) return;

        xmlRecords(notation.slur).forEach((slur) => {
            const number = parseInteger(slur["@_number"]) || 1;
            const type = xmlText(slur["@_type"]);

            if (type === "start") {
                this.context.activeSlurs[number] = { sourceEvent: event };
            } else if (type === "stop") {
                const pending = this.context.activeSlurs[number];
                if (!pending) return;

                pending.sourceEvent.slurs = pending.sourceEvent.slurs || [];
                pending.sourceEvent.slurs.push({
                    target: event.id || "",
                    side: xmlText(slur["@_placement"]) === "below" ? "down" : "up",
                });
                delete this.context.activeSlurs[number];
            }
        });
    }

    private applyTies(notation: XmlRecord, note: Note, pitchKey: string) {
        xmlRecords(notation.tied).forEach((tied) => {
            const type = xmlText(tied["@_type"]);
            const key = xmlText(tied["@_number"]);
            const tieKey = key ? `num:${key}` : pitchKey;

            if (type === "start") {
                this.context.activeTies[tieKey] = { sourceNote: note };
            } else if (type === "stop") {
                const pending = this.context.activeTies[tieKey];
                if (!pending) return;

                pending.sourceNote.ties = pending.sourceNote.ties || [];
                pending.sourceNote.ties.push({ target: note.id || "" });
                delete this.context.activeTies[tieKey];
            }
        });
    }

    private applyBeams(noteXml: XmlRecord, eventId: string) {
        xmlRecords(noteXml.beam).forEach((beam) => {
            const number = parseInteger(beam["@_number"]) || 1;
            const type = xmlText(beam["#text"]);

            if (type === "begin") {
                this.activeBeams[number] = { eventIds: [eventId] };
            } else if (type === "continue") {
                this.activeBeams[number]?.eventIds.push(eventId);
            } else if (type === "end" && this.activeBeams[number]) {
                this.activeBeams[number].eventIds.push(eventId);
                this.beams.push({ events: this.activeBeams[number].eventIds });
                delete this.activeBeams[number];
            }
        });
    }

    private closeTupletContainer(
        notations: XmlRecord[],
        ctx: VoiceContext,
        currentContainer: Container,
    ) {
        const tupletStopNode = this.findTupletNotation(notations, "stop");
        if (
            tupletStopNode &&
            ctx.stack.length > 1 &&
            currentContainer.endCondition?.type === "tuplet"
        ) {
            ctx.stack.pop();
        }
    }

    private normalizeNotehead(value?: string): Note["notehead"] | undefined {
        if (!value) return undefined;
        const normalized = value.trim().toLowerCase();
        const aliases: Record<string, Note["notehead"]> = {
            normal: "normal",
            x: "x",
            cross: "x",
            diamond: "diamond",
            triangle: "triangle",
            "inverted triangle": "triangle",
            slash: "slash",
            square: "square",
            "circle-x": "circle-x",
            "circle x": "circle-x",
        };
        return aliases[normalized];
    }

    private createTuplet(xNote: any, _tupletXml: any): Tuplet {
        const timeModification = xNote["time-modification"];
        const actualNotes = parseInteger(timeModification?.["actual-notes"]) || 3;
        const normalNotes = parseInteger(timeModification?.["normal-notes"]) || 2;
        const quantityType = timeModification?.["normal-type"] || xNote.type;
        const quantityDuration = musicXmlNoteValue(
            quantityType,
            undefined,
            this.timeTracker.getDivisions(),
            0,
        );

        return {
            type: "tuplet",
            inner: {
                duration: quantityDuration,
                multiple: actualNotes,
            },
            outer: {
                duration: quantityDuration,
                multiple: normalNotes,
            },
            content: [],
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

function countXmlItems(value: unknown): number {
    if (value === undefined) return 0;
    return Array.isArray(value) ? value.length : 1;
}

function isGraceContainer(item: SequenceItem | undefined): item is GraceContainer {
    if (typeof item !== "object" || item === null || !("type" in item) || !("content" in item)) {
        return false;
    }

    return item.type === "grace" && Array.isArray(item.content);
}

function asPitchStep(value: string | undefined): PitchStep | undefined {
    return isPitchStep(value) ? value : undefined;
}

function isPitchStep(value: string | undefined): value is PitchStep {
    return (
        value === "A" ||
        value === "B" ||
        value === "C" ||
        value === "D" ||
        value === "E" ||
        value === "F" ||
        value === "G"
    );
}

function asLyricSyllabic(value: string | undefined): LyricSyllabic | undefined {
    return isLyricSyllabic(value) ? value : undefined;
}

function isLyricSyllabic(value: string | undefined): value is LyricSyllabic {
    return (
        value === "begin" ||
        value === "end" ||
        value === "middle" ||
        value === "single" ||
        value === "start" ||
        value === "stop"
    );
}

function collectArticulations(notations: XmlRecord[]): EventArticulation[] {
    const articulations: EventArticulation[] = [];

    notations.forEach((notation) => {
        if (hasXmlValue(notation.fermata)) {
            articulations.push("fermata");
        }

        xmlRecords(notation.articulations).forEach((articulationSet) => {
            Object.keys(articulationSet).forEach((key) => {
                const articulation = asEventArticulation(key);
                if (articulation) {
                    articulations.push(articulation);
                }
            });
        });
    });

    return articulations;
}

function asEventArticulation(value: string): EventArticulation | undefined {
    if (
        value === "staccato" ||
        value === "tenuto" ||
        value === "accent" ||
        value === "strong-accent" ||
        value === "staccatissimo"
    ) {
        return value;
    }

    return undefined;
}
