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
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full space-y-8 animate-in fade-in zoom-in duration-300">
                <div className="text-center">
                    <div className="inline-flex p-4 bg-white rounded-[2rem] shadow-sm mb-6 border border-gray-100">
                        <Settings className="w-10 h-10 text-gray-400" />
                    </div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">¿Cómo ingresarás hoy?</h1>
                    <p className="text-gray-500 font-medium mt-2">Selecciona el rol que deseas utilizar para esta sesión.</p>
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
                                    w-full flex items-center p-6 bg-white rounded-3xl border-2 transition-all group
                                    ${switching === null ? 'hover:border-blue-500 hover:shadow-xl hover:shadow-blue-900/5' : 'opacity-50'}
                                    ${isSwitching ? 'border-blue-500 ring-4 ring-blue-50' : 'border-gray-100'}
                                `}
                            >
                                <div className={`p-4 rounded-2xl ${config.lightColor} ${config.color} group-hover:scale-110 transition-transform`}>
                                    <config.icon className="w-6 h-6" />
                                </div>
                                <div className="ml-5 text-left flex-1">
                                    <h3 className="text-lg font-black text-gray-900 leading-tight">{config.label}</h3>
                                    <p className="text-sm text-gray-400 font-medium">{config.description}</p>
                                </div>
                                {isSwitching ? (
                                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                                ) : (
                                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                                )}
                            </button>
                        )
                    })}
                </div>

                <p className="text-center text-xs text-gray-400 font-medium">
                    Puedes cambiar de rol en cualquier momento desde el menú lateral.
                </p>
            </div>
        </div>
    )
}
