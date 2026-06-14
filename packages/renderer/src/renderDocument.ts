export type RenderAttributeValue = boolean | number | string | undefined;
export type RenderAttributes = Record<string, RenderAttributeValue>;

export interface RenderDocument {
    width: number;
    height: number;
    elements: RenderElement[];
    styles?: string[];
    attributes?: RenderAttributes;
    boxes?: RenderBox[];
    spans?: RenderSpan[];
    diagnostics?: RenderDiagnostic[];
}

export type RenderElement =
    | RenderGroupElement
    | RenderHitboxElement
    | RenderLineElement
    | RenderPathElement
    | RenderRawElement
    | RenderRectElement
    | RenderSmuflGlyphElement
    | RenderTextElement;

export interface RenderElementBase {
    attributes?: RenderAttributes;
    rawAttributes?: string;
}

export interface RenderTextElement extends RenderElementBase {
    kind: "text";
    x: number;
    y: number;
    text: string;
    className?: string;
    fontFamily?: string;
    fontSize?: number;
}

export interface RenderSmuflGlyphElement extends RenderElementBase {
    kind: "smuflGlyph";
    x: number;
    y: number;
    fontSize: number;
    glyphName?: string;
    glyphNames?: string[];
}

export interface RenderRectElement extends RenderElementBase {
    kind: "rect";
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface RenderHitboxElement extends RenderElementBase {
    kind: "hitbox";
    x: number;
    y: number;
    width: number;
    height: number;
    className: string;
}

export interface RenderLineElement extends RenderElementBase {
    kind: "line";
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

export interface RenderPathElement extends RenderElementBase {
    kind: "path";
    d: string;
}

export interface RenderGroupElement extends RenderElementBase {
    kind: "group";
    children: RenderElement[];
}

export interface RenderRawElement {
    kind: "raw";
    svg: string;
}

export type RenderBoxRole =
    | "accidental"
    | "articulation"
    | "augmentationDot"
    | "dynamic"
    | "grace"
    | "measure"
    | "note"
    | "ottava"
    | "pedal"
    | "rest"
    | "stave"
    | "tremolo"
    | "tuplet";

export type RenderBoxLayer = "interaction" | "notation" | "staff" | "span";

export interface RenderBox {
    id: string;
    role: RenderBoxRole;
    layer: RenderBoxLayer;
    x: number;
    y: number;
    width: number;
    height: number;
    partIndex: number;
    measureIndex: number;
    partId?: string;
    eventId?: string;
    sourcePath?: string;
}

export type RenderSpanRole = "ottava" | "pedal" | "slur" | "tie" | "tremolo" | "wedge";

export interface RenderSpan {
    id: string;
    role: RenderSpanRole;
    partIndex: number;
    measureIndex: number;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    partId?: string;
    sourceId?: string;
    targetId?: string;
    sourcePath?: string;
}

export type RenderDiagnosticSeverity = "info" | "warning" | "error";

export interface RenderDiagnostic {
    severity: RenderDiagnosticSeverity;
    code: "collision-unresolved" | "measure-overfull" | "span-endpoint-missing";
    message: string;
    path?: string;
    boxIds?: string[];
    spanId?: string;
}
