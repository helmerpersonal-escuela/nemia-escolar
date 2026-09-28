// Modelos de IA vigentes (septiembre 2026). Google limitó los modelos 2.5 a usuarios que ya los
// usaban: para llaves nuevas responden 404, así que se prueban en orden hasta que uno conteste.
// El más barato primero: Gemini 3.1 Flash-Lite ($0.25 entrada / $1.50 salida por millón de tokens).
export const GEMINI_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-flash']
// Para tareas de extracción larga conviene un Flash completo primero.
export const GEMINI_QUALITY_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash']
export const GROQ_DEFAULT_MODEL = 'openai/gpt-oss-120b'
export const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini'

/** Llama a Gemini probando modelos; un 404 (modelo no disponible) pasa al siguiente. */
export async function geminiGenerate(key: string, models: string[], prompt: string, opts: { json?: boolean, temperature?: number, system?: string, maxOutputTokens?: number } = {}): Promise<{ text: string, model: string }> {
    if (!key) throw new Error('Gemini: llave no configurada')
    const errors: string[] = []
    for (const model of [...new Set(models.filter(Boolean))]) {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
            body: JSON.stringify({
                ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: opts.temperature ?? 0.7,
                    ...(opts.maxOutputTokens ? { maxOutputTokens: opts.maxOutputTokens } : {}),
                    ...(opts.json ? { responseMimeType: 'application/json' } : {}),
                },
            }),
        })
        if (res.ok) {
            const data = await res.json()
            const text = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('')
            if (text) return { text: text.trim(), model }
            errors.push(`${model}: respuesta vacía`)
            continue
        }
        const detail = (await res.text().catch(() => '')).slice(0, 120).replace(/\s+/g, ' ')
        errors.push(`${model}: HTTP ${res.status} ${detail}`)
        // 404 = modelo no disponible; 429/5xx = saturado → probar el siguiente. 400/401/403 = llave o petición inválida.
        if (![404, 429, 500, 503].includes(res.status)) break
    }
    throw new Error(`Gemini: ${errors.join(' | ')}`)
}
