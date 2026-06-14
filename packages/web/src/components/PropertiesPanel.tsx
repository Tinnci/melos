/**
 * Melos Studio - PropertiesPanel Component
 * Editable score and selection properties.
 */

import { useMemo, type ChangeEvent } from 'react'
import {
    articulationOptions,
    getSelectedEventDetails,
    getSelectedMeasureDetails,
    noteDurationBases,
    noteheadOptions,
    pitchSteps,
    type NoteDurationBase,
    type NoteheadOption,
    type PitchStep,
    type VoiceRhythmSummary,
    useScoreStore,
    useTransportStore,
} from '@/store'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Clock, Layers, Minus, Music2, MousePointer2, Plus, Settings2, Trash2 } from 'lucide-react'

const timeSignatureOptions = [
    { value: '4/4', label: '4/4 (Common)' },
    { value: '3/4', label: '3/4 (Waltz)' },
    { value: '2/4', label: '2/4 (March)' },
    { value: '6/8', label: '6/8 (Compound)' },
    { value: '2/2', label: '2/2 (Cut Time)' },
    { value: '3/8', label: '3/8' },
    { value: '9/8', label: '9/8' },
    { value: '12/8', label: '12/8' },
]

const keySignatureOptions = [
    { value: '-7', label: 'Cb Major / ab minor' },
    { value: '-6', label: 'Gb Major / eb minor' },
    { value: '-5', label: 'Db Major / bb minor' },
    { value: '-4', label: 'Ab Major / f minor' },
    { value: '-3', label: 'Eb Major / c minor' },
    { value: '-2', label: 'Bb Major / g minor' },
    { value: '-1', label: 'F Major / d minor' },
    { value: '0', label: 'C Major / a minor' },
    { value: '1', label: 'G Major / e minor' },
    { value: '2', label: 'D Major / b minor' },
    { value: '3', label: 'A Major / f# minor' },
    { value: '4', label: 'E Major / c# minor' },
    { value: '5', label: 'B Major / g# minor' },
    { value: '6', label: 'F# Major / d# minor' },
    { value: '7', label: 'C# Major / a# minor' },
]

const durationOptions = noteDurationBases.map((duration) => ({
    value: duration,
    label: duration,
}))

const pitchOptions = pitchSteps.map((step) => ({ value: step, label: step }))

const noteheadSelectOptions = noteheadOptions.map((notehead) => ({
    value: notehead,
    label: notehead,
}))

const accidentalOptions = [
    { value: 'none', label: 'None' },
    { value: '-2', label: 'Double flat' },
    { value: '-1', label: 'Flat' },
    { value: '0', label: 'Natural' },
    { value: '1', label: 'Sharp' },
    { value: '2', label: 'Double sharp' },
]

const rhythmStatusClasses = {
    unknown: 'border-slate-600/50 bg-slate-700/20 text-slate-300',
    underfull: 'border-amber-500/35 bg-amber-500/10 text-amber-200',
    complete: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200',
    overfull: 'border-rose-500/35 bg-rose-500/10 text-rose-200',
} as const

function formatBeatCount(value: number): string {
    return Number.isInteger(value) ? value.toString() : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}

function getRhythmDetail(rhythm: VoiceRhythmSummary): string {
    const usage = `${formatBeatCount(rhythm.usedBeats)} / ${formatBeatCount(rhythm.expectedBeats)} beats`

    if (rhythm.status === 'underfull') {
        return `${usage}, ${formatBeatCount(rhythm.remainingBeats)} remaining`
    }

    if (rhythm.status === 'overfull') {
        return `${usage}, ${formatBeatCount(rhythm.overfillBeats)} over`
    }

    return usage
}

