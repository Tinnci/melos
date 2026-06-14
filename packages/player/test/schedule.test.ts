import { describe, expect, it } from "bun:test";
import { ScoreSchema } from "@melos/core";
import { createPlaybackSchedule } from "../src/schedule";

describe("player playback schedule", () => {
    it("uses the core timeline for grace notes, tuplets, and chords", () => {
        const score = ScoreSchema.parse({
            mnx: { version: 1 },
            global: { measures: [{ time: { count: 3, unit: 4 } }] },
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
                                                    id: "grace-note",
                                                    duration: { base: "16th" },
                                                    notes: [{ pitch: { step: "B", octave: 4 } }],
                                                },
                                            ],
                                        },
                                        {
                                            type: "tuplet",
                                            inner: { duration: { base: "eighth" }, multiple: 3 },
                                            outer: { duration: { base: "eighth" }, multiple: 2 },
                                            content: ["C", "D", "E"].map((step, index) => ({
                                                id: `tuplet-${index + 1}`,
                                                duration: { base: "eighth" },
                                                notes: [{ pitch: { step, octave: 4 } }],
                                            })),
                                        },
                                        {
                                            id: "chord",
                                            duration: { base: "quarter" },
                                            notes: [
                                                { id: "chord-f", pitch: { step: "F", octave: 4 } },
                                                { id: "chord-a", pitch: { step: "A", octave: 4 } },
                                            ],
                                        },
                                        {
                                            id: "final",
                                            duration: { base: "quarter" },
                                            notes: [{ pitch: { step: "G", octave: 4 } }],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        });

        const schedule = createPlaybackSchedule(score, { tempo: 120, startTime: 1 });

        expect(schedule.map((event) => event.eventId)).toEqual([
            "tuplet-1",
            "tuplet-2",
            "tuplet-3",
            "chord",
            "chord",
            "final",
        ]);
        expect(schedule.some((event) => event.eventId === "grace-note")).toBe(false);
        expect(schedule[0].startTime).toBe(1);
        expect(schedule[1].startTime).toBeCloseTo(1 + 1 / 6);
        expect(schedule[2].duration).toBeCloseTo(1 / 6);
        expect(schedule[3].startTime).toBeCloseTo(1.5);
        expect(schedule[3].noteId).toBe("chord-f");
        expect(schedule[4].noteId).toBe("chord-a");
        expect(schedule[5].startTime).toBe(2);
    });

    it("uses measure duration for underfull measures and hidden rests for voice offsets", () => {
        const score = ScoreSchema.parse({
            mnx: { version: 1 },
            global: {
                measures: [{ time: { count: 4, unit: 4 } }, {}],
            },
            parts: [
                {
                    id: "P1",
                    measures: [
                        {
                            sequences: [
                                {
                                    content: [
                                        {
                                            id: "pickup-like",
                                            duration: { base: "quarter" },
                                            notes: [{ pitch: { step: "C", octave: 4 } }],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            sequences: [
                                {
                                    content: [
                                        {
                                            id: "skip",
                                            duration: { base: "half" },
                                            rest: { hidden: true },
                                        },
                                        {
                                            id: "delayed-entry",
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

        const schedule = createPlaybackSchedule(score, { tempo: 60 });

        expect(schedule.map((event) => event.eventId)).toEqual(["pickup-like", "delayed-entry"]);
        expect(schedule[0].startTime).toBe(0);
        expect(schedule[0].duration).toBe(1);
        expect(schedule[1].startTime).toBe(6);
        expect(schedule[1].duration).toBe(1);
    });
});
