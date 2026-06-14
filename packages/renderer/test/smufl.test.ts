import { describe, expect, it } from "bun:test";
import { ScoreSchema } from "@melos/core";
import { Renderer } from "../src/index";
import {
    getSmuflChar,
    resolveAccidentalGlyph,
    resolveArticulationGlyph,
    resolveDynamicGlyphs,
    resolveNoteheadGlyph,
    resolvePedalGlyph
} from "../src/smufl";

describe("SMuFL rendering support", () => {
    it("accepts W3C MNX SMuFL fields in the core score model", () => {
        const score = ScoreSchema.parse({
            mnx: { version: 1 },
            global: { measures: [{}] },
            parts: [{
                id: "P1",
                name: "Piano",
                smuflFont: "Bravura",
                measures: [{
                    clefs: [{
                        clef: { sign: "G", staffPosition: -2, glyph: "fClef" }
                    }],
                    sequences: [{
                        content: [
                            { type: "dynamic", value: "sfz", glyph: "dynamicSforzando" },
                            {
                                duration: { base: "quarter" },
                                notes: [{
                                    pitch: { step: "C", octave: 4, alter: 2 },
                                    accidentalDisplay: { show: true }
                                }]
                            }
                        ]
                    }]
                }]
            }]
        });

        expect(score.parts[0].smuflFont).toBe("Bravura");
        expect(score.parts[0].measures[0].clefs?.[0].clef.glyph).toBe("fClef");
    });

    it("resolves common accidentals and dynamics to SMuFL glyph names", () => {
        expect(resolveAccidentalGlyph(2)).toBe("accidentalDoubleSharp");
        expect(resolveAccidentalGlyph(-2)).toBe("accidentalDoubleFlat");
        expect(resolveDynamicGlyphs("sfz")).toEqual(["dynamicSforzando", "dynamicForte", "dynamicZ"]);
        expect(resolveDynamicGlyphs("ppppp")).toEqual([
            "dynamicPiano",
            "dynamicPiano",
            "dynamicPiano",
            "dynamicPiano",
            "dynamicPiano"
        ]);
        expect(resolveNoteheadGlyph("quarter", "diamond")).toBe("noteheadDiamondBlack");
        expect(resolveArticulationGlyph("staccato", "below")).toBe("articStaccatoBelow");
        expect(resolvePedalGlyph("start")).toBe("keyboardPedalPed");
        expect(getSmuflChar("dynamicForte")).toBe(String.fromCodePoint(0xe522));
        expect(getSmuflChar("augmentationDot")).toBe(String.fromCodePoint(0xe1e7));
    });

    it("emits SMuFL glyph metadata for clefs, dynamics, and accidentals", () => {
        const score = ScoreSchema.parse({
            mnx: { version: 1 },
            global: { measures: [{}] },
            parts: [{
                id: "P1",
                measures: [{
                    clefs: [{
                        clef: { sign: "G", staffPosition: -2, glyph: "fClef" }
                    }],
                    sequences: [{
                        content: [
                            { type: "dynamic", value: "sfz" },
                            {
                                duration: { base: "quarter" },
                                notes: [{
                                    pitch: { step: "C", octave: 4, alter: 2 },
                                    accidentalDisplay: { show: true }
                                }]
                            }
                        ]
                    }]
                }]
            }]
        });

        const svg = new Renderer().render(score);
        expect(svg).toContain('class="smufl-glyph"');
        expect(svg).toContain('data-smufl-glyph="fClef"');
        expect(svg).toContain('data-smufl-glyph="dynamicSforzando dynamicForte dynamicZ"');
        expect(svg).toContain('data-smufl-glyph="accidentalDoubleSharp"');
    });

    it("emits SMuFL metadata for noteheads, articulations, and pedal signs", () => {
        const score = ScoreSchema.parse({
            mnx: { version: 1 },
            global: { measures: [{}] },
            parts: [{
                id: "P1",
                measures: [{
                    pedals: [{
                        type: "start",
                        position: { fraction: [0, 1] },
                        sign: true,
                        line: true
                    }],
                    sequences: [{
                        content: [{
                            id: "ev1",
                            duration: { base: "quarter" },
                            articulations: ["staccato", "fermata"],
                            notes: [{
                                pitch: { step: "C", octave: 4 },
                                notehead: "diamond"
                            }]
                        }]
                    }]
                }]
            }]
        });

        const svg = new Renderer().render(score);
        expect(svg).toContain('data-smufl-glyph="noteheadDiamondBlack"');
        expect(svg).toContain('data-smufl-glyph="articStaccatoBelow"');
        expect(svg).toContain('data-smufl-glyph="fermataBelow"');
        expect(svg).toContain('data-smufl-glyph="keyboardPedalPed"');
    });

    it("uses rhythmic stop positions for pedal bracket lines", () => {
        const score = ScoreSchema.parse({
            mnx: { version: 1 },
            global: { measures: [{}] },
            parts: [{
                id: "P1",
                measures: [{
                    pedals: [{
                        type: "start",
                        position: { fraction: [0, 4] },
                        end: { measure: 1, position: { fraction: [2, 4] } },
                        sign: true,
                        line: true
                    }],
                    sequences: [{
                        content: Array.from({ length: 4 }, (_, index) => ({
                            id: `ev${index + 1}`,
                            duration: { base: "quarter" },
                            notes: [{ pitch: { step: "C", octave: 4 } }]
                        }))
                    }]
                }]
            }]
        });

        const svg = new Renderer().render(score);
        expect(svg).toContain('data-smufl-glyph="keyboardPedalPed"');
        expect(svg).toContain('<path d="M127 151 L127 161 L165 161 L165 151"');
    });

    it("escapes custom dynamic text before writing SVG", () => {
        const score = ScoreSchema.parse({
            mnx: { version: 1 },
            global: { measures: [{}] },
            parts: [{
                id: "P1",
                measures: [{
                    sequences: [{
                        content: [
                            { type: "dynamic", value: "<grow&fade>" },
                            {
                                duration: { base: "quarter" },
                                notes: [{ pitch: { step: "C", octave: 4 } }]
                            }
                        ]
                    }]
                }]
            }]
        });

        const svg = new Renderer().render(score);
        expect(svg).toContain("&lt;grow&amp;fade&gt;");
        expect(svg).not.toContain("<grow&fade>");
    });

    it("renders augmentation dots for dotted notes and rests", () => {
        const score = ScoreSchema.parse({
            mnx: { version: 1 },
            global: { measures: [{}] },
            parts: [{
                id: "P1",
                measures: [{
                    sequences: [{
                        content: [
                            {
                                duration: { base: "quarter", dots: 1 },
                                notes: [{ pitch: { step: "C", octave: 4 } }]
                            },
                            {
                                duration: { base: "quarter", dots: 1 },
                                rest: {}
                            }
                        ]
                    }]
                }]
            }]
        });

        const svg = new Renderer().render(score);
        expect(svg.match(/data-smufl-glyph="augmentationDot"/g)).toHaveLength(2);
    });
});
