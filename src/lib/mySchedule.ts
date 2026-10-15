import { supabase } from './supabase'

/**
 * La tabla `schedules` guarda el horario de TODA la escuela y no tiene docente: cada clase es
 * grupo + materia. Para ver solo las clases de quien entró se cruzan con sus materias asignadas
 * (`group_subjects.teacher_id`). En el espacio de un docente independiente todo el horario es suyo.
 */
export async function onlyMyClasses<T extends { group_id?: string | null; subject_id?: string | null; custom_subject?: string | null }>(
    rows: T[] | null | undefined,
    tenant: { id: string; type?: string | null } | null | undefined,
): Promise<T[]> {
    const list = rows ?? []
    if (!tenant || !list.length || tenant.type === 'INDEPENDENT') return list
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data } = await supabase.from('group_subjects')
        .select('group_id, subject_catalog_id, custom_name')
        .eq('tenant_id', tenant.id).eq('teacher_id', user.id)
    const mine = new Set<string>()
    for (const gs of (data as any[] | null) ?? []) {
        if (gs.subject_catalog_id) mine.add(`${gs.group_id}|${gs.subject_catalog_id}`)
        if (gs.custom_name) mine.add(`${gs.group_id}|${String(gs.custom_name).trim().toUpperCase()}`)
    }
    return list.filter(r =>
        (r.subject_id && mine.has(`${r.group_id}|${r.subject_id}`)) ||
        (r.custom_subject && mine.has(`${r.group_id}|${r.custom_subject.trim().toUpperCase()}`)))
}
