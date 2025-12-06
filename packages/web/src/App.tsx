/**
 * Melos Studio – Main Application
 * MNX Music Notation Editor
 */

import { useCallback, useEffect } from 'react'
import { useScoreStore, createDemoScore } from './store'
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

  // Load demo score on button click
  const handleLoadDemo = useCallback(() => {
    const demo = createDemoScore()
    setScore(demo)
  }, [setScore])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (_e: KeyboardEvent) => {
      // Ctrl/Cmd + Z = Undo (placeholder)
      // Ctrl/Cmd + Shift + Z = Redo (placeholder)
      // Space = Play/Stop (placeholder)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

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
              <span className="canvas-header__label">Score Preview</span>
              <h2 className="canvas-header__title">
                {score ? 'Piano Exercise' : 'No Score Loaded'}
              </h2>
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
