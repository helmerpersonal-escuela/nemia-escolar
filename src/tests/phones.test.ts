import { describe, it, expect } from 'vitest'
import { normalizePhone, isValidPhone, formatPhone, phonesProblem } from '../lib/phones'

describe('teléfonos de emergencia', () => {
    it('limpia formatos comunes', () => {
        expect(normalizePhone('(961) 123-4567')).toBe('9611234567')
        expect(normalizePhone('+52 961 123 4567')).toBe('9611234567')
        expect(isValidPhone('961 123 456')).toBe(false)
        expect(formatPhone('9611234567')).toBe('961 123 4567')
    })
    it('el principal es obligatorio y los de respaldo opcionales pero completos', () => {
        expect(phonesProblem('')).toMatch(/principal/)
        expect(phonesProblem('9611234567', '', '')).toBeNull()
        expect(phonesProblem('9611234567', '12345')).toMatch(/respaldo/)
    })
})
