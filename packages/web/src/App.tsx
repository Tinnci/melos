import { useCallback, useMemo, useRef, useState } from 'react'
import { ScoreBuilder, type Score } from '@melos/core'
import { Renderer } from '@melos/renderer'
import { AudioPlayer } from '@melos/player'
import './App.css'

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

type TransportStatus = 'idle' | 'playing' | 'unsupported'

interface RoadmapItem {
  id: string
  title: string
  description: string
  milestone: string
  status: 'completed' | 'active' | 'pending'
}

// ═══════════════════════════════════════════════════════════════════════════
// Data
// ═══════════════════════════════════════════════════════════════════════════

const roadmapItems: RoadmapItem[] = [
  {
    id: '1',
    title: 'MusicXML Import',
    description: 'Drag-and-drop MusicXML files for automatic MNX conversion.',
    milestone: 'This Week',
    status: 'active',
  },
  {
    id: '2',
    title: 'State Management',
    description: 'Zustand store syncing Builder mutations with UI.',
    milestone: 'Week 2',
    status: 'pending',
  },
  {
    id: '3',
    title: 'Property Editor',
    description: 'Live editing of score metadata and part properties.',
    milestone: 'Week 3',
    status: 'pending',
  },
  {
    id: '4',
    title: 'Undo/Redo',
    description: 'Full history stack with keyboard shortcuts.',
    milestone: 'Week 4',
    status: 'pending',
  },
]

