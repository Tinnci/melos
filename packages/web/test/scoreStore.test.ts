import { beforeEach, describe, expect, it } from 'bun:test'
import {
  graceGroup,
  measureWithContent,
  noteEvent,
  scoreFixture,
  singlePartScore,
  tupletEvent,
} from '../../../test/fixtures/score'
import { createDemoScore, type EditableContentItem, useScoreStore } from '../src/store/scoreStore'

function firstMeasureContent(): EditableContentItem[] {
  return useScoreStore.getState().score!.parts[0].measures[0].sequences[0]
    .content as EditableContentItem[]
}

describe('score store editing actions', () => {
  beforeEach(() => {
    useScoreStore.getState().clearScore()
  })

  it('assigns stable event ids and supports insert undo redo', () => {
    useScoreStore.getState().setScore(createDemoScore())

    const firstEvent = firstMeasureContent()[0]
    expect(firstEvent.id).toBeTruthy()

    useScoreStore.getState().setSelection({
      type: 'note',
      id: firstEvent.id!,
      partId: 'piano',
    })
    useScoreStore.getState().insertNote('half', { step: 'G', octave: 4 })

    let content = firstMeasureContent()
    expect(content).toHaveLength(5)
    expect(content[1].duration?.base).toBe('half')
    expect(content[1].notes?.[0].pitch?.step).toBe('G')
    expect(useScoreStore.getState().canUndo()).toBe(true)

    useScoreStore.getState().undo()
    expect(firstMeasureContent()).toHaveLength(4)
    expect(useScoreStore.getState().canRedo()).toBe(true)

    useScoreStore.getState().redo()
    content = firstMeasureContent()
    expect(content).toHaveLength(5)
    expect(content[1].notes?.[0].pitch?.octave).toBe(4)
  })

  it('updates and deletes selected dynamic events', () => {
    useScoreStore.getState().setScore(createDemoScore())

    const firstEvent = firstMeasureContent()[0]
    useScoreStore.getState().setSelection({
      type: 'note',
      id: firstEvent.id!,
      partId: 'piano',
    })
    useScoreStore.getState().insertDynamic('mf')

    const selected = useScoreStore.getState().getSelectedEvent()
    expect(selected?.type).toBe('dynamic')

    useScoreStore.getState().updateSelectedDynamic('sfz')
    const dynamicId = useScoreStore.getState().selection!.id
    expect(firstMeasureContent().find((item) => item.id === dynamicId)?.value).toBe('sfz')

    useScoreStore.getState().deleteSelectedEvent()
    expect(firstMeasureContent().some((item) => item.id === dynamicId)).toBe(false)
  })

  it('inserts into a selected measure and active voice', () => {
    useScoreStore.getState().setScore(createDemoScore())
    useScoreStore.getState().setSelection({
      type: 'measure',
      id: '2',
      partId: 'piano',
    })

    useScoreStore.getState().addVoiceToSelection()
    expect(useScoreStore.getState().activeSequenceIndex).toBe(1)

    useScoreStore.getState().insertNote('quarter', { step: 'B', octave: 3 })

    const measure = useScoreStore.getState().score!.parts[0].measures[1]
    expect(measure.sequences).toHaveLength(2)
    expect(measure.sequences[0].content).toHaveLength(4)
    expect(measure.sequences[1].content).toHaveLength(1)
    expect((measure.sequences[1].content[0] as EditableContentItem).notes?.[0].pitch?.step).toBe(
      'B',
    )
  })

  it('removes the active voice from the selected measure', () => {
    useScoreStore.getState().setScore(createDemoScore())
    useScoreStore.getState().setSelection({
      type: 'measure',
      id: '1',
      partId: 'piano',
    })

    useScoreStore.getState().addVoiceToSelection()
    useScoreStore.getState().insertRest('half')
    useScoreStore.getState().setSelection({
      type: 'measure',
      id: '1',
      partId: 'piano',
    })
    useScoreStore.getState().removeActiveVoiceFromSelection()

    const measure = useScoreStore.getState().score!.parts[0].measures[0]
    expect(measure.sequences).toHaveLength(1)
    expect(useScoreStore.getState().activeSequenceIndex).toBe(0)
    expect(useScoreStore.getState().selection?.type).toBe('measure')
  })

  it('reports complete rhythm for a full 4/4 voice', () => {
    useScoreStore.getState().setScore(createDemoScore())
    useScoreStore.getState().setSelection({
      type: 'measure',
      id: '1',
      partId: 'piano',
    })

    const selected = useScoreStore.getState().getSelectedMeasure()
    expect(selected?.rhythm.status).toBe('complete')
    expect(selected?.rhythm.usedBeats).toBe(4)
    expect(selected?.rhythm.expectedBeats).toBe(4)
  })

  it('reports underfull rhythm for a partially filled added voice', () => {
    useScoreStore.getState().setScore(createDemoScore())
    useScoreStore.getState().setSelection({
      type: 'measure',
      id: '2',
      partId: 'piano',
    })

    useScoreStore.getState().addVoiceToSelection()
    useScoreStore.getState().insertNote('quarter', { step: 'B', octave: 3 })

    const selectedEvent = useScoreStore.getState().getSelectedEvent()
    expect(selectedEvent?.rhythm.status).toBe('underfull')
    expect(selectedEvent?.rhythm.usedBeats).toBe(1)
    expect(selectedEvent?.rhythm.remainingBeats).toBe(3)

    useScoreStore.getState().setSelection({
      type: 'measure',
      id: '2',
      partId: 'piano',
    })
    const selectedMeasure = useScoreStore.getState().getSelectedMeasure()
    expect(selectedMeasure?.sequenceNumber).toBe(2)
    expect(selectedMeasure?.rhythm.status).toBe('underfull')
  })

  it('reports overfull rhythm when a voice exceeds measure capacity', () => {
    useScoreStore.getState().setScore(createDemoScore())
    useScoreStore.getState().setSelection({
      type: 'measure',
      id: '1',
      partId: 'piano',
    })

    useScoreStore.getState().insertNote('whole', { step: 'C', octave: 4 })

    const selectedEvent = useScoreStore.getState().getSelectedEvent()
    expect(selectedEvent?.rhythm.status).toBe('overfull')
    expect(selectedEvent?.rhythm.usedBeats).toBe(8)
    expect(selectedEvent?.rhythm.overfillBeats).toBe(4)
  })

  it('uses the core timeline for inherited meter, grace notes, and tuplets', () => {
    const score = singlePartScore({
      partId: 'piano',
      globalMeasures: [{ time: { count: 3, unit: 4 } }, {}],
      measures: [
        measureWithContent([]),
        measureWithContent([
          graceGroup([
            noteEvent({ id: 'grace-note', duration: '16th', pitch: { step: 'B', octave: 4 } }),
          ]),
          tupletEvent({
            content: (['C', 'D', 'E'] as const).map((step, index) =>
              noteEvent({
                id: `tuplet-note-${index + 1}`,
                duration: 'eighth',
                pitch: { step, octave: 4 },
              }),
            ),
          }),
          ...(['F', 'G'] as const).map((step, index) =>
            noteEvent({ id: `quarter-note-${index + 1}`, pitch: { step, octave: 4 } }),
          ),
        ]),
      ],
    })

    useScoreStore.getState().setScore(score)
    useScoreStore.getState().setSelection({
      type: 'measure',
      id: '2',
      partId: 'piano',
    })

    const selectedMeasure = useScoreStore.getState().getSelectedMeasure()
    expect(selectedMeasure?.rhythm.status).toBe('complete')
    expect(selectedMeasure?.rhythm.usedBeats).toBe(3)
    expect(selectedMeasure?.rhythm.expectedBeats).toBe(3)

    useScoreStore.getState().setSelection({
      type: 'note',
      id: 'tuplet-note-2',
      partId: 'piano',
    })

    const selectedEvent = useScoreStore.getState().getSelectedEvent()
    expect(selectedEvent?.rhythm.status).toBe('complete')
    expect(selectedEvent?.rhythm.usedBeats).toBe(3)
    expect(selectedEvent?.sequenceNumber).toBe(1)
    expect(selectedEvent?.eventIndex).toBe(1)
  })

  it('uses the timeline index to disambiguate selected duplicate ids by part', () => {
    const score = scoreFixture({
      parts: [
        {
          id: 'piano',
          measures: [measureWithContent([noteEvent({ id: 'shared-event' })])],
        },
        {
          id: 'violin',
          measures: [
            measureWithContent([
              noteEvent({ id: 'shared-event', pitch: { step: 'D', octave: 5 } }),
            ]),
          ],
        },
      ],
    })

    useScoreStore.getState().setScore(score)
    useScoreStore.getState().setSelection({
      type: 'note',
      id: 'shared-event',
      partId: 'violin',
    })

    const selectedEvent = useScoreStore.getState().getSelectedEvent()

    expect(selectedEvent?.partId).toBe('violin')
    expect(selectedEvent?.event.notes?.[0].pitch?.step).toBe('D')
    expect(selectedEvent?.event.notes?.[0].pitch?.octave).toBe(5)
  })
})
