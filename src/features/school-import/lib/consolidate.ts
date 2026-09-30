/**
 * Junta lo leído de todos los archivos en un solo plan: grupos con sus alumnos, tutores ligados a
 * cada alumno, plantilla de personal sin duplicados, materias y horario por grupo, jornada, CTE,
 * PEMC y antecedentes. También junta los avisos para que la escuela los revise antes de importar.
 */
import { formatPhone } from '../../../lib/phones'
import { TECH_SPECIALTIES, niceSubjectCase } from '../../../lib/subjectName'
import { bestMatch, cleanName, nameSimilarity, normName, splitGivenFirst, type SplitName } from './names'
import { cleanSubjectLabel, fromMin, isTechnology, toMin } from './parsers'
import type { Day, Extracted, Issue, PCommission, PCteSession, PHistory, PPemcDiagnosis, PPemcObjective, PStaff, PStudent, SchoolMeta } from './types'

export type PlanGroup = { key: string; grade: string; section: string; students: PStudent[]; technology?: string }
export type PlanGuardian = {
    groupKey: string; studentKey: string; studentFull: string
    tutorFull: string; tutor: SplitName
    phone: string | null; alt1: string | null; alt2: string | null
    extraPhones: string[]; score: number; note?: string; source: string
}
export type RoleHint = 'DIRECTOR' | 'ADMIN' | 'ACADEMIC_COORD' | 'TECH_COORD' | 'SCHOOL_CONTROL' | 'TEACHER' | 'PREFECT' | 'SUPPORT'
export type PlanStaff = {
    key: string; full: string; split: SplitName; roleHint: RoleHint; jobTitle?: string
    subjects: string[]; groups: string[]; hours?: number; duties: string[]; sources: string[]; inSchedule: boolean
    /** Motivo para sugerir no importarlo (p. ej., solo aparece en una lista de personal de otro ciclo). */
    doubt?: string
}
export type PlanSubject = { key: string; groupKey: string; label: string; catalogName: string; customName: string | null; teacherKey: string | null }
export type PlanClass = { groupKey: string; day: Day; start: string; end: string; subjectKey: string }
export type Jornada = { start: string; end: string; moduleMinutes: number; breaks: { name: string; start_time: string; end_time: string }[] }

export type Plan = {
    meta: SchoolMeta
    groups: PlanGroup[]
    guardians: PlanGuardian[]
    staff: PlanStaff[]
    subjects: PlanSubject[]
    classes: PlanClass[]
    jornada: Jornada | null
    commissions: (Omit<PCommission, 'members'> & { members: { role: string; name: string; staffKey: string | null }[] })[]
    cte: PCteSession[]
    pemc: { title?: string; objectives: PPemcObjective[]; diagnosis: PPemcDiagnosis[] }
    history: PHistory[]
    issues: Issue[]
    stats: { students: number; withGuardian: number; phone1: number; phone2: number; phone3: number; curp: number }
}

export const NEM_FIELDS = [
    'Aprovechamiento académico y asistencia de los alumnos',
    'Prácticas docentes y formación continua',
    'Infraestructura y equipamiento',
    'Carga administrativa',
    'Participación de la comunidad y padres de familia',
    'Contexto socioeducativo (Lectura de la Realidad)',
]
export function nemFieldFor(area: string): string {
    const a = normName(area)
    if (/APROVECHAMIENTO|ASISTENCIA|PLANES Y PROGRAMAS|AVANCE/.test(a)) return NEM_FIELDS[0]
    if (/PRACTICA|FORMACION DOCENTE|FORMACION CONTINUA/.test(a)) return NEM_FIELDS[1]
    if (/INFRAESTRUCTURA|EQUIPAMIENTO/.test(a)) return NEM_FIELDS[2]
    if (/CARGA ADMINISTRATIVA|AUTORIDAD/.test(a)) return NEM_FIELDS[3]
    if (/PARTICIPACION|COMUNIDAD|FAMILIA|PADRES/.test(a)) return NEM_FIELDS[4]
    return NEM_FIELDS[5]
}

