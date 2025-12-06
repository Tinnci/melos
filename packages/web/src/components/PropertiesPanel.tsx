/**
 * Melos Studio – PropertiesPanel Component
 * Editable score properties with TailwindCSS + shadcn/ui
 */

import { useScoreStore } from '@/store'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { ClipboardList, Music2, Link2, ExternalLink, Settings2 } from 'lucide-react'

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
                                <button
                                    key={part.id}
                                    onClick={() => selectPart(part.id === selectedPartId ? null : part.id)}
                                    className={`
                    w-full flex items-center gap-3 p-3 rounded-lg border transition-all
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
                                    <div className="text-left">
                                        <div className="text-sm font-medium text-white">{part.name}</div>
                                        {part.shortName && (
                                            <div className="text-xs text-slate-500">{part.shortName}</div>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500">No parts to display.</p>
                    )}
                </CardContent>
            </Card>

            {/* Resources */}
            <Card>
                <CardHeader>
                    <CardTitle>
                        <Link2 className="w-4 h-4 text-indigo-400" />
                        Resources
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <ResourceLink
                        href="https://w3c.github.io/mnx/docs/"
                        icon="📖"
                        label="MNX Documentation"
                    />
                    <ResourceLink
                        href="https://w3c.github.io/mnx/docs/mnx-reference/objects/"
                        icon="📋"
                        label="MNX Object Reference"
                    />
                    <ResourceLink
                        href="https://w3c.github.io/mnx/docs/comparisons/musicxml/"
                        icon="🔄"
                        label="MusicXML Comparison"
                    />
                    <ResourceLink
                        href="https://github.com/w3c/mnx"
                        icon="🐙"
                        label="W3C MNX Repository"
                    />
                </CardContent>
            </Card>
        </>
    )
}

function ResourceLink({ href, icon, label }: { href: string; icon: string; label: string }) {
    return (
        <Button
            variant="ghost"
            size="sm"
            asChild
            className="w-full justify-start gap-2 text-slate-400 hover:text-white"
        >
            <a href={href} target="_blank" rel="noreferrer">
                <span>{icon}</span>
                {label}
                <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
            </a>
        </Button>
    )
}
