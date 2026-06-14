import type { Score, Note, GlobalMeasure, Jump, Clef } from "@melos/core";
import {
    getSmuflChar,
    resolveAccidentalGlyph,
    resolveArticulationGlyph,
    resolveClefGlyph,
    resolveDynamicGlyphs,
    resolveNoteheadGlyph,
    resolvePedalGlyph,
    resolveRestGlyph,
    SMUFL_FONT_STACK
} from "./smufl";
import { createRenderPlan, type RenderPlan, type RenderPlanOptions } from "./plan";
import { solveMeasureSpacing, type MeasureSpacing } from "./spacing";

export * from "./smufl";
export * from "./layout";
export * from "./plan";
export * from "./spacing";

type ChordLayout = {
    x: number;
    noteX: number;
    stemTipY: number;
    stemUp: boolean;
    minY: number;
    maxY: number;
};

type StemDirection = "up" | "down";
type GlobalPosition = { x: number, y: number, stemUp: boolean, stemTipY: number };
type CurveRequest = { type: 'tie' | 'slur' | 'tremolo', sourceId: string, targetId: string, side?: string, marks?: number };
type RenderTremolo = number | { type?: "single" | "start" | "stop"; marks: number; id?: string };
type RenderItem = {
    id?: string;
    type?: string;
    value?: string;
    glyph?: string;
    duration?: { base?: string; dots?: number };
    notes?: Note[];
    rest?: { hidden?: boolean };
    content?: RenderItem[];
    articulations?: string[];
    slurs?: Array<{ target?: string; side?: string }>;
    tremolo?: RenderTremolo;
};
type RenderSequence = { content?: RenderItem[] };
type RenderMeasure = {
    sequences?: RenderSequence[];
    multimeasureRest?: { duration: number };
    ottavas?: Array<{ value: number }>;
    pedals?: Array<{
        type?: string;
        sign?: boolean;
        line?: boolean;
        position?: { fraction?: [number, number] };
        end?: { measure?: number; position?: { fraction?: [number, number] } };
    }>;
};

// SMuFL G-Clef path extracted from Bravura font (uniE050)
// Original glyph designed at 1000 units per em, roughly 4 spaces high.
const GCLEF_PATH = "M376 415l25 -145c3 -18 3 -18 29 -18c147 0 241 -113 241 -241c0 -113 -67 -198 -168 -238c-14 -6 -15 -5 -13 -17c11 -62 29 -157 29 -214c0 -170 -130 -200 -197 -200c-151 0 -190 98 -190 163c0 62 40 115 107 115c61 0 96 -47 96 -102c0 -58 -36 -85 -67 -94c-23 -7 -32 -10 -32 -17c0 -13 26 -29 80 -29c59 0 159 18 159 166c0 47 -15 134 -27 201c-2 12 -4 11 -15 9c-20 -4 -46 -6 -69 -6c-245 0 -364 165 -364 339c0 202 153 345 297 464c12 10 11 12 9 24c-7 41 -14 106 -14 164c0 104 24 229 98 311c20 22 51 48 65 48c11 0 37 -28 52 -50c41 -60 65 -146 65 -233c0 -153 -82 -280 -190 -381c-6 -6 -8 -7 -6 -19zM470 943c-61 0 -133 -96 -133 -252c0 -32 2 -66 6 -92c2 -13 6 -14 13 -8c79 69 174 159 174 270c0 55 -27 82 -60 82zM361 262l-21 128c-2 11 -4 12 -14 4c-47 -38 -93 -75 -153 -142c-83 -94 -93 -173 -93 -232c0 -139 113 -236 288 -236c20 0 40 2 56 5c15 3 16 3 14 14l-50 298c-2 11 -4 12 -20 8c-61 -17 -100 -60 -100 -117c0 -46 30 -89 72 -107c7 -3 15 -6 15 -13c0 -6 -4 -11 -12 -11c-7 0 -19 3 -27 6c-68 23 -115 87 -115 177c0 85 57 164 145 194c18 6 18 5 15 24zM430 103l49 -285c2 -12 4 -12 16 -6c56 28 94 79 94 142c0 88 -67 156 -148 163c-12 1 -13 -2 -11 -14z";

export class Renderer {
    private config = {
        pageWidth: 800,          // Maximum width before wrapping
        minPageWidth: 420,       // Avoid shrinking short examples into unreadable fragments
        lineSpacing: 10,         // Space between staff lines
        systemSpacing: 145,      // Space between systems (rows), including below-staff lanes
        paddingX: 40,            // Left/right padding
        paddingY: 50,            // Top padding
        bottomPadding: 32,
        measurePadding: 15,      // Padding inside each measure
        clefWidth: 40,           // Width reserved for clef
        dynamicOffsetY: 78,
        pedalSignOffsetY: 108,
        pedalLineOffsetY: 111,
        noteRadius: 5,
        stemLength: 35
    };

    createPlan(score: Score): RenderPlan {
        return createRenderPlan(score, this.getRenderPlanOptions(score));
    }

