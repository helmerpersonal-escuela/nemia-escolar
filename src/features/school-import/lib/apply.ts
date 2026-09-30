/**
 * Guarda el plan en la base de datos, en el orden en que dependen los datos:
 * jornada → grupos → alumnos → tutores → plantilla de personal → materias → horario →
 * comisiones → CTE → PEMC → antecedentes. Se puede correr otra vez: lo que ya existe no se duplica.
 */
import { supabase } from '../../../lib/supabase'
import { bestMatch, normName, surnamesFirst } from './names'
import { NEM_FIELDS, nemFieldFor, type Plan } from './consolidate'

export type SectionId = 'jornada' | 'grupos' | 'alumnos' | 'tutores' | 'personal' | 'materias' | 'horario' | 'comisiones' | 'cte' | 'pemc' | 'antecedentes'
export const SECTION_LABEL: Record<SectionId, string> = {
    jornada: 'Jornada escolar', grupos: 'Grupos', alumnos: 'Alumnos', tutores: 'Tutores y teléfonos', personal: 'Plantilla de personal',
    materias: 'Materias y docentes por grupo', horario: 'Horario de clases', comisiones: 'Comisiones', cte: 'Sesiones de CTE', pemc: 'PEMC', antecedentes: 'Antecedentes académicos',
}

export type ApplyOptions = {
    sections: Record<SectionId, boolean>
    excludedStaff: Set<string>
    replaceSchedule: boolean
    overwriteJornada: boolean
    historyYear: string
    schoolYear: string
}
export type SectionResult = { id: SectionId; created: number; updated: number; skipped: number; errors: string[] }

const chunk = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n))
const hhmmss = (t: string) => (t.length === 5 ? `${t}:00` : t)

