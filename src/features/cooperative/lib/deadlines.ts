import { daysUntil, type CoopDocument, type Deadline, type DocType } from './types'

export interface DeadlineState {
    deadline: Deadline
    days: number
    delivered: boolean
    /** vencido | próximo (≤ 15 días) | a tiempo | entregado */
    level: 'overdue' | 'soon' | 'ok' | 'done'
}

/** Estado de cada fecha límite respecto a los formatos del docente (o de toda la escuela si mine = false). */
export function deadlineStates(deadlines: Deadline[], documents: CoopDocument[], teacherId?: string): DeadlineState[] {
    return deadlines.map(d => {
        const docs = documents.filter(x => x.doc_type === d.doc_type && (!teacherId || x.teacher_id === teacherId))
        const delivered = docs.some(x => x.status === 'ENVIADO' || x.status === 'APROBADO')
        const days = daysUntil(d.due_date)
        const level: DeadlineState['level'] = delivered ? 'done' : days < 0 ? 'overdue' : days <= 15 ? 'soon' : 'ok'
        return { deadline: d, days, delivered, level }
    })
}

/**
 * Fechas típicas de entrega según las circulares de la Subjefatura de Producción.
 * Son una sugerencia: el docente las ajusta a la circular de su zona.
 */
export function suggestedDeadlines(cycleStart?: string): { doc_type: DocType; due_date: string; notes: string }[] {
    const y = cycleStart ? Number(cycleStart.slice(0, 4)) : (new Date().getMonth() >= 7 ? new Date().getFullYear() : new Date().getFullYear() - 1)
    const n = y + 1
    return [
        { doc_type: 'PLAN_ANUAL', due_date: `${y}-09-30`, notes: 'Primer mes del ciclo' },
        { doc_type: 'PRESUPUESTO', due_date: `${y}-10-15`, notes: 'Un presupuesto por proyecto' },
        { doc_type: 'INFORME_SEMESTRAL', due_date: `${n}-01-30`, notes: 'Primer semestre' },
        { doc_type: 'INFORME_ANUAL', due_date: `${n}-06-19`, notes: 'Cierre del plan anual' },
        { doc_type: 'NOMINA_FONDO_REPARTIBLE', due_date: `${n}-06-26`, notes: 'Después del informe anual' },
        { doc_type: 'NOMINA_CERTIFICADOS_DEVUELTOS', due_date: `${n}-07-03`, notes: 'Socios que egresan de 3er grado' },
    ]
}

export const LEVEL_STYLE: Record<DeadlineState['level'], string> = {
    overdue: 'bg-rose-50 text-rose-700 border-rose-100',
    soon: 'bg-amber-50 text-amber-800 border-amber-100',
    ok: 'bg-slate-50 text-slate-600 border-slate-100',
    done: 'bg-emerald-50 text-emerald-700 border-emerald-100',
}

export const levelText = (s: DeadlineState) =>
    s.level === 'done' ? 'Entregado' : s.days < 0 ? `Vencido hace ${-s.days} día(s)` : s.days === 0 ? 'Vence hoy' : `Faltan ${s.days} día(s)`
