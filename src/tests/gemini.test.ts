import { describe, it, expect, vi, beforeEach } from 'vitest'

const aiGenerate = vi.fn()
vi.mock('../lib/aiClient', () => ({ aiGenerate: (...args: unknown[]) => aiGenerate(...args) }))

import { GeminiService } from '../lib/gemini'

describe('GeminiService', () => {
    beforeEach(() => aiGenerate.mockReset())

    it('ignora llaves pasadas al constructor y delega en el servidor', async () => {
        aiGenerate.mockResolvedValue('respuesta')
        const svc = new GeminiService('AIza-no-debe-usarse', 'gsk_no', 'sk-no')

        await expect(svc.generateContent('prompt', true)).resolves.toBe('respuesta')
        expect(aiGenerate).toHaveBeenCalledWith('prompt', true)
        expect(svc.isFallingBack).toBe(false)
    })

    it('limpia JSON envuelto en bloques de código o con texto extra', () => {
        const svc = new GeminiService() as unknown as { cleanJson: (t: string) => string }
        const raw = 'Claro, aquí está:\n```json\n{"items": [1, 2]}\n```\nSaludos'
        expect(JSON.parse(svc.cleanJson(raw))).toEqual({ items: [1, 2] })
    })

    it('ensureArray normaliza distintas formas de respuesta', () => {
        const svc = new GeminiService() as unknown as { ensureArray: (d: unknown, k?: string) => unknown[] }
        expect(svc.ensureArray([1, 2])).toEqual([1, 2])
        expect(svc.ensureArray({ criteria: [{ a: 1 }], otros: [] }, 'criteria')).toEqual([{ a: 1 }])
        expect(svc.ensureArray({ unico: 'x' })).toEqual([{ unico: 'x' }])
        expect(svc.ensureArray(null)).toEqual([])
    })
})
