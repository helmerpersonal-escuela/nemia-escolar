import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSubscription } from '../../hooks/useSubscription'
import { useProfile } from '../../hooks/useProfile'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'
import { isNetworkError } from '../../lib/offline/network'

interface SubscriptionGuardProps {
    children?: React.ReactNode
}

export const SubscriptionGuard = ({ children }: SubscriptionGuardProps) => {
    const { isActive, loading: subLoading, subscription, error: subError } = useSubscription()
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

    // SuperAdmins are exempt from subscription and verification checks
    if (isSuperAdmin) {
        return children ? <>{children}</> : <Outlet />
    }

    // Email Verification Grace Period Check (24 Hours)
    if (profile && !profile.email_confirmed_at) {
        const createdAt = new Date(profile.auth_created_at || profile.created_at).getTime()
        const now = new Date().getTime()
        const gracePeriodMs = 24 * 60 * 60 * 1000
        const hasExpired = (now - createdAt) > gracePeriodMs

        if (hasExpired) {
            // Force logout and redirect to login with verification error
            supabase.auth.signOut()
            return <Navigate to="/login?error=verification_expired" replace />
        }
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

    // Sin conexión y sin copia guardada de la suscripción: no bloquear al docente
    // (se vuelve a verificar en cuanto haya señal).
    if (!subscription && subError && isNetworkError(subError)) {
        return children ? <>{children}</> : <Outlet />
    }

    // Error al consultar (no es que no tenga licencia): ofrecer reintentar en vez de
    // mandarlo a la pantalla de pago.
    if (!subscription && subError) {
        return (
            <div role="alert" className="min-h-dvh flex items-center justify-center p-6 bg-slate-50">
                <div className="max-w-sm text-center space-y-4">
                    <h1 className="text-xl font-black text-slate-900">No pudimos verificar tu licencia</h1>
                    <p className="text-sm text-slate-600">Puede ser un problema momentáneo de conexión con el servidor.</p>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="min-h-11 px-6 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700"
                    >
                        Reintentar
                    </button>
                </div>
            </div>
        )
    }

    if (!isActive()) {
        const search = location.search ? location.search : ''
        return <Navigate to={`/paywall${search}`} state={{ from: location, trialExpired: true }} replace />
    }

    return children ? <>{children}</> : <Outlet />
}

