import { describe, expect, it } from "bun:test";
import {
    dynamicEvent,
    measureWithContent,
    noteEvent,
    restEvent,
    singlePartScore,
} from "../../../test/fixtures/score";
import { Renderer, resolveRenderCollisions, type RenderBox } from "../src/index";

describe("render document metadata planning", () => {
    it("exposes backend-neutral boxes and spans for rendered score content", () => {
        const document = new Renderer().createDocument(scoreWithOverlays());

        expect(document.boxes?.map((box) => box.role)).toEqual(
            expect.arrayContaining([
                "measure",
                "stave",
                "dynamic",
                "note",
                "rest",
                "pedal",
                "ottava",
            ]),
        );
        expect(document.spans?.map((span) => span.role)).toEqual(
            expect.arrayContaining(["pedal", "ottava"]),
        );
        expect(document.diagnostics).toEqual([]);
    });

    it("reports missing tie endpoints before SVG serialization", () => {
        const document = new Renderer().createDocument(scoreWithMissingTieTarget());

        expect(document.spans).toEqual([]);
        expect(document.diagnostics).toContainEqual(
            expect.objectContaining({
                code: "span-endpoint-missing",
                spanId: "span:tie:note-head-1:missing-target",
            }),
        );
    });

    it("detects unresolved same-column collisions without mutating layout", () => {
        const document = new Renderer().createDocument(scoreWithOverlappingVoices());

        expect(document.diagnostics).toContainEqual(
            expect.objectContaining({
                code: "collision-unresolved",
                boxIds: [
                    "parts[0].measures[0].sequences[0].content[0]:note",
                    "parts[0].measures[0].sequences[1].content[0]:note",
                ],
            }),
        );
    });

    it("reports notation boxes that exceed their measure bounds", () => {
        expect(
            resolveRenderCollisions({
                width: 80,
                height: 80,
                boxes: [measureBox(), overfullNoteBox()],
                spans: [],
            }),
        ).toContainEqual(
            expect.objectContaining({
                code: "measure-overfull",
                boxIds: ["measure:0:0", "note:0:0"],
            }),
        );
    });
});

function scoreWithOverlays(): ReturnType<typeof singlePartScore> {
    return singlePartScore({
        measures: [
            measureWithContent(
                [
                    dynamicEvent({ id: "dyn-1" }),
                    noteEvent({ id: "note-1" }),
                    restEvent({ id: "rest-1" }),
                ],
                {
                    pedals: [
                        {
                            type: "start",
                            position: { fraction: [0, 4] },
                            end: { measure: 1, position: { fraction: [4, 4] } },
                            line: true,
                            sign: true,
                        },
                    ],
                    ottavas: [
                        {
                            value: 1,
                            position: { fraction: [0, 4] },
                            end: { measure: 1, position: { fraction: [4, 4] } },
                        },
                    ],
                },
            ),
        ],
    });
}

function scoreWithMissingTieTarget(): ReturnType<typeof singlePartScore> {
    return singlePartScore({
        measures: [
            measureWithContent([
                noteEvent({
                    id: "event-1",
                    notes: [
                        {
                            id: "note-head-1",
                            pitch: { step: "C", octave: 4 },
                            ties: [{ target: "missing-target" }],
                        },
                    ],
                }),
            ]),
        ],
    });
}

function scoreWithOverlappingVoices(): ReturnType<typeof singlePartScore> {
    return singlePartScore({
        measures: [
            measureWithContent([], {
                sequences: [
                    { content: [noteEvent({ id: "voice-1-note" })] },
                    { content: [noteEvent({ id: "voice-2-note" })] },
                ],
            }),
        ],
    });
}

function measureBox(): RenderBox {
    return {
        id: "measure:0:0",
        role: "measure",
        layer: "interaction",
        x: 0,
        y: 0,
        width: 50,
        height: 80,
        partIndex: 0,
        measureIndex: 0,
    };
}

function overfullNoteBox(): RenderBox {
    return {
        id: "note:0:0",
        role: "note",
        layer: "notation",
        x: 40,
        y: 10,
        width: 24,
        height: 30,
        partIndex: 0,
        measureIndex: 0,
        sourcePath: "parts[0].measures[0].sequences[0].content[0]",
    };
}
