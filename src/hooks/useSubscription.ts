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
    const { data: subscription, isLoading, error } = useQuery<Subscription | null>({
        queryKey: ['subscription'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return null

            const { data, error: subError } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle()

            if (subError && subError.code !== 'PGRST116') throw subError
            return data
        },
        staleTime: 1000 * 60 * 5 // 5 minutes
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

    return { subscription, loading: isLoading, error, isTrialExpired, isActive }
}
