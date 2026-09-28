// official-catalog-import: extrae con IA los Contenidos y PDAs oficiales de los Programas
// Sintéticos (texto ya guardado en synthetic_programs_pdfs) y los guarda en official_pdas.
// Se procesa un bloque de páginas por llamada para no exceder el tiempo de la función:
//   POST { phase: 6, chunk: 0 }  →  { total, chunk, inserted, rows }
// Autorización: super admin (modo dios) o encabezado x-cron-secret.
import { corsHeaders } from "../_shared/cors.ts"
import { errorResponse, getAdminClient, HttpError, isSuperAdmin, requireUser } from "../_shared/auth.ts"
import { GEMINI_QUALITY_MODELS, GROQ_DEFAULT_MODEL, geminiGenerate } from "../_shared/aiModels.ts"

const CHUNK_CHARS = 7000
const CAMPOS = ['Lenguajes', 'Saberes y Pensamiento Científico', 'Ética, Naturaleza y Sociedades', 'De lo Humano y lo Comunitario']
const LEVEL: Record<number, string> = { 1: 'INICIAL', 2: 'PREESCOLAR', 3: 'PRIMARIA', 4: 'PRIMARIA', 5: 'PRIMARIA', 6: 'SECUNDARIA' }
const GRADES: Record<number, number[]> = { 1: [], 2: [1, 2, 3], 3: [1, 2], 4: [3, 4], 5: [5, 6], 6: [1, 2, 3] }

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

/** Páginas de las tablas "Contenidos / Procesos de desarrollo de aprendizaje" agrupadas en bloques. */
function chunksFor(text: string): string[] {
    const pages = text.replace(/\\n/g, '\n').split('\n').map(p => p.trim()).filter(Boolean)
    const isTable = (p: string) => /Contenidos?\s+Procesos de desarrollo de aprendizaje/.test(p.slice(0, 700))
    const idx = pages.map((p, i) => isTable(p) ? i : -1).filter(i => i >= 0)
    if (!idx.length) return []
    // Rango continuo de tablas (incluye páginas de continuación sin encabezado), sin la parte del Programa Analítico
    const region: string[] = []
    for (let i = idx[0]; i <= Math.min(pages.length - 1, idx[idx.length - 1] + 1); i++) {
        const p = pages[i]
        if (/Finalidades del Campo|Especificidades del Campo/.test(p.slice(0, 400)) && !isTable(p)) continue
        region.push(p)
    }
    const out: string[] = []
    let cur = ''
    for (const p of region) {
        if (cur && cur.length + p.length > CHUNK_CHARS) { out.push(cur); cur = '' }
        cur += (cur ? '\n\n' : '') + p
    }
    if (cur) out.push(cur)
    return out
}

