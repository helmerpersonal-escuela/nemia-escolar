import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'

export interface SchoolTrial { endsAt: string; daysLeft: number; canManage: boolean }

/**
 * Periodo de prueba de una ESCUELA (un mes con todas las funciones). Se consulta directo al
 * servidor, sin importar si los cobros están activos en la app. Devuelve null si el espacio
 * no es una escuela en prueba.
 */
export function useSchoolTrial(): SchoolTrial | null {
    const { data: tenant } = useTenant()
    const tenantId = (tenant as any)?.id as string | undefined
    const { data } = useQuery({
        queryKey: ['school-trial', tenantId],
        enabled: !!tenantId && tenantId !== '00000000-0000-0000-0000-000000000000',
        staleTime: 10 * 60_000,
        queryFn: async () => {
            const { data: a, error } = await supabase.rpc('space_access' as any, { p_tenant: tenantId })
            if (error) throw error
            return a as any
        },
    })
    if (!data || data.tenant_type !== 'SCHOOL' || data.plan !== 'TRIAL' || !data.ends_at) return null
    return { endsAt: data.ends_at, daysLeft: Math.max(0, Number(data.days_left ?? 0)), canManage: !!data.can_manage }
}
