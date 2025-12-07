import type { Score } from '@melos/core';
import { Renderer } from '@melos/renderer';
import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import MidiWriter from 'midi-writer-js';
import { pitchToMidi, getDurationInBeats } from '@melos/player';

/**
 * Convert beats to midi-writer-js duration string.
 * midi-writer-js uses: 1=whole, 2=half, 4=quarter, 8=eighth, 16=sixteenth, 32=thirty-second
 * Or Tn where n is explicit ticks (T128 = 1 beat at 128 ticks per beat)
 */
function beatsToMidiDuration(beats: number): string {
    // Use tick notation for precision: 128 ticks = 1 quarter note
    const ticks = Math.round(beats * 128);
    return `T${ticks}`;
}

/**
 * Export the given score to a PDF file.
 */
export async function exportToPdf(score: Score, filename: string = 'score') {
    // 1. Render SVG
    const renderer = new Renderer();
    const svgString = renderer.render(score);

    // 2. Create localized DOM container
    const container = document.createElement('div');
    container.innerHTML = svgString;
    const svgElement = container.firstElementChild as SVGSVGElement;

    if (!svgElement) {
        throw new Error("Failed to generate SVG for PDF export.");
    }

    // 3. Initialize PDF (A4 Portrait)
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;

    // 4. Convert SVG to PDF - scale to fit width within margins
    const svgWidth = parseFloat(svgElement.getAttribute('width') || '100');
    const svgHeight = parseFloat(svgElement.getAttribute('height') || '100');

    const targetWidth = pageWidth - (margin * 2);
    const scale = targetWidth / svgWidth;
    const targetHeight = svgHeight * scale;

    await svg2pdf(svgElement, doc, {
        x: margin,
        y: margin,
        width: targetWidth,
        height: targetHeight
    });

    // 5. Download
    doc.save(`${filename}.pdf`);
}

/**
 * Export the given score to a MIDI file.
 */
export function exportToMidi(score: Score, filename: string = 'score') {
    const tracks: InstanceType<typeof MidiWriter.Track>[] = [];

    // Each Part becomes one or more tracks (one per voice/sequence)
    score.parts.forEach((part, partIndex) => {
        // Find max voices across all measures
        let maxVoices = 1;
        part.measures.forEach(m => {
            if (m.sequences.length > maxVoices) maxVoices = m.sequences.length;
        });

        // Create a track for each voice
        for (let v = 0; v < maxVoices; v++) {
            const track = new MidiWriter.Track();

            // Set instrument (Piano = 0)
            track.addEvent(new MidiWriter.ProgramChangeEvent({ instrument: 0 }));
            track.addTrackName(`Part ${partIndex + 1} - Voice ${v + 1}`);

            // Process each measure
            part.measures.forEach(measure => {
                // Calculate measure duration for padding
                let maxDurationBeats = 0;
                measure.sequences.forEach(s => {
                    let seqBeats = 0;
                    s.content.forEach(ev => {
                        // @ts-expect-error - Loose typing in core
                        if (ev.duration) seqBeats += getDurationInBeats(ev.duration);
                    });
                    if (seqBeats > maxDurationBeats) maxDurationBeats = seqBeats;
                });
                if (maxDurationBeats === 0) maxDurationBeats = 4; // Default 4/4

                const seq = measure.sequences[v];

                if (seq) {
                    let currentBeats = 0;

                    seq.content.forEach(event => {
                        // @ts-expect-error - Loose typing
                        const duration = event.duration;
                        const beatLen = getDurationInBeats(duration);
                        const midiDuration = beatsToMidiDuration(beatLen);

                        // @ts-expect-error - Loose typing
                        const notes = event.notes;

                        if (notes && notes.length > 0) {
                            const pitches: number[] = notes
                                .map((n: { pitch?: { step: string; octave: number; alter?: number } }) => {
                                    if (!n.pitch) return null;
                                    // Cast step to the expected literal type
                                    const pitch = {
                                        step: n.pitch.step as "C" | "D" | "E" | "F" | "G" | "A" | "B",
                                        octave: n.pitch.octave,
                                        alter: n.pitch.alter
                                    };
                                    return pitchToMidi(pitch);
                                })
                                .filter((p: number | null): p is number => p !== null);

                            if (pitches.length > 0) {
                                track.addEvent(new MidiWriter.NoteEvent({
                                    pitch: pitches,
                                    duration: midiDuration
                                }));
                            } else {
                                // Rest: use NoteEvent with wait property
                                track.addEvent(new MidiWriter.NoteEvent({
                                    pitch: [60], // placeholder
                                    duration: midiDuration,
                                    wait: midiDuration,
                                    velocity: 0 // silent
                                }));
                            }
                        } else {
                            // Rest event
                            track.addEvent(new MidiWriter.NoteEvent({
                                pitch: [60],
                                duration: midiDuration,
                                wait: midiDuration,
                                velocity: 0
                            }));
                        }
                        currentBeats += beatLen;
                    });

                    // Pad if sequence shorter than measure
                    if (currentBeats < maxDurationBeats) {
                        const diff = maxDurationBeats - currentBeats;
                        const padDuration = beatsToMidiDuration(diff);
                        track.addEvent(new MidiWriter.NoteEvent({
                            pitch: [60],
                            duration: padDuration,
                            wait: padDuration,
                            velocity: 0
                        }));
                    }
                } else {
                    // No sequence for this voice - add rest for full measure
                    const restDuration = beatsToMidiDuration(maxDurationBeats);
                    track.addEvent(new MidiWriter.NoteEvent({
                        pitch: [60],
                        duration: restDuration,
                        wait: restDuration,
                        velocity: 0
                    }));
                }
            });

            tracks.push(track);
        }
    });

    // Create writer with all tracks
    const writer = new MidiWriter.Writer(tracks);

    // Trigger download
    const dataUri = writer.dataUri();
    const a = document.createElement('a');
    a.href = dataUri;
    a.download = `${filename}.mid`;
    a.click();
}