async function groq(key: string, prompt: string): Promise<string> {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({ model: GROQ_DEFAULT_MODEL, temperature: 0.1, response_format: { type: 'json_object' }, max_tokens: 16000, messages: [{ role: 'user', content: prompt }] }),
    })
    if (!res.ok) throw new Error(`Groq: HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 160)}`)
    const data = await res.json()
    return data.choices?.[0]?.message?.content ?? ''
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    try {
        const admin = getAdminClient()
        let ok = false
        const secret = req.headers.get('x-cron-secret')
        if (secret) ok = (await admin.rpc('verify_cron_secret', { p_secret: secret })).data === true
        if (!ok) ok = await isSuperAdmin(admin, await requireUser(req, admin))
        if (!ok) throw new HttpError(403, 'Solo modo dios')

        const body = await req.json().catch(() => ({}))
        const phase = Number(body.phase)
        const chunk = Math.max(0, Number(body.chunk ?? 0))
        if (!GRADES[phase]) throw new HttpError(400, 'Fase no válida (1 a 6)')

        const { data: doc } = await admin.from('synthetic_programs_pdfs').select('extracted_text').eq('phase', phase).order('updated_at', { ascending: false }).limit(1).maybeSingle()
        if (!doc?.extracted_text) throw new HttpError(404, 'No hay texto del programa sintético de esa fase')
        const chunks = chunksFor(doc.extracted_text)
        if (chunk >= chunks.length) return json({ total: chunks.length, chunk, inserted: 0, rows: 0, done: true })

        const { data: settings } = await admin.from('system_settings').select('key, value').in('key', ['gemini_key', 'groq_key', 'gemini_model'])
        const cfg = Object.fromEntries((settings ?? []).map((r: { key: string, value: unknown }) => [r.key, String(r.value ?? '').trim()]))
        const key = Deno.env.get('GEMINI_API_KEY') || cfg.gemini_key || ''
        const groqKey = Deno.env.get('GROQ_API_KEY') || cfg.groq_key || ''
        if (!key && !groqKey) throw new HttpError(500, 'IA no configurada')

        const grades = GRADES[phase]
        const prev = chunk > 0 ? chunks[chunk - 1].slice(-1500) : ''
        const prompt = `Eres un capturista experto en los Programas Sintéticos 2024 de la SEP (Nueva Escuela Mexicana).
Del siguiente texto extraído de un PDF (Fase ${phase}) extrae las filas de las tablas "Contenidos / Procesos de desarrollo de aprendizaje (PDA)".
Formato del PDF: cada fila tiene un Contenido y, a continuación, ${grades.length ? `un PDA por cada grado en este orden: ${grades.map(g => `${g}°`).join(', ')}` : 'sus PDA (sin grados)'}. Los encabezados de página indican el campo formativo y, en secundaria, la disciplina (Español, Matemáticas, Biología, Historia, etc.).
Reglas:
- Copia el texto OFICIAL tal cual; solo une palabras cortadas por guiones de fin de línea ("pro -  ceso" → "proceso") y quita espacios dobles. No resumas ni inventes.
- campo debe ser uno de: ${CAMPOS.join(' | ')}.
- Si una fila empieza en la página anterior (contexto) y aquí solo continúa, usa el nombre del Contenido del contexto.
- Si un PDA no corresponde claramente a un grado, usa grado null.
- Ignora texto que no sea de las tablas (introducciones, orientaciones, índices).
Devuelve SOLO JSON: {"rows":[{"campo":"...","disciplina":"... o null","contenido":"...","pdas":[{"grado":${grades[0] ?? 'null'},"texto":"..."}]}]}

CONTEXTO (final de la página anterior, NO extraer de aquí):
${prev}

TEXTO A EXTRAER:
${chunks[chunk]}`

        let raw = ''
        const errors: string[] = []
        const attempts: Array<() => Promise<string>> = []
        if (key) attempts.push(async () => (await geminiGenerate(key, GEMINI_QUALITY_MODELS, prompt, { json: true, temperature: 0.1, maxOutputTokens: 32000 })).text)
        if (groqKey) attempts.push(() => groq(groqKey, prompt))
        for (const a of attempts) {
            try { raw = await a(); if (raw) break } catch (e) { errors.push(e instanceof Error ? e.message : String(e)) }
        }
        if (!raw) throw new HttpError(502, errors.join(' | '))
        let parsed: { rows?: Array<{ campo?: string, disciplina?: string | null, contenido?: string, pdas?: Array<{ grado?: number | null, texto?: string }> }> } = {}
        try { parsed = JSON.parse(raw) } catch { parsed = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) }

        const clean = (s: string) => s.replace(/(\p{L})\s*-\s{1,3}(\p{Ll})/gu, '$1$2').replace(/\s+/g, ' ').trim()
        const records: Record<string, unknown>[] = []
        for (const r of parsed.rows ?? []) {
            const campo = CAMPOS.find(c => c.toLowerCase() === String(r.campo ?? '').toLowerCase().trim())
            const content = clean(String(r.contenido ?? ''))
            if (!campo || content.length < 3) continue
            for (const p of r.pdas ?? []) {
                const pda = clean(String(p.texto ?? ''))
                if (pda.length < 10) continue
                const grade = p.grado != null && grades.includes(Number(p.grado)) ? Number(p.grado) : null
                records.push({ phase, educational_level: LEVEL[phase], field_of_study: campo, subject_name: r.disciplina ? clean(String(r.disciplina)) : null, content, grade, pda })
            }
        }
        let inserted = 0
        for (const rec of records) {
            const { error } = await admin.from('official_pdas').insert(rec)
            if (!error) inserted++
        }
        return json({ total: chunks.length, chunk, rows: records.length, inserted, done: chunk + 1 >= chunks.length })
    } catch (error) {
        console.error('official-catalog-import:', error instanceof Error ? error.message : error)
        return errorResponse(error, corsHeaders)
    }
})
