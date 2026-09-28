/**
 * Lectura de archivos de texto y hojas de cálculo con acentos y ñ.
 *
 * Excel en Windows guarda los CSV en "ANSI" (Windows-1252), no en UTF-8. Si se leen como
 * UTF-8, la ñ y los acentos salen como "�". Aquí se detecta la codificación: se intenta
 * UTF-8 estricto y, si falla, se decodifica como Windows-1252.
 */

export function decodeText(buf: ArrayBuffer): string {
    const bytes = new Uint8Array(buf)
    // BOM UTF-16
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes)
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes)
    let text: string
    try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
        text = new TextDecoder('windows-1252').decode(bytes)
    }
    return text.replace(/^\uFEFF/, '')
}

export async function readTextFile(file: Blob): Promise<string> {
    return decodeText(await file.arrayBuffer())
}

/** CSV/TSV con comillas; detecta coma, punto y coma o tabulador. */
export function parseDelimited(text: string): string[][] {
    const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
    const counts = { ',': 0, ';': 0, '\t': 0 } as Record<string, number>
    for (const ch of firstLine) if (ch in counts) counts[ch]++
    const sep = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0 ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] : ','

    const rows: string[][] = []
    let row: string[] = []
    let cell = ''
    let quoted = false
    for (let i = 0; i < text.length; i++) {
        const c = text[i]
        if (quoted) {
            if (c === '"') {
                if (text[i + 1] === '"') { cell += '"'; i++ } else quoted = false
            } else cell += c
        } else if (c === '"') quoted = true
        else if (c === sep) { row.push(cell); cell = '' }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && text[i + 1] === '\n') i++
            row.push(cell); rows.push(row); row = []; cell = ''
        } else cell += c
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
    return rows.map(r => r.map(v => v.trim())).filter(r => r.some(v => v !== ''))
}

/** Lee .csv, .txt o .xlsx y devuelve filas de texto. */
export async function readSpreadsheet(file: File): Promise<string[][]> {
    const name = file.name.toLowerCase()
    if (name.endsWith('.xlsx') || name.endsWith('.xlsm')) {
        const ExcelJS = (await import('exceljs')).default
        const wb = new ExcelJS.Workbook()
        await wb.xlsx.load(await file.arrayBuffer())
        const ws = wb.worksheets[0]
        const rows: string[][] = []
        ws?.eachRow({ includeEmpty: false }, r => {
            const values = (r.values as unknown[]).slice(1).map(v => {
                if (v == null) return ''
                if (typeof v === 'object') {
                    const o = v as { text?: string; result?: unknown; richText?: { text: string }[] }
                    if (o.richText) return o.richText.map(t => t.text).join('')
                    if (o.text != null) return String(o.text)
                    if (o.result != null) return String(o.result)
                    if (v instanceof Date) return v.toISOString().slice(0, 10)
                }
                return String(v)
            })
            rows.push(values.map(s => s.trim()))
        })
        return rows.filter(r => r.some(v => v !== ''))
    }
    if (name.endsWith('.xls')) throw new Error('El formato .xls (Excel 97-2003) no es compatible. Guárdalo como .xlsx o .csv.')
    return parseDelimited(await readTextFile(file))
}

/** Descarga un CSV que Excel abre bien con acentos y ñ (UTF-8 con BOM y saltos CRLF). */
export function downloadCsv(fileName: string, rows: (string | number | null | undefined)[][]) {
    const esc = (v: unknown) => {
        const s = v == null ? '' : String(v)
        return /[",;\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const csv = '\uFEFF' + rows.map(r => r.map(esc).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
}
