import { describe, expect, it } from "bun:test";
import {
    dynamicEvent,
    graceGroup,
    measureWithContent,
    noteEvent,
    restEvent,
    singlePartScore,
    tupletEvent,
} from "../../../test/fixtures/score";
import { analyzeMeasureLayout, estimateNoteWidth } from "../src/layout";

describe("renderer layout analysis", () => {
    it("separates hard, soft, and overlay spacing contributions", () => {
        const score = singlePartScore({
            globalMeasures: [{ key: { fifths: 1 }, time: { count: 4, unit: 4 } }],
            measures: [
                measureWithContent(
                    [
                        dynamicEvent({ id: "dyn-1" }),
                        noteEvent({ id: "note-1" }),
                        restEvent({ id: "rest-1", duration: "half" }),
                        noteEvent({ id: "note-2", pitch: { step: "D", octave: 4 } }),
                    ],
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
                    },
                ),
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
        const score = singlePartScore({
            measures: [
                measureWithContent([], {
                    sequences: [
                        { content: [noteEvent()] },
                        {
                            content: [
                                noteEvent({ duration: "whole", pitch: { step: "E", octave: 4 } }),
                                noteEvent({ pitch: { step: "F", octave: 4 } }),
                            ],
                        },
                    ],
                }),
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
        const score = singlePartScore({
            globalMeasures: [{ time: { count: 3, unit: 4 } }, {}],
            measures: [
                measureWithContent([]),
                measureWithContent(
                    (["C", "D", "E"] as const).map((step) =>
                        noteEvent({ pitch: { step, octave: 4 } }),
                    ),
                ),
            ],
        });

        const analysis = analyzeMeasureLayout(score, 0, 1);

        expect(analysis.expectedBeats).toBe(3);
        expect(analysis.sequenceBeats).toEqual([3]);
        expect(analysis.diagnostics).toEqual([]);
    });

    it("keeps grace notes visual while excluding them from rhythmic duration", () => {
        const score = singlePartScore({
            measures: [
                measureWithContent([
                    graceGroup([
                        noteEvent({ duration: "16th", pitch: { step: "B", octave: 4 } }),
                        noteEvent({ duration: "16th", pitch: { step: "C", octave: 5 } }),
                    ]),
                    tupletEvent({
                        content: (["D", "E", "F"] as const).map((step) =>
                            noteEvent({ duration: "eighth", pitch: { step, octave: 5 } }),
                        ),
                    }),
                    ...(["G", "A", "B"] as const).map((step) =>
                        noteEvent({ pitch: { step, octave: 4 } }),
                    ),
                ]),
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
