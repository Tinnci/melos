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
    unpitched: z.object({ // [NEW] For percussion
        step: z.string().min(1).max(1),
        octave: z.number().int()
    }).optional(),
    notehead: z.enum(["normal", "x", "diamond", "triangle", "slash", "square", "circle-x"]).optional(), // [NEW] Notehead shapes
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
    articulations: z.array(ArticulationSchema).optional(),
    // [UPDATED] Tremolo: number (single) or detailed object (multi-note)
    tremolo: z.union([
        z.number().int().min(1).max(5), // Simple single-note
        z.object({
            type: z.enum(["single", "start", "stop"]),
            marks: z.number().int().min(1).max(5),
            id: z.string().optional() // ID for linking start/stop
        })
    ]).optional(),
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

// [NEW] Ottava (8va, 8vb, 15ma, 15mb, etc.)
// value: 1 = 8va (up one octave), -1 = 8vb (down), 2 = 15ma (two octaves up), etc.
export const OttavaSchema = z.object({
    value: z.union([z.literal(1), z.literal(-1), z.literal(2), z.literal(-2), z.literal(3), z.literal(-3)]),
    position: RhythmicPositionSchema, // Start position in current measure
    end: MeasureRhythmicPositionSchema, // End position (required)
    staff: z.number().int().optional(),
    voice: z.string().optional()
});

// [NEW] Pedal (Sustain pedal)
export const PedalSchema = z.object({
    type: z.enum(["start", "stop", "change", "continue"]),
    position: RhythmicPositionSchema,
    end: MeasureRhythmicPositionSchema.optional(), // Only for lines, or paired start/stop
    line: z.boolean().optional(), // If true, render as bracket/line
    sign: z.boolean().optional(), // If true, render 'Ped' symbol
    staff: z.number().int().optional(),
    voice: z.string().optional()
});

// [NEW] Multimeasure Rest (consolidated rest spanning multiple measures)
export const MultimeasureRestSchema = z.object({
    start: z.number().int(), // Starting measure number (1-indexed)
    duration: z.number().int().min(1), // Number of measures
    label: z.string().optional() // Optional display label
});

// [NEW] Repeat and Ending schemas
export const RepeatStartSchema = z.object({});

export const RepeatEndSchema = z.object({
    times: z.number().int().min(1).optional() // How many times to repeat (default 2)
});

export const EndingSchema = z.object({
    numbers: z.array(z.number().int()).optional(), // Which endings (e.g., [1] or [1,2])
    duration: z.number().int().min(1), // How many measures this ending spans
    open: z.boolean().optional() // Whether the ending bracket is open (no right side)
});

export const JumpSchema = z.object({
    type: z.enum(["segno", "coda", "fine", "dc", "ds", "dc-al-fine", "ds-al-fine", "dc-al-coda", "ds-al-coda"])
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
        type: z.enum(["regular", "double", "final", "dashed", "light-heavy", "repeat-forward", "repeat-backward", "repeat-both"])
    }).optional(),
    break: z.enum(["system", "page"]).optional(),
    // [NEW] Repeat navigation
    repeatStart: RepeatStartSchema.optional(),
    repeatEnd: RepeatEndSchema.optional(),
    ending: EndingSchema.optional(),
    // [NEW] Jumps and Markers
    jumps: z.array(JumpSchema).optional()
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
    wedges: z.array(WedgeSchema).optional(),
    ottavas: z.array(OttavaSchema).optional(),
    pedals: z.array(PedalSchema).optional(), // [NEW] Pedal markings
    multimeasureRest: MultimeasureRestSchema.optional() // [NEW] Consolidated multi-bar rest
});

export const SoundDefinitionSchema = z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    "midi-program": z.number().int().optional(),
    "midi-channel": z.number().int().optional(),
    "midi-bank": z.number().int().optional()
});

export const PartSchema = z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    "short-name": z.string().optional(),
    sounds: z.array(SoundDefinitionSchema).optional(), // [NEW] Sound definitions
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
export type MeasureRhythmicPosition = z.infer<typeof MeasureRhythmicPositionSchema>;
export type Articulation = z.infer<typeof ArticulationSchema>;
export type Ottava = z.infer<typeof OttavaSchema>;
export type Pedal = z.infer<typeof PedalSchema>;
export type MultimeasureRest = z.infer<typeof MultimeasureRestSchema>;
export type Part = z.infer<typeof PartSchema>;
export type Score = z.infer<typeof ScoreSchema>;
export type Beam = z.infer<typeof BeamSchema>;
export type Wedge = z.infer<typeof WedgeSchema>;
export type RhythmicPosition = z.infer<typeof RhythmicPositionSchema>;

export type RepeatStart = z.infer<typeof RepeatStartSchema>;
export type RepeatEnd = z.infer<typeof RepeatEndSchema>;
export type Ending = z.infer<typeof EndingSchema>;
export type Jump = z.infer<typeof JumpSchema>;
