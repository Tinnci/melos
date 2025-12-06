/**
 * Melos Studio – Dropzone Component
 * File import with TailwindCSS + shadcn/ui
 */

import { useCallback, useState, useRef, type DragEvent, type ChangeEvent } from 'react'
import { useScoreStore } from '@/store'
import { MusicXMLToMNX } from '@melos/converter'
import { Button } from '@/components/ui/button'
import { Upload, Music, FileMusic } from 'lucide-react'

interface DropzoneProps {
    onLoadDemo?: () => void
}

export function Dropzone({ onLoadDemo }: DropzoneProps) {
    const [isDragOver, setIsDragOver] = useState(false)
    const { setScore, setLoading, setError } = useScoreStore()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const processFile = useCallback(
        async (file: File) => {
            setLoading(true)
            setError(null)

            try {
                const content = await file.text()
                const converter = new MusicXMLToMNX()
                const score = converter.convert(content)
                setScore(score)
            } catch (err) {
                console.error('MusicXML conversion error:', err)
                setError(err instanceof Error ? err.message : 'Failed to process file')
            } finally {
                setLoading(false)
            }
        },
        [setScore, setLoading, setError]
    )

    const handleDragOver = useCallback((e: DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(true)
    }, [])

    const handleDragLeave = useCallback((e: DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(false)
    }, [])

    const handleDrop = useCallback(
        async (e: DragEvent) => {
            e.preventDefault()
            e.stopPropagation()
            setIsDragOver(false)

            const files = Array.from(e.dataTransfer.files)
            const musicXmlFile = files.find(
                (f) =>
                    f.name.endsWith('.musicxml') ||
                    f.name.endsWith('.mxl') ||
                    f.name.endsWith('.xml')
            )

            if (!musicXmlFile) {
                setError('Please drop a MusicXML file (.musicxml, .mxl, or .xml)')
                return
            }

            await processFile(musicXmlFile)
        },
        [processFile, setError]
    )

    const handleFileInput = useCallback(
        async (e: ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0]
            if (file) {
                await processFile(file)
            }
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        },
        [processFile]
    )

    const handleBrowseClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation()
        fileInputRef.current?.click()
    }, [])

    return (
        <div
            className={`
        flex-1 flex flex-col items-center justify-center gap-6 p-12
        bg-slate-900/60 border-2 border-dashed rounded-2xl
        transition-all duration-300 cursor-pointer group
        ${isDragOver
                    ? 'border-indigo-500 bg-indigo-500/5 shadow-lg shadow-indigo-500/10'
                    : 'border-slate-700 hover:border-indigo-500/50 hover:bg-slate-900/80'
                }
      `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => onLoadDemo?.()}
            role="button"
            tabIndex={0}
        >
            <input
                ref={fileInputRef}
                type="file"
                accept=".musicxml,.mxl,.xml"
                onChange={handleFileInput}
                className="hidden"
            />

            {/* Icon */}
            <div className={`
        w-20 h-20 rounded-2xl flex items-center justify-center
        bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700
        shadow-xl transition-transform duration-300
        ${isDragOver ? 'scale-110 border-indigo-500/50' : 'group-hover:-translate-y-1'}
      `}>
                <FileMusic className="w-10 h-10 text-indigo-400" />
            </div>

            {/* Text */}
            <div className="text-center">
                <h3 className="text-xl font-semibold text-white mb-2">
                    Drop MusicXML or Click to Load Demo
                </h3>
                <p className="text-slate-400 text-sm">
                    Import .musicxml, .mxl, or .xml files to convert them to MNX format
                </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4">
                <Button onClick={handleBrowseClick} className="gap-2">
                    <Upload className="w-4 h-4" />
                    Browse Files
                </Button>
                <span className="text-slate-600 text-sm uppercase tracking-wider">or</span>
                <Button
                    variant="outline"
                    onClick={(e) => {
                        e.stopPropagation()
                        onLoadDemo?.()
                    }}
                    className="gap-2"
                >
                    <Music className="w-4 h-4" />
                    Load Demo Score
                </Button>
            </div>

            {/* Format badges */}
            <div className="flex gap-2">
                {['.musicxml', '.mxl', '.xml'].map((format) => (
                    <span
                        key={format}
                        className="px-2 py-1 text-xs font-mono bg-slate-800 text-slate-400 rounded border border-slate-700"
                    >
                        {format}
                    </span>
                ))}
            </div>
        </div>
    )
}
