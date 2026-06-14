import { XMLParser } from "fast-xml-parser";
import type {
    Articulation,
    Beam,
    Event,
    GlobalMeasure,
    LyricLine,
    Note,
    NoteValue,
    Ottava,
    Part,
    PartMeasure,
    Pedal,
    Score,
    Sequence,
    Tuplet,
    Wedge,
} from "@melos/core";
import { ScoreSchema } from "@melos/core";

type MeiNode = Record<string, unknown>;

interface ParsedLayer {
    content: Array<Event | Tuplet | { type: "grace"; content: Event[] }>;
    beams: Beam[];
}

interface NoteIndexEntry {
    event: Event;
    note: Note;
}

interface StaffDefinition {
    n: string;
    label?: string;
    clef?: {
        sign: ClefSign;
        line?: number;
    };
}

type ClefSign = "G" | "F" | "C" | "percussion" | "TAB";
type Syllabic = NonNullable<Event["lyrics"]>[number]["syllabic"];

interface MeiContext {
    eventCounter: number;
    noteCounter: number;
    noteIndex: Map<string, NoteIndexEntry>;
    lyricLines: Map<string, LyricLine>;
}

const MEI_DURATIONS: Record<string, NoteValue["base"]> = {
    longa: "longa",
    long: "longa",
    breve: "breve",
    "1": "whole",
    "2": "half",
    "4": "quarter",
    "8": "eighth",
    "16": "16th",
    "32": "32nd",
    "64": "64th",
    "128": "128th",
    "256": "256th",
    "512": "512th",
    "1024": "1024th",
    "2048": "2048th",
    "4096": "4096th",
};

