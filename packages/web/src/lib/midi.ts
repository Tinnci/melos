import { getDurationInBeats, getTupletScale, type Note, type NoteValue, type Score } from "@melos/core"
import { pitchToMidi } from "@melos/player"

const TICKS_PER_BEAT = 480
const DEFAULT_VELOCITY = 88

interface TimedEvent {
    beats: number
    notes?: Note[]
}

class MidiTrackWriter {
    private bytes: number[] = []
    private pendingRestTicks = 0

    setName(name: string) {
        this.addMetaText(0x03, name)
    }

    setProgram(program: number) {
        this.addEvent(0, 0xc0, clamp7Bit(program))
    }

    addRest(ticks: number) {
        this.pendingRestTicks += Math.max(0, ticks)
    }

    addChord(pitches: number[], ticks: number) {
        if (pitches.length === 0 || ticks <= 0) {
            this.addRest(ticks)
            return
        }

        pitches.forEach((pitch, index) => {
            this.addEvent(index === 0 ? this.consumePendingRest() : 0, 0x90, clamp7Bit(pitch), DEFAULT_VELOCITY)
        })

        pitches.forEach((pitch, index) => {
            this.addEvent(index === 0 ? ticks : 0, 0x80, clamp7Bit(pitch), 0)
        })
    }

    finish(): Uint8Array {
        this.addEvent(this.consumePendingRest(), 0xff, 0x2f, 0x00)
        return Uint8Array.from(this.bytes)
    }

    private addMetaText(type: number, text: string) {
        const encoded = new TextEncoder().encode(text)
        this.bytes.push(...writeVariableLength(0), 0xff, type, ...writeVariableLength(encoded.length), ...encoded)
    }

    private addEvent(deltaTicks: number, ...event: number[]) {
        this.bytes.push(...writeVariableLength(deltaTicks), ...event)
    }

    private consumePendingRest(): number {
        const ticks = this.pendingRestTicks
        this.pendingRestTicks = 0
        return ticks
    }
}

export function createMidiFile(score: Score): Uint8Array {
    const tracks = score.parts.flatMap((part, partIndex) => {
        const voiceCount = getVoiceCount(part.measures)

        return Array.from({ length: voiceCount }, (_, voiceIndex) => {
            const track = new MidiTrackWriter()
            track.setName(`${part.name || `Part ${partIndex + 1}`} - Voice ${voiceIndex + 1}`)
            track.setProgram(0)

            for (const measure of part.measures) {
                const measureBeats = getMeasureDurationBeats(measure.sequences)
                const events = extractTimedEvents(measure.sequences[voiceIndex]?.content ?? [])
                const usedBeats = writeTimedEvents(track, events)

                if (usedBeats < measureBeats) {
                    track.addRest(beatsToTicks(measureBeats - usedBeats))
                }
            }

            return track.finish()
        })
    })

    return concatBytes([
        ascii("MThd"),
        writeUint32(6),
        writeUint16(1),
        writeUint16(tracks.length),
        writeUint16(TICKS_PER_BEAT),
        ...tracks.map((track) => concatBytes([ascii("MTrk"), writeUint32(track.length), track])),
    ])
}

function writeTimedEvents(track: MidiTrackWriter, events: TimedEvent[]): number {
    let usedBeats = 0

    for (const event of events) {
        const ticks = beatsToTicks(event.beats)
        const pitches = event.notes
            ?.map((note) => note.pitch ? pitchToMidi(note.pitch) : null)
            .filter((pitch): pitch is number => pitch !== null) ?? []

        if (pitches.length > 0) {
            track.addChord(pitches, ticks)
        } else {
            track.addRest(ticks)
        }

        usedBeats += event.beats
    }

    return usedBeats
}

function extractTimedEvents(content: unknown[], scale = 1): TimedEvent[] {
    const events: TimedEvent[] = []

    for (const item of content) {
        if (!isRecord(item)) continue

        if (isTimedScoreEvent(item)) {
            events.push({
                beats: getDurationInBeats(item.duration) * scale,
                notes: item.notes,
            })
            continue
        }

        if (item.type === "tuplet" && Array.isArray(item.content)) {
            events.push(...extractTimedEvents(item.content, scale * getTupletScale(item)))
        }
    }

    return events
}

function getMeasureDurationBeats(sequences: { content: unknown[] }[]): number {
    const durations = sequences.map((sequence) =>
        extractTimedEvents(sequence.content).reduce((total, event) => total + event.beats, 0)
    )

    return Math.max(4, ...durations)
}

function getVoiceCount(measures: { sequences: unknown[] }[]): number {
    return Math.max(1, ...measures.map((measure) => measure.sequences.length))
}

function isTimedScoreEvent(value: Record<string, unknown>): value is { duration: NoteValue; notes?: Note[] } {
    return isNoteValue(value.duration)
}

function isNoteValue(value: unknown): value is NoteValue {
    return isRecord(value) && typeof value.base === "string"
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null
}

function beatsToTicks(beats: number): number {
    return Math.max(0, Math.round(beats * TICKS_PER_BEAT))
}

function clamp7Bit(value: number): number {
    return Math.max(0, Math.min(127, Math.round(value)))
}

function ascii(value: string): Uint8Array {
    return Uint8Array.from([...value].map((char) => char.charCodeAt(0)))
}

function writeUint16(value: number): Uint8Array {
    return Uint8Array.from([(value >> 8) & 0xff, value & 0xff])
}

function writeUint32(value: number): Uint8Array {
    return Uint8Array.from([
        (value >> 24) & 0xff,
        (value >> 16) & 0xff,
        (value >> 8) & 0xff,
        value & 0xff,
    ])
}

function writeVariableLength(value: number): number[] {
    let buffer = value & 0x7f
    const bytes: number[] = []

    while ((value >>= 7) > 0) {
        buffer <<= 8
        buffer |= (value & 0x7f) | 0x80
    }

    while (true) {
        bytes.push(buffer & 0xff)
        if (buffer & 0x80) {
            buffer >>= 8
        } else {
            break
        }
    }

    return bytes
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
    const totalLength = chunks.reduce((total, chunk) => total + chunk.length, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0

    for (const chunk of chunks) {
        result.set(chunk, offset)
        offset += chunk.length
    }

    return result
}
