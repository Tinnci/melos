/**
 * Melos Studio – Dropzone Component
 * File import with TailwindCSS + shadcn/ui
 */

import {
  useCallback,
  useState,
  useRef,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import { useScoreStore } from '@/store'
import { MusicXMLToMNX } from '@melos/converter'
import { MEIToMNX } from '@melos/mei'
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
        const score = isMeiFile(file, content)
          ? new MEIToMNX().convert(content)
          : new MusicXMLToMNX().convert(content)
        setScore(score)
      } catch (err) {
        console.error('Score import error:', err)
        setError(err instanceof Error ? err.message : 'Failed to process file')
      } finally {
        setLoading(false)
      }
    },
    [setScore, setLoading, setError],
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
      const notationFile = files.find(
        (f) =>
          f.name.endsWith('.mei') ||
          f.name.endsWith('.musicxml') ||
          f.name.endsWith('.mxl') ||
          f.name.endsWith('.xml'),
      )

      if (!notationFile) {
        setError('Please drop a MusicXML or MEI file (.musicxml, .mei, .mxl, or .xml)')
        return
      }

      await processFile(notationFile)
    },
    [processFile, setError],
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
    [processFile],
  )

  const handleBrowseClick = useCallback((e: MouseEvent) => {
    e.stopPropagation()
    fileInputRef.current?.click()
  }, [])

  const handleDropzoneKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      onLoadDemo?.()
    },
    [onLoadDemo],
  )

  return (
    // biome-ignore lint/a11y/useSemanticElements: The drop target contains nested action buttons.
    <div
      className={`
        schematic-surface flex-1 flex flex-col items-center justify-center gap-4 p-8
        border-2 border-dashed transition-colors duration-150 cursor-pointer group
        ${
          isDragOver
            ? 'border-[#ff5a1f] bg-[#f4e3db]'
            : 'border-[#8f9289] hover:border-[#ff5a1f] hover:bg-[#e8e8e2]'
        }
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => onLoadDemo?.()}
      onKeyDown={handleDropzoneKeyDown}
      role="button"
      tabIndex={0}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".musicxml,.mei,.mxl,.xml"
        onChange={handleFileInput}
        className="hidden"
      />

      {/* Icon */}
      <div
        className={`
        w-14 h-14 flex items-center justify-center
        bg-[#d4d6d0] border border-[#8f9289]
        transition-transform duration-150
        ${isDragOver ? 'scale-105 border-[#ff5a1f]' : 'group-hover:-translate-y-0.5'}
      `}
      >
        <FileMusic className="w-7 h-7 text-[#c94412]" />
      </div>

      {/* Text */}
      <div className="text-center">
        <h3 className="mb-1 text-[16px] font-black text-[#121212]">
          Drop MusicXML/MEI or Click to Load Demo
        </h3>
        <p className="text-[12px] text-[#5e625a]">
          Import .musicxml, .mei, .mxl, or .xml files to convert them to MNX format
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={handleBrowseClick} className="gap-2">
          <Upload className="w-4 h-4" />
          Browse Files
        </Button>
        <span className="text-[10px] font-bold uppercase text-[#777b73]">or</span>
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
      <div className="flex gap-1.5">
        {['.musicxml', '.mei', '.mxl', '.xml'].map((format) => (
          <span
            key={format}
            className="border border-[#9a9c94] bg-[#d7d9d3] px-1.5 py-0.5 font-mono text-[10px] text-[#3a3d37]"
          >
            {format}
          </span>
        ))}
      </div>
    </div>
  )
}

function isMeiFile(file: File, content: string): boolean {
  return file.name.toLowerCase().endsWith('.mei') || /<\s*(?:mei:)?mei[\s>]/i.test(content)
}
