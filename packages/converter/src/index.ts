import { XMLParser } from "fast-xml-parser";
import type { GlobalMeasure, Jump, LyricLine, Part, PartMeasure, Score } from "@melos/core";
import { MeasureParser, type PartParsingContext } from "./parsers/MeasureParser";
import { parseInteger, resetIdCounters } from "./parsers/Utils";
import {
    findOrderedRoot,
    getOrderedChildren,
    getOrderedContent,
    isXmlRecord,
    type OrderedXmlNode,
    type XmlRecord,
    xmlRecords,
    xmlText,
} from "./parsers/OrderedXml";

type SoundDefinition = NonNullable<Part["sounds"]>[number];
type PartMeta = {
    name?: string;
    sounds: SoundDefinition[];
};
type ParsedMusicXml = {
    root: XmlRecord;
    parts: XmlRecord[];
    orderedPartNodes: OrderedXmlNode[];
};
type PartParseContext = {
    partMeta: Map<string, PartMeta>;
    lyricLines: Map<string, { id: string; name: string }>;
    initialDivisions: number;
};
type GlobalParseResult = {
    measures: GlobalMeasure[];
    initialDivisions: number;
};
type KeyMode = NonNullable<NonNullable<GlobalMeasure["key"]>["mode"]>;
type JumpTextPattern = {
    matches: (text: string) => boolean;
    jump: Jump;
};

const JUMP_TEXT_PATTERNS: JumpTextPattern[] = [
    { matches: (text) => text === "fine", jump: { type: "fine" } },
    {
        matches: (text) => text.includes("dc") && text.includes("fine"),
        jump: { type: "dc-al-fine" },
    },
    {
        matches: (text) => text.includes("ds") && text.includes("fine"),
        jump: { type: "ds-al-fine" },
    },
    {
        matches: (text) => text.includes("dc") && text.includes("coda"),
        jump: { type: "dc-al-coda" },
    },
    {
        matches: (text) => text.includes("ds") && text.includes("coda"),
        jump: { type: "ds-al-coda" },
    },
    { matches: (text) => text === "dc", jump: { type: "dc" } },
    { matches: (text) => text === "ds", jump: { type: "ds" } },
];

export class MusicXMLToMNX {
    private xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
    private orderedXmlParser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        preserveOrder: true,
    });

    convert(xmlContent: string): Score {
        resetIdCounters();

        const parsed = this.parseMusicXml(xmlContent);
        const global = parseGlobalMeasures(parsed.parts[0]);
        const lyricLines = new Map<string, { id: string; name: string }>();
        const partMeta = parsePartMetadata(parsed.root);
        const parts = parseParts(parsed, partMeta, lyricLines, global.initialDivisions);
        const lyrics: LyricLine[] = Array.from(lyricLines.values());

        return {
            mnx: { version: 1 },
            global: {
                measures: global.measures,
                lyrics: lyrics.length > 0 ? lyrics : undefined,
            },
            parts,
        };
    }

    private parseMusicXml(xmlContent: string): ParsedMusicXml {
        const xmlObj = this.xmlParser.parse(xmlContent) as unknown;
        const orderedXmlObj = this.orderedXmlParser.parse(xmlContent) as unknown;
        const root = isXmlRecord(xmlObj) ? xmlObj["score-partwise"] : undefined;

        if (!isXmlRecord(root)) {
            throw new Error("Invalid MusicXML: Missing score-partwise");
        }

        const parts = xmlRecords(root.part);
        if (parts.length === 0) {
            throw new Error("Invalid MusicXML: Missing part");
        }

        const orderedNodes = Array.isArray(orderedXmlObj) ? orderedXmlObj.filter(isXmlRecord) : [];
        const orderedRoot = findOrderedRoot(orderedNodes, "score-partwise");

        return {
            root,
            parts,
            orderedPartNodes: getOrderedChildren(orderedRoot, "part"),
        };
    }
}

function parseGlobalMeasures(firstPart: XmlRecord): GlobalParseResult {
    const partMeasures = xmlRecords(firstPart.measure);
    const measures = partMeasures.length > 0 ? partMeasures : [{}];
    const globalMeasures: GlobalMeasure[] = [];
    let initialDivisions = 1;

    measures.forEach((measure, measureIndex) => {
        const globalMeasure = parseGlobalMeasure(measure);
        const measureDivisions = findAttributeValue(xmlRecords(measure.attributes), "divisions");
        if (measureDivisions !== undefined && measureIndex === 0) {
            initialDivisions = measureDivisions;
        }

        globalMeasures.push(globalMeasure);
    });

    return { measures: globalMeasures, initialDivisions };
}

