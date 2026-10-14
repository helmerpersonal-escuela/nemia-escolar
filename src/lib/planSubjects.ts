import { supabase } from './supabase'

// lesson_plans.subject_id puede apuntar a subject_catalog, group_subjects o
// profile_subjects (sin llave foránea desde 2026-02-17), así que PostgREST no
// puede incrustar subject_catalog(name). Aquí se resuelve el nombre aparte y se
// coloca en plan.subject_catalog = { name } para no cambiar las vistas.
export async function attachPlanSubjects<T extends { subject_id?: string | null }>(plans: T[] | null | undefined) {
    const list = plans ?? []
    const ids = [...new Set(list.map(p => p.subject_id).filter((v): v is string => !!v))]
    if (!ids.length) return list.map(p => ({ ...p, subject_catalog: null }))
    const names = new Map<string, string>()
    const [cat, gs, ps] = await Promise.all([
        supabase.from('subject_catalog').select('id, name').in('id', ids),
        supabase.from('group_subjects').select('id, custom_name, subject_catalog(name)').in('id', ids),
        supabase.from('profile_subjects').select('id, custom_detail, subject_catalog(name)').in('id', ids),
    ])
    ;(cat.data as any[] | null)?.forEach(r => r.name && names.set(r.id, r.name))
    ;(gs.data as any[] | null)?.forEach(r => { const n = r.custom_name || r.subject_catalog?.name; if (n && !names.has(r.id)) names.set(r.id, n) })
    ;(ps.data as any[] | null)?.forEach(r => { const n = r.subject_catalog?.name || r.custom_detail; if (n && !names.has(r.id)) names.set(r.id, n) })
    return list.map(p => {
        const n = p.subject_id ? names.get(p.subject_id) : undefined
        return { ...p, subject_catalog: n ? { name: n } : null }
    })
}
