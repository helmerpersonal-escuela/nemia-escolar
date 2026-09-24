// Extracción de texto por página leyendo el PDF remoto por rangos (HTTP Range),
// sin descargar el archivo completo. Usa la build "serverless" de pdf.js (unpdf).
import { getResolvedPDFJS } from 'npm:unpdf@1.8.1'

const CHUNK = 512 * 1024

export interface RemotePdf {
    numPages: number
    pageText(n: number): Promise<string>
    destroy(): Promise<void>
    bytesRead(): number
}

async function fetchRange(url: string, start: number, endInclusive: number, headers: HeadersInit): Promise<Uint8Array> {
    for (let attempt = 1; ; attempt++) {
        try {
            const res = await fetch(url, { headers: { ...headers, Range: `bytes=${start}-${endInclusive}` } })
            if (res.status !== 206 && res.status !== 200) throw new Error(`HTTP ${res.status} al leer rango`)
            const buf = new Uint8Array(await res.arrayBuffer())
            if (res.status === 200) return buf.subarray(start, endInclusive + 1)
            return buf
        } catch (e) {
            if (attempt >= 3) throw e
            await new Promise((r) => setTimeout(r, 500 * attempt))
        }
    }
}

const PAGE_TIMEOUT_MS = 45_000

function withTimeout<T>(p: Promise<T>, what: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined
    return Promise.race([
        p.finally(() => clearTimeout(timer)),
        new Promise<T>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`Tiempo agotado leyendo ${what}`)), PAGE_TIMEOUT_MS)
        }),
    ])
}

export async function openRemotePdf(url: string, length: number, headers: HeadersInit = {}): Promise<RemotePdf> {
    const pdfjs = await getResolvedPDFJS()
    let read = 0

    // Primer bloque del archivo; pdf.js pide el resto (xref, páginas) según lo necesita.
    const initial = await fetchRange(url, 0, Math.min(CHUNK, length) - 1, headers)
    read += initial.byteLength

    class RangeTransport extends pdfjs.PDFDataRangeTransport {
        override requestDataRange(begin: number, end: number) {
            fetchRange(url, begin, end - 1, headers)
                .then((chunk) => {
                    read += chunk.byteLength
                    this.onDataRange(begin, chunk)
                })
                .catch((err) => console.error('range error', begin, end, err?.message))
        }
    }

    const transport = new RangeTransport(length, initial)
    const task = pdfjs.getDocument({
        range: transport,
        length,
        rangeChunkSize: CHUNK,
        disableAutoFetch: true,
        disableStream: true,
        isEvalSupported: false,
        useSystemFonts: false,
        disableFontFace: true,
        verbosity: 0,
    } as any)
    const doc = await withTimeout(task.promise, 'estructura del PDF')

    return {
        numPages: doc.numPages,
        bytesRead: () => read,
        async pageText(n: number) {
            const page = await withTimeout(doc.getPage(n), `página ${n}`)
            const content = await withTimeout(page.getTextContent(), `texto de página ${n}`)
            let out = ''
            for (const item of content.items as any[]) {
                if (typeof item.str !== 'string') continue
                out += item.str
                out += item.hasEOL ? '\n' : ' '
            }
            page.cleanup()
            return out
                .replace(/[ \t\u00a0]+/g, ' ')
                .replace(/ *\n */g, '\n')
                .replace(/\n{3,}/g, '\n\n')
                .trim()
        },
        async destroy() {
            await task.destroy()
        },
    }
}
