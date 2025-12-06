/**
 * Melos Studio – Sidebar Component
 */

import { useCallback } from 'react'
import { useScoreStore, createDemoScore } from '@/store'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Sparkles, Music, BookOpen, CheckCircle2, Circle, CircleDot } from 'lucide-react'

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
        milestone: 'Done',
        status: 'completed',
    },
    {
        id: '2',
        title: 'State Management',
        description: 'Zustand store syncing Builder mutations with UI.',
        milestone: 'Done',
        status: 'completed',
    },
    {
        id: '3',
        title: 'Property Editor',
        description: 'Live editing of score metadata and part properties.',
        milestone: 'Next',
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
    icon: React.ReactNode
    title: string
    description: string
}

const quickActions: QuickAction[] = [
    {
        id: 'new',
        icon: <Sparkles className="w-5 h-5" />,
        title: 'New Score',
        description: 'Start from scratch',
    },
    {
        id: 'demo',
        icon: <Music className="w-5 h-5" />,
        title: 'Load Demo',
        description: 'Explore example',
    },
    {
        id: 'docs',
        icon: <BookOpen className="w-5 h-5" />,
        title: 'MNX Docs',
        description: 'Learn the standard',
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
            }
        },
        [setScore, clearScore]
    )

    return (
        <aside className="bg-slate-900 p-5 overflow-y-auto flex flex-col gap-5">
            {/* Roadmap */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-xs uppercase tracking-wider text-slate-400">
                        Development Roadmap
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 -mt-2">
                    {roadmapItems.map((item) => (
                        <div
                            key={item.id}
                            className="flex gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition-colors"
                        >
                            <div className="pt-0.5">
                                {item.status === 'completed' && (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                )}
                                {item.status === 'active' && (
                                    <CircleDot className="w-5 h-5 text-indigo-500" />
                                )}
                                {item.status === 'pending' && (
                                    <Circle className="w-5 h-5 text-slate-600" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-slate-200">{item.title}</div>
                                <div className="text-xs text-slate-500 line-clamp-2">{item.description}</div>
                                <span className={`
                  mt-1 inline-block text-[10px] uppercase tracking-wider font-medium
                  ${item.status === 'completed' ? 'text-emerald-500' :
                                        item.status === 'active' ? 'text-indigo-400' : 'text-slate-600'}
                `}>
                                    {item.milestone}
                                </span>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-xs uppercase tracking-wider text-slate-400">
                        Quick Actions
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 -mt-2">
                    {quickActions.map((action) => (
                        <button
                            key={action.id}
                            onClick={() => handleQuickAction(action.id)}
                            className="
                w-full flex items-center gap-3 p-3 rounded-lg
                bg-slate-800/30 border border-slate-700/50
                hover:bg-slate-800 hover:border-slate-600 transition-all
                text-left group
              "
                        >
                            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
                                {action.icon}
                            </div>
                            <div>
                                <div className="text-sm font-medium text-slate-200">{action.title}</div>
                                <div className="text-xs text-slate-500">{action.description}</div>
                            </div>
                        </button>
                    ))}
                </CardContent>
            </Card>
        </aside>
    )
}
