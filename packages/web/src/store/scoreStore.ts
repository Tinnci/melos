/**
 * Melos Studio – Score Store
 * Zustand-based state management for the MNX score editor
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { type Score, ScoreBuilder } from '@melos/core'

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface ScoreMetadata {
    title: string
    composer: string
    arranger: string
    copyright: string
}

export interface PartInfo {
    id: string
    name: string
    shortName: string
    color: string
}

export interface ScoreState {
    // Core Data
    score: Score | null
    metadata: ScoreMetadata
    parts: PartInfo[]

    // UI State
    selectedPartId: string | null
    isLoading: boolean
    error: string | null

    // History
    history: Score[]
    historyIndex: number

    // Actions
    setScore: (score: Score) => void
    clearScore: () => void
    updateMetadata: (metadata: Partial<ScoreMetadata>) => void
    selectPart: (partId: string | null) => void
    setLoading: (loading: boolean) => void
    setError: (error: string | null) => void

    // History Actions
    undo: () => void
    redo: () => void
    canUndo: () => boolean
    canRedo: () => boolean

    // Score Mutation Actions
    updateTimeSignature: (count: number, unit: number) => void
    updateKeySignature: (fifths: number) => void
    updatePartName: (partId: string, name: string) => void
}

// ═══════════════════════════════════════════════════════════════════════════
// Default Values
// ═══════════════════════════════════════════════════════════════════════════

const defaultMetadata: ScoreMetadata = {
    title: 'Untitled Score',
    composer: '',
    arranger: '',
    copyright: '',
}

// Part colors for visual distinction
const partColors = [
    '#6366f1', // Indigo
    '#22d3ee', // Cyan
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#14b8a6', // Teal
]

// ═══════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════

function extractPartsFromScore(score: Score): PartInfo[] {
    if (!score.parts) return []

    return score.parts.map((part, index) => ({
        id: part.id || `part-${index}`,
        name: part.name || `Part ${index + 1}`,
        shortName: part['short-name'] || '',
        color: partColors[index % partColors.length],
    }))
}

// ═══════════════════════════════════════════════════════════════════════════
// Store
// ═══════════════════════════════════════════════════════════════════════════

export const useScoreStore = create<ScoreState>()(
    subscribeWithSelector((set, get) => ({
        // Initial State
        score: null,
        metadata: defaultMetadata,
        parts: [],
        selectedPartId: null,
        isLoading: false,
        error: null,
        history: [],
        historyIndex: -1,

        // Actions
        setScore: (score) => {
            const currentScore = get().score
            const newHistory = currentScore
                ? [...get().history.slice(0, get().historyIndex + 1), currentScore]
                : get().history

            set({
                score,
                parts: extractPartsFromScore(score),
                error: null,
                history: newHistory,
                historyIndex: newHistory.length,
            })
        },

        clearScore: () => {
            set({
                score: null,
                metadata: defaultMetadata,
                parts: [],
                selectedPartId: null,
                history: [],
                historyIndex: -1,
            })
        },

        updateMetadata: (metadata) => {
            set((state) => ({
                metadata: { ...state.metadata, ...metadata },
            }))
        },

        selectPart: (partId) => {
            set({ selectedPartId: partId })
        },

        setLoading: (isLoading) => {
            set({ isLoading })
        },

        setError: (error) => {
            set({ error, isLoading: false })
        },

        // History
        undo: () => {
            const { history, historyIndex } = get()
            if (historyIndex > 0) {
                const previousScore = history[historyIndex - 1]
                set({
                    score: previousScore,
                    parts: extractPartsFromScore(previousScore),
                    historyIndex: historyIndex - 1,
                })
            }
        },

        redo: () => {
            const { history, historyIndex } = get()
            if (historyIndex < history.length - 1) {
                const nextScore = history[historyIndex + 1]
                set({
                    score: nextScore,
                    parts: extractPartsFromScore(nextScore),
                    historyIndex: historyIndex + 1,
                })
            }
        },

        canUndo: () => get().historyIndex > 0,
        canRedo: () => get().historyIndex < get().history.length - 1,

        // Score Mutations
        updateTimeSignature: (count, unit) => {
            const { score, setScore } = get()
            if (!score) return

            const updatedScore: Score = {
                ...score,
                global: {
                    ...score.global,
                    measures: score.global.measures.map((measure, index) =>
                        index === 0
                            ? { ...measure, time: { count, unit } }
                            : measure
                    ),
                },
            }
            setScore(updatedScore)
        },

        updateKeySignature: (fifths) => {
            const { score, setScore } = get()
            if (!score) return

            const updatedScore: Score = {
                ...score,
                global: {
                    ...score.global,
                    measures: score.global.measures.map((measure, index) =>
                        index === 0
                            ? { ...measure, key: { fifths } }
                            : measure
                    ),
                },
            }
            setScore(updatedScore)
        },

        updatePartName: (partId: string, name: string) => {
            const { score, setScore } = get()
            if (!score) return

            const updatedScore: Score = {
                ...score,
                parts: score.parts.map((part) =>
                    part.id === partId ? { ...part, name } : part
                ),
            }
            // Update parts derived list as well is handled by setScore logic
            setScore(updatedScore)
        },

    }))
)

// ═══════════════════════════════════════════════════════════════════════════
// Demo Score Generator
// ═══════════════════════════════════════════════════════════════════════════

export function createDemoScore(): Score {
    const builder = new ScoreBuilder()

    builder.addGlobalMeasure({
        index: 1,
        time: { count: 4, unit: 4 },
        key: { fifths: 0 },
    })

    builder.addGlobalMeasure({ index: 2, time: { count: 4, unit: 4 } })
    builder.addGlobalMeasure({ index: 3, time: { count: 4, unit: 4 } })
    builder.addGlobalMeasure({ index: 4, time: { count: 4, unit: 4 } })

    builder.addPart('Piano', (part) => {
        part.setShortName('Pno.')

        part.addMeasure(1, (m) => {
            m.addSequence((seq) => {
                seq.note('C', 5, 'quarter')
                seq.note('D', 5, 'quarter')
                seq.note('E', 5, 'quarter')
                seq.note('F', 5, 'quarter')
            })
        })

        part.addMeasure(2, (m) => {
            m.addSequence((seq) => {
                seq.note('G', 5, 'quarter')
                seq.note('A', 5, 'quarter')
                seq.note('B', 5, 'quarter')
                seq.note('C', 6, 'quarter')
            })
        })

        part.addMeasure(3, (m) => {
            m.addSequence((seq) => {
                seq.chord(
                    [
                        { step: 'C', octave: 5 },
                        { step: 'E', octave: 5 },
                        { step: 'G', octave: 5 },
                    ],
                    'half'
                )
                seq.chord(
                    [
                        { step: 'D', octave: 5 },
                        { step: 'F', octave: 5 },
                        { step: 'A', octave: 5 },
                    ],
                    'half'
                )
            })
        })

        part.addMeasure(4, (m) => {
            m.addSequence((seq) => {
                seq.chord(
                    [
                        { step: 'C', octave: 5 },
                        { step: 'E', octave: 5 },
                        { step: 'G', octave: 5 },
                        { step: 'C', octave: 6 },
                    ],
                    'whole'
                )
            })
        })
    })

    return builder.build()
}
