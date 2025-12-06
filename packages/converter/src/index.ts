import { XMLParser } from "fast-xml-parser";
import type { Score, GlobalMeasure, Part, PartMeasure, LyricLine, Jump } from "@melos/core";
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
                // Handle single barline or array of barlines (left/right)
                const barlines = Array.isArray(m.barline) ? m.barline : [m.barline];

                barlines.forEach((bl: any) => {
                    const style = bl["bar-style"];
                    const location = bl["@_location"] || "right";

                    // Bar style
                    if (style === "light-heavy") {
                        gm.barline = { type: "final" };
                    }

                    // Repeat signs
                    if (bl.repeat) {
                        const direction = bl.repeat["@_direction"];
                        if (direction === "forward") {
                            gm.repeatStart = {};
                            gm.barline = { type: "repeat-forward" };
                        } else if (direction === "backward") {
                            const times = bl.repeat["@_times"] ? parseInt(bl.repeat["@_times"]) : undefined;
                            gm.repeatEnd = times ? { times } : {};
                            gm.barline = { type: "repeat-backward" };
                        }
                    }

                    // Volta endings (1st, 2nd ending brackets)
                    if (bl.ending) {
                        const endingType = bl.ending["@_type"]; // start, stop, discontinue
                        const number = bl.ending["@_number"];

                        if (endingType === "start" && number) {
                            // Parse ending numbers (e.g., "1" or "1, 2")
                            const numbers = number.split(/[,\s]+/).map((n: string) => parseInt(n.trim())).filter((n: number) => !isNaN(n));
                            gm.ending = {
                                numbers: numbers,
                                duration: 1, // Will be updated when we see the stop
                                open: endingType === "discontinue"
                            };
                        }
                    }
                });
            }

            // [NEW] Layout Breaks (from <print>)
            if (m.print) {
                if (m.print["@_new-page"] === "yes") {
                    gm.break = "page";
                } else if (m.print["@_new-system"] === "yes") {
                    gm.break = "system";
                }
            }

            // [NEW] Jumps & Markers (Segno, Coda, Fine, D.C., D.S.)
            if (m.direction) {
                const directions = Array.isArray(m.direction) ? m.direction : [m.direction];
                const jumps: Jump[] = [];

                directions.forEach((d: any) => {
                    const dTypes = Array.isArray(d["direction-type"]) ? d["direction-type"] : [d["direction-type"]];

                    dTypes.forEach((dt: any) => {
                        if (dt.segno) {
                            jumps.push({ type: "segno" });
                        }
                        if (dt.coda) {
                            jumps.push({ type: "coda" });
                        }
                        if (dt.words) {
                            const rawText = (typeof dt.words === "object" ? dt.words["#text"] : dt.words) || "";
                            const text = String(rawText).trim().toLowerCase().replace(/\./g, ""); // "d.c." -> "dc"

                            if (text === "fine") {
                                jumps.push({ type: "fine" });
                            } else if (text.includes("dc") && text.includes("fine")) {
                                jumps.push({ type: "dc-al-fine" });
                            } else if (text.includes("ds") && text.includes("fine")) {
                                jumps.push({ type: "ds-al-fine" });
                            } else if (text.includes("dc") && text.includes("coda")) {
                                jumps.push({ type: "dc-al-coda" });
                            } else if (text.includes("ds") && text.includes("coda")) {
                                jumps.push({ type: "ds-al-coda" });
                            } else if (text === "dc") {
                                jumps.push({ type: "dc" });
                            } else if (text === "ds") {
                                jumps.push({ type: "ds" });
                            }
                        }
                    });
                });

                if (jumps.length > 0) {
                    gm.jumps = jumps;
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
