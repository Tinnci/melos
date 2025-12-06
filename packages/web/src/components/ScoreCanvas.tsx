/**
 * Melos Studio – ScoreCanvas Component
 */

import { useMemo } from 'react'
import { Renderer } from '@melos/renderer'
import { useScoreStore } from '@/store'

export function ScoreCanvas() {
    const score = useScoreStore((s) => s.score)
    const isLoading = useScoreStore((s) => s.isLoading)

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
        border border-slate-800/50 p-6 overflow-auto
        shadow-xl shadow-indigo-500/5 animate-slide-up
        relative
      "
        >
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/5 to-transparent rounded-2xl pointer-events-none" />

            {/* Score SVG */}
            <div
                className="relative z-10 [&_svg]:w-full [&_svg]:h-auto [&_svg]:min-w-[600px]"
                dangerouslySetInnerHTML={{ __html: scoreMarkup }}
            />
        </div>
    )
}
