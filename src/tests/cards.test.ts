import { describe, expect, it } from 'vitest'
import { cardQr, cardUrl, normalizeCode } from '../lib/cards'

describe('credenciales (QR / NFC / lector)', () => {
    it('saca el mismo código venga como venga', () => {
        const token = 'A1B2C3D4E5F6'
        expect(normalizeCode(cardUrl(token))).toBe(token)                 // etiqueta NFC (dirección web)
        expect(normalizeCode(cardQr(token))).toBe(token)                  // QR impreso
        expect(normalizeCode('vk:a1b2c3d4e5f6')).toBe(token)
        expect(normalizeCode('  a1b2-c3d4-e5f6\n')).toBe(token)           // lector USB con separadores
        expect(normalizeCode('https://vunlek.com/c/a1b2c3d4e5f6')).toBe(token)
    })
    it('acepta el número de serie de la etiqueta', () => {
        expect(normalizeCode('04:a2:3b:91:7c')).toBe('04A23B917C')
    })
    it('la credencial no lleva datos del alumno', () => {
        expect(cardUrl('X')).toBe('https://www.vunlek.com/c/X')
        expect(cardQr('X')).toBe('VK:X')
    })
})
