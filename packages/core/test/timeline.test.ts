import { describe, expect, it } from "bun:test";
import { ScoreSchema } from "../src/schema";
import {
    buildMeasureTimeline,
    buildScoreTimelineIndex,
    buildScoreTimeline,
    getTimelineEventByPath,
    getTimelineEventsById,
    getTimelineEventsForMeasure,
    getTimelineEventsForSequence,
    getTimelineEventSource,
    getTimelineMeasure,
    indexScoreTimeline,
    resolveTimeSignatureForMeasure
} from "../src/timeline";

describe("core normalized timeline", () => {
    it("resolves inherited time signatures and positions duration-bearing events", () => {
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
                    { sequences: [{ content: [] }] },
                    {
                        sequences: [{
                            content: [
                                { type: "dynamic", id: "dyn-1", value: "p" },
                                {
                                    id: "note-1",
                                    duration: { base: "quarter" },
                                    notes: [{ pitch: { step: "C", octave: 4 }, staff: 1 }]
                                },
                                {
                                    id: "skip-1",
                                    duration: { base: "half" },
                                    rest: { hidden: true },
                                    staff: 1
                                }
                            ]
                        }]
                    }
                ]
            }]
        });

        expect(resolveTimeSignatureForMeasure(score, 1)).toEqual({ count: 3, unit: 4 });

        const timeline = buildMeasureTimeline(score, 0, 1);
        const sequence = timeline.sequences[0];

        expect(timeline.expectedBeats).toBe(3);
        expect(sequence.usedBeats).toBe(3);
        expect(sequence.diagnostics).toEqual([]);
        expect(sequence.events.map((event) => [event.kind, event.id, event.startBeat, event.durationBeats])).toEqual([
            ["dynamic", "dyn-1", 0, 0],
            ["note", "note-1", 0, 1],
            ["rest", "skip-1", 1, 2]
        ]);
        expect(sequence.events[1].staff).toBe(1);
        expect(sequence.events[2].hidden).toBe(true);
    });

    it("keeps grace events on the timeline without advancing rhythmic time", () => {
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
                                content: [
                                    {
                                        id: "grace-1",
                                        duration: { base: "16th" },
                                        notes: [{ pitch: { step: "B", octave: 4 } }]
                                    },
                                    {
                                        id: "grace-2",
                                        duration: { base: "16th" },
                                        notes: [{ pitch: { step: "C", octave: 5 } }]
                                    }
                                ]
                            },
                            {
                                id: "main-1",
                                duration: { base: "whole" },
                                notes: [{ pitch: { step: "D", octave: 4 } }]
                            }
                        ]
                    }]
                }]
            }]
        });

        const sequence = buildMeasureTimeline(score, 0, 0).sequences[0];
        const graceNotes = sequence.events.filter((event) => event.grace && event.kind === "note");

        expect(sequence.usedBeats).toBe(4);
        expect(graceNotes).toHaveLength(2);
        expect(graceNotes.every((event) => event.startBeat === 0 && event.durationBeats === 0)).toBe(true);
        expect(graceNotes.map((event) => event.nominalDurationBeats)).toEqual([0.25, 0.25]);
        expect(sequence.events.find((event) => event.id === "main-1")?.startBeat).toBe(0);
    });

    it("applies tuplet scaling to nested event timing", () => {
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
                                content: ["C", "D", "E"].map((step, index) => ({
                                    id: `tuplet-${index + 1}`,
                                    duration: { base: "eighth" },
                                    notes: [{ pitch: { step, octave: 4 } }]
                                }))
                            },
                            ...["F", "G", "A"].map((step, index) => ({
                                id: `quarter-${index + 1}`,
                                duration: { base: "quarter" },
                                notes: [{ pitch: { step, octave: 4 } }]
                            }))
                        ]
                    }]
                }]
            }]
        });

        const sequence = buildMeasureTimeline(score, 0, 0).sequences[0];
        const tupletNotes = sequence.events.filter((event) => event.id?.startsWith("tuplet-"));

        expect(sequence.usedBeats).toBe(4);
        expect(tupletNotes.map((event) => event.durationBeats)).toEqual([
            1 / 3,
            1 / 3,
            1 / 3
        ]);
        expect(tupletNotes[1].startBeat).toBeCloseTo(1 / 3);
        expect(sequence.events.find((event) => event.kind === "tuplet")?.durationBeats).toBe(1);
        expect(sequence.events.find((event) => event.id === "quarter-1")?.startBeat).toBe(1);
    });

    it("reports per-sequence rhythm diagnostics and aggregates score diagnostics", () => {
        const score = ScoreSchema.parse({
            mnx: { version: 1 },
            global: { measures: [{ time: { count: 4, unit: 4 } }] },
            parts: [{
                id: "P1",
                measures: [{
                    sequences: [
                        {
                            content: [{
                                duration: { base: "quarter" },
                                notes: [{ pitch: { step: "C", octave: 4 } }]
                            }]
                        },
                        {
                            content: [
                                {
                                    duration: { base: "whole" },
                                    notes: [{ pitch: { step: "E", octave: 4 } }]
                                },
                                {
                                    duration: { base: "quarter" },
                                    notes: [{ pitch: { step: "F", octave: 4 } }]
                                }
                            ]
                        }
                    ]
                }]
            }]
        });

        const measure = buildMeasureTimeline(score, 0, 0);
        const scoreTimeline = buildScoreTimeline(score);

        expect(measure.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
            "rhythm-underfull",
            "rhythm-overfull"
        ]);
        expect(scoreTimeline.diagnostics.map((diagnostic) => diagnostic.path)).toEqual([
            "parts[0].measures[0].sequences[0]",
            "parts[0].measures[0].sequences[1]"
        ]);
    });

    it("exposes rhythm validation policy as timeline options", () => {
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

        expect(buildMeasureTimeline(score, 0, 0).diagnostics.map((issue) => issue.code)).toEqual([
            "rhythm-underfull"
        ]);
        expect(buildMeasureTimeline(score, 0, 0, { allowPickupMeasure: true }).diagnostics).toEqual([]);
        expect(buildMeasureTimeline(score, 0, 0, { includeRhythmDiagnostics: false }).diagnostics).toEqual([]);
    });

    it("resolves timeline event refs back to nested score content", () => {
        const score = ScoreSchema.parse({
            mnx: { version: 1 },
            global: { measures: [{ time: { count: 4, unit: 4 } }] },
            parts: [{
                id: "P1",
                measures: [{
                    sequences: [{
                        content: [{
                            type: "tuplet",
                            inner: { duration: { base: "eighth" }, multiple: 3 },
                            outer: { duration: { base: "eighth" }, multiple: 2 },
                            content: [{
                                id: "nested-note",
                                duration: { base: "eighth" },
                                notes: [{ pitch: { step: "C", octave: 4 } }]
                            }]
                        }]
                    }]
                }]
            }]
        });

        const timeline = buildMeasureTimeline(score, 0, 0, { includeRhythmDiagnostics: false });
        const event = timeline.sequences[0].events.find((item) => item.id === "nested-note");
        const source = event ? getTimelineEventSource(score, event) : undefined;

        expect((source as { id?: string } | undefined)?.id).toBe("nested-note");
    });

    it("indexes score timeline by measure, sequence, id, and path", () => {
        const score = ScoreSchema.parse({
            mnx: { version: 1 },
            global: { measures: [{ time: { count: 4, unit: 4 } }] },
            parts: [
                {
                    id: "P1",
                    measures: [{
                        sequences: [
                            {
                                content: [
                                    {
                                        id: "shared",
                                        duration: { base: "quarter" },
                                        notes: [{ pitch: { step: "C", octave: 4 } }]
                                    },
                                    {
                                        id: "rest-1",
                                        duration: { base: "quarter" },
                                        rest: {}
                                    }
                                ]
                            },
                            {
                                content: [{
                                    id: "shared",
                                    duration: { base: "half" },
                                    notes: [{ pitch: { step: "E", octave: 4 } }]
                                }]
                            }
                        ]
                    }]
                }
            ]
        });

        const index = buildScoreTimelineIndex(score);
        const measure = getTimelineMeasure(index, { partIndex: 0, measureIndex: 0 });
        const measureEvents = getTimelineEventsForMeasure(index, { partIndex: 0, measureIndex: 0 });
        const firstSequenceEvents = getTimelineEventsForSequence(index, {
            partIndex: 0,
            measureIndex: 0,
            sequenceIndex: 0
        });
        const sharedEvents = getTimelineEventsById(index, "shared");
        const firstSharedByPath = getTimelineEventByPath(index, "parts[0].measures[0].sequences[0].content[0]");

        expect(measure?.partId).toBe("P1");
        expect(index.events.map((event) => event.id)).toEqual(["shared", "rest-1", "shared"]);
        expect(measureEvents.map((event) => event.id)).toEqual(["shared", "rest-1", "shared"]);
        expect(firstSequenceEvents.map((event) => event.id)).toEqual(["shared", "rest-1"]);
        expect(sharedEvents).toHaveLength(2);
        expect(sharedEvents.map((event) => event.sequenceIndex)).toEqual([0, 1]);
        expect(firstSharedByPath?.startBeat).toBe(0);
        expect(getTimelineEventsForMeasure(index, { partIndex: 4, measureIndex: 9 })).toEqual([]);
    });

    it("can index an existing score timeline without rebuilding it", () => {
        const score = ScoreSchema.parse({
            mnx: { version: 1 },
            global: { measures: [{ time: { count: 2, unit: 4 } }] },
            parts: [{
                id: "P1",
                measures: [{
                    sequences: [{
                        content: [{
                            id: "note-1",
                            duration: { base: "half" },
                            notes: [{ pitch: { step: "C", octave: 4 } }]
                        }]
                    }]
                }]
            }]
        });

        const timeline = buildScoreTimeline(score);
        const index = indexScoreTimeline(timeline);

        expect(index.timeline).toBe(timeline);
        expect(getTimelineEventsById(index, "note-1")[0]?.durationBeats).toBe(2);
    });
});
