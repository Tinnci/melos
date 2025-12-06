import { z } from "zod";

// --- Basic Types ---

export const VersionNumberSchema = z.number().int().min(1);

export const NoteValueBaseSchema = z.enum([
    "duplex-maxima", "maxima", "long", "breve", "whole", "half", "quarter",
    "/8", "/16", "/32", "/64", "/128", "/256", "/512", "/1024"
]);

export const NoteValueQuantitySchema = z.number().int().min(1);

export const NoteValueSchema = z.object({
    base: NoteValueBaseSchema,
    dots: z.number().int().nonnegative().optional(),
});

export const AccidentalDisplaySchema = z.object({
    show: z.boolean().optional(),
    cautionary: z.boolean().optional(),
    editorial: z.boolean().optional()
});

export const PitchSchema = z.object({
    step: z.enum(["C", "D", "E", "F", "G", "A", "B"]),
    octave: z.number().int(),
    alter: z.number().optional(), // Semitones
});

// --- Graphical / Layout Information ---

export const StaffPositionSchema = z.number();

// --- Musical Events ---

export const TieSchema = z.object({
    target: z.string().optional() // ID of the next note in the tie chain
});

export const NoteSchema = z.object({
    id: z.string().optional(),
    pitch: PitchSchema.optional(),
    staff: z.number().int().optional(),
    accidentalDisplay: AccidentalDisplaySchema.optional(),
    ties: z.array(TieSchema).optional(),
});

export const SlurSchema = z.object({
    target: z.string(),
    side: z.enum(["up", "down"]).optional(),
});

export const LyricSchema = z.object({
    text: z.string(),
    syllabic: z.enum(["begin", "start", "middle", "end", "stop", "single"]).optional(),
    line: z.string().optional() // References a LyricLine ID
});

export const DynamicValueSchema = z.enum([
    "p", "pp", "ppp", "pppp",
    "f", "ff", "fff", "ffff",
    "mf", "mp", "sfz", "fp", "rfz"
]);

export const DynamicEventSchema = z.object({
    type: z.literal("dynamic"),
    value: DynamicValueSchema
});

// [NEW] Articulation Enum
export const ArticulationSchema = z.enum([
    "staccato",
    "tenuto",
    "accent",
    "strong-accent",
    "staccatissimo",
    "fermata"
]);

export const BaseEventSchema = z.object({
    id: z.string().optional(),
    duration: NoteValueSchema.optional(),
    notes: z.array(NoteSchema).optional(),
    rest: z.object({}).optional(),
    slurs: z.array(SlurSchema).optional(),
    lyrics: z.array(LyricSchema).optional(),
    articulations: z.array(ArticulationSchema).optional(), // [NEW] Added articulations
    measure: z.boolean().optional()
});

// For recursive structures like Tuplets and Grace, we need to be careful with Zod recursion.
// Use z.lazy for true recursion if needed, but for now we define explicit schemas and use z.any() for the recursive 'content' field to avoid circular dependency issues in simple MVP.

export const TupletSchema = z.object({
    type: z.literal("tuplet"),
    outer: z.object({
        duration: NoteValueSchema,
        multiple: z.number().int().optional()
    }).optional(),
    inner: z.object({
        duration: NoteValueSchema,
        multiple: z.number().int().optional()
    }).optional(),
    content: z.array(z.any())
});

export const GraceSchema = z.object({
    type: z.literal("grace"),
    content: z.array(z.any())
});

export const SequenceContentSchema = z.union([
    BaseEventSchema,
    TupletSchema,
    GraceSchema,
    DynamicEventSchema
]);

export const SequenceSchema = z.object({
    content: z.array(SequenceContentSchema)
});

// --- Structure: Parts & Measures ---

export const KeySignatureSchema = z.object({
    fifths: z.number().int(),
    mode: z.enum(["major", "minor"]).optional()
});

export const TimeSignatureSchema = z.object({
    count: z.number().int(),
    unit: z.number().int()
});

export const ClefSchema = z.object({
    sign: z.enum(["G", "F", "C", "percussion", "TAB"]),
    line: z.number().int().optional(),
    octave: z.number().int().optional(),
    staffPosition: z.number().int().optional()
});

