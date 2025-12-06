/**
 * Melos Studio – Score Canvas Component
 * Renders the MNX score using the SVG renderer
 */

import { useMemo } from 'react'
import { Renderer } from '@melos/renderer'
import { useScoreStore } from '../store'

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
            <div className="score-canvas">
                <div className="skeleton skeleton--block" style={{ height: '300px' }} />
            </div>
        )
    }

    if (!score || !scoreMarkup) {
        return null
    }

    return (
        <div
            className="score-canvas"
            dangerouslySetInnerHTML={{ __html: scoreMarkup }}
        />
    )
}
