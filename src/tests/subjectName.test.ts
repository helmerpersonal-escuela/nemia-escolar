import { describe, it, expect } from 'vitest'
import { formatSubjectName, niceSubjectCase } from '../lib/subjectName'

describe('nombre de materia con especialidad', () => {
    it('une Tecnología con su especialidad', () => {
        expect(formatSubjectName('TECNOLOGÍA', 'INFORMÁTICA')).toBe('Tecnología - Informática')
        expect(formatSubjectName('Tecnología', 'diseño gráfico')).toBe('Tecnología - Diseño gráfico')
    })
    it('sin especialidad deja solo la materia y no repite', () => {
        expect(formatSubjectName('TECNOLOGÍA', '')).toBe('Tecnología')
        expect(formatSubjectName('Tecnología', 'Tecnología Informática')).toBe('Tecnología Informática')
    })
    it('pasa mayúsculas a formato de título', () => {
        expect(niceSubjectCase('LENGUA MATERNA Y LITERATURA')).toBe('Lengua Materna y Literatura')
    })
})
