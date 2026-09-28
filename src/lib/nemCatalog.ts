import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useTenant } from '../hooks/useTenant'

/**
 * Catálogo pedagógico de la NEM: ejes articuladores y metodologías sociocríticas oficiales
 * (Plan de Estudio 2022 y Programas Sintéticos 2024), más los que crea el docente o la
 * comunidad escolar. Cada docente puede ocultar los oficiales que no usa.
 */

export const CAMPOS_FORMATIVOS = ['Lenguajes', 'Saberes y Pensamiento Científico', 'Ética, Naturaleza y Sociedades', 'De lo Humano y lo Comunitario'] as const

export interface CatalogItem {
    id: string            // para oficiales: 'oficial:<clave>'
    name: string
    description?: string | null
    field_of_study?: string | null  // metodología sugerida para ese campo
    phases?: string[]
    official: boolean
    scope?: 'PERSONAL' | 'SCHOOL'
    created_by?: string
}

export const OFFICIAL_EJES: CatalogItem[] = [
    { id: 'oficial:inclusion', name: 'Inclusión', description: 'Reconocer la diversidad y eliminar barreras para que todas y todos aprendan y participen.', official: true },
    { id: 'oficial:pensamiento-critico', name: 'Pensamiento crítico', description: 'Cuestionar la realidad, argumentar y construir posturas propias con base en evidencias.', official: true },
    { id: 'oficial:interculturalidad', name: 'Interculturalidad crítica', description: 'Diálogo entre culturas, reconocimiento de saberes y de la desigualdad que las atraviesa.', official: true },
    { id: 'oficial:igualdad-genero', name: 'Igualdad de género', description: 'Relaciones igualitarias y libres de violencia entre mujeres, hombres y diversidades.', official: true },
    { id: 'oficial:vida-saludable', name: 'Vida saludable', description: 'Bienestar físico, emocional y social; relación con el medio ambiente.', official: true },
    { id: 'oficial:lectura-escritura', name: 'Apropiación de las culturas a través de la lectura y la escritura', description: 'Leer y escribir con sentido para participar en la cultura escrita.', official: true },
    { id: 'oficial:artes', name: 'Artes y experiencias estéticas', description: 'Sensibilidad, creatividad y expresión mediante las artes.', official: true },
]

export const OFFICIAL_METODOLOGIAS: CatalogItem[] = [
    {
        id: 'oficial:proyectos-comunitarios', name: 'Aprendizaje basado en proyectos comunitarios', field_of_study: 'Lenguajes', official: true,
        description: 'Proyectos que parten de una necesidad de la comunidad y terminan con una acción que la transforma.',
        phases: ['Planeación: identificación, recuperación y planificación', 'Acción: acercamiento, comprensión y producción, reconocimiento y concreción', 'Intervención: integración, difusión, consideraciones y avances'],
    },
    {
        id: 'oficial:indagacion-steam', name: 'Aprendizaje basado en indagación (enfoque STEAM)', field_of_study: 'Saberes y Pensamiento Científico', official: true,
        description: 'Investigación guiada por preguntas para comprender fenómenos naturales y resolver problemas con ciencia, tecnología, arte y matemáticas.',
        phases: ['Introducción al tema', 'Diseño de investigación', 'Organizar y estructurar las respuestas a las preguntas específicas de indagación', 'Presentación de los resultados de indagación', 'Metacognición'],
    },
    {
        id: 'oficial:abp', name: 'Aprendizaje basado en problemas (ABP)', field_of_study: 'Ética, Naturaleza y Sociedades', official: true,
        description: 'Analizar un problema real de la comunidad para proponer soluciones colectivas y argumentadas.',
        phases: ['Presentemos', 'Recolectemos', 'Formulemos el problema', 'Organicemos la experiencia', 'Vivamos la experiencia', 'Resultados y análisis'],
    },
    {
        id: 'oficial:aprendizaje-servicio', name: 'Aprendizaje servicio (AS)', field_of_study: 'De lo Humano y lo Comunitario', official: true,
        description: 'Aprender mientras se realiza un servicio solidario que atiende una necesidad real de la comunidad.',
        phases: ['Punto de partida', 'Lo que sé y lo que quiero saber', 'Organicemos las actividades', 'Creatividad en marcha', 'Compartimos y evaluamos lo aprendido'],
    },
]

