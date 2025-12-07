import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export function Sidebar() {
    return (
        <aside className="bg-slate-900 p-5 overflow-y-auto flex flex-col gap-5 border-r border-slate-800">
            {/* Palette Header */}
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Palette
            </div>

            {/* Note Input Tools */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-300">
                        Notes & Rests
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-4 gap-2">
                    {/* Placeholders for note icons */}
                    {['whole', 'half', 'quarter', 'eighth'].map((note) => (
                        <button
                            key={note}
                            className="aspect-square rounded flex items-center justify-center bg-slate-800 hover:bg-slate-700 hover:text-indigo-400 transition-colors border border-transparent hover:border-indigo-500/50"
                            title={note}
                        >
                            <span className="text-lg font-serif">
                                {note === 'whole' && '𝅝'}
                                {note === 'half' && '𝅗𝅥'}
                                {note === 'quarter' && '𝅘𝅥'}
                                {note === 'eighth' && '𝅘𝅥𝅮'}
                            </span>
                        </button>
                    ))}
                </CardContent>
            </Card>

            {/* Accidentals */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-300">
                        Accidentals
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-4 gap-2">
                    {['sharp', 'flat', 'natural'].map((acc) => (
                        <button
                            key={acc}
                            className="aspect-square rounded flex items-center justify-center bg-slate-800 hover:bg-slate-700 hover:text-indigo-400 transition-colors border border-transparent hover:border-indigo-500/50"
                            title={acc}
                        >
                            <span className="text-lg">
                                {acc === 'sharp' && '♯'}
                                {acc === 'flat' && '♭'}
                                {acc === 'natural' && '♮'}
                            </span>
                        </button>
                    ))}
                </CardContent>
            </Card>

            {/* Dynamics */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-300">
                        Dynamics
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-4 gap-2">
                    {['p', 'mf', 'f', 'ff'].map((dyn) => (
                        <button
                            key={dyn}
                            className="aspect-square rounded flex items-center justify-center bg-slate-800 hover:bg-slate-700 hover:text-indigo-400 transition-colors border border-transparent hover:border-indigo-500/50 italic font-serif"
                            title={dyn}
                        >
                            {dyn}
                        </button>
                    ))}
                </CardContent>
            </Card>
        </aside>
    )
}

