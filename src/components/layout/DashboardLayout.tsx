import { useState, useEffect } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import {
    LayoutDashboard,
    Shield,
    Users,
    Settings,
    LogOut,
    Menu,
    X,
    GraduationCap,
    ClipboardList,
    CheckSquare,
    ChevronDown,
    ChevronRight,
    Mail,
    Calendar,
    RefreshCw,
    ShieldCheck,
    AlertTriangle,
    TrendingUp,
    BookOpen,
    Package,
    HeartHandshake,
    History,
    FileText,
    BarChart3,
    Clock,
    ShieldAlert,
    UserCheck,
    Sparkles,
    Zap,
    Loader2
} from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import { OnboardingWizard } from '../../features/onboarding/components/OnboardingWizard'
import { SchoolOnboardingWizard } from '../../features/onboarding/components/SchoolOnboardingWizard'
import { useTenant } from '../../hooks/useTenant'
import { useProfile } from '../../hooks/useProfile'
import { NotificationsMenu } from './NotificationsMenu'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'
import { useAttendanceReminder } from '../../hooks/useAttendanceReminder'
import { NotificationManager } from '../ui/NotificationManager'
import { useOfflineSync } from '../../hooks/useOfflineSync'

const MenuSection = ({ title, items, location }: any) => {
    return (
        <section className="mb-6" aria-labelledby={`section-title-${title.toLowerCase().replace(/\s+/g, '-')}`}>
            <h3
                id={`section-title-${title.toLowerCase().replace(/\s+/g, '-')}`}
                className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2"
            >
                {title}
            </h3>
            <div className="space-y-1">
                {items.map((item: any) => (
                    <MenuItem key={item.label} item={item} location={location} />
                ))}
            </div>
        </section>
    )
}

