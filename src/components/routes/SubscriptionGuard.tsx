import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSubscription } from '../../hooks/useSubscription'
import { useProfile } from '../../hooks/useProfile'

interface SubscriptionGuardProps {
    children?: React.ReactNode
}

export const SubscriptionGuard = ({ children }: SubscriptionGuardProps) => {
    const { isActive, loading: subLoading } = useSubscription()
    const { profile, isLoading: profileLoading } = useProfile()
    const location = useLocation()

    if (subLoading || profileLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-950">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    // SuperAdmins are exempt from subscription checks
    if (profile?.role === 'SUPER_ADMIN') {
        return children ? <>{children}</> : <Outlet />
    }

    // If on onboarding or settings, allow access (so they can configure or pay)
    const exemptPaths = ['/onboarding', '/settings', '/paywall']
    if (exemptPaths.includes(location.pathname)) {
        return children ? <>{children}</> : <Outlet />
    }

    if (!isActive()) {
        return <Navigate to="/settings" state={{ from: location, trialExpired: true }} replace />
    }

    return children ? <>{children}</> : <Outlet />
}

