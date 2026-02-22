import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface SubscriptionLimits {
    maxGroups: number
    maxStudentsPerGroup: number
    currentGroups: number
    planType: 'basic' | 'pro'
    priceAnnual: number
    canAddGroup: boolean
    isLoading: boolean
}

export const useSubscriptionLimits = () => {
    const [limits, setLimits] = useState<SubscriptionLimits>({
        maxGroups: 5,
        maxStudentsPerGroup: 50,
        currentGroups: 0,
        planType: 'basic',
        priceAnnual: 399,
        canAddGroup: true,
        isLoading: true
    })

    useEffect(() => {
        const fetchLimits = async () => {
            try {
                // 1. Get current user
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) {
                    setLimits(prev => ({ ...prev, isLoading: false }))
                    return
                }

                // 2. Get user's subscription (subscriptions table uses user_id)
                const { data: subscription } = await supabase
                    .from('subscriptions')
                    .select('plan_type, status')
                    .eq('user_id', user.id)
                    .single()

                const planType = subscription?.plan_type || 'basic'

                // 3. Get plan limits
                const { data: planLimits } = await supabase
                    .from('license_limits')
                    .select('*')
                    .eq('plan_type', planType)
                    .single()

                // 4. Get user's tenant_id to count groups
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('tenant_id')
                    .eq('id', user.id)
                    .single()

                if (!profile?.tenant_id) {
                    setLimits(prev => ({ ...prev, isLoading: false }))
                    return
                }

                // 5. Count current groups for this tenant
                const { count: groupCount } = await supabase
                    .from('groups')
                    .select('*', { count: 'exact', head: true })
                    .eq('tenant_id', profile.tenant_id)

                const currentGroups = groupCount || 0
                const rawMaxGroups = planLimits?.max_groups || (planType === 'pro' ? 10 : 5)
                const maxGroups = Math.max(rawMaxGroups, planType === 'pro' ? 10 : 5) // Enforce minimums
                const maxStudentsPerGroup = planLimits?.max_students_per_group || 50
                const priceAnnual = planLimits?.price_annual || (planType === 'pro' ? 599 : 399)

                setLimits({
                    maxGroups,
                    maxStudentsPerGroup,
                    currentGroups,
                    planType: planType as 'basic' | 'pro',
                    priceAnnual,
                    canAddGroup: currentGroups < maxGroups,
                    isLoading: false
                })
            } catch (error) {
                console.error('Error fetching subscription limits:', error)
                setLimits(prev => ({ ...prev, isLoading: false }))
            }
        }

        fetchLimits()
    }, [])

    const canAddStudent = (currentStudents: number): boolean => {
        return currentStudents < limits.maxStudentsPerGroup
    }

    const refreshLimits = async () => {
        setLimits(prev => ({ ...prev, isLoading: true }))
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Re-fetch subscription
            const { data: subscription } = await supabase
                .from('subscriptions')
                .select('plan_type, status')
                .eq('user_id', user.id)
                .maybeSingle()

            const planType = subscription?.plan_type || 'basic'

            // Re-fetch plan limits
            const { data: planLimits } = await supabase
                .from('license_limits')
                .select('*')
                .eq('plan_type', planType)
                .maybeSingle()

            const { data: profile } = await supabase
                .from('profiles')
                .select('tenant_id')
                .eq('id', user.id)
                .single()

            if (!profile?.tenant_id) return

            const { count: groupCount } = await supabase
                .from('groups')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', profile.tenant_id)

            const rawMaxGroups = planLimits?.max_groups || (planType === 'pro' ? 10 : 5)
            const resolvedMaxGroups = Math.max(rawMaxGroups, planType === 'pro' ? 10 : 5)

            setLimits({
                maxGroups: resolvedMaxGroups,
                maxStudentsPerGroup: planLimits?.max_students_per_group || 50,
                currentGroups: groupCount || 0,
                planType: planType as 'basic' | 'pro',
                priceAnnual: planLimits?.price_annual || (planType === 'pro' ? 599 : 399),
                canAddGroup: (groupCount || 0) < resolvedMaxGroups,
                isLoading: false
            })
        } catch (err) {
            console.error('Error refreshing limits:', err)
            setLimits(prev => ({ ...prev, isLoading: false }))
        }
    }

    return {
        ...limits,
        canAddStudent,
        refreshLimits
    }
}
