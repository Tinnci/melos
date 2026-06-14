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
        <div className="flex items-center gap-3 border border-[#8f9289] bg-[#d4d6d0] px-2 py-1">
            {/* Controls */}
            <div className="flex gap-1">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleStop}
                    title="Stop"
                    className="text-[#2b2d29]"
                >
                    <Square className="w-4 h-4" />
                </Button>
                <Button
                    variant={status === 'playing' ? 'default' : 'default'}
                    size="icon"
                    onClick={handlePlay}
                    disabled={!score}
                    title="Play"
                    className={status === 'playing' ? 'border-[#347200] bg-[#65bd13] hover:bg-[#76cf24] animate-pulse' : ''}
                >
                    <Play className="w-4 h-4" />
                </Button>
            </div>

            {/* Tempo */}
            <div className="flex items-center gap-2 min-w-[170px]">
                <span className="text-[10px] font-black uppercase text-[#5e625a]">
                    Tempo
                </span>
                <Slider
                    min={40}
                    max={200}
                    value={tempo}
                    onChange={(e) => setTempo(Number(e.target.value))}
                    className="flex-1"
                />
                <span className="w-8 text-right font-mono text-[12px] font-bold text-[#121212]">
                    {tempo}
                </span>
            </div>

            {/* Status */}
            <Badge
                variant={
                    status === 'playing' ? 'success' :
                        status === 'unsupported' ? 'destructive' :
                            'secondary'
                }
                className="gap-1"
            >
                {status === 'playing' && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#317100] animate-pulse" />
                )}
                {status === 'idle' && 'Ready'}
                {status === 'playing' && 'Playing'}
                {status === 'paused' && 'Paused'}
                {status === 'unsupported' && 'Unsupported'}
            </Badge>
        </div>
    )
}
