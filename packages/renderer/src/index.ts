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

        // Global position registry for deferred Tie/Slur rendering
        const globalPositions: Map<string, { x: number, y: number, stemUp: boolean }> = new Map();
        const curveRequests: Array<{ type: 'tie' | 'slur', sourceId: string, targetId: string, side?: string }> = [];

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

                // --- 3. Draw Clef, Key, Time if new system or changes ---
                if (isNewSystem) {
                    // Draw clef at start of system
                    svgContent += this.renderClef(currentX + 10, currentY + 40);
                    currentX += this.config.clefWidth;

                    // Draw Key Signature (Initial only for now, can be expanded)
                    // TODO: Get actual key from Measure 1 attributes if available
                    // For demo, we'll check the first measure's attributes if they match our internal structure
                    // The core type definition isn't fully visible, but we can try to access sensible defaults
                    // or just placeholder for now if data is missing.
                    // Actually, let's check the first measure for attributes.
                    const firstMeasure = part.measures[0] as any;
                    const initialKey = firstMeasure?.attributes?.key;
                    if (initialKey) {
                        const keyWidth = this.renderKeySignature(currentX, currentY, initialKey);
                        svgContent += keyWidth.svg;
                        currentX += keyWidth.width;
                    }

                    // Draw Time Signature
                    const initialTime = firstMeasure?.attributes?.time;
                    if (initialTime) {
                        const timeWidth = this.renderTimeSignature(currentX, currentY, initialTime);
                        svgContent += timeWidth.svg;
                        currentX += timeWidth.width;
                    }
                }

                // --- 4. Draw barline at start of measure ---
                svgContent += this.renderBarline(currentX, currentY);

                isNewSystem = false;

                // --- 5. Render measure content ---
                let noteX = currentX + this.config.measurePadding;

                // Beam data collection: eventId -> position info
                const eventPositions: Map<string, { x: number, stemTipY: number, stemUp: boolean }> = new Map();
                // Determine which events are beamed
                const beamedEventIds: Set<string> = new Set();
                if (measure.beams) {
                    for (const beam of measure.beams) {
                        for (const eventId of beam.events) {
                            beamedEventIds.add(eventId);
                        }
                    }
                }

                // --- 5a. Check for Multimeasure Rest ---
                if ((measure as any).multimeasureRest) {
                    const mmRest = (measure as any).multimeasureRest;
                    svgContent += this.renderMultimeasureRest(
                        currentX + this.config.measurePadding,
                        currentX + measureWidth - this.config.measurePadding,
                        currentY,
                        mmRest.duration
                    );
                    // Skip regular note content rendering for this measure
                } else {
                    // --- 5b. Render regular measure content ---
                    const voice = measure.sequences[0];
                    if (voice) {
                        voice.content.forEach((item: any) => {
                            if (item.notes && item.notes.length > 0) {
                                const duration = item.duration?.base || "quarter";
                                const eventId = item.id || `event-${noteX}`; // Use item.id if available
                                const isBeamed = beamedEventIds.has(eventId);

                                // Render the chord, passing beam info
                                const chordResult = this.renderChordWithLayout(
                                    noteX, item.notes, duration, currentY, 1, isBeamed
                                );
                                svgContent += chordResult.svg;

                                // Store position for beam drawing
                                if (isBeamed && chordResult.layout) {
                                    eventPositions.set(eventId, chordResult.layout);
                                }

                                // Register position for Tie/Slur (global)
                                if (chordResult.layout) {
                                    // Approximate note head Y position
                                    const noteHeadY = chordResult.layout.stemUp
                                        ? chordResult.layout.stemTipY + this.config.stemLength
                                        : chordResult.layout.stemTipY - this.config.stemLength;
                                    globalPositions.set(eventId, {
                                        x: noteX,
                                        y: noteHeadY,
                                        stemUp: chordResult.layout.stemUp
                                    });
                                }

                                // Collect Slur requests from event
                                if (item.slurs && Array.isArray(item.slurs)) {
                                    for (const slur of item.slurs) {
                                        if (slur.target) {
                                            curveRequests.push({
                                                type: 'slur',
                                                sourceId: eventId,
                                                targetId: slur.target,
                                                side: slur.side || 'up'
                                            });
                                        }
                                    }
                                }

                                // Collect Tie requests from notes
                                for (const note of item.notes) {
                                    if (note.ties && Array.isArray(note.ties)) {
                                        for (const tie of note.ties) {
                                            if (tie.target) {
                                                curveRequests.push({
                                                    type: 'tie',
                                                    sourceId: note.id || eventId,
                                                    targetId: tie.target,
                                                    side: 'auto'
                                                });
                                            }
                                        }
                                    }
                                }

                                // [NEW] Render Tremolo slashes
                                if (item.tremolo && chordResult.layout) {
                                    svgContent += this.renderTremolo(
                                        noteX,
                                        chordResult.layout.stemTipY,
                                        chordResult.layout.stemUp,
                                        item.tremolo
                                    );
                                }

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

                    // --- 5c. Render Beams ---
                    if (measure.beams && eventPositions.size > 0) {
                        for (const beam of measure.beams) {
                            svgContent += this.renderBeam(beam.events, eventPositions);
                        }
                    }

                    // --- 5d. Render Ottavas (8va, 8vb, etc.) ---
                    if ((measure as any).ottavas) {
                        for (const ottava of (measure as any).ottavas) {
                            // Simplified: render ottava spanning the measure where it starts
                            const startX = currentX + this.config.measurePadding;
                            const endX = currentX + measureWidth - this.config.measurePadding;
                            svgContent += this.renderOttava(startX, endX, currentY, ottava.value);
                        }
                    }
                } // End of else block (regular measure rendering)

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

        // --- 8. Render Ties and Slurs (Deferred) ---
        for (const req of curveRequests) {
            const sourcePos = globalPositions.get(req.sourceId);
            const targetPos = globalPositions.get(req.targetId);
            if (sourcePos && targetPos) {
                svgContent += this.renderCurve(sourcePos, targetPos, req.type, req.side);
            }
        }

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

    private renderKeySignature(x: number, y: number, key: any): { svg: string, width: number } {
        // key: { fifths: number }
        // fifths > 0: Sharps, fifths < 0: Flats
        let svg = "";
        let width = 0;
        const fifths = key.fifths || 0;
        const spacing = 12;

        if (fifths === 0) return { svg: "", width: 10 }; // Just padding

        // Treble Clef Sharp Positions (F, C, G, D, A, E, B)
        // Y coords relative to staffTopY.
        // Top line F5 = y.
        // Sharp F5: on line.
        // F5(0), C5(30), G5(0-? G5 is space above F5? No. G5 is above F5.)
        // Lines: E4(40), G4(30), B4(20), D5(10), F5(0)

        // Sharps pattern: F(0), C(15), G(-5 ?), D(10), A(25), E(5), B(20)
        // Wait, standard positions:
        // F# (Tip line 5): y=0.
        // C# (Space 3): y=15.
        // G# (Space above staff): y=-5.
        // D# (Line 4): y=10.
        // A# (Space 2): y=25.
        // E# (Space 4): y=5.
        // B# (Line 3): y=20.
        const sharpYs = [0, 15, -5, 10, 25, 5, 20];

        // Flats pattern: B, E, A, D, G, C, F
        // B(20), E(5), A(25), D(10), G(30), C(15), F(35)
        const flatYs = [20, 5, 25, 10, 30, 15, 35];

        const symbol = fifths > 0 ? "♯" : "♭";
        const positions = fifths > 0 ? sharpYs : flatYs;
        const count = Math.abs(fifths);

        for (let i = 0; i < count; i++) {
            const symbolY = y + positions[i] + (fifths > 0 ? 5 : 5); // Adjustment for text centering
            svg += `<text x="${x + (i * spacing)}" y="${symbolY}" font-family="Times New Roman" font-size="20">${symbol}</text>\n`;
        }

        width = (count * spacing) + 10;
        return { svg, width };
    }

    private renderTimeSignature(x: number, y: number, time: any): { svg: string, width: number } {
        // time: { beats: number, beat-type: number }
        const beats = time.beats;
        const type = time["beat-type"];

        // Render as two numbers stacked
        // Top number centered in top 2 spaces (y to y+20)
        // Bottom number centered in bottom 2 spaces (y+20 to y+40)

        // Font adjustment
        const fontSize = 32; // Covers 2 spaces roughly
        const charX = x + 10;

        return {
            svg: `
            <text x="${charX}" y="${y + 18}" font-family="Times New Roman" font-weight="bold" font-size="${fontSize}" text-anchor="middle">${beats}</text>
            <text x="${charX}" y="${y + 38}" font-family="Times New Roman" font-weight="bold" font-size="${fontSize}" text-anchor="middle">${type}</text>
            `,
            width: 30
        };
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
     * Handles second interval collisions by offsetting note heads.
     */
    private renderChord(cx: number, notes: Note[], duration: string, staffTopY: number, scale: number = 1): string {
        let svg = "";
        const r = this.config.noteRadius * scale;
        const halfSpace = this.config.lineSpacing / 2; // Distance for a second interval

        // Calculate Y positions for all notes and sort by pitch (highest first = lowest Y)
        const noteData = notes.map((n, i) => ({
            note: n,
            y: this.calculateY(n, staffTopY),
            originalIndex: i,
            offsetX: 0 // Will be set if collision detected
        }));

        // Sort by Y position (ascending = top to bottom on staff)
        noteData.sort((a, b) => a.y - b.y);

        const minY = noteData[0].y;
        const maxY = noteData[noteData.length - 1].y;

        // Determine stem direction based on the note furthest from middle line
        const middleLineY = staffTopY + 2 * this.config.lineSpacing;
        const topDistance = Math.abs(minY - middleLineY);
        const bottomDistance = Math.abs(maxY - middleLineY);
        const stemUp = bottomDistance >= topDistance;

        // --- Second Interval Collision Detection ---
        // When stem is UP: offset notes go to the LEFT of the stem (cx - offset)
        // When stem is DOWN: offset notes go to the RIGHT of the stem (cx + offset)
        // For seconds, we alternate which note gets offset.
        // Standard rule: in a second, the HIGHER note (lower Y) goes on the stem side,
        // the LOWER note (higher Y) goes on the opposite side.
        // When stem up: stem is on right, so lower note of second goes LEFT.
        // When stem down: stem is on left, so lower note of second goes RIGHT.

        const noteHeadWidth = r * 2.2; // Approximate width for offset

        for (let i = 1; i < noteData.length; i++) {
            const prevY = noteData[i - 1].y;
            const currY = noteData[i].y;
            const interval = currY - prevY; // Positive means curr is lower on staff

            // Check for second (interval ~= halfSpace, i.e., 5px with default config)
            if (Math.abs(interval - halfSpace) < 2) {
                // It's a second! Offset one of them.
                if (stemUp) {
                    // Stem on right. Lower note (curr) goes LEFT.
                    noteData[i].offsetX = -noteHeadWidth;
                } else {
                    // Stem on left. Lower note (curr) goes RIGHT.
                    noteData[i].offsetX = noteHeadWidth;
                }
            }
        }

        // Draw all note heads with potential offsets
        noteData.forEach((nd) => {
            const noteX = cx + nd.offsetX;
            svg += this.renderNoteHead(noteX, nd.y, duration, r);
            svg += this.renderLedgerLines(noteX, nd.y, staffTopY);
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
     * Render a chord and return both SVG and layout info for beam calculations.
     * Similar to renderChord but also returns stem position data.
     */
    private renderChordWithLayout(
        cx: number,
        notes: Note[],
        duration: string,
        staffTopY: number,
        scale: number = 1,
        isBeamed: boolean = false
    ): { svg: string, layout?: { x: number, stemTipY: number, stemUp: boolean } } {
        let svg = "";
        const r = this.config.noteRadius * scale;
        const halfSpace = this.config.lineSpacing / 2;

        // Calculate Y positions for all notes and sort by pitch
        const noteData = notes.map((n, i) => ({
            note: n,
            y: this.calculateY(n, staffTopY),
            originalIndex: i,
            offsetX: 0
        }));
        noteData.sort((a, b) => a.y - b.y);

        const minY = noteData[0].y;
        const maxY = noteData[noteData.length - 1].y;

        // Determine stem direction
        const middleLineY = staffTopY + 2 * this.config.lineSpacing;
        const topDistance = Math.abs(minY - middleLineY);
        const bottomDistance = Math.abs(maxY - middleLineY);
        const stemUp = bottomDistance >= topDistance;

        // Second interval collision detection
        const noteHeadWidth = r * 2.2;
        for (let i = 1; i < noteData.length; i++) {
            const interval = noteData[i].y - noteData[i - 1].y;
            if (Math.abs(interval - halfSpace) < 2) {
                noteData[i].offsetX = stemUp ? -noteHeadWidth : noteHeadWidth;
            }
        }

        // Draw all note heads
        noteData.forEach((nd) => {
            const noteX = cx + nd.offsetX;
            svg += this.renderNoteHead(noteX, nd.y, duration, r);
            svg += this.renderLedgerLines(noteX, nd.y, staffTopY);
        });

        let layout: { x: number, stemTipY: number, stemUp: boolean } | undefined;

        // Draw stem (if not a whole note)
        if (duration !== "whole") {
            const stemLen = this.config.stemLength * scale;
            const stemX = stemUp ? cx + r : cx - r;
            const stemTipY = stemUp ? (minY - stemLen) : (maxY + stemLen);

            svg += this.renderChordStem(cx, minY, maxY, r, stemUp, scale);

            // Store layout for beam
            layout = { x: stemX, stemTipY, stemUp };

            // Flags (only if NOT beamed)
            if (!isBeamed && (duration === "eighth" || duration === "16th" || duration === "32nd")) {
                const flagY = stemUp ? minY : maxY;
                svg += this.renderFlag(cx, flagY, r, stemUp, duration, scale);
            }
        }

        return { svg, layout };
    }

    /**
     * Render a beam connecting multiple events.
     * Uses a simple flat/sloped beam algorithm.
     */
    private renderBeam(
        eventIds: string[],
        eventPositions: Map<string, { x: number, stemTipY: number, stemUp: boolean }>
    ): string {
        if (eventIds.length < 2) return "";

        // Gather positions for all events in this beam
        const positions: Array<{ x: number, y: number }> = [];
        let stemUp = true; // Default

        for (const eventId of eventIds) {
            const pos = eventPositions.get(eventId);
            if (pos) {
                positions.push({ x: pos.x, y: pos.stemTipY });
                stemUp = pos.stemUp; // Use the last known direction
            }
        }

        if (positions.length < 2) return "";

        // Simple beam: connect first and last stem tips with a thick line
        const first = positions[0];
        const last = positions[positions.length - 1];

        // Beam thickness
        const beamHeight = 5;

        // Calculate slope
        const dx = last.x - first.x;
        const dy = last.y - first.y;

        // For a simple implementation, we'll use a polygon for the beam
        // The beam is a parallelogram following the slope
        let svg = "";

        // Primary beam (8th notes)
        const y1 = first.y;
        const y2 = last.y;
        const offsetY = stemUp ? beamHeight : -beamHeight;

        svg += `<polygon points="${first.x},${y1} ${last.x},${y2} ${last.x},${y2 + offsetY} ${first.x},${y1 + offsetY}" fill="black" />\n`;

        return svg;
    }

    /**
     * Render a curved line (Tie or Slur) between two positions using a quadratic Bezier curve.
     */
    private renderCurve(
        source: { x: number, y: number, stemUp: boolean },
        target: { x: number, y: number, stemUp: boolean },
        type: 'tie' | 'slur',
        side?: string
    ): string {
        // Determine curve direction (up or down)
        // For ties: usually opposite to stem direction
        // For slurs: based on 'side' parameter or stem direction
        let curveUp = !source.stemUp; // Default: curve opposite to stem

        if (side === 'up') curveUp = true;
        else if (side === 'down') curveUp = false;

        // Calculate control point for Bezier curve
        const midX = (source.x + target.x) / 2;
        const midY = (source.y + target.y) / 2;

        // Curve height (how much it arcs)
        const curveHeight = type === 'tie' ? 12 : 18; // Slurs are typically more arched
        const controlY = curveUp ? midY - curveHeight : midY + curveHeight;

        // Offset source and target Y slightly based on curve direction
        const yOffset = curveUp ? -3 : 3;
        const startY = source.y + yOffset;
        const endY = target.y + yOffset;

        // Draw as a quadratic Bezier curve (Q command)
        // For a thicker appearance, we draw two paths (outline effect)
        const strokeWidth = type === 'tie' ? 2 : 2.5;

        return `<path d="M${source.x},${startY} Q${midX},${controlY} ${target.x},${endY}" 
                fill="none" stroke="black" stroke-width="${strokeWidth}" stroke-linecap="round" />\n`;
    }

    /**
     * Render an Ottava (8va, 8vb, 15ma, etc.) line.
     * value: 1 = 8va, -1 = 8vb, 2 = 15ma, -2 = 15mb, 3 = 22ma, -3 = 22mb
     */
    private renderOttava(startX: number, endX: number, staffTopY: number, value: number): string {
        // Determine label and position
        let label: string;
        let above: boolean;

        switch (value) {
            case 1: label = "8va"; above = true; break;
            case -1: label = "8vb"; above = false; break;
            case 2: label = "15ma"; above = true; break;
            case -2: label = "15mb"; above = false; break;
            case 3: label = "22ma"; above = true; break;
            case -3: label = "22mb"; above = false; break;
            default: label = "8va"; above = true;
        }

        // Calculate Y position (above or below staff)
        const staffBottom = staffTopY + 4 * this.config.lineSpacing;
        const lineY = above ? staffTopY - 20 : staffBottom + 20;
        const textY = above ? lineY - 5 : lineY + 15;

        // Draw label text
        let svg = `<text x="${startX}" y="${textY}" font-family="Times New Roman" font-style="italic" font-size="12">${label}</text>\n`;

        // Draw dashed line from after text to endX
        const lineStartX = startX + 25; // After the text
        svg += `<line x1="${lineStartX}" y1="${lineY}" x2="${endX}" y2="${lineY}" stroke="black" stroke-width="1" stroke-dasharray="4,3" />\n`;

        // Draw hook at the end (vertical line going toward the staff)
        const hookLength = above ? 8 : -8;
        svg += `<line x1="${endX}" y1="${lineY}" x2="${endX}" y2="${lineY + hookLength}" stroke="black" stroke-width="1" />\n`;

        return svg;
    }

    /**
     * Render a Multimeasure Rest (consolidated rest spanning multiple measures).
     * Displays as a thick horizontal line with two vertical brackets and a number above.
     */
    private renderMultimeasureRest(startX: number, endX: number, staffTopY: number, duration: number): string {
        // Position: centered vertically on staff (between lines 2 and 4)
        const centerY = staffTopY + 2 * this.config.lineSpacing;
        const restWidth = endX - startX;

        // Thick horizontal line (the rest symbol)
        const lineHeight = 8;
        let svg = `<rect x="${startX}" y="${centerY - lineHeight / 2}" width="${restWidth}" height="${lineHeight}" fill="black" />\n`;

        // Vertical brackets at ends
        const bracketHeight = this.config.lineSpacing * 2;
        const bracketTop = centerY - bracketHeight / 2;
        svg += `<line x1="${startX}" y1="${bracketTop}" x2="${startX}" y2="${bracketTop + bracketHeight}" stroke="black" stroke-width="2" />\n`;
        svg += `<line x1="${endX}" y1="${bracketTop}" x2="${endX}" y2="${bracketTop + bracketHeight}" stroke="black" stroke-width="2" />\n`;

        // Number above the rest (centered)
        const numberX = (startX + endX) / 2;
        const numberY = staffTopY - 10;
        svg += `<text x="${numberX}" y="${numberY}" font-family="Times New Roman" font-size="18" font-weight="bold" text-anchor="middle">${duration}</text>\n`;

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
     * Render tremolo slashes on a note's stem.
     * @param x - X position of the stem
     * @param stemTipY - Y position of the stem tip
     * @param stemUp - Whether the stem points up
     * @param marks - Number of slash marks (1-3 typically)
     */
    private renderTremolo(x: number, stemTipY: number, stemUp: boolean, marks: number): string {
        let svg = "";

        // Position slashes on the stem, away from both ends
        // Start point is 1/3 down from the tip
        const stemLength = this.config.stemLength;
        const slashSpacing = 6;
        const slashWidth = 8;
        const slashHeight = 3;

        // Calculate starting Y position (on the stem, 1/3 from the tip)
        const startOffset = stemUp ? stemLength * 0.4 : -stemLength * 0.4;
        const baseY = stemTipY + startOffset;

        for (let i = 0; i < marks; i++) {
            const slashY = baseY + (stemUp ? i * slashSpacing : -i * slashSpacing);

            // Draw diagonal slashes (parallelogram shape)
            // Slashes slant from top-left to bottom-right
            const x1 = x - slashWidth / 2;
            const x2 = x + slashWidth / 2;
            const y1 = slashY - slashHeight;
            const y2 = slashY + slashHeight;

            svg += `<polygon points="${x1},${y1 + slashHeight} ${x2},${y1} ${x2},${y2 - slashHeight} ${x1},${y2}" fill="black" />\n`;
        }

        return svg;
    }

    /**
     * Render stem for a chord (spans from lowest to highest note).
     */
    private renderChordStem(cx: number, minY: number, maxY: number, r: number, stemUp: boolean, scale: number): string {
        const stemLen = this.config.stemLength * scale;
        if (stemUp) {
            const x = cx + r;
            const stemTop = minY - stemLen;
            return `<line x1="${x}" y1="${maxY}" x2="${x}" y2="${stemTop}" stroke="black" stroke-width="1.5" />\n`;
        } else {
            const x = cx - r;
            const stemBottom = maxY + stemLen;
            return `<line x1="${x}" y1="${minY}" x2="${x}" y2="${stemBottom}" stroke="black" stroke-width="1.5" />\n`;
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
            // Classical Quarter Rest Path
            // A squiggle centered around the middle lines
            const topY = staffTopY + this.config.lineSpacing; // Line 2
            // Path scaled to fit ~25px height
            return `<path d="M${x + 5},${topY} 
                     Q${x + 12},${topY + 8} ${x + 6},${topY + 12} 
                     Q${x + 2},${topY + 15} ${x + 8},${topY + 20} 
                     Q${x + 10},${topY + 25} ${x + 4},${topY + 22} 
                     L${x + 6},${topY + 30}" 
                     fill="none" stroke="black" stroke-width="2" stroke-linecap="round" />\n`;
        } else {
            // Eighth Rest: Dot-like head with a flag tail
            const topY = staffTopY + 2 * this.config.lineSpacing; // Line 3
            return `<g transform="translate(${x}, ${topY})">
                <circle cx="4" cy="2" r="3.5" fill="black"/>
                <path d="M7,2 Q10,8 4,15" fill="none" stroke="black" stroke-width="2"/>
            </g>\n`;
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
