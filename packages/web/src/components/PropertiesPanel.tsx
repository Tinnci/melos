/**
 * Melos Studio – Properties Panel Component
 * Displays and edits score metadata and parts
 */

import { useScoreStore } from '../store'

export function PropertiesPanel() {
    const score = useScoreStore((s) => s.score)
    const parts = useScoreStore((s) => s.parts)
    const selectedPartId = useScoreStore((s) => s.selectedPartId)
    const selectPart = useScoreStore((s) => s.selectPart)

    // Extract score info
    const timeSignature = score?.global?.measures?.[0]?.time
    const keySignature = score?.global?.measures?.[0]?.key
    const measureCount = score?.global?.measures?.length ?? 0

    const formatTimeSignature = () => {
        if (!timeSignature) return '—'
        return `${timeSignature.count}/${timeSignature.unit}`
    }

    const formatKeySignature = () => {
        if (!keySignature) return '—'
        const fifths = keySignature.fifths ?? 0
        const keys = ['C♭', 'G♭', 'D♭', 'A♭', 'E♭', 'B♭', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'C♯']
        return `${keys[fifths + 7]} Major`
    }

    return (
        <>
            {/* Score Properties */}
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
                                <div className="prop-row__value">{formatTimeSignature()}</div>
                            </div>
                            <div className="prop-row">
                                <span className="prop-row__label">Key Signature</span>
                                <div className="prop-row__value">{formatKeySignature()}</div>
                            </div>
                            <div className="prop-row">
                                <span className="prop-row__label">Measures</span>
                                <div className="prop-row__value">{measureCount}</div>
                            </div>
                        </>
                    ) : (
                        <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
                            <div className="empty-state__illustration" style={{ width: '64px', height: '64px', fontSize: '1.5rem' }}>
                                📝
                            </div>
                            <div className="empty-state__title" style={{ fontSize: '1rem' }}>No Score</div>
                            <div className="empty-state__desc" style={{ fontSize: '0.85rem' }}>
                                Load a demo or import a MusicXML file.
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Parts List */}
            <div className="panel-card">
                <div className="panel-card__header">
                    <span className="panel-card__title">
                        <span className="panel-card__icon">🎻</span>
                        Parts ({parts.length})
                    </span>
                </div>
                <div className="panel-card__body">
                    {parts.length > 0 ? (
                        <div className="parts-list">
                            {parts.map((part) => (
                                <button
                                    key={part.id}
                                    className={`part-item ${selectedPartId === part.id ? 'part-item--selected' : ''}`}
                                    onClick={() => selectPart(part.id === selectedPartId ? null : part.id)}
                                >
                                    <div className="part-item__color" style={{ background: part.color }} />
                                    <div className="part-item__info">
                                        <div className="part-item__name">{part.name}</div>
                                        {part.shortName && (
                                            <div className="part-item__short">{part.shortName}</div>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                            No parts to display.
                        </p>
                    )}
                </div>
            </div>

            {/* Resources */}
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
        </>
    )
}
