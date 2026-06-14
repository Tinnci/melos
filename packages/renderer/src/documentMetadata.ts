import type { RenderBox, RenderDiagnostic, RenderSpan } from "./renderDocument";

export interface RenderDocumentMetadataOptions {
    lineSpacing: number;
    measurePadding: number;
    noteRadius: number;
    stemLength: number;
    dynamicOffsetY: number;
    pedalSignOffsetY: number;
    pedalLineOffsetY: number;
}

export interface RenderDocumentMetadata {
    boxes: RenderBox[];
    spans: RenderSpan[];
    diagnostics: RenderDiagnostic[];
}

export const DEFAULT_RENDER_DOCUMENT_METADATA_OPTIONS: RenderDocumentMetadataOptions = {
    lineSpacing: 10,
    measurePadding: 15,
    noteRadius: 5,
    stemLength: 35,
    dynamicOffsetY: 78,
    pedalSignOffsetY: 108,
    pedalLineOffsetY: 111,
};