const MenuItem = ({ item, location }: any) => {
    const hasSubItems = item.subItems && item.subItems.length > 0
    // Check if any child is active to auto-open
    const isActiveParent = hasSubItems && item.subItems.some((sub: any) => location.pathname.startsWith(sub.path))

    // Initialize with active state
    const [isOpen, setIsOpen] = useState(isActiveParent)

    // Auto open if active parent changes to true
    useEffect(() => {
        if (isActiveParent) setIsOpen(true)
    }, [isActiveParent])

    if (hasSubItems) {
        return (
            <div>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    aria-expanded={isOpen}
                    aria-controls={`submenu-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                    className={`
                        w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium rounded-xl transition-colors
                        ${isActiveParent ? 'text-blue-700 bg-blue-50/50' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                    `}
                >
                    <div className="flex items-center">
                        <item.icon className={`h-5 w-5 mr-3 ${isActiveParent ? 'text-blue-600' : 'text-gray-400'}`} aria-hidden="true" />
                        {item.label}
                    </div>
                    {isOpen ? <ChevronDown className="h-4 w-4 text-gray-400" aria-hidden="true" /> : <ChevronRight className="h-4 w-4 text-gray-400" aria-hidden="true" />}
                </button>
                {isOpen && (
                    <div
                        id={`submenu-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                        role="group"
                        className="ml-11 mt-1 space-y-1 border-l-2 border-gray-100 pl-3"
                    >
                        {item.subItems.map((sub: any, idx: number) => {
                            const isSubActive = location.pathname === sub.path
                            return (
                                <Link
                                    key={`${sub.path}-${idx}`}
                                    to={sub.path}
                                    aria-current={isSubActive ? 'page' : undefined}
                                    className={`
                                        block px-3 py-2 text-sm rounded-lg transition-colors
                                        ${isSubActive
                                            ? 'text-blue-700 font-medium bg-blue-50'
                                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}
                                    `}
                                >
                                    {sub.label}
                                </Link>
                            )
                        })}
                    </div>
                )}
            </div>
        )
    }

    const isActive = location.pathname === item.path
    return (
        <Link
            to={item.path}
            aria-current={isActive ? 'page' : undefined}
            className={`
                flex items-center px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200
                ${isActive
                    ? 'bg-blue-50 text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }
            `}
        >
            <item.icon
                className={`h-5 w-5 mr-3 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}
                aria-hidden="true"
            />
            {item.label}
        </Link>
    )
}

export const DashboardLayout = () => {
    // Start closed on mobile, open could be controlled by media query, but false is safer default to avoid flash
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const location = useLocation()
    const navigate = useNavigate()

    const [roles, setRoles] = useState<string[]>([])
    const [isSynchronizing, setIsSynchronizing] = useState(false)
    const [syncError, setSyncError] = useState<string | null>(null)
    const { data: tenant, isLoading: isTenantLoading } = useTenant()
    const { profile, isLoading: isProfileLoading } = useProfile()
    const { isOnline, pendingCount, isSyncing } = useOfflineSync()

    // Derived states
    const isApprovedParam = new URLSearchParams(location.search).get('status') === 'approved'
    const showOnboarding = tenant ? (tenant.onboardingCompleted === false && !isApprovedParam) : false

    // Attendance Reminder Hook
    useAttendanceReminder()

    // Auto-close sidebar on route change (Mobile UX)
    useEffect(() => {
        setIsSidebarOpen(false)
    }, [location.pathname])

    // Load roles when tenant is available
    useEffect(() => {
        if (tenant?.id) {
            loadRoles()
        }
    }, [tenant?.id])

    // Set initial sidebar state based on screen width
    useEffect(() => {
        if (window.innerWidth >= 1024) {
            setIsSidebarOpen(true)
        }
    }, [])

    // --- NUCLEAR FIX: PROACTIVE ONBOARDING COMPLETION ---
    useEffect(() => {
        const checkPaymentStatus = async () => {
            const params = new URLSearchParams(window.location.search)
            const status = params.get('status')

            if (status === 'approved' && !isSynchronizing) {
                console.log("DASHBOARD_LAYOUT: Nuclear Fix Triggered")
                setIsSynchronizing(true)

                try {
                    // Try to get tenantId from external_reference (most reliable)
                    let targetTenantId = tenant?.id
                    const extRef = params.get('external_reference')
                    if (extRef) {
                        try {
                            // Case 1: JSON encoded string (legacy)
                            const parsed = JSON.parse(extRef)
                            if (parsed.tenantId) {
                                targetTenantId = parsed.tenantId
                                console.log("DASHBOARD_LAYOUT: Extracted targetTenantId from JSON:", targetTenantId)
                            }
                        } catch (e) {
                            // Case 2: Direct UUID string
                            if (extRef.length > 20) {
                                targetTenantId = extRef
                                console.log("DASHBOARD_LAYOUT: Extracted targetTenantId from direct string:", targetTenantId)
                            }
                        }
                    }

                    // Fallback to current user's profile metadata if still missing
                    if (!targetTenantId) {
                        const { data: { user } } = await supabase.auth.getUser()
                        if (user) {
                            const { data: profileData } = await supabase
                                .from('profiles')
                                .select('tenant_id')
                                .eq('id', user.id)
                                .maybeSingle()

                            targetTenantId = profileData?.tenant_id
                            console.log("DASHBOARD_LAYOUT: Fallback targetTenantId from profile:", targetTenantId)
                        }
                    }

                    if (targetTenantId) {
                        console.log("DASHBOARD_LAYOUT: Updating tenant in DB...", targetTenantId)
                        const { error: updateError } = await supabase
                            .from('tenants')
                            .update({ onboarding_completed: true })
                            .eq('id', targetTenantId)

                        if (updateError) throw updateError

                        // Clear cache aggressively to force fresh fetch on next load
                        queryClient.clear()

                        // Clean URL
                        const url = new URL(window.location.href)
                        url.search = ""
                        window.history.replaceState({}, '', url.toString())

                        // Small delay for DB propagation
                        await new Promise(resolve => setTimeout(resolve, 2000))

                        // Force hard redirect to home - this is the most reliable way to clear all state
                        window.location.href = '/'
                    } else {
                        throw new Error("No se pudo identificar tu cuenta escolar.")
                    }
                } catch (err: any) {
                    console.error("DASHBOARD_LAYOUT: Sync error:", err)
                    setSyncError(err.message)
                } finally {
                    setIsSynchronizing(false)
                }
            }
        }

        checkPaymentStatus()
    }, [location.search, tenant?.id])

    const loadRoles = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data, error } = await supabase.from('profile_roles').select('role').eq('profile_id', user.id)
                if (error) {
                    console.warn('Error loadRoles:', error.message)
                    setRoles(['TEACHER'])
                } else if (data) {
                    setRoles(data.map(r => r.role))
                }
            }
        } catch (error) {
            console.error('loadRoles failed:', error)
            setRoles(['TEACHER'])
        }
    }

    // Only show global loading if we have NO data. 
    // This prevents unmounting child pages (like editors) during background refetches
    if ((isTenantLoading && !tenant) || (isProfileLoading && !profile)) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6 shadow-xl shadow-blue-100"></div>
                    <p className="text-gray-900 font-bold text-lg animate-pulse tracking-tight">Cargando tu espacio...</p>
                    <p className="text-gray-400 text-xs mt-2 font-medium">Validando configuración de seguridad</p>
                </div>
            </div>
        )
    }

    // If we're not loading and don't have core data, handle it (e.g., error boundary or login)
    if (!tenant || !profile) return null;

    const handleLogout = async () => {
        await supabase.auth.signOut()
        window.location.href = '/login'
    }

    const handleSwitchRole = () => {
        navigate('/select-role')
    }

    // Nuclear Fix Overlay
    if (isSynchronizing || syncError) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white rounded-[3rem] p-10 shadow-2xl border-4 border-emerald-50 text-center animate-in zoom-in duration-500">
                    {syncError ? (
                        <>
                            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                <AlertTriangle className="w-10 h-10" />
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 mb-2">Error de Sincronización</h2>
                            <p className="text-slate-500 font-medium mb-8">No pudimos confirmar tu acceso: {syncError}</p>
                            <button
                                onClick={() => window.location.href = '/'}
                                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-slate-800 transition-all"
                            >
                                Reintentar Acceso
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner shadow-emerald-200">
                                <Zap className="w-10 h-10 animate-pulse" />
                            </div>
                            <h2 className="text-3xl font-black text-slate-900 mb-2">¡Suscripción Activa!</h2>
                            <p className="text-slate-500 font-medium mb-8">Estamos preparando tu nueva oficina digital escolar...</p>
                            <div className="flex flex-col items-center gap-2">
                                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Finalizando proceso</span>
                            </div>
                        </>
                    )}
                </div>
            </div>
        )
    }

    // Force Onboarding if needed
    if (showOnboarding) {
        return (
            <div className="min-h-screen bg-gray-50">
                {tenant?.type === 'SCHOOL' ? (
                    <SchoolOnboardingWizard onComplete={() => {
                        window.location.href = '/'
                    }} />
                ) : (
                    <OnboardingWizard onComplete={() => {
                        window.location.href = '/'
                    }} />
                )}
            </div>
        )
    }

    const menuByRole: Record<string, any[]> = {
        SUPER_ADMIN: [
            { icon: Shield, label: 'Dashboard TI (God Mode)', path: '/admin' },
            { icon: Mail, label: 'Mensajes', path: '/messages' },
            { icon: UserCheck, label: 'Portal Docente', path: '/' },
            { icon: Settings, label: 'Ajustes de Cuenta', path: '/settings' }
        ],
        DIRECTOR: [
            { icon: LayoutDashboard, label: 'Consola Directiva', path: '/' },
            { icon: Users, label: 'Control de Personal', path: '/admin/staff' },
            { icon: Users, label: 'Grupos (Inscripciones)', path: '/groups' },
            { icon: GraduationCap, label: 'Alumnos (Expedientes)', path: '/students' },
            { icon: Mail, label: 'Comunicados', path: '/messages' },
            {
                icon: TrendingUp,
                label: 'Gestión NEM',
                path: '#institution',
                subItems: [
                    { label: 'Programa de Mejora (PEMC)', path: '/admin/pemc' },
                    { label: 'Programa Analítico', path: '/analytical-program' },
                    { label: 'Estadísticas Globales', path: '/stats' },
                    { label: 'Validar Planeaciones', path: '/planning' }
                ]
            }
        ],
        ACADEMIC_COORD: [
            { icon: LayoutDashboard, label: 'Panel Pedagógico', path: '/' },
            { icon: Users, label: 'Grupos / Docentes', path: '/groups' },
            { icon: Mail, label: 'Comunicados', path: '/messages' },
            {
                icon: ClipboardList,
                label: 'Supervisión',
                path: '#pedagogy',
                subItems: [
                    { label: 'Validar Planeaciones', path: '/planning' },
                    { label: 'Avance Programático', path: '/progress' },
                    { label: 'Análisis de Aprovechamiento', path: '/stats' }
                ]
            }
        ],
        TECH_COORD: [
            { icon: LayoutDashboard, label: 'Panel Tecnológico', path: '/' },
            { icon: Users, label: 'Talleres y Laboratorios', path: '/groups' },
            { icon: Mail, label: 'Comunicados', path: '/messages' },
            {
                icon: Package,
                label: 'Tecnologías',
                path: '#tech',
                subItems: [
                    { label: 'Inventario de Insumos', path: '/inventory' },
                    { label: 'Planeaciones Técnicas', path: '/planning' },
                    { label: 'Supervisión de Prácticas', path: '/stats' }
                ]
            }
        ],
        SCHOOL_CONTROL: [
            { icon: LayoutDashboard, label: 'Panel Administrativo', path: '/' },
            { icon: Users, label: 'Inscripciones', path: '/groups' },
            { icon: GraduationCap, label: 'Expedientes / CURP', path: '/students' },
            { icon: Mail, label: 'Comunicados', path: '/messages' },
            {
                icon: CheckSquare,
                label: 'Control Escolar',
                path: '#admin',
                subItems: [
                    { label: 'Boletas Oficiales', path: '/reports/evaluation' },
                    { label: 'Horarios de Docentes', path: '/schedule' },
                    { label: 'Expedientes Digitales', path: '/students' }
                ]
            }
        ],
        TEACHER: [
            { icon: LayoutDashboard, label: 'Inicio', path: '/' },
            { icon: Users, label: 'Mis Grupos', path: '/groups' },
            { icon: Mail, label: 'Mensajes', path: '/messages' },
            {
                icon: CheckSquare,
                label: 'Evaluación',
                path: '#evaluation',
                subItems: [
                    { label: 'Libreta (Calificaciones)', path: '/gradebook' },
                    { label: 'Bitácora de Conducta', path: '/gradebook?tab=REPORTS' },
                    { label: 'Portafolio de Alumnos', path: '/evaluation/portfolio' },
                    { label: 'Herramientas Formativas', path: '/evaluation/formative' }
                ]
            },
            {
                icon: ClipboardList,
                label: 'Planeación',
                path: '#planning',
                subItems: [
                    { label: 'Mis Planeaciones', path: '/planning' },
                    { label: 'Programa Analítico', path: '/analytical-program' },
                    { label: 'Instrumentos', path: '/rubrics' },
                    { label: 'Guardias (Ausencias)', path: '/absences' }
                ]
            },
            { icon: Calendar, label: 'Calendario', path: '/agenda' },
            { icon: Clock, label: 'Horario Docente', path: '/schedule' }
        ],
        PREFECT: [
            { icon: LayoutDashboard, label: 'Panel de Prefectura', path: '/' },
            {
                icon: ShieldAlert,
                label: 'Control Educativo',
                path: '#control',
                subItems: [
                    { label: 'Cobertura de Suplencias', path: '/substitutions' },
                    { label: 'Bitácora de Incidencias', path: '/incidents' },
                    { label: 'Control de Retardos', path: '/attendance' },
                ]
            },
            {
                icon: UserCheck,
                label: 'Personal y Asistencia',
                path: '#staff',
                subItems: [
                    { label: 'Asistencia Personal (QR)', path: '/attendance/staff' },
                    { label: 'Plantilla del Plantel', path: '/admin/staff' },
                    { label: 'Justificaciones', path: '/attendance/justifications' }
                ]
            },
            {
                icon: Users,
                label: 'Gestión de Alumnos',
                path: '#students',
                subItems: [
                    { label: 'Grupos', path: '/groups' },
                    { label: 'Alumnos', path: '/students' },
                    { label: 'Citatorios', path: '/citations' }
                ]
            },
            { icon: Calendar, label: 'Agenda Escolar', path: '/agenda' },
            { icon: Mail, label: 'Comunicados', path: '/messages' },
        ],
        SUPPORT: [
            { icon: LayoutDashboard, label: 'Panel de Apoyo', path: '/' },
            { icon: GraduationCap, label: 'Seguimiento', path: '/students' },
            { icon: Mail, label: 'Comunicados', path: '/messages' },
            {
                icon: HeartHandshake,
                label: 'Bienestar',
                path: '#welfare',
                subItems: [
                    { label: 'Casos BAP', path: '/bap' },
                    { label: 'Entrevistas Padres', path: '/interviews' },
                    { label: 'Bitácora Socioemocional', path: '/incidents' }
                ]
            },
            { icon: Calendar, label: 'Agenda Escolar', path: '/agenda' }
        ],
        STUDENT: [
            { icon: LayoutDashboard, label: 'Mi Espacio', path: '/' },
            { icon: Mail, label: 'Avisos y Mensajes', path: '/messages' },
            {
                icon: GraduationCap,
                label: 'Mi Desempeño',
                path: '#academic',
                subItems: [
                    { label: 'Boleta de Calificaciones', path: '/reports' },
                    { label: 'Historial de Asistencias', path: '/attendance' },
                    { label: 'Calendario Escolar', path: '/agenda' }
                ]
            }
        ],
        TUTOR: [
            { icon: LayoutDashboard, label: 'Espacio de Tutor', path: '/' },
            { icon: Mail, label: 'Avisos de Dirección', path: '/messages' },
            {
                icon: GraduationCap,
                label: 'Mi Hijo(a)',
                path: '#academic',
                subItems: [
                    { label: 'Boleta de Calificaciones', path: '/reports' },
                    { label: 'Reportes de Asistencia', path: '/attendance' },
                    { label: 'Incidencias / Avisos', path: '/incidents' }
                ]
            }
        ],
        INDEPENDENT_TEACHER: [
            { icon: LayoutDashboard, label: 'Inicio', path: '/' },
            {
                icon: Users,
                label: 'Mis Clases',
                path: '#classes',
                subItems: [
                    { label: 'Grupos y Alumnos', path: '/groups' },
                    { label: 'Expedientes', path: '/students' },
                    { label: 'Asistencia', path: '/attendance' }
                ]
            },
            {
                icon: ClipboardList,
                label: 'Planeación',
                path: '#planning',
                subItems: [
                    { label: 'Mis Planeaciones', path: '/planning' },
                    { label: 'Programa Analítico', path: '/analytical-program' },
                    { label: 'Rúbricas', path: '/rubrics' }
                ]
            },
            {
                icon: CheckSquare,
                label: 'Evaluación',
                path: '#evaluation',
                subItems: [
                    { label: 'Calificaciones', path: '/gradebook' },
                    { label: 'Conducta y Reportes', path: '/gradebook?tab=REPORTS' },
                    { label: 'Portafolios', path: '/evaluation/portfolio' }
                ]
            },
            {
                icon: Calendar,
                label: 'Agenda y Horario',
                path: '#agenda',
                subItems: [
                    { label: 'Calendario Escolar', path: '/agenda' },
                    { label: 'Mi Horario', path: '/schedule' }
                ]
            }
        ],
        ADMIN: [
            { icon: LayoutDashboard, label: 'Consola de Gestión', path: '/' },
            { icon: Users, label: 'Personal y Accesos', path: '/admin/staff' },
            { icon: Mail, label: 'Comunicados', path: '/messages' },
            {
                icon: BarChart3,
                label: 'Institución',
                path: '#institution',
                subItems: [
                    { label: 'Módulo PEMC', path: '/admin/pemc' },
                    { label: 'Ciclo Escolar', path: '/settings' },
                    { label: 'Inventarios', path: '/inventory' },
                    { label: 'Estadísticas Globales', path: '/stats' }
                ]
            }
        ]
    }

    const workspaceType = (tenant as any)?.type || 'SCHOOL'
    let currentRole: string = (tenant as any)?.role || 'TEACHER'

    // Robust Role Enforcement for Independent Workspaces
    if (workspaceType === 'INDEPENDENT') {
        currentRole = 'INDEPENDENT_TEACHER'
    }

    // Robust Role Fallback: If it's an Independent workspace, always ensure Teacher context
    // REMOVED: We now have a dedicated INDEPENDENT_TEACHER menu support
    // if (workspaceType === 'INDEPENDENT' && currentRole !== 'TEACHER') {
    //    currentRole = 'TEACHER'
    // }

    const menuItems = menuByRole[currentRole] || menuByRole.TEACHER

    // Mobile App Restrictions (Capacitor)
    const isNative = Capacitor.isNativePlatform()
    let finalMenuItems = menuItems

    if (isNative) {
        // Only allow Dashboard (path='/') and Messages (path='/messages')
        finalMenuItems = menuItems.filter(item =>
            item.path === '/' ||
            item.path === '/messages' ||
            item.label === 'Mensajes' ||
            item.label === 'Comunicados'
        )
    }

    const principalMenu = finalMenuItems.filter(i => !i.path.startsWith('#'))
    const academicMenu = finalMenuItems.filter(i => i.path.startsWith('#'))

    return (
        <div className="min-h-screen bg-gray-50 flex">
            <NotificationManager />

            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
                    fixed lg:sticky lg:top-0 lg:h-screen inset-y-0 left-0 z-30
                    w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out
                    ${!isSidebarOpen ? '-translate-x-full lg:translate-x-0' : 'translate-x-0'}
                    print:hidden
                `}
            >
                <div className="h-full flex flex-col">
                    {/* Logo */}
                    <div className="h-16 flex items-center px-6 border-b border-gray-100">
                        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-xl mr-3 shadow-lg shadow-blue-200">
                            <Sparkles className="h-6 w-6 text-white" />
                        </div>
                        <span className="text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent tracking-tighter">
                            NEMIA
                        </span>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                        <MenuSection
                            title="PRINCIPAL"
                            items={principalMenu}
                            location={location}
                        />

                        {academicMenu.length > 0 && academicMenu.map((section: any) => (
                            <MenuSection
                                key={section.path}
                                title={section.label.toUpperCase()}
                                items={[section]}
                                location={location}
                            />
                        ))}
                    </nav>

                    {/* Bottom Actions */}
                    <div className="p-4 border-t border-gray-100 space-y-2">
                        <Link
                            to="/settings"
                            className="group flex items-center px-4 py-3 text-sm font-medium rounded-xl text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                        >
                            <Settings className="mr-3 h-5 w-5 text-gray-400 group-hover:text-blue-500" />
                            Configuración
                        </Link>
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center px-4 py-3 text-sm font-medium text-red-600 rounded-xl hover:bg-red-50 transition-colors"
                        >
                            <LogOut className="h-5 w-5 mr-3" />
                            Cerrar Sesión
                        </button>
                    </div>
                </div>
            </aside >

            {/* Main Content */}
            < div className="flex-1 flex flex-col min-h-screen transition-all duration-200 lg:ml-0" >
                {/* Header */}
                < header className={`
                    h-16 border-b sticky top-0 z-50 px-4 sm:px-6 lg:px-8 flex items-center justify-between transition-all duration-300 print:hidden
                    ${workspaceType === 'INDEPENDENT'
                        ? 'bg-indigo-50/30 border-indigo-100'
                        : 'bg-white border-gray-200'}
                `}>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 lg:hidden"
                        >
                            {!isSidebarOpen ? <Menu className="h-6 w-6" /> : <X className="h-6 w-6" />}
                        </button>

                        {workspaceType === 'INDEPENDENT' && (
                            <div className="hidden sm:flex items-center px-3 py-1 bg-indigo-600 text-white rounded-full shadow-lg shadow-indigo-100 animate-in fade-in zoom-in duration-500">
                                <span className="text-[10px] font-black uppercase tracking-widest flex items-center">
                                    <div className="w-1.5 h-1.5 bg-white rounded-full mr-2 animate-pulse" />
                                    Aula Privada
                                </span>
                            </div>
                        )}

                        <NotificationsMenu />

                        {/* Connectivity Indicators */}
                        <div className="flex items-center gap-2">
                            {isSyncing && (
                                <div className="flex items-center px-2 py-1 bg-blue-50 text-blue-600 rounded-lg animate-pulse border border-blue-100">
                                    <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />
                                    <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Sincronizando...</span>
                                </div>
                            )}
                            {!isOnline ? (
                                <div className="flex items-center px-2 py-1 bg-amber-50 text-amber-600 rounded-lg border border-amber-100">
                                    <AlertTriangle className="w-3 h-3 mr-1.5" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Offline</span>
                                    {pendingCount > 0 && (
                                        <span className="ml-1.5 bg-amber-600 text-white text-[9px] px-1.5 rounded-full font-black">
                                            {pendingCount}
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <div className="hidden sm:flex items-center px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
                                    <ShieldCheck className="w-3 h-3 mr-1.5" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">En línea</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Demo Mode Banner */}
                    {profile?.is_demo && (
                        <div className="flex-1 flex justify-center px-4">
                            <div className="flex items-center px-4 py-1.5 bg-red-600 text-white rounded-full shadow-lg shadow-red-200 animate-pulse">
                                <AlertTriangle className="w-4 h-4 mr-2" />
                                <span className="text-xs font-black uppercase tracking-widest whitespace-nowrap">
                                    Modo Demo: Solo Lectura
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Impersonation Mode Banner */}
                    {new URLSearchParams(window.location.search).get('impersonate') && (
                        <div className="flex-1 flex justify-center px-4">
                            <div className="flex items-center px-4 py-1.5 bg-purple-600 text-white rounded-full shadow-lg shadow-purple-200 animate-pulse border-2 border-white/20">
                                <Users className="w-4 h-4 mr-2" />
                                <span className="text-xs font-black uppercase tracking-widest whitespace-nowrap">
                                    Modo Dios: Simulado
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center space-x-4">
                        <div className="text-right hidden sm:block">
                            <p className="text-xs font-bold text-gray-900">{(tenant as any)?.fullName || 'Usuario'}</p>
                            <p className={`text-[10px] font-black uppercase tracking-wider ${workspaceType === 'INDEPENDENT' ? 'text-indigo-600' : 'text-gray-400'}`}>
                                {currentRole}
                            </p>
                        </div>
                        <div className={`
                            h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm overflow-hidden
                            ${workspaceType === 'INDEPENDENT' ? 'bg-indigo-600 text-white' : 'bg-blue-100 text-blue-700'}
                        `}>
                            {(tenant as any)?.avatarUrl ? (
                                <img
                                    src={(tenant as any).avatarUrl}
                                    alt="Avatar"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                (tenant as any)?.fullName?.[0] || 'U'
                            )}
                        </div>
                    </div>
                </header >

                {/* Page Content */}
                < main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto print:overflow-visible print:h-auto print:p-0" >
                    <Outlet />
                </main >
            </div >
        </div >
    )
}
