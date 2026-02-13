import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'none'

export interface Subscription {
    id: string
    status: SubscriptionStatus
    plan_type: string
    current_period_end: string
}

export const useSubscription = () => {
    const [subscription, setSubscription] = useState<Subscription | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchSubscription = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) {
                    setSubscription(null)
                    setLoading(false)
                    return
                }

                const { data, error: subError } = await supabase
                    .from('subscriptions')
                    .select('*')
                    .eq('user_id', user.id)
                    .single()

                if (subError) {
                    if (subError.code === 'PGRST116') {
                        // No subscription found
                        setSubscription(null)
                    } else {
                        throw subError
                    }
                } else {
                    setSubscription(data)
                }
            } catch (err: any) {
                console.error('Error fetching subscription:', err)
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }

        fetchSubscription()

        // Realtime subscription updates
        const channel = supabase
            .channel('subscription-updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'subscriptions'
                },
                () => {
                    fetchSubscription()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

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

    return { subscription, loading, error, isTrialExpired, isActive }
}
