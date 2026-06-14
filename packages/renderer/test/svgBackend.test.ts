import { describe, expect, it } from "bun:test";
import { Renderer, SvgRenderBackend, type RenderDocument } from "../src/index";
import { measureWithContent, noteEvent, singlePartScore } from "../../../test/fixtures/score";

describe("SVG render backend", () => {
    it("serializes structured render documents with escaping and metadata", () => {
        const backend = new SvgRenderBackend();
        const document: RenderDocument = {
            width: 120,
            height: 80,
            styles: [".score-object { cursor: pointer; }"],
            elements: [
                {
                    kind: "text",
                    x: 10,
                    y: 20,
                    text: "<grow&fade>",
                    fontFamily: "Times New Roman",
                    fontSize: 16,
                    attributes: { "data-role": "dynamic-text" },
                },
                {
                    kind: "smuflGlyph",
                    glyphName: "dynamicForte",
                    x: 20,
                    y: 30,
                    fontSize: 24,
                    attributes: { "data-smufl-role": "dynamic" },
                },
                {
                    kind: "hitbox",
                    className: "event-hitbox",
                    x: 4,
                    y: 5,
                    width: 40,
                    height: 20,
                    attributes: { "data-event-id": "note-1" },
                },
                {
                    kind: "group",
                    attributes: { "data-event-kind": "note", class: "score-object note-group" },
                    children: [{ kind: "raw", svg: '<circle cx="1" cy="2" r="3" />\n' }],
                },
            ],
        };

        const svg = backend.renderDocument(document);

        expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80">');
        expect(svg).toContain("&lt;grow&amp;fade&gt;");
        expect(svg).not.toContain("<grow&fade>");
        expect(svg).toContain('class="smufl-glyph"');
        expect(svg).toContain('data-smufl-glyph="dynamicForte"');
        expect(svg).toContain('class="event-hitbox" data-event-id="note-1" x="4"');
        expect(svg).toContain('data-event-kind="note" class="score-object note-group"');
    });

    it("lets Renderer expose a document without changing SVG rendering behavior", () => {
        const score = singlePartScore({
            measures: [measureWithContent([noteEvent({ id: "note-1" })])],
        });
        const renderer = new Renderer();
        const document = renderer.createDocument(score);
        const svg = renderer.render(score);

        expect(document.width).toBe(renderer.createPlan(score).width);
        expect(document.elements).toHaveLength(1);
        expect(document.boxes?.map((box) => box.role)).toEqual(
            expect.arrayContaining(["measure", "stave", "note"]),
        );
        expect(svg).toContain('data-event-id="note-1"');
        expect(svg).toContain(`width="${document.width}"`);
        expect(svg).toContain(`height="${document.height}"`);
    });
});
