/**
 * Melos Studio – TransportBar Component
 * Playback controls with TailwindCSS + shadcn/ui
 */

import { useCallback, useRef, useEffect } from 'react'
import { AudioPlayer } from '@melos/player'
import { useScoreStore, useTransportStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Play, Square } from 'lucide-react'

export function TransportBar() {
    const score = useScoreStore((s) => s.score)
    const { status, tempo, setStatus, setTempo } = useTransportStore()
    const playerRef = useRef<AudioPlayer | null>(null)

    const ensurePlayer = useCallback(() => {
        if (!playerRef.current) {
            playerRef.current = new AudioPlayer()
        }
        return playerRef.current
    }, [])

    const handlePlay = useCallback(async () => {
        if (!score) return

        const player = ensurePlayer()
        if (!player.isSupported()) {
            setStatus('unsupported')
            return
        }

        await player.init()
        player.setTempo(tempo)
        player.play(score)
        setStatus('playing')
    }, [score, tempo, ensurePlayer, setStatus])

    const handleStop = useCallback(() => {
        playerRef.current?.stop()
        setStatus('idle')
    }, [setStatus])

    useEffect(() => {
        if (playerRef.current && status === 'playing') {
            playerRef.current.setTempo(tempo)
        }
    }, [tempo, status])

    return (
        <div className="flex items-center gap-4 px-4 py-2 bg-slate-800/50 rounded-xl border border-slate-700/50">
            {/* Controls */}
            <div className="flex gap-1">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleStop}
                    title="Stop"
                    className="text-slate-400 hover:text-white"
                >
                    <Square className="w-4 h-4" />
                </Button>
                <Button
                    variant={status === 'playing' ? 'default' : 'default'}
                    size="icon"
                    onClick={handlePlay}
                    disabled={!score}
                    title="Play"
                    className={status === 'playing' ? 'bg-emerald-600 hover:bg-emerald-500 animate-pulse' : ''}
                >
                    <Play className="w-4 h-4" />
                </Button>
            </div>

            {/* Tempo */}
            <div className="flex flex-col gap-1 min-w-[140px]">
                <span className="text-[10px] uppercase tracking-wider text-slate-500">
                    Tempo
                </span>
                <div className="flex items-center gap-2">
                    <Slider
                        min={40}
                        max={200}
                        value={tempo}
                        onChange={(e) => setTempo(Number(e.target.value))}
                        className="flex-1"
                    />
                    <span className="text-sm font-mono font-medium text-white w-8 text-right">
                        {tempo}
                    </span>
                </div>
            </div>

            {/* Status */}
            <Badge
                variant={
                    status === 'playing' ? 'success' :
                        status === 'unsupported' ? 'destructive' :
                            'secondary'
                }
                className="gap-1.5"
            >
                {status === 'playing' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
                {status === 'idle' && 'Ready'}
                {status === 'playing' && 'Playing'}
                {status === 'paused' && 'Paused'}
                {status === 'unsupported' && 'Unsupported'}
            </Badge>
        </div>
    )
}
