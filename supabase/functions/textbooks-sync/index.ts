// Sincroniza el catálogo oficial de libros de texto gratuitos (CONALITEG) y
// extrae su texto por página para consulta y uso de la IA.
//
// Acciones (POST JSON { action }):
//   catalog       → lee primaria/secundaria/telesecundaria, actualiza metadatos y
//                   detecta cambios por ETag (si cambió, se re-extrae el texto).
//   extract       → toma un libro pendiente y extrae un lote de páginas (solo PDF
//                   sin cifrar; los protegidos quedan como "no_text").
//   purge-legacy  → borra del bucket "textbooks" los PDF antiguos no referenciados.
//   status        → resumen del avance.
//
// Autorización: encabezado x-cron-secret (pg_cron) o JWT de super admin.
import { getAdminClient, requireUser, isSuperAdmin, HttpError, errorResponse } from '../_shared/auth.ts'
import { openRemotePdf } from './pdfText.ts'

const BASE = 'https://libros.conaliteg.gob.mx'
const LEVELS = ['primaria', 'secundaria', 'telesecundaria'] as const
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; VUNLEK-Escolar/1.0; +https://vunlek.com)' }

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FIELDS: Record<string, string> = {
    ETA: 'Ética, naturaleza y sociedades',
    HUA: 'De lo humano y lo comunitario',
    LEA: 'Lenguajes',
    SAA: 'Saberes y pensamiento científico',
    MLA: 'Múltiples lenguajes',
    NLA: 'Proyectos',
    LP1: 'Proyectos', LP2: 'Proyectos', LP3: 'Proyectos',
    PAA: 'Proyectos', PCA: 'Proyectos', PEA: 'Proyectos',
    INA: 'Inglés',
    LPM: 'Libro para el maestro',
    SDA: 'Nuestros saberes',
    HPA: 'Historia',
    TNA: 'Trazos', TPA: 'Trazos',
    CMA: 'Cartografía',
    SHA: 'México, grandeza y diversidad',
}

interface CatalogBook {
    clave: string
    ciclo: number
    nivel: typeof LEVELS[number]
    title: string
    grades: Set<number>
}

const decode = (s: string) =>
    s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim()

async function readCatalog(nivel: typeof LEVELS[number]): Promise<CatalogBook[]> {
    const res = await fetch(`${BASE}/${nivel}.html`, { headers: UA })
    if (!res.ok) throw new Error(`Catálogo ${nivel}: HTTP ${res.status}`)
    const html = await res.text()
    const books = new Map<string, CatalogBook>()
    const re = /reader\.html\?nivel=(\w+)&(?:amp;)?ciclo=(\d{4})&(?:amp;)?clave=([A-Z0-9]+)"[\s\S]*?<b>([\s\S]*?)<\/b>[\s\S]*?Grado:\s*(\d)/g
    for (const m of html.matchAll(re)) {
        const [, , ciclo, clave, rawTitle, grado] = m
        const key = `${clave}:${ciclo}`
        const book = books.get(key) ?? { clave, ciclo: Number(ciclo), nivel, title: decode(rawTitle), grades: new Set<number>() }
        book.grades.add(Number(grado))
        books.set(key, book)
    }
    return [...books.values()]
}

async function probePdf(url: string) {
    const res = await fetch(url, { headers: { ...UA, Range: 'bytes=0-0' } })
    await res.body?.cancel()
    if (res.status !== 206 && res.status !== 200) throw new Error(`HTTP ${res.status}`)
    const total = Number(res.headers.get('content-range')?.split('/')[1] ?? res.headers.get('content-length') ?? 0)
    return {
        size: total || null,
        etag: res.headers.get('etag'),
        lastModified: res.headers.get('last-modified'),
    }
}

