import { describe, expect, it } from 'vitest'
import { BASE_INDICATORS, blankRecords, buildRiskCases, judgmentWords, visitSummary } from './visits'
import { agreementStats, agreementSummary, cleanAgreements, folioLabel } from '../../../lib/agreements'

describe('visita de acompañamiento', () => {
    it('los indicadores de base tienen identificador único y la escuela puede sumar los suyos', () => {
        expect(new Set(BASE_INDICATORS.map(i => i.id)).size).toBe(BASE_INDICATORS.length)
        const r = blankRecords([{ id: 'x1', area: 'Autoridad educativa', text: 'Se usa el plan de lectura.', source: 'AUTORIDAD' }])
        expect(r).toHaveLength(BASE_INDICATORS.length + 1)
        expect(r.every(x => x.observed === null && x.fact === '')).toBe(true)
    })
    it('resume lo registrado sin contar lo que no correspondía a la sesión', () => {
        const r = blankRecords([])
        r[0].observed = 'OBSERVADO'; r[0].fact = 'El propósito estaba escrito en el pizarrón.'
        r[1].observed = 'PARCIAL'; r[2].observed = 'NO_APLICA'; r[3].observed = 'NO_OBSERVADO'
        const s = visitSummary(r)
        expect(s).toMatchObject({ filled: 4, observed: 1, partial: 1, notObserved: 1, notApplicable: 1, withFact: 1 })
        expect(s.areas[0]).toEqual({ area: 'Planeación y programa analítico', total: 2, observed: 1, partial: 1 })
    })
    it('avisa de palabras que califican y deja pasar los hechos', () => {
        expect(judgmentWords('La clase fue excelente y el grupo trabajó bien.')).toEqual(['excelente', 'bien'])
        expect(judgmentWords('Pésimo control del grupo')).toEqual(['pesimo'])
        expect(judgmentWords('Ocho alumnos pasaron al pizarrón; tres preguntaron sobre el tema. También participó Benito.')).toEqual([])
    })
})

describe('alumnos en riesgo', () => {
    it('junta las señales y pone primero al que acumula más', () => {
        const cases = buildRiskCases(
            [{ student_id: 'a', failing: 2, failing_subjects: ['Español', 'Matemáticas'], conduct: 3, severe: 1, absences: 0 },
             { student_id: 'b', failing: 0, failing_subjects: [], conduct: 0, severe: 0, absences: 5 }],
            { c: ['Autorregulación'] }, { b: ['Fracciones'] })
        expect(cases.map(c => c.studentId)).toEqual(['a', 'b', 'c'])
        expect(cases[0].reasons.map(r => r.kind)).toEqual(['ACADEMICO', 'CONDUCTA'])
        expect(cases[1].reasons.map(r => r.kind)).toEqual(['ASISTENCIA', 'DIAGNOSTICO'])
        expect(cases[2].reasons[0].text).toContain('Autorregulación')
    })
    it('no arma caso si ninguna señal llega al mínimo', () => {
        expect(buildRiskCases([{ student_id: 'a', failing: 0, failing_subjects: [], conduct: 2, severe: 0, absences: 3 }], {}, {})).toEqual([])
    })
})

describe('acuerdos y folios', () => {
    const list = [
        { id: '1', text: ' Entregar tareas ', responsible: 'Alumno', due_date: '2026-10-01', done_at: null },
        { id: '2', text: 'Revisar cuaderno', responsible: 'Familia', due_date: '2026-10-20', done_at: '2026-10-05' },
        { id: '3', text: '  ', responsible: '', due_date: null, done_at: null },
    ]
    it('descarta los vacíos y cuenta cumplidos y vencidos', () => {
        const clean = cleanAgreements(list)
        expect(clean).toHaveLength(2); expect(clean[0].text).toBe('Entregar tareas')
        expect(agreementStats(clean, '2026-10-07')).toEqual({ total: 2, done: 1, pending: 1, overdue: 1 })
        expect(agreementSummary(clean, '2026-10-07')).toBe('1 de 2 cumplidos · 1 vencido')
        expect(agreementSummary([])).toBe('Sin acuerdos')
    })
    it('da formato al folio', () => {
        expect(folioLabel('INC', 12)).toBe('INC-0012'); expect(folioLabel('VA', null)).toBe('VA-s/f')
    })
})
