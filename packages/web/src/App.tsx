/**
 * Melos Studio – Main Application
 * MNX Music Notation Editor with TailwindCSS + shadcn/ui
 */

import { useCallback, useEffect } from 'react'
import { useScoreStore, useTransportStore, createDemoScore } from './store'
import { useKeyboardShortcuts, usePersistence } from './hooks'
import { Dropzone } from './components/Dropzone'
import { ScoreCanvas } from './components/ScoreCanvas'
import { TransportBar } from './components/TransportBar'
import { PropertiesPanel } from './components/PropertiesPanel'
import { Sidebar } from './components/Sidebar'
import { Button } from './components/ui/button'
import { Badge } from './components/ui/badge'
import { Undo2, Redo2, Music } from 'lucide-react'

function App() {
  const score = useScoreStore((s) => s.score)
  const error = useScoreStore((s) => s.error)
  const setScore = useScoreStore((s) => s.setScore)
  const setError = useScoreStore((s) => s.setError)
  const canUndo = useScoreStore((s) => s.canUndo)
  const canRedo = useScoreStore((s) => s.canRedo)
  const undo = useScoreStore((s) => s.undo)
  const redo = useScoreStore((s) => s.redo)
  const status = useTransportStore((s) => s.status)

  // Initialize hooks
  useKeyboardShortcuts()
  usePersistence()

  const handleLoadDemo = useCallback(() => {
    const demo = createDemoScore()
    setScore(demo)
  }, [setScore])

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [error, setError])

  return (
    <div className="grid min-h-screen grid-cols-[280px_1fr_320px] grid-rows-[auto_1fr] gap-px bg-slate-800/50">
      {/* Header */}
      <header className="col-span-3 flex items-center justify-between gap-6 px-6 py-3 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800/50 sticky top-0 z-50">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Music className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Melos Studio
          </span>
          <Badge variant="default">Beta</Badge>
        </div>

        {/* Transport Controls */}
        <TransportBar />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 pr-3 mr-3 border-r border-slate-700">
            <Button
              variant="ghost"
              size="icon"
              disabled={!canUndo()}
              onClick={undo}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={!canRedo()}
              onClick={redo}
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 className="w-4 h-4" />
            </Button>
          </div>
          <Button variant="secondary" size="sm" onClick={handleLoadDemo}>
            Load Demo
          </Button>
        </div>
      </header>

      {/* Sidebar */}
      <Sidebar />

      {/* Main Canvas */}
      <main className="bg-slate-950 flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col p-5 gap-4 overflow-hidden">
          {/* Canvas Header */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wider text-indigo-400">
                Score Preview
                {status === 'playing' && (
                  <span className="ml-2 text-emerald-400 animate-pulse">• Playing</span>
                )}
              </span>
              <h2 className="text-lg font-semibold text-white">
                {score ? 'Piano Exercise' : 'No Score Loaded'}
              </h2>
            </div>

            {/* Keyboard hints */}
            <div className="hidden md:flex items-center gap-3 text-xs text-slate-500">
              <span>
                <kbd className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-mono mr-1">
                  Space
                </kbd>
                Play/Stop
              </span>
              <span>
                <kbd className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-mono mr-1">
                  Ctrl+Z
                </kbd>
                Undo
              </span>
            </div>

            {/* Error toast */}
            {error && (
              <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm animate-slide-up">
                ⚠️ {error}
              </div>
            )}
          </div>

          {/* Score or Dropzone */}
          {score ? <ScoreCanvas /> : <Dropzone onLoadDemo={handleLoadDemo} />}
        </div>
      </main>

      {/* Right Panel */}
      <aside className="bg-slate-900 p-5 overflow-y-auto flex flex-col gap-5">
        <PropertiesPanel />
      </aside>
    </div>
  )
}

export default App
