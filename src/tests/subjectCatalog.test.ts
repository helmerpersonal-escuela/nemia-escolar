import { describe, it, expect } from 'vitest'
import { buildSubjectOptions, matchesSearch, shortField } from '../lib/subjectCatalog'

const catalog = [
    { id: 'm1', name: 'Matemáticas', field_of_study: 'Saberes y Pensamiento Científico', requires_specification: false },
    { id: 'm2', name: 'MATEMÁTICAS', field_of_study: 'Saberes y Pensamiento Científico', requires_specification: false },
    { id: 'i1', name: 'INGLES', field_of_study: 'Lenguajes', requires_specification: false },
    { id: 'i2', name: 'Inglés', field_of_study: 'Lenguajes', requires_specification: false },
    { id: 't1', name: 'Tecnología', field_of_study: 'De lo Humano y lo Comunitario', requires_specification: false },
    { id: 't2', name: 'TECNOLOGÍA', field_of_study: 'De lo Humano y lo Comunitario', requires_specification: true },
    { id: 'o1', name: 'Otra Materia / Actividad', field_of_study: 'Complementaria', requires_specification: true },
    { id: 'b1', name: 'Biología', field_of_study: 'Saberes y Pensamiento Científico', requires_specification: false },
]

describe('catálogo de materias para el docente', () => {
    const { options, other } = buildSubjectOptions(catalog)

    it('junta duplicados aunque cambien mayúsculas o acentos', () => {
        expect(options.map(o => o.name)).toEqual(['Biología', 'Inglés', 'Matemáticas', 'Tecnología'])
        const mat = options.find(o => o.name === 'Matemáticas')!
        expect(mat.ids.sort()).toEqual(['m1', 'm2'])
        expect(mat.id).toBe('m2')
    })

    it('Tecnología pide especialidad y "Otra materia" queda aparte, al final', () => {
        const tec = options.find(o => o.isTechnology)!
        expect(tec.requiresSpecification).toBe(true)
        expect(other?.id).toBe('o1')
        expect(options.some(o => o.isOther)).toBe(false)
    })

    it('busca sin importar acentos', () => {
        const eng = options.find(o => o.name === 'Inglés')!
        expect(matchesSearch(eng, 'ingles')).toBe(true)
        expect(matchesSearch(eng, 'lenguajes')).toBe(true)
        expect(matchesSearch(eng, 'bio')).toBe(false)
    })

    it('etiqueta corta del campo formativo', () => {
        expect(shortField('Saberes y Pensamiento Científico')).toBe('Saberes y P. Científico')
    })
})
