import { formatSubjectName } from '../../../lib/subjectName'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { useProfile } from '../../../hooks/useProfile'
import { useTenant } from '../../../hooks/useTenant'
import { CAMPOS_FORMATIVOS, phaseFor } from '../../../lib/nemCatalog'

/**
 * Alcance curricular del docente para el Programa Analítico.
 *
 * Regla central: el programa se construye SOLO con las disciplinas que imparte el docente
 * (profile_subjects) y SOLO con el campo formativo que corresponde a cada una. En primaria y
 * preescolar el docente frente a grupo atiende los cuatro campos, así que ahí el alcance es
 * completo (salvo que haya registrado materias específicas, p. ej. Educación Física).
 */

export type Campo = typeof CAMPOS_FORMATIVOS[number]

/** Llaves cortas que usan el editor, el PDF y la planeación (program_by_fields). */
export const FIELD_KEY: Record<Campo, 'lenguajes' | 'saberes' | 'etica' | 'humano'> = {
    'Lenguajes': 'lenguajes',
    'Saberes y Pensamiento Científico': 'saberes',
    'Ética, Naturaleza y Sociedades': 'etica',
    'De lo Humano y lo Comunitario': 'humano',
}
export const FIELD_LABEL: Record<string, Campo> = Object.fromEntries(
    Object.entries(FIELD_KEY).map(([label, key]) => [key, label as Campo]),
) as Record<string, Campo>

/** Metodología sociocrítica que el Plan 2022 sugiere para cada campo. */
export const FIELD_METHODOLOGY: Record<Campo, string> = {
    'Lenguajes': 'Aprendizaje basado en proyectos comunitarios',
    'Saberes y Pensamiento Científico': 'Aprendizaje basado en indagación (enfoque STEAM)',
    'Ética, Naturaleza y Sociedades': 'Aprendizaje basado en problemas (ABP)',
    'De lo Humano y lo Comunitario': 'Aprendizaje servicio (AS)',
}

const stripAccents = (s: string) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export const normalizeText = (s: string) =>
    String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim()

/** Normaliza el nombre de un campo formativo a su forma oficial (acepta llaves cortas o variantes). */
export function toCampo(value?: string | null): Campo | null {
    if (!value) return null
    if (FIELD_LABEL[value]) return FIELD_LABEL[value]
    const n = normalizeText(value)
    if (n.startsWith('lenguaje')) return 'Lenguajes'
    if (n.startsWith('saberes')) return 'Saberes y Pensamiento Científico'
    if (n.startsWith('etica')) return 'Ética, Naturaleza y Sociedades'
    if (n.includes('humano') || n.includes('comunitario')) return 'De lo Humano y lo Comunitario'
    return null
}

// Palabras que no distinguen una disciplina de otra (evitan cruces como "Educación Física" ↔ "Educación Socioemocional")
const STOP = new Set(['educacion', 'lengua', 'materna', 'segunda', 'antes', 'como', 'vida', 'saludable', 'extranjera', 'otra', 'materia', 'actividad', 'de', 'la', 'el', 'los', 'las', 'y', 'del'])
const keywords = (s: string) => normalizeText(s).split(' ').filter(w => w.length >= 4 && !STOP.has(w))

/** ¿La materia registrada por el docente es la misma disciplina que la del catálogo oficial? */
export function sameDiscipline(teacherSubject: string, officialSubject: string, teacherField?: Campo | null, officialField?: Campo | null) {
    if (teacherField && officialField && teacherField !== officialField) return false
    const a = keywords(teacherSubject), b = new Set(keywords(officialSubject))
    return a.some(w => b.has(w))
}

/** name = materia del catálogo (para cruzar con los PDA oficiales); label = cómo se muestra (con especialidad). */
export interface TeacherSubject { name: string; field: Campo | null; specialty?: string; label?: string }

export interface TeacherScope {
    level: string                  // PRIMARY | SECONDARY | TELESECUNDARIA | PRESCHOOL…
    levelLabel: string             // Primaria, Secundaria…
    phase: number | null
    subjects: TeacherSubject[]     // disciplinas que imparte (vacío = generalista)
    fields: Campo[]                // campos formativos permitidos
    grades: number[]               // grados que atiende
    generalist: boolean            // primaria/preescolar sin materias específicas
    missingSubjects: boolean       // secundaria sin materias registradas: no se puede generar
}

const LEVEL_LABEL: Record<string, string> = { PRIMARY: 'Primaria', SECONDARY: 'Secundaria', TELESECUNDARIA: 'Telesecundaria', PRESCHOOL: 'Preescolar', HIGH_SCHOOL: 'Preparatoria' }

