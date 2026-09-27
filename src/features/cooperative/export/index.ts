import { saveFile } from '../../../lib/download'
import type { FormatModel } from '../lib/format'

/** Exporta uno o varios formatos a PDF o Excel (carga las librerías solo cuando se usan). */
export async function exportModels(models: FormatModel[], kind: 'pdf' | 'xlsx', fileName?: string) {
    if (!models.length) return
    const base = fileName ?? models[0].fileName
    if (kind === 'pdf') {
        const { modelsToPdf } = await import('./pdf')
        const blob = await modelsToPdf(models, base.replace(/_/g, ' '))
        await saveFile(blob, `${base}.pdf`)
    } else {
        const { modelsToExcel } = await import('./excel')
        const blob = await modelsToExcel(models)
        await saveFile(blob, `${base}.xlsx`)
    }
}
