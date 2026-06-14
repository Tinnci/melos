import { describe, expect, it } from "bun:test";
import { ScoreSchema } from "@melos/core";
import { MnxValidator } from "../src/validator";

describe("MnxValidator", () => {
    it("keeps structural validation in MNX while delegating rhythm to the core timeline", () => {
        const score = ScoreSchema.parse({
            mnx: { version: 1 },
            global: { measures: [{ time: { count: 4, unit: 4 } }, {}] },
            parts: [{
                id: "P1",
                measures: [{
                    sequences: [{
                        content: [{
                            duration: { base: "whole" },
                            notes: [{ pitch: { step: "C", octave: 4 } }]
                        }]
                    }]
                }]
            }]
        });

        expect(MnxValidator.validate(score).map((issue) => issue.path)).toEqual(["parts[0]"]);
    });

    it("allows pickup measures by default but can report them when requested", () => {
        const score = ScoreSchema.parse({
            mnx: { version: 1 },
            global: { measures: [{ time: { count: 4, unit: 4 } }] },
            parts: [{
                id: "P1",
                measures: [{
                    sequences: [{
                        content: [{
                            duration: { base: "quarter" },
                            notes: [{ pitch: { step: "C", octave: 4 } }]
                        }]
                    }]
                }]
            }]
        });

        expect(MnxValidator.validate(score)).toEqual([]);
        expect(MnxValidator.validate(score, { allowPickupMeasure: false }).map((issue) => issue.path)).toEqual([
            "parts[0].measures[0].sequences[0]"
        ]);
    });

    it("uses inherited time signatures through the core timeline", () => {
        const score = ScoreSchema.parse({
            mnx: { version: 1 },
            global: {
                measures: [
                    { time: { count: 3, unit: 4 } },
                    {}
                ]
            },
            parts: [{
                id: "P1",
                measures: [
                    {
                        sequences: [{
                            content: ["C", "D", "E"].map((step) => ({
                                duration: { base: "quarter" },
                                notes: [{ pitch: { step, octave: 4 } }]
                            }))
                        }]
                    },
                    {
                        sequences: [{
                            content: [{
                                duration: { base: "quarter" },
                                notes: [{ pitch: { step: "F", octave: 4 } }]
                            }]
                        }]
                    }
                ]
            }]
        });

        expect(MnxValidator.validate(score).map((issue) => issue.path)).toEqual([
            "parts[0].measures[1].sequences[0]"
        ]);
    });

    it("uses core tuplet scaling instead of validator-local duration math", () => {
        const score = ScoreSchema.parse({
            mnx: { version: 1 },
            global: { measures: [{ time: { count: 4, unit: 4 } }] },
            parts: [{
                id: "P1",
                measures: [{
                    sequences: [{
                        content: [
                            {
                                type: "tuplet",
                                inner: { duration: { base: "eighth" }, multiple: 3 },
                                outer: { duration: { base: "eighth" }, multiple: 2 },
                                content: ["C", "D", "E"].map((step) => ({
                                    duration: { base: "eighth" },
                                    notes: [{ pitch: { step, octave: 4 } }]
                                }))
                            },
                            ...["F", "G", "A"].map((step) => ({
                                duration: { base: "quarter" },
                                notes: [{ pitch: { step, octave: 4 } }]
                            }))
                        ]
                    }]
                }]
            }]
        });

        expect(MnxValidator.validate(score)).toEqual([]);
    });

    it("checks pitch bounds recursively inside nested content", () => {
        const score = ScoreSchema.parse({
            mnx: { version: 1 },
            global: { measures: [{ time: { count: 4, unit: 4 } }] },
            parts: [{
                id: "P1",
                measures: [{
                    sequences: [{
                        content: [
                            {
                                type: "grace",
                                content: [{
                                    duration: { base: "16th" },
                                    notes: [{ pitch: { step: "C", octave: 10 } }]
                                }]
                            },
                            {
                                duration: { base: "whole" },
                                notes: [{ pitch: { step: "D", octave: 4 } }]
                            }
                        ]
                    }]
                }]
            }]
        });

        expect(MnxValidator.validate(score).map((issue) => issue.path)).toEqual([
            "parts[0].measures[0].sequences[0].content[0].content[0].notes[0]"
        ]);
    });
});
