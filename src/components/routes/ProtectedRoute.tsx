import { Navigate, Outlet } from 'react-router-dom'
import { useProfile } from '../../hooks/useProfile'
import { useTenant } from '../../hooks/useTenant'

interface ProtectedRouteProps {
    allowedRoles: string[]
    children?: React.ReactNode
}

export const ProtectedRoute = ({ allowedRoles, children }: ProtectedRouteProps) => {
    const { profile, isLoading } = useProfile()
    const { data: tenant } = useTenant()

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center min-h-[50vh]">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    // Determine working role
    let currentRole = profile?.role || ''
    if (tenant?.type === 'INDEPENDENT') {
        currentRole = 'INDEPENDENT_TEACHER'
    }

    if (!profile || !allowedRoles.includes(currentRole)) {
        // Redirect to dashboard if unauthorized
        return <Navigate to="/" replace />
    }

    return children ? <>{children}</> : <Outlet />
}
