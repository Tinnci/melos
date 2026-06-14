import { describe, expect, it } from "bun:test";
import { ScoreSchema } from "@melos/core";
import { Renderer } from "../src/index";

describe("interactive score object metadata", () => {
    it("marks notes, rests, and dynamics with event metadata", () => {
        const score = ScoreSchema.parse({
            mnx: { version: 1 },
            global: { measures: [{}] },
            parts: [
                {
                    id: "P1",
                    measures: [
                        {
                            sequences: [
                                {
                                    content: [
                                        {
                                            id: "note-1",
                                            duration: { base: "quarter" },
                                            notes: [{ pitch: { step: "C", octave: 4 } }],
                                        },
                                        {
                                            id: "rest-1",
                                            duration: { base: "quarter" },
                                            rest: {},
                                        },
                                        {
                                            type: "dynamic",
                                            id: "dynamic-1",
                                            value: "mf",
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        });

        const svg = new Renderer().render(score);

        expect(svg).toContain('data-event-id="note-1"');
        expect(svg).toContain('data-event-kind="note"');
        expect(svg).toContain('data-event-id="rest-1"');
        expect(svg).toContain('data-event-kind="rest"');
        expect(svg).toContain('data-event-id="dynamic-1"');
        expect(svg).toContain('data-event-kind="dynamic"');
        expect(svg).toContain('class="measure-hitbox"');
        expect(svg).toContain('data-measure-index="1"');
        expect(svg).toContain('data-part-id="P1"');
        expect(svg.match(/class="event-hitbox"/g)).toHaveLength(3);
    });
});
