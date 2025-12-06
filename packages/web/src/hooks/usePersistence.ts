/**
 * Melos Studio – LocalStorage Persistence Hook
 */

import { useEffect, useRef } from 'react'
import { useScoreStore } from '@/store'
import type { Score } from '@melos/core'

const STORAGE_KEY = 'melos-studio-score'
const DEBOUNCE_MS = 1000

export function usePersistence() {
    const score = useScoreStore((s) => s.score)
    const setScore = useScoreStore((s) => s.setScore)
    const setError = useScoreStore((s) => s.setError)

    const isInitialLoad = useRef(true)
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        if (!isInitialLoad.current) return
        isInitialLoad.current = false

        try {
            const saved = localStorage.getItem(STORAGE_KEY)
            if (saved) {
                const parsed = JSON.parse(saved) as Score
                if (parsed && parsed.global && parsed.parts) {
                    setScore(parsed)
                    console.log('[Persistence] Restored score from localStorage')
                }
            }
        } catch (err) {
            console.warn('[Persistence] Failed to restore score:', err)
        }
    }, [setScore])

    useEffect(() => {
        if (!score) return

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current)
        }

        saveTimeoutRef.current = setTimeout(() => {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(score))
                console.log('[Persistence] Saved score to localStorage')
            } catch (err) {
                console.warn('[Persistence] Failed to save score:', err)
                if (err instanceof Error && err.name === 'QuotaExceededError') {
                    setError('Storage quota exceeded.')
                }
            }
        }, DEBOUNCE_MS)

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current)
            }
        }
    }, [score, setError])

    const clearSavedScore = () => {
        try {
            localStorage.removeItem(STORAGE_KEY)
        } catch (err) {
            console.warn('[Persistence] Failed to clear:', err)
        }
    }

    return { clearSavedScore }
}
