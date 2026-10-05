import { describe, it, expect, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({ supabase: { rpc: vi.fn() } }))

import { normalizeFamilyCode, isCompleteFamilyCode, familyAccessUrl } from '../features/family/lib/familyCode'

describe('códigos para familias', () => {
    it('acepta el código escrito de cualquier forma', () => {
        expect(normalizeFamilyCode('abcd2345')).toBe('ABCD-2345')
        expect(normalizeFamilyCode(' ab cd-23 45 ')).toBe('ABCD-2345')
        expect(normalizeFamilyCode('abc')).toBe('ABC')
        expect(normalizeFamilyCode('ABCD-23456789')).toBe('ABCD-2345')
    })

    it('sabe cuándo el código está completo', () => {
        expect(isCompleteFamilyCode('abcd2345')).toBe(true)
        expect(isCompleteFamilyCode('ABCD-234')).toBe(false)
        expect(isCompleteFamilyCode('')).toBe(false)
    })

    it('arma el enlace con el código ya escrito', () => {
        expect(familyAccessUrl('ABCD-2345')).toMatch(/\/familia\?codigo=ABCD-2345$/)
        expect(familyAccessUrl()).toMatch(/\/familia$/)
    })
})

import { isValidCurp, normalizeCurp } from '../features/family/lib/familyCode'
describe('CURP del alumno (segundo dato para ligar a la familia)', () => {
    it('limpia y valida', () => {
        expect(normalizeCurp(' pexa-120305 hcsrrn07 ')).toBe('PEXA120305HCSRRN07')
        expect(isValidCurp('PEXA120305HCSRRN07')).toBe(true)
        expect(isValidCurp('PEXA120305HCSRRN0')).toBe(false)   // 17 caracteres
        expect(isValidCurp('1234120305HCSRRN07')).toBe(false)
        expect(isValidCurp('')).toBe(false)
    })
})
