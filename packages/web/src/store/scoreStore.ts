/**
 * Melos Studio - Score Store
 * Zustand-based state management for the MNX score editor.
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import {
  type Articulation,
  type Note,
  type NoteValue,
  type Pitch,
  type Score,
  ScoreBuilder,
} from '@melos/core'
import {
  addMeasureCommand,
  addVoiceToSelectionCommand,
  defaultPitch,
  deleteSelectedEventCommand,
  insertDynamicCommand,
  insertNoteCommand,
  insertRestCommand,
  removeActiveVoiceFromSelectionCommand,
  removeLastMeasureCommand,
  toggleSelectedArticulationCommand,
  updateKeySignatureCommand,
  updatePartNameCommand,
  updateSelectedDynamicCommand,
  updateSelectedEventDurationCommand,
  updateSelectedNoteAccidentalCommand,
  updateSelectedNoteColorCommand,
  updateSelectedNotePitchCommand,
  updateSelectedNoteheadCommand,
  updateTimeSignatureCommand,
  type ScoreCommand,
  type ScoreCommandResult,
} from './scoreCommands'
import { getEventKind, getSelectedEventDetails, getSelectedMeasureDetails } from './scoreSelection'

export { getSelectedEventDetails, getSelectedMeasureDetails } from './scoreSelection'

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export const noteDurationBases = ['whole', 'half', 'quarter', 'eighth', '16th', '32nd'] as const
export type NoteDurationBase = (typeof noteDurationBases)[number]

export const pitchSteps = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
export type PitchStep = (typeof pitchSteps)[number]

export const noteheadOptions = [
  'default',
  'x',
  'diamond',
  'triangle',
  'slash',
  'square',
  'circle-x',
] as const
export type NoteheadOption = (typeof noteheadOptions)[number]

export const articulationOptions: Articulation[] = [
  'staccato',
  'tenuto',
  'accent',
  'strong-accent',
  'staccatissimo',
  'fermata',
]

export type SelectionType = 'note' | 'rest' | 'dynamic' | 'measure' | 'part' | null
export type EditableEventKind = 'note' | 'rest' | 'dynamic'
export type VoiceRhythmStatus = 'unknown' | 'underfull' | 'complete' | 'overfull'

export interface Selection {
  type: SelectionType
  /** Event ID for score events, measure index for measures, part ID for parts. */
  id: string
  /** Additional context, usually the part ID for score events. */
  partId?: string
}

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

type ScoreContentItem =
  Score['parts'][number]['measures'][number]['sequences'][number]['content'][number]

export type EditableContentItem = ScoreContentItem & {
  id?: string
  type?: string
  value?: string
  glyph?: string
  duration?: NoteValue
  notes?: Note[]
  rest?: { hidden?: boolean }
  content?: EditableContentItem[]
  articulations?: Articulation[]
}

export interface SelectedEventDetails {
  type: EditableEventKind
  id: string
  partId?: string
  measureNumber: number
  sequenceNumber: number
  eventIndex: number
  rhythm: VoiceRhythmSummary
  event: EditableContentItem
}

export interface VoiceRhythmSummary {
  status: VoiceRhythmStatus
  usedBeats: number
  expectedBeats: number
  remainingBeats: number
  overfillBeats: number
  label: string
}

export interface SelectedMeasureDetails {
  type: 'measure'
  id: string
  partId?: string
  measureNumber: number
  sequenceNumber: number
  voiceCount: number
  eventCount: number
  rhythm: VoiceRhythmSummary
  measure: Score['parts'][number]['measures'][number]
}

export interface ScoreState {
  // Core Data
  score: Score | null
  metadata: ScoreMetadata
  parts: PartInfo[]

  // UI State
  selectedPartId: string | null
  activeSequenceIndex: number
  selection: Selection | null
  isLoading: boolean
  error: string | null

  // History
  history: Score[]
  historyIndex: number

  // Score Actions
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
  addMeasure: () => void
  removeLastMeasure: () => void
  insertNote: (duration?: NoteDurationBase, pitch?: Pitch, dots?: number) => void
  insertRest: (duration?: NoteDurationBase, dots?: number) => void
  insertDynamic: (value: string) => void
  addVoiceToSelection: () => void
  removeActiveVoiceFromSelection: () => void
  deleteSelectedEvent: () => void
  updateSelectedEventDuration: (duration: NoteDurationBase, dots?: number) => void
  updateSelectedNotePitch: (pitch: Partial<Pitch>) => void
  updateSelectedNoteAccidental: (alter: number | null) => void
  updateSelectedNotehead: (notehead: NoteheadOption) => void
  updateSelectedNoteColor: (color: string | null) => void
  toggleSelectedArticulation: (articulation: Articulation) => void
  updateSelectedDynamic: (value: string) => void
  getSelectedEvent: () => SelectedEventDetails | null
  getSelectedMeasure: () => SelectedMeasureDetails | null

