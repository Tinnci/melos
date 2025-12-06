/**
 * Melos Studio – Transport Bar Component
 * Playback controls and tempo slider
 */

import { useCallback, useRef, useEffect } from 'react'
import { AudioPlayer } from '@melos/player'
import { useScoreStore, useTransportStore } from '../store'

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

    // Update tempo while playing
    useEffect(() => {
        if (playerRef.current && status === 'playing') {
            playerRef.current.setTempo(tempo)
        }
    }, [tempo, status])

    return (
        <div className="transport">
            <div className="transport__controls">
                <button
                    className="transport__btn"
                    onClick={handleStop}
                    data-tooltip="Stop"
                    aria-label="Stop playback"
                >
                    ⏹
                </button>
                <button
                    className={`transport__btn ${status === 'playing'
                            ? 'transport__btn--active'
                            : 'transport__btn--primary'
                        }`}
                    onClick={handlePlay}
                    disabled={!score}
                    data-tooltip="Play"
                    aria-label="Start playback"
                >
                    ▶
                </button>
            </div>

            <div className="transport__tempo">
                <span className="transport__tempo-label">Tempo</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                        type="range"
                        min={40}
                        max={200}
                        value={tempo}
                        onChange={(e) => setTempo(Number(e.target.value))}
                        style={{ flex: 1 }}
                        aria-label="Tempo slider"
                    />
                    <span className="transport__tempo-value">{tempo}</span>
                </div>
            </div>

            <div className={`transport__status transport__status--${status}`}>
                {status === 'idle' && 'Ready'}
                {status === 'playing' && 'Playing'}
                {status === 'paused' && 'Paused'}
                {status === 'unsupported' && 'Unsupported'}
            </div>
        </div>
    )
}
