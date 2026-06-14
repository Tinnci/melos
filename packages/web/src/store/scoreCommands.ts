import type { Articulation, Pitch, Score } from '@melos/core'
import type { EditableContentItem, NoteDurationBase, NoteheadOption, Selection } from './scoreStore'
import {
  addVoiceToMeasure,
  createDynamicEvent,
  createNoteEvent,
  createNoteValue,
  createRestEvent,
  defaultPitch,
  deleteEventById,
  insertEvent,
  mapSelectedNote,
  removeVoiceFromMeasure,
  resolveMeasureTarget,
  type ScoreContentItem,
  updateEventById,
} from './scoreCommandPrimitives'
import { isEditableSelection } from './scoreSelection'

export { defaultPitch } from './scoreCommandPrimitives'

export interface ScoreCommandContext {
  score: Score | null
  selection: Selection | null
  selectedPartId: string | null
  activeSequenceIndex: number
}

export interface ScoreCommandResult {
  score: Score | null
  selection?: Selection | null
  selectedPartId?: string | null
  activeSequenceIndex?: number
  changed: boolean
}

export type ScoreCommand = (context: ScoreCommandContext) => ScoreCommandResult

function unchanged(context: ScoreCommandContext): ScoreCommandResult {
  return { score: context.score, changed: false }
}

function changed(
  score: Score,
  updates: Omit<Partial<ScoreCommandResult>, 'score' | 'changed'> = {},
): ScoreCommandResult {
  return { score, changed: true, ...updates }
}

function eventSelection(
  type: 'note' | 'rest' | 'dynamic',
  eventId: string | undefined,
  partId: string | undefined,
): Selection {
  return partId ? { type, id: eventId || '', partId } : { type, id: eventId || '' }
}

function measureSelection(measureNumber: number, partId: string | undefined): Selection {
  return partId
    ? { type: 'measure', id: measureNumber.toString(), partId }
    : { type: 'measure', id: measureNumber.toString() }
}

export function updateTimeSignatureCommand(count: number, unit: number): ScoreCommand {
  return (context) => {
    const { score } = context
    if (!score) return unchanged(context)

    return changed({
      ...score,
      global: {
        ...score.global,
        measures: score.global.measures.map((measure, index) =>
          index === 0 ? { ...measure, time: { count, unit } } : measure,
        ),
      },
    })
  }
}

export function updateKeySignatureCommand(fifths: number): ScoreCommand {
  return (context) => {
    const { score } = context
    if (!score) return unchanged(context)

    return changed({
      ...score,
      global: {
        ...score.global,
        measures: score.global.measures.map((measure, index) =>
          index === 0 ? { ...measure, key: { fifths } } : measure,
        ),
      },
    })
  }
}

export function updatePartNameCommand(partId: string, name: string): ScoreCommand {
  return (context) => {
    const { score } = context
    if (!score) return unchanged(context)

    return changed({
      ...score,
      parts: score.parts.map((part) => (part.id === partId ? { ...part, name } : part)),
    })
  }
}

export function addMeasureCommand(): ScoreCommand {
  return (context) => {
    const { score } = context
    if (!score) return unchanged(context)

    const nextIndex = score.global.measures.length + 1
    const lastGlobal = score.global.measures[score.global.measures.length - 1]
    const globalMeasure = {
      index: nextIndex,
      ...(lastGlobal?.time ? { time: lastGlobal.time } : {}),
      ...(lastGlobal?.key ? { key: lastGlobal.key } : {}),
    }

    return changed({
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
            sequences: [{ content: [createRestEvent('whole') as ScoreContentItem] }],
          },
        ],
      })),
    })
  }
}

export function removeLastMeasureCommand(): ScoreCommand {
  return (context) => {
    const { score } = context
    if (!score || score.global.measures.length <= 1) return unchanged(context)

    return changed(
      {
        ...score,
        global: {
          ...score.global,
          measures: score.global.measures.slice(0, -1),
        },
        parts: score.parts.map((part) => ({
          ...part,
          measures: part.measures.slice(0, -1),
        })),
      },
      { selection: null },
    )
  }
}

export function insertNoteCommand(
  duration: NoteDurationBase,
  pitch: Pitch,
  dots = 0,
): ScoreCommand {
  return (context) => {
    const { score, selection, selectedPartId, activeSequenceIndex } = context
    if (!score) return unchanged(context)

    const event = createNoteEvent(duration, pitch, dots)
    const result = insertEvent(score, selection, selectedPartId, activeSequenceIndex, event)
    return changed(result.score, {
      activeSequenceIndex: result.sequenceIndex,
      selectedPartId: result.partId ?? selectedPartId,
      selection: eventSelection('note', event.id, result.partId),
    })
  }
}

export function insertRestCommand(duration: NoteDurationBase, dots = 0): ScoreCommand {
  return (context) => {
    const { score, selection, selectedPartId, activeSequenceIndex } = context
    if (!score) return unchanged(context)

    const event = createRestEvent(duration, dots)
    const result = insertEvent(score, selection, selectedPartId, activeSequenceIndex, event)
    return changed(result.score, {
      activeSequenceIndex: result.sequenceIndex,
      selectedPartId: result.partId ?? selectedPartId,
      selection: eventSelection('rest', event.id, result.partId),
    })
  }
}

