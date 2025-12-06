/**
 * Melos Studio – PropertiesPanel Component
 */

import { useScoreStore } from '@/store'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ClipboardList, Music2, Link2, ExternalLink } from 'lucide-react'

export function PropertiesPanel() {
    const score = useScoreStore((s) => s.score)
    const parts = useScoreStore((s) => s.parts)
    const selectedPartId = useScoreStore((s) => s.selectedPartId)
    const selectPart = useScoreStore((s) => s.selectPart)

    const timeSignature = score?.global?.measures?.[0]?.time
    const keySignature = score?.global?.measures?.[0]?.key
    const measureCount = score?.global?.measures?.length ?? 0

    const formatTimeSignature = () => {
        if (!timeSignature) return '—'
        return `${timeSignature.count}/${timeSignature.unit}`
    }

    const formatKeySignature = () => {
        if (!keySignature) return '—'
        const fifths = keySignature.fifths ?? 0
        const keys = ['C♭', 'G♭', 'D♭', 'A♭', 'E♭', 'B♭', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'C♯']
        return `${keys[fifths + 7]} Major`
    }

    return (
        <>
            {/* Score Properties */}
            <Card>
                <CardHeader>
                    <CardTitle>
                        <ClipboardList className="w-4 h-4 text-indigo-400" />
                        Score Properties
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {score ? (
                        <>
                            <PropertyRow label="Time Signature" value={formatTimeSignature()} />
                            <PropertyRow label="Key Signature" value={formatKeySignature()} />
                            <PropertyRow label="Measures" value={String(measureCount)} />
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

function PropertyRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">
                {label}
            </span>
            <div className="px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50 font-mono text-sm text-white">
                {value}
            </div>
        </div>
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
