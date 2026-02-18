import { useSubscription } from './useSubscription'

export const useTrialStatus = () => {
    const { subscription, isTrialExpired } = useSubscription()

    const getDaysRemaining = () => {
        if (!subscription || !subscription.current_period_end) return 0

        // If it's an active paid subscription, we don't count trial days
        if (subscription.status === 'active') return -1

        const end = new Date(subscription.current_period_end)
        const now = new Date()

        // Difference in milliseconds
        const diff = end.getTime() - now.getTime()

        // Convert to days (ceil to show "5 days remaining" even if it's 4.1 days)
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24))

        return days
    }

    return {
        daysRemaining: getDaysRemaining(),
        isTrial: subscription?.status === 'trialing',
        isExpired: isTrialExpired()
    }
}
