/** Lectura de archivos de Excel (.xlsx) y Word (.docx) en el navegador, sin enviarlos a ningún servidor. */

export type Sheet = { name: string; rows: string[][] }
export type DocxBlock = { type: 'p'; text: string } | { type: 'table'; rows: string[][] }

function cellText(v: unknown): string {
    if (v == null) return ''
    if (v instanceof Date) return v.toISOString().slice(0, 10)
    if (typeof v === 'object') {
        const o = v as { text?: string; result?: unknown; richText?: { text: string }[]; error?: string; hyperlink?: string }
        if (o.richText) return o.richText.map(t => t.text).join('')
        if (o.text != null) return String(o.text)
        if (o.error) return String(o.error)
        if (o.result != null) return cellText(o.result)
        return ''
    }
    return String(v)
}

/** Todas las hojas de un .xlsx como filas de texto (las columnas conservan su posición). */
export async function readWorkbook(data: ArrayBuffer): Promise<Sheet[]> {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(data)
    return wb.worksheets.map(ws => {
        const rows: string[][] = []
        ws.eachRow({ includeEmpty: true }, (r, n) => {
            const values = (r.values as unknown[]).slice(1).map(v => cellText(v).replace(/\u00a0/g, ' ').trim())
            rows[n - 1] = values
        })
        for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = []
        return { name: ws.name, rows }
    })
}

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

function paragraphText(p: Element): string {
    let out = ''
    const walk = (n: Element) => {
        for (const c of Array.from(n.children)) {
            if (c.namespaceURI !== W) { walk(c); continue }
            if (c.localName === 't') out += c.textContent ?? ''
            else if (c.localName === 'tab') out += '\t'
            else if (c.localName === 'br' || c.localName === 'cr') out += '\n'
            else if (c.localName !== 'rPr' && c.localName !== 'pPr') walk(c)
        }
    }
    walk(p)
    return out
}

function tableRows(tbl: Element): string[][] {
    const rows: string[][] = []
    for (const tr of Array.from(tbl.children).filter(c => c.localName === 'tr')) {
        const row: string[] = []
        for (const tc of Array.from(tr.children).filter(c => c.localName === 'tc')) {
            const text = Array.from(tc.getElementsByTagNameNS(W, 'p')).map(paragraphText).map(s => s.trim()).filter(Boolean).join('\n')
            const span = Number(tc.getElementsByTagNameNS(W, 'gridSpan')[0]?.getAttributeNS(W, 'val') ?? tc.getElementsByTagNameNS(W, 'gridSpan')[0]?.getAttribute('w:val') ?? 1) || 1
            for (let i = 0; i < span; i++) row.push(text)
        }
        rows.push(row)
    }
    return rows
}

/** Párrafos y tablas de un .docx, en el orden en que aparecen. */
export async function readDocx(data: ArrayBuffer): Promise<DocxBlock[]> {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(data)
    const xml = await zip.file('word/document.xml')?.async('string')
    if (!xml) throw new Error('El archivo de Word no tiene contenido legible.')
    const doc = new DOMParser().parseFromString(xml, 'application/xml')
    const body = doc.getElementsByTagNameNS(W, 'body')[0]
    const blocks: DocxBlock[] = []
    const visit = (parent: Element) => {
        for (const el of Array.from(parent.children)) {
            if (el.localName === 'p') {
                const text = paragraphText(el).replace(/[  ]+/g, ' ').trim()
                if (text) blocks.push({ type: 'p', text })
            } else if (el.localName === 'tbl') {
                blocks.push({ type: 'table', rows: tableRows(el) })
            } else if (el.localName === 'sdt' || el.localName === 'sdtContent') {
                visit(el)
            }
        }
    }
    if (body) visit(body)
    return blocks
}
