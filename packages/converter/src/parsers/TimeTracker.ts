import type { RhythmicPosition } from "@melos/core";

export class TimeTracker {
    private ticks: Record<string, number> = {}; // voiceId -> accumulated ticks

    constructor(private divisions: number) { }

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
    }

    /**
     * Get the current rhythmic position for a specific voice.
     * @param voiceId The voice identifier.
     * @returns RhythmicPosition object suitable for MNX.
     */
    getCurrentPosition(voiceId: string): RhythmicPosition {
        const currentTicks = this.ticks[voiceId] || 0;
        const wholeNoteTicks = this.divisions * 4;

        // Return raw fraction: [accumulatedTicks, wholeNoteTicks]
        return {
            fraction: [currentTicks, wholeNoteTicks]
        };
    }

    /**
     * Get raw ticks for debugging or internal comparison.
     */
    getCurrentTicks(voiceId: string): number {
        return this.ticks[voiceId] || 0;
    }
}
