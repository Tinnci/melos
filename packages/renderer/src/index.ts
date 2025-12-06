import type { Score, Part, MeasureRhythmicPosition, Note, Event } from "@melos/core";

// SMuFL G-Clef path extracted from Bravura font (uniE050)
// Original glyph designed at 1000 units per em, roughly 4 spaces high.
const GCLEF_PATH = "M376 415l25 -145c3 -18 3 -18 29 -18c147 0 241 -113 241 -241c0 -113 -67 -198 -168 -238c-14 -6 -15 -5 -13 -17c11 -62 29 -157 29 -214c0 -170 -130 -200 -197 -200c-151 0 -190 98 -190 163c0 62 40 115 107 115c61 0 96 -47 96 -102c0 -58 -36 -85 -67 -94c-23 -7 -32 -10 -32 -17c0 -13 26 -29 80 -29c59 0 159 18 159 166c0 47 -15 134 -27 201c-2 12 -4 11 -15 9c-20 -4 -46 -6 -69 -6c-245 0 -364 165 -364 339c0 202 153 345 297 464c12 10 11 12 9 24c-7 41 -14 106 -14 164c0 104 24 229 98 311c20 22 51 48 65 48c11 0 37 -28 52 -50c41 -60 65 -146 65 -233c0 -153 -82 -280 -190 -381c-6 -6 -8 -7 -6 -19zM470 943c-61 0 -133 -96 -133 -252c0 -32 2 -66 6 -92c2 -13 6 -14 13 -8c79 69 174 159 174 270c0 55 -27 82 -60 82zM361 262l-21 128c-2 11 -4 12 -14 4c-47 -38 -93 -75 -153 -142c-83 -94 -93 -173 -93 -232c0 -139 113 -236 288 -236c20 0 40 2 56 5c15 3 16 3 14 14l-50 298c-2 11 -4 12 -20 8c-61 -17 -100 -60 -100 -117c0 -46 30 -89 72 -107c7 -3 15 -6 15 -13c0 -6 -4 -11 -12 -11c-7 0 -19 3 -27 6c-68 23 -115 87 -115 177c0 85 57 164 145 194c18 6 18 5 15 24zM430 103l49 -285c2 -12 4 -12 16 -6c56 28 94 79 94 142c0 88 -67 156 -148 163c-12 1 -13 -2 -11 -14z";

export class Renderer {
    private config = {
        pageWidth: 800,          // Maximum width before wrapping
        lineSpacing: 10,         // Space between staff lines
        systemSpacing: 100,      // Space between systems (rows)
        paddingX: 40,            // Left/right padding
        paddingY: 50,            // Top padding
        measurePadding: 15,      // Padding inside each measure
        clefWidth: 40,           // Width reserved for clef
        noteRadius: 5,
        stemLength: 35
    };

