import { describe, expect, it } from 'vitest'
import { matchesName, overallAverage, summarizeAttendance, summarizeSubjects } from './studentReport'

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
})
