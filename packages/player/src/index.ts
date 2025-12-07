import { Score, Pitch, Note } from "@melos/core";
import { pitchToMidi, midiToFreq, getDurationInBeats } from "./utils";

export class AudioPlayer {
    private ctx: AudioContext | null = null;
    private tempo: number = 120; // BPM

    constructor() {
        if (typeof window !== "undefined" && (window.AudioContext || (window as any).webkitAudioContext)) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            this.ctx = new AudioContextClass();
        }
    }

    /**
     * Set the playback tempo in BPM.
     */
    public setTempo(bpm: number) {
        this.tempo = bpm;
    }

    /**
     * Check if audio playback is supported in this environment.
     */
    public isSupported(): boolean {
        return !!this.ctx;
    }

    /**
     * Initialize AudioContext (must be called after user interaction usually).
     */
    public async init() {
        if (this.ctx && this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    }

    /**
     * Stop all sounds (simplified, just closes context, or tracks nodes to stop).
     * For MVP, we might just not support robust stop/seek yet.
     */
    public stop() {
        if (this.ctx) {
            this.ctx.close();
            // Re-create for next play
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            this.ctx = new AudioContextClass();
        }
    }

    public play(score: Score) {
        if (!this.ctx) {
            console.warn("AudioContext not available. Playback disabled.");
            return;
        }

        // Start slightly in the future to allow scheduling
        const startTime = this.ctx.currentTime + 0.1;

        // Iterate over all parts
        score.parts.forEach(part => {
            // Each part has its own timeline
            // We assume measures are sequential and no gaps/overlaps for MVP simplified logic

            let currentTime = startTime;

            part.measures.forEach(measure => {
                // For each measure, we might have multiple sequences (voices)
                // They run parallel within the measure.
                // We track the max duration of the measure to advance currentTime correctly.
                let maxMeasureDuration = 0;

                measure.sequences.forEach(seq => {
                    let seqTime = currentTime;

                    seq.content.forEach(event => {
                        // Type guard or cast
                        // Check if it is a complex event type (tuplet, grace, dynamic)
                        if ('type' in event && (event.type === 'dynamic' || event.type === 'tuplet' || event.type === 'grace')) {
                            // TODO: Handle these events
                            return;
                        }

                        // Treat as BaseEvent
                        const baseEvent = event as any;

                        const beats = getDurationInBeats(baseEvent.duration);
                        const durationSecs = beats * (60 / this.tempo);

                        if (baseEvent.notes) {
                            baseEvent.notes.forEach((note: Note) => {
                                if (note.pitch) {
                                    this.scheduleNote(note.pitch, seqTime, durationSecs);
                                }
                            });
                        }

                        seqTime += durationSecs;
                    });

                    // Update max duration found in this measure
                    const seqDuration = seqTime - currentTime;
                    if (seqDuration > maxMeasureDuration) {
                        maxMeasureDuration = seqDuration;
                    }
                });

                // Advance global time by measure duration
                // Fallback if empty measure: assume 4/4 (4 beats)
                if (maxMeasureDuration === 0) {
                    maxMeasureDuration = 4 * (60 / this.tempo);
                }

                currentTime += maxMeasureDuration;
            });
        });
    }

    private scheduleNote(pitch: Pitch, startTime: number, duration: number) {
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.value = midiToFreq(pitchToMidi(pitch));

        // Envelope
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.2, startTime + 0.05); // Attack
        gain.gain.setValueAtTime(0.2, startTime + duration - 0.05); // Sustain
        gain.gain.linearRampToValueAtTime(0, startTime + duration); // Release

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration + 0.1);
    }
}

export * from './utils';

