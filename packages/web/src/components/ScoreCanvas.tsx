/**
 * Melos Studio - ScoreCanvas Component
 */

import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent } from 'react'
import { Braces, Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
import { Renderer } from '@melos/renderer'
import { Button } from '@/components/ui/button'
import { useScoreStore, type EditableEventKind } from '@/store'

export function ScoreCanvas() {
    const score = useScoreStore((s) => s.score)
    const isLoading = useScoreStore((s) => s.isLoading)
    const selection = useScoreStore((s) => s.selection)
    const setSelection = useScoreStore((s) => s.setSelection)

    const [zoom, setZoom] = useState(1)
    const [showSource, setShowSource] = useState(false)

    const renderer = useMemo(() => new Renderer(), [])

    const scoreMarkup = useMemo(() => {
        if (!score) return null
        try {
            return renderer.render(score)
        } catch (err) {
            console.error('Render error:', err)
            return null
        }
    }, [renderer, score])

    const sourceMarkup = useMemo(() => (
        score ? JSON.stringify(score, null, 2) : ''
    ), [score])

    useEffect(() => {
        document.querySelectorAll('.score-object.selected, .measure-hitbox.selected').forEach((element) => {
            element.classList.remove('selected')
        })

        if (!selection || !selection.id) return

        const selectedElement = selection.type === 'measure'
            ? document.querySelector(
                [
                    `[data-measure-index="${CSS.escape(selection.id)}"]`,
                    selection.partId ? `[data-part-id="${CSS.escape(selection.partId)}"]` : '',
                ].join('')
            )
            : document.querySelector(`[data-event-id="${CSS.escape(selection.id)}"]`)
        selectedElement?.classList.add('selected')
    })

    const handleCanvasClick = (event: MouseEvent) => {
        const target = event.target as Element
        const eventGroup = target.closest('[data-event-id]') as SVGElement | null

        if (eventGroup) {
            const eventId = eventGroup.getAttribute('data-event-id')
            const partId = eventGroup.getAttribute('data-part-id')
            const kind = eventGroup.getAttribute('data-event-kind') as EditableEventKind | null

            if (eventId && (kind === 'note' || kind === 'rest' || kind === 'dynamic')) {
                setSelection({
                    type: kind,
                    id: eventId,
                    partId: partId || undefined,
                })
                return
            }
        }

        const measureGroup = target.closest('[data-measure-index]') as SVGElement | null
        if (measureGroup) {
            const measureIndex = measureGroup.getAttribute('data-measure-index')
            const partId = measureGroup.getAttribute('data-part-id')

            if (measureIndex) {
                setSelection({
                    type: 'measure',
                    id: measureIndex,
                    partId: partId || undefined,
                })
                return
            }
        }

        setSelection(null)
    }

    const zoomStyle = { zoom } as CSSProperties

    if (isLoading) {
        return (
            <div className="flex-1 rounded-2xl bg-slate-900/80 border border-slate-800/50 p-6 animate-pulse">
                <div className="h-[300px] bg-slate-800/50 rounded-xl" />
            </div>
        )
    }

    if (!score || !scoreMarkup) {
        return null
    }

    return (
        <div
            className="
                flex-1 rounded-2xl bg-slate-900/80 backdrop-blur-xl
                border border-slate-800/50 p-4 overflow-hidden
                shadow-xl shadow-indigo-500/5 animate-slide-up
                relative flex flex-col gap-3
            "
        >
            <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/5 to-transparent rounded-2xl pointer-events-none" />

            <div className="relative z-10 flex items-center justify-between gap-3">
                <div className="text-xs font-mono text-slate-500">
                    {Math.round(zoom * 100)}%
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        title="Zoom out"
                        onClick={() => setZoom((value) => Math.max(0.5, value - 0.1))}
                    >
                        <ZoomOut className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        title="Reset zoom"
                        onClick={() => setZoom(1)}
                    >
                        <Maximize2 className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        title="Zoom in"
                        onClick={() => setZoom((value) => Math.min(2, value + 0.1))}
                    >
                        <ZoomIn className="w-4 h-4" />
                    </Button>
                    <Button
                        variant={showSource ? 'secondary' : 'ghost'}
                        size="icon"
                        title="MNX JSON"
                        onClick={() => setShowSource((value) => !value)}
                    >
                        <Braces className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            <div className="relative z-10 flex-1 overflow-auto rounded-lg bg-white p-6">
                <div
                    className="[&_svg]:w-full [&_svg]:h-auto [&_svg]:min-w-[600px]"
                    style={zoomStyle}
                    dangerouslySetInnerHTML={{ __html: scoreMarkup }}
                    onClick={handleCanvasClick}
                />
            </div>

            {showSource && (
                <pre className="relative z-10 max-h-64 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs leading-relaxed text-slate-300">
                    {sourceMarkup}
                </pre>
            )}
        </div>
    )
}
