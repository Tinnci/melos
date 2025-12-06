/**
 * Melos Studio – MusicXML Dropzone Component
 * Handles drag-and-drop for MusicXML file import
 */

import { useCallback, useState, type DragEvent } from 'react'
import { useScoreStore } from '../store'
import { MusicXMLToMNX } from '@melos/converter'

interface DropzoneProps {
    onLoadDemo?: () => void
}

export function Dropzone({ onLoadDemo }: DropzoneProps) {
    const [isDragOver, setIsDragOver] = useState(false)
    const { setScore, setLoading, setError } = useScoreStore()

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

            setLoading(true)
            setError(null)

            try {
                const content = await musicXmlFile.text()
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

    const handleClick = useCallback(() => {
        onLoadDemo?.()
    }, [onLoadDemo])

    return (
        <div
            className={`dropzone ${isDragOver ? 'dropzone--active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClick}
            role="button"
            tabIndex={0}
            aria-label="Drop MusicXML file here or click to load demo"
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
    )
}
