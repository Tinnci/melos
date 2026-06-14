import type { Clef } from "@melos/core";
import {
    resolveAccidentalGlyph,
    resolveArticulationGlyph,
    resolveClefGlyph,
    resolveDynamicGlyphs,
    resolveNoteheadGlyph,
    resolvePedalGlyph,
    resolveRestGlyph,
} from "./smufl";

export interface PlannedGlyph {
    glyphName: string;
    role: string;
}

export interface PlannedClefGlyph extends PlannedGlyph {
    sign: string;
    yAdjust: number;
}

export interface PlannedDynamicGlyphs {
    glyphNames: string[];
    role: "dynamic";
}

export class GlyphPlanner {
    planClef(clef: Clef | string = "G"): PlannedClefGlyph | undefined {
        const sign = typeof clef === "string" ? clef : (clef?.sign ?? "G");
        const glyphName = resolveClefGlyph(
            sign,
            typeof clef === "string" ? undefined : clef?.glyph,
        );
        if (!glyphName) return undefined;

        return {
            glyphName,
            sign,
            yAdjust: clefYAdjust(sign),
            role: "clef",
        };
    }

    planAccidental(alter: number): PlannedGlyph | undefined {
        const glyphName = resolveAccidentalGlyph(alter);
        return glyphName ? { glyphName, role: "accidental" } : undefined;
    }

    planNotehead(duration: string, notehead?: string): PlannedGlyph | undefined {
        const glyphName = resolveNoteheadGlyph(duration, notehead);
        return glyphName ? { glyphName, role: "notehead" } : undefined;
    }

    planRest(duration: string): PlannedGlyph | undefined {
        const glyphName = resolveRestGlyph(duration);
        return glyphName ? { glyphName, role: "rest" } : undefined;
    }

    planDynamic(value: string, override?: string): PlannedDynamicGlyphs {
        return {
            glyphNames: resolveDynamicGlyphs(value, override),
            role: "dynamic",
        };
    }

    planArticulation(articulation: string, placement: "above" | "below"): PlannedGlyph | undefined {
        const glyphName = resolveArticulationGlyph(articulation, placement);
        return glyphName ? { glyphName, role: "articulation" } : undefined;
    }

    planPedal(type: "start" | "stop"): PlannedGlyph {
        return { glyphName: resolvePedalGlyph(type), role: "pedal" };
    }

    planJump(type: "segno" | "coda"): PlannedGlyph {
        return { glyphName: type, role: "jump" };
    }

    planAugmentationDot(): PlannedGlyph {
        return { glyphName: "augmentationDot", role: "augmentation-dot" };
    }
}

function clefYAdjust(sign: string): number {
    if (sign === "G") return 1;
    if (sign === "F") return -9;
    if (sign === "C") return -8;
    return -9;
}
