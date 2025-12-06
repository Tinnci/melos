/**
 * Melos Studio – LocalStorage Persistence Hook
 * Auto-saves and restores Score state from localStorage
 */

import { useEffect, useRef } from 'react'
import { useScoreStore } from '../store'
import type { Score } from '@melos/core'

const STORAGE_KEY = 'melos-studio-score'
const DEBOUNCE_MS = 1000

export function usePersistence() {
    const score = useScoreStore((s) => s.score)
    const setScore = useScoreStore((s) => s.setScore)
    const setError = useScoreStore((s) => s.setError)

    const isInitialLoad = useRef(true)
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Restore score from localStorage on mount
    useEffect(() => {
        if (!isInitialLoad.current) return
        isInitialLoad.current = false

        try {
            const saved = localStorage.getItem(STORAGE_KEY)
            if (saved) {
                const parsed = JSON.parse(saved) as Score
                // Basic validation
                if (parsed && parsed.global && parsed.parts) {
                    setScore(parsed)
                    console.log('[Persistence] Restored score from localStorage')
                }
            }
        } catch (err) {
            console.warn('[Persistence] Failed to restore score:', err)
            // Don't show error to user, just start fresh
        }
    }, [setScore])

    // Save score to localStorage (debounced)
    useEffect(() => {
        // Skip initial render and empty scores
        if (!score) return

        // Clear previous timeout
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current)
        }

        // Debounce save
        saveTimeoutRef.current = setTimeout(() => {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(score))
                console.log('[Persistence] Saved score to localStorage')
            } catch (err) {
                console.warn('[Persistence] Failed to save score:', err)
                if (err instanceof Error && err.name === 'QuotaExceededError') {
                    setError('Storage quota exceeded. Score may not be saved.')
                }
            }
        }, DEBOUNCE_MS)

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current)
            }
        }
    }, [score, setError])

    // Clear saved score
    const clearSavedScore = () => {
        try {
            localStorage.removeItem(STORAGE_KEY)
            console.log('[Persistence] Cleared saved score')
        } catch (err) {
            console.warn('[Persistence] Failed to clear saved score:', err)
        }
    }

    return { clearSavedScore }
}
