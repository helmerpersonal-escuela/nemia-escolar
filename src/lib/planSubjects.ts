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

/**
 * Una misma materia puede venir con tres identificadores distintos según la pantalla:
 * el del catálogo (subject_catalog), el de la materia del grupo (group_subjects) o el de
 * la materia del docente (profile_subjects). Las planeaciones guardan cualquiera de ellos,
 * así que para buscarlas hay que considerar todos los equivalentes.
 */
export async function equivalentSubjectIds(subjectId: string, groupId?: string): Promise<{ ids: string[]; catalogId: string | null; name: string | null }> {
    if (!subjectId) return { ids: [], catalogId: null, name: null }
    const [gs, ps, cat] = await Promise.all([
        supabase.from('group_subjects').select('subject_catalog_id, custom_name, subject_catalog(name)').eq('id', subjectId).maybeSingle(),
        supabase.from('profile_subjects').select('subject_catalog_id, custom_detail, subject_catalog(name)').eq('id', subjectId).maybeSingle(),
        supabase.from('subject_catalog').select('id, name').eq('id', subjectId).maybeSingle(),
    ])
    const g = gs.data as any, p = ps.data as any, c = cat.data as any
    const catalogId: string | null = c?.id ?? g?.subject_catalog_id ?? p?.subject_catalog_id ?? null
    const name: string | null = c?.name ?? g?.subject_catalog?.name ?? g?.custom_name ?? p?.subject_catalog?.name ?? p?.custom_detail ?? null
    const ids = new Set<string>([subjectId])
    if (catalogId) {
        ids.add(catalogId)
        let q = supabase.from('group_subjects').select('id').eq('subject_catalog_id', catalogId)
        if (groupId) q = q.eq('group_id', groupId)
        const [gsAll, psAll] = await Promise.all([q, supabase.from('profile_subjects').select('id').eq('subject_catalog_id', catalogId)])
        ;(gsAll.data as any[] | null)?.forEach(r => ids.add(r.id))
        ;(psAll.data as any[] | null)?.forEach(r => ids.add(r.id))
    }
    return { ids: [...ids], catalogId, name }
}

/**
 * La planeación más útil para una materia y grupo: primero la que abarca la fecha indicada,
 * si no, la más reciente. Devuelve null si no hay ninguna.
 */
export async function findLessonPlanFor<T = any>(opts: { groupId: string; subjectId?: string; date?: string; select?: string }): Promise<T | null> {
    const { groupId, subjectId, date, select = '*' } = opts
    if (!groupId) return null
    let q = supabase.from('lesson_plans').select(select).eq('group_id', groupId)
    if (subjectId) {
        const { ids } = await equivalentSubjectIds(subjectId, groupId)
        q = q.in('subject_id', ids)
    }
    const { data } = await q.order('created_at', { ascending: false }).limit(20)
    const plans = ((data as any[] | null) ?? [])
    if (!plans.length) return null
    if (date) {
        const covering = plans.find(p => p.start_date && p.end_date && p.start_date <= date && date <= p.end_date)
        if (covering) return covering as T
    }
    return plans[0] as T
}

const FIELD_KEY: Record<string, string> = {
    'Lenguajes': 'lenguajes',
    'Saberes y Pensamiento Científico': 'saberes',
    'Ética, Naturaleza y Sociedades': 'etica',
    'De lo Humano y lo Comunitario': 'humano',
}

const norm = (s: string | null | undefined) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/**
 * Contexto tomado del programa analítico cuando todavía no hay planeación: contenidos, PDA del
 * grado, metodología y ejes de la materia. Tiene la misma forma que una planeación para que la
 * IA lo use igual. Devuelve null si el programa no tiene nada de esa materia.
 */
export async function analyticalContextFor(opts: { tenantId: string; subjectId: string; groupId?: string }): Promise<any | null> {
    const { tenantId, subjectId, groupId } = opts
    const { name } = await equivalentSubjectIds(subjectId, groupId)
    if (!name) return null
    let grade = 1
    if (groupId) {
        const { data: g } = await supabase.from('groups').select('grade').eq('id', groupId).maybeSingle()
        grade = Number((g as any)?.grade) || 1
    }
    const { data: programs } = await supabase.from('analytical_programs')
        .select('id, field_of_study, program_by_fields, problem_statements, status, updated_at')
        .eq('tenant_id', tenantId).order('updated_at', { ascending: false }).limit(10)
    for (const prog of (programs as any[] | null) ?? []) {
        const byField = prog.program_by_fields ?? {}
        const keys = prog.field_of_study ? [FIELD_KEY[prog.field_of_study] ?? prog.field_of_study] : Object.keys(byField)
        const items: any[] = keys.flatMap(k => Array.isArray(byField[k]) ? byField[k] : [])
        const mine = items.filter(it => norm(it.subject_name) === norm(name) || norm(it.contentName).includes(norm(name)))
        if (!mine.length) continue
        const problem = Array.isArray(prog.problem_statements) ? prog.problem_statements[0] : null
        return {
            id: null,
            source: 'analytical_program',
            title: `${name}: ${problem?.title ?? 'contenidos del programa analítico'}`,
            campo_formativo: prog.field_of_study ?? mine[0].field_of_study ?? null,
            metodologia: mine[0].methodology ?? null,
            problem_context: problem?.description ?? null,
            contents: mine.map(it => it.contentName ?? it.content).filter(Boolean),
            pda: mine.map(it => it[`pda_grade_${grade}`] ?? it.pda).filter(Boolean),
            ejes_articuladores: [...new Set(mine.flatMap(it => it.axes ?? []))],
            evaluation_plan: { instruments: [...new Set(mine.map(it => it.evaluation).filter(Boolean))] },
            activities_sequence: [],
        }
    }
    return null
}
