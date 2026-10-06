// Horario de un docente. El horario se guarda por grupo y materia; quién imparte cada clase
// sale de la asignación de materias (grupo + materia → docente).

export interface Slot { id: string; group_id: string; subject_id: string | null; custom_subject: string | null; day_of_week: string; start_time: string; end_time: string }
export interface Assignment { group_id: string; subject_catalog_id: string | null; custom_name: string | null; teacher_id: string | null }

export const WEEK: [string, string][] = [['MONDAY', 'Lunes'], ['TUESDAY', 'Martes'], ['WEDNESDAY', 'Miércoles'], ['THURSDAY', 'Jueves'], ['FRIDAY', 'Viernes'], ['SATURDAY', 'Sábado'], ['SUNDAY', 'Domingo']]
const JS_DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']

export const dayKey = (d: Date) => JS_DAYS[d.getDay()]
export const hhmm = (t: string) => t.slice(0, 5)
const clock = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

const same = (a: string | null, b: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()
const matches = (s: Slot, a: Assignment) => a.group_id === s.group_id &&
    (s.subject_id ? a.subject_catalog_id === s.subject_id : same(a.custom_name, s.custom_subject))

/** Clases del horario que le tocan al docente, con su asignación, ordenadas por hora. */
export function slotsOfTeacher<A extends Assignment>(slots: Slot[], assignments: A[], teacherId: string): { slot: Slot; assignment: A }[] {
    const mine = assignments.filter(a => a.teacher_id === teacherId)
    const out: { slot: Slot; assignment: A }[] = []
    for (const slot of slots) {
        const assignment = mine.find(a => matches(slot, a))
        if (assignment) out.push({ slot, assignment })
    }
    return out.sort((a, b) => a.slot.start_time.localeCompare(b.slot.start_time))
}

/** De las clases de un docente: la que está dando en este momento y la siguiente de hoy. */
export function nowAndNext<T extends { slot: Slot }>(mine: T[], now: Date): { current: T | null; next: T | null } {
    const day = dayKey(now), at = clock(now)
    const today = mine.filter(m => m.slot.day_of_week === day)
    return {
        current: today.find(m => hhmm(m.slot.start_time) <= at && at < hhmm(m.slot.end_time)) ?? null,
        next: today.find(m => hhmm(m.slot.start_time) > at) ?? null,
    }
}
