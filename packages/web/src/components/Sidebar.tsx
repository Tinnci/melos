/**
 * Melos Studio – Sidebar Component
 * Development roadmap and quick actions
 */

import { useCallback } from 'react'
import { useScoreStore, createDemoScore } from '../store'

interface RoadmapItem {
    id: string
    title: string
    description: string
    milestone: string
    status: 'completed' | 'active' | 'pending'
}

const roadmapItems: RoadmapItem[] = [
    {
        id: '1',
        title: 'MusicXML Import',
        description: 'Drag-and-drop MusicXML files for automatic MNX conversion.',
        milestone: 'This Week',
        status: 'completed',
    },
    {
        id: '2',
        title: 'State Management',
        description: 'Zustand store syncing Builder mutations with UI.',
        milestone: 'This Week',
        status: 'completed',
    },
    {
        id: '3',
        title: 'Property Editor',
        description: 'Live editing of score metadata and part properties.',
        milestone: 'Next Week',
        status: 'active',
    },
    {
        id: '4',
        title: 'Undo/Redo',
        description: 'Full history stack with keyboard shortcuts.',
        milestone: 'Week 3',
        status: 'pending',
    },
]

interface QuickAction {
    id: string
    icon: string
    title: string
    description: string
}

const quickActions: QuickAction[] = [
    {
        id: 'new',
        icon: '✨',
        title: 'New Score',
        description: 'Start from scratch with Builder API',
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

export function Sidebar() {
    const setScore = useScoreStore((s) => s.setScore)
    const clearScore = useScoreStore((s) => s.clearScore)

    const handleQuickAction = useCallback(
        (actionId: string) => {
            switch (actionId) {
                case 'demo':
                    setScore(createDemoScore())
                    break
                case 'new':
                    clearScore()
                    break
                case 'docs':
                    window.open('https://w3c.github.io/mnx/docs/', '_blank')
                    break
                default:
                    console.log(`Action: ${actionId}`)
            }
        },
        [setScore, clearScore]
    )

    return (
        <aside className="studio__sidebar">
            {/* Roadmap */}
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

            {/* Quick Actions */}
            <div className="sidebar-section">
                <div className="sidebar-section__header">
                    <span className="sidebar-section__title">Quick Actions</span>
                </div>
                <div className="actions-grid" style={{ gridTemplateColumns: '1fr' }}>
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
    )
}