export function insertDynamicCommand(value: string): ScoreCommand {
  return (context) => {
    const { score, selection, selectedPartId, activeSequenceIndex } = context
    if (!score) return unchanged(context)

    const event = createDynamicEvent(value)
    const result = insertEvent(score, selection, selectedPartId, activeSequenceIndex, event)
    return changed(result.score, {
      activeSequenceIndex: result.sequenceIndex,
      selectedPartId: result.partId ?? selectedPartId,
      selection: eventSelection('dynamic', event.id, result.partId),
    })
  }
}

export function addVoiceToSelectionCommand(): ScoreCommand {
  return (context) => {
    const { score, selection, selectedPartId } = context
    if (!score) return unchanged(context)

    const target = resolveMeasureTarget(score, selection, selectedPartId)
    if (!target) return unchanged(context)

    const result = addVoiceToMeasure(score, target)
    return changed(result.score, {
      activeSequenceIndex: result.sequenceIndex,
      selectedPartId: result.partId ?? selectedPartId,
      selection: measureSelection(result.measureNumber, result.partId),
    })
  }
}

export function removeActiveVoiceFromSelectionCommand(): ScoreCommand {
  return (context) => {
    const { score, selection, selectedPartId, activeSequenceIndex } = context
    if (!score) return unchanged(context)

    const target = resolveMeasureTarget(score, selection, selectedPartId)
    if (!target) return unchanged(context)

    const result = removeVoiceFromMeasure(score, target, activeSequenceIndex)
    if (!result.removed) return unchanged(context)

    return changed(result.score, {
      activeSequenceIndex: result.sequenceIndex,
      selectedPartId: result.partId ?? selectedPartId,
      selection: measureSelection(result.measureNumber, result.partId),
    })
  }
}

export function deleteSelectedEventCommand(): ScoreCommand {
  return (context) => {
    const { score, selection } = context
    if (!score || !isEditableSelection(selection)) return unchanged(context)

    const result = deleteEventById(score, selection.id)
    return result.deleted ? changed(result.score, { selection: null }) : unchanged(context)
  }
}

export function updateSelectedEventDurationCommand(
  duration: NoteDurationBase,
  dots = 0,
): ScoreCommand {
  return (context) => {
    const { score, selection } = context
    if (!score || !isEditableSelection(selection)) return unchanged(context)

    const result = updateEventById(
      score,
      selection.id,
      (item) =>
        ({
          ...item,
          duration: createNoteValue(duration, dots),
        }) as EditableContentItem,
    )

    return result.updated ? changed(result.score) : unchanged(context)
  }
}

export function updateSelectedNotePitchCommand(pitch: Partial<Pitch>): ScoreCommand {
  return (context) => {
    const { score, selection } = context
    if (!score || !isEditableSelection(selection)) return unchanged(context)

    const result = updateEventById(score, selection.id, (item) =>
      mapSelectedNote(item, (note) => ({
        ...note,
        pitch: {
          ...(note.pitch ?? defaultPitch),
          ...pitch,
        },
      })),
    )

    return result.updated ? changed(result.score) : unchanged(context)
  }
}

export function updateSelectedNoteAccidentalCommand(alter: number | null): ScoreCommand {
  return (context) => {
    const { score, selection } = context
    if (!score || !isEditableSelection(selection)) return unchanged(context)

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

    return result.updated ? changed(result.score) : unchanged(context)
  }
}

export function updateSelectedNoteheadCommand(notehead: NoteheadOption): ScoreCommand {
  return (context) => {
    const { score, selection } = context
    if (!score || !isEditableSelection(selection)) return unchanged(context)

    const result = updateEventById(score, selection.id, (item) =>
      mapSelectedNote(item, (note) => ({
        ...note,
        notehead: notehead === 'default' ? undefined : notehead,
      })),
    )

    return result.updated ? changed(result.score) : unchanged(context)
  }
}

export function updateSelectedNoteColorCommand(color: string | null): ScoreCommand {
  return (context) => {
    const { score, selection } = context
    if (!score || !isEditableSelection(selection)) return unchanged(context)

    const normalizedColor = color?.trim() || undefined
    const result = updateEventById(score, selection.id, (item) =>
      mapSelectedNote(item, (note) => ({
        ...note,
        color: normalizedColor,
      })),
    )

    return result.updated ? changed(result.score) : unchanged(context)
  }
}

export function toggleSelectedArticulationCommand(articulation: Articulation): ScoreCommand {
  return (context) => {
    const { score, selection } = context
    if (!score || !isEditableSelection(selection)) return unchanged(context)

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

    return result.updated ? changed(result.score) : unchanged(context)
  }
}

export function updateSelectedDynamicCommand(value: string): ScoreCommand {
  return (context) => {
    const { score, selection } = context
    if (!score || !isEditableSelection(selection)) return unchanged(context)

    const result = updateEventById(score, selection.id, (item) =>
      item.type === 'dynamic' ? ({ ...item, value } as EditableContentItem) : item,
    )

    return result.updated ? changed(result.score) : unchanged(context)
  }
}
