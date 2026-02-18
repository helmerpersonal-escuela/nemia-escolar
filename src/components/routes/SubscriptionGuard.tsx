import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSubscription } from '../../hooks/useSubscription'
import { useProfile } from '../../hooks/useProfile'
import { useTenant } from '../../hooks/useTenant'

interface SubscriptionGuardProps {
    children?: React.ReactNode
}

export const SubscriptionGuard = ({ children }: SubscriptionGuardProps) => {
    const { isActive, loading: subLoading } = useSubscription()
    const { profile, isLoading: profileLoading, isSuperAdmin } = useProfile()
    const { data: tenant, isLoading: tenantLoading } = useTenant()
    const location = useLocation()

    const isInitialLoading = (subLoading && !isActive()) || (profileLoading && !profile) || (tenantLoading && !tenant)

    if (isInitialLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-950">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    // SuperAdmins are exempt from subscription checks
    if (isSuperAdmin) {
        return children ? <>{children}</> : <Outlet />
    }

    // If on onboarding or settings, allow access (so they can configure or pay)
    // ALSO: If we have an approved payment status OR are in persistent sync, we MUST let it pass
    // ALSO: If onboarding is NOT completed, we must let them pass to finish it (free trial starts there)
    const params = new URLSearchParams(location.search)
    const isApproved = params.get('status') === 'approved'
    const isSyncPersistent = sessionStorage.getItem('vunlek_payment_syncing') === 'true'
    const exemptPaths = ['/onboarding', '/settings', '/paywall']

    if (exemptPaths.includes(location.pathname) || isApproved || isSyncPersistent || tenant?.onboardingCompleted === false) {
        return children ? <>{children}</> : <Outlet />
    }

    if (!isActive()) {
        const search = location.search ? location.search : ''
        return <Navigate to={`/paywall${search}`} state={{ from: location, trialExpired: true }} replace />
    }

    return children ? <>{children}</> : <Outlet />
}