  // Selection Actions
  setActiveSequence: (sequenceIndex: number) => void
  setSelection: (selection: Selection | null) => void
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
  '#6366f1',
  '#22d3ee',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
]

// ═══════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════

function createStableEventId(context: string): string {
  return `event-${context.replace(/[^a-zA-Z0-9_-]+/g, '-')}`
}

function extractPartsFromScore(score: Score): PartInfo[] {
  return score.parts.map((part, index) => ({
    id: part.id || `part-${index + 1}`,
    name: part.name || `Part ${index + 1}`,
    shortName: part['short-name'] || '',
    color: partColors[index % partColors.length],
  }))
}

function withEditableIds(content: ScoreContentItem[], context: string): ScoreContentItem[] {
  return content.map((item, index) => {
    const editable = item as EditableContentItem
    const kind = getEventKind(editable)
    const nextItem: EditableContentItem = {
      ...editable,
      ...(kind && !editable.id ? { id: createStableEventId(`${context}-e${index + 1}`) } : {}),
    }

    if (Array.isArray(editable.content)) {
      nextItem.content = withEditableIds(
        editable.content as ScoreContentItem[],
        `${context}-c${index + 1}`,
      ) as EditableContentItem[]
    }

    return nextItem as ScoreContentItem
  })
}

function ensureScoreEventIds(score: Score): Score {
  return {
    ...score,
    parts: score.parts.map((part, partIndex) => {
      const partId = part.id || `part-${partIndex + 1}`
      return {
        ...part,
        id: partId,
        measures: part.measures.map((measure, measureIndex) => ({
          ...measure,
          sequences: measure.sequences.map((sequence, sequenceIndex) => ({
            ...sequence,
            content: withEditableIds(
              sequence.content,
              `${partId}-m${measureIndex + 1}-s${sequenceIndex + 1}`,
            ),
          })),
        })),
      }
    }),
  }
}

function resolveSelectedPartId(score: Score, currentPartId: string | null): string | null {
  if (currentPartId && score.parts.some((part) => part.id === currentPartId)) {
    return currentPartId
  }

  return score.parts[0]?.id ?? null
}

function commitScore(
  set: (partial: Partial<ScoreState>) => void,
  get: () => ScoreState,
  score: Score,
) {
  const preparedScore = ensureScoreEventIds(score)
  const historyBase = get().history.slice(0, get().historyIndex + 1)
  const nextHistory = [...historyBase, preparedScore]

  set({
    score: preparedScore,
    parts: extractPartsFromScore(preparedScore),
    selectedPartId: resolveSelectedPartId(preparedScore, get().selectedPartId),
    error: null,
    history: nextHistory,
    historyIndex: nextHistory.length - 1,
  })
}

function applyScoreCommand(
  set: (partial: Partial<ScoreState>) => void,
  get: () => ScoreState,
  command: ScoreCommand,
) {
  const state = get()
  const result = command({
    score: state.score,
    selection: state.selection,
    selectedPartId: state.selectedPartId,
    activeSequenceIndex: state.activeSequenceIndex,
  })

  if (!result.changed || !result.score) return

  commitScore(set, get, result.score)
  set(scoreCommandPatch(result))
}

