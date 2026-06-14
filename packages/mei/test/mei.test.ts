import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import { ScoreSchema } from "@melos/core";
import type { Event, Tuplet } from "@melos/core";
import { MEIToMNX } from "../src/index";

describe("MEIToMNX", () => {
    const fixture = (name: string) =>
        readFileSync(join(import.meta.dir, "data", name), "utf-8");

    it("converts a common MEI score subset into the Melos core score model", () => {
        const score = new MEIToMNX().convert(fixture("basic.mei"));
        const measure = score.parts[0].measures[0];
        const content = measure.sequences[0].content;

        expect(ScoreSchema.safeParse(score).success).toBe(true);
        expect(score.parts[0].name).toBe("Violin");
        expect(score.global.measures[0].time).toEqual({ count: 4, unit: 4 });
        expect(score.global.measures[0].key).toEqual({ fifths: 2 });
        expect(score.global.measures[0].barline?.type).toBe("final");
        expect(measure.clefs?.[0].clef).toEqual({ sign: "G", line: 2 });
        expect(content[0]).toEqual({ type: "dynamic", value: "mf" });
    });

    it("preserves notes, lyrics, beams, tuplets, and expressive links", () => {
        const score = new MEIToMNX().convert(fixture("basic.mei"));
        const measure = score.parts[0].measures[0];
        const content = measure.sequences[0].content;
        const firstNote = content[1] as Event;
        const beamedNote = content[2] as Event;
        const tuplet = content[4] as Tuplet;

        expect(firstNote.duration).toEqual({ base: "quarter", dots: 1 });
        expect(firstNote.notes?.[0].pitch).toEqual({ step: "C", octave: 4, alter: 1 });
        expect(firstNote.notes?.[0].color).toBe("#3366ff");
        expect(firstNote.notes?.[0].ties).toEqual([{ target: "n2" }]);
        expect(firstNote.articulations).toContain("staccato");
        expect(firstNote.lyrics?.[0]).toMatchObject({ text: "La", line: "verse-1" });
        expect(beamedNote.slurs).toEqual([{ target: "n3", side: "up" }]);
        expect(measure.beams?.[0].events).toEqual(["n2", "n3"]);
        expect(tuplet.type).toBe("tuplet");
        expect(tuplet.inner.multiple).toBe(3);
        expect(tuplet.outer.multiple).toBe(2);
    });

    it("maps MEI control events to positioned MNX-style overlays", () => {
        const score = new MEIToMNX().convert(fixture("basic.mei"));
        const measure = score.parts[0].measures[0];

        expect(measure.wedges?.[0]).toMatchObject({
            type: "crescendo",
            position: { fraction: [0, 4] },
            end: { measure: 1, position: { fraction: [2, 4] } },
            staff: 1
        });
        expect(measure.pedals?.[0]).toMatchObject({
            type: "start",
            position: { fraction: [0, 4] },
            end: { measure: 1, position: { fraction: [2, 4] } },
            line: true,
            sign: true
        });
        expect(measure.ottavas?.[0]).toMatchObject({
            value: 1,
            position: { fraction: [0, 4] },
            end: { measure: 1, position: { fraction: [3, 4] } }
        });
    });

    it("preserves multiple MEI layers as separate sequences for polyphonic rendering", () => {
        const mei = `<?xml version="1.0" encoding="UTF-8"?>
        <mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.0">
          <music><body><mdiv><score>
            <scoreDef meter.count="4" meter.unit="4">
              <staffGrp><staffDef n="1" label="Piano RH" clef.shape="G" clef.line="2"/></staffGrp>
            </scoreDef>
            <section>
              <measure n="1">
                <staff n="1">
                  <layer n="1"><note xml:id="lower" pname="c" oct="4" dur="1"/></layer>
                  <layer n="2">
                    <note xml:id="upper1" pname="e" oct="5" dur="4"/>
                    <note xml:id="upper2" pname="f" oct="5" dur="4"/>
                    <note xml:id="upper3" pname="g" oct="5" dur="4"/>
                    <note xml:id="upper4" pname="a" oct="5" dur="4"/>
                  </layer>
                </staff>
              </measure>
            </section>
          </score></mdiv></body></music>
        </mei>`;

        const score = new MEIToMNX().convert(mei);
        const sequences = score.parts[0].measures[0].sequences;

        expect(sequences).toHaveLength(2);
        expect(sequences[0].content[0]).toMatchObject({ id: "lower" });
        expect(sequences[1].content).toHaveLength(4);
    });
});
