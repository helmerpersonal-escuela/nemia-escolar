import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import {
    Shield,
    User,
    GraduationCap,
    Settings,
    ChevronRight,
    Loader2,
    ShieldAlert,
    HeartHandshake,
    ClipboardList,
    BarChart3
} from 'lucide-react'

export const RoleSelectionPage = () => {
    const navigate = useNavigate()
    const [roles, setRoles] = useState<string[]>([])
    const [loading, setLoading] = useState(true)
    const [switching, setSwitching] = useState<string | null>(null)

    useEffect(() => {
        loadUserRoles()
    }, [])

    const loadUserRoles = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                navigate('/login')
                return
            }

            const { data, error } = await supabase
                .from('profile_roles')
                .select('role')
                .eq('profile_id', user.id)

            if (error) throw error

            const rolesList = data.map(r => r.role)
            setRoles(rolesList)

            // If only one role, just stay with it and go home (this case shouldn't usually reach here if redirected correctly)
            if (rolesList.length === 1) {
                handleRoleSelect(rolesList[0])
            }
        } catch (error) {
            console.error('Error loading roles:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleRoleSelect = async (role: string) => {
        setSwitching(role)
        try {
            const { error } = await supabase.rpc('switch_active_role', { new_role: role })
            if (error) throw error

            // Refresh and go to dashboard
            window.location.href = '/'
        } catch (error: any) {
            alert('Error al cambiar de rol: ' + error.message)
            setSwitching(null)
        }
    }

    const getRoleConfig = (role: string) => {
        switch (role) {
            case 'ADMIN':
            case 'SUPER_ADMIN':
            case 'DIRECTOR':
                return {
                    label: 'Administrador',
                    description: 'Gestión institucional, personal y finanzas',
                    icon: Shield,
                    color: 'bg-blue-600',
                    lightColor: 'bg-blue-50'
                }
            case 'TEACHER':
                return {
                    label: 'Docente',
                    description: 'Gestión de grupos, planeación y evaluación',
                    icon: GraduationCap,
                    color: 'text-emerald-600',
                    bgColor: 'bg-emerald-600',
                    lightColor: 'bg-emerald-50'
                }
            case 'PREFECT':
                return {
                    label: 'Prefecto',
                    description: 'Seguridad, disciplina y monitoreo de campus',
                    icon: ShieldAlert,
                    color: 'text-amber-600',
                    bgColor: 'bg-amber-600',
                    lightColor: 'bg-amber-50'
                }
            case 'SUPPORT':
                return {
                    label: 'Apoyo Educativo',
                    description: 'Psicopedagogía y seguimiento de casos',
                    icon: HeartHandshake,
                    color: 'text-rose-600',
                    bgColor: 'bg-rose-600',
                    lightColor: 'bg-rose-50'
                }
            case 'SCHOOL_CONTROL':
                return {
                    label: 'Control Escolar',
                    description: 'Administración de expedientes y boletas',
                    icon: ClipboardList,
                    color: 'text-indigo-600',
                    bgColor: 'bg-indigo-600',
                    lightColor: 'bg-indigo-50'
                }
            case 'ACADEMIC_COORD':
            case 'TECH_COORD':
                return {
                    label: 'Coordinación',
                    description: 'Supervisión académica y técnica',
                    icon: BarChart3,
                    color: 'text-purple-600',
                    bgColor: 'bg-purple-600',
                    lightColor: 'bg-purple-50'
                }
            case 'STUDENT':
                return {
                    label: 'Alumno',
                    description: 'Consulta de calificaciones y avisos',
                    icon: User,
                    color: 'text-blue-600',
                    bgColor: 'bg-blue-600',
                    lightColor: 'bg-blue-50'
                }
            case 'TUTOR':
                return {
                    label: 'Padre / Tutor',
                    description: 'Seguimiento académico de mis hijos',
                    icon: HeartHandshake,
                    color: 'text-rose-600',
                    bgColor: 'bg-rose-600',
                    lightColor: 'bg-rose-50'
                }
            default:
                return {
                    label: role,
                    description: 'Acceso a funciones del sistema',
                    icon: Shield,
                    color: 'text-gray-600',
                    bgColor: 'bg-gray-600',
                    lightColor: 'bg-gray-50'
                }
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="max-w-md w-full space-y-8 animate-in fade-in zoom-in duration-300">
                <div className="text-center">
                    <div className="inline-flex p-5 bg-white rounded-[2rem] shadow-lg shadow-indigo-100 mb-8 border border-white/50">
                        <Settings className="w-12 h-12 text-indigo-400 inflatable-icon" />
                    </div>
                    <h1 className="text-4xl font-black text-slate-800 tracking-tight leading-tight">
                        ¿Cómo ingresarás <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500">hoy?</span>
                    </h1>
                    <p className="text-slate-500 font-bold mt-4 text-lg">Selecciona tu perfil para continuar.</p>
                </div>

                <div className="space-y-4">
                    {roles.map((role) => {
                        const config = getRoleConfig(role)
                        const isSwitching = switching === role

                        return (
                            <button
                                key={role}
                                onClick={() => handleRoleSelect(role)}
                                disabled={switching !== null}
                                className={`
                                    w-full flex items-center p-6 bg-white rounded-3xl border-2 transition-all group squishy-card text-left
                                    ${switching === null ? 'hover:border-indigo-200 hover:shadow-2xl hover:shadow-indigo-100 hover:-translate-y-1' : 'opacity-50'}
                                    ${isSwitching ? 'border-indigo-500 ring-4 ring-indigo-50' : 'border-white'}
                                `}
                            >
                                <div className={`p-4 rounded-2xl ${config.lightColor} ${config.color} group-hover:scale-110 transition-transform shadow-inner`}>
                                    <config.icon className="w-8 h-8 inflatable-icon" />
                                </div>
                                <div className="ml-5 flex-1">
                                    <h3 className="text-xl font-black text-slate-800 leading-none mb-1">{config.label}</h3>
                                    <p className="text-sm text-slate-400 font-bold">{config.description}</p>
                                </div>
                                {isSwitching ? (
                                    <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
                                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                                    </div>
                                )}
                            </button>
                        )
                    })}
                </div>

                <p className="text-center text-xs text-slate-400 font-bold uppercase tracking-widest">
                    Puedes cambiar de rol desde el menú lateral
                </p>
            </div>
        </div>
    )
}
