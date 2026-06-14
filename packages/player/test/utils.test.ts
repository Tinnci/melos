import { describe, expect, it } from "bun:test";
import { getDurationInBeats, getNoteValueQuantityInBeats, getTupletScale } from "../src/utils";

describe("player timing utilities", () => {
    it("calculates MNX note values in beats", () => {
        expect(getDurationInBeats({ base: "quarter" })).toBe(1);
        expect(getDurationInBeats({ base: "eighth" })).toBe(0.5);
        expect(getDurationInBeats({ base: "half", dots: 1 })).toBe(3);
    });

    it("calculates note value quantities", () => {
        expect(
            getNoteValueQuantityInBeats({
                duration: { base: "eighth" },
                multiple: 3,
            }),
        ).toBe(1.5);
    });

    it("calculates tuplets as outer duration over inner duration", () => {
        expect(
            getTupletScale({
                inner: {
                    duration: { base: "eighth" },
                    multiple: 3,
                },
                outer: {
                    duration: { base: "eighth" },
                    multiple: 2,
                },
            }),
        ).toBe(2 / 3);
    });

    it("falls back to natural timing for incomplete tuplets", () => {
        expect(getTupletScale({})).toBe(1);
        expect(getTupletScale(undefined)).toBe(1);
    });
});
