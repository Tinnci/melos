/**
 * Melos Studio – Main Application
 * MNX Music Notation Editor
 */

import { useCallback, useEffect } from 'react'
import { useScoreStore, useTransportStore, createDemoScore } from './store'
import { useKeyboardShortcuts, usePersistence } from './hooks'
import {
  Dropzone,
  ScoreCanvas,
  TransportBar,
  PropertiesPanel,
  Sidebar,
} from './components'
import './App.css'

// ═══════════════════════════════════════════════════════════════════════════
// App Component
// ═══════════════════════════════════════════════════════════════════════════

function App() {
  const score = useScoreStore((s) => s.score)
  const error = useScoreStore((s) => s.error)
  const setScore = useScoreStore((s) => s.setScore)
  const setError = useScoreStore((s) => s.setError)
  const canUndo = useScoreStore((s) => s.canUndo)
  const canRedo = useScoreStore((s) => s.canRedo)
  const status = useTransportStore((s) => s.status)

  // Initialize hooks
  useKeyboardShortcuts()
  usePersistence()

  // Load demo score on button click
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
    <div className="studio">
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Header / Toolbar */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <header className="studio__header">
        <div className="studio__logo">
          <div className="studio__logo-icon">♪</div>
          <span className="studio__logo-text">Melos Studio</span>
          <span className="studio__logo-badge">Beta</span>
        </div>

        <TransportBar />

        <div className="studio__actions">
          {/* Undo/Redo indicators */}
          <div className="studio__history">
            <button
              className="btn btn--ghost btn--icon"
              disabled={!canUndo()}
              data-tooltip="Undo (Ctrl+Z)"
              aria-label="Undo"
            >
              ↩
            </button>
            <button
              className="btn btn--ghost btn--icon"
              disabled={!canRedo()}
              data-tooltip="Redo (Ctrl+Shift+Z)"
              aria-label="Redo"
            >
              ↪
            </button>
          </div>
          <button className="btn btn--secondary btn--sm" onClick={handleLoadDemo}>
            Load Demo
          </button>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Sidebar (Roadmap + Quick Actions) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Sidebar />

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Main Canvas */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <main className="studio__main">
        <div className="canvas-container">
          <div className="canvas-header">
            <div className="canvas-header__info">
              <span className="canvas-header__label">
                Score Preview
                {status === 'playing' && (
                  <span className="canvas-header__status"> • Playing</span>
                )}
              </span>
              <h2 className="canvas-header__title">
                {score ? 'Piano Exercise' : 'No Score Loaded'}
              </h2>
            </div>
            <div className="canvas-header__shortcuts">
              <kbd>Space</kbd> Play/Stop
              <kbd>Ctrl+Z</kbd> Undo
            </div>
            {error && (
              <div className="error-toast">
                <span>⚠️ {error}</span>
              </div>
            )}
          </div>

          {score ? <ScoreCanvas /> : <Dropzone onLoadDemo={handleLoadDemo} />}
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Right Panel (Properties) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <aside className="studio__panel">
        <PropertiesPanel />
      </aside>
    </div>
  )
}

export default App