/** Fase de la NEM según nivel y grado (secundaria = 6). */
export function phaseFor(level?: string | null, grade?: number | null): number | null {
    const l = String(level ?? '').toUpperCase()
    if (l === 'SECONDARY' || l === 'TELESECUNDARIA' || l === 'SECUNDARIA') return 6
    if (l === 'PRIMARY' || l === 'PRIMARIA') {
        if (!grade) return null
        return grade <= 2 ? 3 : grade <= 4 ? 4 : 5
    }
    if (l === 'PRESCHOOL' || l === 'PREESCOLAR') return 2
    return null
}

type Kind = 'EJE' | 'METODOLOGIA' | 'PDA'

export function useHiddenItems() {
    // Se guarda como arreglo (la caché de consultas se persiste en el dispositivo y un Set no se serializa)
    const q = useQuery({
        queryKey: ['hidden-catalog-items'],
        staleTime: 5 * 60_000,
        queryFn: async () => {
            const { data } = await supabase.from('hidden_catalog_items').select('kind, ref')
            return (data ?? []).map(r => `${r.kind}:${r.ref}`)
        },
    })
    const set = useMemo(() => new Set(Array.isArray(q.data) ? q.data : []), [q.data])
    return { ...q, data: set }
}

export function useCatalogActions() {
    const qc = useQueryClient()
    const refresh = () => {
        qc.invalidateQueries({ queryKey: ['hidden-catalog-items'] })
        qc.invalidateQueries({ queryKey: ['pedagogy-items'] })
    }
    return {
        hide: async (kind: Kind, ref: string) => {
            const { error } = await supabase.from('hidden_catalog_items').upsert({ kind, ref }, { onConflict: 'profile_id,kind,ref' })
            refresh()
            return error
        },
        restore: async (kind: Kind, ref: string) => {
            const { error } = await supabase.from('hidden_catalog_items').delete().eq('kind', kind).eq('ref', ref)
            refresh()
            return error
        },
        refresh,
    }
}

/** Ejes y metodologías propios (del docente y de la escuela). */
export function usePedagogyItems(kind: 'EJE' | 'METODOLOGIA') {
    const { data: tenant } = useTenant()
    return useQuery({
        queryKey: ['pedagogy-items', tenant?.id, kind],
        enabled: !!tenant?.id,
        staleTime: 5 * 60_000,
        queryFn: async (): Promise<CatalogItem[]> => {
            const { data, error } = await supabase.from('pedagogy_items').select('*').eq('tenant_id', tenant!.id).eq('kind', kind).order('name')
            if (error) throw error
            return (data ?? []).map((r: any) => ({
                id: r.id, name: r.name, description: r.description, field_of_study: r.field_of_study,
                phases: Array.isArray(r.phases) ? r.phases : [], official: false, scope: r.scope, created_by: r.created_by,
            }))
        },
    })
}

/**
 * Lista final para elegir (oficiales no ocultos + propios). Para metodologías, si se da el
 * campo formativo, primero van las sugeridas para ese campo.
 */
export function useCatalog(kind: 'EJE' | 'METODOLOGIA', campo?: string | null) {
    const { data: hidden } = useHiddenItems()
    const { data: own = [] } = usePedagogyItems(kind)
    const official = kind === 'EJE' ? OFFICIAL_EJES : OFFICIAL_METODOLOGIAS
    const visible = official.filter(o => !hidden?.has(`${kind}:${o.id}`))
    let list = [...visible, ...own]
    if (kind === 'METODOLOGIA' && campo) {
        list = [...list].sort((a, b) => Number(b.field_of_study === campo) - Number(a.field_of_study === campo))
    }
    return list
}
