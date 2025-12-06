import { XMLParser } from "fast-xml-parser";
import type { Score, GlobalMeasure, Part, PartMeasure, LyricLine } from "@melos/core";
import { MeasureParser, type PartParsingContext } from "./parsers/MeasureParser";
import { resetIdCounters } from "./parsers/Utils";

export class MusicXMLToMNX {
    private xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

    convert(xmlContent: string): Score {
        resetIdCounters();
        const xmlObj = this.xmlParser.parse(xmlContent);
        const root = xmlObj["score-partwise"];

        if (!root) {
            throw new Error("Invalid MusicXML: Missing score-partwise");
        }

        // 1. Build Global Track (Time, Key) & Global Divisions (Assumption: unified)
        const partsArray = Array.isArray(root.part) ? root.part : [root.part];
        const firstPartMeasures = Array.isArray(partsArray[0]?.measure) ? partsArray[0].measure : [partsArray[0]?.measure];

        const globalMeasures: GlobalMeasure[] = [];
        let globalDivisions = 1;

        firstPartMeasures.forEach((m: any, index: number) => {
            const gm: GlobalMeasure = {};

            // Capture divisions from the first relevant measure (usually measure 1)
            if (m.attributes && m.attributes.divisions) {
                globalDivisions = parseInt(m.attributes.divisions);
            }

            if (m.attributes && m.attributes.time) {
                gm.time = {
                    count: parseInt(m.attributes.time.beats),
                    unit: parseInt(m.attributes.time["beat-type"])
                };
            }

            if (m.attributes && m.attributes.key) {
                gm.key = {
                    fifths: parseInt(m.attributes.key.fifths)
                };
                if (m.attributes.key.mode) {
                    gm.key.mode = m.attributes.key.mode;
                }
            }

            if (m.barline) {
                const style = m.barline["bar-style"];
                if (style === "light-heavy") {
                    gm.barline = { type: "final" };
                }
            }

            // [NEW] Layout Breaks (from <print>)
            if (m.print) {
                if (m.print["@_new-page"] === "yes") {
                    gm.break = "page";
                } else if (m.print["@_new-system"] === "yes") {
                    gm.break = "system";
                }
            }

            globalMeasures.push(gm);
        });

        // Shared lyric lines collection across all parts
        const sharedLyricLines = new Map<string, { id: string, name: string }>();

        // 2. Build Parts
        const mnxParts: Part[] = partsArray.map((p: any, pIndex: number) => {
            const partMeasuresRaw = Array.isArray(p.measure) ? p.measure : [p.measure];

            // Initialize Context for this Part (persists across measures)
            const context: PartParsingContext = {
                activeSlurs: {},
                activeTies: {},
                activeWedges: {},
                activeOttavas: {}, // [NEW] Ottava tracking
                lyricLines: sharedLyricLines // Pass shared map
            };

            const mnxMeasures: PartMeasure[] = partMeasuresRaw.map((m: any, mIndex: number) => {
                // Pass context, divisions, and measure index
                const parser = new MeasureParser(m, context, globalDivisions, mIndex + 1);
                return parser.parse();
            });

            return {
                id: `P${pIndex + 1}`,
                name: `Part ${pIndex + 1}`,
                measures: mnxMeasures
            };
        });

        // Convert sharedLyricLines map to array for Global schema
        const lyricLinesArray: LyricLine[] = Array.from(sharedLyricLines.values());

        return {
            mnx: { version: 1 },
            global: {
                measures: globalMeasures,
                lyrics: lyricLinesArray.length > 0 ? lyricLinesArray : undefined
            },
            parts: mnxParts
        };
    }
}