    /**
     * Renders a Score object to an SVG string through the intermediate render plan.
     */
    render(score: Score): string {
        const plan = this.createPlan(score);
        let svgContent = "";

        // Global position registry for deferred Tie/Slur/Tremolo rendering
        const globalPositions: Map<string, GlobalPosition> = new Map();
        const curveRequests: CurveRequest[] = [];
        const pendingTremolos: Map<string, { sourceId: string, marks: number }> = new Map();

        plan.parts.forEach((partPlan) => {
            const part = score.parts[partPlan.partIndex];
            if (!part) return;

            const renderedPartId = part.id || `part-${partPlan.partIndex + 1}`;

            partPlan.systems.forEach((system) => {
                const systemY = system.y;

                // Render part name only on the first system for that part.
                if (system.systemIndex === 0) {
                    svgContent += `<text x="${this.config.paddingX}" y="${systemY - 15}" font-family="Arial" font-size="14">${part.name || part.id}</text>\n`;
                }

                let headerX = system.x;
                let clef: Clef = { sign: "G" };
                const firstMeasure = part.measures[0];
                if (firstMeasure?.clefs && firstMeasure.clefs.length > 0) {
                    clef = firstMeasure.clefs[0].clef;
                }

                svgContent += this.renderClef(headerX + 10, systemY + 40, clef);
                headerX += this.config.clefWidth;

                const initialGlobalMeasure = score.global.measures[0];
                const initialKey = initialGlobalMeasure?.key;
                if (initialKey) {
                    const keyWidth = this.renderKeySignature(headerX, systemY, initialKey);
                    svgContent += keyWidth.svg;
                    headerX += keyWidth.width;
                }

                const initialTime = initialGlobalMeasure?.time;
                if (initialTime) {
                    const timeWidth = this.renderTimeSignature(headerX, systemY, initialTime);
                    svgContent += timeWidth.svg;
                }

                system.measures.forEach((measurePlan) => {
                    const measure = part.measures[measurePlan.measureIndex];
                    if (!measure) return;

                    const measureX = measurePlan.x;
                    const measureWidth = measurePlan.width;
                    const measureEndX = measureX + measureWidth;
                    const globalMeasure = score.global.measures[measurePlan.measureIndex];
                    const spacing = solveMeasureSpacing(score, measurePlan);

                    svgContent += this.renderBarline(measureX, systemY, "start", globalMeasure);
                    svgContent += this.renderMeasureHitbox(
                        measureX,
                        systemY,
                        measureWidth,
                        measurePlan.measureNumber,
                        renderedPartId
                    );

                    if (globalMeasure?.jumps) {
                        svgContent += this.renderJumps(measureX, systemY, globalMeasure.jumps, "start");
                    }

                    const renderMeasure = measure as RenderMeasure;
                    const eventPositions: Map<string, ChordLayout> = new Map();
                    const beamedEventIds: Set<string> = new Set();
                    if (measure.beams) {
                        for (const beam of measure.beams) {
                            for (const eventId of beam.events) {
                                beamedEventIds.add(eventId);
                            }
                        }
                    }

                    if (renderMeasure.multimeasureRest) {
                        svgContent += this.renderMultimeasureRest(
                            measurePlan.contentX,
                            measureEndX - this.config.measurePadding,
                            systemY,
                            renderMeasure.multimeasureRest.duration
                        );
                    } else {
                        const sequences = renderMeasure.sequences || [];
                        const stemDirections = this.sequenceStemDirections(sequences, systemY);
                        sequences.forEach((sequence, sequenceIndex) => {
                            svgContent += this.renderSequenceContent(
                                sequence.content || [],
                                measurePlan.contentX,
                                systemY,
                                renderedPartId,
                                stemDirections[sequenceIndex],
                                beamedEventIds,
                                eventPositions,
                                globalPositions,
                                curveRequests,
                                pendingTremolos,
                                spacing,
                                `parts[${partPlan.partIndex}].measures[${measurePlan.measureIndex}].sequences[${sequenceIndex}].content`
                            );
                        });

                        if (measure.beams && eventPositions.size > 0) {
                            for (const beam of measure.beams) {
                                svgContent += this.renderBeam(beam.events, eventPositions);
                            }
                        }

                        if (renderMeasure.ottavas) {
                            for (const ottava of renderMeasure.ottavas) {
                                svgContent += this.renderOttava(
                                    measurePlan.contentX,
                                    measureEndX - this.config.measurePadding,
                                    systemY,
                                    ottava.value
                                );
                            }
                        }

                        if (renderMeasure.pedals) {
                            renderMeasure.pedals.forEach((p) => {
                                const pX = this.rhythmicPositionToX(
                                    measurePlan.contentX,
                                    measurePlan.contentWidth,
                                    p.position
                                );

                                if (p.type === 'start') {
                                    if (p.sign) {
                                        svgContent += this.renderPedalSign(pX, systemY, 'start');
                                    }
                                    if (p.line) {
                                        const pedalMeasureEndX = measureEndX - this.config.measurePadding;
                                        const endX = p.end?.measure === measurePlan.measureNumber
                                            ? this.rhythmicPositionToX(measurePlan.contentX, measurePlan.contentWidth, p.end.position)
                                            : pedalMeasureEndX;
                                        const lineStartX = pX + (p.sign ? 32 : 0);
                                        const lineEndX = Math.max(lineStartX + 16, Math.min(endX, pedalMeasureEndX));
                                        svgContent += this.renderPedalLine(lineStartX, lineEndX, systemY);
                                    } else if (!p.sign) {
                                        svgContent += this.renderPedalSign(pX, systemY, 'start');
                                    }
                                } else if (p.type === 'stop' && !p.line) {
                                    svgContent += this.renderPedalSign(pX, systemY, 'stop');
                                }
                            });
                        }
                    }

                    svgContent += this.renderBarline(measureEndX, systemY, "end", globalMeasure);

                    if (globalMeasure?.ending) {
                        svgContent += this.renderEnding(measureEndX, measureWidth, systemY, globalMeasure.ending);
                    }

                    if (globalMeasure?.jumps) {
                        svgContent += this.renderJumps(measureEndX, systemY, globalMeasure.jumps, "end");
                    }
                });

                svgContent += this.renderStaveLines(system.x, system.y, system.width);
            });
        });

        // --- 8. Render Ties and Slurs (Deferred) ---
        for (const req of curveRequests) {
            const sourcePos = globalPositions.get(req.sourceId);
            const targetPos = globalPositions.get(req.targetId);

            if (sourcePos && targetPos) {
                if (req.type === 'tie' || req.type === 'slur') {
                    svgContent += this.renderCurve(sourcePos, targetPos, req.type, req.side);
                } else if (req.type === 'tremolo' && req.marks) {
                    svgContent += this.renderMultiNoteTremolo(sourcePos, targetPos, req.marks);
                }
            }
        }

        return `<svg xmlns="http://www.w3.org/2000/svg" width="${plan.width}" height="${plan.height}">
            <style>
                .smufl-glyph { font-family: ${SMUFL_FONT_STACK}; }
            </style>
            ${svgContent}
        </svg>`;
    }

