import { type Score, type NoteValue, type Sequence, type GlobalMeasure } from "@melos/core";

export interface ValidationIssue {
    type: "error" | "warning";
    message: string;
    path: string; // e.g. "parts[0].measures[5]"
}

export class MnxValidator {
    static validate(score: Score): ValidationIssue[] {
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

        // 2. Rhythmic Integrity & Pitch Bounds
        score.parts.forEach((part, partIndex) => {
            part.measures.forEach((measure, measureIndex) => {
                // Rhythm Check
                const globalMeasure = score.global.measures[measureIndex];

                // Only validate rhythm if time signature exists
                if (globalMeasure && globalMeasure.time) {
                    const timeSig = globalMeasure.time;
                    const expectedDuration = timeSig.count * (1 / timeSig.unit);

                    measure.sequences.forEach((seq, seqIndex) => {
                        const actualDuration = this.calculateSequenceDuration(seq);

                        // Allow small float error
                        if (Math.abs(actualDuration - expectedDuration) > 0.0001) {
                            // Pickup measure exception (1st measure can be shorter)
                            if (measureIndex === 0 && actualDuration < expectedDuration) {
                                // Valid pickup
                            } else {
                                issues.push({
                                    type: "warning",
                                    message: `Measure ${measureIndex + 1} (Sequence ${seqIndex + 1}): Actual duration ${actualDuration.toFixed(3)} does not match Time Signature ${timeSig.count}/${timeSig.unit} (${expectedDuration.toFixed(3)}).`,
                                    path: `parts[${partIndex}].measures[${measureIndex}].sequences[${seqIndex}]`
                                });
                            }
                        }

                        // Pitch & Content Checks
                        seq.content.forEach((event, eventIndex) => {
                            if ('notes' in event && event.notes) {
                                event.notes.forEach((note, noteIndex) => {
                                    if (note.pitch) {
                                        if (note.pitch.octave < 0 || note.pitch.octave > 9) {
                                            issues.push({
                                                type: "warning",
                                                message: `Note pitch octave ${note.pitch.octave} is outside standard range (0-9).`,
                                                path: `parts[${partIndex}].measures[${measureIndex}].sequences[${seqIndex}].events[${eventIndex}].notes[${noteIndex}]`
                                            });
                                        }
                                    }
                                });
                            }
                        });
                    });
                }
            });
        });

        return issues;
    }

    private static calculateSequenceDuration(sequence: Sequence): number {
        let total = 0;
        for (const content of sequence.content) {
            if ('type' in content && content.type === 'tuplet') {
                // Handle Tuplet
                if (content.outer && content.outer.duration) {
                    total += this.getNoteValueDuration(content.outer.duration);
                }
            } else if ('type' in content && content.type === 'grace') {
                // Grace notes do not add to duration
            } else if ('type' in content && content.type === 'dynamic') {
                // Dynamics do not add to duration
            } else if ('duration' in content && content.duration) {
                // BaseEvent (Note/Rest)
                total += this.getNoteValueDuration(content.duration);
            }
        }
        return total;
    }

    private static getNoteValueDuration(nv: NoteValue): number {
        let base = 0;
        switch (nv.base) {
            case "long": base = 4; break;
            case "breve": base = 2; break;
            case "whole": base = 1; break;
            case "half": base = 1 / 2; break;
            case "quarter": base = 1 / 4; break;
            case "/8": base = 1 / 8; break;
            case "/16": base = 1 / 16; break;
            case "/32": base = 1 / 32; break;
            case "/64": base = 1 / 64; break;
            case "/128": base = 1 / 128; break;
            case "/256": base = 1 / 256; break;
            default: base = 0;
        }

        let duration = base;
        if (nv.dots) {
            let add = base;
            for (let i = 0; i < nv.dots; i++) {
                add /= 2;
                duration += add;
            }
        }
        return duration;
    }
}
