import { describe, it, expect, vi, beforeEach } from 'vitest'

const invoke = vi.fn()
vi.mock('../lib/supabase', () => ({
    supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}))

import { aiGenerate, aiEmbed } from '../lib/aiClient'

describe('aiClient (todas las llamadas de IA pasan por ai-proxy)', () => {
    beforeEach(() => invoke.mockReset())

    it('aiGenerate envía el prompt a ai-proxy y devuelve el texto', async () => {
        invoke.mockResolvedValue({ data: { text: '  hola docente  ', provider: 'gemini' }, error: null })

        const text = await aiGenerate('Genera una rúbrica', true)

        expect(invoke).toHaveBeenCalledWith('ai-proxy', {
            body: { action: 'generate', prompt: 'Genera una rúbrica', json: true },
        })
        expect(text).toBe('hola docente')
    })

    it('muestra el mensaje del servidor cuando la función responde con error (p. ej. límite diario)', async () => {
        const context = new Response(JSON.stringify({ error: 'Llegaste al límite de 200 solicitudes' }), { status: 429 })
        invoke.mockResolvedValue({ data: null, error: { message: 'Edge Function returned a non-2xx status code', context } })

        await expect(aiGenerate('hola')).rejects.toThrow('Llegaste al límite de 200 solicitudes')
    })

    it('propaga el error incluido en data.error', async () => {
        invoke.mockResolvedValue({ data: { error: 'Ningún proveedor de IA respondió' }, error: null })
        await expect(aiGenerate('hola')).rejects.toThrow('Ningún proveedor de IA respondió')
    })

    it('aiEmbed devuelve un vector para un texto y una lista para varios', async () => {
        invoke.mockResolvedValue({ data: { embeddings: [[0.1, 0.2], [0.3, 0.4]] }, error: null })
        const many = await aiEmbed(['a', 'b'])
        expect(many).toEqual([[0.1, 0.2], [0.3, 0.4]])

        invoke.mockResolvedValue({ data: { embeddings: [[0.5, 0.6]] }, error: null })
        const one = await aiEmbed('a')
        expect(one).toEqual([0.5, 0.6])
        expect(invoke).toHaveBeenLastCalledWith('ai-proxy', { body: { action: 'embed', input: 'a' } })
    })

    it('el código de la app no contiene llaves ni URLs directas de proveedores de IA', async () => {
        const modules = import.meta.glob('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
        expect(Object.keys(modules).length).toBeGreaterThan(50)
        const offenders = Object.entries(modules)
            .filter(([path]) => !path.includes('/tests/'))
            .filter(([, src]) => /generativelanguage\.googleapis|api\.groq\.com|api\.openai\.com|VITE_(GEMINI|GROQ|OPENAI)_API_KEY/.test(src))
            .map(([path]) => path)
        expect(offenders).toEqual([])
    })
})
