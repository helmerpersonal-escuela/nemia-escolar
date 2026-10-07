/** Pactos y acuerdos: se usan igual en incidencias, reuniones y visitas de acompañamiento. */
export interface Agreement { id: string; text: string; responsible: string; due_date: string | null; done_at: string | null }

export const newAgreement = (): Agreement => ({ id: Math.random().toString(36).slice(2, 10), text: '', responsible: '', due_date: null, done_at: null })

export const asAgreements = (v: unknown): Agreement[] => Array.isArray(v) ? (v as Agreement[]).filter(a => a && typeof a.text === 'string') : []

/** Solo se guardan los acuerdos que tienen texto. */
export const cleanAgreements = (list: Agreement[]) => list.filter(a => a.text.trim()).map(a => ({ ...a, text: a.text.trim(), responsible: a.responsible.trim() }))

export function agreementStats(list: Agreement[], today = new Date().toISOString().slice(0, 10)) {
    const done = list.filter(a => a.done_at).length
    const overdue = list.filter(a => !a.done_at && a.due_date && a.due_date < today).length
    return { total: list.length, done, pending: list.length - done, overdue }
}

export function agreementSummary(list: Agreement[], today?: string): string {
    const s = agreementStats(list, today)
    if (!s.total) return 'Sin acuerdos'
    return `${s.done} de ${s.total} cumplidos${s.overdue ? ` · ${s.overdue} vencido${s.overdue === 1 ? '' : 's'}` : ''}`
}

/** Folio con ceros a la izquierda: INC-0012. */
export const folioLabel = (prefix: string, folio: number | null | undefined) => folio ? `${prefix}-${String(folio).padStart(4, '0')}` : `${prefix}-s/f`
