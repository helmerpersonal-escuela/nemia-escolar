import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import { aiGenerate } from './aiClient'
import { useTenant } from '../hooks/useTenant'

/**
 * Formatos de la escuela o del docente. Un formato se describe con una "especificación"
 * (encabezado, secciones, tablas y firmas) que la IA obtiene del archivo que sube el docente
 * o propone según los lineamientos de la SEP. Los resultados se generan llenando esa estructura.
 */

export type FormatKind = 'PLANEACION' | 'INSTRUMENTO' | 'REPORTE' | 'OTRO'

export const FORMAT_KINDS: { id: FormatKind, label: string, hint: string }[] = [
    { id: 'PLANEACION', label: 'Planeación didáctica', hint: 'Proyecto, secuencia o plan de clase' },
    { id: 'INSTRUMENTO', label: 'Instrumento de evaluación', hint: 'Rúbrica, lista de cotejo, guía de observación…' },
    { id: 'REPORTE', label: 'Reporte o informe', hint: 'Informe al tutor, reporte de conducta, bitácora…' },
    { id: 'OTRO', label: 'Otro', hint: 'Cualquier otro documento de la escuela' },
]

export type HeaderSource = 'escuela' | 'cct' | 'docente' | 'grupo' | 'grado' | 'materia' | 'campo' | 'periodo' | 'fecha' | 'ciclo' | 'alumno' | null

export interface FormatSection {
    title: string
    type: 'text' | 'list' | 'table'
    columns?: string[]
    guidance?: string
}

export interface FormatSpec {
    title: string
    orientation?: 'portrait' | 'landscape'
    header_fields: { label: string, source?: HeaderSource }[]
    sections: FormatSection[]
    signatures?: string[]
    notes?: string
}

export interface TeacherFormat {
    id: string
    tenant_id: string
    created_by: string
    kind: FormatKind
    scope: 'PERSONAL' | 'SCHOOL'
    source: 'UPLOAD' | 'AI'
    name: string
    file_path: string | null
    file_name: string | null
    spec: FormatSpec
    is_default: boolean
    updated_at: string
}

/** Contenido ya llenado de un formato. */
export interface FilledFormat {
    header: Record<string, string>
    sections: { title: string, text?: string, items?: string[], rows?: string[][] }[]
}

const SPEC_SHAPE = `{"title":"...","orientation":"portrait|landscape","header_fields":[{"label":"Escuela","source":"escuela|cct|docente|grupo|grado|materia|campo|periodo|fecha|ciclo|alumno|null"}],"sections":[{"title":"...","type":"text|list|table","columns":["solo si type=table"],"guidance":"qué va en esta sección"}],"signatures":["Docente","Dirección"],"notes":"..."}`

function parseJson<T>(raw: string): T {
    try { return JSON.parse(raw) } catch { return JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) }
}

function normalizeSpec(s: Partial<FormatSpec>, fallbackTitle: string): FormatSpec {
    return {
        title: String(s.title || fallbackTitle).slice(0, 160),
        orientation: s.orientation === 'landscape' ? 'landscape' : 'portrait',
        header_fields: (s.header_fields ?? []).filter(h => h?.label).slice(0, 20).map(h => ({ label: String(h.label).slice(0, 80), source: (h.source ?? null) as HeaderSource })),
        sections: (s.sections ?? []).filter(x => x?.title).slice(0, 30).map(x => ({
            title: String(x.title).slice(0, 160),
            type: x.type === 'table' || x.type === 'list' ? x.type : 'text',
            columns: x.type === 'table' ? (x.columns ?? []).map(String).slice(0, 10) : undefined,
            guidance: x.guidance ? String(x.guidance).slice(0, 400) : undefined,
        })),
        signatures: (s.signatures ?? []).map(String).slice(0, 6),
        notes: s.notes ? String(s.notes).slice(0, 600) : undefined,
    }
}

