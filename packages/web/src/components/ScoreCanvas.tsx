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
            <div className="flex-1 border border-[#9a9c94] bg-[#e5e5df] p-2 animate-pulse">
                <div className="h-[300px] border border-[#b4b6ae] bg-[#d6d8d2]" />
            </div>
        )
    }

    if (!score || !scoreMarkup) {
        return null
    }

    return (
        <div
            className="
                schematic-surface flex-1
                border border-[#8f9289] p-2 overflow-hidden
                animate-slide-up
                relative flex flex-col gap-3
            "
        >
            <div className="relative z-10 flex items-center justify-between gap-2 border border-[#a6a8a0] bg-[#dedfd9] px-2 py-1">
                <div className="font-mono text-[11px] font-bold text-[#5e625a]">
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

            <div className="relative z-10 flex-1 overflow-auto border border-[#8f9289] bg-[#f4f4ef] p-3">
                <div
                    className="mx-auto w-fit border border-[#c9cbc5] bg-white p-4 [&_svg]:h-auto [&_svg]:min-w-[600px] [&_svg]:w-full"
                    style={zoomStyle}
                    role="application"
                    // biome-ignore lint/a11y/noNoninteractiveTabindex: The SVG selection surface needs keyboard focus for Escape clearing.
                    tabIndex={0}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') setSelection(null)
                    }}
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: Renderer output is trusted SVG generated from the in-memory score model.
                    dangerouslySetInnerHTML={{ __html: scoreMarkup }}
                    onClick={handleCanvasClick}
                />
            </div>

            {showSource && (
                <pre className="relative z-10 max-h-56 overflow-auto border border-[#8f9289] bg-[#f8f8f3] p-2 font-mono text-[11px] leading-relaxed text-[#20221f]">
                    {sourceMarkup}
                </pre>
            )}
        </div>
    )
}
