import {
  buildMeasureTimeline,
  buildScoreTimelineIndex,
  getTimelineEventSource,
  getTimelineEventsById,
  getTimelineMeasure,
  type MeasureTimeline,
  type Score,
  type ScoreTimelineIndex,
} from '@melos/core'
import type {
  EditableContentItem,
  EditableEventKind,
  SelectedEventDetails,
  SelectedMeasureDetails,
  Selection,
  VoiceRhythmSummary,
} from './scoreStore'

export function getEventKind(item: EditableContentItem): EditableEventKind | null {
  if (item.notes && item.notes.length > 0) return 'note'
  if (item.rest) return 'rest'
  if (item.type === 'dynamic') return 'dynamic'
  return null
}

export function isEditableSelection(
  selection: Selection | null,
): selection is Selection & { type: EditableEventKind } {
  return selection?.type === 'note' || selection?.type === 'rest' || selection?.type === 'dynamic'
}

export function isMeasureSelection(
  selection: Selection | null,
): selection is Selection & { type: 'measure' } {
  return selection?.type === 'measure'
}

export function parseMeasureNumber(selection: Selection): number | null {
  const measureNumber = Number(selection.id)
  return Number.isInteger(measureNumber) && measureNumber > 0 ? measureNumber : null
}

export function findMeasureIndex(part: Score['parts'][number], measureNumber: number): number {
  return part.measures.findIndex((measure, index) => (measure.index ?? index + 1) === measureNumber)
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

export function findSelectedTimelineEvent(
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