export async function applyPlan(plan: Plan, opts: ApplyOptions, tenantId: string, onProgress: (label: string, pct: number) => void): Promise<SectionResult[]> {
    const results: SectionResult[] = []
    const res = (id: SectionId) => { const r: SectionResult = { id, created: 0, updated: 0, skipped: 0, errors: [] }; results.push(r); return r }
    const on = (id: SectionId) => opts.sections[id]
    const steps: SectionId[] = (Object.keys(SECTION_LABEL) as SectionId[]).filter(on)
    let step = 0
    const progress = (id: SectionId) => onProgress(SECTION_LABEL[id], Math.round((step++ / Math.max(1, steps.length)) * 100))

    // Ciclo escolar activo (los grupos viven dentro de él)
    const { data: year } = await supabase.from('academic_years').select('id, name').eq('tenant_id', tenantId).eq('is_active', true).order('start_date', { ascending: false }).limit(1).maybeSingle()
    if (!year && (on('grupos') || on('alumnos'))) throw new Error('Primero activa el ciclo escolar en Configuración → Ciclo escolar y periodos.')

    // Catálogo de materias (se prefiere el registro en MAYÚSCULAS, que es el que ya usan los datos)
    const { data: catalog } = await supabase.from('subject_catalog').select('id, name').in('educational_level', ['SECONDARY', 'BOTH'])
    const catalogId = new Map<string, string>()
    const catalogName = new Map<string, string>()
    for (const c of catalog ?? []) {
        const k = normName(c.name)
        catalogName.set(c.id, k)
        if (!catalogId.has(k) || c.name === c.name.toUpperCase()) catalogId.set(k, c.id)
    }
    const idForCatalog = (name: string) => catalogId.get(normName(name)) ?? null
    const otherId = idForCatalog('Otra Materia / Actividad')

    // ── Jornada
    if (on('jornada')) {
        progress('jornada'); const r = res('jornada')
        if (!plan.jornada) r.skipped++
        else {
            const { data: current } = await supabase.from('schedule_settings').select('id').eq('tenant_id', tenantId).maybeSingle()
            const payload = { tenant_id: tenantId, start_time: hhmmss(plan.jornada.start), end_time: hhmmss(plan.jornada.end), module_duration: plan.jornada.moduleMinutes, breaks: plan.jornada.breaks }
            if (current && !opts.overwriteJornada) r.skipped++
            else {
                const { error } = current ? await supabase.from('schedule_settings').update(payload).eq('id', current.id) : await supabase.from('schedule_settings').insert(payload)
                if (error) r.errors.push(error.message); else current ? r.updated++ : r.created++
            }
        }
    }

    // ── Grupos
    const groupId = new Map<string, string>()
    if (year) {
        const { data: existing } = await supabase.from('groups').select('id, grade, section').eq('tenant_id', tenantId).eq('academic_year_id', year.id).is('archived_at', null)
        for (const g of existing ?? []) groupId.set(`${String(g.grade).replace(/\D/g, '')}${String(g.section).trim().toUpperCase()}`, g.id)
    }
    if (on('grupos') && year) {
        progress('grupos'); const r = res('grupos')
        const shift = /VESP|TARDE/i.test(plan.meta.shift ?? '') ? 'AFTERNOON' : 'MORNING'
        const missing = plan.groups.filter(g => !groupId.has(g.key))
        r.skipped = plan.groups.length - missing.length
        if (missing.length) {
            const { data, error } = await supabase.from('groups').insert(missing.map(g => ({ tenant_id: tenantId, academic_year_id: year.id, grade: g.grade, section: g.section, shift }))).select('id, grade, section')
            if (error) r.errors.push(error.message)
            for (const g of data ?? []) { groupId.set(`${g.grade}${g.section}`, g.id); r.created++ }
        }
    }

    // ── Alumnos
    const studentId = new Map<string, string>()        // "1A|NOMBRE" → id
    const studentInfo = new Map<string, { gender: string | null; curp: string | null }>()
    const allStudents: { id: string; full: string }[] = []
    const groupIds = [...new Set(plan.groups.map(g => groupId.get(g.key)).filter(Boolean))] as string[]
    const loadStudents = async () => {
        studentId.clear(); studentInfo.clear(); allStudents.length = 0
        for (const ids of chunk(groupIds, 30)) {
            const { data } = await supabase.from('students').select('id, group_id, first_name, last_name_paternal, last_name_maternal, gender, curp').in('group_id', ids)
            for (const s of data ?? []) {
                const key = [...groupId.entries()].find(([, id]) => id === s.group_id)?.[0]
                const full = surnamesFirst(s as any)
                if (key) studentId.set(`${key}|${normName(full)}`, s.id)
                if (key) studentInfo.set(s.id, { gender: s.gender, curp: s.curp })
                allStudents.push({ id: s.id, full })
            }
        }
    }
    await loadStudents()
    if (on('alumnos')) {
        progress('alumnos'); const r = res('alumnos')
        for (const g of plan.groups) {
            const gid = groupId.get(g.key)
            if (!gid) { r.errors.push(`${g.key}: el grupo no existe (activa la sección Grupos).`); continue }
            const missing = g.students.filter(s => !studentId.has(`${g.key}|${normName(s.full)}`))
            // Completa sexo y CURP de los que ya existían (sin sobrescribir lo capturado)
            for (const s of g.students) {
                const id = studentId.get(`${g.key}|${normName(s.full)}`)
                if (!id) continue
                const info = studentInfo.get(id)
                const patch: Record<string, string> = {}
                if (s.curp && !info?.curp) patch.curp = s.curp
                if (s.gender && !info?.gender) patch.gender = s.gender
                if (Object.keys(patch).length) { const { error } = await supabase.from('students').update(patch).eq('id', id); if (error) r.errors.push(error.message); else r.updated++ }
                else r.skipped++
            }
            if (!missing.length) continue
            const { data, error } = await supabase.from('students').insert(missing.map(s => ({
                tenant_id: tenantId, group_id: gid, first_name: s.first_name, last_name_paternal: s.last_name_paternal,
                last_name_maternal: s.last_name_maternal || null, gender: s.gender, curp: s.curp ?? null, condition: 'Ninguna', status: 'ACTIVE',
            }))).select('id')
            if (error) r.errors.push(`${g.key}: ${error.message}`)
            else r.created += data?.length ?? 0
        }
        await loadStudents()
    }

    // ── Tutores y teléfonos
    if (on('tutores')) {
        progress('tutores'); const r = res('tutores')
        const ids = [...studentId.values()]
        const existing = new Map<string, { id: string; phone: string | null; phone_alt1: string | null; phone_alt2: string | null }>()
        for (const part of chunk(ids, 150)) {
            const { data } = await supabase.from('guardians').select('id, student_id, phone, phone_alt1, phone_alt2').in('student_id', part)
            for (const g of data ?? []) if (!existing.has(g.student_id)) existing.set(g.student_id, g)
        }
        const inserts: Record<string, unknown>[] = []
        for (const g of plan.guardians) {
            const sid = studentId.get(`${g.groupKey}|${g.studentKey}`)
            if (!sid) { r.skipped++; continue }
            const cur = existing.get(sid)
            if (cur) {
                const patch: Record<string, string> = {}
                if (!cur.phone && g.phone) patch.phone = g.phone
                if (!cur.phone_alt1 && g.alt1) patch.phone_alt1 = g.alt1
                if (!cur.phone_alt2 && g.alt2) patch.phone_alt2 = g.alt2
                if (Object.keys(patch).length) {
                    const { error } = await supabase.from('guardians').update(patch).eq('id', cur.id)
                    if (error) r.errors.push(error.message); else r.updated++
                } else r.skipped++
                continue
            }
            inserts.push({
                student_id: sid, tenant_id: tenantId,
                first_name: g.tutor.first_name || g.tutorFull || 'TUTOR', last_name_paternal: g.tutor.last_name_paternal || '', last_name_maternal: g.tutor.last_name_maternal || null,
                relationship: 'TUTOR', phone: g.phone, phone_alt1: g.alt1, phone_alt2: g.alt2,
            })
        }
        for (const part of chunk(inserts, 100)) {
            const { error } = await supabase.from('guardians').insert(part)
            if (error) r.errors.push(error.message); else r.created += part.length
        }
    }

    // ── Plantilla de personal
    const roster = new Map<string, { id: string; profile_id: string | null }>()
    const staffRows = plan.staff.filter(s => !opts.excludedStaff.has(s.key))
    if (on('personal') || on('materias') || on('comisiones')) {
        if (on('personal')) progress('personal')
        const r = on('personal') ? res('personal') : null
        if (on('personal') && staffRows.length) {
            const { data: before } = await supabase.from('staff_roster').select('name_key').eq('tenant_id', tenantId)
            const had = new Set((before ?? []).map(b => b.name_key))
            const { error } = await supabase.from('staff_roster').upsert(staffRows.map(s => ({
                tenant_id: tenantId, full_name: s.full, first_name: s.split.first_name, last_name_paternal: s.split.last_name_paternal, last_name_maternal: s.split.last_name_maternal || null,
                name_key: s.key, role_hint: s.roleHint, job_title: s.jobTitle ?? null, subjects: s.subjects, groups: s.groups, weekly_hours: s.hours ?? null,
                duties: s.duties.join('; ') || null, source: s.sources.join(' | ').slice(0, 500), updated_at: new Date().toISOString(),
            })), { onConflict: 'tenant_id,name_key' })
            if (error) r!.errors.push(error.message)
            else for (const s of staffRows) had.has(s.key) ? r!.updated++ : r!.created++
        }
        const { data: rows } = await supabase.from('staff_roster').select('id, name_key, full_name, profile_id').eq('tenant_id', tenantId)
        for (const row of rows ?? []) roster.set(row.name_key, { id: row.id, profile_id: row.profile_id })
        // Liga automáticamente a quien ya tiene cuenta en la escuela (mismo nombre)
        if (on('personal')) {
            const { data: members } = await supabase.rpc('school_staff')
            const list = ((members as any[]) ?? []).map(m => ({ id: m.profile_id as string, full: [m.first_name, m.last_name_paternal, m.last_name_maternal].filter(Boolean).join(' ') }))
            const taken = new Set((rows ?? []).map(r0 => r0.profile_id).filter(Boolean))
            for (const row of rows ?? []) {
                if (row.profile_id) continue
                const m = bestMatch(row.full_name, list.filter(x => !taken.has(x.id)), x => x.full, 0.9)
                if (!m) continue
                const { error } = await supabase.from('staff_roster').update({ profile_id: m.item.id }).eq('id', row.id)
                if (!error) { taken.add(m.item.id); roster.set(row.name_key, { id: row.id, profile_id: m.item.id }) }
            }
        }
    }

    // ── Materias y docentes por grupo
    if (on('materias')) {
        progress('materias'); const r = res('materias')
        const existing: { id: string; group_id: string; subject_catalog_id: string | null; custom_name: string | null; teacher_id: string | null; planned_roster_id: string | null }[] = []
        for (const ids of chunk(groupIds, 30)) {
            const { data } = await supabase.from('group_subjects').select('id, group_id, subject_catalog_id, custom_name, teacher_id, planned_roster_id').in('group_id', ids)
            existing.push(...(data ?? []))
        }
        const inserts: Record<string, unknown>[] = []
        for (const s of plan.subjects) {
            const gid = groupId.get(s.groupKey)
            if (!gid) { r.skipped++; continue }
            const cid = idForCatalog(s.catalogName) ?? otherId
            const ro = s.teacherKey ? roster.get(s.teacherKey) : undefined
            const found = existing.find(e => e.group_id === gid && catalogName.get(e.subject_catalog_id ?? '') === normName(s.catalogName) && normName(e.custom_name ?? '') === normName(s.customName ?? ''))
                ?? existing.find(e => e.group_id === gid && catalogName.get(e.subject_catalog_id ?? '') === normName(s.catalogName) && s.catalogName === 'TECNOLOGÍA')
            if (found) {
                const patch: Record<string, unknown> = {}
                if (!found.planned_roster_id && ro) patch.planned_roster_id = ro.id
                if (!found.teacher_id && ro?.profile_id) patch.teacher_id = ro.profile_id
                if (!found.custom_name && s.customName) patch.custom_name = s.customName
                if (Object.keys(patch).length) { const { error } = await supabase.from('group_subjects').update(patch).eq('id', found.id); if (error) r.errors.push(error.message); else r.updated++ }
                else r.skipped++
                continue
            }
            inserts.push({ tenant_id: tenantId, group_id: gid, subject_catalog_id: cid, custom_name: s.customName, planned_roster_id: ro?.id ?? null, teacher_id: ro?.profile_id ?? null })
        }
        for (const part of chunk(inserts, 100)) {
            const { error } = await supabase.from('group_subjects').insert(part)
            if (error) r.errors.push(error.message); else r.created += part.length
        }
    }

    // ── Horario de clases
    if (on('horario')) {
        progress('horario'); const r = res('horario')
        const byGroup = new Map<string, typeof plan.classes>()
        for (const c of plan.classes) byGroup.set(c.groupKey, [...(byGroup.get(c.groupKey) ?? []), c])
        const subjectOf = new Map(plan.subjects.map(s => [s.key, s]))
        for (const [gk, list] of byGroup) {
            const gid = groupId.get(gk)
            if (!gid) { r.skipped += list.length; continue }
            const { count } = await supabase.from('schedules').select('id', { count: 'exact', head: true }).eq('group_id', gid)
            if ((count ?? 0) > 0 && !opts.replaceSchedule) { r.skipped += list.length; continue }
            if ((count ?? 0) > 0) await supabase.from('schedules').delete().eq('group_id', gid)
            const rows = list.map(c => {
                const s = subjectOf.get(c.subjectKey)!
                const cid = idForCatalog(s.catalogName)
                const custom = s.catalogName === 'Otra Materia / Actividad' || !cid
                return { tenant_id: tenantId, group_id: gid, subject_id: custom ? null : cid, custom_subject: custom ? (s.customName ?? s.label) : null, day_of_week: c.day, start_time: hhmmss(c.start), end_time: hhmmss(c.end) }
            })
            const { error } = await supabase.from('schedules').insert(rows)
            if (error) r.errors.push(`${gk}: ${error.message}`); else r.created += rows.length
        }
    }

    // ── Comisiones
    if (on('comisiones')) {
        progress('comisiones'); const r = res('comisiones')
        for (const c of plan.commissions) {
            const members = c.members.map(m => ({ role: m.role, name: m.name, roster_id: m.staffKey ? roster.get(m.staffKey)?.id ?? null : null }))
            const { error } = await supabase.from('school_commissions').upsert({ tenant_id: tenantId, school_year: opts.schoolYear, name: c.name, members, source: 'Importación' }, { onConflict: 'tenant_id,school_year,name' })
            if (error) r.errors.push(error.message); else r.created++
        }
    }

    // ── Sesiones de CTE
    if (on('cte')) {
        progress('cte'); const r = res('cte')
        const { data: existing } = await supabase.from('cte_sessions').select('date, session_number, session_type').eq('tenant_id', tenantId).eq('school_year', opts.schoolYear)
        for (const s of plan.cte) {
            if ((existing ?? []).some(e => e.date === s.date || (e.session_type === 'ORDINARIA' && e.session_number === s.number))) { r.skipped++; continue }
            const { error } = await supabase.from('cte_sessions').insert({
                tenant_id: tenantId, school_year: opts.schoolYear, session_type: 'ORDINARIA', session_number: s.number, date: s.date,
                title: `${s.number}ª sesión ordinaria${s.note ? ` · ${s.note}` : ''}`, status: 'PLANNED', agenda: [],
            })
            if (error) r.errors.push(error.message); else r.created++
        }
    }

    // ── PEMC
    if (on('pemc') && (plan.pemc.objectives.length || plan.pemc.diagnosis.length)) {
        progress('pemc'); const r = res('pemc')
        const [y1, y2] = opts.schoolYear.split('-').map(Number)
        let { data: cycle } = await supabase.from('pemc_cycles').select('id').eq('tenant_id', tenantId).eq('start_year', y1).eq('end_year', y2).limit(1).maybeSingle()
        if (!cycle) {
            const { count } = await supabase.from('pemc_cycles').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('is_active', true)
            const ins = await supabase.from('pemc_cycles').insert({ tenant_id: tenantId, name: plan.pemc.title ? `PEMC ${opts.schoolYear} · ${plan.pemc.title}`.slice(0, 200) : `PEMC ${opts.schoolYear}`, start_year: y1, end_year: y2, is_active: !count }).select('id').single()
            if (ins.error) r.errors.push(ins.error.message)
            cycle = ins.data
        }
        if (cycle) {
            const { data: objs } = await supabase.from('pemc_objectives').select('description').eq('cycle_id', cycle.id)
            const had = new Set((objs ?? []).map(o => normName(o.description)))
            for (const o of plan.pemc.objectives) {
                if (had.has(normName(o.objective))) { r.skipped++; continue }
                const { data: obj, error } = await supabase.from('pemc_objectives').insert({ cycle_id: cycle.id, description: o.objective, goal: o.goal ?? null, area: o.area ?? null, problem: o.problem ?? null, indicator: o.indicator ?? null, source: o.source }).select('id').single()
                if (error || !obj) { r.errors.push(error?.message ?? 'No se pudo guardar un objetivo'); continue }
                r.created++
                if (o.actions.length) {
                    const { error: e2 } = await supabase.from('pemc_actions').insert(o.actions.map(a => ({
                        objective_id: obj.id, description: a.description, responsible_label: a.responsible ?? null, period_label: a.period ?? null,
                        resources: a.resources ?? null, stage: a.stage ?? null, progress_label: a.progress ?? null,
                        status: /100\s*%/.test(a.progress ?? '') ? 'COMPLETED' : 'PENDING',
                    })))
                    if (e2) r.errors.push(e2.message)
                }
            }
            // Diagnóstico: se agrupa por los campos que usa la pantalla del PEMC
            const byField = new Map<string, string[]>()
            for (const d of plan.pemc.diagnosis) { const f = nemFieldFor(d.area); byField.set(f, [...(byField.get(f) ?? []), `${d.area}\n${d.content}`]) }
            const { data: diag } = await supabase.from('pemc_diagnosis').select('id, field_name, content').eq('cycle_id', cycle.id)
            for (const f of NEM_FIELDS) {
                const text = byField.get(f)?.join('\n\n')
                if (!text) continue
                const cur = (diag ?? []).find(d => d.field_name === f)
                if (cur?.content?.trim()) { r.skipped++; continue }
                const { error } = cur ? await supabase.from('pemc_diagnosis').update({ content: text }).eq('id', cur.id) : await supabase.from('pemc_diagnosis').insert({ cycle_id: cycle.id, field_name: f, content: text })
                if (error) r.errors.push(error.message); else r.created++
            }
        }
    }

    // ── Antecedentes académicos
    if (on('antecedentes') && plan.history.length) {
        progress('antecedentes'); const r = res('antecedentes')
        const { data: prev } = await supabase.from('student_history').select('source').eq('tenant_id', tenantId)
        const done = new Set((prev ?? []).map(p => p.source))
        const rows = plan.history.filter(h => !done.has(h.source)).map(h => {
            const m = bestMatch(h.studentName, allStudents, s => s.full, 0.92)
            return { tenant_id: tenantId, student_id: m?.item.id ?? null, student_name: h.studentName, school_year: opts.historyYear, grade_group: h.groupKey ?? null, kind: h.kind, data: h.data, source: h.source }
        })
        r.skipped = plan.history.length - rows.length
        for (const part of chunk(rows, 200)) {
            const { error } = await supabase.from('student_history').insert(part)
            if (error) r.errors.push(error.message); else r.created += part.length
        }
    }

    onProgress('Listo', 100)
    return results
}
