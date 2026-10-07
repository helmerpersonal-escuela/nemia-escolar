import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { asCriteria, DEFAULT_CRITERIA } from '../lib/criteria'

/** Criterios de la escuela; mientras cargan (o si nunca se cambiaron) son los de fábrica. */
export function useCriteria(tenantId?: string) {
    const q = useQuery({
        queryKey: ['school-criteria', tenantId],
        enabled: !!tenantId,
        staleTime: 5 * 60_000,
        queryFn: async () => {
            const { data } = await supabase.from('school_criteria').select('*').eq('tenant_id', tenantId!).maybeSingle()
            return asCriteria(data)
        },
    })
    return { criteria: q.data ?? DEFAULT_CRITERIA, isLoading: q.isLoading }
}
