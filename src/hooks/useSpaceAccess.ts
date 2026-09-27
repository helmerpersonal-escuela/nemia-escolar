import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useTenant } from './useTenant'

/** Estado de la suscripción del espacio (escuela o docente independiente). */
export interface SpaceAccess {
    has_access: boolean
    status?: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'EXPIRED' | 'CANCELED' | 'GOD' | 'NO_SPACE'
    plan?: 'TRIAL' | 'MONTHLY' | 'ANNUAL' | 'LICENSE'
    ends_at?: string | null
    days_left?: number | null
    auto_renew?: boolean
    price?: number | null
    promo_code?: string | null
    in_grace?: boolean
    can_manage?: boolean
    tenant_type?: 'SCHOOL' | 'INDEPENDENT'
    tenant_id?: string
    reason?: string
}

export const SPACE_ACCESS_KEY = 'space-access'

export function useSpaceAccess() {
    const { data: tenant } = useTenant()
    const tenantId = (tenant as any)?.id as string | undefined
    return useQuery<SpaceAccess>({
        queryKey: [SPACE_ACCESS_KEY, tenantId ?? 'none'],
        enabled: !!tenant,
        staleTime: 5 * 60_000,
        retry: (failures, err) => failures < 3 && !/JWT|permission|401|403/i.test(String((err as Error)?.message ?? '')),
        retryDelay: attempt => Math.min(1000 * 2 ** attempt, 4000),
        queryFn: async () => {
            const god = tenantId === '00000000-0000-0000-0000-000000000000'
            const { data, error } = await supabase.rpc('space_access' as any, { p_tenant: god ? null : tenantId ?? null })
            if (error) throw error
            return data as SpaceAccess
        },
    })
}

export const PLAN_LABEL: Record<string, string> = { TRIAL: 'Prueba gratuita', MONTHLY: 'Mensual', ANNUAL: 'Anual', LICENSE: 'Licencia' }
