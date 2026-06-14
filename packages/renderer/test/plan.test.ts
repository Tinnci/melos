import { describe, expect, it } from "bun:test";
import { ScoreSchema } from "@melos/core";
import { createRenderPlan, Renderer } from "../src/index";

describe("renderer render plan", () => {
    it("turns score measures into wrapped system and measure geometry", () => {
        const score = ScoreSchema.parse({
            mnx: { version: 1 },
            global: {
                measures: [
                    { time: { count: 4, unit: 4 } },
                    {}
                ]
            },
            parts: [{
                id: "P1",
                measures: [
                    {
                        sequences: [{
                            content: [{
                                id: "m1-note",
                                duration: { base: "quarter" },
                                notes: [{ pitch: { step: "C", octave: 4 } }]
                            }]
                        }]
                    },
                    {
                        sequences: [{
                            content: [{
                                id: "m2-note",
                                duration: { base: "quarter" },
                                notes: [{ pitch: { step: "D", octave: 4 } }]
                            }]
                        }]
                    }
                ]
            }]
        });

        const plan = createRenderPlan(score, {
            pageWidth: 120,
            paddingX: 10,
            paddingY: 20,
            systemSpacing: 50,
            systemHeaderWidth: 40
        });

        expect(plan.parts).toHaveLength(1);
        expect(plan.systems).toHaveLength(2);
        expect(plan.parts[0].systems.map((system) => system.systemIndex)).toEqual([0, 1]);
        expect(plan.systems[0].contentStartX).toBe(50);
        expect(plan.systems[0].measures[0].x).toBe(50);
        expect(plan.systems[0].measures[0].contentX).toBe(65);
        expect(plan.systems[1].y).toBe(70);
        expect(plan.systems[1].measures[0].measureNumber).toBe(2);
        expect(plan.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
            "rhythm-underfull",
            "rhythm-underfull"
        ]);
    });

    it("exposes the same plan dimensions consumed by SVG rendering", () => {
        const score = ScoreSchema.parse({
            mnx: { version: 1 },
            global: {
                measures: [{
                    key: { fifths: 2 },
                    time: { count: 3, unit: 4 }
                }]
            },
            parts: [{
                id: "P1",
                name: "Piano",
                measures: [{
                    sequences: [{
                        content: [
                            {
                                id: "note-1",
                                duration: { base: "quarter" },
                                notes: [{ pitch: { step: "C", octave: 4 } }]
                            },
                            {
                                id: "note-2",
                                duration: { base: "quarter" },
                                notes: [{ pitch: { step: "D", octave: 4 } }]
                            },
                            {
                                id: "note-3",
                                duration: { base: "quarter" },
                                notes: [{ pitch: { step: "E", octave: 4 } }]
                            }
                        ]
                    }]
                }]
            }]
        });

        const renderer = new Renderer();
        const plan = renderer.createPlan(score);
        const svg = renderer.render(score);
        const firstMeasure = plan.systems[0].measures[0];

        expect(plan.systems[0].contentStartX).toBe(144);
        expect(svg).toContain(`width="${plan.width}"`);
        expect(svg).toContain(`height="${plan.height}"`);
        expect(svg).toContain(`class="measure-hitbox" data-measure-index="1" data-part-id="P1" x="${firstMeasure.x}"`);
        expect(svg).toContain('data-event-id="note-1"');
    });
});
