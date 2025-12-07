/**
 * Melos Studio – PropertiesPanel Component
 * Editable score properties with TailwindCSS + shadcn/ui
 */

import { useScoreStore, useTransportStore } from '@/store'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Music2, Settings2, Clock } from 'lucide-react'

// Time signature options
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

// Key signature options (fifths from -7 to +7)
const keySignatureOptions = [
    { value: '-7', label: 'C♭ Major / a♭ minor' },
    { value: '-6', label: 'G♭ Major / e♭ minor' },
    { value: '-5', label: 'D♭ Major / b♭ minor' },
    { value: '-4', label: 'A♭ Major / f minor' },
    { value: '-3', label: 'E♭ Major / c minor' },
    { value: '-2', label: 'B♭ Major / g minor' },
    { value: '-1', label: 'F Major / d minor' },
    { value: '0', label: 'C Major / a minor' },
    { value: '1', label: 'G Major / e minor' },
    { value: '2', label: 'D Major / b minor' },
    { value: '3', label: 'A Major / f♯ minor' },
    { value: '4', label: 'E Major / c♯ minor' },
    { value: '5', label: 'B Major / g♯ minor' },
    { value: '6', label: 'F♯ Major / d♯ minor' },
    { value: '7', label: 'C♯ Major / a♯ minor' },
]

export function PropertiesPanel() {
    const score = useScoreStore((s) => s.score)
    const parts = useScoreStore((s) => s.parts)
    const selectedPartId = useScoreStore((s) => s.selectedPartId)
    const selectPart = useScoreStore((s) => s.selectPart)
    const updateTimeSignature = useScoreStore((s) => s.updateTimeSignature)
    const updateKeySignature = useScoreStore((s) => s.updateKeySignature)
    const updatePartName = useScoreStore((s) => s.updatePartName)

    const tempo = useTransportStore((s) => s.tempo)
    const setTempo = useTransportStore((s) => s.setTempo)

    const timeSignature = score?.global?.measures?.[0]?.time
    const keySignature = score?.global?.measures?.[0]?.key
    const measureCount = score?.global?.measures?.length ?? 0

    const currentTimeSig = timeSignature
        ? `${timeSignature.count}/${timeSignature.unit}`
        : '4/4'

    const currentKeySig = keySignature?.fifths?.toString() ?? '0'

    const handleTimeSignatureChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const [count, unit] = e.target.value.split('/').map(Number)
        updateTimeSignature(count, unit)
    }

    const handleKeySignatureChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        updateKeySignature(Number(e.target.value))
    }

    const handleTempoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = Number(e.target.value)
        if (!isNaN(value) && value > 0) {
            setTempo(value)
        }
    }

    return (
        <>
            {/* Score Properties - Now Editable! */}
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
                            {/* Time Signature */}
                            <div className="space-y-2">
                                <Label htmlFor="time-signature">Time Signature</Label>
                                <Select
                                    id="time-signature"
                                    options={timeSignatureOptions}
                                    value={currentTimeSig}
                                    onChange={handleTimeSignatureChange}
                                />
                            </div>

                            {/* Key Signature */}
                            <div className="space-y-2">
                                <Label htmlFor="key-signature">Key Signature</Label>
                                <Select
                                    id="key-signature"
                                    options={keySignatureOptions}
                                    value={currentKeySig}
                                    onChange={handleKeySignatureChange}
                                />
                            </div>

                            {/* Tempo */}
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

                            {/* Measures (read-only) */}
                            <div className="space-y-2">
                                <Label>Measures</Label>
                                <div className="px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50 font-mono text-sm text-white">
                                    {measureCount}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mb-3">
                                📝
                            </div>
                            <p className="text-sm font-medium text-slate-300">No Score</p>
                            <p className="text-xs text-slate-500 mt-1">
                                Load a demo or import a MusicXML file.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>



            {/* Parts */}
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
                                            <div onClick={(e) => e.stopPropagation()}>
                                                <Label htmlFor={`part-name-${part.id}`} className="sr-only">Part Name</Label>
                                                <Input
                                                    id={`part-name-${part.id}`}
                                                    value={part.name}
                                                    onChange={(e) => updatePartName(part.id, e.target.value)}
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
                        <p className="text-sm text-slate-500">No parts to display.</p>
                    )}
                </CardContent>
            </Card>

        </>
    )
}

