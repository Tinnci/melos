import { describe, expect, it } from "bun:test";
import { ScoreSchema } from "@melos/core";
import { Renderer } from "../src/index";

describe("multi-sequence rendering", () => {
    it("renders every sequence in a measure instead of only the first voice", () => {
        const score = ScoreSchema.parse({
            mnx: { version: 1 },
            global: { measures: [{}] },
            parts: [{
                id: "P1",
                measures: [{
                    sequences: [
                        {
                            content: [{
                                id: "lower",
                                duration: { base: "whole" },
                                notes: [{ pitch: { step: "C", octave: 4 } }]
                            }]
                        },
                        {
                            content: [
                                {
                                    id: "upper-1",
                                    duration: { base: "quarter" },
                                    notes: [{ pitch: { step: "E", octave: 5 } }]
                                },
                                {
                                    id: "upper-2",
                                    duration: { base: "quarter" },
                                    notes: [{ pitch: { step: "F", octave: 5 } }]
                                },
                                {
                                    id: "upper-3",
                                    duration: { base: "quarter" },
                                    notes: [{ pitch: { step: "G", octave: 5 } }]
                                },
                                {
                                    id: "upper-4",
                                    duration: { base: "quarter" },
                                    notes: [{ pitch: { step: "A", octave: 5 } }]
                                }
                            ]
                        }
                    ]
                }]
            }]
        });

        const renderer = new Renderer();
        const plan = renderer.createPlan(score);
        const measure = plan.systems[0].measures[0];
        const svg = renderer.render(score);

        expect(svg).toContain('data-event-id="lower"');
        expect(svg).toContain('data-event-id="upper-4"');
        expect(svg).toContain(`x1="${measure.x + measure.width}"`);
    });

    it("advances hidden rests in later sequences without drawing rest glyphs", () => {
        const score = ScoreSchema.parse({
            mnx: { version: 1 },
            global: { measures: [{}] },
            parts: [{
                id: "P1",
                measures: [{
                    sequences: [
                        { content: [] },
                        {
                            content: [
                                {
                                    id: "skip",
                                    duration: { base: "half" },
                                    rest: { hidden: true }
                                },
                                {
                                    id: "entry",
                                    duration: { base: "quarter" },
                                    notes: [{ pitch: { step: "E", octave: 5 } }]
                                }
                            ]
                        }
                    ]
                }]
            }]
        });

        const svg = new Renderer().render(score);

        expect(svg).toContain('data-event-id="entry"');
        expect(svg).not.toContain('data-event-id="skip"');
    });
});
