import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Capacitor } from '@capacitor/core'
import { School, User, Loader2, ArrowLeft, Mail, Lock, Building2, BookOpen } from 'lucide-react'

type RegistrationMode = 'INDEPENDENT' | 'SCHOOL' | 'JOIN' | null

export const RegisterPage = () => {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const invitToken = searchParams.get('token')

    const [mode, setMode] = useState<RegistrationMode>(null)
    const [loading, setLoading] = useState(false)
    const [invitationInfo, setInvitationInfo] = useState<{ tenant_name: string, role: string, email: string } | null>(null)
    const [loadingInv, setLoadingInv] = useState(false)

    const [isLoggedIn, setIsLoggedIn] = useState(false)
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        firstName: '',
        lastNamePaternal: '',
        lastNameMaternal: '',
        organizationName: '', // School Name
    })

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                setIsLoggedIn(true)
                setFormData(prev => ({
                    ...prev,
                    email: session.user.email || '',
                    firstName: session.user.user_metadata?.firstName || '',
                    lastNamePaternal: session.user.user_metadata?.lastNamePaternal || '',
                    lastNameMaternal: session.user.user_metadata?.lastNameMaternal || '',
                }))
            }
        })
    }, [])

    useEffect(() => {
        if (invitToken) {
            loadInvitation()
        }
    }, [invitToken])

    const loadInvitation = async () => {
        setLoadingInv(true)
        try {
            const { data, error } = await supabase
                .rpc('get_invitation_info', { token_uuid: invitToken })

            if (error) throw error
            if (data && data.length > 0) {
                const info = data[0]
                setInvitationInfo(info)
                setMode('SCHOOL')
                setFormData(prev => ({
                    ...prev,
                    email: info.email,
                    organizationName: info.tenant_name
                }))
            }
        } catch (err) {
            console.error('Error loading invitation:', err)
        } finally {
            setLoadingInv(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!mode) return

        setLoading(true)
        try {
            // Check if user is already logged in
            const { data: { session } } = await supabase.auth.getSession()

            if (session?.user) {
                // Scenario: Logged in user adding a new workspace
                const { data: newTenantId, error: rpcError } = await supabase.rpc('create_workspace', {
                    workspace_name: formData.organizationName,
                    workspace_type: mode === 'INDEPENDENT' ? 'INDEPENDENT' : 'SCHOOL',
                    workspace_role: mode === 'INDEPENDENT' ? 'TEACHER' : 'DIRECTOR'
                })

                if (rpcError) throw rpcError

                // Clear cache and navigate home
                window.location.href = '/'
                return
            }

            // Scenario: New user registration
            const { error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        firstName: formData.firstName,
                        lastNamePaternal: formData.lastNamePaternal,
                        lastNameMaternal: formData.lastNameMaternal,
                        organizationName: formData.organizationName,
                        mode: invitationInfo ? 'JOIN' : mode,
                        invitationToken: invitToken
                    }
                }
            })
            if (authError) throw authError

            navigate('/')

        } catch (error: any) {
            console.error('Registration error:', error)
            alert(error.message || 'Error al completar la operación')
        } finally {
            setLoading(false)
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        if (['firstName', 'lastNamePaternal', 'lastNameMaternal', 'organizationName'].includes(name)) {
            setFormData(prev => ({ ...prev, [name]: value.toUpperCase() }))
        } else {
            setFormData(prev => ({ ...prev, [name]: value }))
        }
    }

    if (Capacitor.isNativePlatform()) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
                <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full text-center shadow-2xl">
                    <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                        <School className="w-10 h-10 text-indigo-600" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 mb-3">Registro Web Requerido</h2>
                    <p className="text-slate-500 font-medium mb-8 leading-relaxed">
                        Para garantizar la seguridad y configuración correcta de tu institución, el registro de nuevas cuentas debe realizarse desde nuestra plataforma web.
                    </p>

                    <button
                        onClick={() => window.open('https://nemia.com/registro', '_system')}
                        className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-indigo-200 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
                    >
                        <User className="w-5 h-5" />
                        Crear Cuenta en Web
                    </button>

                    <div className="mt-6 pt-6 border-t border-gray-100">
                        <Link to="/login" className="text-indigo-600 font-bold hover:underline text-sm">
                            Ya tengo cuenta, Iniciar Sesión
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex bg-white">
            {/* Left Side - Hero Section */}
            <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative overflow-hidden items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/30 to-indigo-900/40 z-10" />
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=1974&auto=format&fit=crop')] bg-cover bg-center opacity-40 grayscale mix-blend-multiply" />

                <div className="relative z-20 max-w-xl px-12 text-center text-white">
                    <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center mx-auto mb-8 border border-white/20 shadow-2xl">
                        <BookOpen className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-4xl font-black mb-6 tracking-tight leading-tight">
                        Únete a la Revolución <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-300">Educativa</span>
                    </h1>
                    <p className="text-xl text-purple-100/80 font-medium leading-relaxed">
                        Herramientas profesionales para docentes y directores comprometidos con la excelencia académica.
                    </p>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50/50">
                <div className="max-w-xl w-full animate-in fade-in slide-in-from-right-8 duration-500">

                    {!mode ? (
                        /* Mode Selection */
                        <div className="space-y-8">
                            <div className="text-center">
                                <h2 className="text-3xl font-black text-slate-900 mb-2">
                                    {isLoggedIn ? 'Agregar Nuevo Espacio' : 'Crear nueva cuenta'}
                                </h2>
                                <p className="text-slate-500 font-medium">
                                    {isLoggedIn
                                        ? 'Crea un ambiente de trabajo independiente o institucional'
                                        : 'Selecciona cómo deseas utilizar la plataforma'}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-6">
                                <button
                                    onClick={() => setMode('INDEPENDENT')}
                                    className="relative group p-8 bg-white border-2 border-gray-100 rounded-3xl hover:border-indigo-500 hover:shadow-xl hover:-translate-y-1 transition-all text-left flex items-start"
                                >
                                    <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600 mr-6 group-hover:scale-110 transition-transform">
                                        <User className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900 mb-1">Docente Independiente</h3>
                                        <p className="text-sm text-slate-500 font-medium leading-relaxed">
                                            Gestiona tus propios grupos, calificaciones y planeaciones de forma privada. Ideal para profesores frente a grupo.
                                        </p>
                                    </div>
                                    <div className="absolute top-8 right-8 text-gray-300 group-hover:text-indigo-500 transition-colors">
                                        <ArrowLeft className="w-6 h-6 rotate-180" />
                                    </div>
                                </button>

                                <button
                                    onClick={() => setMode('SCHOOL')}
                                    className="relative group p-8 bg-white border-2 border-gray-100 rounded-3xl hover:border-purple-500 hover:shadow-xl hover:-translate-y-1 transition-all text-left flex items-start"
                                >
                                    <div className="p-4 bg-purple-50 rounded-2xl text-purple-600 mr-6 group-hover:scale-110 transition-transform">
                                        <School className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900 mb-1">Institución Educativa</h3>
                                        <p className="text-sm text-slate-500 font-medium leading-relaxed">
                                            Administra múltiples docentes, grupos y personal. Panel directivo centralizado para toda la escuela.
                                        </p>
                                    </div>
                                    <div className="absolute top-8 right-8 text-gray-300 group-hover:text-purple-500 transition-colors">
                                        <ArrowLeft className="w-6 h-6 rotate-180" />
                                    </div>
                                </button>
                            </div>

                            <div className="text-center">
                                <span className="text-slate-500 font-medium mr-2">¿Ya tienes cuenta?</span>
                                <Link to="/login" className="text-indigo-600 font-bold hover:underline">
                                    Iniciar Sesión
                                </Link>
                            </div>
                        </div>
                    ) : (
                        /* Registration Form */
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <button
                                type="button"
                                onClick={() => setMode(null)}
                                className="flex items-center text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors mb-6"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Volver a selección
                            </button>

                            <div className="text-center mb-8">
                                <div className="inline-block p-3 rounded-2xl bg-indigo-50 text-indigo-600 mb-4">
                                    {mode === 'INDEPENDENT' ? <User className="w-8 h-8" /> : <School className="w-8 h-8" />}
                                </div>
                                <h2 className="text-2xl font-black text-slate-900">
                                    {invitationInfo
                                        ? 'Completar Registro'
                                        : isLoggedIn
                                            ? (mode === 'INDEPENDENT' ? 'Nuevo Espacio Docente' : 'Nueva Institución')
                                            : (mode === 'INDEPENDENT' ? 'Registro Docente' : 'Registro Institucional')}
                                </h2>
                                {invitationInfo ? (
                                    <div className="mt-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                                        <p className="text-sm font-bold text-indigo-900">
                                            Uniéndote a <span className="text-indigo-600">{invitationInfo.tenant_name}</span>
                                        </p>
                                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-1">
                                            Rol: {invitationInfo.role}
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-slate-500 text-sm font-medium">
                                        {isLoggedIn ? 'Esta configuración será independiente de tus otros espacios' : 'Completa tus datos para comenzar'}
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Nombre(s)</label>
                                    <input
                                        name="firstName"
                                        type="text"
                                        required
                                        className="block w-full px-4 py-3 bg-white border-2 border-gray-100 rounded-xl text-gray-900 font-bold placeholder-gray-300 focus:outline-none focus:border-indigo-500 transition-all uppercase"
                                        placeholder="JUAN"
                                        value={formData.firstName}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Apellido Paterno</label>
                                    <input
                                        name="lastNamePaternal"
                                        type="text"
                                        required
                                        className="block w-full px-4 py-3 bg-white border-2 border-gray-100 rounded-xl text-gray-900 font-bold placeholder-gray-300 focus:outline-none focus:border-indigo-500 transition-all uppercase"
                                        placeholder="PÉREZ"
                                        value={formData.lastNamePaternal}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Apellido Materno</label>
                                <input
                                    name="lastNameMaternal"
                                    type="text"
                                    required
                                    className="block w-full px-4 py-3 bg-white border-2 border-gray-100 rounded-xl text-gray-900 font-bold placeholder-gray-300 focus:outline-none focus:border-indigo-500 transition-all uppercase"
                                    placeholder="LÓPEZ"
                                    value={formData.lastNameMaternal}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                                    {mode === 'INDEPENDENT' ? 'Nombre de tu Escuela / Proyecto' : 'Nombre de la Institución'}
                                </label>
                                <div className="relative">
                                    <Building2 className="absolute top-3.5 left-4 w-5 h-5 text-gray-400" />
                                    <input
                                        name="organizationName"
                                        type="text"
                                        required
                                        disabled={!!invitationInfo}
                                        className="block w-full pl-12 pr-4 py-3 bg-white border-2 border-gray-100 rounded-xl text-gray-900 font-bold placeholder-gray-300 focus:outline-none focus:border-indigo-500 transition-all uppercase disabled:bg-gray-50 disabled:text-gray-400"
                                        placeholder={mode === 'INDEPENDENT' ? "ESC. PRIMARIA BENITO JUÁREZ" : "INSTITUTO CULTURAL"}
                                        value={formData.organizationName}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>

                            <div className="border-t border-gray-100 my-6"></div>

                            <div className="space-y-4">
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                    </div>
                                    <input
                                        name="email"
                                        type="email"
                                        required
                                        disabled={!!invitationInfo}
                                        className="block w-full pl-11 pr-4 py-3 bg-white border-2 border-gray-100 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition-all font-medium disabled:bg-gray-50 disabled:text-gray-400"
                                        placeholder="correo@ejemplo.com"
                                        value={formData.email}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                    </div>
                                    <input
                                        name="password"
                                        type="password"
                                        required
                                        className="block w-full pl-11 pr-4 py-3 bg-white border-2 border-gray-100 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition-all font-medium"
                                        placeholder="Contraseña segura"
                                        value={formData.password}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center items-center py-4 px-6 border border-transparent rounded-2xl text-base font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all shadow-lg shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed mt-8 hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : (isLoggedIn ? 'Crear Espacio' : 'Registrar Cuenta')}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
