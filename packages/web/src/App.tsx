import { useMemo, useRef, useState } from 'react'
import { ScoreBuilder } from '@melos/core'
import { Renderer } from '@melos/renderer'
import { AudioPlayer } from '@melos/player'
import './App.css'

type TransportStatus = 'idle' | 'playing' | 'unsupported'

const planTracks = [
  {
    title: 'Renderer Surface',
    description: 'Adaptive canvas wired to the SVG renderer plus responsive layout primitives.',
    milestone: 'Week 1',
  },
  {
    title: 'Conversion Loop',
    description: 'MusicXML ingestion -> converter service -> MNX diagnostics surfaced inline.',
    milestone: 'Week 2',
  },
  {
    title: 'Builder Editing',
    description: 'Property panel mutates a shared builder store that re-renders the score + audio.',
    milestone: 'Week 3',
  },
]

const studioActions = [
  {
    label: 'Open MNX Spec',
    detail: 'Review W3C objects we still need to support before exposing editing tools.',
    href: 'https://www.w3.org/2021/06/musicxml40/musicxml-reference/',
  },
  {
    label: 'Sync Snapshot Suite',
    detail: 'Run `bun test` on converter + renderer snapshots before shipping UI changes.',
  },
  {
    label: 'Design Property Panel',
    detail: 'Translate current Builder API into editable forms with optimistic updates.',
  },
]

const statusCopy: Record<TransportStatus, string> = {
  idle: 'Preview ready',
  playing: 'Playing demo sketch',
  unsupported: 'Audio unavailable in this browser',
}

function createDemoScore() {
  const builder = new ScoreBuilder()

  builder.addGlobalMeasure({
    index: 1,
    time: { count: 4, unit: 4 },
    key: { fifths: 0 },
  })

  builder.addGlobalMeasure({
    index: 2,
    time: { count: 4, unit: 4 },
  })

  builder.addGlobalMeasure({
    index: 3,
    time: { count: 4, unit: 4 },
  })

  builder.addPart('Studio Strings', (part) => {
    part.setShortName('Str.')

    part.addMeasure(1, (measure) => {
      measure.addSequence((seq) => {
        seq.note('C', 4, 'quarter')
        seq.note('E', 4, 'quarter')
        seq.note('G', 4, 'quarter')
        seq.note('B', 4, 'quarter')
      })
    })

    part.addMeasure(2, (measure) => {
      measure.addSequence((seq) => {
        seq.chord(
          [
            { step: 'C', octave: 4 },
            { step: 'G', octave: 4 },
            { step: 'E', octave: 5 },
          ],
          'half',
        )
        seq.rest('quarter')
        seq.note('F', 4, 'quarter')
      })
    })

    part.addMeasure(3, (measure) => {
      measure.addSequence((seq) => {
        seq.note('A', 3, 'quarter')
        seq.note('C', 4, 'eighth')
        seq.note('D', 4, 'eighth')
        seq.note('E', 4, 'quarter')
        seq.note('G', 4, 'quarter')
      })
    })
  })

  return builder.build()
}

function App() {
  const renderer = useMemo(() => new Renderer(), [])
  const demoScore = useMemo(() => createDemoScore(), [])
  const scoreMarkup = useMemo(() => renderer.render(demoScore), [renderer, demoScore])
  const playerRef = useRef<AudioPlayer | null>(null)
  const [tempo, setTempo] = useState(96)
  const [status, setStatus] = useState<TransportStatus>('idle')

  const ensurePlayer = () => {
    if (!playerRef.current) {
      playerRef.current = new AudioPlayer()
    }
    return playerRef.current
  }

  const handlePlay = async () => {
    const player = ensurePlayer()
    if (!player.isSupported()) {
      setStatus('unsupported')
      return
    }

    await player.init()
    player.setTempo(tempo)
    player.play(demoScore)
    setStatus('playing')
  }

  const handleStop = () => {
    if (playerRef.current) {
      playerRef.current.stop()
    }
    setStatus('idle')
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Phase 5 · Studio</p>
          <h1>Melos Web Editor Kickoff</h1>
          <p className="lede">
            Cohesive UI shell that connects the converter, renderer, and player so we can iterate on
            MNX-centric workflows directly in the browser.
          </p>
        </div>
        <div className="hero-actions">
          <button type="button" className="accent-button" onClick={handlePlay}>
            Play Demo
          </button>
          <button type="button" className="ghost-button" onClick={handleStop}>
            Stop Audio
          </button>
        </div>
      </header>

      <div className="layout">
        <aside className="plan-panel">
          <p className="eyebrow">Execution Tracks</p>
          <h2>What ships next</h2>
          <ul className="plan-list">
            {planTracks.map((track, idx) => (
              <li key={track.title}>
                <span className="plan-index">{String(idx + 1).padStart(2, '0')}</span>
                <div>
                  <p className="plan-title">{track.title}</p>
                  <p className="plan-desc">{track.description}</p>
                  <span className="plan-milestone">{track.milestone}</span>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        <main className="studio-stage">
          <section className="canvas-card">
            <div className="canvas-head">
              <div>
                <p className="eyebrow">Renderer Preview</p>
                <h3>Studio Sketch</h3>
              </div>
              <span className={`status-pill status-${status}`}>{statusCopy[status]}</span>
            </div>
            <div className="score-frame" dangerouslySetInnerHTML={{ __html: scoreMarkup }} />
          </section>

          <section className="transport-card">
            <div className="transport-row">
              <div>
                <p className="eyebrow">Transport</p>
                <h3>Audio Prototype</h3>
              </div>
              <div className="transport-controls">
                <button type="button" onClick={handlePlay}>
                  Play
                </button>
                <button type="button" onClick={handleStop}>
                  Stop
                </button>
              </div>
            </div>
            <label className="slider-label">
              Tempo {tempo} bpm
              <input
                type="range"
                min={60}
                max={160}
                value={tempo}
                onChange={(event) => setTempo(Number(event.target.value))}
              />
            </label>
            <p className="transport-hint">Web Audio initializes on first interaction. Keep the tab focused.</p>
          </section>

          <section className="action-card">
            <p className="eyebrow">Coordination</p>
            <h3>Immediate actions</h3>
            <div className="action-grid">
              {studioActions.map((action) => (
                <article key={action.label} className="action-tile">
                  <h4>{action.label}</h4>
                  <p>{action.detail}</p>
                  {action.href ? (
                    <a href={action.href} target="_blank" rel="noreferrer" className="text-link">
                      Open resource ↗
                    </a>
                  ) : (
                    <button type="button" className="text-link">
                      Mark done
                    </button>
                  )}
                </article>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

export default App