async function syncCatalog(admin: ReturnType<typeof getAdminClient>) {
    const catalog: CatalogBook[] = []
    for (const nivel of LEVELS) catalog.push(...(await readCatalog(nivel)))
    if (catalog.length < 30) throw new Error(`Catálogo incompleto (${catalog.length} libros); no se aplican cambios`)

    const { data: existing, error } = await admin.from('textbooks').select('id, clave, ciclo, etag, size_bytes, last_modified, text_status').not('clave', 'is', null)
    if (error) throw error
    const byKey = new Map((existing ?? []).map((r) => [`${r.clave}:${r.ciclo}`, r]))

    let created = 0, changed = 0, failed = 0
    const now = new Date().toISOString()
    const seen = new Set<string>()

    for (let i = 0; i < catalog.length; i += 8) {
        await Promise.all(catalog.slice(i, i + 8).map(async (b) => {
            const pdfUrl = `${BASE}/pdf-reader/assets/${b.nivel}/${b.ciclo}/${b.clave}.pdf`
            const key = `${b.clave}:${b.ciclo}`
            seen.add(key)
            let probe
            try {
                probe = await probePdf(pdfUrl)
            } catch (e) {
                failed++
                console.error('probe', b.clave, (e as Error).message)
                return
            }
            const digit = Number(b.clave.match(/^[A-Z](\d)/)?.[1] ?? NaN)
            const allGrades = b.nivel === 'primaria' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3]
            const grades = digit === 0 || /multigrado/i.test(b.title) ? allGrades : [...b.grades].sort()
            const code = b.clave.slice(-3)
            const row = {
                clave: b.clave,
                ciclo: b.ciclo,
                title: b.title,
                level: b.nivel.toUpperCase(),
                grade: grades[0],
                grades,
                field_code: code,
                field_of_study: FIELDS[code] ?? null,
                source: 'CONALITEG',
                reader_url: `${BASE}/pdf-reader/reader.html?nivel=${b.nivel}&ciclo=${b.ciclo}&clave=${b.clave}`,
                file_url: pdfUrl,
                thumbnail_url: `${BASE}/${b.ciclo}/m/${b.clave}/000.jpg`,
                size_bytes: probe.size,
                last_modified: probe.lastModified,
                is_current: true,
                synced_at: now,
                updated_at: now,
            }
            const prev = byKey.get(key)
            if (!prev) {
                const { error } = await admin.from('textbooks').insert({ ...row, etag: probe.etag, text_status: 'pending' })
                if (error) { failed++; console.error('insert', b.clave, error.message) } else created++
                return
            }
            // Cambio real del archivo: distinto tamaño o fecha de modificación.
            const contentChanged =
                (probe.size != null && prev.size_bytes != null && Number(prev.size_bytes) !== probe.size) ||
                (!!probe.lastModified && !!prev.last_modified && prev.last_modified !== probe.lastModified)
            const patch: Record<string, unknown> = { ...row, etag: probe.etag }
            if (!contentChanged && prev.text_status === 'error') {
                Object.assign(patch, { text_status: 'pending', text_error: null, text_lease_until: null })
            }
            if (contentChanged) {
                changed++
                await admin.from('textbook_pages').delete().eq('textbook_id', prev.id)
                Object.assign(patch, { text_status: 'pending', text_pages_done: 0, text_error: null, page_count: null, text_lease_until: null })
            }
            const { error } = await admin.from('textbooks').update(patch).eq('id', prev.id)
            if (error) { failed++; console.error('update', b.clave, error.message) }
        }))
    }

    // Libros que ya no aparecen en el catálogo (p. ej. ciclo anterior) dejan de ser vigentes.
    const stale = (existing ?? []).filter((r) => !seen.has(`${r.clave}:${r.ciclo}`)).map((r) => r.id)
    if (stale.length) await admin.from('textbooks').update({ is_current: false }).in('id', stale)

    return { catalog: catalog.length, created, changed, failed, retired: stale.length }
}

async function extractBatch(admin: ReturnType<typeof getAdminClient>, maxPages: number, budgetMs: number) {
    const started = Date.now()
    const { data: claimed, error } = await admin.rpc('claim_textbook_for_extraction', { p_lease_seconds: 180 })
    if (error) throw error
    const book = (claimed as any[])?.[0]
    if (!book) return { idle: true }

    try {
        let size = book.size_bytes as number | null
        if (!size) size = (await probePdf(book.file_url)).size
        if (!size) throw new Error('Tamaño del PDF desconocido')

        const pdf = await openRemotePdf(book.file_url, size, UA)
        const total = pdf.numPages
        let page = (book.text_pages_done ?? 0) + 1
        const rows: { textbook_id: string; page: number; content: string }[] = []
        let chars = 0

        while (page <= total && rows.length < maxPages && Date.now() - started < budgetMs) {
            const content = await pdf.pageText(page)
            chars += content.length
            rows.push({ textbook_id: book.id, page, content })
            page++
        }
        const bytes = pdf.bytesRead()
        await pdf.destroy()

        if (rows.length) {
            const { error: upErr } = await admin.from('textbook_pages').upsert(rows, { onConflict: 'textbook_id,page' })
            if (upErr) throw upErr
        }
        const done = page > total
        const pagesDone = page - 1

        // Si las primeras páginas no tienen texto, el PDF es escaneado: no se insiste.
        let status = done ? 'done' : 'processing'
        if ((book.text_pages_done ?? 0) === 0 && pagesDone >= Math.min(12, total) && chars < 200) status = 'no_text'

        await admin.from('textbooks').update({
            page_count: total,
            text_pages_done: pagesDone,
            text_status: status,
            text_error: null,
            text_updated_at: new Date().toISOString(),
            // Libera la reserva para que el siguiente tick continúe de inmediato.
            text_lease_until: null,
        }).eq('id', book.id)

        return { clave: book.clave, from: book.text_pages_done + 1, to: pagesDone, total, status, ms: Date.now() - started, kb: Math.round(bytes / 1024) }
    } catch (e) {
        const message = (e as Error).message ?? String(e)
        // PDF cifrado por el editor: no se intenta descifrar; queda solo el catálogo
        // (el docente lo abre en el lector oficial). Se reintenta si el archivo cambia.
        const isProtected = (e as Error)?.name === 'PasswordException' || /password/i.test(message)
        await admin.from('textbooks').update({
            text_status: isProtected ? 'no_text' : 'error',
            text_error: isProtected ? 'PDF protegido por el editor: solo consulta en el lector oficial' : message.slice(0, 500),
            text_lease_until: null,
        }).eq('id', book.id)
        return { clave: book.clave, error: message, protected: isProtected }
    }
}

