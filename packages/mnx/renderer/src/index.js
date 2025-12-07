// @bun
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};

// ../renderer/src/index.ts
var GCLEF_PATH = "M376 415l25 -145c3 -18 3 -18 29 -18c147 0 241 -113 241 -241c0 -113 -67 -198 -168 -238c-14 -6 -15 -5 -13 -17c11 -62 29 -157 29 -214c0 -170 -130 -200 -197 -200c-151 0 -190 98 -190 163c0 62 40 115 107 115c61 0 96 -47 96 -102c0 -58 -36 -85 -67 -94c-23 -7 -32 -10 -32 -17c0 -13 26 -29 80 -29c59 0 159 18 159 166c0 47 -15 134 -27 201c-2 12 -4 11 -15 9c-20 -4 -46 -6 -69 -6c-245 0 -364 165 -364 339c0 202 153 345 297 464c12 10 11 12 9 24c-7 41 -14 106 -14 164c0 104 24 229 98 311c20 22 51 48 65 48c11 0 37 -28 52 -50c41 -60 65 -146 65 -233c0 -153 -82 -280 -190 -381c-6 -6 -8 -7 -6 -19zM470 943c-61 0 -133 -96 -133 -252c0 -32 2 -66 6 -92c2 -13 6 -14 13 -8c79 69 174 159 174 270c0 55 -27 82 -60 82zM361 262l-21 128c-2 11 -4 12 -14 4c-47 -38 -93 -75 -153 -142c-83 -94 -93 -173 -93 -232c0 -139 113 -236 288 -236c20 0 40 2 56 5c15 3 16 3 14 14l-50 298c-2 11 -4 12 -20 8c-61 -17 -100 -60 -100 -117c0 -46 30 -89 72 -107c7 -3 15 -6 15 -13c0 -6 -4 -11 -12 -11c-7 0 -19 3 -27 6c-68 23 -115 87 -115 177c0 85 57 164 145 194c18 6 18 5 15 24zM430 103l49 -285c2 -12 4 -12 16 -6c56 28 94 79 94 142c0 88 -67 156 -148 163c-12 1 -13 -2 -11 -14z";
var SHARP_PATH = "M76 250l0 -72l42 -13l0 72l-42 13zM156 226l0 -72l42 -13l0 72l-42 13zM76 438l0 -140l42 -13l0 140l-42 13zM156 414l0 -140l42 -13l0 140l-42 13zM76 130l80 -24l0 -34l-80 24l0 34zM198 259l-42 13l0 140l42 -13l0 -140zM30 361l46 -14l0 -140l-46 14l0 140zM198 94l-42 13l0 72l42 -13l0 -72zM30 196l46 -14l0 72l-46 14l0 -72zM76 486l80 -24l0 -34l-80 24l0 34z";
var FLAT_PATH = "M70 410c55 14 74 -35 74 -66c0 -46 -33 -99 -94 -119l0 185zM50 -105l0 360c6 1 12 2 18 2c77 0 119 -84 119 -151c0 -56 -29 -102 -79 -117l-38 -12l0 -82l-20 0z";
var NATURAL_PATH = "M70 338l0 -97l38 -12l0 97l-38 12zM70 216l0 -102l38 -11l0 101l-38 12zM108 81l0 -166l-20 0l0 160l-58 17l0 36l58 -18l0 97l-38 11l0 -96l-20 0l0 178l20 0l0 -160l58 -17l0 -36l-58 18l0 -95l38 -11l0 94l20 0z";