export class MEIToMNX {
    private xmlParser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        textNodeName: "#text",
        trimValues: true,
    });

    convert(meiContent: string): Score {
        const parsed = this.xmlParser.parse(meiContent);
        const meiRoot = findFirstByName(asRecord(parsed), "mei");
        if (!meiRoot) {
            throw new Error("Invalid MEI: Missing <mei> root");
        }

        const scoreNode = findFirstDescendant(meiRoot, "score");
        if (!scoreNode) {
            throw new Error("Invalid MEI: Missing <score>");
        }

        const scoreDef = findFirstDescendant(scoreNode, "scoreDef");
        const measures = findDescendants(scoreNode, "measure");
        if (measures.length === 0) {
            throw new Error("Invalid MEI: Missing <measure>");
        }

        const staffDefs = this.getStaffDefinitions(scoreDef, measures);
        const context: MeiContext = {
            eventCounter: 1,
            noteCounter: 1,
            noteIndex: new Map(),
            lyricLines: new Map(),
        };

        const globalMeasures = measures.map((measure, index) =>
            this.parseGlobalMeasure(measure, scoreDef, index),
        );

        const parts = staffDefs.map(
            (staffDef, partIndex): Part => ({
                id: `P${partIndex + 1}`,
                name: staffDef.label || `Staff ${staffDef.n}`,
                measures: measures.map((measure, measureIndex) =>
                    this.parsePartMeasure(measure, staffDef, measureIndex, scoreDef, context),
                ),
            }),
        );

        this.applyLinks(scoreNode, context);

        const lyrics = Array.from(context.lyricLines.values());
        const score: Score = {
            mnx: { version: 1 },
            global: {
                measures: globalMeasures,
                lyrics: lyrics.length > 0 ? lyrics : undefined,
            },
            parts,
        };

        return ScoreSchema.parse(score);
    }

    private getStaffDefinitions(
        scoreDef: MeiNode | undefined,
        measures: MeiNode[],
    ): StaffDefinition[] {
        const definitions = scoreDef ? findDescendants(scoreDef, "staffDef") : [];
        if (definitions.length > 0) {
            return definitions.map((staffDef, index) => {
                const n = attr(staffDef, "n") || String(index + 1);
                const label = attr(staffDef, "label") || textOfChild(staffDef, "label");
                const clefShape = attr(staffDef, "clef.shape");
                const clefLine = parseInteger(attr(staffDef, "clef.line"));
                const sign = this.parseClefSign(clefShape);
                return {
                    n,
                    label,
                    clef: sign ? { sign, line: clefLine } : undefined,
                };
            });
        }

        const staffNumbers = new Set<string>();
        for (const measure of measures) {
            for (const staff of findChildren(measure, "staff")) {
                staffNumbers.add(attr(staff, "n") || String(staffNumbers.size + 1));
            }
        }

        if (staffNumbers.size === 0) {
            staffNumbers.add("1");
        }

        return Array.from(staffNumbers).map((n) => ({ n, label: `Staff ${n}` }));
    }

    private parseGlobalMeasure(
        measure: MeiNode,
        scoreDef: MeiNode | undefined,
        index: number,
    ): GlobalMeasure {
        const globalMeasure: GlobalMeasure = { index: index + 1 };
        if (index === 0 && scoreDef) {
            const count = parseInteger(attr(scoreDef, "meter.count"));
            const unit = parseInteger(attr(scoreDef, "meter.unit"));
            if (count && unit) {
                globalMeasure.time = { count, unit };
            }

            const fifths = parseKeySignature(attr(scoreDef, "key.sig"));
            if (fifths !== undefined) {
                globalMeasure.key = { fifths };
            }
        }

        const leftBarline = attr(measure, "left");
        const rightBarline = attr(measure, "right");
        if (leftBarline === "rptstart") {
            globalMeasure.repeatStart = {};
            globalMeasure.barline = { type: "repeat-forward" };
        }
        if (rightBarline === "rptend") {
            globalMeasure.repeatEnd = {};
            globalMeasure.barline = { type: "repeat-backward" };
        } else if (rightBarline === "rptboth") {
            globalMeasure.repeatStart = {};
            globalMeasure.repeatEnd = {};
            globalMeasure.barline = { type: "repeat-both" };
        } else if (rightBarline === "dbl") {
            globalMeasure.barline = { type: "double" };
        } else if (rightBarline === "end") {
            globalMeasure.barline = { type: "final" };
        }

        return globalMeasure;
    }

    private parsePartMeasure(
        measure: MeiNode,
        staffDef: StaffDefinition,
        measureIndex: number,
        scoreDef: MeiNode | undefined,
        context: MeiContext,
    ): PartMeasure {
        const staff = this.findStaff(measure, staffDef.n);
        const layers = staff ? findChildren(staff, "layer") : findChildren(measure, "layer");
        const parsedLayers =
            layers.length > 0
                ? layers.map((layer) => this.parseLayer(layer, context))
                : [{ content: [], beams: [] } satisfies ParsedLayer];

        const sequences: Sequence[] = parsedLayers.map((layer) => ({
            content: layer.content,
        }));

        const beams = parsedLayers.flatMap((layer) => layer.beams);
        this.prependDynamics(measure, staffDef.n, sequences, context);

        const wedges = this.parseHairpins(measure, staffDef.n, scoreDef, measureIndex);
        const pedals = this.parsePedals(measure, staffDef.n, scoreDef, measureIndex);
        const ottavas = this.parseOttavas(measure, staffDef.n, scoreDef, measureIndex);

        return {
            index: measureIndex + 1,
            sequences,
            clefs:
                measureIndex === 0 && staffDef.clef
                    ? [{ clef: staffDef.clef, staff: parseInteger(staffDef.n) }]
                    : undefined,
            beams: beams.length > 0 ? beams : undefined,
            wedges: wedges.length > 0 ? wedges : undefined,
            pedals: pedals.length > 0 ? pedals : undefined,
            ottavas: ottavas.length > 0 ? ottavas : undefined,
        };
    }

    private parseLayer(layer: MeiNode, context: MeiContext): ParsedLayer {
        const content: ParsedLayer["content"] = [];
        const beams: Beam[] = [];

        for (const child of childEntries(layer)) {
            if (child.name === "note") {
                content.push(this.parseNoteEvent(child.node, context));
            } else if (child.name === "rest" || child.name === "mRest") {
                content.push(this.parseRestEvent(child.node, context));
            } else if (child.name === "chord") {
                content.push(this.parseChordEvent(child.node, context));
            } else if (child.name === "beam") {
                const parsedBeam = this.parseBeam(child.node, context);
                content.push(...parsedBeam.content);
                beams.push(...parsedBeam.beams);
            } else if (child.name === "tuplet") {
                const parsedTuplet = this.parseTuplet(child.node, context);
                content.push(parsedTuplet.tuplet);
                beams.push(...parsedTuplet.beams);
            } else if (child.name === "graceGrp") {
                const parsedGrace = this.parseGraceGroup(child.node, context);
                content.push(parsedGrace.grace);
                beams.push(...parsedGrace.beams);
            }
        }

        return { content, beams };
    }

    private parseBeam(beam: MeiNode, context: MeiContext): ParsedLayer {
        const parsed = this.parseLayer(beam, context);
        const eventIds = parsed.content
            .filter((item): item is Event => "id" in item && !("type" in item))
            .map((event) => event.id)
            .filter((id): id is string => !!id);

        return {
            content: parsed.content,
            beams: eventIds.length > 1 ? [...parsed.beams, { events: eventIds }] : parsed.beams,
        };
    }

    private parseTuplet(
        tupletNode: MeiNode,
        context: MeiContext,
    ): { tuplet: Tuplet; beams: Beam[] } {
        const parsed = this.parseLayer(tupletNode, context);
        const duration = this.durationFromNode(tupletNode, "eighth");
        const actual = parseInteger(attr(tupletNode, "num")) || 3;
        const normal = parseInteger(attr(tupletNode, "numbase")) || 2;

        return {
            tuplet: {
                type: "tuplet",
                inner: { duration, multiple: actual },
                outer: { duration, multiple: normal },
                content: parsed.content,
            },
            beams: parsed.beams,
        };
    }

    private parseGraceGroup(
        graceNode: MeiNode,
        context: MeiContext,
    ): { grace: { type: "grace"; content: Event[] }; beams: Beam[] } {
        const parsed = this.parseLayer(graceNode, context);
        const events = parsed.content.filter(
            (item): item is Event => "id" in item && !("type" in item),
        );
        return {
            grace: { type: "grace", content: events },
            beams: parsed.beams,
        };
    }

    private parseNoteEvent(noteNode: MeiNode, context: MeiContext): Event {
        const eventId = xmlId(noteNode) || this.nextEventId(context);
        const note = this.parseNote(noteNode, context, eventId);
        const event: Event = {
            id: eventId,
            duration: this.durationFromNode(noteNode),
            notes: [note],
            staff: parseInteger(attr(noteNode, "staff")),
            articulations: this.parseArticulations(noteNode),
            lyrics: this.parseLyrics(noteNode, context),
        };

        const compacted = compactEvent(event);
        this.registerNote(noteNode, compacted, note, context);
        return compacted;
    }

    private parseChordEvent(chordNode: MeiNode, context: MeiContext): Event {
        const eventId = xmlId(chordNode) || this.nextEventId(context);
        const duration = this.durationFromNode(chordNode);
        const notes = findChildren(chordNode, "note").map((noteNode) => {
            const note = this.parseNote(noteNode, context);
            this.registerNote(
                noteNode,
                { id: eventId, duration, notes: [] },
                note,
                context,
                eventId,
            );
            return note;
        });

        const event: Event = {
            id: eventId,
            duration,
            notes,
            staff: parseInteger(attr(chordNode, "staff")),
            articulations: this.parseArticulations(chordNode),
        };
        const compacted = compactEvent(event);

        for (const noteNode of findChildren(chordNode, "note")) {
            const id = xmlId(noteNode);
            if (id) {
                const entry = context.noteIndex.get(id);
                if (entry) entry.event = compacted;
            }
        }

        return compacted;
    }

    private parseRestEvent(restNode: MeiNode, _context: MeiContext): Event {
        const event: Event = {
            id: xmlId(restNode) || `rest-${attr(restNode, "n") || "event"}`,
            duration: this.durationFromNode(restNode),
            rest: {},
            staff: parseInteger(attr(restNode, "staff")),
        };
        return compactEvent(event);
    }

    private parseNote(noteNode: MeiNode, context: MeiContext, fallbackId?: string): Note {
        const pname = attr(noteNode, "pname");
        const octave = parseInteger(attr(noteNode, "oct"));
        const noteId = xmlId(noteNode) || fallbackId || this.nextNoteId(context);
        const note: Note = {
            id: noteId,
            staff: parseInteger(attr(noteNode, "staff")),
            notehead: normalizeNotehead(attr(noteNode, "head.shape")),
            color: attr(noteNode, "color"),
        };

        if (pname && octave !== undefined) {
            const alter = accidentalToAlter(attr(noteNode, "accid") || attr(noteNode, "accid.ges"));
            note.pitch = {
                step: pname.toUpperCase() as Note["pitch"] extends { step: infer S } ? S : never,
                octave,
                alter,
            };
            if (alter !== undefined || attr(noteNode, "accid")) {
                note.accidentalDisplay = { show: true };
            }
        }

        return compactNote(note);
    }

    private durationFromNode(node: MeiNode, fallback: NoteValue["base"] = "quarter"): NoteValue {
        const rawDuration = attr(node, "dur");
        return {
            base: rawDuration ? MEI_DURATIONS[rawDuration] || fallback : fallback,
            dots: parseInteger(attr(node, "dots")) || 0,
        };
    }

    private prependDynamics(
        measure: MeiNode,
        staffNumber: string,
        sequences: Sequence[],
        context: MeiContext,
    ) {
        const firstSequence = sequences[0];
        if (!firstSequence) return;

        const dynamics = findDescendants(measure, "dynam")
            .filter((node) => this.matchesStaff(node, staffNumber))
            .map((node) => textContent(node).trim())
            .filter(Boolean);

        for (const value of dynamics.reverse()) {
            firstSequence.content.unshift({
                type: "dynamic",
                value,
            });
        }

        for (const dynamic of dynamics) {
            if (!context.lyricLines.has(`mei-dynamic-${dynamic}`)) {
                // no-op; keeps this method from owning unrelated MEI metadata.
            }
        }
    }

    private parseHairpins(
        measure: MeiNode,
        staffNumber: string,
        scoreDef: MeiNode | undefined,
        measureIndex: number,
    ): Wedge[] {
        return findDescendants(measure, "hairpin")
            .filter((node) => this.matchesStaff(node, staffNumber))
            .map((node) => {
                const form = (attr(node, "form") || "").toLowerCase();
                const type = form.startsWith("dim") ? "diminuendo" : "crescendo";
                return {
                    type,
                    position: this.tstampToPosition(attr(node, "tstamp"), scoreDef),
                    end: {
                        measure: measureIndex + 1,
                        position: this.tstampToPosition(attr(node, "tstamp2"), scoreDef),
                    },
                    staff: parseInteger(staffNumber),
                } satisfies Wedge;
            });
    }

    private parsePedals(
        measure: MeiNode,
        staffNumber: string,
        scoreDef: MeiNode | undefined,
        measureIndex: number,
    ): Pedal[] {
        return findDescendants(measure, "pedal")
            .filter((node) => this.matchesStaff(node, staffNumber))
            .map((node) => {
                const direction = (attr(node, "dir") || attr(node, "func") || "").toLowerCase();
                return {
                    type: direction === "up" || direction === "stop" ? "stop" : "start",
                    position: this.tstampToPosition(attr(node, "tstamp"), scoreDef),
                    end: attr(node, "tstamp2")
                        ? {
                              measure: measureIndex + 1,
                              position: this.tstampToPosition(attr(node, "tstamp2"), scoreDef),
                          }
                        : undefined,
                    line: attr(node, "line") === "true" || attr(node, "form") === "line",
                    sign: attr(node, "glyph.name") !== "none",
                    staff: parseInteger(staffNumber),
                } satisfies Pedal;
            });
    }

    private parseOttavas(
        measure: MeiNode,
        staffNumber: string,
        scoreDef: MeiNode | undefined,
        measureIndex: number,
    ): Ottava[] {
        return findDescendants(measure, "octave")
            .filter((node) => this.matchesStaff(node, staffNumber))
            .map((node) => {
                const displacement = parseInteger(attr(node, "dis")) || 8;
                const place = (
                    attr(node, "dis.place") ||
                    attr(node, "place") ||
                    "above"
                ).toLowerCase();
                const valueAbs = displacement >= 22 ? 3 : displacement >= 15 ? 2 : 1;
                const value = (place === "below" ? -valueAbs : valueAbs) as Ottava["value"];
                return {
                    value,
                    position: this.tstampToPosition(attr(node, "tstamp"), scoreDef),
                    end: {
                        measure: measureIndex + 1,
                        position: this.tstampToPosition(attr(node, "tstamp2"), scoreDef),
                    },
                    staff: parseInteger(staffNumber),
                };
            });
    }

    private applyLinks(scoreNode: MeiNode, context: MeiContext) {
        for (const slur of findDescendants(scoreNode, "slur")) {
            const source = context.noteIndex.get(stripRef(attr(slur, "startid")));
            const target = context.noteIndex.get(stripRef(attr(slur, "endid")));
            if (source?.event.id && target?.event.id) {
                source.event.slurs = [
                    ...(source.event.slurs || []),
                    {
                        target: target.event.id,
                        side: attr(slur, "curvedir") === "below" ? "down" : "up",
                    },
                ];
            }
        }

        for (const tie of findDescendants(scoreNode, "tie")) {
            const source = context.noteIndex.get(stripRef(attr(tie, "startid")));
            const target = context.noteIndex.get(stripRef(attr(tie, "endid")));
            if (source?.note && target?.note.id) {
                source.note.ties = [...(source.note.ties || []), { target: target.note.id }];
            }
        }
    }

    private parseLyrics(noteNode: MeiNode, context: MeiContext): Event["lyrics"] {
        const lyrics = findChildren(noteNode, "verse")
            .map((verse, index) => {
                const line = attr(verse, "n") || String(index + 1);
                const text = textOfChild(verse, "syl") || textContent(verse);
                const lineId = `verse-${line}`;
                if (!context.lyricLines.has(lineId)) {
                    context.lyricLines.set(lineId, { id: lineId, name: `Verse ${line}` });
                }
                return {
                    text,
                    line: lineId,
                    syllabic: parseSyllabic(attr(findFirstDescendant(verse, "syl"), "con")),
                };
            })
            .filter((lyric) => lyric.text);

        return lyrics.length > 0 ? lyrics : undefined;
    }

    private parseArticulations(node: MeiNode): Articulation[] | undefined {
        const articulations = [
            ...(attr(node, "artic") || "").split(/\s+/),
            ...findChildren(node, "artic").map(
                (artic) => attr(artic, "artic") || textContent(artic),
            ),
        ]
            .map(normalizeArticulation)
            .filter((articulation): articulation is Articulation => !!articulation);

        return articulations.length > 0 ? Array.from(new Set(articulations)) : undefined;
    }

    private findStaff(measure: MeiNode, staffNumber: string): MeiNode | undefined {
        return findChildren(measure, "staff").find(
            (staff) => (attr(staff, "n") || "1") === staffNumber,
        );
    }

    private matchesStaff(node: MeiNode, staffNumber: string): boolean {
        const staff = attr(node, "staff") || attr(node, "staffref");
        if (!staff) return true;
        return staff.split(/\s+/).map(stripRef).includes(staffNumber);
    }

    private tstampToPosition(value: string | undefined, scoreDef: MeiNode | undefined) {
        const count = parseInteger(attr(scoreDef, "meter.count")) || 4;
        const parsed = parseTstamp(value);
        return { fraction: [Math.max(0, parsed - 1), count] as [number, number] };
    }

    private parseClefSign(value: string | undefined): ClefSign | undefined {
        if (!value) return undefined;
        const normalized = value.toLowerCase();
        if (normalized === "g") return "G";
        if (normalized === "f") return "F";
        if (normalized === "c") return "C";
        if (normalized === "perc" || normalized === "percussion") return "percussion";
        if (normalized === "tab") return "TAB";
        return undefined;
    }

    private registerNote(
        noteNode: MeiNode,
        event: Event,
        note: Note,
        context: MeiContext,
        eventIdOverride?: string,
    ) {
        const id = xmlId(noteNode);
        if (id) {
            const indexedEvent = eventIdOverride ? { ...event, id: eventIdOverride } : event;
            context.noteIndex.set(id, { event: indexedEvent, note });
        }
    }

    private nextEventId(context: MeiContext): string {
        return `mei-ev${context.eventCounter++}`;
    }

    private nextNoteId(context: MeiContext): string {
        return `mei-n${context.noteCounter++}`;
    }
}

