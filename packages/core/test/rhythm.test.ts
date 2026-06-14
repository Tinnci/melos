import { describe, expect, it } from "bun:test";
import {
    getDurationInBeats,
    getSequenceContentBeats,
    getTimeSignatureBeats,
    getTupletScale
} from "../src/rhythm";

describe("core rhythm utilities", () => {
    it("calculates dotted note values in quarter-note beats", () => {
        expect(getDurationInBeats({ base: "quarter" })).toBe(1);
        expect(getDurationInBeats({ base: "half", dots: 1 })).toBe(3);
        expect(getDurationInBeats({ base: "eighth", dots: 2 })).toBe(0.875);
    });

    it("calculates tuplets as outer duration over inner duration", () => {
        const tuplet = {
            inner: { duration: { base: "eighth" }, multiple: 3 },
            outer: { duration: { base: "eighth" }, multiple: 2 },
            content: [
                { duration: { base: "eighth" }, notes: [{ pitch: { step: "C", octave: 4 } }] },
                { duration: { base: "eighth" }, notes: [{ pitch: { step: "D", octave: 4 } }] },
                { duration: { base: "eighth" }, notes: [{ pitch: { step: "E", octave: 4 } }] },
            ],
            type: "tuplet",
        };

        expect(getTupletScale(tuplet)).toBe(2 / 3);
        expect(getSequenceContentBeats([tuplet])).toBe(1);
    });

    it("handles common and compound time signatures", () => {
        expect(getTimeSignatureBeats({ count: 4, unit: 4 })).toBe(4);
        expect(getTimeSignatureBeats({ count: 6, unit: 8 })).toBe(3);
        expect(getTimeSignatureBeats(undefined)).toBe(4);
    });
});