/** Analiza el texto de un formato subido y devuelve su estructura. */
export async function analyzeFormat(text: string, kind: FormatKind, fileName: string): Promise<FormatSpec> {
    const prompt = `Analiza este formato escolar (${FORMAT_KINDS.find(k => k.id === kind)?.label}) que usa una escuela de México y describe su ESTRUCTURA para poder llenarlo después exactamente igual.
Identifica: título, datos del encabezado (y de dónde se obtiene cada uno), secciones en el mismo orden y con los mismos nombres, cuáles son tablas y sus columnas exactas, y las firmas al final.
No inventes secciones que no estén. Conserva la redacción de los títulos del formato.
Devuelve SOLO JSON con esta forma: ${SPEC_SHAPE}

Archivo: ${fileName}
TEXTO DEL FORMATO:
${text.slice(0, 20000)}`
    const raw = await aiGenerate(prompt, true)
    return normalizeSpec(parseJson<Partial<FormatSpec>>(raw), fileName.replace(/\.[^.]+$/, ''))
}

/** La IA propone un formato de acuerdo con los lineamientos de la SEP (NEM). */
export async function proposeFormat(kind: FormatKind, context: { level?: string | null, extra?: string }): Promise<FormatSpec> {
    const label = FORMAT_KINDS.find(k => k.id === kind)?.label
    const prompt = `Propón un formato de "${label}" para docentes de ${context.level || 'educación básica'} en México, apegado a los lineamientos vigentes de la SEP y la Nueva Escuela Mexicana (Plan de Estudio 2022, Programas Sintéticos 2024, evaluación formativa).
Debe ser práctico, de una o dos páginas, con los datos de identificación que pide la autoridad educativa y las secciones que un supervisor espera ver (por ejemplo: campo formativo, contenido, PDA, ejes articuladores, metodología, secuencia didáctica, evaluación formativa, ajustes razonables).
${context.extra ? `Indicaciones del docente: ${context.extra}\n` : ''}Devuelve SOLO JSON con esta forma: ${SPEC_SHAPE}`
    const raw = await aiGenerate(prompt, true)
    return normalizeSpec(parseJson<Partial<FormatSpec>>(raw), label ?? 'Formato')
}

/** Llena un formato con el material (datos de la planeación, instrumento, etc.). */
export async function fillFormat(spec: FormatSpec, material: string, known: Partial<Record<Exclude<HeaderSource, null>, string>> = {}): Promise<FilledFormat> {
    const prompt = `Llena el siguiente formato escolar con la información proporcionada. Respeta EXACTAMENTE las secciones, su orden, los encabezados y las columnas de las tablas.
Usa la información disponible; si una sección no tiene datos suficientes, redacta una propuesta breve y coherente con la Nueva Escuela Mexicana (no dejes secciones vacías). No agregues secciones nuevas.
FORMATO: ${JSON.stringify(spec)}
DATOS CONOCIDOS DEL ENCABEZADO: ${JSON.stringify(known)}
INFORMACIÓN:
${material.slice(0, 25000)}
Devuelve SOLO JSON: {"header":{"<etiqueta>":"valor"},"sections":[{"title":"<título igual al formato>","text":"si es text","items":["si es list"],"rows":[["celda por columna"]]}]}`
    const raw = await aiGenerate(prompt, true)
    const out = parseJson<FilledFormat>(raw)
    // Encabezado: lo conocido tiene prioridad sobre lo que proponga la IA
    const header: Record<string, string> = { ...(out.header ?? {}) }
    for (const h of spec.header_fields) if (h.source && known[h.source]) header[h.label] = known[h.source]!
    return { header, sections: Array.isArray(out.sections) ? out.sections : [] }
}

export function useFormats(kind?: FormatKind) {
    const { data: tenant } = useTenant()
    return useQuery({
        queryKey: ['teacher-formats', tenant?.id, kind ?? 'ALL'],
        enabled: !!tenant?.id,
        queryFn: async (): Promise<TeacherFormat[]> => {
            let q = supabase.from('teacher_formats').select('*').eq('tenant_id', tenant!.id).order('is_default', { ascending: false }).order('updated_at', { ascending: false })
            if (kind) q = q.eq('kind', kind)
            const { data, error } = await q
            if (error) throw error
            return (data ?? []) as TeacherFormat[]
        },
    })
}

/** Preferencia "usar el formato de VUNLEK" (cuando el docente no tiene formato propio). */
const PREF_KEY = (kind: FormatKind) => `vunlek_format_choice_${kind}`
export const getFormatChoice = (kind: FormatKind): string | null => { try { return localStorage.getItem(PREF_KEY(kind)) } catch { return null } }
export const setFormatChoice = (kind: FormatKind, v: string) => { try { localStorage.setItem(PREF_KEY(kind), v) } catch { /* sin almacenamiento */ } }
