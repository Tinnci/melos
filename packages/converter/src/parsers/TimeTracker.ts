import type { RhythmicPosition } from "@melos/core";

export class TimeTracker {
    private ticks: Record<string, number> = {}; // voiceId -> accumulated ticks
    private documentTicks = 0;
    private divisions: number;

    constructor(divisions: number) {
        this.divisions = divisions;
    }

    /**
     * Advance the time cursor for a specific voice.
     * @param voiceId The voice identifier.
     * @param durationTicks The amount of ticks to add.
     */
    advance(voiceId: string, durationTicks: number) {
        if (this.ticks[voiceId] === undefined) {
            this.ticks[voiceId] = 0;
        }
        this.ticks[voiceId] += durationTicks;
        this.documentTicks += durationTicks;
    }

    /**
     * Move the MusicXML document cursor backward. This is used by multi-voice
     * MusicXML streams that emit voice 1, then back up to write voice 2.
     */
    backup(durationTicks: number) {
        this.documentTicks = Math.max(0, this.documentTicks - durationTicks);
    }

    /**
     * Move the MusicXML document cursor forward. If the forward element is
     * associated with a voice, keep that voice cursor aligned too.
     */
    forward(durationTicks: number, voiceId?: string) {
        this.documentTicks += durationTicks;

        if (voiceId) {
            if (this.ticks[voiceId] === undefined) {
                this.ticks[voiceId] = 0;
            }
            this.ticks[voiceId] += durationTicks;
        }
    }

    /**
     * Get the current rhythmic position for a specific voice.
     * @param voiceId The voice identifier.
     * @returns RhythmicPosition object suitable for MNX.
     */
    getCurrentPosition(voiceId?: string): RhythmicPosition {
        const currentTicks = voiceId ? this.ticks[voiceId] || 0 : this.documentTicks;
        const wholeNoteTicks = this.divisions * 4;

        // Return raw fraction: [accumulatedTicks, wholeNoteTicks]
        return {
            fraction: [currentTicks, wholeNoteTicks],
        };
    }

    /**
     * Get raw ticks for debugging or internal comparison.
     */
    getCurrentTicks(voiceId: string): number {
        return this.ticks[voiceId] || 0;
    }

    getDivisions(): number {
        return this.divisions;
    }
}
