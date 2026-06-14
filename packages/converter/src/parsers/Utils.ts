import type { NoteValue } from "@melos/core";

// Helper to generate IDs
let eventIdCounter = 0;
export function generateEventId() {
    return `ev${++eventIdCounter}`;
}

let noteIdCounter = 0;
export function generateNoteId() {
    return `n${++noteIdCounter}`;
}

export function resetIdCounters() {
    eventIdCounter = 0;
    noteIdCounter = 0;
}

const MUSICXML_TYPE_TO_MNX_BASE: Record<string, NoteValue["base"]> = {
    "duplex-maxima": "duplexMaxima",
    maxima: "maxima",
    long: "longa",
    breve: "breve",
    whole: "whole",
    half: "half",
    quarter: "quarter",
    eighth: "eighth",
    "16th": "16th",
    "32nd": "32nd",
    "64th": "64th",
    "128th": "128th",
    "256th": "256th",
    "512th": "512th",
    "1024th": "1024th",
};

const BASE_WHOLE_NOTE_UNITS: Array<{ base: NoteValue["base"]; units: number }> = [
    { base: "duplexMaxima", units: 16 },
    { base: "maxima", units: 8 },
    { base: "longa", units: 4 },
    { base: "breve", units: 2 },
    { base: "whole", units: 1 },
    { base: "half", units: 1 / 2 },
    { base: "quarter", units: 1 / 4 },
    { base: "eighth", units: 1 / 8 },
    { base: "16th", units: 1 / 16 },
    { base: "32nd", units: 1 / 32 },
    { base: "64th", units: 1 / 64 },
    { base: "128th", units: 1 / 128 },
    { base: "256th", units: 1 / 256 },
    { base: "512th", units: 1 / 512 },
    { base: "1024th", units: 1 / 1024 },
    { base: "2048th", units: 1 / 2048 },
    { base: "4096th", units: 1 / 4096 },
];

export function musicXmlNoteValue(
    type: unknown,
    durationTicks: unknown,
    divisions: number,
    dots: number,
): NoteValue {
    const mappedType = typeof type === "string" ? MUSICXML_TYPE_TO_MNX_BASE[type] : undefined;
    if (mappedType) {
        return { base: mappedType, dots };
    }

    const duration = parseInteger(durationTicks);
    if (duration !== undefined) {
        const inferred = inferNoteValueFromDuration(duration, divisions);
        if (inferred) {
            return inferred;
        }
    }

    return { base: "quarter", dots };
}

export function musicXmlClefLineToStaffPosition(line: unknown): number | undefined {
    const parsedLine = parseInteger(line);
    return parsedLine === undefined ? undefined : (parsedLine - 3) * 2;
}

export function parseInteger(value: unknown): number | undefined {
    if (value === undefined || value === null || value === "") return undefined;

    const parsed = parseInt(String(value), 10);
    return Number.isNaN(parsed) ? undefined : parsed;
}

function inferNoteValueFromDuration(
    durationTicks: number,
    divisions: number,
): NoteValue | undefined {
    if (durationTicks <= 0 || divisions <= 0) return undefined;

    const wholeNoteTicks = divisions * 4;

    for (const candidate of BASE_WHOLE_NOTE_UNITS) {
        const baseTicks = wholeNoteTicks * candidate.units;
        let dottedTicks = baseTicks;

        for (let dots = 0; dots <= 3; dots++) {
            if (Math.abs(dottedTicks - durationTicks) < 0.0001) {
                return { base: candidate.base, dots };
            }

            dottedTicks += baseTicks / Math.pow(2, dots + 2);
        }
    }

    return undefined;
}
