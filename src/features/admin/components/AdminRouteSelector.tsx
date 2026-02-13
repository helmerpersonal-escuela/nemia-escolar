import { Navigate } from 'react-router-dom'
import { useProfile } from '../../../hooks/useProfile'
import { SuperAdminDashboard } from '../pages/SuperAdminDashboard'

export const AdminRouteSelector = () => {
    const { profile, isLoading } = useProfile()

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-900">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    if (profile?.role === 'SUPER_ADMIN') {
        return <SuperAdminDashboard />
    }

    // Role-based redirection for school administrators
    if (['ADMIN', 'DIRECTOR'].includes(profile?.role || '')) {
        return <Navigate to="/admin/dashboard" replace />
    }

    // Fallback to home if no admin access
    return <Navigate to="/" replace />
}
