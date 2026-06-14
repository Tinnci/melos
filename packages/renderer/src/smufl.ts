export const DEFAULT_SMUFL_FONT = "Bravura";
export const SMUFL_FONT_STACK = "Bravura, 'Bravura Text', serif";

export const SMUFL_GLYPHS = {
    gClef: 0xe050,
    cClef: 0xe05c,
    fClef: 0xe062,
    unpitchedPercussionClef1: 0xe069,

    accidentalFlat: 0xe260,
    accidentalNatural: 0xe261,
    accidentalSharp: 0xe262,
    accidentalDoubleSharp: 0xe263,
    accidentalDoubleFlat: 0xe264,

    noteheadWhole: 0xe0a2,
    noteheadHalf: 0xe0a3,
    noteheadBlack: 0xe0a4,
    noteheadXBlack: 0xe0a9,
    noteheadSquareWhite: 0xe0b8,
    noteheadSquareBlack: 0xe0b9,
    noteheadTriangleUpBlack: 0xe0c2,
    noteheadDiamondHalf: 0xe0d9,
    noteheadDiamondBlack: 0xe0db,

    restWhole: 0xe4e3,
    restHalf: 0xe4e4,
    restQuarter: 0xe4e5,
    rest8th: 0xe4e6,
    rest16th: 0xe4e7,
    rest32nd: 0xe4e8,

    augmentationDot: 0xe1e7,

    dynamicPiano: 0xe520,
    dynamicMezzo: 0xe521,
    dynamicForte: 0xe522,
    dynamicRinforzando: 0xe523,
    dynamicSforzando: 0xe524,
    dynamicZ: 0xe525,
    dynamicNiente: 0xe526,

    articAccentAbove: 0xe4a0,
    articAccentBelow: 0xe4a1,
    articStaccatoAbove: 0xe4a2,
    articStaccatoBelow: 0xe4a3,
    articTenutoAbove: 0xe4a4,
    articTenutoBelow: 0xe4a5,
    articStaccatissimoAbove: 0xe4a6,
    articStaccatissimoBelow: 0xe4a7,
    articMarcatoAbove: 0xe4ac,
    articMarcatoBelow: 0xe4ad,
    fermataAbove: 0xe4c0,
    fermataBelow: 0xe4c1,

    segno: 0xe047,
    coda: 0xe048,
    keyboardPedalPed: 0xe650,
    keyboardPedalUp: 0xe655,
} as const;

export type SmuflGlyphName = keyof typeof SMUFL_GLYPHS;

export function getSmuflChar(glyphName: string): string | undefined {
    const codepoint = SMUFL_GLYPHS[glyphName as SmuflGlyphName];
    return codepoint === undefined ? undefined : String.fromCodePoint(codepoint);
}

export function resolveClefGlyph(sign: string, override?: string): SmuflGlyphName | string | undefined {
    if (override) return override;
    switch (sign) {
        case "G": return "gClef";
        case "F": return "fClef";
        case "C": return "cClef";
        case "percussion": return "unpitchedPercussionClef1";
        default: return undefined;
    }
}

export function resolveAccidentalGlyph(alter: number): SmuflGlyphName | undefined {
    switch (alter) {
        case 2: return "accidentalDoubleSharp";
        case 1: return "accidentalSharp";
        case 0: return "accidentalNatural";
        case -1: return "accidentalFlat";
        case -2: return "accidentalDoubleFlat";
        default: return undefined;
    }
}

export function resolveNoteheadGlyph(duration: string, notehead?: string): SmuflGlyphName | undefined {
    if (notehead === "x") return "noteheadXBlack";
    if (notehead === "diamond") return duration === "whole" || duration === "half" ? "noteheadDiamondHalf" : "noteheadDiamondBlack";
    if (notehead === "square") return duration === "whole" || duration === "half" ? "noteheadSquareWhite" : "noteheadSquareBlack";
    if (notehead === "triangle") return "noteheadTriangleUpBlack";
    if (notehead && notehead !== "normal") return undefined;

    switch (duration) {
        case "whole": return "noteheadWhole";
        case "half": return "noteheadHalf";
        default: return "noteheadBlack";
    }
}

export function resolveRestGlyph(duration: string): SmuflGlyphName | undefined {
    switch (duration) {
        case "whole": return "restWhole";
        case "half": return "restHalf";
        case "quarter": return "restQuarter";
        case "eighth": return "rest8th";
        case "16th": return "rest16th";
        case "32nd": return "rest32nd";
        default: return undefined;
    }
}

export function resolveDynamicGlyphs(value: string, override?: string): string[] {
    if (override) return [override];

    const normalized = value.trim().toLowerCase();
    if (/^p+$/.test(normalized)) {
        return Array.from({ length: normalized.length }, () => "dynamicPiano");
    }
    if (/^f+$/.test(normalized)) {
        return Array.from({ length: normalized.length }, () => "dynamicForte");
    }

    const glyphs: Record<string, SmuflGlyphName[]> = {
        p: ["dynamicPiano"],
        pp: ["dynamicPiano", "dynamicPiano"],
        ppp: ["dynamicPiano", "dynamicPiano", "dynamicPiano"],
        pppp: ["dynamicPiano", "dynamicPiano", "dynamicPiano", "dynamicPiano"],
        f: ["dynamicForte"],
        ff: ["dynamicForte", "dynamicForte"],
        fff: ["dynamicForte", "dynamicForte", "dynamicForte"],
        ffff: ["dynamicForte", "dynamicForte", "dynamicForte", "dynamicForte"],
        mf: ["dynamicMezzo", "dynamicForte"],
        mp: ["dynamicMezzo", "dynamicPiano"],
        fp: ["dynamicForte", "dynamicPiano"],
        rfz: ["dynamicRinforzando", "dynamicForte", "dynamicZ"],
        sfz: ["dynamicSforzando", "dynamicForte", "dynamicZ"],
    };

    return glyphs[normalized] ?? [];
}

export function resolveArticulationGlyph(articulation: string, placement: "above" | "below"): SmuflGlyphName | undefined {
    const above = placement === "above";
    switch (articulation) {
        case "accent": return above ? "articAccentAbove" : "articAccentBelow";
        case "staccato": return above ? "articStaccatoAbove" : "articStaccatoBelow";
        case "tenuto": return above ? "articTenutoAbove" : "articTenutoBelow";
        case "staccatissimo": return above ? "articStaccatissimoAbove" : "articStaccatissimoBelow";
        case "strong-accent": return above ? "articMarcatoAbove" : "articMarcatoBelow";
        case "fermata": return above ? "fermataAbove" : "fermataBelow";
        default: return undefined;
    }
}

export function resolvePedalGlyph(type: "start" | "stop"): SmuflGlyphName {
    return type === "start" ? "keyboardPedalPed" : "keyboardPedalUp";
}
