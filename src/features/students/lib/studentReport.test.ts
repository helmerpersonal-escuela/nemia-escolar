import { describe, expect, it } from 'vitest'
import { conductByPeriod, matchesName, overallAverage, periodIndex, shortPeriodName, summarizeAttendance, summarizeByPeriod, summarizeSubjects } from './studentReport'

const NOW = Date.parse('2026-10-06T12:00:00Z')
const a = (id: string, subject: string, due: string) => ({ id, title: `Actividad ${id}`, due_date: due, subject_id: subject })

describe('reporte del alumno', () => {
    it('busca por nombre sin importar orden ni acentos', () => {
        expect(matchesName('Ana María López Ruiz', 'lopez ana')).toBe(true)
        expect(matchesName('Ana María López Ruiz', 'ANA  MARIA')).toBe(true)
        expect(matchesName('Ana María López Ruiz', 'pérez')).toBe(false)
        expect(matchesName('Ana María López Ruiz', '  ')).toBe(true)
    })

    it('resume cada materia: promedio, calificadas y pendientes vencidas', () => {
        const assignments = [a('1', 'mat', '2026-09-10'), a('2', 'mat', '2026-09-20'), a('3', 'mat', '2026-10-20'), a('4', 'esp', '2026-09-15')]
        const grades = [
            { score: 8, is_graded: true, assignment: assignments[0] },
            { score: 5, is_graded: true, assignment: assignments[3] },
        ]
        const rows = summarizeSubjects([{ id: 'mat', name: 'Matemáticas', teacher: 'Mateo García' }, { id: 'esp', name: 'Español', teacher: null }], grades, assignments, NOW)
        expect(rows.map(r => r.name)).toEqual(['Español', 'Matemáticas'])
        const mat = rows[1]
        expect(mat.average).toBe(8)
        expect(mat.graded).toBe(1)
        expect(mat.missing).toEqual(['Actividad 2'])        // la 3 todavía no vence
        expect(mat.atRisk).toBe(false)
        expect(rows[0].atRisk).toBe(true)                    // promedio 5
        expect(overallAverage(rows)).toBe(6.5)
    })

    it('una materia sin calificaciones no cuenta para el promedio general', () => {
        const rows = summarizeSubjects([{ id: 'x', name: 'Artes', teacher: null }], [], [], NOW)
        expect(rows[0].average).toBeNull()
        expect(overallAverage(rows)).toBeNull()
    })

    it('resume la asistencia: el retardo cuenta como asistencia', () => {
        const s = summarizeAttendance([
            { date: '2026-10-01', status: 'PRESENT' }, { date: '2026-10-02', status: 'LATE' },
            { date: '2026-10-03', status: 'ABSENT' }, { date: '2026-10-05', status: 'EXCUSED' },
        ])
        expect(s.pct).toBe(50)
        expect(s.absences).toEqual(['2026-10-03'])
        expect(summarizeAttendance([]).pct).toBeNull()
    })

    const periods = [
        { id: 'p1', name: 'Primer trimestre', start_date: '2026-08-31', end_date: '2026-11-27' },
        { id: 'p2', name: 'Segundo trimestre', start_date: '2026-11-30', end_date: '2027-03-19' },
        { id: 'p3', name: 'Tercer trimestre', start_date: '2027-03-22', end_date: '2027-07-15' },
    ]

    it('ubica cada fecha en su trimestre', () => {
        expect(periodIndex(periods, '2026-11-27')).toBe(0)
        expect(periodIndex(periods, '2026-11-30T14:00:00+00:00')).toBe(1)
        expect(periodIndex(periods, '2026-11-28')).toBe(-1)     // fin de semana entre periodos
        expect(periodIndex(periods, null)).toBe(-1)
        expect(shortPeriodName('Primer trimestre', 0)).toBe('Trim. 1')
        expect(shortPeriodName('Evaluación final', 3)).toBe('Evaluación final')
    })

    it('da la calificación de cada materia por trimestre y el promedio de los trimestres', () => {
        const g = (subject: string, due: string, score: number) => ({ score, is_graded: true, assignment: { id: due + subject, title: 't', due_date: due, subject_id: subject } })
        const r = summarizeByPeriod(
            [{ id: 'mat', name: 'Matemáticas', teacher: null }, { id: 'esp', name: 'Español', teacher: null }],
            [g('mat', '2026-09-10', 8), g('mat', '2026-10-10', 6), g('mat', '2027-01-15', 9), g('esp', '2026-09-12', 5)],
            periods)
        const mat = r.rows.find(x => x.name === 'Matemáticas')!
        expect(mat.byPeriod).toEqual([7, 9, null])
        expect(mat.average).toBe(8)                 // promedio de los trimestres con calificación
        const esp = r.rows.find(x => x.name === 'Español')!
        expect(esp.byPeriod).toEqual([5, null, null])
        expect(esp.atRisk).toBe(true)
        expect(r.general).toEqual([6, 9, null])     // promedio general de cada trimestre
        expect(r.average).toBe(7.5)
    })

    it('resume el comportamiento por trimestre', () => {
        const c = conductByPeriod(periods,
            [{ date: '2026-09-01', status: 'PRESENT' }, { date: '2026-09-02', status: 'ABSENT' }, { date: '2027-01-10', status: 'PRESENT' }],
            [{ created_at: '2026-09-05T10:00:00Z', type: 'CONDUCTA' }, { created_at: '2026-09-06T10:00:00Z', type: 'POSITIVO' }])
        expect(c[0]).toEqual({ attendancePct: 50, absences: 1, incidents: 1, positives: 1 })
        expect(c[1]).toEqual({ attendancePct: 100, absences: 0, incidents: 0, positives: 0 })
        expect(c[2].attendancePct).toBeNull()
    })
})