async function purgeLegacy(admin: ReturnType<typeof getAdminClient>) {
    const bucket = admin.storage.from('textbooks')
    const [{ data: personal }, { data: official }] = await Promise.all([
        admin.from('user_textbooks').select('file_url'),
        admin.from('textbooks').select('file_url'),
    ])
    const referenced = [...(personal ?? []), ...(official ?? [])].map((r) => r.file_url ?? '').join('\n')

    const candidates: string[] = []
    const folders = ['teacher-uploads']
    for (const lvl of ['PRIMARIA', 'SECUNDARIA', 'TELESECUNDARIA']) {
        for (let g = 1; g <= 6; g++) folders.push(`${lvl}/${g}`)
    }
    for (const folder of folders) {
        const { data } = await bucket.list(folder, { limit: 1000 })
        for (const obj of data ?? []) {
            if (!obj.id) continue // subcarpeta
            const path = `${folder}/${obj.name}`
            if (!referenced.includes(path)) candidates.push(path)
        }
    }
    let removed = 0
    for (let i = 0; i < candidates.length; i += 20) {
        const { data, error } = await bucket.remove(candidates.slice(i, i + 20))
        if (error) throw error
        removed += data?.length ?? 0
    }
    return { candidates: candidates.length, removed }
}

async function status(admin: ReturnType<typeof getAdminClient>) {
    const { data } = await admin.from('textbooks').select('level, text_status, page_count, text_pages_done').eq('is_current', true)
    const summary: Record<string, number> = {}
    let pages = 0, done = 0
    for (const r of data ?? []) {
        summary[r.text_status] = (summary[r.text_status] ?? 0) + 1
        pages += r.page_count ?? 0
        done += r.text_pages_done ?? 0
    }
    return { books: data?.length ?? 0, byStatus: summary, pagesKnown: pages, pagesDone: done }
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    try {
        if (req.method !== 'POST') throw new HttpError(405, 'Método no permitido')
        const admin = getAdminClient()

        const secret = req.headers.get('x-cron-secret')
        let authorized = false
        if (secret) {
            const { data } = await admin.rpc('verify_cron_secret', { p_secret: secret })
            authorized = data === true
        }
        if (!authorized) {
            const user = await requireUser(req, admin)
            authorized = await isSuperAdmin(admin, user)
        }
        if (!authorized) throw new HttpError(403, 'No autorizado')

        const body = await req.json().catch(() => ({}))
        const action = String(body.action ?? 'status')
        let result: unknown
        switch (action) {
            case 'catalog':
                result = await syncCatalog(admin)
                break
            case 'extract': {
                const maxPages = Math.min(Math.max(Number(body.pages) || 40, 1), 400)
                const budgetMs = Math.min(Math.max(Number(body.budgetMs) || 40000, 1000), 120000)
                result = await extractBatch(admin, maxPages, budgetMs)
                break
            }
            case 'purge-legacy':
                result = await purgeLegacy(admin)
                break
            case 'status':
                result = await status(admin)
                break
            default:
                throw new HttpError(400, 'Acción desconocida')
        }
        console.log(action, JSON.stringify(result))
        return new Response(JSON.stringify({ ok: true, action, result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    } catch (error) {
        console.error('textbooks-sync', (error as Error)?.message)
        return errorResponse(error, corsHeaders)
    }
})