function parseGlobalMeasure(measure: XmlRecord): GlobalMeasure {
    const globalMeasure: GlobalMeasure = {};
    applyTimeAndKey(measure, globalMeasure);
    applyBarlines(measure, globalMeasure);
    applyLayoutBreak(measure, globalMeasure);
    applyJumps(measure, globalMeasure);
    return globalMeasure;
}

function applyTimeAndKey(measure: XmlRecord, globalMeasure: GlobalMeasure) {
    const attributes = xmlRecords(measure.attributes);
    const time = attributes.map((attribute) => firstXmlRecord(attribute.time)).find(Boolean);
    if (time) {
        const count = parseInteger(time.beats);
        const unit = parseInteger(time["beat-type"]);
        if (count !== undefined && unit !== undefined) {
            globalMeasure.time = { count, unit };
        }
    }

    const key = attributes.map((attribute) => firstXmlRecord(attribute.key)).find(Boolean);
    if (key) {
        const fifths = parseInteger(key.fifths);
        if (fifths !== undefined) {
            globalMeasure.key = { fifths };
            const mode = asKeyMode(xmlText(key.mode));
            if (mode) {
                globalMeasure.key.mode = mode;
            }
        }
    }
}

function applyBarlines(measure: XmlRecord, globalMeasure: GlobalMeasure) {
    xmlRecords(measure.barline).forEach((barline) => {
        applyBarlineStyle(barline, globalMeasure);
        applyRepeat(barline, globalMeasure);
        applyEnding(barline, globalMeasure);
    });
}

function applyBarlineStyle(barline: XmlRecord, globalMeasure: GlobalMeasure) {
    const style = xmlText(barline["bar-style"]);
    if (style === "light-heavy") {
        globalMeasure.barline = { type: "final" };
    } else if (style === "light-light") {
        globalMeasure.barline = { type: "double" };
    } else if (style === "dashed" || style === "dotted") {
        globalMeasure.barline = { type: style };
    }
}

function applyRepeat(barline: XmlRecord, globalMeasure: GlobalMeasure) {
    const repeat = firstXmlRecord(barline.repeat);
    const direction = repeat ? xmlText(repeat["@_direction"]) : undefined;
    if (direction === "forward") {
        globalMeasure.repeatStart = {};
        globalMeasure.barline = { type: "repeat-forward" };
    } else if (direction === "backward" && repeat) {
        const times = parseInteger(repeat["@_times"]);
        globalMeasure.repeatEnd = times ? { times } : {};
        globalMeasure.barline = { type: "repeat-backward" };
    }
}

function applyEnding(barline: XmlRecord, globalMeasure: GlobalMeasure) {
    const ending = firstXmlRecord(barline.ending);
    if (!ending) return;

    const endingType = xmlText(ending["@_type"]);
    const numbers = parseEndingNumbers(xmlText(ending["@_number"]));
    if (endingType !== "start" || numbers.length === 0) return;

    globalMeasure.ending = {
        numbers,
        duration: 1,
        open: false,
    };
}

function applyLayoutBreak(measure: XmlRecord, globalMeasure: GlobalMeasure) {
    const print = firstXmlRecord(measure.print);
    if (!print) return;

    if (xmlText(print["@_new-page"]) === "yes") {
        globalMeasure.break = "page";
    } else if (xmlText(print["@_new-system"]) === "yes") {
        globalMeasure.break = "system";
    }
}

function applyJumps(measure: XmlRecord, globalMeasure: GlobalMeasure) {
    const jumps = xmlRecords(measure.direction).flatMap((direction) =>
        xmlRecords(direction["direction-type"]).flatMap(parseJumpsFromDirectionType),
    );

    if (jumps.length > 0) {
        globalMeasure.jumps = jumps;
    }
}

function parseJumpsFromDirectionType(directionType: XmlRecord): Jump[] {
    const jumps: Jump[] = [];
    if (hasMusicXmlElement(directionType.segno)) {
        jumps.push({ type: "segno" });
    }
    if (hasMusicXmlElement(directionType.coda)) {
        jumps.push({ type: "coda" });
    }

    const textJump = parseJumpText(xmlText(directionType.words));
    if (textJump) {
        jumps.push(textJump);
    }

    return jumps;
}

