import { describe, it, expect, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({ supabase: { storage: { from: vi.fn() } } }))

import { baseMime, kindForFile, describeFileProblem, formatSeconds, formatSize } from '../features/communications/lib/chatFiles'

describe('adjuntos del chat', () => {
    it('reconoce fotos, PDF y notas de voz', () => {
        expect(kindForFile('image/jpeg')).toBe('IMAGE')
        expect(kindForFile('application/pdf')).toBe('DOCUMENT')
        expect(kindForFile('audio/webm;codecs=opus')).toBe('AUDIO')
        expect(kindForFile('video/mp4')).toBeNull()
        expect(baseMime('audio/webm;codecs=opus')).toBe('audio/webm')
    })

    it('explica por qué no se puede enviar un archivo', () => {
        expect(describeFileProblem({ type: 'application/zip', size: 10 })).toMatch(/fotos, PDF/)
        expect(describeFileProblem({ type: 'application/pdf', size: 20 * 1024 * 1024 })).toMatch(/15 MB/)
        expect(describeFileProblem({ type: 'image/png', size: 2000 })).toBeNull()
    })

    it('muestra duración y tamaño legibles', () => {
        expect(formatSeconds(65)).toBe('1:05')
        expect(formatSize(1536 * 1024)).toBe('1.5 MB')
        expect(formatSize(300)).toBe('1 KB')
    })
})
