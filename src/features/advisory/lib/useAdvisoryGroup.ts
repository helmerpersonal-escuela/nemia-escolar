import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'

export interface AdvisoryStudent {
    id: string
    name: string
    photo_url: string | null
    incidents: number
    severe: number
    positive: number
    open_commitments: number
    absences: number
    lates: number
    last_incident_at: string | null
}

export interface AdvisoryIncident {
    id: string
    student_id: string
    student: string
    title: string | null
    type: string
    severity: string
    status: string | null
    description: string
    has_commitment: boolean
    commitment: string | null
    teacher: string
    created_at: string
}

export interface AdvisoryGroup {
    group: { id: string, grade: string, section: string, shift: string | null }
    days: number
    students: AdvisoryStudent[]
    recent: AdvisoryIncident[]
}

/** Puntaje simple para ordenar a quién atender primero (incidencias graves pesan más). */
export const attentionScore = (s: AdvisoryStudent) =>
    s.severe * 3 + s.incidents * 1.5 + s.open_commitments * 2 + s.absences + s.lates * 0.5 - s.positive * 0.5

export const groupLabel = (g?: AdvisoryGroup['group'] | null) => g ? `${g.grade}° "${g.section}"` : ''

/** Grupo que asesora el docente (lo asigna la dirección). null si no tiene. */
export function useAdvisoryGroup(days = 30) {
    return useQuery({
        queryKey: ['advisory-group', days],
        staleTime: 60_000,
        queryFn: async (): Promise<AdvisoryGroup | null> => {
            const { data, error } = await supabase.rpc('my_advisory_group', { p_days: days })
            if (error) throw error
            return (data as AdvisoryGroup | null) ?? null
        },
    })
}
