import { describe, expect, it } from 'vitest'
import { missingSteps, canFix, requestLink, STEPS, type SetupStatus } from '../lib/prerequisites'

const empty: SetupStatus = { workspace: 'SCHOOL', role: 'DIRECTOR', activeYear: false, periods: 0, hasSchedule: false, teachers: 0, groups: 0, groupSubjects: 0, myAssignments: 0, students: 0, guardians: 0 }
const full: SetupStatus = { ...empty, activeYear: true, periods: 3, hasSchedule: true, teachers: 5, groups: 4, groupSubjects: 20, myAssignments: 2, students: 100, guardians: 80 }

describe('pasos previos (la regla de oro)', () => {
    it('incluye los pasos anteriores de los que depende, en orden', () => {
        expect(missingSteps(empty, ['tutores']).map(s => s.id)).toEqual(['ciclo', 'grupos', 'alumnos', 'tutores'])
        expect(missingSteps(empty, ['materias']).map(s => s.id)).toEqual(['ciclo', 'personal', 'grupos', 'materias'])
    })
    it('no pide nada si todo está listo', () => {
        expect(missingSteps(full, ['tutores', 'jornada', 'asignacion'])).toEqual([])
    })
    it('solo señala el paso que falta', () => {
        expect(missingSteps({ ...full, hasSchedule: false }, ['jornada', 'materias']).map(s => s.id)).toEqual(['jornada'])
    })
    it('la asignación solo aplica a docentes de escuela', () => {
        const noMine = { ...full, myAssignments: 0 }
        expect(missingSteps(noMine, ['asignacion'])).toEqual([])
        expect(missingSteps({ ...noMine, role: 'TEACHER' }, ['asignacion']).map(s => s.id)).toEqual(['asignacion'])
        expect(missingSteps({ ...noMine, role: 'INDEPENDENT_TEACHER', workspace: 'INDEPENDENT', teachers: 0 }, ['asignacion', 'materias'])).toEqual([])
    })
    it('quién puede completar cada paso', () => {
        expect(canFix(STEPS.ciclo, 'SYSTEM_ADMIN')).toBe(true)
        expect(canFix(STEPS.grupos, 'SCHOOL_CONTROL')).toBe(true)
        expect(canFix(STEPS.grupos, 'TEACHER')).toBe(false)
        expect(requestLink(STEPS.grupos, 'pasar lista')).toContain('tipo=GRUPOS')
    })
})