    private getRenderPlanOptions(score: Score): RenderPlanOptions {
        return {
            pageWidth: this.config.pageWidth,
            minPageWidth: this.config.minPageWidth,
            paddingX: this.config.paddingX,
            paddingY: this.config.paddingY,
            bottomPadding: this.config.bottomPadding,
            systemSpacing: this.config.systemSpacing,
            measurePadding: this.config.measurePadding,
            minMeasureWidth: 60,
            systemHeaderWidth: this.estimateSystemHeaderWidth(score)
        };
    }

    private estimateSystemHeaderWidth(score: Score): number {
        const initialGlobalMeasure = score.global.measures[0];
        let width = this.config.clefWidth;

        if (initialGlobalMeasure?.key) {
            width += this.estimateKeySignatureWidth(initialGlobalMeasure.key);
        }

        if (initialGlobalMeasure?.time) {
            width += 30;
        }

        return width;
    }

    private estimateKeySignatureWidth(key: { fifths?: number }): number {
        const fifths = key.fifths || 0;
        return fifths === 0 ? 10 : (Math.abs(fifths) * 12) + 10;
    }

    /**
     * Render Clef at specific position.
     */
    private renderClef(x: number, y: number, clef: Clef | string = "G"): string {
        const sign = typeof clef === "string" ? clef : clef?.sign ?? "G";
        const glyphName = resolveClefGlyph(sign, typeof clef === "string" ? undefined : clef?.glyph);

        if (glyphName) {
            const yAdjust = sign === "G" ? 1 : sign === "F" ? -9 : sign === "C" ? -8 : -9;
            return this.renderSmuflGlyph(glyphName, x, y + yAdjust, 52, `data-smufl-role="clef"`);
        }

        if (sign === "TAB") {
            return `<text x="${x}" y="${y - 10}" font-family="Arial" font-size="18" font-weight="bold">TAB</text>\n`;
        }

        return `<g transform="translate(${x}, ${y}) scale(0.04)">
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

        const symbol = fifths > 0 ? "accidentalSharp" : "accidentalFlat";
        const positions = fifths > 0 ? sharpYs : flatYs;
        const count = Math.abs(fifths);

        for (let i = 0; i < count; i++) {
            const symbolY = y + positions[i] + (fifths > 0 ? 5 : 5); // Adjustment for text centering
            svg += this.renderSmuflGlyph(symbol, x + (i * spacing), symbolY + 8, 28, `data-smufl-role="key-signature"`);
        }

        width = (count * spacing) + 10;
        return { svg, width };
    }

    private renderTimeSignature(x: number, y: number, time: any): { svg: string, width: number } {
        const beats = time.count ?? time.beats;
        const type = time.unit ?? time["beat-type"];

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

    private renderSequenceContent(
        content: RenderItem[],
        startX: number,
        staffTopY: number,
        partId: string | undefined,
        stemDirection: StemDirection | undefined,
        beamedEventIds: Set<string>,
        eventPositions: Map<string, ChordLayout>,
        globalPositions: Map<string, GlobalPosition>,
        curveRequests: CurveRequest[],
        pendingTremolos: Map<string, { sourceId: string, marks: number }>,
        spacing?: MeasureSpacing,
        pathPrefix = "content"
    ): string {
        let svg = "";
        let noteX = startX;

        content.forEach((item, itemIndex) => {
            const itemPath = `${pathPrefix}[${itemIndex}]`;
            if (item.notes && item.notes.length > 0) {
                const duration = item.duration?.base || "quarter";
                const dots = item.duration?.dots || 0;
                const eventId = item.id || `event-${noteX}`;
                const eventX = this.resolveSpacingX(item, itemPath, noteX, spacing);
                const isBeamed = beamedEventIds.has(eventId);

                const chordResult = this.renderChordWithLayout(
                    eventX,
                    item.notes,
                    duration,
                    staffTopY,
                    1,
                    isBeamed,
                    eventId,
                    partId,
                    dots,
                    stemDirection
                );
                svg += chordResult.svg;

                if (isBeamed && chordResult.layout) {
                    eventPositions.set(eventId, chordResult.layout);
                }

                if (chordResult.layout) {
                    const noteHeadY = (chordResult.layout.minY + chordResult.layout.maxY) / 2;
                    globalPositions.set(eventId, {
                        x: eventX,
                        y: noteHeadY,
                        stemUp: chordResult.layout.stemUp,
                        stemTipY: chordResult.layout.stemTipY
                    });
                }

                if (item.articulations && chordResult.layout) {
                    svg += this.renderArticulations(eventX, item.articulations, chordResult.layout);
                }

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

                if (item.tremolo) {
                    svg += this.renderTremoloEvent(eventX, item, eventId, chordResult.layout, curveRequests, pendingTremolos);
                }

                noteX += this.getNoteWidth(duration, dots);
            } else if (item.rest) {
                const duration = item.duration?.base || "quarter";
                const dots = item.duration?.dots || 0;
                const eventId = item.id || `event-${noteX}`;
                const eventX = this.resolveSpacingX(item, itemPath, noteX, spacing);
                if (!item.rest.hidden) {
                    svg += this.renderRest(eventX, staffTopY, duration, dots, eventId, partId);
                }
                noteX += this.getNoteWidth(duration, dots);
            } else if (item.type === 'dynamic' && item.value) {
                const eventId = item.id || `event-${noteX}`;
                const eventX = this.resolveSpacingX(item, itemPath, noteX, spacing);
                svg += this.renderDynamic(eventX, staffTopY, item.value, item.glyph, eventId, partId);
            } else if (item.type === 'tuplet' || item.type === 'grace') {
                item.content?.forEach((subItem, subItemIndex) => {
                    const subItemPath = `${itemPath}.content[${subItemIndex}]`;
                    const eventX = this.resolveSpacingX(subItem, subItemPath, noteX, spacing);
                    if (subItem.notes && subItem.notes.length > 0) {
                        const duration = subItem.duration?.base || "eighth";
                        svg += this.renderChord(
                            eventX,
                            subItem.notes,
                            duration,
                            staffTopY,
                            0.7,
                            subItem.duration?.dots || 0,
                            stemDirection
                        );
                        noteX += 20;
                    } else if (subItem.rest) {
                        noteX += 20;
                    }
                });
            }
        });

        return svg;
    }

    private resolveSpacingX(
        item: RenderItem,
        path: string,
        fallbackX: number,
        spacing?: MeasureSpacing
    ): number {
        const byPath = spacing?.eventsByPath.get(path);
        if (byPath) return byPath.x;

        if (item.id) {
            const byId = spacing?.eventsById.get(item.id)?.[0];
            if (byId) return byId.x;
        }

        return fallbackX;
    }

    private renderTremoloEvent(
        noteX: number,
        item: RenderItem,
        eventId: string,
        layout: ChordLayout | undefined,
        curveRequests: CurveRequest[],
        pendingTremolos: Map<string, { sourceId: string, marks: number }>
    ): string {
        if (typeof item.tremolo === 'number') {
            return layout
                ? this.renderTremolo(noteX, layout.stemTipY, layout.stemUp, item.tremolo)
                : "";
        }

        const tremolo = item.tremolo;
        if (!tremolo || typeof tremolo !== "object") return "";
        if (tremolo.type === 'single' && layout) {
            return this.renderTremolo(noteX, layout.stemTipY, layout.stemUp, tremolo.marks);
        }
        if (tremolo.type === 'start' && tremolo.id) {
            pendingTremolos.set(tremolo.id, { sourceId: eventId, marks: tremolo.marks });
        } else if (tremolo.type === 'stop' && tremolo.id) {
            const startData = pendingTremolos.get(tremolo.id);
            if (startData) {
                curveRequests.push({
                    type: 'tremolo',
                    sourceId: startData.sourceId,
                    targetId: eventId,
                    marks: startData.marks
                });
                pendingTremolos.delete(tremolo.id);
            }
        }

        return "";
    }

    private sequenceStemDirections(sequences: RenderSequence[], staffTopY: number): Array<StemDirection | undefined> {
        if (sequences.length <= 1) return sequences.map(() => undefined);

        const averages = sequences
            .map((sequence, index) => {
                const yPositions = this.collectSequenceYPositions(sequence.content || [], staffTopY);
                const averageY = yPositions.length > 0
                    ? yPositions.reduce((sum, y) => sum + y, 0) / yPositions.length
                    : Number.POSITIVE_INFINITY;
                return { index, averageY };
            })
            .filter((entry) => Number.isFinite(entry.averageY))
            .sort((a, b) => a.averageY - b.averageY);

        const directions: Array<StemDirection | undefined> = sequences.map(() => undefined);
        averages.forEach((entry, rank) => {
            directions[entry.index] = rank < averages.length / 2 ? "up" : "down";
        });
        return directions;
    }

    private collectSequenceYPositions(content: RenderItem[], staffTopY: number): number[] {
        const positions: number[] = [];
        content.forEach((item) => {
            if (item.notes) {
                item.notes.forEach((note: Note) => {
                    positions.push(this.calculateY(note, staffTopY));
                });
            } else if ((item.type === "tuplet" || item.type === "grace") && Array.isArray(item.content)) {
                positions.push(...this.collectSequenceYPositions(item.content, staffTopY));
            }
        });
        return positions;
    }

    /**
     * Render 5 staff lines for a system segment.
     */
    private renderStaveLines(startX: number, y: number, length: number): string {
        let svg = "";
        for (let i = 0; i < 5; i++) {
            const lineY = y + (i * this.config.lineSpacing);
            svg += `<line x1="${startX}" y1="${lineY}" x2="${startX + length}" y2="${lineY}" stroke="black" stroke-width="1" pointer-events="none" />\n`;
        }
        return svg;
    }

    /**
     * Render a barline at specified position.
     */
    /**
     * Render a barline at specified position.
     */
    private renderBarline(x: number, y: number, position: "start" | "end", globalMeasure?: GlobalMeasure): string {
        const type = globalMeasure?.barline?.type;
        const spacing = this.config.lineSpacing;
        const topY = y;
        const bottomY = y + 4 * spacing;
        let svg = "";

        // Helper to draw vertical line
        const drawLine = (lx: number, width: number) =>
            `<line x1="${lx}" y1="${topY}" x2="${lx}" y2="${bottomY}" stroke="black" stroke-width="${width}" />\n`;

        // Helper to draw dashed line
        const drawDashedLine = (lx: number, width: number) =>
            `<line x1="${lx}" y1="${topY}" x2="${lx}" y2="${bottomY}" stroke="black" stroke-width="${width}" stroke-dasharray="5,5" />\n`;

        // Helper to draw dots
        const drawDots = (dx: number) =>
            `<circle cx="${dx}" cy="${y + 1.5 * spacing}" r="2" fill="black" />\n` +
            `<circle cx="${dx}" cy="${y + 2.5 * spacing}" r="2" fill="black" />\n`;

        if (position === "start") {
            if (type === "repeat-forward") {
                // Heavy-Light + Dots
                svg += drawLine(x, 3); // Heavy
                svg += drawLine(x + 5, 1); // Light
                svg += drawDots(x + 10);
                return svg;
            }
            // Default start barline (System start)
            return drawLine(x, 1);
        }

        // Position === "end"
        if (type === "repeat-backward") {
            // Dots + Light + Heavy
            svg += drawDots(x - 10);
            svg += drawLine(x - 5, 1);
            svg += drawLine(x, 3);
        } else if (type === "final") {
            // Light + Heavy
            svg += drawLine(x - 5, 1);
            svg += drawLine(x, 3);
        } else if (type === "double") {
            // Light + Light
            svg += drawLine(x - 4, 1);
            svg += drawLine(x, 1);
        } else if (type === "dashed") {
            // Dashed
            svg += drawDashedLine(x, 1);
        } else if (type === "repeat-forward") {
            // If we are at the end, but the measure implies a start repeat (left), 
            // we still need to close the current measure with a regular barline?
            svg += drawLine(x, 1);
        } else {
            // Regular
            svg += drawLine(x, 1);
        }

        return svg;
    }

    private renderEnding(endX: number, width: number, y: number, ending: any): string {
        // ending: { numbers: number[], duration: number, open: boolean }
        // Draw bracket above staff
        const startX = endX - width;
        const bracketY = y - 20; // Above staff
        const bracketHeight = 15;
        let svg = "";

        const label = ending.numbers ? ending.numbers.join(",") + "." : "";

        // Top line
        svg += `<polyline points="${startX},${bracketY + bracketHeight} ${startX},${bracketY} ${endX},${bracketY}" fill="none" stroke="black" stroke-width="1" />\n`;

        // Closing leg if not open
        if (!ending.open) {
            svg += `<line x1="${endX}" y1="${bracketY}" x2="${endX}" y2="${bracketY + bracketHeight}" stroke="black" stroke-width="1" />\n`;
        }

        if (label) {
            svg += `<text x="${startX + 5}" y="${bracketY + 12}" font-family="Times New Roman" font-size="12">${label}</text>\n`;
        }

        return svg;
    }

    private renderJumps(x: number, y: number, jumps: Jump[], position: "start" | "end"): string {
        const topY = y - 10; // Base Y above staff
        let svg = "";

        const relevantJumps = jumps.filter(j =>
            position === "end"
                ? ["fine", "dc", "ds", "dc-al-fine", "ds-al-fine", "dc-al-coda", "ds-al-coda"].includes(j.type)
                : ["segno", "coda"].includes(j.type)
        );

        relevantJumps.forEach((j, i) => {
            const currentY = topY - (i * 15);

            // Text Instructions
            let text = "";
            switch (j.type) {
                case "fine": text = "Fine"; break;
                case "dc": text = "D.C."; break;
                case "ds": text = "D.S."; break;
                case "dc-al-fine": text = "D.C. al Fine"; break;
                case "ds-al-fine": text = "D.S. al Fine"; break;
                case "dc-al-coda": text = "D.C. al Coda"; break;
                case "ds-al-coda": text = "D.S. al Coda"; break;
            }

            if (text) {
                // Determine Anchor: End position -> Text-Anchor End
                const anchor = position === "end" ? "end" : "start";
                svg += `<text x="${x}" y="${currentY}" font-family="Times New Roman" font-weight="bold" font-size="12" text-anchor="${anchor}">${text}</text>\n`;
            } else if (j.type === "segno") {
                svg += this.renderSegno(x, currentY - 10);
            } else if (j.type === "coda") {
                svg += this.renderCoda(x, currentY - 10);
            }
        });

        return svg;
    }

    private renderSegno(x: number, y: number): string {
        return this.renderSmuflGlyph("segno", x, y + 22, 28, `data-smufl-role="jump"`);
    }

    private renderCoda(x: number, y: number): string {
        return this.renderSmuflGlyph("coda", x, y + 22, 28, `data-smufl-role="jump"`);
    }

    /**
     * Render a chord (one or more notes with a shared stem).
     * Handles second interval collisions by offsetting note heads.
     */
    private renderChord(
        cx: number,
        notes: Note[],
        duration: string,
        staffTopY: number,
        scale: number = 1,
        dots: number = 0,
        stemDirection?: StemDirection
    ): string {
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
        const stemUp = stemDirection ? stemDirection === "up" : bottomDistance >= topDistance;

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
        // Draw all note heads with potential offsets
        noteData.forEach((nd) => {
            const noteX = cx + nd.offsetX;
            svg += this.renderNoteHead(noteX, nd.y, duration, r, nd.note.notehead, nd.note.color);
            svg += this.renderLedgerLines(noteX, nd.y, staffTopY);
            svg += this.renderAugmentationDots(noteX + (14 * scale), this.dotYForStaffPosition(nd.y, staffTopY), dots, scale);
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
        isBeamed: boolean = false,
        eventId?: string,
        partId?: string,
        dots: number = 0,
        stemDirection?: StemDirection
    ): { svg: string, layout?: ChordLayout } {
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
        const stemUp = stemDirection ? stemDirection === "up" : bottomDistance >= topDistance;

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
            svg += this.renderNoteHead(noteX, nd.y, duration, r, nd.note.notehead, nd.note.color);
            svg += this.renderLedgerLines(noteX, nd.y, staffTopY);
            svg += this.renderAugmentationDots(noteX + (14 * scale), this.dotYForStaffPosition(nd.y, staffTopY), dots, scale);

            // Draw Accidental
            const acc = nd.note.accidentalDisplay;
            if (acc?.show && nd.note.pitch && nd.note.pitch.alter !== undefined) {
                const accX = noteX - (20 * scale);
                svg += this.renderAccidental(accX, nd.y, nd.note.pitch.alter, !!acc.cautionary, scale);
            }
        });

        let layout: ChordLayout = {
            x: stemUp ? cx + r : cx - r,
            noteX: cx,
            stemTipY: stemUp ? minY : maxY,
            stemUp,
            minY,
            maxY
        };

        // Draw stem (if not a whole note)
        if (duration !== "whole") {
            const stemLen = this.config.stemLength * scale;
            const stemX = stemUp ? cx + r : cx - r;
            const stemTipY = stemUp ? (minY - stemLen) : (maxY + stemLen);

            svg += this.renderChordStem(cx, minY, maxY, r, stemUp, scale);

            // Store layout for beam
            layout = { x: stemX, noteX: cx, stemTipY, stemUp, minY, maxY };

            // Flags (only if NOT beamed)
            if (!isBeamed && (duration === "eighth" || duration === "16th" || duration === "32nd")) {
                const flagY = stemUp ? minY : maxY;
                svg += this.renderFlag(cx, flagY, r, stemUp, duration, scale);
            }
        }

        // Wrap in a group with data attributes for interaction
        if (eventId || partId) {
            const hitboxTop = Math.min(minY, layout.stemTipY) - 14;
            const hitboxBottom = Math.max(maxY, layout.stemTipY) + 20;
            const hitbox = `<rect class="event-hitbox" x="${cx - 24}" y="${hitboxTop}" width="48" height="${hitboxBottom - hitboxTop}" fill="transparent" stroke="transparent" pointer-events="all" />\n`;
            const attrs = [
                eventId ? `data-event-id="${eventId}"` : '',
                partId ? `data-part-id="${partId}"` : '',
                'data-event-kind="note"',
                'class="score-object note-group"',
                'style="cursor: pointer;"'
            ].filter(Boolean).join(' ');
            svg = `<g ${attrs}>${hitbox}${svg}</g>\n`;
        }

        return { svg, layout };
    }

    /**
     * Render a beam connecting multiple events.
     * Uses a simple flat/sloped beam algorithm.
     */
    private renderBeam(
        eventIds: string[],
        eventPositions: Map<string, ChordLayout>
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

    private renderAccidental(x: number, y: number, alter: number, cautionary: boolean, scale: number): string {
        const glyphName = resolveAccidentalGlyph(alter);
        if (!glyphName) return "";

        let svg = this.renderSmuflGlyph(
            glyphName,
            x,
            y + (10 * scale),
            28 * scale,
            `data-smufl-role="accidental"`
        );

        if (cautionary) {
            // Draw parentheses
            svg += `<text x="${x - 5}" y="${y + 5}" font-family="Arial" font-size="${20 * scale}">(</text>`;
            svg += `<text x="${x + 12}" y="${y + 5}" font-family="Arial" font-size="${20 * scale}">)</text>`;
        }
        return svg;
    }

    private renderMeasureHitbox(
        x: number,
        staffTopY: number,
        width: number,
        measureNumber: number,
        partId: string
    ): string {
        const y = staffTopY - 14;
        const height = this.config.lineSpacing * 4 + 84;
        return `<rect class="measure-hitbox" data-measure-index="${measureNumber}" data-part-id="${this.escapeXml(partId)}" x="${x}" y="${y}" width="${width}" height="${height}" fill="transparent" stroke="transparent" pointer-events="all" style="cursor: pointer;" />\n`;
    }

    private renderDynamic(
        x: number,
        staffTopY: number,
        value: string,
        glyph?: string,
        eventId?: string,
        partId?: string
    ): string {
        const glyphs = resolveDynamicGlyphs(value, glyph);
        let svg = "";

        if (glyphs.length === 0) {
            svg = `<text x="${x}" y="${staffTopY + this.config.dynamicOffsetY}" font-family="Times New Roman" font-style="italic" font-weight="bold" font-size="16" data-smufl-role="dynamic-text">${this.escapeXml(value)}</text>\n`;
        } else {
            svg = this.renderSmuflGlyphs(glyphs, x, staffTopY + this.config.dynamicOffsetY, 24, `data-smufl-role="dynamic"`);
        }

        return this.wrapInteractiveEvent(
            svg,
            "dynamic",
            eventId,
            partId,
            { x: x - 8, y: staffTopY + this.config.dynamicOffsetY - 28, width: 72, height: 38 }
        );
    }

    private renderArticulations(x: number, articulations: string[], layout: ChordLayout): string {
        const placement = layout.stemUp ? "below" : "above";
        const baseY = placement === "above" ? layout.minY - 10 : layout.maxY + 16;
        const direction = placement === "above" ? -1 : 1;
        let svg = "";

        articulations.forEach((articulation, index) => {
            const glyphName = resolveArticulationGlyph(articulation, placement);
            if (!glyphName) return;
            const y = baseY + (index * 11 * direction);
            svg += this.renderSmuflGlyph(
                glyphName,
                x - 4,
                y,
                18,
                `data-smufl-role="articulation"`
            );
        });

        return svg;
    }

    /**
     * Render just the note head (shape depends on duration and type).
     */
    private renderNoteHead(cx: number, cy: number, duration: string, r: number, type?: string, color?: string): string {
        const baseColor = color || "black";
        const glyphName = resolveNoteheadGlyph(duration, type);
        if (glyphName) {
            return this.renderSmuflGlyph(
                glyphName,
                cx - (r * 1.25),
                cy + (r * 1.05),
                r * 4.8,
                `data-smufl-role="notehead" fill="${baseColor}"`
            );
        }

        const fill = (duration === "whole" || duration === "half") ? "none" : baseColor;
        const stroke = baseColor;

        if (type === "circle-x") {
            // X shape
            const s = r * 1.2;
            let svg = `<line x1="${cx - s}" y1="${cy - s}" x2="${cx + s}" y2="${cy + s}" stroke="${stroke}" stroke-width="2" />
                       <line x1="${cx + s}" y1="${cy - s}" x2="${cx - s}" y2="${cy + s}" stroke="${stroke}" stroke-width="2" />\n`;
            if (type === "circle-x") {
                svg += `<circle cx="${cx}" cy="${cy}" r="${r * 1.4}" fill="none" stroke="${stroke}" stroke-width="1.5" />\n`;
            }
            return svg;
        } else if (type === "diamond") {
            // Diamond
            const w = r * 1.3;
            const h = r * 1.3;
            return `<polygon points="${cx},${cy - h} ${cx + w},${cy} ${cx},${cy + h} ${cx - w},${cy}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" />\n`;
        } else if (type === "triangle") {
            // Triangle pointing up
            const h = r * 1.5;
            const w = r * 1.3;
            return `<polygon points="${cx},${cy - h} ${cx + w},${cy + h / 2} ${cx - w},${cy + h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" />\n`;
        } else if (type === "slash") {
            const s = r * 1.2;
            return `<line x1="${cx + s}" y1="${cy - s}" x2="${cx - s}" y2="${cy + s}" stroke="${stroke}" stroke-width="2" />\n`;
        }

        // Normal Oval
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
            return `<line x1="${x}" y1="${maxY}" x2="${x}" y2="${stemTop}" stroke="black" stroke-width="1.5" />\n`;
        } else {
            const x = cx - r;
            const stemBottom = maxY + stemLen;
            return `<line x1="${x}" y1="${minY}" x2="${x}" y2="${stemBottom}" stroke="black" stroke-width="1.5" />\n`;
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
    private renderRest(
        x: number,
        staffTopY: number,
        duration: string,
        dots: number = 0,
        eventId?: string,
        partId?: string
    ): string {
        const glyphName = resolveRestGlyph(duration);
        let svg = "";

        if (glyphName && duration !== "whole" && duration !== "half") {
            svg = this.renderSmuflGlyph(glyphName, x, staffTopY + 33, 32, `data-smufl-role="rest"`);
            return this.wrapInteractiveEvent(
                svg + this.renderAugmentationDots(x + 20, staffTopY + 25, dots),
                "rest",
                eventId,
                partId,
                { x: x - 8, y: staffTopY, width: 42, height: 56 }
            );
        }

        if (duration === "whole") {
            // Thick bar hanging from line 2
            svg = `<rect x="${x}" y="${staffTopY + this.config.lineSpacing}" width="12" height="5" fill="black" />\n`;
        } else if (duration === "half") {
            // Thick bar sitting on line 3
            svg = `<rect x="${x}" y="${staffTopY + 2 * this.config.lineSpacing - 5}" width="12" height="5" fill="black" />\n`;
        } else if (duration === "quarter") {
            // Classical Quarter Rest Path
            // A squiggle centered around the middle lines
            const topY = staffTopY + this.config.lineSpacing; // Line 2
            // Path scaled to fit ~25px height
            svg = `<path d="M${x + 5},${topY} 
                     Q${x + 12},${topY + 8} ${x + 6},${topY + 12} 
                     Q${x + 2},${topY + 15} ${x + 8},${topY + 20} 
                     Q${x + 10},${topY + 25} ${x + 4},${topY + 22} 
                     L${x + 6},${topY + 30}" 
                     fill="none" stroke="black" stroke-width="2" stroke-linecap="round" />\n`;
        } else {
            // Eighth Rest: Dot-like head with a flag tail
            const topY = staffTopY + 2 * this.config.lineSpacing; // Line 3
            svg = `<g transform="translate(${x}, ${topY})">
                <circle cx="4" cy="2" r="3.5" fill="black"/>
                <path d="M7,2 Q10,8 4,15" fill="none" stroke="black" stroke-width="2"/>
            </g>\n`;
        }

        return this.wrapInteractiveEvent(
            svg + this.renderAugmentationDots(x + 20, staffTopY + 25, dots),
            "rest",
            eventId,
            partId,
            { x: x - 8, y: staffTopY, width: 42, height: 56 }
        );
    }

    private wrapInteractiveEvent(
        svg: string,
        kind: "note" | "rest" | "dynamic",
        eventId?: string,
        partId?: string,
        hitbox?: { x: number; y: number; width: number; height: number }
    ): string {
        if (!eventId && !partId) return svg;

        const hitboxSvg = hitbox
            ? `<rect class="event-hitbox" x="${hitbox.x}" y="${hitbox.y}" width="${hitbox.width}" height="${hitbox.height}" fill="transparent" stroke="transparent" pointer-events="all" />\n`
            : "";
        const attrs = [
            eventId ? `data-event-id="${eventId}"` : "",
            partId ? `data-part-id="${partId}"` : "",
            `data-event-kind="${kind}"`,
            `class="score-object ${kind}-group"`,
            `style="cursor: pointer;"`
        ].filter(Boolean).join(" ");

        return `<g ${attrs}>${hitboxSvg}${svg}</g>\n`;
    }

    private renderSmuflGlyph(glyphName: string, x: number, y: number, fontSize: number, attrs = ""): string {
        const char = getSmuflChar(glyphName);
        if (!char) return "";
        return `<text x="${x}" y="${y}" class="smufl-glyph" font-family="${SMUFL_FONT_STACK}" font-size="${fontSize}" ${attrs} data-smufl-glyph="${glyphName}">${char}</text>\n`;
    }

    private renderSmuflGlyphs(glyphNames: string[], x: number, y: number, fontSize: number, attrs = ""): string {
        const chars = glyphNames.map((glyphName) => getSmuflChar(glyphName)).filter(Boolean).join("");
        if (!chars) return "";
        return `<text x="${x}" y="${y}" class="smufl-glyph" font-family="${SMUFL_FONT_STACK}" font-size="${fontSize}" ${attrs} data-smufl-glyph="${glyphNames.join(" ")}">${chars}</text>\n`;
    }

    private escapeXml(value: string): string {
        return value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    /**
     * Get horizontal spacing for a note based on duration.
     */
    private renderAugmentationDots(x: number, y: number, count: number = 0, scale: number = 1): string {
        let svg = "";
        for (let i = 0; i < count; i++) {
            svg += this.renderSmuflGlyph(
                "augmentationDot",
                x + (i * 6 * scale),
                y,
                10 * scale,
                `data-smufl-role="augmentation-dot"`
            );
        }
        return svg;
    }

    private dotYForStaffPosition(noteY: number, staffTopY: number): number {
        const halfSpace = this.config.lineSpacing / 2;
        const staffSteps = Math.round((noteY - staffTopY) / halfSpace);
        const onLine = staffSteps % 2 === 0;
        return onLine ? noteY - (halfSpace / 2) : noteY;
    }

    private getNoteWidth(duration: string, dots: number = 0): number {
        let width: number;
        switch (duration) {
            case "whole": width = 60; break;
            case "half": width = 45; break;
            case "quarter": width = 35; break;
            case "eighth": width = 25; break;
            default: width = 20;
        }
        return width + (dots * 7);
    }

    private rhythmicPositionToX(startX: number, width: number, position?: { fraction?: [number, number] }): number {
        if (!position?.fraction) return startX;
        const [numerator, denominator] = position.fraction;
        if (!denominator) return startX;
        const ratio = Math.max(0, Math.min(1, numerator / denominator));
        return startX + (width * ratio);
    }

    /**
     * Calculate Y position for a note based on pitch or unpitched display.
     */
    private calculateY(note: Note, staffTopY: number): number {
        const stepMap: Record<string, number> = { "C": 0, "D": 1, "E": 2, "F": 3, "G": 4, "A": 5, "B": 6 };
        let step = "B";
        let octave = 4;

        if (note.pitch) {
            step = note.pitch.step;
            octave = note.pitch.octave;
        } else if (note.unpitched) {
            step = note.unpitched.step;
            octave = note.unpitched.octave;
        } else {
            return staffTopY + 20; // Fallback
        }

        const absoluteStep = (octave * 7) + stepMap[step];
        const g4Step = (4 * 7) + 4; // G4 = 32
        const diff = absoluteStep - g4Step;
        const g4Y = staffTopY + (3 * this.config.lineSpacing);

        return g4Y - (diff * (this.config.lineSpacing / 2));
    }
    private renderTremolo(x: number, stemTipY: number, stemUp: boolean, marks: number): string {
        const spacing = 4;
        const length = 12;
        const slant = 3;
        const startX = x - length / 2;

        // Tremolo positioning
        const yOffset = stemUp ? 15 : -15;
        const centerY = stemTipY + yOffset;

        let svg = "";
        for (let i = 0; i < marks; i++) {
            const y = centerY + (i * spacing * (stemUp ? 1 : -1));
            svg += `<line x1="${startX}" y1="${y + slant}" x2="${startX + length}" y2="${y - slant}" stroke="black" stroke-width="2" />\n`;
        }
        return svg;
    }

    private renderMultiNoteTremolo(sourcePos: any, targetPos: any, marks: number): string {
        const midX = (sourcePos.x + targetPos.x) / 2;
        const midY = (sourcePos.y + targetPos.y) / 2;

        const length = (targetPos.x - sourcePos.x) * 0.6;
        const startX = midX - length / 2;

        let svg = "";
        const spacing = 6;
        const slantY = 4;

        for (let i = 0; i < marks; i++) {
            const offset = (i - (marks - 1) / 2) * spacing;
            const barY = midY + offset;

            svg += `<line x1="${startX}" y1="${barY + slantY}" x2="${startX + length}" y2="${barY - slantY}" stroke="black" stroke-width="2" />\n`;
        }

        return svg;
    }
    private renderPedalSign(x: number, systemY: number, type: 'start' | 'stop'): string {
        const y = systemY + this.config.pedalSignOffsetY;
        return this.renderSmuflGlyph(resolvePedalGlyph(type), x, y, type === 'start' ? 24 : 18, `data-smufl-role="pedal"`);
    }

    private renderPedalLine(startX: number, endX: number, systemY: number): string {
        const y = systemY + this.config.pedalLineOffsetY;
        const height = 10;
        return `<path d="M${startX} ${y - height} L${startX} ${y} L${endX} ${y} L${endX} ${y - height}" stroke="black" stroke-width="1.5" fill="none"/>\n`;
    }
}
