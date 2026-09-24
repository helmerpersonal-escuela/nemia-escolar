/**
 * Datos de la libreta de un grupo, listos para usarse sin señal.
 * Se descarga TODO lo del grupo (todas las materias y periodos) en un paquete
 * y la pantalla filtra en memoria; así cambiar de materia o periodo funciona offline.
 */
import { supabase } from '../supabase'
import { must, readCache, withOfflineCache } from './cache'
import { pendingRows } from './outbox'

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export type GradebookBundle = {
    periods: Row[]
    group: Row | null
    students: Row[]
    criteria: Row[]
    assignments: Row[]
    grades: Row[]
    attendance: Row[]
    subjects: { id: string, name: string }[]
    incidents: Row[]
    lessonPlans: Row[]
    rubrics: Row[]
}

export const bundleKey = (tenantId: string, groupId: string) => `gradebook:${tenantId}:${groupId}`
export const groupsKey = (tenantId: string) => `gradebook-groups:${tenantId}`

export async function fetchGradebookBundle(tenantId: string, groupId: string): Promise<GradebookBundle> {
    const [periods, group, students, criteria, assignments, attendance, subjectsRaw, lessonPlans] = await Promise.all([
        supabase.from('evaluation_periods').select('*').eq('tenant_id', tenantId).order('start_date').then(must),
        supabase.from('groups').select('*').eq('id', groupId).maybeSingle().then(must),
        supabase.from('students').select('*').eq('group_id', groupId).order('last_name_paternal').then(must),
        supabase.from('evaluation_criteria').select('*').eq('group_id', groupId).then(must),
        supabase.from('assignments').select('*').eq('group_id', groupId).then(must),
        supabase.from('attendance').select('id, student_id, date, status, subject_id').eq('group_id', groupId).then(must),
        supabase.from('group_subjects').select('id, subject_catalog_id, custom_name, subject_catalog(name)').eq('group_id', groupId).then(must),
        supabase.from('lesson_plans').select('id, title, campo_formativo, period_id, subject_id, created_at')
            .eq('group_id', groupId).order('created_at', { ascending: false }).then(must),
    ])

    const studentIds = (students as Row[]).map(s => s.id)
    const instrumentIds = [...new Set((assignments as Row[]).map(a => a.instrument_id).filter(Boolean))]

    const [grades, incidents, rubrics] = await Promise.all([
        studentIds.length ? supabase.from('grades').select('*').in('student_id', studentIds).then(must) : Promise.resolve([]),
        studentIds.length ? supabase.from('student_incidents').select('*').in('student_id', studentIds)
            .order('created_at', { ascending: false }).then(must) : Promise.resolve([]),
        instrumentIds.length ? supabase.from('rubrics').select('*').in('id', instrumentIds).then(must) : Promise.resolve([]),
    ])

    const subjects = ((subjectsRaw as Row[]) || []).map(gs => ({
        id: gs.subject_catalog_id || gs.id,
        name: gs.subject_catalog?.name || gs.custom_name,
    }))

    return {
        periods: (periods as Row[]) || [],
        group: (group as Row) || null,
        students: (students as Row[]) || [],
        criteria: (criteria as Row[]) || [],
        assignments: (assignments as Row[]) || [],
        grades: (grades as Row[]) || [],
        attendance: (attendance as Row[]) || [],
        subjects,
        incidents: (incidents as Row[]) || [],
        lessonPlans: (lessonPlans as Row[]) || [],
        rubrics: (rubrics as Row[]) || [],
    }
}

/** Mezcla filas pendientes de subir con las guardadas, usando una llave. */
export function mergeRows(base: Row[], pending: Row[], keyFn: (r: Row) => string): Row[] {
    const map = new Map<string, Row>()
    for (const r of base) map.set(keyFn(r), r)
    for (const p of pending) map.set(keyFn(p), { ...(map.get(keyFn(p)) || {}), ...p, __pending: true })
    return [...map.values()]
}

export const attendanceKey = (r: Row) => `${r.student_id}|${r.date}|${r.subject_id ?? ''}`
export const gradeKey = (r: Row) => `${r.assignment_id}|${r.student_id}`

/** Aplica lo capturado sin señal (asistencia, calificaciones, incidencias) sobre el paquete. */
export async function withPendingChanges(bundle: GradebookBundle, groupId: string): Promise<GradebookBundle> {
    const studentIds = new Set(bundle.students.map(s => s.id))
    const [att, grd, inc] = await Promise.all([pendingRows('attendance'), pendingRows('grades'), pendingRows('student_incidents')])
    const pendingIncidents = inc
        .filter(i => studentIds.has(i.student_id as string) && !bundle.incidents.some(b => b.id === i.id))
        .map(i => ({ created_at: new Date().toISOString(), ...i, __pending: true }))
    return {
        ...bundle,
        attendance: mergeRows(bundle.attendance, att.filter(a => a.group_id === groupId), attendanceKey),
        grades: mergeRows(bundle.grades, grd.filter(g => studentIds.has(g.student_id as string)), gradeKey),
        incidents: [...pendingIncidents, ...bundle.incidents],
    }
}

/**
 * Carga el paquete del grupo: en línea lo descarga y lo guarda; sin señal usa
 * la copia guardada. En ambos casos aplica los cambios pendientes.
 */
export async function loadGradebookBundle(tenantId: string, groupId: string) {
    const res = await withOfflineCache(bundleKey(tenantId, groupId), () => fetchGradebookBundle(tenantId, groupId))
    if (!res.data) return { bundle: null, fromCache: res.fromCache, savedAt: res.savedAt }
    return { bundle: await withPendingChanges(res.data, groupId), fromCache: res.fromCache, savedAt: res.savedAt }
}

export async function loadGroups(tenantId: string) {
    return withOfflineCache(groupsKey(tenantId), async () =>
        must(await supabase.from('groups').select('*, academic_years(name)').eq('tenant_id', tenantId).order('grade').order('section')) as Row[])
}

/**
 * "Preparar para usar sin conexión": descarga y guarda los grupos y el paquete
 * de cada grupo. Devuelve cuántos grupos quedaron listos.
 */
export async function prepareOffline(tenantId: string, onProgress?: (done: number, total: number) => void) {
    const { data: groups } = await loadGroups(tenantId)
    const list = groups || []
    let done = 0
    for (const g of list) {
        const res = await withOfflineCache(bundleKey(tenantId, g.id), () => fetchGradebookBundle(tenantId, g.id))
        if (res.fromCache) throw new Error('Se perdió la conexión mientras se descargaban los grupos')
        done += 1
        onProgress?.(done, list.length)
    }
    return { groups: list.length }
}

export async function hasOfflineCopy(tenantId: string, groupId: string) {
    return !!(await readCache(bundleKey(tenantId, groupId)))
}
