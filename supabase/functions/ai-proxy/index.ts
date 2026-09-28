// ai-proxy: única puerta de la app hacia los proveedores de IA.
// Las llaves viven SOLO en el servidor (secretos de la función o
// system_settings, que ya solo lee el Super Admin / service role).
import { corsHeaders } from "../_shared/cors.ts"
import { errorResponse, getAdminClient, HttpError, isSuperAdmin, requireUser } from "../_shared/auth.ts"
import { GEMINI_MODELS, GROQ_DEFAULT_MODEL, OPENAI_DEFAULT_MODEL, geminiGenerate } from "../_shared/aiModels.ts"

const MAX_PROMPT_CHARS = 60_000
const MAX_EMBED_INPUTS = 20
const MAX_EMBED_CHARS = 30_000
// Un docente usa en promedio 5–12 solicitudes al día y hasta ~25 en días de planeación.
const DEFAULT_DAILY_LIMIT = 30
const DEFAULT_DAILY_CHARS = 250_000   // ~62 mil tokens de entrada al día

const SYSTEM_PROMPT = 'Eres un experto pedagogo de la Nueva Escuela Mexicana (NEM). Responde en español.'

type Settings = Record<string, string>

async function loadSettings(admin: ReturnType<typeof getAdminClient>): Promise<Settings> {
    const { data } = await admin
        .from('system_settings')
        .select('key, value')
        .in('key', ['gemini_key', 'groq_key', 'openai_key', 'preferred_provider',
                    'gemini_model', 'groq_model', 'openai_model', 'ai_daily_limit', 'ai_daily_char_limit'])
    const s: Settings = {}
    for (const row of data ?? []) s[row.key] = String(row.value ?? '').trim()
    // Los secretos de la función tienen prioridad sobre la base de datos
    s.gemini_key = Deno.env.get('GEMINI_API_KEY') || s.gemini_key || ''
    s.groq_key = Deno.env.get('GROQ_API_KEY') || s.groq_key || ''
    s.openai_key = Deno.env.get('OPENAI_API_KEY') || s.openai_key || ''
    return s
}

async function callGemini(s: Settings, prompt: string, json: boolean): Promise<string> {
    const models = [s.gemini_model, ...GEMINI_MODELS].filter(Boolean) as string[]
    return (await geminiGenerate(s.gemini_key, models, prompt, { json, system: SYSTEM_PROMPT })).text
}

async function callOpenAICompatible(url: string, key: string, model: string, prompt: string, label: string): Promise<string> {
    if (!key) throw new Error(`${label}: llave no configurada`)
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: prompt },
            ],
            temperature: 0.7,
        }),
    })
    if (!res.ok) throw new Error(`${label} ${model}: HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 120)}`)
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content?.trim()
    if (!text) throw new Error(`${label}: respuesta vacía`)
    return text
}

async function generate(s: Settings, prompt: string, json: boolean): Promise<{ text: string, provider: string }> {
    const providers: Record<string, () => Promise<string>> = {
        gemini: () => callGemini(s, prompt, json),
        groq: () => callOpenAICompatible('https://api.groq.com/openai/v1/chat/completions', s.groq_key,
            s.groq_model || GROQ_DEFAULT_MODEL, prompt, 'Groq'),
        openai: () => callOpenAICompatible('https://api.openai.com/v1/chat/completions', s.openai_key,
            s.openai_model || OPENAI_DEFAULT_MODEL, prompt, 'OpenAI'),
    }
    const preferred = (s.preferred_provider || 'gemini').toLowerCase()
    const order = [preferred, ...['gemini', 'groq', 'openai'].filter(p => p !== preferred)].filter(p => providers[p])

    const errors: string[] = []
    for (const name of order) {
        try {
            return { text: await providers[name](), provider: name }
        } catch (e) {
            errors.push(e instanceof Error ? e.message : String(e))
        }
    }
    throw new HttpError(502, `Ningún proveedor de IA respondió: ${errors.join(' | ')}`)
}

async function embed(s: Settings, input: string | string[]): Promise<number[][]> {
    if (!s.openai_key) throw new HttpError(503, 'Los embeddings requieren la llave de OpenAI configurada en God Mode')
    const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${s.openai_key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'text-embedding-3-small', input, dimensions: 1536 }),
    })
    if (!res.ok) throw new HttpError(502, `OpenAI embeddings: HTTP ${res.status}`)
    const data = await res.json()
    return data.data.map((d: { embedding: number[] }) => d.embedding)
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const admin = getAdminClient()
        const user = await requireUser(req, admin)
        const body = await req.json().catch(() => ({}))
        const action = body.action ?? 'generate'

        const settings = await loadSettings(admin)

        // --- Límite diario por usuario (controla costos) ---
        if (!(await isSuperAdmin(admin, user))) {
            const limit = parseInt(settings.ai_daily_limit || '') || DEFAULT_DAILY_LIMIT
            const charLimit = parseInt(settings.ai_daily_char_limit || '') || DEFAULT_DAILY_CHARS
            const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
            const { data: used } = await admin
                .from('ai_usage')
                .select('chars')
                .eq('user_id', user.id)
                .gte('created_at', since)
                .limit(1000)
            const count = used?.length ?? 0
            const chars = (used ?? []).reduce((n: number, r: { chars: number | null }) => n + (r.chars ?? 0), 0)
            if (count >= limit || chars >= charLimit) {
                throw new HttpError(429, `Llegaste al límite diario del asistente de IA (${limit} solicitudes). Se libera en unas horas; mientras tanto puedes seguir trabajando sin IA.`)
            }
        }

        let payload: Record<string, unknown>
        let provider = ''
        let chars = 0

        if (action === 'generate') {
            const prompt = String(body.prompt ?? '')
            if (!prompt.trim()) throw new HttpError(400, 'Falta el texto de la solicitud')
            if (prompt.length > MAX_PROMPT_CHARS) throw new HttpError(413, 'La solicitud es demasiado larga')
            chars = prompt.length
            const r = await generate(settings, prompt, !!body.json)
            provider = r.provider
            payload = { text: r.text, provider }
        } else if (action === 'embed') {
            const input = body.input
            const list = Array.isArray(input) ? input.map(String) : [String(input ?? '')]
            if (!list.length || list.some(t => !t.trim())) throw new HttpError(400, 'Falta el texto a vectorizar')
            if (list.length > MAX_EMBED_INPUTS) throw new HttpError(413, `Máximo ${MAX_EMBED_INPUTS} fragmentos por solicitud`)
            chars = list.reduce((n, t) => n + t.length, 0)
            if (chars > MAX_EMBED_CHARS * MAX_EMBED_INPUTS) throw new HttpError(413, 'Texto demasiado largo')
            provider = 'openai'
            payload = { embeddings: await embed(settings, Array.isArray(input) ? list : list[0]) }
        } else {
            throw new HttpError(400, 'Acción no válida')
        }

        // Registro de uso (no bloquea la respuesta si falla)
        const outChars = typeof (payload as { text?: string }).text === 'string' ? (payload as { text: string }).text.length : 0
        await admin.from('ai_usage').insert({ user_id: user.id, action, provider, chars, out_chars: outChars }).then(() => {}, () => {})

        return new Response(JSON.stringify(payload), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    } catch (error) {
        console.error('ai-proxy error:', error instanceof Error ? error.message : error)
        return errorResponse(error, corsHeaders)
    }
})
