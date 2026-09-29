import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useTenant } from './useTenant'

export interface MyAssignment { role: string; job_title: string | null; assigned_grades: number[]; duties: string | null }

/** Mi encargo en la escuela activa (cargo, grados a mi cargo, actividades de la dirección). */
export function useMyAssignment() {
    const { data: tenant } = useTenant()
    return useQuery({
        queryKey: ['my-assignment', tenant?.id],
        enabled: !!tenant?.id,
        staleTime: 5 * 60_000,
        queryFn: async (): Promise<MyAssignment | null> => {
            const { data, error } = await supabase.rpc('my_assignment')
            if (error) return null
            const row = ((data as any[]) || [])[0]
            return row ? { ...row, assigned_grades: row.assigned_grades || [] } : null
        },
    })
}

/** Grados a los que se limita la vista (vacío = todos). Solo aplica a personal con grados asignados. */
export function useGradeScope(): number[] {
    const { data } = useMyAssignment()
    if (!data || !['SCHOOL_CONTROL', 'PREFECT', 'SUPPORT', 'ACADEMIC_COORD'].includes(data.role)) return []
    return data.assigned_grades || []
}
