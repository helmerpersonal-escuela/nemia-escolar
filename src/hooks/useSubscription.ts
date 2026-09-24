import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'none'

export interface Subscription {
    id: string
    status: SubscriptionStatus
    plan_type: string
    current_period_end: string
}

export const useSubscription = () => {
    const { data: subscription, isPending, error } = useQuery<Subscription | null>({
        queryKey: ['subscription'],
        queryFn: async () => {
            // La sesión local basta para saber quién es; getUser() consulta al servidor y
            // si falla un momento dejaba la suscripción en null (mandaba a "Planes" por error).
            const { data: { session } } = await supabase.auth.getSession()
            const user = session?.user
            if (!user) throw new Error('Sesión no disponible todavía')

            // Check for impersonation
            const impersonateId = sessionStorage.getItem('vunlek_impersonate_id')
            let targetUserId = user.id

            if (impersonateId) {
                targetUserId = impersonateId
            }

            const { data, error: subError } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('user_id', targetUserId)
                .maybeSingle()


            if (subError && subError.code !== 'PGRST116') throw subError
            return data
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: (failures, err) => failures < 3 && !/JWT|permission|401|403/i.test(String((err as Error)?.message ?? '')),
        retryDelay: attempt => Math.min(1000 * 2 ** attempt, 4000),
    })

    const isTrialExpired = () => {
        if (!subscription) return true
        if (subscription.status !== 'trialing') return false
        return new Date(subscription.current_period_end) < new Date()
    }

    const isActive = () => {
        if (!subscription) return false
        if (subscription.status === 'active') return true
        if (subscription.status === 'trialing' && !isTrialExpired()) return true
        return false
    }

    // isPending (no isLoading): mientras React Query restaura la copia guardada no hay
    // petición en curso, e isLoading era false; eso mandaba a "Planes" por error.
    return { subscription, loading: isPending, error, isTrialExpired, isActive }
}