const quickActions = [
  {
    id: 'new',
    icon: '✨',
    title: 'New Score',
    description: 'Start from scratch with the Builder API',
  },
  {
    id: 'import',
    icon: '📂',
    title: 'Import File',
    description: 'Convert MusicXML to MNX format',
  },
  {
    id: 'demo',
    icon: '🎹',
    title: 'Load Demo',
    description: 'Explore a pre-built score example',
  },
  {
    id: 'docs',
    icon: '📖',
    title: 'MNX Docs',
    description: 'Learn about the W3C MNX standard',
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// Demo Score Builder
// ═══════════════════════════════════════════════════════════════════════════

function createDemoScore(): Score {
  const builder = new ScoreBuilder()

  builder.addGlobalMeasure({
    index: 1,
    time: { count: 4, unit: 4 },
    key: { fifths: 0 },
  })

  builder.addGlobalMeasure({ index: 2, time: { count: 4, unit: 4 } })
  builder.addGlobalMeasure({ index: 3, time: { count: 4, unit: 4 } })
  builder.addGlobalMeasure({ index: 4, time: { count: 4, unit: 4 } })

  builder.addPart('Piano', (part) => {
    part.setShortName('Pno.')

    part.addMeasure(1, (m) => {
      m.addSequence((seq) => {
        seq.note('C', 5, 'quarter')
        seq.note('D', 5, 'quarter')
        seq.note('E', 5, 'quarter')
        seq.note('F', 5, 'quarter')
      })
    })

    part.addMeasure(2, (m) => {
      m.addSequence((seq) => {
        seq.note('G', 5, 'quarter')
        seq.note('A', 5, 'quarter')
        seq.note('B', 5, 'quarter')
        seq.note('C', 6, 'quarter')
      })
    })

    part.addMeasure(3, (m) => {
      m.addSequence((seq) => {
        seq.chord(
          [
            { step: 'C', octave: 5 },
            { step: 'E', octave: 5 },
            { step: 'G', octave: 5 },
          ],
          'half'
        )
        seq.chord(
          [
            { step: 'D', octave: 5 },
            { step: 'F', octave: 5 },
            { step: 'A', octave: 5 },
          ],
          'half'
        )
      })
    })

    part.addMeasure(4, (m) => {
      m.addSequence((seq) => {
        seq.chord(
          [
            { step: 'C', octave: 5 },
            { step: 'E', octave: 5 },
            { step: 'G', octave: 5 },
            { step: 'C', octave: 6 },
          ],
          'whole'
        )
      })
    })
  })

  return builder.build()
}

// ═══════════════════════════════════════════════════════════════════════════
// App Component
// ═══════════════════════════════════════════════════════════════════════════

function App() {
  const renderer = useMemo(() => new Renderer(), [])
  const [score, setScore] = useState<Score | null>(null)
  const [tempo, setTempo] = useState(100)
  const [status, setStatus] = useState<TransportStatus>('idle')
  const [isDragOver, setIsDragOver] = useState(false)
  const playerRef = useRef<AudioPlayer | null>(null)

  const scoreMarkup = useMemo(() => {
    if (!score) return null
    return renderer.render(score)
  }, [renderer, score])

  const ensurePlayer = () => {
    if (!playerRef.current) {
      playerRef.current = new AudioPlayer()
    }
    return playerRef.current
  }

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
  }, [score, tempo])

  const handleStop = useCallback(() => {
    playerRef.current?.stop()
    setStatus('idle')
  }, [])

  const handleLoadDemo = useCallback(() => {
    const demo = createDemoScore()
    setScore(demo)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    // TODO: Implement MusicXML conversion
    const files = Array.from(e.dataTransfer.files)
    console.log('Dropped files:', files)
  }, [])

  const handleQuickAction = useCallback(
    (actionId: string) => {
      switch (actionId) {
        case 'demo':
          handleLoadDemo()
          break
        case 'docs':
          window.open('https://www.w3.org/2021/06/musicxml40/mnx-reference/', '_blank')
          break
        default:
          console.log(`Action: ${actionId}`)
      }
    },
    [handleLoadDemo]
  )

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
              className={`transport__btn ${status === 'playing' ? 'transport__btn--active' : 'transport__btn--primary'}`}
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
            {status === 'unsupported' && 'Unsupported'}
          </div>
        </div>

        <div className="studio__actions">
          <button className="btn btn--secondary btn--sm" onClick={handleLoadDemo}>
            Load Demo
          </button>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Sidebar (Roadmap) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <aside className="studio__sidebar">
        <div className="sidebar-section">
          <div className="sidebar-section__header">
            <span className="sidebar-section__title">Development Roadmap</span>
          </div>
          <div className="roadmap">
            {roadmapItems.map((item, idx) => (
              <div key={item.id} className={`roadmap__item roadmap__item--${item.status}`}>
                <div className="roadmap__indicator">
                  {item.status === 'completed' ? '✓' : idx + 1}
                </div>
                <div className="roadmap__content">
                  <div className="roadmap__title">{item.title}</div>
                  <div className="roadmap__desc">{item.description}</div>
                  <div className="roadmap__milestone">{item.milestone}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section__header">
            <span className="sidebar-section__title">Quick Actions</span>
          </div>
          <div className="actions-grid">
            {quickActions.map((action) => (
              <button
                key={action.id}
                className="action-card"
                onClick={() => handleQuickAction(action.id)}
              >
                <div className="action-card__icon">{action.icon}</div>
                <div className="action-card__title">{action.title}</div>
                <div className="action-card__desc">{action.description}</div>
              </button>
            ))}
          </div>
        </div>
      </aside>

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
          </div>

          {score && scoreMarkup ? (
            <div
              className="score-canvas"
              dangerouslySetInnerHTML={{ __html: scoreMarkup }}
            />
          ) : (
            <div
              className={`dropzone ${isDragOver ? 'dropzone--active' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleLoadDemo}
            >
              <div className="dropzone__icon">🎼</div>
              <div className="dropzone__title">Drop MusicXML or Click to Load Demo</div>
              <div className="dropzone__hint">
                Import .musicxml, .mxl, or .xml files to convert them to MNX format
              </div>
              <div className="dropzone__formats">
                <span className="dropzone__format">.musicxml</span>
                <span className="dropzone__format">.mxl</span>
                <span className="dropzone__format">.xml</span>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Right Panel (Properties) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <aside className="studio__panel">
        <div className="panel-card">
          <div className="panel-card__header">
            <span className="panel-card__title">
              <span className="panel-card__icon">📋</span>
              Score Properties
            </span>
          </div>
          <div className="panel-card__body">
            {score ? (
              <>
                <div className="prop-row">
                  <span className="prop-row__label">Time Signature</span>
                  <div className="prop-row__value">4/4</div>
                </div>
                <div className="prop-row">
                  <span className="prop-row__label">Key Signature</span>
                  <div className="prop-row__value">C Major</div>
                </div>
                <div className="prop-row">
                  <span className="prop-row__label">Measures</span>
                  <div className="prop-row__value">4</div>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-state__illustration">📝</div>
                <div className="empty-state__title">No Score</div>
                <div className="empty-state__desc">
                  Load a demo or import a MusicXML file to view properties.
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="panel-card">
          <div className="panel-card__header">
            <span className="panel-card__title">
              <span className="panel-card__icon">🎻</span>
              Parts
            </span>
          </div>
          <div className="panel-card__body">
            {score ? (
              <div className="parts-list">
                <div className="part-item">
                  <div className="part-item__color" style={{ background: '#6366f1' }} />
                  <div className="part-item__info">
                    <div className="part-item__name">Piano</div>
                    <div className="part-item__short">Pno.</div>
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                No parts to display.
              </p>
            )}
          </div>
        </div>

        <div className="panel-card">
          <div className="panel-card__header">
            <span className="panel-card__title">
              <span className="panel-card__icon">🔗</span>
              Resources
            </span>
          </div>
          <div className="panel-card__body">
            <a
              href="https://w3c.github.io/mnx/docs/"
              target="_blank"
              rel="noreferrer"
              className="btn btn--ghost btn--sm"
              style={{ width: '100%', justifyContent: 'flex-start' }}
            >
              📖 MNX Documentation
            </a>
            <a
              href="https://w3c.github.io/mnx/docs/mnx-reference/objects/"
              target="_blank"
              rel="noreferrer"
              className="btn btn--ghost btn--sm"
              style={{ width: '100%', justifyContent: 'flex-start' }}
            >
              📋 MNX Object Reference
            </a>
            <a
              href="https://w3c.github.io/mnx/docs/comparisons/musicxml/"
              target="_blank"
              rel="noreferrer"
              className="btn btn--ghost btn--sm"
              style={{ width: '100%', justifyContent: 'flex-start' }}
            >
              🔄 MusicXML Comparison
            </a>
            <a
              href="https://github.com/w3c/mnx"
              target="_blank"
              rel="noreferrer"
              className="btn btn--ghost btn--sm"
              style={{ width: '100%', justifyContent: 'flex-start' }}
            >
              🐙 W3C MNX Repository
            </a>
          </div>
        </div>
      </aside>
    </div>
  )
}

export default App
