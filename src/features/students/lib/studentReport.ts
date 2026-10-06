/** Cálculos del reporte de situación de un alumno (sin acceso a la base: fáciles de probar). */

export const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/** Busca por nombre en cualquier orden y sin importar acentos ("lopez ana" encuentra "Ana López"). */
export function matchesName(fullName: string, query: string): boolean {
    const q = plain(query)
    if (!q) return true
    const name = plain(fullName)
    return q.split(' ').every(word => name.includes(word))
}

export interface GradeRow { score: number | null; is_graded: boolean | null; assignment: { id: string; title: string; due_date: string | null; subject_id: string | null } }
export interface AssignmentRow { id: string; title: string; due_date: string | null; subject_id: string | null }
export interface SubjectSummary {
    subjectId: string
    name: string
    teacher: string | null
    graded: number
    average: number | null
    /** Actividades ya vencidas del grupo que el alumno no tiene calificadas. */
    missing: string[]
    /** Promedio menor a 6: requiere atención. */
    atRisk: boolean
}

/** Resumen por materia: promedio, actividades calificadas y pendientes. */
export function summarizeSubjects(
    subjects: { id: string; name: string; teacher: string | null }[],
    grades: GradeRow[],
    groupAssignments: AssignmentRow[],
    now = Date.now(),
): SubjectSummary[] {
    return subjects.map(s => {
        const mine = grades.filter(g => g.assignment?.subject_id === s.id && g.is_graded !== false && g.score != null)
        const average = mine.length ? Math.round((mine.reduce((a, g) => a + Number(g.score), 0) / mine.length) * 10) / 10 : null
        const gradedIds = new Set(mine.map(g => g.assignment.id))
        const missing = groupAssignments
            .filter(a => a.subject_id === s.id && a.due_date && Date.parse(a.due_date) < now && !gradedIds.has(a.id))
            .map(a => a.title)
        return { subjectId: s.id, name: s.name, teacher: s.teacher, graded: mine.length, average, missing, atRisk: average != null && average < 6 }
    }).sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export function overallAverage(rows: SubjectSummary[]): number | null {
    const withAvg = rows.filter(r => r.average != null)
    return withAvg.length ? Math.round((withAvg.reduce((a, r) => a + r.average!, 0) / withAvg.length) * 10) / 10 : null
}

export interface AttendanceSummary { total: number; present: number; late: number; absent: number; excused: number; pct: number | null; absences: string[] }

export function summarizeAttendance(rows: { date: string; status: string }[]): AttendanceSummary {
    const count = (s: string) => rows.filter(r => r.status === s).length
    const present = count('PRESENT'), late = count('LATE'), absent = count('ABSENT'), excused = count('EXCUSED')
    const total = rows.length
    return {
        total, present, late, absent, excused,
        pct: total ? Math.round(((present + late) / total) * 100) : null,
        absences: rows.filter(r => r.status === 'ABSENT').map(r => r.date).sort().reverse(),
    }
}
