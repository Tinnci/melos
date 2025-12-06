import type { Score, Part, MeasureRhythmicPosition, Note, Event } from "@melos/core";

export class Renderer {
    private config = {
        staveWidth: 800,
        staveHeight: 100,
        lineSpacing: 10,
        paddingX: 20,
        paddingY: 40,
        noteRadius: 5,
        stemLength: 35
    };

    /**
     * Renders a Score object to an SVG string.
     */
    render(score: Score): string {
        let svgContent = "";
        let currentY = this.config.paddingY;

        score.parts.forEach((part, pIndex) => {
            // Render Part Name
            svgContent += `<text x="${this.config.paddingX}" y="${currentY - 20}" font-family="Arial" font-size="14">${part.name || part.id}</text>\n`;

            // Draw Stave Lines (5 lines)
            for (let i = 0; i < 5; i++) {
                const y = currentY + (i * this.config.lineSpacing);
                svgContent += `<line x1="${this.config.paddingX}" y1="${y}" x2="${this.config.staveWidth + this.config.paddingX}" y2="${y}" stroke="black" stroke-width="1" />\n`;
            }

            let currentX = this.config.paddingX + 20;

            part.measures.forEach((measure) => {
                // Draw Barline (Start)
                svgContent += `<line x1="${currentX}" y1="${currentY}" x2="${currentX}" y2="${currentY + 4 * this.config.lineSpacing}" stroke="black" stroke-width="1" />\n`;

                const voice = measure.sequences[0];
                if (voice) {
                    voice.content.forEach((item: any) => {
                        if (item.notes && item.notes.length > 0) {
                            const duration = item.duration?.base || "quarter";
                            svgContent += this.renderChord(currentX + 15, item.notes, duration, currentY);
                            currentX += this.getNoteWidth(duration);

                        } else if (item.rest) {
                            const duration = item.duration?.base || "quarter";
                            svgContent += this.renderRest(currentX + 10, currentY, duration);
                            currentX += this.getNoteWidth(duration);

                        } else if (item.type === 'tuplet' || item.type === 'grace') {
                            item.content.forEach((subItem: any) => {
                                if (subItem.notes && subItem.notes.length > 0) {
                                    const duration = subItem.duration?.base || "eighth";
                                    svgContent += this.renderChord(currentX + 10, subItem.notes, duration, currentY, 0.7);
                                    currentX += 20;
                                }
                            });
                        }
                    });
                }

                currentX += 20;
                svgContent += `<line x1="${currentX}" y1="${currentY}" x2="${currentX}" y2="${currentY + 4 * this.config.lineSpacing}" stroke="black" stroke-width="1" />\n`;
            });

            currentY += 150;
        });

        return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.config.staveWidth + 100}" height="${currentY}">
            ${svgContent}
        </svg>`;
    }

    /**
     * Render a chord (one or more notes with a shared stem).
     */
    private renderChord(cx: number, notes: Note[], duration: string, staffTopY: number, scale: number = 1): string {
        let svg = "";
        const r = this.config.noteRadius * scale;

        // Calculate Y positions for all notes
        const noteYs = notes.map(n => this.calculateY(n, staffTopY));
        const minY = Math.min(...noteYs);
        const maxY = Math.max(...noteYs);

        // Determine stem direction based on the note furthest from middle line
        const middleLineY = staffTopY + 2 * this.config.lineSpacing;
        const topDistance = Math.abs(minY - middleLineY);
        const bottomDistance = Math.abs(maxY - middleLineY);
        const stemUp = bottomDistance >= topDistance;

        // Draw all note heads
        notes.forEach((note, i) => {
            const cy = noteYs[i];
            svg += this.renderNoteHead(cx, cy, duration, r);
            svg += this.renderLedgerLines(cx, cy, staffTopY);
        });

        // Draw shared stem (if not a whole note)
        if (duration !== "whole") {
            svg += this.renderChordStem(cx, minY, maxY, r, stemUp, scale);

            // Flags (only for single notes or chord extremity)
            if (duration === "eighth" || duration === "16th" || duration === "32nd") {
                const flagY = stemUp ? minY : maxY;
                svg += this.renderFlag(cx, flagY, r, stemUp, duration, scale);
            }
        }

        return svg;
    }

    /**
     * Render just the note head (shape depends on duration).
     */
    private renderNoteHead(cx: number, cy: number, duration: string, r: number): string {
        if (duration === "whole") {
            return `<ellipse cx="${cx}" cy="${cy}" rx="${r * 1.3}" ry="${r}" fill="none" stroke="black" stroke-width="1.5" />\n`;
        } else if (duration === "half") {
            return `<ellipse cx="${cx}" cy="${cy}" rx="${r * 1.1}" ry="${r * 0.9}" fill="none" stroke="black" stroke-width="1.5" />\n`;
        } else {
            return `<ellipse cx="${cx}" cy="${cy}" rx="${r * 1.1}" ry="${r * 0.9}" fill="black" />\n`;
        }
    }

    /**
     * Render stem for a chord (spans from lowest to highest note).
     */
    private renderChordStem(cx: number, minY: number, maxY: number, r: number, stemUp: boolean, scale: number): string {
        const stemLen = this.config.stemLength * scale;
        if (stemUp) {
            const x = cx + r;
            const stemTop = minY - stemLen;
            return `<line x1="${x}" y1="${maxY}" x2="${x}" y2="${stemTop}" stroke="black" stroke-width="1" />\n`;
        } else {
            const x = cx - r;
            const stemBottom = maxY + stemLen;
            return `<line x1="${x}" y1="${minY}" x2="${x}" y2="${stemBottom}" stroke="black" stroke-width="1" />\n`;
        }
    }

    /**
     * Legacy single-note render (kept for compatibility, now delegates to renderChord).
     */
    private renderNote(cx: number, cy: number, duration: string, note: Note, staffTopY: number, scale: number = 1): string {
        return this.renderChord(cx, [note], duration, staffTopY, scale);
    }

    /**
     * Render note stem.
     */
    private renderStem(cx: number, cy: number, r: number, stemUp: boolean, scale: number): string {
        const stemLen = this.config.stemLength * scale;
        if (stemUp) {
            const x = cx + r;
            return `<line x1="${x}" y1="${cy}" x2="${x}" y2="${cy - stemLen}" stroke="black" stroke-width="1" />\n`;
        } else {
            const x = cx - r;
            return `<line x1="${x}" y1="${cy}" x2="${x}" y2="${cy + stemLen}" stroke="black" stroke-width="1" />\n`;
        }
    }

    /**
     * Render flag for eighth notes and shorter.
     */
    private renderFlag(cx: number, cy: number, r: number, stemUp: boolean, duration: string, scale: number): string {
        const stemLen = this.config.stemLength * scale;
        const numFlags = duration === "eighth" ? 1 : duration === "16th" ? 2 : 3;
        let svg = "";

        for (let i = 0; i < numFlags; i++) {
            const flagOffset = i * 6;
            if (stemUp) {
                const x = cx + r;
                const flagY = cy - stemLen + flagOffset;
                svg += `<path d="M${x},${flagY} Q${x + 10},${flagY + 8} ${x + 5},${flagY + 15}" fill="none" stroke="black" stroke-width="1.5" />\n`;
            } else {
                const x = cx - r;
                const flagY = cy + stemLen - flagOffset;
                svg += `<path d="M${x},${flagY} Q${x - 10},${flagY - 8} ${x - 5},${flagY - 15}" fill="none" stroke="black" stroke-width="1.5" />\n`;
            }
        }
        return svg;
    }

    /**
     * Render ledger lines for notes outside the staff.
     */
    private renderLedgerLines(cx: number, cy: number, staffTopY: number): string {
        let svg = "";
        const topLine = staffTopY;
        const bottomLine = staffTopY + 4 * this.config.lineSpacing;
        const ledgerWidth = this.config.noteRadius * 2.5;

        // Above staff
        if (cy < topLine) {
            for (let y = topLine - this.config.lineSpacing; y >= cy - this.config.lineSpacing / 2; y -= this.config.lineSpacing) {
                svg += `<line x1="${cx - ledgerWidth}" y1="${y}" x2="${cx + ledgerWidth}" y2="${y}" stroke="black" stroke-width="1" />\n`;
            }
        }

        // Below staff
        if (cy > bottomLine) {
            for (let y = bottomLine + this.config.lineSpacing; y <= cy + this.config.lineSpacing / 2; y += this.config.lineSpacing) {
                svg += `<line x1="${cx - ledgerWidth}" y1="${y}" x2="${cx + ledgerWidth}" y2="${y}" stroke="black" stroke-width="1" />\n`;
            }
        }

        return svg;
    }

    /**
     * Render rest symbols.
     */
    private renderRest(x: number, staffTopY: number, duration: string): string {
        const centerY = staffTopY + 2 * this.config.lineSpacing;

        if (duration === "whole") {
            // Thick bar hanging from line 2
            return `<rect x="${x}" y="${staffTopY + this.config.lineSpacing}" width="12" height="5" fill="black" />\n`;
        } else if (duration === "half") {
            // Thick bar sitting on line 3
            return `<rect x="${x}" y="${staffTopY + 2 * this.config.lineSpacing - 5}" width="12" height="5" fill="black" />\n`;
        } else if (duration === "quarter") {
            // Simplified Z-like shape
            return `<path d="M${x},${centerY - 10} L${x + 8},${centerY} L${x},${centerY + 10}" fill="none" stroke="black" stroke-width="2" />\n`;
        } else {
            // Eighth and shorter: dot with flag
            return `<circle cx="${x + 5}" cy="${centerY}" r="3" fill="black" />\n`;
        }
    }

    /**
     * Get horizontal spacing for a note based on duration.
     */
    private getNoteWidth(duration: string): number {
        switch (duration) {
            case "whole": return 60;
            case "half": return 45;
            case "quarter": return 35;
            case "eighth": return 25;
            default: return 20;
        }
    }

    /**
     * Calculate Y position for a note based on pitch.
     */
    private calculateY(note: Note, staffTopY: number): number {
        if (!note.pitch) return staffTopY + 20;

        const stepMap: Record<string, number> = { "C": 0, "D": 1, "E": 2, "F": 3, "G": 4, "A": 5, "B": 6 };
        const absoluteStep = (note.pitch.octave * 7) + stepMap[note.pitch.step];
        const g4Step = (4 * 7) + 4; // G4 = 32
        const diff = absoluteStep - g4Step;
        const g4Y = staffTopY + (3 * this.config.lineSpacing);

        return g4Y - (diff * (this.config.lineSpacing / 2));
    }
}