export const BeamSchema = z.object({
    events: z.array(z.string()),
    direction: z.enum(["up", "down"]).optional(),
    inner: z.array(z.any()).optional()
});

// [NEW] Rhythmic Position (MNX: { fraction: [n, d] })
export const RhythmicPositionSchema = z.object({
    fraction: z.tuple([z.number(), z.number()])
});

// [NEW] Measure Rhythmic Position for cross-measure endpoints
export const MeasureRhythmicPositionSchema = z.object({
    measure: z.number().int(), // Global measure index (1-based)
    position: RhythmicPositionSchema
});

// [NEW] Wedge (Hairpin)
export const WedgeSchema = z.object({
    type: z.enum(["crescendo", "diminuendo"]),
    position: RhythmicPositionSchema, // Start position in current measure
    end: MeasureRhythmicPositionSchema.optional(), // End position (can be cross-measure)
    staff: z.number().int().optional(),
    voice: z.string().optional()
});


export const GlobalMeasureSchema = z.object({
    index: z.number().int().optional(),
    time: TimeSignatureSchema.optional(),
    key: KeySignatureSchema.optional(),
    tempos: z.array(z.object({
        bpm: z.number(),
        location: z.number().optional()
    })).optional(),
    barline: z.object({
        type: z.enum(["regular", "double", "final", "dashed", "light-heavy"])
    }).optional(),
    break: z.enum(["system", "page"]).optional() // [NEW] Added break
});

export const LyricLineSchema = z.object({
    id: z.string(),
    name: z.string().optional()
});

export const GlobalSchema = z.object({
    measures: z.array(GlobalMeasureSchema),
    lyrics: z.array(LyricLineSchema).optional()
});

export const PositionedClefSchema = z.object({
    clef: ClefSchema,
    staff: z.number().int().optional()
});

export const PartMeasureSchema = z.object({
    index: z.number().int().optional(),
    sequences: z.array(SequenceSchema),
    clefs: z.array(PositionedClefSchema).optional(),
    beams: z.array(BeamSchema).optional(),
    wedges: z.array(WedgeSchema).optional()
});

export const PartSchema = z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    "short-name": z.string().optional(),
    measures: z.array(PartMeasureSchema),
    dim: z.number().int().optional()
});

// --- Root ---

export const MNXHeaderSchema = z.object({
    version: VersionNumberSchema
});

export const ScoreSchema = z.object({
    mnx: MNXHeaderSchema,
    global: GlobalSchema,
    parts: z.array(PartSchema)
});

// --- Exports ---
export type VersionNumber = z.infer<typeof VersionNumberSchema>;
export type NoteValue = z.infer<typeof NoteValueSchema>;
export type Pitch = z.infer<typeof PitchSchema>;
export type Tie = z.infer<typeof TieSchema>;
export type Note = z.infer<typeof NoteSchema>;
export type Slur = z.infer<typeof SlurSchema>;
export type Lyric = z.infer<typeof LyricSchema>;
export type LyricLine = z.infer<typeof LyricLineSchema>;
export type DynamicValue = z.infer<typeof DynamicValueSchema>;
export type DynamicEvent = z.infer<typeof DynamicEventSchema>;
export type Event = z.infer<typeof BaseEventSchema>;
export type Tuplet = z.infer<typeof TupletSchema>;
export type Grace = z.infer<typeof GraceSchema>;
export type Sequence = z.infer<typeof SequenceSchema>;
export type GlobalMeasure = z.infer<typeof GlobalMeasureSchema>;
export type PartMeasure = z.infer<typeof PartMeasureSchema>;
export type Part = z.infer<typeof PartSchema>;
export type Score = z.infer<typeof ScoreSchema>;
export type Beam = z.infer<typeof BeamSchema>;
export type Wedge = z.infer<typeof WedgeSchema>;
export type RhythmicPosition = z.infer<typeof RhythmicPositionSchema>;
export type MeasureRhythmicPosition = z.infer<typeof MeasureRhythmicPositionSchema>;
export type Articulation = z.infer<typeof ArticulationSchema>;