function asRecord(value: unknown): MeiNode {
    return value && typeof value === "object" ? (value as MeiNode) : {};
}

function localName(name: string): string {
    return name.includes(":") ? name.split(":").pop() || name : name;
}

function findFirstByName(node: MeiNode, name: string): MeiNode | undefined {
    for (const [key, value] of Object.entries(node)) {
        if (localName(key) === name) {
            return asArray(value).map(asRecord)[0];
        }
    }
    return undefined;
}

function findFirstDescendant(node: MeiNode | undefined, name: string): MeiNode | undefined {
    if (!node) return undefined;
    for (const child of childEntries(node)) {
        if (child.name === name) return child.node;
        const found = findFirstDescendant(child.node, name);
        if (found) return found;
    }
    return undefined;
}

function findDescendants(node: MeiNode | undefined, name: string): MeiNode[] {
    if (!node) return [];
    const result: MeiNode[] = [];
    for (const child of childEntries(node)) {
        if (child.name === name) result.push(child.node);
        result.push(...findDescendants(child.node, name));
    }
    return result;
}

function findChildren(node: MeiNode | undefined, name: string): MeiNode[] {
    if (!node) return [];
    return childEntries(node)
        .filter((child) => child.name === name)
        .map((child) => child.node);
}

function childEntries(node: MeiNode): Array<{ name: string; node: MeiNode }> {
    const children: Array<{ name: string; node: MeiNode }> = [];
    for (const [key, value] of Object.entries(node)) {
        const name = localName(key);
        if (key.startsWith("@_") || key === "#text") continue;
        for (const child of asArray(value)) {
            if (child && typeof child === "object") {
                children.push({ name, node: child as MeiNode });
            } else if (child !== undefined && child !== null) {
                children.push({ name, node: { "#text": String(child) } });
            }
        }
    }
    return children;
}

