import { describe, expect, it } from 'vitest'
import { DEFAULT_CRITERIA, asCriteria, criteriaProblems, sameCriteria } from './criteria'
import { buildSheetHtml } from './sheetHtml'
import { diagnosticLevel, levelRules, scoreStudent, socioLevel } from '../features/instruments/lib/instruments'
import { areaFor, buildRiskCases } from '../features/direction/lib/visits'

describe('criterios de la escuela', () => {
    it('sin nada guardado quedan los de fábrica; lo guardado los reemplaza y lo inválido se ignora', () => {
        expect(asCriteria(null)).toEqual(DEFAULT_CRITERIA)
        const c = asCriteria({ tenant_id: 'x', risk_absences: 2, diag_expected: '70', socio_support: null, risk_min_average: 'abc' })
        expect(c).toMatchObject({ risk_absences: 2, diag_expected: 70, socio_support: 2.2, risk_min_average: 6 })
        expect(sameCriteria(c, DEFAULT_CRITERIA)).toBe(false)
    })
    it('no deja guardar rangos imposibles', () => {
        expect(criteriaProblems(DEFAULT_CRITERIA)).toEqual([])
        expect(criteriaProblems({ ...DEFAULT_CRITERIA, diag_support: 90 })).toHaveLength(1)
        expect(criteriaProblems({ ...DEFAULT_CRITERIA, risk_min_average: NaN, socio_expected: 5 }).length).toBeGreaterThanOrEqual(2)
    })
    it('los niveles siguen los criterios de la escuela', () => {
        const c = { ...DEFAULT_CRITERIA, diag_expected: 70, diag_support: 50, socio_expected: 3.5, socio_support: 2.5 }
        expect(diagnosticLevel(75)).toBe('DESARROLLO'); expect(diagnosticLevel(75, c)).toBe('ESPERADO'); expect(diagnosticLevel(55, c)).toBe('DESARROLLO')
        expect(socioLevel(3.2)).toBe('ESPERADO'); expect(socioLevel(3.2, c)).toBe('DESARROLLO'); expect(socioLevel(2.4, c)).toBe('APOYO')
        const items = [{ id: 'a', text: 'x', topic: 'T' }, { id: 'b', text: 'y', topic: 'T' }]
        expect(scoreStudent('DIAGNOSTICO', items, { a: 1, b: 0 })!.level).toBe('APOYO')
        expect(scoreStudent('DIAGNOSTICO', items, { a: 1, b: 0 }, c)!.level).toBe('DESARROLLO')
        expect(levelRules('DIAGNOSTICO', c)).toContain('esperado 70%')
    })
    it('el riesgo usa los mínimos de la escuela', () => {
        const row = { student_id: 'a', failing: 0, failing_subjects: [], conduct: 2, severe: 0, absences: 2 }
        expect(buildRiskCases([row], {}, {})).toEqual([])
        const cases = buildRiskCases([row], {}, {}, { ...DEFAULT_CRITERIA, risk_conduct_count: 2, risk_absences: 2, risk_conduct_days: 30, risk_absence_days: 15 })
        expect(cases[0].reasons.map(r => r.text)).toEqual(['2 incidencias de conducta en 30 días', '2 faltas en los últimos 15 días'])
    })
})

describe('subdirección y hoja para compartir', () => {
    it('toma el área del cargo: la subdirección es un cargo de directivo', () => {
        expect(areaFor('DIRECTOR', 'Subdirector(a)')).toBe('SUBDIRECCION')
        expect(areaFor('DIRECTOR', 'Subdirección académica')).toBe('SUBDIRECCION')
        expect(areaFor('DIRECTOR', 'Director(a)')).toBe('DIRECCION')
        expect(areaFor('ACADEMIC_COORD', null)).toBe('COORDINACION')
        expect(areaFor('ADMIN', undefined)).toBe('DIRECCION')
    })
    it('arma un archivo completo con la hoja y sus estilos', () => {
        const html = buildSheetHtml('<div class="print-page">Folio INC-0001</div>', '.a{color:red}</style><script>x</script>')
        expect(html.startsWith('<!doctype html>')).toBe(true)
        expect(html).toContain('Folio INC-0001'); expect(html).toContain('.a{color:red}')
        expect(html.match(/<\/style/g)).toHaveLength(1)
    })
})