function scoreCommandPatch(result: ScoreCommandResult): Partial<ScoreState> {
  const patch: Partial<ScoreState> = {}

  if ('selection' in result) {
    patch.selection = result.selection ?? null
  }
  if ('selectedPartId' in result) {
    patch.selectedPartId = result.selectedPartId ?? null
  }
  if (result.activeSequenceIndex !== undefined) {
    patch.activeSequenceIndex = result.activeSequenceIndex
  }

  return patch
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
    activeSequenceIndex: 0,
    selection: null,
    isLoading: false,
    error: null,
    history: [],
    historyIndex: -1,

    // Actions
    setScore: (score) => {
      commitScore(set, get, score)
    },

    clearScore: () => {
      set({
        score: null,
        metadata: defaultMetadata,
        parts: [],
        selectedPartId: null,
        activeSequenceIndex: 0,
        selection: null,
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
      if (historyIndex <= 0) return

      const previousScore = history[historyIndex - 1]
      set({
        score: previousScore,
        parts: extractPartsFromScore(previousScore),
        selectedPartId: resolveSelectedPartId(previousScore, get().selectedPartId),
        selection: null,
        historyIndex: historyIndex - 1,
      })
    },

    redo: () => {
      const { history, historyIndex } = get()
      if (historyIndex >= history.length - 1) return

      const nextScore = history[historyIndex + 1]
      set({
        score: nextScore,
        parts: extractPartsFromScore(nextScore),
        selectedPartId: resolveSelectedPartId(nextScore, get().selectedPartId),
        selection: null,
        historyIndex: historyIndex + 1,
      })
    },

    canUndo: () => get().historyIndex > 0,
    canRedo: () => {
      const { history, historyIndex } = get()
      return historyIndex >= 0 && historyIndex < history.length - 1
    },

    // Score Mutations
    updateTimeSignature: (count, unit) => {
      applyScoreCommand(set, get, updateTimeSignatureCommand(count, unit))
    },

    updateKeySignature: (fifths) => {
      applyScoreCommand(set, get, updateKeySignatureCommand(fifths))
    },

    updatePartName: (partId, name) => {
      applyScoreCommand(set, get, updatePartNameCommand(partId, name))
    },

    addMeasure: () => {
      applyScoreCommand(set, get, addMeasureCommand())
    },

    removeLastMeasure: () => {
      applyScoreCommand(set, get, removeLastMeasureCommand())
    },

    insertNote: (duration = 'quarter', pitch = defaultPitch, dots = 0) => {
      applyScoreCommand(set, get, insertNoteCommand(duration, pitch, dots))
    },

    insertRest: (duration = 'quarter', dots = 0) => {
      applyScoreCommand(set, get, insertRestCommand(duration, dots))
    },

    insertDynamic: (value) => {
      applyScoreCommand(set, get, insertDynamicCommand(value))
    },

    addVoiceToSelection: () => {
      applyScoreCommand(set, get, addVoiceToSelectionCommand())
    },

    removeActiveVoiceFromSelection: () => {
      applyScoreCommand(set, get, removeActiveVoiceFromSelectionCommand())
    },

    deleteSelectedEvent: () => {
      applyScoreCommand(set, get, deleteSelectedEventCommand())
    },

    updateSelectedEventDuration: (duration, dots = 0) => {
      applyScoreCommand(set, get, updateSelectedEventDurationCommand(duration, dots))
    },

    updateSelectedNotePitch: (pitch) => {
      applyScoreCommand(set, get, updateSelectedNotePitchCommand(pitch))
    },

    updateSelectedNoteAccidental: (alter) => {
      applyScoreCommand(set, get, updateSelectedNoteAccidentalCommand(alter))
    },

    updateSelectedNotehead: (notehead) => {
      applyScoreCommand(set, get, updateSelectedNoteheadCommand(notehead))
    },

    updateSelectedNoteColor: (color) => {
      applyScoreCommand(set, get, updateSelectedNoteColorCommand(color))
    },

    toggleSelectedArticulation: (articulation) => {
      applyScoreCommand(set, get, toggleSelectedArticulationCommand(articulation))
    },

    updateSelectedDynamic: (value) => {
      applyScoreCommand(set, get, updateSelectedDynamicCommand(value))
    },

    getSelectedEvent: () => getSelectedEventDetails(get().score, get().selection),
    getSelectedMeasure: () =>
      getSelectedMeasureDetails(get().score, get().selection, get().activeSequenceIndex),

    // Selection Actions
    setActiveSequence: (sequenceIndex) => {
      set({ activeSequenceIndex: Math.max(0, Math.floor(sequenceIndex)) })
    },

    setSelection: (selection) => {
      const eventDetails = getSelectedEventDetails(get().score, selection)
      set({
        selection,
        activeSequenceIndex: eventDetails
          ? eventDetails.sequenceNumber - 1
          : get().activeSequenceIndex,
        selectedPartId: selection?.partId ?? get().selectedPartId,
      })
    },
  })),
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
          'half',
        )
        seq.chord(
          [
            { step: 'D', octave: 5 },
            { step: 'F', octave: 5 },
            { step: 'A', octave: 5 },
          ],
          'half',
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
          'whole',
        )
      })
    })
  })

  return builder.build()
}
