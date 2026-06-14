import { buildScoreTimeline, type Score, type TimelineBuildOptions } from "@melos/core";

export interface ValidationIssue {
    type: "error" | "warning";
    message: string;
    path: string; // e.g. "parts[0].measures[5]"
}

export interface MnxValidationOptions {
    allowPickupMeasure?: boolean;
    includeRhythmDiagnostics?: boolean;
}

export class MnxValidator {
    static validate(score: Score, options: MnxValidationOptions = {}): ValidationIssue[] {
        const issues: ValidationIssue[] = [];

        // 1. Structure Checks: Global Measures vs Part Measures alignment
        const globalMeasureCount = score.global.measures.length;
        score.parts.forEach((part, partIndex) => {
            if (part.measures.length !== globalMeasureCount) {
                issues.push({
                    type: "warning",
                    message: `Part '${part.name || part.id}' has ${part.measures.length} measures, expected ${globalMeasureCount}.`,
                    path: `parts[${partIndex}]`
                });
            }
        });

        // 2. Rhythmic Integrity
        const timelineOptions: TimelineBuildOptions = {
            allowPickupMeasure: options.allowPickupMeasure ?? true,
            includeRhythmDiagnostics: options.includeRhythmDiagnostics ?? true
        };
        const timeline = buildScoreTimeline(score, timelineOptions);
        timeline.diagnostics.forEach((diagnostic) => {
            issues.push({
                type: diagnostic.severity === "error" ? "error" : "warning",
                message: diagnostic.message,
                path: diagnostic.path
            });
        });

        // 3. Pitch Bounds
        score.parts.forEach((part, partIndex) => {
            part.measures.forEach((measure, measureIndex) => {
                measure.sequences.forEach((seq, seqIndex) => {
                    collectPitchBoundIssues(
                        seq.content,
                        `parts[${partIndex}].measures[${measureIndex}].sequences[${seqIndex}].content`,
                        issues
                    );
                });
            });
        });

        return issues;
    }
}

function collectPitchBoundIssues(content: unknown[], path: string, issues: ValidationIssue[]): void {
    content.forEach((event, eventIndex) => {
        if (!isRecord(event)) return;

        const eventPath = `${path}[${eventIndex}]`;
        if (Array.isArray(event.notes)) {
            event.notes.forEach((note, noteIndex) => {
                if (!isRecord(note) || !isRecord(note.pitch)) return;
                const octave = note.pitch.octave;
                if (typeof octave === "number" && (octave < 0 || octave > 9)) {
                    issues.push({
                        type: "warning",
                        message: `Note pitch octave ${octave} is outside standard range (0-9).`,
                        path: `${eventPath}.notes[${noteIndex}]`
                    });
                }
            });
        }

        if (Array.isArray(event.content)) {
            collectPitchBoundIssues(event.content, `${eventPath}.content`, issues);
        }
    });
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}
