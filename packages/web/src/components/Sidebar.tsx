import { useMemo, useState } from 'react'
import { Layers, Minus, Plus, Trash2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
    noteDurationBases,
    pitchSteps,
    getSelectedEventDetails,
    getSelectedMeasureDetails,
    type NoteDurationBase,
    type PitchStep,
    useScoreStore,
} from '@/store'
import type { Pitch } from '@melos/core'

const durationGlyphs: Record<NoteDurationBase, string> = {
    whole: '𝅝',
    half: '𝅗𝅥',
    quarter: '𝅘𝅥',
    eighth: '𝅘𝅥𝅮',
    '16th': '𝅘𝅥𝅯',
    '32nd': '𝅘𝅥𝅰',
}

const octaveOptions = Array.from({ length: 7 }, (_, index) => {
    const octave = index + 1
    return { value: octave.toString(), label: octave.toString() }
})

const pitchOptions = pitchSteps.map((step) => ({ value: step, label: step }))

const dynamicValues = ['pp', 'p', 'mp', 'mf', 'f', 'ff', 'sfz']

export function Sidebar() {
    const score = useScoreStore((s) => s.score)
    const selection = useScoreStore((s) => s.selection)
    const activeSequenceIndex = useScoreStore((s) => s.activeSequenceIndex)
    const insertNote = useScoreStore((s) => s.insertNote)
    const insertRest = useScoreStore((s) => s.insertRest)
    const insertDynamic = useScoreStore((s) => s.insertDynamic)
    const updateSelectedNoteAccidental = useScoreStore((s) => s.updateSelectedNoteAccidental)
    const addMeasure = useScoreStore((s) => s.addMeasure)
    const removeLastMeasure = useScoreStore((s) => s.removeLastMeasure)
    const addVoiceToSelection = useScoreStore((s) => s.addVoiceToSelection)
    const removeActiveVoiceFromSelection = useScoreStore((s) => s.removeActiveVoiceFromSelection)
    const setActiveSequence = useScoreStore((s) => s.setActiveSequence)
    const deleteSelectedEvent = useScoreStore((s) => s.deleteSelectedEvent)

    const [step, setStep] = useState<PitchStep>('C')
    const [octave, setOctave] = useState(4)
    const selectedEvent = useMemo(() => (
        getSelectedEventDetails(score, selection)
    ), [score, selection])
    const selectedMeasure = useMemo(() => (
        getSelectedMeasureDetails(score, selection, activeSequenceIndex)
    ), [score, selection, activeSequenceIndex])

    const canEdit = Boolean(score)
    const canEditNote = selectedEvent?.type === 'note'
    const voiceCount = selectedMeasure?.voiceCount ?? 1
    const voiceOptions = Array.from({ length: voiceCount }, (_, index) => ({
        value: index.toString(),
        label: `Voice ${index + 1}`,
    }))
    const pitch: Pitch = { step, octave }

    return (
        <aside className="bg-slate-900 p-5 overflow-y-auto flex flex-col gap-5 border-r border-slate-800">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Palette
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-300">
                        Pitch
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <Label htmlFor="palette-step">Step</Label>
                        <Select
                            id="palette-step"
                            options={pitchOptions}
                            value={step}
                            onChange={(event) => setStep(event.target.value as PitchStep)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="palette-octave">Octave</Label>
                        <Select
                            id="palette-octave"
                            options={octaveOptions}
                            value={octave.toString()}
                            onChange={(event) => setOctave(Number(event.target.value))}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-300">
                        Notes
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-2">
                    {noteDurationBases.map((duration) => (
                        <button
                            key={duration}
                            className="aspect-square rounded-lg flex items-center justify-center bg-slate-800 hover:bg-slate-700 hover:text-indigo-400 transition-colors border border-transparent hover:border-indigo-500/50 disabled:opacity-40 disabled:pointer-events-none"
                            disabled={!canEdit}
                            title={`Insert ${duration} note`}
                            onClick={() => insertNote(duration, pitch)}
                        >
                            <span className="text-lg font-serif">{durationGlyphs[duration]}</span>
                        </button>
                    ))}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-300">
                        Rests
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-2">
                    {noteDurationBases.map((duration) => (
                        <button
                            key={duration}
                            className="aspect-square rounded-lg flex items-center justify-center bg-slate-800 hover:bg-slate-700 hover:text-indigo-400 transition-colors border border-transparent hover:border-indigo-500/50 disabled:opacity-40 disabled:pointer-events-none"
                            disabled={!canEdit}
                            title={`Insert ${duration} rest`}
                            onClick={() => insertRest(duration)}
                        >
                            <span className="text-xs font-semibold uppercase">{duration.slice(0, 2)}</span>
                        </button>
                    ))}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-300">
                        Accidentals
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-4 gap-2">
                    {[
                        { value: 1, label: '♯', title: 'Sharp' },
                        { value: -1, label: '♭', title: 'Flat' },
                        { value: 0, label: '♮', title: 'Natural' },
                        { value: null, label: '×', title: 'Clear accidental' },
                    ].map((accidental) => (
                        <button
                            key={accidental.title}
                            className="aspect-square rounded-lg flex items-center justify-center bg-slate-800 hover:bg-slate-700 hover:text-indigo-400 transition-colors border border-transparent hover:border-indigo-500/50 disabled:opacity-40 disabled:pointer-events-none"
                            disabled={!canEditNote}
                            title={accidental.title}
                            onClick={() => updateSelectedNoteAccidental(accidental.value)}
                        >
                            <span className="text-lg">{accidental.label}</span>
                        </button>
                    ))}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-300">
                        Dynamics
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-4 gap-2">
                    {dynamicValues.map((dynamic) => (
                        <button
                            key={dynamic}
                            className="aspect-square rounded-lg flex items-center justify-center bg-slate-800 hover:bg-slate-700 hover:text-indigo-400 transition-colors border border-transparent hover:border-indigo-500/50 italic font-serif disabled:opacity-40 disabled:pointer-events-none"
                            disabled={!canEdit}
                            title={`Insert ${dynamic}`}
                            onClick={() => insertDynamic(dynamic)}
                        >
                            {dynamic}
                        </button>
                    ))}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-300">
                        Measures
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-2">
                    <Button
                        variant="secondary"
                        size="icon"
                        disabled={!canEdit}
                        onClick={addMeasure}
                        title="Add measure"
                    >
                        <Plus className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="secondary"
                        size="icon"
                        disabled={!canEdit}
                        onClick={removeLastMeasure}
                        title="Remove last measure"
                    >
                        <Minus className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="destructive"
                        size="icon"
                        disabled={!selectedEvent}
                        onClick={deleteSelectedEvent}
                        title="Delete selected event"
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-300">
                        <Layers className="w-4 h-4 text-indigo-400" />
                        Voices
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="space-y-2">
                        <Label htmlFor="palette-voice">Active Voice</Label>
                        <Select
                            id="palette-voice"
                            options={voiceOptions}
                            value={Math.min(activeSequenceIndex, voiceCount - 1).toString()}
                            disabled={!selectedMeasure}
                            onChange={(event) => setActiveSequence(Number(event.target.value))}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={!score}
                            onClick={addVoiceToSelection}
                            title="Add voice"
                        >
                            <Plus className="w-4 h-4" />
                            Voice
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={!selectedMeasure || selectedMeasure.voiceCount <= 1}
                            onClick={removeActiveVoiceFromSelection}
                            title="Remove active voice"
                        >
                            <Minus className="w-4 h-4" />
                            Voice
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </aside>
    )
}
