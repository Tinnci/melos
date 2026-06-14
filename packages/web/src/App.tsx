/**
 * Melos Studio – Main Application
 * MNX Music Notation Editor with TailwindCSS + shadcn/ui
 */

import { useCallback, useEffect, useState } from 'react'
import { useScoreStore, useTransportStore, createDemoScore } from './store'
import { useKeyboardShortcuts, usePersistence } from './hooks'
import { Dropzone } from './components/Dropzone'
import { ScoreCanvas } from './components/ScoreCanvas'
import { TransportBar } from './components/TransportBar'
import { PropertiesPanel } from './components/PropertiesPanel'
import { Sidebar } from './components/Sidebar'
import { Button } from './components/ui/button'
import { Badge } from './components/ui/badge'
import { AlertTriangle, Undo2, Redo2, Music, FileText, FileAudio } from 'lucide-react'
import { exportToPdf, exportToMidi } from './lib/exporter'
import { MusicXMLToMNX } from '@melos/converter'
import { MEIToMNX } from '@melos/mei'
import smuflEdgeCasesXml from '../test-fixtures/smufl-edge-cases.musicxml?raw'
import meiBasicFixture from '../../mei/test/data/basic.mei?raw'

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

  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [isExportingMidi, setIsExportingMidi] = useState(false)
  const scoreTitle = score
    ? score.parts.map((part) => part.name).filter(Boolean).join(' / ') || 'MNX Score'
    : 'No Score Loaded'

  // Initialize hooks
  useKeyboardShortcuts()
  usePersistence()

  useEffect(() => {
    const fixture = new URLSearchParams(window.location.search).get('fixture')
    if (fixture !== 'smufl-edge-cases' && fixture !== 'mei-basic') return

    try {
      const score = fixture === 'mei-basic'
        ? new MEIToMNX().convert(meiBasicFixture)
        : new MusicXMLToMNX().convert(smuflEdgeCasesXml)
      setScore(score)
    } catch (err) {
      console.error('Fixture load failed:', err)
      setError('Fixture load failed')
    }
  }, [setScore, setError])

  const handleLoadDemo = useCallback(() => {
    const demo = createDemoScore()
    setScore(demo)
  }, [setScore])

  const handleExportPdf = useCallback(async () => {
    if (!score) return
    setIsExportingPdf(true)
    try {
      await exportToPdf(score, 'melos-score')
    } catch (err) {
      console.error('PDF export failed:', err)
      setError('PDF export failed')
    } finally {
      setIsExportingPdf(false)
    }
  }, [score, setError])

  const handleExportMidi = useCallback(() => {
    if (!score) return
    setIsExportingMidi(true)
    try {
      exportToMidi(score, 'melos-score')
    } catch (err) {
      console.error('MIDI export failed:', err)
      setError('MIDI export failed')
    } finally {
      setIsExportingMidi(false)
    }
  }, [score, setError])

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [error, setError])

  return (
    <div className="live-theme grid min-h-screen grid-cols-[252px_1fr_300px] grid-rows-[44px_1fr] gap-0 bg-[#cfd1cc] text-[#121212]">
      {/* Header */}
      <header className="app-header col-span-3 flex items-center justify-between gap-4 border-b border-[#8c8f86] bg-[#e3e3dd] px-3 py-1.5 sticky top-0 z-50">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-sm border border-[#96320f] bg-[#ff5a1f]">
            <Music className="h-4 w-4 text-black" />
          </div>
          <span className="text-[13px] font-black text-[#111]">
            Melos Studio
          </span>
          <Badge variant="default">Beta</Badge>
        </div>

        {/* Transport Controls */}
        <TransportBar />

        {/* Actions */}
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1 pr-2 mr-1 border-r border-[#9a9c94]">
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
          {score && (
            <div className="flex items-center gap-1 pr-2 mr-1 border-r border-[#9a9c94]">
              <Button
                variant="ghost"
                size="icon"
                disabled={isExportingPdf}
                onClick={handleExportPdf}
                title="Export as PDF"
              >
                <FileText className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={isExportingMidi}
                onClick={handleExportMidi}
                title="Export as MIDI"
              >
                <FileAudio className="w-4 h-4" />
              </Button>
            </div>
          )}
          <Button variant="secondary" size="sm" onClick={handleLoadDemo}>
            Load Demo
          </Button>
        </div>
      </header>

      {/* Sidebar */}
      <Sidebar />

      {/* Main Canvas */}
      <main className="score-workspace schematic-surface flex flex-col overflow-hidden border-x border-[#8c8f86]">
        <div className="flex-1 flex flex-col p-2.5 gap-2 overflow-hidden">
          {/* Canvas Header */}
          <div className="flex items-center justify-between gap-3 border border-[#9a9c94] bg-[#e8e8e2] px-2.5 py-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-black uppercase text-[#c94412]">
                Score Preview
                {status === 'playing' && (
                  <span className="ml-2 text-[#317100] animate-pulse">Playing</span>
                )}
              </span>
              <h2 className="truncate text-[13px] font-bold text-[#121212]">
                {scoreTitle}
              </h2>
            </div>

            {/* Error toast */}
            {error && (
              <div className="flex items-center gap-1.5 border border-[#d52222] bg-[#ffd7d7] px-2 py-1 text-[11px] font-bold text-[#8a1111] animate-slide-up">
                <AlertTriangle className="h-3.5 w-3.5" />
                {error}
              </div>
            )}
          </div>

          {/* Score or Dropzone */}
          {score ? <ScoreCanvas /> : <Dropzone onLoadDemo={handleLoadDemo} />}
        </div>
      </main>

      {/* Right Panel */}
      <aside className="properties-rail flex flex-col gap-2 overflow-y-auto bg-[#dedfd9] p-2.5">
        <PropertiesPanel />
      </aside>
    </div>
  )
}

export default App
