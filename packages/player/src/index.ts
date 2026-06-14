import type { Score, Pitch } from "@melos/core";
import { createPlaybackSchedule } from "./schedule";
import { pitchToMidi, midiToFreq } from "./utils";

export class AudioPlayer {
    private ctx: AudioContext | null = null;
    private tempo: number = 120; // BPM

    constructor() {
        if (
            typeof window !== "undefined" &&
            (window.AudioContext || (window as any).webkitAudioContext)
        ) {
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
        if (this.ctx && this.ctx.state === "suspended") {
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
        const schedule = createPlaybackSchedule(score, {
            tempo: this.tempo,
            startTime,
        });

        schedule.forEach((event) => {
            this.scheduleNote(event.pitch, event.startTime, event.duration);
        });
    }

    private scheduleNote(pitch: Pitch, startTime: number, duration: number) {
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "triangle";
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

export * from "./schedule";
export * from "./utils";
