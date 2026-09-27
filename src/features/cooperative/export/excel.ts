import type { FormatModel } from '../lib/format'

/** Genera un libro de Excel con una hoja por formato (mismo contenido que el PDF). */
export async function modelsToExcel(models: FormatModel[]): Promise<Blob> {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    wb.creator = 'VUNLEK'
    wb.created = new Date()
    const used = new Set<string>()

    for (const model of models) {
        let name = model.title.replace(/[\\/*?:[\]]/g, '').slice(0, 28) || 'Formato'
        let k = 2
        while (used.has(name)) name = `${name.slice(0, 26)} ${k++}`
        used.add(name)

        const cols = Math.max(4, ...model.tables.map(t => t.columns.length))
        const ws = wb.addWorksheet(name, {
            pageSetup: { paperSize: 1 as any, orientation: model.landscape ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
        })
        const border = { top: { style: 'thin' as const }, left: { style: 'thin' as const }, bottom: { style: 'thin' as const }, right: { style: 'thin' as const } }
        const mergeRow = (text: string, opts: { bold?: boolean; size?: number } = {}) => {
            const row = ws.addRow([text])
            ws.mergeCells(row.number, 1, row.number, cols)
            row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
            row.getCell(1).font = { bold: opts.bold ?? true, size: opts.size ?? 9 }
            return row
        }

        model.headerLines.forEach(l => mergeRow(l))
        ws.addRow([])
        mergeRow(model.title, { size: 12 })
        if (model.subtitle) mergeRow(model.subtitle, { bold: false, size: 10 })
        if (model.status) mergeRow(`Estado: ${model.status.replace('_', ' ')}`, { bold: false, size: 8 })
        ws.addRow([])

        // Datos generales en pares (etiqueta: valor) a dos columnas
        const half = Math.max(2, Math.floor(cols / 2))
        for (let i = 0; i < model.meta.length; i += 2) {
            const row = ws.addRow([])
            const put = (pair: [string, string] | undefined, start: number) => {
                if (!pair) return
                row.getCell(start).value = `${pair[0]}:`
                row.getCell(start).font = { bold: true, size: 9 }
                row.getCell(start + 1).value = pair[1]
                row.getCell(start + 1).font = { size: 9 }
                if (half > 2) ws.mergeCells(row.number, start + 1, row.number, start + half - 1)
            }
            put(model.meta[i], 1)
            put(model.meta[i + 1], half + 1)
        }

        for (const t of model.tables) {
            ws.addRow([])
            if (t.title) { const r = ws.addRow([t.title.toUpperCase()]); r.font = { bold: true, size: 10 } }
            const head = ws.addRow(t.columns.map(c => c.label.toUpperCase()))
            head.eachCell(c => {
                c.font = { bold: true, size: 8 }
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }
                c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
                c.border = border
            })
            const writeRow = (vals: (string | number)[], bold = false) => {
                const r = ws.addRow(vals.map(v => toCell(v)))
                r.eachCell({ includeEmpty: true }, (c, i) => {
                    if (i > t.columns.length) return
                    c.border = border
                    c.font = { size: 9, bold }
                    const al = t.columns[i - 1]?.align
                    c.alignment = { horizontal: al ?? 'left', vertical: 'top', wrapText: true }
                    if (typeof c.value === 'number' && isMoneyLabel(t.columns[i - 1]?.label)) c.numFmt = '"$"#,##0.00'
                })
            }
            t.rows.forEach(r => writeRow(r))
            if (t.footer) writeRow(t.footer, true)
        }

        if (model.summary?.length) {
            ws.addRow([])
            for (const [k, v] of model.summary) {
                const r = ws.addRow([])
                r.getCell(cols - 1).value = k
                r.getCell(cols - 1).font = { bold: true, size: 9 }
                r.getCell(cols).value = toCell(v)
                if (typeof r.getCell(cols).value === 'number') r.getCell(cols).numFmt = '"$"#,##0.00'
                r.getCell(cols).alignment = { horizontal: 'right' }
            }
        }
        model.notes?.forEach(n => { ws.addRow([]); mergeRow(n, { bold: false, size: 8 }) })

        ws.addRow([]); ws.addRow([]); ws.addRow([])
        const sigRow = ws.addRow([])
        const step = Math.max(1, Math.floor(cols / Math.max(1, model.signatures.length)))
        model.signatures.forEach((sg, i) => {
            const c = sigRow.getCell(1 + i * step)
            c.value = `______________________\n${sg}`
            c.alignment = { horizontal: 'center', vertical: 'top', wrapText: true }
            c.font = { size: 8 }
        })
        sigRow.height = 48

        // Anchos de columna según el diseño del formato
        const widths = model.tables[0]?.columns.map(c => c.width ?? 10) ?? []
        for (let i = 1; i <= cols; i++) ws.getColumn(i).width = Math.max(8, Math.round((widths[i - 1] ?? 12) * 1.25))
    }

    const buf = await wb.xlsx.writeBuffer()
    return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

const isMoneyLabel = (l?: string) => !!l && /importe|ingreso|egreso|utilidad|saldo|valor|precio|total|consumo/i.test(l)

/** "$1,234.50" → 1234.5 para que Excel pueda sumar; el resto queda como texto. */
function toCell(v: string | number): string | number {
    if (typeof v === 'number') return v
    const m = /^-?\$\s?[\d,]+(\.\d+)?$/.exec(v.trim().replace(/^\$-/, '-$'))
    if (m) return parseFloat(v.replace(/[$,\s]/g, ''))
    return v
}
