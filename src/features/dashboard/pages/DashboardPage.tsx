import { useTenant } from '../../../hooks/useTenant'
import { useNavigate, Navigate } from 'react-router-dom'

// Role Dashboards
import { TeacherDashboard } from '../../evaluation/pages/TeacherDashboard'
import { DirectorDashboard } from '../components/roles/DirectorDashboard'
import { CoordinationDashboard } from '../components/roles/CoordinationDashboard'
import { ControlEscolarDashboard } from '../components/roles/ControlEscolarDashboard'
import { PrefecturaDashboard } from '../components/roles/PrefecturaDashboard'
import { SupportDashboard } from '../components/roles/SupportDashboard'
import { StudentDashboard } from '../components/roles/StudentDashboard'
import { AdminDashboard } from '../../admin/pages/AdminDashboard'
import { TechCoordinationDashboard } from '../components/roles/TechCoordinationDashboard'
import { TutorDashboard } from '../components/roles/TutorDashboard'
import { IndependentDashboard } from '../components/roles/IndependentDashboard'

export const DashboardPage = () => {
    const { data: tenant } = useTenant()
    const navigate = useNavigate()
    // Role Dispatcher
    const workspaceType = (tenant as any)?.type || 'SCHOOL'
    let currentRole = (tenant as any)?.role || 'TEACHER'

    // Robust Role Enforcement for Independent Workspaces
    const PROTECTED_ROLES = ['TUTOR', 'SCHOOL_CONTROL', 'PREFECT', 'SUPPORT', 'STUDENT', 'SUPER_ADMIN']
    if (workspaceType === 'INDEPENDENT' && !PROTECTED_ROLES.includes(currentRole)) {
        currentRole = 'INDEPENDENT_TEACHER'
    }

    const isImpersonating = !!sessionStorage.getItem('vunlek_impersonate_id')

    if (currentRole === 'INDEPENDENT_TEACHER') return <IndependentDashboard />

    if (currentRole === 'SUPER_ADMIN') {
        // Only redirect to /admin if they are in the "System" tenant (God Mode) 
        // AND they are at the root (index). If they have a specific tenant or 
        // are trying to see the dashboard, let them through (they can use the switcher).
        // GUARD: If impersonating, NEVER redirect to /admin loop
        if ((tenant as any)?.id === '00000000-0000-0000-0000-000000000000' && !isImpersonating) {
            return <Navigate to="/admin" replace />
        }
    }

    if (currentRole === 'ADMIN') return <AdminDashboard />
    if (currentRole === 'DIRECTOR') return <DirectorDashboard />
    if (currentRole === 'ACADEMIC_COORD') return <CoordinationDashboard />
    if (currentRole === 'TECH_COORD') return <TechCoordinationDashboard />
    if (currentRole === 'SCHOOL_CONTROL') return <ControlEscolarDashboard />
    if (currentRole === 'PREFECT') return <PrefecturaDashboard />
    if (currentRole === 'SUPPORT') return <SupportDashboard />
    if (currentRole === 'STUDENT') return <StudentDashboard />
    if (currentRole === 'TUTOR') return <TutorDashboard />

    // Default Teacher Dashboard
    return (
        <div>
            {/* <div className="bg-red-50 p-4 mb-4 rounded-xl text-red-700 text-xs font-mono">
                DEBUG: Role={currentRole} | TenantID={tenant?.id}
            </div> */}
            <TeacherDashboard />
        </div>
    )
}