export function PropertiesPanel() {
    const score = useScoreStore((s) => s.score)
    const selection = useScoreStore((s) => s.selection)
    const activeSequenceIndex = useScoreStore((s) => s.activeSequenceIndex)
    const parts = useScoreStore((s) => s.parts)
    const selectedPartId = useScoreStore((s) => s.selectedPartId)
    const selectPart = useScoreStore((s) => s.selectPart)
    const updateTimeSignature = useScoreStore((s) => s.updateTimeSignature)
    const updateKeySignature = useScoreStore((s) => s.updateKeySignature)
    const updatePartName = useScoreStore((s) => s.updatePartName)
    const updateSelectedEventDuration = useScoreStore((s) => s.updateSelectedEventDuration)
    const updateSelectedNotePitch = useScoreStore((s) => s.updateSelectedNotePitch)
    const updateSelectedNoteAccidental = useScoreStore((s) => s.updateSelectedNoteAccidental)
    const updateSelectedNotehead = useScoreStore((s) => s.updateSelectedNotehead)
    const updateSelectedNoteColor = useScoreStore((s) => s.updateSelectedNoteColor)
    const toggleSelectedArticulation = useScoreStore((s) => s.toggleSelectedArticulation)
    const updateSelectedDynamic = useScoreStore((s) => s.updateSelectedDynamic)
    const addVoiceToSelection = useScoreStore((s) => s.addVoiceToSelection)
    const removeActiveVoiceFromSelection = useScoreStore((s) => s.removeActiveVoiceFromSelection)
    const setActiveSequence = useScoreStore((s) => s.setActiveSequence)
    const deleteSelectedEvent = useScoreStore((s) => s.deleteSelectedEvent)

    const tempo = useTransportStore((s) => s.tempo)
    const setTempo = useTransportStore((s) => s.setTempo)
    const selectedEvent = useMemo(() => (
        getSelectedEventDetails(score, selection)
    ), [score, selection])
    const selectedMeasure = useMemo(() => (
        getSelectedMeasureDetails(score, selection, activeSequenceIndex)
    ), [score, selection, activeSequenceIndex])

    const timeSignature = score?.global?.measures?.[0]?.time
    const keySignature = score?.global?.measures?.[0]?.key
    const measureCount = score?.global?.measures?.length ?? 0
    const currentTimeSig = timeSignature ? `${timeSignature.count}/${timeSignature.unit}` : '4/4'
    const currentKeySig = keySignature?.fifths?.toString() ?? '0'

    const event = selectedEvent?.event
    const selectedNote = event?.notes?.[0]
    const selectedPitch = selectedNote?.pitch
    const selectedDuration = event?.duration
    const selectedDots = selectedDuration?.dots ?? 0
    const selectedAccidental = selectedPitch?.alter
    const selectedNotehead = selectedNote?.notehead ?? 'default'
    const measureVoiceOptions = Array.from({ length: selectedMeasure?.voiceCount ?? 1 }, (_, index) => ({
        value: index.toString(),
        label: `Voice ${index + 1}`,
    }))

    const handleTimeSignatureChange = (event: ChangeEvent<HTMLSelectElement>) => {
        const [count, unit] = event.target.value.split('/').map(Number)
        updateTimeSignature(count, unit)
    }

    const handleKeySignatureChange = (event: ChangeEvent<HTMLSelectElement>) => {
        updateKeySignature(Number(event.target.value))
    }

    const handleTempoChange = (event: ChangeEvent<HTMLInputElement>) => {
        const value = Number(event.target.value)
        if (!Number.isNaN(value) && value > 0) {
            setTempo(value)
        }
    }

    const handleDurationChange = (event: ChangeEvent<HTMLSelectElement>) => {
        updateSelectedEventDuration(event.target.value as NoteDurationBase, selectedDots)
    }

    const handleDotsChange = (event: ChangeEvent<HTMLInputElement>) => {
        const dots = Math.max(0, Math.min(3, Number(event.target.value) || 0))
        updateSelectedEventDuration((selectedDuration?.base ?? 'quarter') as NoteDurationBase, dots)
    }

    const handleAccidentalChange = (event: ChangeEvent<HTMLSelectElement>) => {
        updateSelectedNoteAccidental(event.target.value === 'none' ? null : Number(event.target.value))
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>
                        <Settings2 className="w-4 h-4 text-indigo-400" />
                        Score Properties
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {score ? (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="time-signature">Time Signature</Label>
                                <Select
                                    id="time-signature"
                                    options={timeSignatureOptions}
                                    value={currentTimeSig}
                                    onChange={handleTimeSignatureChange}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="key-signature">Key Signature</Label>
                                <Select
                                    id="key-signature"
                                    options={keySignatureOptions}
                                    value={currentKeySig}
                                    onChange={handleKeySignatureChange}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="tempo">Tempo (BPM)</Label>
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-slate-500" />
                                    <Input
                                        id="tempo"
                                        type="number"
                                        min="20"
                                        max="300"
                                        value={tempo}
                                        onChange={handleTempoChange}
                                        className="font-mono"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Measures</Label>
                                <div className="px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50 font-mono text-sm text-white">
                                    {measureCount}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="py-8 text-center">
                            <p className="text-sm font-medium text-slate-300">No Score</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>
                        <MousePointer2 className="w-4 h-4 text-indigo-400" />
                        Selection
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {selectedMeasure ? (
                        <>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 py-2">
                                    <div className="text-slate-500">Type</div>
                                    <div className="mt-1 font-medium capitalize text-white">{selectedMeasure.type}</div>
                                </div>
                                <div className="rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 py-2">
                                    <div className="text-slate-500">Measure</div>
                                    <div className="mt-1 font-mono text-white">{selectedMeasure.measureNumber}</div>
                                </div>
                                <div className="rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 py-2">
                                    <div className="text-slate-500">Voices</div>
                                    <div className="mt-1 font-mono text-white">{selectedMeasure.voiceCount}</div>
                                </div>
                                <div className="rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 py-2">
                                    <div className="text-slate-500">Events</div>
                                    <div className="mt-1 font-mono text-white">{selectedMeasure.eventCount}</div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="selection-voice">Active Voice</Label>
                                <Select
                                    id="selection-voice"
                                    options={measureVoiceOptions}
                                    value={(selectedMeasure.sequenceNumber - 1).toString()}
                                    onChange={(event) => setActiveSequence(Number(event.target.value))}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={addVoiceToSelection}
                                >
                                    <Plus className="w-4 h-4" />
                                    Voice
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    disabled={selectedMeasure.voiceCount <= 1}
                                    onClick={removeActiveVoiceFromSelection}
                                >
                                    <Minus className="w-4 h-4" />
                                    Voice
                                </Button>
                            </div>

                            <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${rhythmStatusClasses[selectedMeasure.rhythm.status]}`}>
                                <Layers className="w-4 h-4" />
                                <div className="min-w-0">
                                    <div className="font-medium">Voice {selectedMeasure.sequenceNumber} - {selectedMeasure.rhythm.label}</div>
                                    <div className="mt-0.5 font-mono text-[11px] opacity-90">{getRhythmDetail(selectedMeasure.rhythm)}</div>
                                </div>
                            </div>
                        </>
                    ) : selectedEvent ? (
                        <>
                            <div className="grid grid-cols-3 gap-3 text-xs">
                                <div className="rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 py-2">
                                    <div className="text-slate-500">Type</div>
                                    <div className="mt-1 font-medium capitalize text-white">{selectedEvent.type}</div>
                                </div>
                                <div className="rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 py-2">
                                    <div className="text-slate-500">Measure</div>
                                    <div className="mt-1 font-mono text-white">{selectedEvent.measureNumber}</div>
                                </div>
                                <div className="rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 py-2">
                                    <div className="text-slate-500">Voice</div>
                                    <div className="mt-1 font-mono text-white">{selectedEvent.sequenceNumber}</div>
                                </div>
                            </div>

                            <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${rhythmStatusClasses[selectedEvent.rhythm.status]}`}>
                                <Layers className="w-4 h-4" />
                                <div className="min-w-0">
                                    <div className="font-medium">Voice {selectedEvent.sequenceNumber} - {selectedEvent.rhythm.label}</div>
                                    <div className="mt-0.5 font-mono text-[11px] opacity-90">{getRhythmDetail(selectedEvent.rhythm)}</div>
                                </div>
                            </div>

                            {selectedEvent.type !== 'dynamic' && (
                                <div className="grid grid-cols-[1fr_72px] gap-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="selection-duration">Duration</Label>
                                        <Select
                                            id="selection-duration"
                                            options={durationOptions}
                                            value={selectedDuration?.base ?? 'quarter'}
                                            onChange={handleDurationChange}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="selection-dots">Dots</Label>
                                        <Input
                                            id="selection-dots"
                                            type="number"
                                            min="0"
                                            max="3"
                                            value={selectedDots}
                                            onChange={handleDotsChange}
                                        />
                                    </div>
                                </div>
                            )}

                            {selectedEvent.type === 'note' && selectedPitch && (
                                <>
                                    <div className="grid grid-cols-[1fr_80px] gap-3">
                                        <div className="space-y-2">
                                            <Label htmlFor="selection-step">Step</Label>
                                            <Select
                                                id="selection-step"
                                                options={pitchOptions}
                                                value={selectedPitch.step}
                                                onChange={(event) => updateSelectedNotePitch({ step: event.target.value as PitchStep })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="selection-octave">Octave</Label>
                                            <Input
                                                id="selection-octave"
                                                type="number"
                                                min="0"
                                                max="9"
                                                value={selectedPitch.octave}
                                                onChange={(event) => updateSelectedNotePitch({ octave: Number(event.target.value) })}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="selection-accidental">Accidental</Label>
                                        <Select
                                            id="selection-accidental"
                                            options={accidentalOptions}
                                            value={selectedAccidental === undefined ? 'none' : selectedAccidental.toString()}
                                            onChange={handleAccidentalChange}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="selection-notehead">Notehead</Label>
                                        <Select
                                            id="selection-notehead"
                                            options={noteheadSelectOptions}
                                            value={selectedNotehead}
                                            onChange={(event) => updateSelectedNotehead(event.target.value as NoteheadOption)}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="selection-color">Color</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                id="selection-color"
                                                type="color"
                                                value={selectedNote?.color ?? '#000000'}
                                                onChange={(event) => updateSelectedNoteColor(event.target.value)}
                                                className="w-14 px-1"
                                            />
                                            <Input
                                                value={selectedNote?.color ?? ''}
                                                placeholder="#000000"
                                                onChange={(event) => updateSelectedNoteColor(event.target.value)}
                                                className="font-mono"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Articulations</Label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {articulationOptions.map((articulation) => (
                                                <label
                                                    key={articulation}
                                                    className="flex items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/40 px-3 py-2 text-xs text-slate-300"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={event?.articulations?.includes(articulation) ?? false}
                                                        onChange={() => toggleSelectedArticulation(articulation)}
                                                    />
                                                    <span>{articulation}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            {selectedEvent.type === 'dynamic' && (
                                <div className="space-y-2">
                                    <Label htmlFor="selection-dynamic">Dynamic</Label>
                                    <Input
                                        id="selection-dynamic"
                                        value={event?.value ?? ''}
                                        onChange={(event) => updateSelectedDynamic(event.target.value)}
                                        className="font-serif italic"
                                    />
                                </div>
                            )}

                            <Button
                                variant="destructive"
                                size="sm"
                                className="w-full"
                                onClick={deleteSelectedEvent}
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete
                            </Button>
                        </>
                    ) : (
                        <div className="py-8 text-center">
                            <p className="text-sm font-medium text-slate-300">No Selection</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>
                        <Music2 className="w-4 h-4 text-indigo-400" />
                        Parts ({parts.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {parts.length > 0 ? (
                        <div className="space-y-2">
                            {parts.map((part) => (
                                <div
                                    key={part.id}
                                    onClick={() => selectPart(part.id === selectedPartId ? null : part.id)}
                                    className={`
                                        w-full flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer
                                        ${selectedPartId === part.id
                                            ? 'bg-indigo-500/10 border-indigo-500/50'
                                            : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
                                        }
                                    `}
                                >
                                    <div
                                        className="w-1 h-7 rounded-full"
                                        style={{ background: part.color }}
                                    />
                                    <div className="flex-1 text-left min-w-0">
                                        {selectedPartId === part.id ? (
                                            <div onClick={(event) => event.stopPropagation()}>
                                                <Label htmlFor={`part-name-${part.id}`} className="sr-only">Part Name</Label>
                                                <Input
                                                    id={`part-name-${part.id}`}
                                                    value={part.name}
                                                    onChange={(event) => updatePartName(part.id, event.target.value)}
                                                    className="h-7 py-1 text-sm bg-slate-900/50 border-indigo-500/50 focus:border-indigo-500"
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                <div className="text-sm font-medium text-white truncate">{part.name}</div>
                                                {part.shortName && (
                                                    <div className="text-xs text-slate-500 truncate">{part.shortName}</div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500">No parts.</p>
                    )}
                </CardContent>
            </Card>
        </>
    )
}
