import {
  buildScoreTimelineIndex,
  type Note,
  type NoteValue,
  type Pitch,
  type Score,
} from '@melos/core'
import type { EditableContentItem, NoteDurationBase, Selection } from './scoreStore'
import {
  findMeasureIndex,
  findSelectedTimelineEvent,
  isEditableSelection,
  isMeasureSelection,
  parseMeasureNumber,
} from './scoreSelection'

export type ScoreContentItem =
  Score['parts'][number]['measures'][number]['sequences'][number]['content'][number]

export const defaultPitch: Pitch = { step: 'C', octave: 4 }

let generatedEventCounter = 0

function createEventId(prefix = 'event'): string {
  generatedEventCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${generatedEventCounter.toString(36)}`
}

export function createNoteValue(base: NoteDurationBase, dots = 0): NoteValue {
  return {
    base: base as NoteValue['base'],
    ...(dots > 0 ? { dots } : {}),
  }
}

export function createNoteEvent(
  duration: NoteDurationBase,
  pitch: Pitch,
  dots = 0,
): EditableContentItem {
  return {
    id: createEventId('note'),
    duration: createNoteValue(duration, dots),
    notes: [{ pitch }],
  } as EditableContentItem
}

export function createRestEvent(duration: NoteDurationBase, dots = 0): EditableContentItem {
  return {
    id: createEventId('rest'),
    duration: createNoteValue(duration, dots),
    rest: {},
  } as EditableContentItem
}

export function createDynamicEvent(value: string): EditableContentItem {
  return {
    type: 'dynamic',
    id: createEventId('dynamic'),
    value,
  } as EditableContentItem
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

export function updateEventById(
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

export function deleteEventById(score: Score, eventId: string): { score: Score; deleted: boolean } {
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

export function resolveMeasureTarget(
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

export function addVoiceToMeasure(
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

export function removeVoiceFromMeasure(
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

export function insertEvent(
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
          sequences: measure.sequences.map((sequence, sequenceIndex) => {
            const result = insertContentEventAfter(sequence.content, selection.id, newEvent)
            if (result.inserted) {
              inserted = true
              insertedPartId = part.id
              insertedSequenceIndex = sequenceIndex
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

export function mapSelectedNote(
  item: EditableContentItem,
  mapper: (note: Note) => Note,
): EditableContentItem {
  if (!item.notes || item.notes.length === 0) return item

  return {
    ...item,
    notes: item.notes.map((note, index) => (index === 0 ? mapper(note) : note)),
  } as EditableContentItem
}
