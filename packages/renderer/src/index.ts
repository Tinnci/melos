import type { Score, Part, MeasureRhythmicPosition, Note, Event } from "@melos/core";

export class Renderer {
    // Simple configuration for "Hello World"
    private config = {
        staveWidth: 800,
        staveHeight: 100, // Space for 5 lines
        lineSpacing: 10,
        paddingX: 20,
        paddingY: 40,
        noteRadius: 5
    };

    /**
     * Renders a Score object to an SVG string.
     */
    render(score: Score): string {
        let svgContent = "";
        let currentY = this.config.paddingY;

        // Iterate through parts (Instruments)
        score.parts.forEach((part, pIndex) => {
            // Render Part Name
            svgContent += `<text x="${this.config.paddingX}" y="${currentY - 20}" font-family="Arial" font-size="14">${part.name || part.id}</text>\n`;

            // For MVP, we just render one long system for all measures (no line breaks yet)
            // Draw Stave Lines (5 lines)
            for (let i = 0; i < 5; i++) {
                const y = currentY + (i * this.config.lineSpacing);
                svgContent += `<line x1="${this.config.paddingX}" y1="${y}" x2="${this.config.staveWidth + this.config.paddingX}" y2="${y}" stroke="black" stroke-width="1" />\n`;
            }

            // Render Notes
            let currentX = this.config.paddingX + 20; // Start a bit in

            part.measures.forEach((measure) => {
                // Draw Barline (Start)
                svgContent += `<line x1="${currentX}" y1="${currentY}" x2="${currentX}" y2="${currentY + 4 * this.config.lineSpacing}" stroke="black" stroke-width="1" />\n`;

                // Iterate Sequences (Voices) - For MVP take first voice
                const voice = measure.sequences[0];
                if (voice) {
                    voice.content.forEach((item: any) => {
                        // Assuming Event type for now
                        if (item.notes && item.notes.length > 0) {
                            const note = item.notes[0];
                            const cy = this.calculateY(note, currentY);

                            // Draw Note Head
                            svgContent += `<circle cx="${currentX + 15}" cy="${cy}" r="${this.config.noteRadius}" fill="black" />\n`;

                            // Draw Stem (Simple Up Stem)
                            svgContent += `<line x1="${currentX + 15 + this.config.noteRadius}" y1="${cy}" x2="${currentX + 15 + this.config.noteRadius}" y2="${cy - 35}" stroke="black" stroke-width="1" />\n`;

                            currentX += 30; // Move cursor
                        } else if (item.rest) {
                            // Draw Rest Placeholder (Rect)
                            svgContent += `<rect x="${currentX + 10}" y="${currentY + 20}" width="10" height="20" fill="#666" />\n`;
                            currentX += 30;
                        } else if (item.type === 'tuplet' || item.type === 'grace') {
                            // Recursive naive rendering
                            item.content.forEach((subItem: any) => {
                                if (subItem.notes && subItem.notes.length > 0) {
                                    const note = subItem.notes[0];
                                    const cy = this.calculateY(note, currentY);
                                    // Draw Small Note Head
                                    svgContent += `<circle cx="${currentX + 10}" cy="${cy}" r="${this.config.noteRadius * 0.7}" fill="black" />\n`;
                                    currentX += 20;
                                }
                            });
                        }
                    });
                }

                // Measure spacing
                currentX += 20;

                // Draw Barline (End of measure)
                svgContent += `<line x1="${currentX}" y1="${currentY}" x2="${currentX}" y2="${currentY + 4 * this.config.lineSpacing}" stroke="black" stroke-width="1" />\n`;
            });

            // Move down for next part
            currentY += 150;
        });

        return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.config.staveWidth + 100}" height="${currentY}">
            ${svgContent}
        </svg>`;
    }

    // Helper: Map pitch to Y position
    // C4 (Middle C) is usually on the first ledger line below staff (index 6 from top line?)
    // Let's assume Top Line (index 0) is F5 (Treble Clef)
    // E5, D5, C5, B4, A4, G4, F4, E4, D4, C4 ...
    private calculateY(note: Note, staffTopY: number): number {
        if (!note.pitch) return staffTopY + 20; // Default center if no pitch

        const stepMap: Record<string, number> = { "C": 0, "D": 1, "E": 2, "F": 3, "G": 4, "A": 5, "B": 6 };

        // Treble Clef Reference: G4 is on the 2nd line from bottom (index 3 from top? 0=F5, 1=D5, 2=B4, 3=G4, 4=E4)
        // Let's define specific line Ys:
        // Line 0: F5
        // Line 1: D5
        // Line 2: B4
        // Line 3: G4
        // Line 4: E4

        // We use a "Step Index" relative to G4 (which is at index 6 in internal steps? 5 lines * 2 spaces = 10 slots)
        // Let's create an absolute scalar value for pitch: C4 = 0
        const absoluteStep = (note.pitch.octave * 7) + stepMap[note.pitch.step];
        const g4Step = (4 * 7) + 4; // 32

        // Difference in diatonic steps
        const diff = absoluteStep - g4Step;

        // G4 is at Line 3 (index 3 from 0..4). Y = staffTopY + 3 * lineSpacing
        const g4Y = staffTopY + (3 * this.config.lineSpacing);

        // Each step up = -0.5 * lineSpacing
        return g4Y - (diff * (this.config.lineSpacing / 2));
    }
}