function parseJumpText(rawText: string | undefined): Jump | undefined {
    const text = rawText?.trim().toLowerCase().replace(/\./g, "");
    if (!text) return undefined;

    return JUMP_TEXT_PATTERNS.find((pattern) => pattern.matches(text))?.jump;
}

function parsePartMetadata(root: XmlRecord): Map<string, PartMeta> {
    const partList = firstXmlRecord(root["part-list"]);
    const partMeta = new Map<string, PartMeta>();
    if (!partList) return partMeta;

    xmlRecords(partList["score-part"]).forEach((scorePart) => {
        const partId = xmlText(scorePart["@_id"]);
        if (!partId) return;

        partMeta.set(partId, {
            name: xmlText(scorePart["part-name"]),
            sounds: xmlRecords(scorePart["midi-instrument"]).map(parseSoundDefinition),
        });
    });

    return partMeta;
}

function parseSoundDefinition(midiInstrument: XmlRecord): SoundDefinition {
    const sound: SoundDefinition = {};
    const id = xmlText(midiInstrument["@_id"]);
    const program = parseInteger(midiInstrument["midi-program"]);
    const channel = parseInteger(midiInstrument["midi-channel"]);
    const bank = parseInteger(midiInstrument["midi-bank"]);

    if (id) sound.id = id;
    if (program !== undefined) sound["midi-program"] = program;
    if (channel !== undefined) sound["midi-channel"] = channel;
    if (bank !== undefined) sound["midi-bank"] = bank;

    return sound;
}

function parseParts(
    parsed: ParsedMusicXml,
    partMeta: Map<string, PartMeta>,
    lyricLines: Map<string, { id: string; name: string }>,
    initialDivisions: number,
): Part[] {
    const context: PartParseContext = {
        partMeta,
        lyricLines,
        initialDivisions,
    };

    return parsed.parts.map((partXml, partIndex) =>
        parsePart(partXml, partIndex, parsed.orderedPartNodes[partIndex], context),
    );
}

function parsePart(
    partXml: XmlRecord,
    partIndex: number,
    orderedPartNode: OrderedXmlNode | undefined,
    context: PartParseContext,
): Part {
    const partContext = createPartParsingContext(context.lyricLines);
    const orderedMeasureNodes = getOrderedChildren(orderedPartNode, "measure");
    let partDivisions = context.initialDivisions;
    const measures = xmlRecords(partXml.measure).map((measureXml, measureIndex) => {
        const measureDivisions = findAttributeValue(xmlRecords(measureXml.attributes), "divisions");
        if (measureDivisions !== undefined) {
            partDivisions = measureDivisions;
        }

        const parser = new MeasureParser(
            measureXml,
            partContext,
            partDivisions,
            measureIndex + 1,
            getOrderedContent(orderedMeasureNodes[measureIndex]),
        );
        return parser.parse();
    });
    const partId = xmlText(partXml["@_id"]);
    const meta = partId ? context.partMeta.get(partId) : undefined;

    return {
        id: partId,
        name: meta?.name || `Part ${partIndex + 1}`,
        sounds: meta?.sounds && meta.sounds.length > 0 ? meta.sounds : undefined,
        measures: measures satisfies PartMeasure[],
    };
}

function createPartParsingContext(
    lyricLines: Map<string, { id: string; name: string }>,
): PartParsingContext {
    return {
        activeSlurs: {},
        activeTies: {},
        activeWedges: {},
        activeOttavas: {},
        activeTremolos: {},
        lyricLines,
    };
}

function findAttributeValue(attributes: XmlRecord[], key: string): number | undefined {
    for (const attribute of attributes) {
        const value = parseInteger(attribute[key]);
        if (value !== undefined) return value;
    }

    return undefined;
}

function firstXmlRecord(value: unknown): XmlRecord | undefined {
    if (Array.isArray(value)) {
        return value.find(isXmlRecord);
    }

    return isXmlRecord(value) ? value : undefined;
}

function hasMusicXmlElement(value: unknown): boolean {
    return value !== undefined;
}

function parseEndingNumbers(value: string | undefined): number[] {
    if (!value) return [];

    return value
        .split(/[,\s]+/)
        .map((numberText) => parseInteger(numberText.trim()))
        .filter((number): number is number => number !== undefined);
}

function asKeyMode(value: string | undefined): KeyMode | undefined {
    if (value === "major" || value === "minor") return value;
    return undefined;
}
