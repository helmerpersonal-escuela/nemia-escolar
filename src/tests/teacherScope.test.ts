import { describe, it, expect } from 'vitest'
import { sameDiscipline, toCampo, findOutOfScopeMentions, type TeacherScope } from '../features/analytical-program/lib/teacherScope'

const tecno: TeacherScope = {
    level: 'SECONDARY', levelLabel: 'Secundaria', phase: 6,
    subjects: [{ name: 'TECNOLOGÍA', field: 'De lo Humano y lo Comunitario' }],
    fields: ['De lo Humano y lo Comunitario'], grades: [1, 2], generalist: false, missingSubjects: false,
}

describe('alcance curricular del programa analítico', () => {
    it('reconoce la misma disciplina aunque cambie la escritura', () => {
        expect(sameDiscipline('TECNOLOGÍA', 'Tecnología')).toBe(true)
        expect(sameDiscipline('INGLES', 'Inglés')).toBe(true)
        expect(sameDiscipline('TUTORÍA', 'Educación Socioemocional / Tutoría')).toBe(true)
        expect(sameDiscipline('Artes (antes Educación Artística)', 'Artes')).toBe(true)
    })

    it('no confunde disciplinas distintas', () => {
        expect(sameDiscipline('Educación Física', 'Educación Socioemocional / Tutoría')).toBe(false)
        expect(sameDiscipline('Física', 'Educación Física', 'Saberes y Pensamiento Científico', 'De lo Humano y lo Comunitario')).toBe(false)
        expect(sameDiscipline('Tecnología', 'Matemáticas')).toBe(false)
    })

    it('normaliza campos formativos', () => {
        expect(toCampo('humano')).toBe('De lo Humano y lo Comunitario')
        expect(toCampo('Ética, Naturaleza y Sociedades')).toBe('Ética, Naturaleza y Sociedades')
        expect(toCampo('saberes')).toBe('Saberes y Pensamiento Científico')
    })

    it('marca menciones a otros campos o asignaturas', () => {
        expect(findOutOfScopeMentions('Diseña un prototipo vinculado con Matemáticas y el campo Saberes y Pensamiento Científico.', tecno))
            .toEqual(expect.arrayContaining(['Saberes y Pensamiento Científico', 'Matemáticas']))
    })

    it('no marca palabras comunes ni su propia disciplina', () => {
        expect(findOutOfScopeMentions('Los alumnos recuperan la historia de la comunidad y realizan actividad física mientras diseñan con Tecnología un sistema de riego.', tecno)).toEqual([])
    })
})