function attr(node: MeiNode | undefined, name: string): string | undefined {
    if (!node) return undefined;
    const direct = node[`@_${name}`];
    if (direct !== undefined) return String(direct);

    for (const [key, value] of Object.entries(node)) {
        if (key.startsWith("@_") && localName(key.slice(2)) === name) {
            return String(value);
        }
    }
    return undefined;
}

function xmlId(node: MeiNode): string | undefined {
    return attr(node, "xml:id") || attr(node, "id");
}

function textContent(node: MeiNode | undefined): string {
    if (!node) return "";
    const text = node["#text"];
    const ownText = text === undefined ? "" : String(text);
    return `${ownText}${childEntries(node)
        .map((child) => textContent(child.node))
        .join("")}`;
}

function textOfChild(node: MeiNode, childName: string): string | undefined {
    const child = findFirstDescendant(node, childName);
    const value = textContent(child).trim();
    return value || undefined;
}

function asArray(value: unknown): unknown[] {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value : [value];
}

function parseInteger(value: string | undefined): number | undefined {
    if (value === undefined) return undefined;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function parseKeySignature(value: string | undefined): number | undefined {
    if (!value || value === "mixed") return undefined;
    if (/^-?\d+$/.test(value)) return Number.parseInt(value, 10);
    const match = value.match(/^(\d+)([sf])$/i);
    if (!match) return undefined;
    const count = Number.parseInt(match[1], 10);
    return match[2].toLowerCase() === "s" ? count : -count;
}

function accidentalToAlter(value: string | undefined): number | undefined {
    switch (value?.toLowerCase()) {
        case "s":
        case "sharp":
            return 1;
        case "f":
        case "flat":
            return -1;
        case "n":
        case "natural":
            return 0;
        case "ss":
        case "x":
            return 2;
        case "ff":
            return -2;
        default:
            return undefined;
    }
}

function normalizeNotehead(value: string | undefined): Note["notehead"] | undefined {
    switch (value?.toLowerCase()) {
        case "x":
        case "cross":
            return "x";
        case "diamond":
            return "diamond";
        case "triangle":
            return "triangle";
        case "slash":
            return "slash";
        case "square":
            return "square";
        case "circle-x":
        case "circle x":
            return "circle-x";
        default:
            return undefined;
    }
}

function normalizeArticulation(value: string | undefined): Articulation | undefined {
    switch (value?.toLowerCase()) {
        case "stacc":
        case "staccato":
            return "staccato";
        case "ten":
        case "tenuto":
            return "tenuto";
        case "acc":
        case "accent":
            return "accent";
        case "marc":
        case "marcato":
            return "strong-accent";
        case "stacciss":
        case "staccatissimo":
            return "staccatissimo";
        case "fermata":
            return "fermata";
        default:
            return undefined;
    }
}

function parseSyllabic(value: string | undefined): Syllabic | undefined {
    switch (value) {
        case "d":
            return "begin";
        case "u":
            return "end";
        default:
            return undefined;
    }
}

function parseTstamp(value: string | undefined): number {
    if (!value) return 1;
    const match = value.match(/(?:\+)?(\d+(?:\.\d+)?)/);
    return match ? Number.parseFloat(match[1]) : 1;
}

function stripRef(value: string | undefined): string {
    return value?.replace(/^#/, "") || "";
}

function compactEvent(event: Event): Event {
    return Object.fromEntries(
        Object.entries(event).filter(([, value]) => value !== undefined),
    ) as Event;
}

function compactNote(note: Note): Note {
    return Object.fromEntries(
        Object.entries(note).filter(([, value]) => value !== undefined),
    ) as Note;
}
