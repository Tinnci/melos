/**
 * Melos Studio – Transport Store
 * Manages playback state and tempo
 */

import { create } from 'zustand'

export type TransportStatus = 'idle' | 'playing' | 'paused' | 'unsupported'

export interface TransportState {
    status: TransportStatus
    tempo: number
    currentTime: number
    duration: number

    // Actions
    setStatus: (status: TransportStatus) => void
    setTempo: (tempo: number) => void
    setCurrentTime: (time: number) => void
    setDuration: (duration: number) => void
    reset: () => void
}

export const useTransportStore = create<TransportState>((set) => ({
    status: 'idle',
    tempo: 100,
    currentTime: 0,
    duration: 0,

    setStatus: (status) => set({ status }),
    setTempo: (tempo) => set({ tempo }),
    setCurrentTime: (currentTime) => set({ currentTime }),
    setDuration: (duration) => set({ duration }),
    reset: () => set({ status: 'idle', currentTime: 0 }),
}))