export function useTeacherScope() {
    const { profile } = useProfile()
    const { data: tenant } = useTenant()
    const profileId = (profile as any)?.id as string | undefined
    const tenantId = tenant?.id

    return useQuery({
        queryKey: ['teacher-scope', profileId, tenantId],
        enabled: !!profileId && !!tenantId,
        staleTime: 5 * 60_000,
        queryFn: async (): Promise<TeacherScope> => {
            const level = String(tenant?.educationalLevel ?? 'SECONDARY').toUpperCase()
            const secondaryLike = level === 'SECONDARY' || level === 'TELESECUNDARIA'

            const [{ data: ps }, { data: gs }] = await Promise.all([
                supabase.from('profile_subjects').select('custom_detail, subject_catalog(name, field_of_study)').eq('profile_id', profileId!).eq('tenant_id', tenantId!),
                supabase.from('group_subjects').select('groups(grade, archived_at)').eq('teacher_id', profileId!).eq('tenant_id', tenantId!),
            ])

            const subjects: TeacherSubject[] = []
            for (const row of (ps ?? []) as any[]) {
                const sc = Array.isArray(row.subject_catalog) ? row.subject_catalog[0] : row.subject_catalog
                const specialty = (row.custom_detail || '').trim()
                // Con materia de catálogo, el nombre es el oficial (Tecnología) y la especialidad va aparte (Informática)
                const name = (sc?.name || specialty).trim()
                if (!name) continue
                const field = toCampo(sc?.field_of_study)
                const label = sc?.name ? formatSubjectName(sc.name, specialty) : name
                if (!subjects.some(s => normalizeText(s.name) === normalizeText(name))) subjects.push({ name, field, specialty: sc?.name ? specialty || undefined : undefined, label })
            }

            let grades = [...new Set(((gs ?? []) as any[])
                .map(r => Array.isArray(r.groups) ? r.groups[0] : r.groups)
                .filter(g => g && !g.archived_at && g.grade)
                .map(g => Number(g.grade)))].sort()
            if (!grades.length && (tenant as any)?.grade) grades = [Number((tenant as any).grade)]
            if (!grades.length) grades = secondaryLike ? [1, 2, 3] : level === 'PRIMARY' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3]

            const withField = subjects.filter(s => s.field)
            const generalist = !secondaryLike && withField.length === 0
            const fields: Campo[] = generalist
                ? [...CAMPOS_FORMATIVOS]
                : CAMPOS_FORMATIVOS.filter(c => withField.some(s => s.field === c))

            return {
                level,
                levelLabel: LEVEL_LABEL[level] ?? level,
                phase: phaseFor(level, grades[0] ?? null),
                subjects: withField,
                fields,
                grades,
                generalist,
                missingSubjects: secondaryLike && withField.length === 0,
            }
        },
    })
}

export interface ScopedContent {
    id: string                      // clave estable: campo|materia|contenido
    field_of_study: Campo
    subject_name: string | null
    content: string
    pdas: Record<number, string>    // PDA oficial por grado
}

/** Catálogo oficial (official_pdas) filtrado estrictamente al alcance del docente. */
export async function loadScopedCatalog(scope: TeacherScope): Promise<ScopedContent[]> {
    // Primaria abarca fases 3 a 5 según el grado: se consultan todas las fases de los grados que atiende
    const phases = scope.level === 'PRIMARY'
        ? [...new Set(scope.grades.map(g => phaseFor('PRIMARY', g)).filter(Boolean) as number[])]
        : [scope.phase ?? 6]

    const { data, error } = await supabase
        .from('official_pdas')
        .select('field_of_study, subject_name, content, grade, pda')
        .in('phase', phases)
        .limit(5000)
    if (error) throw error

    const map = new Map<string, ScopedContent>()
    for (const r of (data ?? []) as any[]) {
        const field = toCampo(r.field_of_study)
        if (!field || !scope.fields.includes(field)) continue
        if (r.grade && !scope.grades.includes(Number(r.grade))) continue
        if (!scope.generalist) {
            // Secundaria (o primaria con materias específicas): solo las disciplinas registradas
            const ok = r.subject_name
                ? scope.subjects.some(s => sameDiscipline(s.name, r.subject_name, s.field, field))
                : scope.subjects.some(s => s.field === field) && scope.level !== 'SECONDARY' && scope.level !== 'TELESECUNDARIA'
            if (!ok) continue
        }
        const id = `${FIELD_KEY[field]}|${r.subject_name ?? ''}|${normalizeText(r.content).slice(0, 80)}`
        const item: ScopedContent = map.get(id) ?? { id, field_of_study: field, subject_name: r.subject_name ?? null, content: r.content, pdas: {} as Record<number, string> }
        const g = Number(r.grade) || scope.grades[0]
        if (r.pda && !item.pdas[g]) item.pdas[g] = r.pda
        map.set(id, item)
    }
    return [...map.values()]
}

/**
 * Revisión final del alcance: detecta menciones a campos formativos o disciplinas
 * que NO corresponden al docente dentro de un texto generado.
 */
export function findOutOfScopeMentions(text: string, scope: TeacherScope): string[] {
    if (!text || scope.generalist) return []
    const n = ' ' + normalizeText(text) + ' '
    const hits: string[] = []
    for (const c of CAMPOS_FORMATIVOS) {
        if (scope.fields.includes(c)) continue
        if (n.includes(' ' + normalizeText(c) + ' ')) hits.push(c)
    }
    // Disciplinas: se buscan como nombre propio (con mayúscula) para no confundir palabras comunes
    // como "historia de la comunidad" o "actividad física".
    const plain = stripAccents(text).replace(/Educacion Fisica|[Aa]ctividad fisica|[Cc]ondicion fisica/g, ' ')
    const others = ['Español', 'Matemáticas', 'Inglés', 'Artes', 'Biología', 'Física', 'Química', 'Historia', 'Geografía', 'Formación Cívica y Ética', 'Educación Física', 'Tecnología', 'Tutoría']
    for (const o of others) {
        if (scope.subjects.some(s => sameDiscipline(s.name, o))) continue
        const src = o === 'Educación Física' ? stripAccents(text) : plain
        if (new RegExp(`(^|[^A-Za-z])${stripAccents(o)}([^A-Za-z]|$)`).test(src)) hits.push(o)
    }
    return [...new Set(hits)]
}

/** Alcance limitado a un solo campo formativo (cada campo tiene su propio programa analítico). */
export function restrictScope(scope: TeacherScope | undefined, field: Campo | null): TeacherScope | undefined {
    if (!scope || !field) return scope
    return {
        ...scope,
        fields: scope.fields.includes(field) ? [field] : [],
        subjects: scope.subjects.filter(s => s.field === field),
    }
}
