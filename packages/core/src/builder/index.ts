import {
    Score, GlobalMeasure, Part, PartMeasure, Sequence,
    Note, NoteValue, Pitch, Tie, Slur, DynamicEvent, Articulation,
    Event, NoteValueBaseSchema
} from "../schema";

// Helper types
type PartBuilderCallback = (builder: PartBuilder) => void;
type MeasureBuilderCallback = (builder: PartMeasureBuilder) => void;
type SequenceBuilderCallback = (builder: SequenceBuilder) => void;

/**
 * ScoreBuilder
 * The entry point for creating MNX scores programmatically.
 */
export class ScoreBuilder {
    private globalMeasures: GlobalMeasure[] = [];
    private parts: PartBuilder[] = [];

    /**
     * Define a global measure (time signature, key signature, etc.)
     * This defines the "grid" of the score.
     */
    addGlobalMeasure(measure: GlobalMeasure): ScoreBuilder {
        this.globalMeasures.push(measure);
        return this;
    }

    /**
     * Add a new Part (instrument) to the score.
     */
    addPart(name: string, callback?: PartBuilderCallback): ScoreBuilder {
        const partBuilder = new PartBuilder(name);
        if (callback) {
            callback(partBuilder);
        }
        this.parts.push(partBuilder);
        return this;
    }

    /**
     * Build the final Score object.
     */
    build(): Score {
        return {
            mnx: {
                version: 1
            },
            global: {
                measures: this.globalMeasures
            },
            parts: this.parts.map(p => p.build())
        };
    }
}

/**
 * PartBuilder
 * Constructs a single instrument part.
 */
export class PartBuilder {
    private id: string;
    private name: string;
    private shortName?: string;
    private measures: PartMeasureBuilder[] = [];

    constructor(name: string, id?: string) {
        this.name = name;
        this.id = id || name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    }

    setShortName(shortName: string): PartBuilder {
        this.shortName = shortName;
        return this;
    }

    /**
     * Add a measure to this part.
     * @param index The global measure index this corresponds to (1-based implied usually, but MNX is flexible)
     */
    addMeasure(index: number, callback?: MeasureBuilderCallback): PartBuilder {
        // Check if a measure builder already exists for this index?
        // For simplicity, we assume sequential addition or distinct indices.
        const mBuilder = new PartMeasureBuilder(index);
        if (callback) {
            callback(mBuilder);
        }
        this.measures.push(mBuilder);
        return this;
    }

    build(): Part {
        return {
            id: this.id,
            name: this.name,
            "short-name": this.shortName,
            measures: this.measures.map(m => m.build())
        };
    }
}

/**
 * PartMeasureBuilder
 * Represents the content of a measure for a specific part.
 */
export class PartMeasureBuilder {
    private index?: number;
    private sequences: SequenceBuilder[] = [];

    constructor(index?: number) {
        this.index = index;
    }

    /**
     * Add a voice/sequence to this measure.
     */
    addSequence(callback: SequenceBuilderCallback): PartMeasureBuilder {
        const seqBuilder = new SequenceBuilder();
        callback(seqBuilder);
        this.sequences.push(seqBuilder);
        return this;
    }

    build(): PartMeasure {
        return {
            index: this.index,
            sequences: this.sequences.map(s => s.build())
        };
    }
}

/**
 * SequenceBuilder
 * Constructs a linear sequence of musical events (notes, rests).
 */
export class SequenceBuilder {
    private events: Event[] = [];

    /**
     * Add a note.
     * @param step Note step (C, D, E...)
     * @param octave Octave number (4, 5...)
     * @param duration Duration string (quarter, half, etc) or object
     * @param alter Alteration (1 for sharp, -1 for flat, etc)
     */
    note(step: string, octave: number, duration: string | NoteValue, alter?: number): SequenceBuilder {
        const noteVal = typeof duration === 'string' ? this.parseDuration(duration) : duration;
        const validStep = step.toUpperCase() as any;

        const note: Note = {
            pitch: {
                step: validStep,
                octave: octave,
                alter: alter
            }
        };

        const event: Event = {
            duration: noteVal,
            notes: [note]
        };

        this.events.push(event);
        return this;
    }

    /**
     * Add a chord (multiple notes, same duration).
     */
    chord(notes: { step: string, octave: number, alter?: number }[], duration: string | NoteValue): SequenceBuilder {
        const noteVal = typeof duration === 'string' ? this.parseDuration(duration) : duration;

        const noteObjs: Note[] = notes.map(n => ({
            pitch: {
                step: n.step.toUpperCase() as any,
                octave: n.octave,
                alter: n.alter
            }
        }));

        const event: Event = {
            duration: noteVal,
            notes: noteObjs
        };

        this.events.push(event);
        return this;
    }

    /**
     * Add a rest.
     */
    rest(duration: string | NoteValue): SequenceBuilder {
        const noteVal = typeof duration === 'string' ? this.parseDuration(duration) : duration;
        const event: Event = {
            duration: noteVal,
            rest: {}
        };
        this.events.push(event);
        return this;
    }

    /**
     * Add tuplets, slurs, etc. can be added later as needed.
     */

    build(): Sequence {
        return {
            content: this.events
        };
    }

    private parseDuration(str: string): NoteValue {
        // Simple parser for now
        // "quarter", "half. "(dotted)
        let base = str;
        let dots = 0;

        while (base.endsWith('.')) {
            dots++;
            base = base.slice(0, -1);
        }

        return {
            base: base as any, // "quarter", "half", etc.
            dots: dots > 0 ? dots : undefined
        };
    }
}

// Internal Note parser helper (optional for future expansion)
function parsePitch(input: string): Pitch {
    // e.g., "C#4", "Bb3"
    // Regex parsing implementation
    // For now the builder requires explicit arguments to avoid ambiguity
    return { step: "C", octave: 4 };
}
