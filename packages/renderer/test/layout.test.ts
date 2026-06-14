import { describe, expect, it } from "bun:test";
import { ScoreSchema } from "@melos/core";
import { analyzeMeasureLayout, estimateNoteWidth } from "../src/layout";

describe("renderer layout analysis", () => {
    it("separates hard, soft, and overlay spacing contributions", () => {
        const score = ScoreSchema.parse({
            mnx: { version: 1 },
            global: {
                measures: [
                    {
                        key: { fifths: 1 },
                        time: { count: 4, unit: 4 },
                    },
                ],
            },
            parts: [
                {
                    id: "P1",
                    measures: [
                        {
                            clefs: [{ clef: { sign: "G" } }],
                            pedals: [
                                {
                                    type: "start",
                                    position: { fraction: [0, 4] },
                                    line: true,
                                    sign: true,
                                },
                            ],
                            sequences: [
                                {
                                    content: [
                                        { type: "dynamic", id: "dyn-1", value: "mf" },
                                        {
                                            id: "note-1",
                                            duration: { base: "quarter" },
                                            notes: [{ pitch: { step: "C", octave: 4 } }],
                                        },
                                        {
                                            id: "rest-1",
                                            duration: { base: "half" },
                                            rest: {},
                                        },
                                        {
                                            id: "note-2",
                                            duration: { base: "quarter" },
                                            notes: [{ pitch: { step: "D", octave: 4 } }],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        });

        const analysis = analyzeMeasureLayout(score, 0, 0);

        expect(analysis.diagnostics).toEqual([]);
        expect(analysis.sequenceBeats).toEqual([4]);
        expect(analysis.contributions.map((item) => item.role)).toEqual([
            "barline",
            "clef",
            "keySignature",
            "timeSignature",
            "dynamic",
            "note",
            "rest",
            "note",
            "pedal",
            "barline",
        ]);
        expect(analysis.hardWidth).toBe(94);
        expect(analysis.softWidth).toBe(115);
        expect(analysis.overlayCount).toBe(2);
        expect(analysis.estimatedWidth).toBe(239);
    });

    it("reports rhythm diagnostics for underfull and overfull voices", () => {
        const score = ScoreSchema.parse({
            mnx: { version: 1 },
            global: { measures: [{ time: { count: 4, unit: 4 } }] },
            parts: [
                {
                    id: "P1",
                    measures: [
                        {
                            sequences: [
                                {
                                    content: [
                                        {
                                            duration: { base: "quarter" },
                                            notes: [{ pitch: { step: "C", octave: 4 } }],
                                        },
                                    ],
                                },
                                {
                                    content: [
                                        {
                                            duration: { base: "whole" },
                                            notes: [{ pitch: { step: "E", octave: 4 } }],
                                        },
                                        {
                                            duration: { base: "quarter" },
                                            notes: [{ pitch: { step: "F", octave: 4 } }],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        });

        const diagnostics = analyzeMeasureLayout(score, 0, 0).diagnostics;

        expect(diagnostics.map((issue) => issue.code)).toEqual([
            "rhythm-underfull",
            "rhythm-overfull",
        ]);
        expect(diagnostics[0].path).toBe("parts[0].measures[0].sequences[0]");
        expect(diagnostics[1].path).toBe("parts[0].measures[0].sequences[1]");
    });

    it("uses inherited time signatures from the core timeline", () => {
        const score = ScoreSchema.parse({
            mnx: { version: 1 },
            global: {
                measures: [{ time: { count: 3, unit: 4 } }, {}],
            },
            parts: [
                {
                    id: "P1",
                    measures: [
                        { sequences: [{ content: [] }] },
                        {
                            sequences: [
                                {
                                    content: ["C", "D", "E"].map((step) => ({
                                        duration: { base: "quarter" },
                                        notes: [{ pitch: { step, octave: 4 } }],
                                    })),
                                },
                            ],
                        },
                    ],
                },
            ],
        });

        const analysis = analyzeMeasureLayout(score, 0, 1);

        expect(analysis.expectedBeats).toBe(3);
        expect(analysis.sequenceBeats).toEqual([3]);
        expect(analysis.diagnostics).toEqual([]);
    });

    it("keeps grace notes visual while excluding them from rhythmic duration", () => {
        const score = ScoreSchema.parse({
            mnx: { version: 1 },
            global: { measures: [{ time: { count: 4, unit: 4 } }] },
            parts: [
                {
                    id: "P1",
                    measures: [
                        {
                            sequences: [
                                {
                                    content: [
                                        {
                                            type: "grace",
                                            content: [
                                                {
                                                    duration: { base: "16th" },
                                                    notes: [{ pitch: { step: "B", octave: 4 } }],
                                                },
                                                {
                                                    duration: { base: "16th" },
                                                    notes: [{ pitch: { step: "C", octave: 5 } }],
                                                },
                                            ],
                                        },
                                        {
                                            type: "tuplet",
                                            inner: { duration: { base: "eighth" }, multiple: 3 },
                                            outer: { duration: { base: "eighth" }, multiple: 2 },
                                            content: [
                                                {
                                                    duration: { base: "eighth" },
                                                    notes: [{ pitch: { step: "D", octave: 5 } }],
                                                },
                                                {
                                                    duration: { base: "eighth" },
                                                    notes: [{ pitch: { step: "E", octave: 5 } }],
                                                },
                                                {
                                                    duration: { base: "eighth" },
                                                    notes: [{ pitch: { step: "F", octave: 5 } }],
                                                },
                                            ],
                                        },
                                        ...["G", "A", "B"].map((step) => ({
                                            duration: { base: "quarter" },
                                            notes: [{ pitch: { step, octave: 4 } }],
                                        })),
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        });

        const analysis = analyzeMeasureLayout(score, 0, 0);

        expect(analysis.diagnostics).toEqual([]);
        expect(analysis.sequenceBeats).toEqual([4]);
        expect(
            analysis.contributions.filter((item) => item.kind === "soft" && item.role === "grace"),
        ).toHaveLength(2);
        expect(analysis.contributions.some((item) => item.role === "tuplet")).toBe(true);
        expect(analysis.softWidth).toBe(
            2 * 20 +
                3 * estimateNoteWidth({ base: "eighth" }) +
                3 * estimateNoteWidth({ base: "quarter" }),
        );
    });
});
