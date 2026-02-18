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
import { TrialNotificationSystem } from '../../features/subscription/components/TrialNotificationSystem'

const MenuSection = ({ title, items, location }: any) => {
    return (
        <section className="mb-6" aria-labelledby={`section-title-${title.toLowerCase().replace(/\s+/g, '-')}`}>
            <h3
                id={`section-title-${title.toLowerCase().replace(/\s+/g, '-')}`}
                className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 opacity-80"
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
    const isActiveParent = hasSubItems && item.subItems.some((sub: any) => location.pathname.startsWith(sub.path))
    const [isOpen, setIsOpen] = useState(isActiveParent)

    useEffect(() => {
        if (isActiveParent) setIsOpen(true)
    }, [isActiveParent])

    if (hasSubItems) {
        return (
            <div className="mb-2">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`
                        w-full flex items-center justify-between px-4 py-3 text-sm font-bold rounded-2xl transition-all duration-300 btn-tactile
                        ${isActiveParent
                            ? 'bg-indigo-100/50 text-indigo-700 shadow-sm'
                            : 'text-slate-500 hover:bg-white/50 hover:text-slate-900 hover:shadow-sm'}
                    `}
                >
                    <div className="flex items-center">
                        <div className={`p-1.5 rounded-xl mr-3 transition-colors ${isActiveParent ? 'bg-indigo-200 text-indigo-700' : 'bg-transparent text-slate-400'}`}>
                            <item.icon className="h-5 w-5" />
                        </div>
                        {item.label}
                    </div>
                    {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                </button>
                {isOpen && (
                    <div className="ml-4 mt-2 space-y-1 border-l-2 border-indigo-100/50 pl-3 animate-in fade-in slide-in-from-left-2 duration-300">
                        {item.subItems.map((sub: any, idx: number) => {
                            const isSubActive = (location.pathname + location.search) === sub.path || location.pathname === sub.path
                            return (
                                <Link
                                    key={`${sub.path}-${idx}`}
                                    to={sub.path}
                                    className={`
                                        block px-4 py-2 text-sm rounded-xl transition-all duration-200 btn-tactile
                                        ${isSubActive
                                            ? 'text-indigo-700 font-bold bg-indigo-50 shadow-sm translate-x-1'
                                            : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'}
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
            className={`
                flex items-center px-4 py-3 text-sm font-bold rounded-2xl transition-all duration-300 mb-1 btn-tactile
                ${isActive
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transform scale-[1.02]'
                    : 'text-slate-500 hover:bg-white/50 hover:text-slate-900 hover:shadow-sm'
                }
            `}
        >
            <div className={`p-1.5 rounded-xl mr-3 transition-colors ${isActive ? 'bg-white/20 text-white' : 'bg-transparent text-slate-400'}`}>
                <item.icon className="h-5 w-5" />
            </div>
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
    const { profile, isLoading: isProfileLoading, isSuperAdmin = false } = useProfile()
    const { isOnline, pendingCount, isSyncing } = useOfflineSync()

    // Derived states
    // Use window.location.search directly to be absolute even across re-renders
    const isApprovedParam = new URLSearchParams(window.location.search).get('status') === 'approved'
    const isSyncPersistent = sessionStorage.getItem('vunlek_payment_syncing') === 'true'
    const showOnboarding = tenant ? (tenant.onboardingCompleted === false && !isApprovedParam && !isSyncPersistent) : false

    // Attendance Reminder Hook
    useAttendanceReminder()

    // Auto-close sidebar on route change (Mobile UX Only)
    useEffect(() => {
        if (window.innerWidth < 1024) {
            setIsSidebarOpen(false)
        }
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

    useEffect(() => {
        const checkPaymentStatus = async () => {
            const params = new URLSearchParams(window.location.search)
            const status = params.get('status')

            // Trigger sync if we have the param OR the persistent flag
            if ((status === 'approved' || isSyncPersistent) && !isSynchronizing) {
                setIsSynchronizing(true)

                try {
                    // Try to get tenantId from external_reference (most reliable)
                    let targetTenantId = tenant?.id
                    // ... rest of logic stays similar but we use the targetTenantId to finish ...
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

                        // Clear cache aggressively
                        queryClient.clear()

                        // Clean URL
                        const url = new URL(window.location.href)
                        url.search = ""
                        window.history.replaceState({}, '', url.toString())

                        // Small delay for DB propagation
                        await new Promise(resolve => setTimeout(resolve, 3000))

                        // Force hard redirect to home - ensures everything is fresh
                        window.location.href = '/'
                    } else {
                        throw new Error("No se pudo identificar tu cuenta escolar automáticamente.")
                    }
                } catch (err: any) {
                    console.error("DASHBOARD_LAYOUT: Sync error:", err)
                    setSyncError(err.message || "Error desconocido al activar suscripción")
                } finally {
                    // We don't hide the overlay on error so the user sees the message
                    // and doesn't get redirected to Step 1 instantly
                    if (!syncError) {
                        setIsSynchronizing(false)
                    }
                }
            }
        }

        checkPaymentStatus()
    }, [location.search, tenant?.id])

    // Cleanup sync flag if onboarding is completed
    useEffect(() => {
        if (tenant?.onboardingCompleted === true) {
            sessionStorage.removeItem('vunlek_payment_syncing')
        }
    }, [tenant?.onboardingCompleted])

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

    const handleLogout = async () => {
        await supabase.auth.signOut()
        window.location.href = '/login'
    }

    const handleSwitchRole = () => {
        navigate('/select-role')
    }

    // Nuclear Fix Overlay - Prioritized over loading to show instant feedback after payment
    if (isSynchronizing || syncError || isApprovedParam || isSyncPersistent) {
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

    // Only show global loading if we have NO data. 
    // This prevents unmounting child pages (like editors or the wizard) during background refetches (e.g. on window resize/focus)
    const isActuallyLoading = (isTenantLoading && !tenant) || (isProfileLoading && !profile);
    if (isActuallyLoading) {
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

    // If we're not loading and don't have core data, handle it
    if (!profile) return null;

    // Race Condition Handling:
    // If we have a profile but NO tenant, it means the trigger is still running
    // or failed. We show a "Setting up" state instead of blank screen.
    if (!tenant) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
                <div className="text-center max-w-md animate-in fade-in duration-700">
                    <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-indigo-100">
                        <Sparkles className="w-10 h-10 animate-pulse" />
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">Preparando tu Espacio</h2>
                    <p className="text-slate-500 font-medium mb-8 leading-relaxed">
                        Estamos configurando tu entorno escolar seguro. Esto solo tomará unos segundos...
                    </p>
                    <div className="flex justify-center">
                        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-12 text-xs font-bold text-slate-400 hover:text-indigo-500 uppercase tracking-widest transition-colors"
                    >
                        ¿Tarda demasiado? Recargar
                    </button>
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
                label: 'Herramientas',
                path: '#evaluation_tools',
                subItems: [
                    { label: 'Libreta (Calificaciones)', path: '/gradebook' },
                    { label: 'Bitácora de Conducta', path: '/gradebook?tab=REPORTS' },
                    { label: 'Portafolio de Alumnos', path: '/evaluation/portfolio' },
                    { label: 'Herramientas Formativas', path: '/evaluation/formative' }
                ]
            },
            {
                icon: ClipboardList,
                label: 'Gestión',
                path: '#planning_mgmt',
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
                    { label: 'Asistencia', path: '/attendance' },
                    { label: 'Calendario Escolar', path: '/agenda' },
                    { label: 'Mi Horario', path: '/schedule' }
                ]
            },
            {
                icon: ClipboardList,
                label: 'Gestión',
                path: '#planning_mgmt',
                subItems: [
                    { label: 'Mis Planeaciones', path: '/planning' },
                    { label: 'Programa Analítico', path: '/analytical-program' },
                    { label: 'Rúbricas', path: '/rubrics' },
                    { label: 'Guardias (Ausencias)', path: '/absences' }
                ]
            },
            {
                icon: CheckSquare,
                label: 'Herramientas',
                path: '#evaluation_tools',
                subItems: [
                    { label: 'Calificaciones', path: '/gradebook' },
                    { label: 'Conducta y Reportes', path: '/gradebook?tab=REPORTS' },
                    { label: 'Portafolios', path: '/evaluation/portfolio' }
                ]
            },

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
        <div className="min-h-screen bg-slate-50/50 flex overflow-hidden">
            <NotificationManager />
            <TrialNotificationSystem />

            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 lg:hidden animate-in fade-in duration-300"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
                    fixed lg:static inset-y-0 left-0 z-40
                    w-72 transform transition-all duration-300 ease-elastic
                    ${!isSidebarOpen ? '-translate-x-full' : 'translate-x-0'}
                    lg:static lg:translate-x-0 lg:block lg:m-4 lg:rounded-[2.5rem] lg:h-[calc(100vh-2rem)]
                    glass-panel flex flex-col overflow-hidden border-2 border-white/60
                    pb-[env(safe-area-inset-bottom)]
                `}
            >
                <div className="h-full flex flex-col relative">
                    {/* Decorative Blob */}
                    <div className="absolute -top-20 -left-20 w-40 h-40 bg-indigo-200/50 rounded-full blur-3xl pointer-events-none" />

                    {/* Logo */}
                    <div className="h-24 flex items-center px-8 relative z-10">
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-2xl mr-3 shadow-lg shadow-indigo-200 hover:scale-110 transition-transform cursor-pointer">
                            <Sparkles className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <span className="text-2xl font-black text-slate-800 tracking-tight block leading-none">
                                VUNLEK
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-0.5">
                                Escolar
                            </span>
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-4 py-2 space-y-4 overflow-y-auto scrollbar-hide">
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
                    <div className="p-4 bg-white/40 backdrop-blur-md border-t border-indigo-50 space-y-2">
                        <Link
                            to="/settings"
                            className="group flex items-center px-4 py-3 text-sm font-bold rounded-2xl text-slate-600 hover:bg-white hover:text-indigo-600 transition-all shadow-sm border border-transparent hover:border-indigo-50 btn-tactile"
                        >
                            <Settings className="mr-3 h-5 w-5 text-slate-400 group-hover:text-indigo-500" />
                            Configuración
                        </Link>
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center px-4 py-3 text-sm font-bold text-red-500 rounded-2xl hover:bg-red-50 hover:text-red-600 transition-all border border-transparent hover:border-red-100 btn-tactile"
                        >
                            <LogOut className="h-5 w-5 mr-3" />
                            Cerrar Sesión
                        </button>
                    </div>
                </div>
            </aside >

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-screen relative overflow-hidden transition-all duration-300">
                {/* Header */}
                <header className={`
                    h-20 px-4 sm:px-8 flex items-center justify-between transition-all duration-300 z-20 mt-4 mx-4 rounded-[2rem]
                    ${workspaceType === 'INDEPENDENT'
                        ? 'bg-indigo-900/5 backdrop-blur-md border border-indigo-100/50'
                        : 'glass-panel'}
                `}>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="p-3 rounded-2xl hover:bg-white/50 text-slate-500 lg:hidden btn-tactile shadow-sm"
                        >
                            {!isSidebarOpen ? <Menu className="h-6 w-6" /> : <X className="h-6 w-6" />}
                        </button>

                        <div className="flex flex-col">
                            <h1 className="text-xl font-black text-slate-800 tracking-tight hidden sm:block">
                                {workspaceType === 'INDEPENDENT' ? 'Aula Privada' : 'Panel de Control'}
                            </h1>
                            <p className="text-xs text-slate-400 font-bold hidden sm:block">
                                {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Connectivity Indicators */}
                        <div className="hidden md:flex items-center gap-2">
                            {isSyncing && (
                                <div className="flex items-center px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl animate-pulse border border-blue-100 shadow-sm">
                                    <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Sincronizando</span>
                                </div>
                            )}
                            {!isOnline ? (
                                <div className="flex items-center px-3 py-1.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 shadow-sm">
                                    <AlertTriangle className="w-3.5 h-3.5 mr-2" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Offline</span>
                                </div>
                            ) : (
                                <div className="flex items-center px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shadow-sm">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">En Línea</span>
                                </div>
                            )}
                        </div>

                        <div className="h-8 w-[1px] bg-slate-200 mx-2 hidden sm:block" />

                        <NotificationsMenu />
                        {/* Only show WorkspaceSwitcher for SUPER_ADMINs to allow switching to God Mode */}
                        {(isSuperAdmin || (profile as any)?.isSuperAdmin) && (
                            <div className="w-64">
                                <WorkspaceSwitcher />
                            </div>
                        )}
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-8 relative scroll-smooth">
                    {/* Demo Mode Banner */}
                    {profile?.is_demo && (
                        <div className="mb-6 animate-in slide-in-from-top-4 duration-500">
                            <div className="flex items-center justify-center p-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-2xl shadow-lg shadow-red-200">
                                <AlertTriangle className="w-5 h-5 mr-2 animate-bounce" />
                                <span className="text-sm font-black uppercase tracking-widest">Modo Demo: Solo Lectura</span>
                            </div>
                        </div>
                    )}

                    {/* Impersonation Mode Banner */}
                    {profile?.isImpersonating && (
                        <div className="mb-6 animate-in slide-in-from-top-4 duration-500">
                            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl shadow-lg shadow-purple-200 border-2 border-white/20">
                                <div className="flex items-center">
                                    <Users className="w-5 h-5 mr-3 animate-pulse" />
                                    <span className="text-sm font-black uppercase tracking-widest">Modo Dios Activo: {profile.first_name} {profile.last_name_paternal}</span>
                                </div>
                                <button
                                    onClick={() => {
                                        sessionStorage.removeItem('vunlek_impersonate_id')
                                        window.location.href = '/admin' // Or just refresh
                                    }}
                                    className="px-4 py-1.5 bg-white/20 hover:bg-white/40 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all"
                                >
                                    Salir de Simulación
                                </button>
                            </div>
                        </div>
                    )}

                    <Outlet />
                </main>
            </div>
        </div>
    )
}
