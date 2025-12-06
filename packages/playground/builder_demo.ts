import { ScoreBuilder } from "@melos/core";
import { Renderer } from "@melos/renderer";
import * as fs from "fs";

console.log("--- Melos Builder API Demo ---");

// 1. Create a score using the Fluent API
const builder = new ScoreBuilder();

builder.addGlobalMeasure({
    index: 1,
    time: { count: 4, unit: 4 },
    key: { fifths: 0 }
});

builder.addPart("Piano", (part) => {
    part.setShortName("Pno.");

    // Measure 1
    part.addMeasure(1, (measure) => {
        measure.addSequence((seq) => {
            // C4 Quarter
            seq.note("C", 4, "quarter");
            // D4 Quarter
            seq.note("D", 4, "quarter");
            // E4 Quarter
            seq.note("E", 4, "quarter");
            // F4 Quarter
            seq.note("F", 4, "quarter");
        });
    });

    // Measure 2 (Chords and Rests)
    part.addMeasure(2, (measure) => {
        measure.addSequence((seq) => {
            // C Major Chord Half Note
            seq.chord([
                { step: "C", octave: 4 },
                { step: "E", octave: 4 },
                { step: "G", octave: 4 }
            ], "half");

            // Rest Half
            seq.rest("half");
        });
    });
});

const score = builder.build();

console.log("Score built successfully.");
// console.log(JSON.stringify(score, null, 2));

// 2. Render to SVG
const renderer = new Renderer();
const svg = renderer.render(score);

fs.writeFileSync("builder_output.svg", svg);
console.log("SVG output written to builder_output.svg");