    /**
     * Renders a Score object to an SVG string with automatic system wrapping.
     */
    render(score: Score): string {
        let svgContent = "";
        let currentY = this.config.paddingY;
        let maxX = 0;

        score.parts.forEach((part, pIndex) => {
            // Track current position
            let currentX = this.config.paddingX;
            let systemStartY = currentY;
            let isNewSystem = true;

            // Render Part Name (only on first system)
            svgContent += `<text x="${this.config.paddingX}" y="${currentY - 15}" font-family="Arial" font-size="14">${part.name || part.id}</text>\n`;

            part.measures.forEach((measure, mIndex) => {
                // --- 1. Calculate measure width ---
                const measureWidth = this.calculateMeasureWidth(measure);

                // --- 2. Check if we need to wrap to next system ---
                if (currentX + measureWidth > this.config.pageWidth + this.config.paddingX && !isNewSystem) {
                    // Finish current system's stave lines
                    svgContent += this.renderStaveLines(this.config.paddingX, systemStartY, currentX - this.config.paddingX);

                    // Move to next system
                    currentX = this.config.paddingX;
                    currentY += this.config.systemSpacing;
                    systemStartY = currentY;
                    isNewSystem = true;
                }

                // --- 3. Draw Clef if new system ---
                if (isNewSystem) {
                    // Draw clef at start of system
                    // Position relative to staff BOTTOM line (baseline for SMuFL)
                    // Staff height = 40 (4 * 10)
                    // currentY is TOP line. So Bottom line is currentY + 40.
                    // We render at TOP line + 30 (G line) for visual center adjustment
                    svgContent += this.renderClef(currentX + 10, currentY + 30);
                    currentX += this.config.clefWidth;
                }

                // --- 4. Draw barline at start of measure ---
                svgContent += this.renderBarline(currentX, currentY);

                isNewSystem = false;

                // --- 5. Render measure content ---
                let noteX = currentX + this.config.measurePadding;

                const voice = measure.sequences[0];
                if (voice) {
                    voice.content.forEach((item: any) => {
                        if (item.notes && item.notes.length > 0) {
                            const duration = item.duration?.base || "quarter";
                            svgContent += this.renderChord(noteX, item.notes, duration, currentY);
                            noteX += this.getNoteWidth(duration);

                        } else if (item.rest) {
                            const duration = item.duration?.base || "quarter";
                            svgContent += this.renderRest(noteX, currentY, duration);
                            noteX += this.getNoteWidth(duration);

                        } else if (item.type === 'tuplet' || item.type === 'grace') {
                            item.content.forEach((subItem: any) => {
                                if (subItem.notes && subItem.notes.length > 0) {
                                    const duration = subItem.duration?.base || "eighth";
                                    svgContent += this.renderChord(noteX, subItem.notes, duration, currentY, 0.7);
                                    noteX += 20;
                                }
                            });
                        }
                    });
                }

                // --- 6. Advance X position ---
                currentX += measureWidth;
                if (currentX > maxX) maxX = currentX;

                // --- 7. Draw ending barline ---
                svgContent += this.renderBarline(currentX, currentY);
            });

            // Draw stave lines for the last system
            svgContent += this.renderStaveLines(this.config.paddingX, systemStartY, currentX - this.config.paddingX);

            // Move down for next part
            currentY += this.config.systemSpacing;
        });

        // Calculate final SVG dimensions
        const svgWidth = Math.max(maxX + this.config.paddingX, this.config.pageWidth + this.config.paddingX * 2);
        const svgHeight = currentY + 20;

        return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}">
            ${svgContent}
        </svg>`;
    }

    /**
     * Render G-Clef at specific position.
     */
    private renderClef(x: number, y: number): string {
        // Scale factor for Bravura (1000 units = 4 spaces = 40px)
        const scale = 0.04;

        return `<g transform="translate(${x}, ${y}) scale(${scale})">
            <path d="${GCLEF_PATH}" fill="black" />
        </g>\n`;
    }

    /**
     * Calculate the width needed for a measure based on its content.
     */
    private calculateMeasureWidth(measure: any): number {
        let width = this.config.measurePadding * 2; // Start/end padding

        const voice = measure.sequences[0];
        if (voice) {
            voice.content.forEach((item: any) => {
                if (item.notes && item.notes.length > 0) {
                    width += this.getNoteWidth(item.duration?.base || "quarter");
                } else if (item.rest) {
                    width += this.getNoteWidth(item.duration?.base || "quarter");
                } else if (item.type === 'tuplet' || item.type === 'grace') {
                    item.content.forEach(() => { width += 20; });
                }
            });
        }

        return Math.max(width, 60); // Minimum width
    }

    /**
     * Render 5 staff lines for a system segment.
     */
    private renderStaveLines(startX: number, y: number, length: number): string {
        let svg = "";
        for (let i = 0; i < 5; i++) {
            const lineY = y + (i * this.config.lineSpacing);
            svg += `<line x1="${startX}" y1="${lineY}" x2="${startX + length}" y2="${lineY}" stroke="black" stroke-width="1" />\n`;
        }
        return svg;
    }

    /**
     * Render a barline at specified position.
     */
    private renderBarline(x: number, y: number): string {
        return `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 4 * this.config.lineSpacing}" stroke="black" stroke-width="1" />\n`;
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
