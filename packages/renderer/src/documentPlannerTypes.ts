import type { Note, RhythmicPosition } from "@melos/core";
import type { RenderPlanMeasure } from "./plan";
import type { SpacingEventPosition } from "./spacing";

export type TremoloValue =
    | number
    | { type?: "single" | "start" | "stop"; marks?: number; id?: string };

export type SourceItem = {
    id?: string;
    type?: string;
    value?: string;
    duration?: { base?: string; dots?: number };
    notes?: Note[];
    rest?: { hidden?: boolean };
    articulations?: string[];
    slurs?: Array<{ target?: string; side?: string }>;
    tremolo?: TremoloValue;
};

export type MeasureOverlayEnd = { measure?: number; position?: RhythmicPosition };

export type MeasureOverlay = {
    type?: string;
    value?: number;
    position?: RhythmicPosition;
    end?: MeasureOverlayEnd;
    line?: boolean;
    sign?: boolean;
};

export type EventAnchor = {
    id: string;
    x: number;
    y: number;
    partIndex: number;
    measureIndex: number;
    partId?: string;
    sourcePath: string;
};

export type PlannedEvent = {
    measure: RenderPlanMeasure;
    position: SpacingEventPosition;
    source: SourceItem | undefined;
};

export type NoteLayout = {
    minY: number;
    maxY: number;
    stemUp: boolean;
    stemTipY: number;
    scale: number;
};

export type NoteAdornmentContext = {
    measure: RenderPlanMeasure;
    position: SpacingEventPosition;
    source: SourceItem;
    note: Note;
    noteIndex: number;
    noteY: number;
    layout: NoteLayout;
};
