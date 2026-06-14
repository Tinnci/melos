import { describe, expect, it } from "bun:test";
import { ScoreSchema } from "@melos/core";
import { createRenderPlan, solveMeasureSpacing } from "../src/index";

describe("renderer spacing solver", () => {
    it("creates timeline-aligned columns across voices", () => {
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
                                            id: "upper-1",
                                            duration: { base: "quarter" },
                                            notes: [{ pitch: { step: "C", octave: 5 } }],
                                        },
                                        {
                                            id: "upper-2",
                                            duration: { base: "quarter" },
                                            notes: [{ pitch: { step: "D", octave: 5 } }],
                                        },
                                    ],
                                },
                                {
                                    content: [
                                        {
                                            id: "skip",
                                            duration: { base: "quarter" },
                                            rest: { hidden: true },
                                        },
                                        {
                                            id: "lower-entry",
                                            duration: { base: "quarter" },
                                            notes: [{ pitch: { step: "C", octave: 4 } }],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        });

        const plan = createRenderPlan(score, {
            paddingX: 0,
            paddingY: 0,
            systemHeaderWidth: 0,
        });
        const measure = plan.systems[0].measures[0];
        const spacing = solveMeasureSpacing(score, measure);
        const upper1 = spacing.eventsById.get("upper-1")?.[0];
        const skip = spacing.eventsById.get("skip")?.[0];
        const upper2 = spacing.eventsById.get("upper-2")?.[0];
        const lowerEntry = spacing.eventsById.get("lower-entry")?.[0];

        expect(spacing.durationBeats).toBe(4);
        expect(spacing.columns.map((column) => column.beat)).toEqual([0, 1]);
        expect(upper1?.x).toBe(measure.contentX);
        expect(skip?.x).toBe(measure.contentX);
        expect(upper2?.x).toBeCloseTo(measure.contentX + spacing.pixelsPerBeat);
        expect(lowerEntry?.x).toBeCloseTo(upper2?.x ?? 0);
        expect(lowerEntry?.columnIndex).toBe(1);
    });

    it("indexes nested grace and tuplet events by source path", () => {
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
                                                    id: "grace-1",
                                                    duration: { base: "16th" },
                                                    notes: [{ pitch: { step: "B", octave: 4 } }],
                                                },
                                            ],
                                        },
                                        {
                                            type: "tuplet",
                                            inner: { duration: { base: "eighth" }, multiple: 3 },
                                            outer: { duration: { base: "eighth" }, multiple: 2 },
                                            content: [
                                                {
                                                    id: "tuplet-1",
                                                    duration: { base: "eighth" },
                                                    notes: [{ pitch: { step: "C", octave: 5 } }],
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        });

        const plan = createRenderPlan(score);
        const spacing = solveMeasureSpacing(score, plan.systems[0].measures[0]);
        const gracePath = "parts[0].measures[0].sequences[0].content[0].content[0]";
        const tupletPath = "parts[0].measures[0].sequences[0].content[1].content[0]";

        expect(spacing.eventsByPath.get(gracePath)?.event.id).toBe("grace-1");
        expect(spacing.eventsByPath.get(tupletPath)?.event.id).toBe("tuplet-1");
        expect(spacing.eventsById.get("grace-1")?.[0]?.x).toBe(spacing.contentX);
    });
});