class Renderer {
  config = {
    pageWidth: 800,
    lineSpacing: 10,
    systemSpacing: 100,
    paddingX: 40,
    paddingY: 50,
    measurePadding: 15,
    clefWidth: 40,
    noteRadius: 5,
    stemLength: 35
  };
  render(score) {
    let svgContent = "";
    let currentY = this.config.paddingY;
    let maxX = 0;
    const globalPositions = new Map;
    const curveRequests = [];
    const pendingTremolos = new Map;
    score.parts.forEach((part, pIndex) => {
      let currentX = this.config.paddingX;
      let systemStartY = currentY;
      let isNewSystem = true;
      svgContent += `<text x="${this.config.paddingX}" y="${currentY - 15}" font-family="Arial" font-size="14">${part.name || part.id}</text>
`;
      part.measures.forEach((measure, mIndex) => {
        const measureWidth = this.calculateMeasureWidth(measure);
        if (currentX + measureWidth > this.config.pageWidth + this.config.paddingX && !isNewSystem) {
          svgContent += this.renderStaveLines(this.config.paddingX, systemStartY, currentX - this.config.paddingX);
          currentX = this.config.paddingX;
          currentY += this.config.systemSpacing;
          systemStartY = currentY;
          isNewSystem = true;
        }
        if (isNewSystem) {
          let clefSign = "G";
          const firstMeasure = part.measures[0];
          if (firstMeasure?.clefs && firstMeasure.clefs.length > 0) {
            clefSign = firstMeasure.clefs[0].clef.sign;
          }
          svgContent += this.renderClef(currentX + 10, currentY + 40, clefSign);
          currentX += this.config.clefWidth;
          const initialKey = firstMeasure?.attributes?.key;
          if (initialKey) {
            const keyWidth = this.renderKeySignature(currentX, currentY, initialKey);
            svgContent += keyWidth.svg;
            currentX += keyWidth.width;
          }
          const initialTime = firstMeasure?.attributes?.time;
          if (initialTime) {
            const timeWidth = this.renderTimeSignature(currentX, currentY, initialTime);
            svgContent += timeWidth.svg;
            currentX += timeWidth.width;
          }
        }
        const currentGlobalMeasure = score.global.measures[mIndex];
        svgContent += this.renderBarline(currentX, currentY, "start", currentGlobalMeasure);
        if (currentGlobalMeasure?.jumps) {
          svgContent += this.renderJumps(currentX, currentY, currentGlobalMeasure.jumps, "start");
        }
        isNewSystem = false;
        let noteX = currentX + this.config.measurePadding;
        const eventPositions = new Map;
        const beamedEventIds = new Set;
        if (measure.beams) {
          for (const beam of measure.beams) {
            for (const eventId of beam.events) {
              beamedEventIds.add(eventId);
            }
          }
        }
        if (measure.multimeasureRest) {
          const mmRest = measure.multimeasureRest;
          svgContent += this.renderMultimeasureRest(currentX + this.config.measurePadding, currentX + measureWidth - this.config.measurePadding, currentY, mmRest.duration);
        } else {
          const voice = measure.sequences[0];
          if (voice) {
            voice.content.forEach((item) => {
              if (item.notes && item.notes.length > 0) {
                const duration = item.duration?.base || "quarter";
                const eventId = item.id || `event-${noteX}`;
                const isBeamed = beamedEventIds.has(eventId);
                const chordResult = this.renderChordWithLayout(noteX, item.notes, duration, currentY, 1, isBeamed, eventId, part.id);
                svgContent += chordResult.svg;
                if (isBeamed && chordResult.layout) {
                  eventPositions.set(eventId, chordResult.layout);
                }
                if (chordResult.layout) {
                  const noteHeadY = chordResult.layout.stemUp ? chordResult.layout.stemTipY + this.config.stemLength : chordResult.layout.stemTipY - this.config.stemLength;
                  globalPositions.set(eventId, {
                    x: noteX,
                    y: noteHeadY,
                    stemUp: chordResult.layout.stemUp,
                    stemTipY: chordResult.layout.stemTipY
                  });
                }
                if (item.slurs && Array.isArray(item.slurs)) {
                  for (const slur of item.slurs) {
                    if (slur.target) {
                      curveRequests.push({
                        type: "slur",
                        sourceId: eventId,
                        targetId: slur.target,
                        side: slur.side || "up"
                      });
                    }
                  }
                }
                for (const note of item.notes) {
                  if (note.ties && Array.isArray(note.ties)) {
                    for (const tie of note.ties) {
                      if (tie.target) {
                        curveRequests.push({
                          type: "tie",
                          sourceId: note.id || eventId,
                          targetId: tie.target,
                          side: "auto"
                        });
                      }
                    }
                  }
                }
                if (item.tremolo) {
                  if (typeof item.tremolo === "number") {
                    if (chordResult.layout) {
                      svgContent += this.renderTremolo(noteX, chordResult.layout.stemTipY, chordResult.layout.stemUp, item.tremolo);
                    }
                  } else {
                    const t = item.tremolo;
                    if (t.type === "single" && chordResult.layout) {
                      svgContent += this.renderTremolo(noteX, chordResult.layout.stemTipY, chordResult.layout.stemUp, t.marks);
                    } else if (t.type === "start" && t.id) {
                      pendingTremolos.set(t.id, { sourceId: eventId, marks: t.marks });
                    } else if (t.type === "stop" && t.id) {
                      const startData = pendingTremolos.get(t.id);
                      if (startData) {
                        curveRequests.push({
                          type: "tremolo",
                          sourceId: startData.sourceId,
                          targetId: eventId,
                          marks: startData.marks
                        });
                        pendingTremolos.delete(t.id);
                      }
                    }
                  }
                }
                noteX += this.getNoteWidth(duration);
              } else if (item.rest) {
                const duration = item.duration?.base || "quarter";
                svgContent += this.renderRest(noteX, currentY, duration);
                noteX += this.getNoteWidth(duration);
              } else if (item.type === "tuplet" || item.type === "grace") {
                item.content.forEach((subItem) => {
                  if (subItem.notes && subItem.notes.length > 0) {
                    const duration = subItem.duration?.base || "eighth";
                    svgContent += this.renderChord(noteX, subItem.notes, duration, currentY, 0.7);
                    noteX += 20;
                  }
                });
              }
            });
          }
          if (measure.beams && eventPositions.size > 0) {
            for (const beam of measure.beams) {
              svgContent += this.renderBeam(beam.events, eventPositions);
            }
          }
          if (measure.ottavas) {
            for (const ottava of measure.ottavas) {
              const startX = currentX + this.config.measurePadding;
              const endX = currentX + measureWidth - this.config.measurePadding;
              svgContent += this.renderOttava(startX, endX, currentY, ottava.value);
            }
          }
          if (measure.pedals) {
            const pedalEvents = measure.pedals;
            pedalEvents.forEach((p, idx) => {
              const xOffset = idx * 20 + 10;
              const pX = currentX + this.config.measurePadding + xOffset;
              if (p.type === "start") {
                if (p.line) {
                  const endX = currentX + measureWidth - this.config.measurePadding;
                  svgContent += this.renderPedalLine(pX, endX, currentY);
                } else {
                  svgContent += this.renderPedalSign(pX, currentY, "start");
                }
              } else if (p.type === "stop" && !p.line) {
                svgContent += this.renderPedalSign(pX, currentY, "stop");
              }
            });
          }
        }
        currentX += measureWidth;
        if (currentX > maxX)
          maxX = currentX;
        const globalMeasure = score.global.measures[mIndex];
        svgContent += this.renderBarline(currentX, currentY, "end", globalMeasure);
        if (globalMeasure?.ending) {
          svgContent += this.renderEnding(currentX, measureWidth, currentY, globalMeasure.ending);
        }
        if (globalMeasure?.jumps) {
          svgContent += this.renderJumps(currentX, currentY, globalMeasure.jumps, "end");
        }
      });
      svgContent += this.renderStaveLines(this.config.paddingX, systemStartY, currentX - this.config.paddingX);
      currentY += this.config.systemSpacing;
    });
    for (const req of curveRequests) {
      const sourcePos = globalPositions.get(req.sourceId);
      const targetPos = globalPositions.get(req.targetId);
      if (sourcePos && targetPos) {
        if (req.type === "tie" || req.type === "slur") {
          svgContent += this.renderCurve(sourcePos, targetPos, req.type, req.side);
        } else if (req.type === "tremolo" && req.marks) {
          svgContent += this.renderMultiNoteTremolo(sourcePos, targetPos, req.marks);
        }
      }
    }
    const svgWidth = Math.max(maxX + this.config.paddingX, this.config.pageWidth + this.config.paddingX * 2);
    const svgHeight = currentY + 20;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}">
            ${svgContent}
        </svg>`;
  }
  renderClef(x, y, sign = "G") {
    const scale = 0.04;
    if (sign === "percussion") {
      return `<rect x="${x}" y="${y - 30}" width="10" height="20" fill="#666" />
`;
    } else if (sign === "F") {
      return `<text x="${x}" y="${y - 10}" font-family="Times New Roman" font-size="30" font-weight="bold">F</text>
`;
    }
    return `<g transform="translate(${x}, ${y}) scale(${scale})">
            <path d="${GCLEF_PATH}" fill="black" />
        </g>
`;
  }
  renderKeySignature(x, y, key) {
    let svg = "";
    let width = 0;
    const fifths = key.fifths || 0;
    const spacing = 12;
    if (fifths === 0)
      return { svg: "", width: 10 };
    const sharpYs = [0, 15, -5, 10, 25, 5, 20];
    const flatYs = [20, 5, 25, 10, 30, 15, 35];
    const symbol = fifths > 0 ? "\u266F" : "\u266D";
    const positions = fifths > 0 ? sharpYs : flatYs;
    const count = Math.abs(fifths);
    for (let i = 0;i < count; i++) {
      const symbolY = y + positions[i] + (fifths > 0 ? 5 : 5);
      svg += `<text x="${x + i * spacing}" y="${symbolY}" font-family="Times New Roman" font-size="20">${symbol}</text>
`;
    }
    width = count * spacing + 10;
    return { svg, width };
  }
  renderTimeSignature(x, y, time) {
    const beats = time.beats;
    const type = time["beat-type"];
    const fontSize = 32;
    const charX = x + 10;
    return {
      svg: `
            <text x="${charX}" y="${y + 18}" font-family="Times New Roman" font-weight="bold" font-size="${fontSize}" text-anchor="middle">${beats}</text>
            <text x="${charX}" y="${y + 38}" font-family="Times New Roman" font-weight="bold" font-size="${fontSize}" text-anchor="middle">${type}</text>
            `,
      width: 30
    };
  }
  calculateMeasureWidth(measure) {
    let width = this.config.measurePadding * 2;
    const voice = measure.sequences[0];
    if (voice) {
      voice.content.forEach((item) => {
        if (item.notes && item.notes.length > 0) {
          width += this.getNoteWidth(item.duration?.base || "quarter");
        } else if (item.rest) {
          width += this.getNoteWidth(item.duration?.base || "quarter");
        } else if (item.type === "tuplet" || item.type === "grace") {
          item.content.forEach(() => {
            width += 20;
          });
        }
      });
    }
    return Math.max(width, 60);
  }
  renderStaveLines(startX, y, length) {
    let svg = "";
    for (let i = 0;i < 5; i++) {
      const lineY = y + i * this.config.lineSpacing;
      svg += `<line x1="${startX}" y1="${lineY}" x2="${startX + length}" y2="${lineY}" stroke="black" stroke-width="1" />
`;
    }
    return svg;
  }
  renderBarline(x, y, position, globalMeasure) {
    const type = globalMeasure?.barline?.type;
    const spacing = this.config.lineSpacing;
    const topY = y;
    const bottomY = y + 4 * spacing;
    let svg = "";
    const drawLine = (lx, width) => `<line x1="${lx}" y1="${topY}" x2="${lx}" y2="${bottomY}" stroke="black" stroke-width="${width}" />
`;
    const drawDashedLine = (lx, width) => `<line x1="${lx}" y1="${topY}" x2="${lx}" y2="${bottomY}" stroke="black" stroke-width="${width}" stroke-dasharray="5,5" />
`;
    const drawDots = (dx) => `<circle cx="${dx}" cy="${y + 1.5 * spacing}" r="2" fill="black" />
` + `<circle cx="${dx}" cy="${y + 2.5 * spacing}" r="2" fill="black" />
`;
    if (position === "start") {
      if (type === "repeat-forward") {
        svg += drawLine(x, 3);
        svg += drawLine(x + 5, 1);
        svg += drawDots(x + 10);
        return svg;
      }
      return drawLine(x, 1);
    }
    if (type === "repeat-backward") {
      svg += drawDots(x - 10);
      svg += drawLine(x - 5, 1);
      svg += drawLine(x, 3);
    } else if (type === "final") {
      svg += drawLine(x - 5, 1);
      svg += drawLine(x, 3);
    } else if (type === "double") {
      svg += drawLine(x - 4, 1);
      svg += drawLine(x, 1);
    } else if (type === "dashed") {
      svg += drawDashedLine(x, 1);
    } else if (type === "repeat-forward") {
      svg += drawLine(x, 1);
    } else {
      svg += drawLine(x, 1);
    }
    return svg;
  }
  renderEnding(endX, width, y, ending) {
    const startX = endX - width;
    const bracketY = y - 20;
    const bracketHeight = 15;
    let svg = "";
    const label = ending.numbers ? ending.numbers.join(",") + "." : "";
    svg += `<polyline points="${startX},${bracketY + bracketHeight} ${startX},${bracketY} ${endX},${bracketY}" fill="none" stroke="black" stroke-width="1" />
`;
    if (!ending.open) {
      svg += `<line x1="${endX}" y1="${bracketY}" x2="${endX}" y2="${bracketY + bracketHeight}" stroke="black" stroke-width="1" />
`;
    }
    if (label) {
      svg += `<text x="${startX + 5}" y="${bracketY + 12}" font-family="Times New Roman" font-size="12">${label}</text>
`;
    }
    return svg;
  }
  renderJumps(x, y, jumps, position) {
    const topY = y - 10;
    let svg = "";
    const relevantJumps = jumps.filter((j) => position === "end" ? ["fine", "dc", "ds", "dc-al-fine", "ds-al-fine", "dc-al-coda", "ds-al-coda"].includes(j.type) : ["segno", "coda"].includes(j.type));
    relevantJumps.forEach((j, i) => {
      const currentY = topY - i * 15;
      let text = "";
      switch (j.type) {
        case "fine":
          text = "Fine";
          break;
        case "dc":
          text = "D.C.";
          break;
        case "ds":
          text = "D.S.";
          break;
        case "dc-al-fine":
          text = "D.C. al Fine";
          break;
        case "ds-al-fine":
          text = "D.S. al Fine";
          break;
        case "dc-al-coda":
          text = "D.C. al Coda";
          break;
        case "ds-al-coda":
          text = "D.S. al Coda";
          break;
      }
      if (text) {
        const anchor = position === "end" ? "end" : "start";
        svg += `<text x="${x}" y="${currentY}" font-family="Times New Roman" font-weight="bold" font-size="12" text-anchor="${anchor}">${text}</text>
`;
      } else if (j.type === "segno") {
        svg += this.renderSegno(x, currentY - 10);
      } else if (j.type === "coda") {
        svg += this.renderCoda(x, currentY - 10);
      }
    });
    return svg;
  }
  renderSegno(x, y) {
    const scale = 0.8;
    return `<g transform="translate(${x}, ${y}) scale(${scale})">
            <path d="M10,0 C15,0 20,5 20,10 C20,15 10,15 10,20 C10,25 15,30 20,30" fill="none" stroke="black" stroke-width="3"/>
            <path d="M20,0 C15,0 10,5 10,10 C10,15 20,15 20,20 C20,25 10,30 10,30" fill="none" stroke="black" stroke-width="3"/>
            <line x1="5" y1="35" x2="25" y2="-5" stroke="black" stroke-width="2"/>
            <circle cx="8" cy="15" r="2" fill="black"/>
            <circle cx="22" cy="15" r="2" fill="black"/>
        </g>
`;
  }
  renderCoda(x, y) {
    const scale = 0.8;
    return `<g transform="translate(${x}, ${y}) scale(${scale})">
            <ellipse cx="15" cy="15" rx="10" ry="14" stroke="black" stroke-width="2" fill="none"/>
            <line x1="15" y1="0" x2="15" y2="30" stroke="black" stroke-width="2"/>
            <line x1="2" y1="15" x2="28" y2="15" stroke="black" stroke-width="2"/>
        </g>
`;
  }
  renderChord(cx, notes, duration, staffTopY, scale = 1) {
    let svg = "";
    const r = this.config.noteRadius * scale;
    const halfSpace = this.config.lineSpacing / 2;
    const noteData = notes.map((n, i) => ({
      note: n,
      y: this.calculateY(n, staffTopY),
      originalIndex: i,
      offsetX: 0
    }));
    noteData.sort((a, b) => a.y - b.y);
    const minY = noteData[0].y;
    const maxY = noteData[noteData.length - 1].y;
    const middleLineY = staffTopY + 2 * this.config.lineSpacing;
    const topDistance = Math.abs(minY - middleLineY);
    const bottomDistance = Math.abs(maxY - middleLineY);
    const stemUp = bottomDistance >= topDistance;
    const noteHeadWidth = r * 2.2;
    for (let i = 1;i < noteData.length; i++) {
      const prevY = noteData[i - 1].y;
      const currY = noteData[i].y;
      const interval = currY - prevY;
      if (Math.abs(interval - halfSpace) < 2) {
        if (stemUp) {
          noteData[i].offsetX = -noteHeadWidth;
        } else {
          noteData[i].offsetX = noteHeadWidth;
        }
      }
    }
    noteData.forEach((nd) => {
      const noteX = cx + nd.offsetX;
      svg += this.renderNoteHead(noteX, nd.y, duration, r, nd.note.notehead, nd.note.color);
      svg += this.renderLedgerLines(noteX, nd.y, staffTopY);
    });
    if (duration !== "whole") {
      svg += this.renderChordStem(cx, minY, maxY, r, stemUp, scale);
      if (duration === "eighth" || duration === "16th" || duration === "32nd") {
        const flagY = stemUp ? minY : maxY;
        svg += this.renderFlag(cx, flagY, r, stemUp, duration, scale);
      }
    }
    return svg;
  }
  renderChordWithLayout(cx, notes, duration, staffTopY, scale = 1, isBeamed = false, eventId, partId) {
    let svg = "";
    const r = this.config.noteRadius * scale;
    const halfSpace = this.config.lineSpacing / 2;
    const noteData = notes.map((n, i) => ({
      note: n,
      y: this.calculateY(n, staffTopY),
      originalIndex: i,
      offsetX: 0
    }));
    noteData.sort((a, b) => a.y - b.y);
    const minY = noteData[0].y;
    const maxY = noteData[noteData.length - 1].y;
    const middleLineY = staffTopY + 2 * this.config.lineSpacing;
    const topDistance = Math.abs(minY - middleLineY);
    const bottomDistance = Math.abs(maxY - middleLineY);
    const stemUp = bottomDistance >= topDistance;
    const noteHeadWidth = r * 2.2;
    for (let i = 1;i < noteData.length; i++) {
      const interval = noteData[i].y - noteData[i - 1].y;
      if (Math.abs(interval - halfSpace) < 2) {
        noteData[i].offsetX = stemUp ? -noteHeadWidth : noteHeadWidth;
      }
    }
    noteData.forEach((nd) => {
      const noteX = cx + nd.offsetX;
      svg += this.renderNoteHead(noteX, nd.y, duration, r, nd.note.notehead, nd.note.color);
      svg += this.renderLedgerLines(noteX, nd.y, staffTopY);
      const acc = nd.note.accidentalDisplay;
      if (acc?.show && nd.note.pitch && nd.note.pitch.alter !== undefined) {
        const accX = noteX - 20 * scale;
        svg += this.renderAccidental(accX, nd.y, nd.note.pitch.alter, !!acc.cautionary, scale);
      }
    });
    let layout;
    if (duration !== "whole") {
      const stemLen = this.config.stemLength * scale;
      const stemX = stemUp ? cx + r : cx - r;
      const stemTipY = stemUp ? minY - stemLen : maxY + stemLen;
      svg += this.renderChordStem(cx, minY, maxY, r, stemUp, scale);
      layout = { x: stemX, stemTipY, stemUp };
      if (!isBeamed && (duration === "eighth" || duration === "16th" || duration === "32nd")) {
        const flagY = stemUp ? minY : maxY;
        svg += this.renderFlag(cx, flagY, r, stemUp, duration, scale);
      }
    }
    if (eventId || partId) {
      const attrs = [
        eventId ? `data-event-id="${eventId}"` : "",
        partId ? `data-part-id="${partId}"` : "",
        'class="note-group"',
        'style="cursor: pointer;"'
      ].filter(Boolean).join(" ");
      svg = `<g ${attrs}>${svg}</g>
`;
    }
    return { svg, layout };
  }
  renderBeam(eventIds, eventPositions) {
    if (eventIds.length < 2)
      return "";
    const positions = [];
    let stemUp = true;
    for (const eventId of eventIds) {
      const pos = eventPositions.get(eventId);
      if (pos) {
        positions.push({ x: pos.x, y: pos.stemTipY });
        stemUp = pos.stemUp;
      }
    }
    if (positions.length < 2)
      return "";
    const first = positions[0];
    const last = positions[positions.length - 1];
    const beamHeight = 5;
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    let svg = "";
    const y1 = first.y;
    const y2 = last.y;
    const offsetY = stemUp ? beamHeight : -beamHeight;
    svg += `<polygon points="${first.x},${y1} ${last.x},${y2} ${last.x},${y2 + offsetY} ${first.x},${y1 + offsetY}" fill="black" />
`;
    return svg;
  }
  renderCurve(source, target, type, side) {
    let curveUp = !source.stemUp;
    if (side === "up")
      curveUp = true;
    else if (side === "down")
      curveUp = false;
    const midX = (source.x + target.x) / 2;
    const midY = (source.y + target.y) / 2;
    const curveHeight = type === "tie" ? 12 : 18;
    const controlY = curveUp ? midY - curveHeight : midY + curveHeight;
    const yOffset = curveUp ? -3 : 3;
    const startY = source.y + yOffset;
    const endY = target.y + yOffset;
    const strokeWidth = type === "tie" ? 2 : 2.5;
    return `<path d="M${source.x},${startY} Q${midX},${controlY} ${target.x},${endY}" 
                fill="none" stroke="black" stroke-width="${strokeWidth}" stroke-linecap="round" />
`;
  }
  renderOttava(startX, endX, staffTopY, value) {
    let label;
    let above;
    switch (value) {
      case 1:
        label = "8va";
        above = true;
        break;
      case -1:
        label = "8vb";
        above = false;
        break;
      case 2:
        label = "15ma";
        above = true;
        break;
      case -2:
        label = "15mb";
        above = false;
        break;
      case 3:
        label = "22ma";
        above = true;
        break;
      case -3:
        label = "22mb";
        above = false;
        break;
      default:
        label = "8va";
        above = true;
    }
    const staffBottom = staffTopY + 4 * this.config.lineSpacing;
    const lineY = above ? staffTopY - 20 : staffBottom + 20;
    const textY = above ? lineY - 5 : lineY + 15;
    let svg = `<text x="${startX}" y="${textY}" font-family="Times New Roman" font-style="italic" font-size="12">${label}</text>
`;
    const lineStartX = startX + 25;
    svg += `<line x1="${lineStartX}" y1="${lineY}" x2="${endX}" y2="${lineY}" stroke="black" stroke-width="1" stroke-dasharray="4,3" />
`;
    const hookLength = above ? 8 : -8;
    svg += `<line x1="${endX}" y1="${lineY}" x2="${endX}" y2="${lineY + hookLength}" stroke="black" stroke-width="1" />
`;
    return svg;
  }
  renderMultimeasureRest(startX, endX, staffTopY, duration) {
    const centerY = staffTopY + 2 * this.config.lineSpacing;
    const restWidth = endX - startX;
    const lineHeight = 8;
    let svg = `<rect x="${startX}" y="${centerY - lineHeight / 2}" width="${restWidth}" height="${lineHeight}" fill="black" />
`;
    const bracketHeight = this.config.lineSpacing * 2;
    const bracketTop = centerY - bracketHeight / 2;
    svg += `<line x1="${startX}" y1="${bracketTop}" x2="${startX}" y2="${bracketTop + bracketHeight}" stroke="black" stroke-width="2" />
`;
    svg += `<line x1="${endX}" y1="${bracketTop}" x2="${endX}" y2="${bracketTop + bracketHeight}" stroke="black" stroke-width="2" />
`;
    const numberX = (startX + endX) / 2;
    const numberY = staffTopY - 10;
    svg += `<text x="${numberX}" y="${numberY}" font-family="Times New Roman" font-size="18" font-weight="bold" text-anchor="middle">${duration}</text>
`;
    return svg;
  }
  renderAccidental(x, y, alter, cautionary, scale) {
    let path = "";
    const scaleFactor = 0.04 * scale;
    let yOffset = 0;
    if (alter === 1) {
      path = SHARP_PATH;
      yOffset = 20 * scale;
    } else if (alter === -1) {
      path = FLAT_PATH;
      yOffset = 10 * scale;
    } else if (alter === 0) {
      path = NATURAL_PATH;
      yOffset = 15 * scale;
    } else {
      return "";
    }
    let svg = `<path d="${path}" transform="translate(${x}, ${y + yOffset}) scale(${scaleFactor}, -${scaleFactor})" fill="black" />
`;
    if (cautionary) {
      svg += `<text x="${x - 5}" y="${y + 5}" font-family="Arial" font-size="${20 * scale}">(</text>`;
      svg += `<text x="${x + 12}" y="${y + 5}" font-family="Arial" font-size="${20 * scale}">)</text>`;
    }
    return svg;
  }
  renderNoteHead(cx, cy, duration, r, type, color) {
    const baseColor = color || "black";
    const fill = duration === "whole" || duration === "half" ? "none" : baseColor;
    const stroke = baseColor;
    if (type === "x" || type === "circle-x") {
      const s = r * 1.2;
      let svg = `<line x1="${cx - s}" y1="${cy - s}" x2="${cx + s}" y2="${cy + s}" stroke="${stroke}" stroke-width="2" />
                       <line x1="${cx + s}" y1="${cy - s}" x2="${cx - s}" y2="${cy + s}" stroke="${stroke}" stroke-width="2" />
`;
      if (type === "circle-x") {
        svg += `<circle cx="${cx}" cy="${cy}" r="${r * 1.4}" fill="none" stroke="${stroke}" stroke-width="1.5" />
`;
      }
      return svg;
    } else if (type === "diamond") {
      const w = r * 1.3;
      const h = r * 1.3;
      return `<polygon points="${cx},${cy - h} ${cx + w},${cy} ${cx},${cy + h} ${cx - w},${cy}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" />
`;
    } else if (type === "triangle") {
      const h = r * 1.5;
      const w = r * 1.3;
      return `<polygon points="${cx},${cy - h} ${cx + w},${cy + h / 2} ${cx - w},${cy + h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" />
`;
    } else if (type === "slash") {
      const s = r * 1.2;
      return `<line x1="${cx + s}" y1="${cy - s}" x2="${cx - s}" y2="${cy + s}" stroke="${stroke}" stroke-width="2" />
`;
    }
    if (duration === "whole") {
      return `<ellipse cx="${cx}" cy="${cy}" rx="${r * 1.3}" ry="${r}" fill="none" stroke="black" stroke-width="1.5" />
`;
    } else if (duration === "half") {
      return `<ellipse cx="${cx}" cy="${cy}" rx="${r * 1.1}" ry="${r * 0.9}" fill="none" stroke="black" stroke-width="1.5" />
`;
    } else {
      return `<ellipse cx="${cx}" cy="${cy}" rx="${r * 1.1}" ry="${r * 0.9}" fill="black" />
`;
    }
  }
  renderChordStem(cx, minY, maxY, r, stemUp, scale) {
    const stemLen = this.config.stemLength * scale;
    if (stemUp) {
      const x = cx + r;
      const stemTop = minY - stemLen;
      return `<line x1="${x}" y1="${maxY}" x2="${x}" y2="${stemTop}" stroke="black" stroke-width="1.5" />
`;
    } else {
      const x = cx - r;
      const stemBottom = maxY + stemLen;
      return `<line x1="${x}" y1="${minY}" x2="${x}" y2="${stemBottom}" stroke="black" stroke-width="1.5" />
`;
    }
  }
  renderNote(cx, cy, duration, note, staffTopY, scale = 1) {
    return this.renderChord(cx, [note], duration, staffTopY, scale);
  }
  renderStem(cx, cy, r, stemUp, scale) {
    const stemLen = this.config.stemLength * scale;
    if (stemUp) {
      const x = cx + r;
      return `<line x1="${x}" y1="${cy}" x2="${x}" y2="${cy - stemLen}" stroke="black" stroke-width="1" />
`;
    } else {
      const x = cx - r;
      return `<line x1="${x}" y1="${cy}" x2="${x}" y2="${cy + stemLen}" stroke="black" stroke-width="1" />
`;
    }
  }
  renderFlag(cx, cy, r, stemUp, duration, scale) {
    const stemLen = this.config.stemLength * scale;
    const numFlags = duration === "eighth" ? 1 : duration === "16th" ? 2 : 3;
    let svg = "";
    for (let i = 0;i < numFlags; i++) {
      const flagOffset = i * 6;
      if (stemUp) {
        const x = cx + r;
        const flagY = cy - stemLen + flagOffset;
        svg += `<path d="M${x},${flagY} Q${x + 10},${flagY + 8} ${x + 5},${flagY + 15}" fill="none" stroke="black" stroke-width="1.5" />
`;
      } else {
        const x = cx - r;
        const flagY = cy + stemLen - flagOffset;
        svg += `<path d="M${x},${flagY} Q${x - 10},${flagY - 8} ${x - 5},${flagY - 15}" fill="none" stroke="black" stroke-width="1.5" />
`;
      }
    }
    return svg;
  }
  renderLedgerLines(cx, cy, staffTopY) {
    let svg = "";
    const topLine = staffTopY;
    const bottomLine = staffTopY + 4 * this.config.lineSpacing;
    const ledgerWidth = this.config.noteRadius * 2.5;
    if (cy < topLine) {
      for (let y = topLine - this.config.lineSpacing;y >= cy - this.config.lineSpacing / 2; y -= this.config.lineSpacing) {
        svg += `<line x1="${cx - ledgerWidth}" y1="${y}" x2="${cx + ledgerWidth}" y2="${y}" stroke="black" stroke-width="1" />
`;
      }
    }
    if (cy > bottomLine) {
      for (let y = bottomLine + this.config.lineSpacing;y <= cy + this.config.lineSpacing / 2; y += this.config.lineSpacing) {
        svg += `<line x1="${cx - ledgerWidth}" y1="${y}" x2="${cx + ledgerWidth}" y2="${y}" stroke="black" stroke-width="1" />
`;
      }
    }
    return svg;
  }
  renderRest(x, staffTopY, duration) {
    const centerY = staffTopY + 2 * this.config.lineSpacing;
    if (duration === "whole") {
      return `<rect x="${x}" y="${staffTopY + this.config.lineSpacing}" width="12" height="5" fill="black" />
`;
    } else if (duration === "half") {
      return `<rect x="${x}" y="${staffTopY + 2 * this.config.lineSpacing - 5}" width="12" height="5" fill="black" />
`;
    } else if (duration === "quarter") {
      const topY = staffTopY + this.config.lineSpacing;
      return `<path d="M${x + 5},${topY} 
                     Q${x + 12},${topY + 8} ${x + 6},${topY + 12} 
                     Q${x + 2},${topY + 15} ${x + 8},${topY + 20} 
                     Q${x + 10},${topY + 25} ${x + 4},${topY + 22} 
                     L${x + 6},${topY + 30}" 
                     fill="none" stroke="black" stroke-width="2" stroke-linecap="round" />
`;
    } else {
      const topY = staffTopY + 2 * this.config.lineSpacing;
      return `<g transform="translate(${x}, ${topY})">
                <circle cx="4" cy="2" r="3.5" fill="black"/>
                <path d="M7,2 Q10,8 4,15" fill="none" stroke="black" stroke-width="2"/>
            </g>
`;
    }
  }
  getNoteWidth(duration) {
    switch (duration) {
      case "whole":
        return 60;
      case "half":
        return 45;
      case "quarter":
        return 35;
      case "eighth":
        return 25;
      default:
        return 20;
    }
  }
  calculateY(note, staffTopY) {
    const stepMap = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
    let step = "B";
    let octave = 4;
    if (note.pitch) {
      step = note.pitch.step;
      octave = note.pitch.octave;
    } else if (note.unpitched) {
      step = note.unpitched.step;
      octave = note.unpitched.octave;
    } else {
      return staffTopY + 20;
    }
    const absoluteStep = octave * 7 + stepMap[step];
    const g4Step = 4 * 7 + 4;
    const diff = absoluteStep - g4Step;
    const g4Y = staffTopY + 3 * this.config.lineSpacing;
    return g4Y - diff * (this.config.lineSpacing / 2);
  }
  renderTremolo(x, stemTipY, stemUp, marks) {
    const spacing = 4;
    const length = 12;
    const slant = 3;
    const startX = x - length / 2;
    const yOffset = stemUp ? 15 : -15;
    const centerY = stemTipY + yOffset;
    let svg = "";
    for (let i = 0;i < marks; i++) {
      const y = centerY + i * spacing * (stemUp ? 1 : -1);
      svg += `<line x1="${startX}" y1="${y + slant}" x2="${startX + length}" y2="${y - slant}" stroke="black" stroke-width="2" />
`;
    }
    return svg;
  }
  renderMultiNoteTremolo(sourcePos, targetPos, marks) {
    const midX = (sourcePos.x + targetPos.x) / 2;
    const midY = (sourcePos.y + targetPos.y) / 2;
    const length = (targetPos.x - sourcePos.x) * 0.6;
    const startX = midX - length / 2;
    let svg = "";
    const spacing = 6;
    const slantY = 4;
    for (let i = 0;i < marks; i++) {
      const offset = (i - (marks - 1) / 2) * spacing;
      const barY = midY + offset;
      svg += `<line x1="${startX}" y1="${barY + slantY}" x2="${startX + length}" y2="${barY - slantY}" stroke="black" stroke-width="2" />
`;
    }
    return svg;
  }
  renderPedalSign(x, systemY, type) {
    const y = systemY + 50;
    const text = type === "start" ? "Ped." : "*";
    const fontSize = 20;
    const fontStyle = "italic";
    return `<text x="${x}" y="${y}" font-family="Times New Roman" font-style="${fontStyle}" font-size="${fontSize}">${text}</text>
`;
  }
  renderPedalLine(startX, endX, systemY) {
    const y = systemY + 50;
    const height = 10;
    return `<path d="M${startX} ${y - height} L${startX} ${y} L${endX} ${y} L${endX} ${y - height}" stroke="black" stroke-width="1.5" fill="none"/>
`;
  }
}
export {
  Renderer
};
