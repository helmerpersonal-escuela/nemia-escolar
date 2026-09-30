import { parseDocument, parseWorkbook } from './parsers'
import { readDocx, readWorkbook } from './readers'
import { emptyExtracted, type Extracted } from './types'

/** Lee todos los archivos (en el navegador) y junta lo que se reconoció en cada uno. */
export async function extractFiles(files: { name: string; data: ArrayBuffer }[]): Promise<Extracted> {
    const ex = emptyExtracted()
    for (const f of files) {
        const lower = f.name.toLowerCase()
        try {
            if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm')) parseWorkbook(await readWorkbook(f.data), f.name, ex)
            else if (lower.endsWith('.docx')) parseDocument(await readDocx(f.data), f.name, ex)
            else ex.files.push({ name: f.name, kind: 'other', found: [], ignored: [lower.endsWith('.xls') || lower.endsWith('.doc') ? 'Formato antiguo: ábrelo y guárdalo como .xlsx o .docx' : 'Tipo de archivo no compatible'] })
        } catch (e) {
            ex.files.push({ name: f.name, kind: 'other', found: [], ignored: [`No se pudo leer: ${(e as Error).message}`] })
        }
    }
    return ex
}
