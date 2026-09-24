import { supabase } from './supabase'

/**
 * Cliente único de IA. Todas las llamadas pasan por la función Edge
 * `ai-proxy`, que guarda las llaves en el servidor, aplica el límite
 * diario por usuario y elige el proveedor (Gemini → Groq → OpenAI).
 * El navegador nunca ve una llave de IA.
 */

async function invokeAi<T>(body: Record<string, unknown>): Promise<T> {
    const { data, error } = await supabase.functions.invoke('ai-proxy', { body })
    if (error) {
        // Intentar leer el mensaje del servidor (p. ej. límite diario alcanzado)
        let message = error.message
        try {
            const ctx = (error as { context?: Response }).context
            if (ctx && typeof ctx.json === 'function') {
                const payload = await ctx.json()
                if (payload?.error) message = payload.error
            }
        } catch { /* sin cuerpo */ }
        throw new Error(message || 'No se pudo contactar al servicio de IA')
    }
    if (data?.error) throw new Error(data.error)
    return data as T
}

export async function aiGenerate(prompt: string, json = false): Promise<string> {
    const data = await invokeAi<{ text: string }>({ action: 'generate', prompt, json })
    return (data.text ?? '').trim()
}

export async function aiEmbed(input: string): Promise<number[]>
export async function aiEmbed(input: string[]): Promise<number[][]>
export async function aiEmbed(input: string | string[]): Promise<number[] | number[][]> {
    const data = await invokeAi<{ embeddings: number[][] }>({ action: 'embed', input })
    return Array.isArray(input) ? data.embeddings : data.embeddings[0]
}
