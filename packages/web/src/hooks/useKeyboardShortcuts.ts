/**
 * Melos Studio – Keyboard Shortcuts Hook
 */

import { useEffect, useCallback } from 'react'
import { useScoreStore, useTransportStore } from '@/store'
import { AudioPlayer } from '@melos/player'

let playerInstance: AudioPlayer | null = null

function getPlayer(): AudioPlayer {
    if (!playerInstance) {
        playerInstance = new AudioPlayer()
    }
    return playerInstance
}

export function useKeyboardShortcuts() {
    const score = useScoreStore((s) => s.score)
    const undo = useScoreStore((s) => s.undo)
    const redo = useScoreStore((s) => s.redo)
    const canUndo = useScoreStore((s) => s.canUndo)
    const canRedo = useScoreStore((s) => s.canRedo)

    const { status, tempo, setStatus } = useTransportStore()

    const handlePlay = useCallback(async () => {
        if (!score) return

        const player = getPlayer()
        if (!player.isSupported()) {
            setStatus('unsupported')
            return
        }

        if (status === 'playing') {
            player.stop()
            setStatus('idle')
        } else {
            await player.init()
            player.setTempo(tempo)
            player.play(score)
            setStatus('playing')
        }
    }, [score, status, tempo, setStatus])

    const handleStop = useCallback(() => {
        const player = getPlayer()
        player.stop()
        setStatus('idle')
    }, [setStatus])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return
            }

            const isMac = navigator.platform.toUpperCase().includes('MAC')
            const modifier = isMac ? e.metaKey : e.ctrlKey

            if (e.code === 'Space') {
                e.preventDefault()
                handlePlay()
                return
            }

            if (e.code === 'Escape') {
                handleStop()
                return
            }

            if (modifier && !e.shiftKey && e.code === 'KeyZ') {
                e.preventDefault()
                if (canUndo()) undo()
                return
            }

            if (modifier && e.shiftKey && e.code === 'KeyZ') {
                e.preventDefault()
                if (canRedo()) redo()
                return
            }

            if (modifier && e.code === 'KeyY') {
                e.preventDefault()
                if (canRedo()) redo()
                return
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handlePlay, handleStop, undo, redo, canUndo, canRedo])

    return { handlePlay, handleStop }
}
