import {
    ScoreSchema,
    type Note,
    type NoteValue,
    type PartMeasure,
    type Pitch,
    type Score,
    type Sequence,
} from "@melos/core";

type ScoreContentItem = Sequence["content"][number];
type ScoreFixtureOptions = {
    globalMeasures?: Score["global"]["measures"];
    parts?: Score["parts"];
};
type SinglePartScoreOptions = ScoreFixtureOptions & {
    partId?: string;
    partName?: string;
    measures?: PartMeasure[];
};
type MeasureOptions = Omit<Partial<PartMeasure>, "sequences"> & {
    sequences?: Sequence[];
};
type NoteEventOptions = {
    id?: string;
    pitch?: Pitch;
    duration?: NoteValue["base"];
    dots?: number;
    notes?: Note[];
    staff?: number;
};
type RestEventOptions = {
    id?: string;
    duration?: NoteValue["base"];
    dots?: number;
    hidden?: boolean;
    measure?: boolean;
};
type DynamicEventOptions = {
    id?: string;
    value?: string;
    glyph?: string;
};
type TupletOptions = {
    content?: ScoreContentItem[];
    inner?: { duration: NoteValue; multiple?: number };
    outer?: { duration: NoteValue; multiple?: number };
};

export function scoreFixture(options: ScoreFixtureOptions = {}): Score {
    return ScoreSchema.parse({
        mnx: { version: 1 },
        global: {
            measures: options.globalMeasures ?? [{ time: { count: 4, unit: 4 } }],
        },
        parts:
            options.parts ??
            [
                {
                    id: "P1",
                    measures: [measureWithContent([noteEvent()])],
                },
            ],
    });
}

export function singlePartScore(options: SinglePartScoreOptions = {}): Score {
    return scoreFixture({
        globalMeasures: options.globalMeasures,
        parts: [
            {
                id: options.partId ?? "P1",
                ...(options.partName ? { name: options.partName } : {}),
                measures: options.measures ?? [measureWithContent([noteEvent()])],
            },
        ],
    });
}

export function measureWithContent(
    content: ScoreContentItem[],
    options: MeasureOptions = {},
): PartMeasure {
    const { sequences, ...measureOptions } = options;
    return {
        ...measureOptions,
        sequences: sequences ?? [{ content }],
    };
}

export function noteEvent(options: NoteEventOptions = {}): ScoreContentItem {
    return {
        ...(options.id ? { id: options.id } : {}),
        duration: {
            base: options.duration ?? "quarter",
            ...(options.dots ? { dots: options.dots } : {}),
        },
        notes: options.notes ?? [
            {
                pitch: options.pitch ?? { step: "C", octave: 4 },
                ...(options.staff ? { staff: options.staff } : {}),
            },
        ],
    };
}

export function restEvent(options: RestEventOptions = {}): ScoreContentItem {
    return {
        ...(options.id ? { id: options.id } : {}),
        duration: {
            base: options.duration ?? "quarter",
            ...(options.dots ? { dots: options.dots } : {}),
        },
        rest: {
            ...(options.hidden ? { hidden: true } : {}),
        },
        ...(options.measure ? { measure: true } : {}),
    };
}

export function dynamicEvent(options: DynamicEventOptions = {}): ScoreContentItem {
    return {
        type: "dynamic",
        ...(options.id ? { id: options.id } : {}),
        value: options.value ?? "mf",
        ...(options.glyph ? { glyph: options.glyph } : {}),
    };
}

export function graceGroup(content: ScoreContentItem[]): ScoreContentItem {
    return {
        type: "grace",
        content,
    };
}

export function tupletEvent(options: TupletOptions = {}): ScoreContentItem {
    return {
        type: "tuplet",
        inner: options.inner ?? { duration: { base: "eighth" }, multiple: 3 },
        outer: options.outer ?? { duration: { base: "eighth" }, multiple: 2 },
        content: options.content ?? [
            noteEvent({ id: "tuplet-1", duration: "eighth" }),
            noteEvent({ id: "tuplet-2", duration: "eighth", pitch: { step: "D", octave: 4 } }),
            noteEvent({ id: "tuplet-3", duration: "eighth", pitch: { step: "E", octave: 4 } }),
        ],
    };
}
