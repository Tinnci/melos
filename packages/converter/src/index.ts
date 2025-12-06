import { XMLParser } from "fast-xml-parser";
import type { Score, GlobalMeasure, Part, PartMeasure } from "@melos/core";
import { MeasureParser } from "./parsers/MeasureParser";
import { resetEventIdCounter } from "./parsers/Utils";

export class MusicXMLToMNX {
    private xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

    convert(xmlContent: string): Score {
        resetEventIdCounter();
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
            const gm: GlobalMeasure = {}; // index is implicit or optional

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
                if (m.attributes.key.mode) {
                    gm.key.mode = m.attributes.key.mode;
                }
            }

            // Extract Barline
            if (m.barline) {
                const style = m.barline["bar-style"];
                if (style === "light-heavy") {
                    gm.barline = { type: "final" };
                }
            }

            globalMeasures.push(gm);
        });

        // 2. Build Parts
        const mnxParts: Part[] = partsArray.map((p: any, pIndex: number) => {
            const partMeasuresRaw = Array.isArray(p.measure) ? p.measure : [p.measure];

            const mnxMeasures: PartMeasure[] = partMeasuresRaw.map((m: any, mIndex: number) => {
                // Use the new MeasureParser
                const parser = new MeasureParser(m);
                return parser.parse();
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
