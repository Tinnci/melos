import type { Score } from '@melos/core'
import { Renderer } from '@melos/renderer'
import { createMidiFile } from './midi'

/**
 * Export the given score to a PDF file.
 */
export async function exportToPdf(score: Score, filename: string = 'score') {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')])

  // 1. Render SVG
  const renderer = new Renderer()
  const svgString = renderer.render(score)

  // 2. Create localized DOM container
  const container = document.createElement('div')
  container.innerHTML = svgString
  const svgElement = container.firstElementChild as SVGSVGElement

  if (!svgElement) {
    throw new Error('Failed to generate SVG for PDF export.')
  }

  // 3. Initialize PDF (A4 Portrait)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 40

  // 4. Convert SVG to PDF - scale to fit width within margins
  const svgWidth = parseFloat(svgElement.getAttribute('width') || '100')
  const svgHeight = parseFloat(svgElement.getAttribute('height') || '100')

  const targetWidth = pageWidth - margin * 2
  const scale = targetWidth / svgWidth
  const targetHeight = svgHeight * scale

  await svg2pdf(svgElement, doc, {
    x: margin,
    y: margin,
    width: targetWidth,
    height: targetHeight,
  })

  // 5. Download
  doc.save(`${filename}.pdf`)
}

/**
 * Export the given score to a MIDI file.
 */
export function exportToMidi(score: Score, filename: string = 'score') {
  const midiBytes = createMidiFile(score)
  const midiBuffer = new ArrayBuffer(midiBytes.byteLength)
  new Uint8Array(midiBuffer).set(midiBytes)
  const blob = new Blob([midiBuffer], { type: 'audio/midi' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.mid`
  a.click()

  URL.revokeObjectURL(url)
}
