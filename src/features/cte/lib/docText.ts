/**
 * Extracción de texto de documentos en el navegador, sin dependencias extra:
 * - PDF  → pdf.js (PdfExtractionService)
 * - DOCX / PPTX → se leen como ZIP con DecompressionStream('deflate-raw')
 * - TXT / MD → texto plano
 */

const MAX_TEXT = 200_000

interface ZipEntry {
    name: string
    method: number
    compressedSize: number
    localHeaderOffset: number
}

function readEntries(buf: Uint8Array): ZipEntry[] {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    // Buscar el registro "End of central directory" (firma 0x06054b50) desde el final.
    let eocd = -1
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
        if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break }
    }
    if (eocd < 0) throw new Error('El archivo no es un documento de Office válido')
    const count = view.getUint16(eocd + 10, true)
    let ptr = view.getUint32(eocd + 16, true)
    const decoder = new TextDecoder()
    const entries: ZipEntry[] = []
    for (let i = 0; i < count; i++) {
        if (view.getUint32(ptr, true) !== 0x02014b50) break
        const method = view.getUint16(ptr + 10, true)
        const compressedSize = view.getUint32(ptr + 20, true)
        const nameLen = view.getUint16(ptr + 28, true)
        const extraLen = view.getUint16(ptr + 30, true)
        const commentLen = view.getUint16(ptr + 32, true)
        const localHeaderOffset = view.getUint32(ptr + 42, true)
        const name = decoder.decode(buf.subarray(ptr + 46, ptr + 46 + nameLen))
        entries.push({ name, method, compressedSize, localHeaderOffset })
        ptr += 46 + nameLen + extraLen + commentLen
    }
    return entries
}

async function readEntry(buf: Uint8Array, entry: ZipEntry): Promise<string> {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    const off = entry.localHeaderOffset
    const nameLen = view.getUint16(off + 26, true)
    const extraLen = view.getUint16(off + 28, true)
    const start = off + 30 + nameLen + extraLen
    const data = buf.subarray(start, start + entry.compressedSize)
    if (entry.method === 0) return new TextDecoder().decode(data)
    if (entry.method !== 8) throw new Error('Compresión no soportada')
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
    return await new Response(stream).text()
}

const decodeXml = (s: string) =>
    s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'").replace(/&amp;/g, '&')

/** Texto de un XML de Word: párrafos (<w:p>) como líneas y tabulaciones. */
export function wordXmlToText(xml: string): string {
    return decodeXml(
        xml
            .replace(/<w:tab\/>/g, '\t')
            .replace(/<w:br[^>]*\/>/g, '\n')
            .replace(/<\/w:p>/g, '\n')
            .replace(/<[^>]+>/g, ''),
    ).replace(/\n{3,}/g, '\n\n').trim()
}

/** Texto de una diapositiva de PowerPoint: cada párrafo (<a:p>) en una línea. */
export function slideXmlToText(xml: string): string {
    return decodeXml(
        xml
            .replace(/<\/a:p>/g, '\n')
            .replace(/<[^>]+>/g, ''),
    ).replace(/\n{2,}/g, '\n').trim()
}

export async function extractOfficeText(buffer: ArrayBuffer, kind: 'docx' | 'pptx'): Promise<string> {
    const buf = new Uint8Array(buffer)
    const entries = readEntries(buf)
    if (kind === 'docx') {
        const main = entries.find(e => e.name === 'word/document.xml')
        if (!main) throw new Error('No se encontró el contenido del documento')
        return wordXmlToText(await readEntry(buf, main))
    }
    const slides = entries
        .filter(e => /^ppt\/slides\/slide\d+\.xml$/.test(e.name))
        .sort((a, b) => Number(a.name.match(/(\d+)\.xml$/)![1]) - Number(b.name.match(/(\d+)\.xml$/)![1]))
    const parts: string[] = []
    for (const [i, s] of slides.entries()) {
        const text = slideXmlToText(await readEntry(buf, s))
        if (text) parts.push(`Diapositiva ${i + 1}:\n${text}`)
    }
    return parts.join('\n\n')
}

export function fileKind(file: File): 'pdf' | 'docx' | 'pptx' | 'text' | 'image' | 'other' {
    const name = file.name.toLowerCase()
    if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
    if (name.endsWith('.docx')) return 'docx'
    if (name.endsWith('.pptx')) return 'pptx'
    if (file.type.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md')) return 'text'
    if (file.type.startsWith('image/')) return 'image'
    return 'other'
}

/** Extrae el texto de un archivo subido. Devuelve '' si el formato no tiene texto legible. */
export async function extractFileText(file: File): Promise<string> {
    const kind = fileKind(file)
    let text = ''
    if (kind === 'pdf') {
        const { PdfExtractionService } = await import('../../../services/PdfExtractionService')
        text = await PdfExtractionService.extractTextFromFile(file)
    } else if (kind === 'docx' || kind === 'pptx') {
        text = await extractOfficeText(await file.arrayBuffer(), kind)
    } else if (kind === 'text') {
        text = await file.text()
    }
    return text.replace(/[ \t\u00a0]+/g, ' ').trim().slice(0, MAX_TEXT)
}