const SUBJECTS: [RegExp, string][] = [
    [/^ESPANOL|^LENGUA MATERNA/, 'ESPAÑOL'],
    [/^INGLES|^LENGUA EXTRANJERA/, 'INGLES'],
    [/^MATEMATICAS/, 'MATEMÁTICAS'],
    [/^BIOLOGIA/, 'BIOLOGÍA'],
    [/^FISICA/, 'FÍSICA'],
    [/^QUIMICA/, 'QUÍMICA'],
    [/^GEOGRAFIA/, 'GEOGRAFÍA'],
    [/^HISTORIA/, 'HISTORIA'],
    [/^FORMACION CIVICA|^F C Y E|^FCYE|^FCE/, 'FORMACIÓN CÍVICA Y ÉTICA'],
    [/^EDUCACION FISICA/, 'EDUCACIÓN FÍSICA'],
    [/^ARTES?\b/, 'ARTES'],
    [/^TUTORIA/, 'TUTORÍA'],
    [/^AUTONOMIA/, 'AUTONOMÍA CURRICULAR'],
]

const titleCase = (s: string) => s.toLowerCase().split(' ').map(w => (w.length <= 4 && /^[a-z]+$/.test(w) && !['de', 'y', 'la', 'del', 'las', 'los', 'e'].includes(w) && w === w.replace(/[aeiou]/g, '') ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(' ')

/** "MATEMATICAS 1" → catálogo MATEMÁTICAS · "AGRICULTURA" → Tecnología - Agricultura · otra → Otra materia */
export function mapSubject(label: string): { catalogName: string; customName: string | null } {
    const clean = cleanSubjectLabel(label)
    for (const [re, name] of SUBJECTS) if (re.test(clean)) return { catalogName: name, customName: null }
    if (isTechnology(label)) {
        const spec = clean.replace(/^TECNOLOGIA\s*/, '').replace(/^P C I A$/, 'PCIA')
        const known = TECH_SPECIALTIES.find(t => { const k = normName(t); return k === spec || spec.startsWith(k) || k.startsWith(spec) })
        const nice = known ?? (spec.length <= 4 ? spec : titleCase(spec))
        return { catalogName: 'TECNOLOGÍA', customName: spec ? `Tecnología - ${nice}` : null }
    }
    return { catalogName: 'Otra Materia / Actividad', customName: titleCase(clean) }
}

export function roleFor(functionLabel = '', duties: string[] = [], hasSubjects = false): { role: RoleHint; jobTitle?: string } {
    const f = normName(functionLabel)
    if (/^SUBDIREC/.test(f)) return { role: 'DIRECTOR', jobTitle: 'Subdirector(a)' }
    if (/^DIREC/.test(f)) return { role: 'DIRECTOR', jobTitle: 'Director(a)' }
    if (/COORDINACION ACADEMICA|COORD ACAD|ACTIVIDADES ACADEMICAS/.test(f)) return { role: 'ACADEMIC_COORD', jobTitle: 'Coordinación académica' }
    if (/COORDINACION TECNOLOG|ACTIVIDADES TECNOLOG/.test(f)) return { role: 'TECH_COORD', jobTitle: 'Coordinación de tecnologías' }
    if (/CONTROL ESCOLAR|SECRETARI|ADMINISTRATIV|CONTRALOR/.test(f)) return { role: 'SCHOOL_CONTROL', jobTitle: titleCase(f) }
    if (/PREFECT/.test(f)) return { role: 'PREFECT', jobTitle: 'Prefectura' }
    if (/TRABAJO SOCIAL|TRABAJADORA SOCIAL|USAER|ORIENTA|PSICOLOG|MEDIC|ENFERMER/.test(f)) return { role: 'SUPPORT', jobTitle: titleCase(f) }
    if (/INTENDEN|VELADOR|CONSERJE|MANTENIMIENTO|LABORATORIST|BIBLIOTEC|APOYO/.test(f)) return { role: 'SUPPORT', jobTitle: titleCase(f) }
    void hasSubjects; void duties
    return { role: 'TEACHER' }
}

function mergeMeta(list: SchoolMeta[], issues: Issue[]): SchoolMeta {
    const out: SchoolMeta = {}
    for (const k of ['schoolName', 'cct', 'zone', 'cycle', 'shift', 'location', 'director'] as (keyof SchoolMeta)[]) {
        const counts = new Map<string, number>()
        for (const m of list) { const v = m[k]?.trim(); if (v) counts.set(v.toUpperCase(), (counts.get(v.toUpperCase()) ?? 0) + 1) }
        const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
        if (sorted.length) out[k] = list.find(m => m[k]?.trim().toUpperCase() === sorted[0][0])?.[k]?.trim()
        if (sorted.length > 1 && (k === 'cct' || k === 'zone')) {
            issues.push({ severity: 'warning', area: 'Escuela', message: `Los archivos no coinciden en ${k === 'cct' ? 'la CCT' : 'la zona escolar'}: ${sorted.map(s => `${s[0]} (${s[1]})`).join(' y ')}. Se tomó ${sorted[0][0]}.` })
        }
    }
    return out
}

export function consolidate(ex: Extracted): Plan {
    const issues: Issue[] = [...ex.issues]
    const meta = mergeMeta(ex.meta, issues)

    // ── Grupos y alumnos (sin repetir)
    const groupsMap = new Map<string, PlanGroup>()
    for (const s of ex.students) {
        const g = groupsMap.get(s.groupKey) ?? { key: s.groupKey, grade: s.groupKey[0], section: s.groupKey.slice(1), students: [] }
        const same = g.students.find(x => normName(x.full) === normName(s.full))
            ?? (s.curp ? bestMatch(s.full, g.students, x => x.full, 0.9)?.item : undefined)
        if (!same) g.students.push(s)
        else { if (s.curp && !same.curp) same.curp = s.curp; if (!same.gender && s.gender) same.gender = s.gender }
        groupsMap.set(s.groupKey, g)
    }
    for (const info of ex.groupInfo) { const g = groupsMap.get(info.groupKey); if (g && info.technology) g.technology = info.technology }
    const groups = [...groupsMap.values()].sort((a, b) => a.key.localeCompare(b.key))
    for (const g of groups) {
        const noGender = g.students.filter(s => !s.gender).length
        if (noGender) issues.push({ severity: 'info', area: 'Alumnos', message: `${g.key}: ${noGender} alumno(s) sin sexo indicado.` })
    }

    // ── Tutores: se liga cada renglón del directorio con su alumno
    const guardians: PlanGuardian[] = []
    const matched = new Set<string>()
    for (const row of ex.guardians) {
        const g = groupsMap.get(row.groupKey)
        const pool = g?.students ?? []
        let student = pool.find(s => normName(s.full) === normName(row.studentFull))
        let score = student ? 1 : 0
        if (!student) {
            const m = bestMatch(row.studentFull, pool, s => s.full, 0.84)
            if (m) { student = m.item; score = m.score }
        }
        if (!student) {
            issues.push({ severity: 'warning', area: 'Tutores', message: `${row.groupKey}: "${row.studentFull}" aparece en el directorio pero no en la lista del grupo. Su tutor no se importará.`, source: row.source })
            continue
        }
        if (score < 1) issues.push({ severity: 'info', area: 'Tutores', message: `${row.groupKey}: se ligó "${row.studentFull}" (directorio) con "${student.full}" (lista).`, source: row.source })
        const key = `${student.groupKey}|${normName(student.full)}`
        if (matched.has(key)) { issues.push({ severity: 'info', area: 'Tutores', message: `${row.groupKey}: "${student.full}" aparece dos veces en el directorio; se usó el primero.`, source: row.source }); continue }
        matched.add(key)
        const [phone = null, alt1 = null, alt2 = null, ...extra] = row.phones
        if (row.badPhones.length) issues.push({ severity: 'warning', area: 'Teléfonos', message: `${row.groupKey} · ${student.full}: número(s) incompleto(s) o de otro país: ${row.badPhones.join(', ')}.`, source: row.source })
        if (row.note) issues.push({ severity: 'warning', area: 'Alumnos', message: `${row.groupKey} · ${student.full}: nota en el directorio: "${row.note}".`, source: row.source })
        guardians.push({
            groupKey: student.groupKey, studentKey: normName(student.full), studentFull: student.full,
            tutorFull: row.tutorFull, tutor: splitGivenFirst(row.tutorFull), phone, alt1, alt2, extraPhones: extra, score, note: row.note, source: row.source,
        })
    }
    const guardianGroups = new Set(ex.guardians.map(g => g.groupKey))
    for (const g of groups) {
        const missing = g.students.filter(s => !matched.has(`${g.key}|${normName(s.full)}`)).length
        if (!guardianGroups.has(g.key)) issues.push({ severity: 'warning', area: 'Tutores', message: `${g.key}: no se recibió directorio de padres. Faltan tutor y teléfonos de ${g.students.length} alumnos.` })
        else if (missing) issues.push({ severity: 'warning', area: 'Tutores', message: `${g.key}: ${missing} alumno(s) sin tutor en el directorio.` })
    }
    const noPhone = guardians.filter(g => !g.phone).length
    if (noPhone) issues.push({ severity: 'warning', area: 'Teléfonos', message: `${noPhone} tutor(es) sin ningún teléfono válido de 10 dígitos.` })

    // ── Personal: se juntan las menciones de la misma persona en todos los archivos
    const scheduleTeachers = new Set(ex.classes.map(c => normName(c.teacher)).filter(Boolean))
    const raw: PStaff[] = [
        ...ex.staff,
        ...[...new Set(ex.classes.map(c => c.teacher).filter(t => normName(t).split(' ').length >= 2))].map(t => ({ full: cleanName(t), subjects: [], groups: [], duties: [], sources: [ex.classes.find(c => c.teacher === t)!.source] })),
        ...ex.groupInfo.flatMap(i => i.advisors.map(a => ({ full: cleanName(a), subjects: [], groups: [], duties: [`Asesor(a) de ${i.groupKey}`], sources: ['Asesores por grupo'] }))),
    ]
    const clusters: { names: string[]; items: typeof raw }[] = []
    for (const s of raw) {
        const c = clusters.find(cl => cl.names.some(n => nameSimilarity(n, s.full) >= 0.88))
        if (c) { c.names.push(s.full); c.items.push(s) } else clusters.push({ names: [s.full], items: [s] })
    }
    const staff: PlanStaff[] = clusters.map(cl => {
        // Nombre: el más completo, de preferencia como aparece en el horario
        const inSched = cl.names.filter(n => scheduleTeachers.has(normName(n)))
        const full = [...cl.names].sort((a, b) => b.split(' ').length - a.split(' ').length || Number(inSched.includes(b)) - Number(inSched.includes(a)) || b.length - a.length)[0]
        const fn = cl.items.map(i => i.functionLabel).find(Boolean)
        const subjects = [...new Set(cl.items.flatMap(i => i.subjects).map(s => s.trim()).filter(Boolean))]
        const groupsOf = [...new Set(cl.items.flatMap(i => i.groups))].sort()
        const duties = [...new Set(cl.items.flatMap(i => i.duties))]
        const { role, jobTitle } = roleFor(fn, duties, subjects.length > 0)
        if (role === 'TEACHER' && fn && !subjects.length && !/DOCENTE/.test(normName(fn))) subjects.push(fn)
        return {
            key: normName(full), full, split: splitGivenFirst(full), roleHint: role, jobTitle,
            subjects, groups: groupsOf, hours: Math.max(0, ...cl.items.map(i => i.hours ?? 0)) || undefined,
            duties, sources: [...new Set(cl.items.flatMap(i => i.sources))], inSchedule: inSched.length > 0,
        }
    }).sort((a, b) => a.full.localeCompare(b.full))
    // El director que dicen los documentos del ciclo manda sobre la hoja de personal
    const docDirector = meta.director ? bestMatch(meta.director, staff, s => s.full, 0.7)?.item : undefined
    if (docDirector) { docDirector.roleHint = 'DIRECTOR'; docDirector.jobTitle = 'Director(a)' }
    const onlySheets = (s: PlanStaff) => s.sources.every(src => / PERSONAL$| DOCENTES$|^Asesores/.test(src))
    for (const s of staff) {
        if (docDirector && s !== docDirector && s.jobTitle === 'Director(a)') s.doubt = `Los documentos del ciclo dicen que el director es ${docDirector.full}; esta persona solo aparece como director en una lista de personal.`
        else if (!s.inSchedule && s.roleHint === 'TEACHER' && onlySheets(s)) s.doubt = 'Aparece en la lista de personal, pero no en el horario de este ciclo.'
    }
    const directors = staff.filter(s => s.jobTitle === 'Director(a)')
    if (directors.length > 1) issues.push({ severity: 'warning', area: 'Personal', message: `Hay ${directors.length} directores en los archivos: ${directors.map(d => `${d.full} (${d.sources[0]})`).join(' y ')}. Revisa cuál lista de personal es la del ciclo actual.` })
    const doubtful = staff.filter(s => s.doubt)
    if (doubtful.length) issues.push({ severity: 'warning', area: 'Personal', message: `${doubtful.length} persona(s) de la lista de personal podrían ser de otro ciclo (no aparecen en el horario ni en los documentos de este ciclo). Se dejaron sin marcar; márcalas si sí trabajan en la escuela.` })
    const staffKeyOf = (name: string) => {
        if (!name) return null
        const exact = staff.find(s => s.key === normName(name))
        return exact?.key ?? bestMatch(name, staff, s => s.full, 0.88)?.item.key ?? null
    }

    // ── Materias por grupo (con el docente que las da) y horario
    const subjMap = new Map<string, PlanSubject & { teachers: Map<string, number> }>()
    for (const c of ex.classes) {
        const { catalogName, customName } = mapSubject(c.subject)
        const key = `${c.groupKey}|${catalogName}|${customName ?? ''}`
        const e = subjMap.get(key) ?? { key, groupKey: c.groupKey, label: c.subject, catalogName, customName, teacherKey: null, teachers: new Map() }
        const tk = staffKeyOf(c.teacher)
        if (tk) e.teachers.set(tk, (e.teachers.get(tk) ?? 0) + 1)
        subjMap.set(key, e)
    }
    const subjects: PlanSubject[] = [...subjMap.values()].map(({ teachers, ...s }) => {
        const sorted = [...teachers.entries()].sort((a, b) => b[1] - a[1])
        if (sorted.length > 1) issues.push({ severity: 'info', area: 'Materias', message: `${s.groupKey} · ${s.customName ?? s.catalogName}: la dan ${sorted.length} docentes; se asignó a quien tiene más horas.` })
        return { ...s, teacherKey: sorted[0]?.[0] ?? null }
    }).sort((a, b) => a.key.localeCompare(b.key))
    // Lo que cada docente da según el horario (completa su ficha aunque no venga la carga horaria)
    for (const s of subjects) {
        const st = s.teacherKey ? staff.find(x => x.key === s.teacherKey) : undefined
        if (!st) continue
        const label = s.customName ?? niceSubjectCase(s.catalogName).replace(/^Ingles$/, 'Inglés')
        if (!st.subjects.some(x => normName(x) === normName(label) || normName(label).includes(normName(x)))) st.subjects.push(label)
        if (!st.groups.includes(s.groupKey)) st.groups.push(s.groupKey)
    }
    for (const st of staff) st.groups.sort()
    for (const g of groups) {
        const tech = subjects.find(s => s.groupKey === g.key && s.catalogName === 'TECNOLOGÍA')
        if (g.technology && tech) {
            const fromTotals = normName(g.technology).replace(/\s/g, '').slice(0, 4)
            if (!normName(tech.customName ?? '').replace(/\s/g, '').includes(fromTotals)) {
                issues.push({ severity: 'info', area: 'Materias', message: `${g.key}: la tabla de totales dice tecnología "${g.technology}" y el horario "${tech.customName}". Se usó la del horario.` })
            }
        }
    }
    const scheduleGroups = new Set(ex.classes.map(c => c.groupKey))
    for (const g of groups) if (!scheduleGroups.has(g.key)) issues.push({ severity: 'info', area: 'Horario', message: `${g.key}: no se recibió su horario.` })
    const classes: PlanClass[] = ex.classes.map(c => {
        const { catalogName, customName } = mapSubject(c.subject)
        return { groupKey: c.groupKey, day: c.day, start: c.start, end: c.end, subjectKey: `${c.groupKey}|${catalogName}|${customName ?? ''}` }
    })

    // ── Jornada
    let jornada: Jornada | null = null
    const lessons = ex.slots.filter(s => !s.isBreak)
    if (lessons.length) {
        const durations = lessons.map(l => toMin(l.end) - toMin(l.start))
        const mode = [...durations].sort((a, b) => durations.filter(d => d === b).length - durations.filter(d => d === a).length)[0]
        const uniqBreaks = [...new Map(ex.slots.filter(s => s.isBreak).map(b => [`${b.start}-${b.end}`, b])).values()]
        jornada = {
            start: fromMin(Math.min(...lessons.map(l => toMin(l.start)))),
            end: fromMin(Math.max(...lessons.map(l => toMin(l.end)))),
            moduleMinutes: mode,
            breaks: uniqBreaks.map((b, i) => ({ name: uniqBreaks.length > 1 ? `Receso ${i + 1}` : 'Receso', start_time: b.start, end_time: b.end })),
        }
    }

    // ── Comisiones, CTE, PEMC, antecedentes
    const commissions = ex.commissions.map(c => ({ ...c, members: c.members.map(m => ({ ...m, staffKey: staffKeyOf(m.name) })) }))
    const cte = [...new Map(ex.cte.map(s => [s.date, s])).values()].sort((a, b) => a.date.localeCompare(b.date))
    const objectives = [...new Map(ex.pemcObjectives.map(o => [normName(o.objective) + '|' + normName(o.area ?? ''), o])).values()]

    // ── Totales de contacto
    const students = groups.reduce((n, g) => n + g.students.length, 0)
    const stats = {
        students,
        withGuardian: guardians.length,
        phone1: guardians.filter(g => g.phone).length,
        phone2: guardians.filter(g => g.alt1).length,
        phone3: guardians.filter(g => g.alt2).length,
        curp: groups.reduce((n, g) => n + g.students.filter(s => s.curp).length, 0),
    }
    if (students && stats.curp < students) issues.push({ severity: 'info', area: 'Alumnos', message: `${students - stats.curp} de ${students} alumnos no traen CURP. Súbela con la exportación del sistema de control escolar (columnas grado, grupo, nombre y CURP) o captúrala en el expediente.` })
    if (students && stats.phone1 < students) issues.push({ severity: 'warning', area: 'Teléfonos', message: `${students - stats.phone1} de ${students} alumnos quedan sin teléfono principal del tutor. Las familias pueden completarlo al ligar su cuenta, o control escolar en el expediente.` })

    return {
        meta, groups, guardians, staff, subjects, classes, jornada, commissions, cte,
        pemc: { title: ex.pemcTitle, objectives, diagnosis: ex.pemcDiagnosis }, history: ex.history, issues, stats,
    }
}

export const phoneText = (p: string | null) => (p ? formatPhone(p) : '—')
