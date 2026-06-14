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
  type MeasureTimeline,
  type Pitch,
  type Score,
  type ScoreTimelineIndex,
  buildMeasureTimeline,
  buildScoreTimelineIndex,
  getTimelineEventsById,
  getTimelineEventSource,
  getTimelineMeasure,
  ScoreBuilder,
} from '@melos/core'

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

const defaultPitch: Pitch = { step: 'C', octave: 4 }

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

let generatedEventCounter = 0

// ═══════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════

function createEventId(prefix = 'event'): string {
  generatedEventCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${generatedEventCounter.toString(36)}`
}

function createStableEventId(context: string): string {
  return `event-${context.replace(/[^a-zA-Z0-9_-]+/g, '-')}`
}

function createNoteValue(base: NoteDurationBase, dots = 0): NoteValue {
  return {
    base: base as NoteValue['base'],
    ...(dots > 0 ? { dots } : {}),
  }
}

function createNoteEvent(duration: NoteDurationBase, pitch: Pitch, dots = 0): EditableContentItem {
  return {
    id: createEventId('note'),
    duration: createNoteValue(duration, dots),
    notes: [{ pitch }],
  } as EditableContentItem
}

function createRestEvent(duration: NoteDurationBase, dots = 0): EditableContentItem {
  return {
    id: createEventId('rest'),
    duration: createNoteValue(duration, dots),
    rest: {},
  } as EditableContentItem
}

function createDynamicEvent(value: string): EditableContentItem {
  return {
    type: 'dynamic',
    id: createEventId('dynamic'),
    value,
  } as EditableContentItem
}

function extractPartsFromScore(score: Score): PartInfo[] {
  return score.parts.map((part, index) => ({
    id: part.id || `part-${index + 1}`,
    name: part.name || `Part ${index + 1}`,
    shortName: part['short-name'] || '',
    color: partColors[index % partColors.length],
  }))
}

function getEventKind(item: EditableContentItem): EditableEventKind | null {
  if (item.notes && item.notes.length > 0) return 'note'
  if (item.rest) return 'rest'
  if (item.type === 'dynamic') return 'dynamic'
  return null
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

function isEditableSelection(
  selection: Selection | null,
): selection is Selection & { type: EditableEventKind } {
  return selection?.type === 'note' || selection?.type === 'rest' || selection?.type === 'dynamic'
}

function isMeasureSelection(
  selection: Selection | null,
): selection is Selection & { type: 'measure' } {
  return selection?.type === 'measure'
}

function parseMeasureNumber(selection: Selection): number | null {
  const measureNumber = Number(selection.id)
  return Number.isInteger(measureNumber) && measureNumber > 0 ? measureNumber : null
}

function findMeasureIndex(part: Score['parts'][number], measureNumber: number): number {
  return part.measures.findIndex((measure, index) => (measure.index ?? index + 1) === measureNumber)
}

function createEmptySequence(): Score['parts'][number]['measures'][number]['sequences'][number] {
  return { content: [] }
}

function withSequenceAt(
  measure: Score['parts'][number]['measures'][number],
  sequenceIndex: number,
  updater: (
    sequence: Score['parts'][number]['measures'][number]['sequences'][number],
  ) => Score['parts'][number]['measures'][number]['sequences'][number],
): Score['parts'][number]['measures'][number] {
  const nextSequences =
    measure.sequences.length > 0 ? [...measure.sequences] : [createEmptySequence()]

  while (nextSequences.length <= sequenceIndex) {
    nextSequences.push(createEmptySequence())
  }

  nextSequences[sequenceIndex] = updater(nextSequences[sequenceIndex])
  return { ...measure, sequences: nextSequences }
}

const rhythmEpsilon = 0.000001

function roundBeats(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000
}

function summarizeVoiceRhythm(
  score: Score,
  partIndex: number,
  measureIndex: number,
  sequenceIndex: number,
): VoiceRhythmSummary {
  const timeline = buildMeasureTimeline(score, partIndex, measureIndex)
  return summarizeTimelineVoiceRhythm(timeline, sequenceIndex)
}

function summarizeTimelineVoiceRhythm(
  timeline: MeasureTimeline,
  sequenceIndex: number,
): VoiceRhythmSummary {
  const sequence = timeline.sequences[sequenceIndex]
  const expectedBeats = sequence?.expectedBeats ?? timeline.expectedBeats
  const usedBeats = sequence?.usedBeats ?? 0
  const difference = usedBeats - expectedBeats
  const remainingBeats = Math.max(0, expectedBeats - usedBeats)
  const overfillBeats = Math.max(0, usedBeats - expectedBeats)

  if (!Number.isFinite(expectedBeats) || expectedBeats <= 0) {
    return {
      status: 'unknown',
      usedBeats: roundBeats(usedBeats),
      expectedBeats: 0,
      remainingBeats: 0,
      overfillBeats: 0,
      label: 'Unknown',
    }
  }

  if (Math.abs(difference) <= rhythmEpsilon) {
    return {
      status: 'complete',
      usedBeats: roundBeats(usedBeats),
      expectedBeats: roundBeats(expectedBeats),
      remainingBeats: 0,
      overfillBeats: 0,
      label: 'Complete',
    }
  }

  if (difference < 0) {
    return {
      status: 'underfull',
      usedBeats: roundBeats(usedBeats),
      expectedBeats: roundBeats(expectedBeats),
      remainingBeats: roundBeats(remainingBeats),
      overfillBeats: 0,
      label: 'Underfull',
    }
  }

  return {
    status: 'overfull',
    usedBeats: roundBeats(usedBeats),
    expectedBeats: roundBeats(expectedBeats),
    remainingBeats: 0,
    overfillBeats: roundBeats(overfillBeats),
    label: 'Overfull',
  }
}

function findSelectedTimelineEvent(
  score: Score,
  timelineIndex: ScoreTimelineIndex,
  selection: Selection & { type: EditableEventKind },
) {
  return (
    getTimelineEventsById(timelineIndex, selection.id).find(
      (event) => !selection.partId || score.parts[event.partIndex]?.id === selection.partId,
    ) ?? null
  )
}

function getTimelineEventIndex(contentPath: number[]): number {
  return contentPath.length > 0 ? contentPath[contentPath.length - 1] : 0
}

export function getSelectedEventDetails(
  score: Score | null,
  selection: Selection | null,
): SelectedEventDetails | null {
  if (!score || !isEditableSelection(selection)) return null

  const timelineIndex = buildScoreTimelineIndex(score)
  const eventRef = findSelectedTimelineEvent(score, timelineIndex, selection)
  if (!eventRef) return null

  const event = getTimelineEventSource(score, eventRef) as EditableContentItem | undefined
  if (!event) return null

  const kind = getEventKind(event)
  if (!kind) return null

  const part = score.parts[eventRef.partIndex]
  const measure = part?.measures[eventRef.measureIndex]
  const timeline = getTimelineMeasure(timelineIndex, eventRef)
  if (!part || !measure || !timeline) {
    return null
  }

  return {
    type: kind,
    id: selection.id,
    partId: part.id,
    measureNumber: measure.index ?? eventRef.measureIndex + 1,
    sequenceNumber: eventRef.sequenceIndex + 1,
    eventIndex: getTimelineEventIndex(eventRef.contentPath),
    rhythm: summarizeTimelineVoiceRhythm(timeline, eventRef.sequenceIndex),
    event,
  }
}

export function getSelectedMeasureDetails(
  score: Score | null,
  selection: Selection | null,
  activeSequenceIndex = 0,
): SelectedMeasureDetails | null {
  if (!score || !isMeasureSelection(selection)) return null

  const measureNumber = parseMeasureNumber(selection)
  if (!measureNumber) return null

  const partIndex = selection.partId
    ? score.parts.findIndex((scorePart) => scorePart.id === selection.partId)
    : 0
  const part = partIndex >= 0 ? score.parts[partIndex] : undefined
  if (!part) return null

  const measureIndex = findMeasureIndex(part, measureNumber)
  if (measureIndex < 0) return null

  const measure = part.measures[measureIndex]
  const voiceCount = Math.max(1, measure.sequences.length)
  const sequenceIndex = Math.max(0, Math.min(activeSequenceIndex, voiceCount - 1))
  const eventCount = measure.sequences[sequenceIndex]?.content.length ?? 0
  const timelineIndex = buildScoreTimelineIndex(score)
  const timeline = getTimelineMeasure(timelineIndex, { partIndex, measureIndex })

  return {
    type: 'measure',
    id: selection.id,
    partId: part.id,
    measureNumber,
    sequenceNumber: sequenceIndex + 1,
    voiceCount,
    eventCount,
    rhythm: timeline
      ? summarizeTimelineVoiceRhythm(timeline, sequenceIndex)
      : summarizeVoiceRhythm(score, partIndex, measureIndex, sequenceIndex),
    measure,
  }
}

function updateContentEvent(
  content: ScoreContentItem[],
  eventId: string,
  updater: (item: EditableContentItem) => EditableContentItem,
): { content: ScoreContentItem[]; updated: boolean } {
  let updated = false

  const nextContent = content.map((item) => {
    const editable = item as EditableContentItem

    if (editable.id === eventId) {
      updated = true
      return updater(editable) as ScoreContentItem
    }

    if (Array.isArray(editable.content)) {
      const nested = updateContentEvent(editable.content as ScoreContentItem[], eventId, updater)
      if (nested.updated) {
        updated = true
        return { ...editable, content: nested.content } as ScoreContentItem
      }
    }

    return item
  })

  return { content: nextContent, updated }
}

function deleteContentEvent(
  content: ScoreContentItem[],
  eventId: string,
): { content: ScoreContentItem[]; deleted: boolean } {
  let deleted = false
  const nextContent: ScoreContentItem[] = []

  for (const item of content) {
    const editable = item as EditableContentItem

    if (editable.id === eventId) {
      deleted = true
      continue
    }

    if (Array.isArray(editable.content)) {
      const nested = deleteContentEvent(editable.content as ScoreContentItem[], eventId)
      if (nested.deleted) {
        deleted = true
        nextContent.push({ ...editable, content: nested.content } as ScoreContentItem)
        continue
      }
    }

    nextContent.push(item)
  }

  return { content: nextContent, deleted }
}

function insertContentEventAfter(
  content: ScoreContentItem[],
  eventId: string,
  newEvent: EditableContentItem,
): { content: ScoreContentItem[]; inserted: boolean } {
  let inserted = false
  const nextContent: ScoreContentItem[] = []

  for (const item of content) {
    const editable = item as EditableContentItem
    nextContent.push(item)

    if (editable.id === eventId) {
      nextContent.push(newEvent as ScoreContentItem)
      inserted = true
      continue
    }

    if (Array.isArray(editable.content)) {
      const nested = insertContentEventAfter(
        editable.content as ScoreContentItem[],
        eventId,
        newEvent,
      )
      if (nested.inserted) {
        nextContent[nextContent.length - 1] = {
          ...editable,
          content: nested.content,
        } as ScoreContentItem
        inserted = true
      }
    }
  }

  return { content: nextContent, inserted }
}

function updateEventById(
  score: Score,
  eventId: string,
  updater: (item: EditableContentItem) => EditableContentItem,
): { score: Score; updated: boolean } {
  let updated = false

  const nextScore: Score = {
    ...score,
    parts: score.parts.map((part) => ({
      ...part,
      measures: part.measures.map((measure) => ({
        ...measure,
        sequences: measure.sequences.map((sequence) => {
          const result = updateContentEvent(sequence.content, eventId, updater)
          updated = updated || result.updated
          return result.updated ? { ...sequence, content: result.content } : sequence
        }),
      })),
    })),
  }

  return { score: nextScore, updated }
}

function deleteEventById(score: Score, eventId: string): { score: Score; deleted: boolean } {
  let deleted = false

  const nextScore: Score = {
    ...score,
    parts: score.parts.map((part) => ({
      ...part,
      measures: part.measures.map((measure) => ({
        ...measure,
        sequences: measure.sequences.map((sequence) => {
          const result = deleteContentEvent(sequence.content, eventId)
          deleted = deleted || result.deleted
          return result.deleted ? { ...sequence, content: result.content } : sequence
        }),
      })),
    })),
  }

  return { score: nextScore, deleted }
}

function resolveMeasureTarget(
  score: Score,
  selection: Selection | null,
  selectedPartId: string | null,
): { partIndex: number; measureIndex: number } | null {
  if (isMeasureSelection(selection)) {
    const measureNumber = parseMeasureNumber(selection)
    if (!measureNumber) return null

    const partIndex = selection.partId
      ? score.parts.findIndex((part) => part.id === selection.partId)
      : 0
    if (partIndex < 0) return null

    const measureIndex = findMeasureIndex(score.parts[partIndex], measureNumber)
    return measureIndex >= 0 ? { partIndex, measureIndex } : null
  }

  if (isEditableSelection(selection)) {
    const timelineIndex = buildScoreTimelineIndex(score)
    const eventRef = findSelectedTimelineEvent(score, timelineIndex, selection)
    if (eventRef) {
      return {
        partIndex: eventRef.partIndex,
        measureIndex: eventRef.measureIndex,
      }
    }
  }

  const partIndex = selectedPartId ? score.parts.findIndex((part) => part.id === selectedPartId) : 0
  if (partIndex < 0) return null

  const measureIndex = score.parts[partIndex].measures.length - 1
  return measureIndex >= 0 ? { partIndex, measureIndex } : null
}

function addVoiceToMeasure(
  score: Score,
  target: { partIndex: number; measureIndex: number },
): { score: Score; sequenceIndex: number; partId?: string; measureNumber: number } {
  const part = score.parts[target.partIndex]
  const measure = part.measures[target.measureIndex]
  const sequenceIndex = measure.sequences.length
  const measureNumber = measure.index ?? target.measureIndex + 1

  return {
    score: {
      ...score,
      parts: score.parts.map((scorePart, partIndex) =>
        partIndex === target.partIndex
          ? {
              ...scorePart,
              measures: scorePart.measures.map((partMeasure, measureIndex) =>
                measureIndex === target.measureIndex
                  ? {
                      ...partMeasure,
                      sequences: [...partMeasure.sequences, createEmptySequence()],
                    }
                  : partMeasure,
              ),
            }
          : scorePart,
      ),
    },
    sequenceIndex,
    partId: part.id,
    measureNumber,
  }
}

function removeVoiceFromMeasure(
  score: Score,
  target: { partIndex: number; measureIndex: number },
  activeSequenceIndex: number,
): {
  score: Score
  sequenceIndex: number
  removed: boolean
  partId?: string
  measureNumber: number
} {
  const part = score.parts[target.partIndex]
  const measure = part.measures[target.measureIndex]
  const measureNumber = measure.index ?? target.measureIndex + 1
  if (measure.sequences.length <= 1) {
    return { score, sequenceIndex: 0, removed: false, partId: part.id, measureNumber }
  }

  const sequenceIndex = Math.max(0, Math.min(activeSequenceIndex, measure.sequences.length - 1))
  const nextActiveSequenceIndex = Math.max(0, Math.min(sequenceIndex, measure.sequences.length - 2))

  return {
    score: {
      ...score,
      parts: score.parts.map((scorePart, partIndex) =>
        partIndex === target.partIndex
          ? {
              ...scorePart,
              measures: scorePart.measures.map((partMeasure, measureIndex) =>
                measureIndex === target.measureIndex
                  ? {
                      ...partMeasure,
                      sequences: partMeasure.sequences.filter(
                        (_, index) => index !== sequenceIndex,
                      ),
                    }
                  : partMeasure,
              ),
            }
          : scorePart,
      ),
    },
    sequenceIndex: nextActiveSequenceIndex,
    removed: true,
    partId: part.id,
    measureNumber,
  }
}

function insertEvent(
  score: Score,
  selection: Selection | null,
  selectedPartId: string | null,
  activeSequenceIndex: number,
  newEvent: EditableContentItem,
) {
  if (isEditableSelection(selection)) {
    let insertedPartId: string | undefined
    let insertedSequenceIndex = activeSequenceIndex
    let inserted = false

    const nextScore: Score = {
      ...score,
      parts: score.parts.map((part) => ({
        ...part,
        measures: part.measures.map((measure) => ({
          ...measure,
          sequences: measure.sequences.map((sequence) => {
            const result = insertContentEventAfter(sequence.content, selection.id, newEvent)
            if (result.inserted) {
              inserted = true
              insertedPartId = part.id
              insertedSequenceIndex = measure.sequences.indexOf(sequence)
              return { ...sequence, content: result.content }
            }
            return sequence
          }),
        })),
      })),
    }

    if (inserted)
      return { score: nextScore, partId: insertedPartId, sequenceIndex: insertedSequenceIndex }
  }

  if (isMeasureSelection(selection)) {
    const measureNumber = parseMeasureNumber(selection)
    const targetPartId = selection.partId ?? selectedPartId
    const targetSequenceIndex = Math.max(0, activeSequenceIndex)
    let insertedPartId: string | undefined
    let inserted = false

    const nextScore: Score = {
      ...score,
      parts: score.parts.map((part, partIndex) => {
        const partMatches = targetPartId ? part.id === targetPartId : partIndex === 0
        if (!partMatches || !measureNumber) return part

        const measureIndex = findMeasureIndex(part, measureNumber)
        if (measureIndex < 0) return part

        inserted = true
        insertedPartId = part.id

        return {
          ...part,
          measures: part.measures.map((measure, index) =>
            index === measureIndex
              ? withSequenceAt(measure, targetSequenceIndex, (sequence) => ({
                  ...sequence,
                  content: [...sequence.content, newEvent as ScoreContentItem],
                }))
              : measure,
          ),
        }
      }),
    }

    if (inserted)
      return { score: nextScore, partId: insertedPartId, sequenceIndex: targetSequenceIndex }
  }

  const targetPartId = selectedPartId ?? score.parts[0]?.id
  let appendedPartId: string | undefined
  const targetSequenceIndex = Math.max(0, activeSequenceIndex)

  const nextScore: Score = {
    ...score,
    parts: score.parts.map((part, partIndex) => {
      if ((targetPartId && part.id !== targetPartId) || (!targetPartId && partIndex !== 0)) {
        return part
      }

      appendedPartId = part.id
      const measures =
        part.measures.length > 0 ? part.measures : [{ index: 1, sequences: [{ content: [] }] }]
      const lastMeasureIndex = measures.length - 1

      return {
        ...part,
        measures: measures.map((measure, measureIndex) => {
          if (measureIndex !== lastMeasureIndex) return measure

          const sequences = measure.sequences.length > 0 ? measure.sequences : [{ content: [] }]

          return {
            ...measure,
            sequences: withSequenceAt(
              { ...measure, sequences },
              targetSequenceIndex,
              (sequence) => ({
                ...sequence,
                content: [...sequence.content, newEvent as ScoreContentItem],
              }),
            ).sequences,
          }
        }),
      }
    }),
  }

  return { score: nextScore, partId: appendedPartId, sequenceIndex: targetSequenceIndex }
}

function mapSelectedNote(
  item: EditableContentItem,
  mapper: (note: Note) => Note,
): EditableContentItem {
  if (!item.notes || item.notes.length === 0) return item

  return {
    ...item,
    notes: item.notes.map((note, index) => (index === 0 ? mapper(note) : note)),
  } as EditableContentItem
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
      const { score } = get()
      if (!score) return

      commitScore(set, get, {
        ...score,
        global: {
          ...score.global,
          measures: score.global.measures.map((measure, index) =>
            index === 0 ? { ...measure, time: { count, unit } } : measure,
          ),
        },
      })
    },

    updateKeySignature: (fifths) => {
      const { score } = get()
      if (!score) return

      commitScore(set, get, {
        ...score,
        global: {
          ...score.global,
          measures: score.global.measures.map((measure, index) =>
            index === 0 ? { ...measure, key: { fifths } } : measure,
          ),
        },
      })
    },

    updatePartName: (partId, name) => {
      const { score } = get()
      if (!score) return

      commitScore(set, get, {
        ...score,
        parts: score.parts.map((part) => (part.id === partId ? { ...part, name } : part)),
      })
    },

    addMeasure: () => {
      const { score } = get()
      if (!score) return

      const nextIndex = score.global.measures.length + 1
      const lastGlobal = score.global.measures[score.global.measures.length - 1]
      const globalMeasure = {
        index: nextIndex,
        ...(lastGlobal?.time ? { time: lastGlobal.time } : {}),
        ...(lastGlobal?.key ? { key: lastGlobal.key } : {}),
      }

      commitScore(set, get, {
        ...score,
        global: {
          ...score.global,
          measures: [...score.global.measures, globalMeasure],
        },
        parts: score.parts.map((part) => ({
          ...part,
          measures: [
            ...part.measures,
            {
              index: nextIndex,
              sequences: [
                {
                  content: [createRestEvent('whole') as ScoreContentItem],
                },
              ],
            },
          ],
        })),
      })
    },

    removeLastMeasure: () => {
      const { score } = get()
      if (!score || score.global.measures.length <= 1) return

      commitScore(set, get, {
        ...score,
        global: {
          ...score.global,
          measures: score.global.measures.slice(0, -1),
        },
        parts: score.parts.map((part) => ({
          ...part,
          measures: part.measures.slice(0, -1),
        })),
      })
      set({ selection: null })
    },

    insertNote: (duration = 'quarter', pitch = defaultPitch, dots = 0) => {
      const { score, selection, selectedPartId, activeSequenceIndex } = get()
      if (!score) return

      const event = createNoteEvent(duration, pitch, dots)
      const result = insertEvent(score, selection, selectedPartId, activeSequenceIndex, event)
      commitScore(set, get, result.score)
      set({
        activeSequenceIndex: result.sequenceIndex,
        selectedPartId: result.partId ?? selectedPartId,
        selection: { type: 'note', id: event.id || '', partId: result.partId },
      })
    },

    insertRest: (duration = 'quarter', dots = 0) => {
      const { score, selection, selectedPartId, activeSequenceIndex } = get()
      if (!score) return

      const event = createRestEvent(duration, dots)
      const result = insertEvent(score, selection, selectedPartId, activeSequenceIndex, event)
      commitScore(set, get, result.score)
      set({
        activeSequenceIndex: result.sequenceIndex,
        selectedPartId: result.partId ?? selectedPartId,
        selection: { type: 'rest', id: event.id || '', partId: result.partId },
      })
    },

    insertDynamic: (value) => {
      const { score, selection, selectedPartId, activeSequenceIndex } = get()
      if (!score) return

      const event = createDynamicEvent(value)
      const result = insertEvent(score, selection, selectedPartId, activeSequenceIndex, event)
      commitScore(set, get, result.score)
      set({
        activeSequenceIndex: result.sequenceIndex,
        selectedPartId: result.partId ?? selectedPartId,
        selection: { type: 'dynamic', id: event.id || '', partId: result.partId },
      })
    },

    addVoiceToSelection: () => {
      const { score, selection, selectedPartId } = get()
      if (!score) return

      const target = resolveMeasureTarget(score, selection, selectedPartId)
      if (!target) return

      const result = addVoiceToMeasure(score, target)
      commitScore(set, get, result.score)
      set({
        activeSequenceIndex: result.sequenceIndex,
        selectedPartId: result.partId ?? selectedPartId,
        selection: {
          type: 'measure',
          id: result.measureNumber.toString(),
          partId: result.partId,
        },
      })
    },

    removeActiveVoiceFromSelection: () => {
      const { score, selection, selectedPartId, activeSequenceIndex } = get()
      if (!score) return

      const target = resolveMeasureTarget(score, selection, selectedPartId)
      if (!target) return

      const result = removeVoiceFromMeasure(score, target, activeSequenceIndex)
      if (!result.removed) return

      commitScore(set, get, result.score)
      set({
        activeSequenceIndex: result.sequenceIndex,
        selectedPartId: result.partId ?? selectedPartId,
        selection: {
          type: 'measure',
          id: result.measureNumber.toString(),
          partId: result.partId,
        },
      })
    },

    deleteSelectedEvent: () => {
      const { score, selection } = get()
      if (!score || !isEditableSelection(selection)) return

      const result = deleteEventById(score, selection.id)
      if (!result.deleted) return

      commitScore(set, get, result.score)
      set({ selection: null })
    },

    updateSelectedEventDuration: (duration, dots = 0) => {
      const { score, selection } = get()
      if (!score || !isEditableSelection(selection)) return

      const result = updateEventById(
        score,
        selection.id,
        (item) =>
          ({
            ...item,
            duration: createNoteValue(duration, dots),
          }) as EditableContentItem,
      )

      if (result.updated) commitScore(set, get, result.score)
    },

    updateSelectedNotePitch: (pitch) => {
      const { score, selection } = get()
      if (!score || !isEditableSelection(selection)) return

      const result = updateEventById(score, selection.id, (item) =>
        mapSelectedNote(item, (note) => ({
          ...note,
          pitch: {
            ...(note.pitch ?? defaultPitch),
            ...pitch,
          },
        })),
      )

      if (result.updated) commitScore(set, get, result.score)
    },

    updateSelectedNoteAccidental: (alter) => {
      const { score, selection } = get()
      if (!score || !isEditableSelection(selection)) return

      const result = updateEventById(score, selection.id, (item) =>
        mapSelectedNote(item, (note) => {
          const nextPitch: Pitch = { ...(note.pitch ?? defaultPitch) }
          if (alter === null) {
            delete nextPitch.alter
          } else {
            nextPitch.alter = alter
          }

          return {
            ...note,
            pitch: nextPitch,
            accidentalDisplay: alter === null ? undefined : { show: true },
          }
        }),
      )

      if (result.updated) commitScore(set, get, result.score)
    },

    updateSelectedNotehead: (notehead) => {
      const { score, selection } = get()
      if (!score || !isEditableSelection(selection)) return

      const result = updateEventById(score, selection.id, (item) =>
        mapSelectedNote(item, (note) => ({
          ...note,
          notehead: notehead === 'default' ? undefined : notehead,
        })),
      )

      if (result.updated) commitScore(set, get, result.score)
    },

    updateSelectedNoteColor: (color) => {
      const { score, selection } = get()
      if (!score || !isEditableSelection(selection)) return

      const normalizedColor = color?.trim() || undefined
      const result = updateEventById(score, selection.id, (item) =>
        mapSelectedNote(item, (note) => ({
          ...note,
          color: normalizedColor,
        })),
      )

      if (result.updated) commitScore(set, get, result.score)
    },

    toggleSelectedArticulation: (articulation) => {
      const { score, selection } = get()
      if (!score || !isEditableSelection(selection)) return

      const result = updateEventById(score, selection.id, (item) => {
        const next = new Set(item.articulations ?? [])
        if (next.has(articulation)) {
          next.delete(articulation)
        } else {
          next.add(articulation)
        }

        const articulations = Array.from(next)
        return {
          ...item,
          articulations: articulations.length > 0 ? articulations : undefined,
        } as EditableContentItem
      })

      if (result.updated) commitScore(set, get, result.score)
    },

    updateSelectedDynamic: (value) => {
      const { score, selection } = get()
      if (!score || !isEditableSelection(selection)) return

      const result = updateEventById(score, selection.id, (item) =>
        item.type === 'dynamic' ? ({ ...item, value } as EditableContentItem) : item,
      )

      if (result.updated) commitScore(set, get, result.score)
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
