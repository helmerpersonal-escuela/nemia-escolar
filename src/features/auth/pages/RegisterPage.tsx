import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Capacitor } from '@capacitor/core'
import { School, User, Loader2, ArrowLeft, Mail, Lock, Building2, BookOpen, Check, X } from 'lucide-react'

type RegistrationMode = 'INDEPENDENT' | 'SCHOOL' | 'JOIN' | null

import { TermsModal } from '../../../components/auth/TermsModal'
import { PrivacyModal } from '../../../components/auth/PrivacyModal'

export const RegisterPage = () => {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const invitToken = searchParams.get('token')

    const [mode, setMode] = useState<RegistrationMode>(null)
    const [loading, setLoading] = useState(false)
    const [invitationInfo, setInvitationInfo] = useState<{ tenant_name: string, role: string, email: string } | null>(null)
    const [loadingInv, setLoadingInv] = useState(false)

    // Terms and Privacy State
    const [termsAccepted, setTermsAccepted] = useState(false)
    const [privacyAccepted, setPrivacyAccepted] = useState(false)
    const [showTerms, setShowTerms] = useState(false)
    const [showPrivacy, setShowPrivacy] = useState(false)

    const [isLoggedIn, setIsLoggedIn] = useState(false)
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
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

    const validateEmail = (email: string) => {
        const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
        return re.test(String(email).toLowerCase())
    }

    // Password Validation State
    const passwordCriteria = {
        length: formData.password.length >= 8,
        uppercase: /[A-Z]/.test(formData.password),
        number: /[0-9]/.test(formData.password),
        special: /[^A-Za-z0-9]/.test(formData.password)
    }

    const isPasswordValid = Object.values(passwordCriteria).every(Boolean)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!mode) return

        if (!validateEmail(formData.email)) {
            alert("Por favor ingresa un correo electrónico válido")
            return
        }

        if (!isPasswordValid) {
            alert("La contraseña no cumple con los requisitos de seguridad")
            return
        }

        if (formData.password !== formData.confirmPassword) {
            alert("Las contraseñas no coinciden")
            return
        }

        if (!termsAccepted) {
            alert("Debes aceptar los Términos y Condiciones para continuar")
            return
        }

        if (!privacyAccepted) {
            alert("Debes aceptar la Política de Privacidad para continuar")
            return
        }

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



    // UPDATE: User requested to restrict registration to Web only.
    // We check if it IS a native platform (iOS/Android) and block it.
    const isNativeApp = Capacitor.isNativePlatform();

    if (isNativeApp) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
                <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full text-center shadow-2xl">
                    <div className="w-24 h-24 bg-indigo-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
                        <School className="w-12 h-12 text-indigo-600 inflatable-icon" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 mb-3">Registro en Web Requerido</h2>
                    <p className="text-slate-500 font-medium mb-8 leading-relaxed">
                        Para garantizar una mejor experiencia de configuración, el registro de nuevas cuentas debe realizarse desde nuestra plataforma web.
                        <br /><br />
                        <span className="text-xs text-slate-400">Si ya tienes cuenta, puedes iniciar sesión aquí.</span>
                    </p>

                    <button
                        onClick={() => window.open('https://vunlek.com/registro', '_system')}
                        className="clay-button w-full py-4 bg-indigo-600 text-white rounded-xl font-black text-lg shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                    >
                        <User className="w-5 h-5" />
                        Ir al Portal Web
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
                    <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-[2rem] flex items-center justify-center mx-auto mb-8 border-2 border-white/20 shadow-2xl">
                        <BookOpen className="w-12 h-12 text-white inflatable-icon" />
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
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gradient-to-b from-purple-50 to-white relative overflow-hidden">
                {/* Mobile Background Elements */}
                <div className="absolute top-[-10%] right-[-10%] w-72 h-72 bg-purple-300/40 rounded-full blur-3xl lg:hidden pointer-events-none mix-blend-multiply"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-72 h-72 bg-indigo-300/40 rounded-full blur-3xl lg:hidden pointer-events-none mix-blend-multiply"></div>

                <div className="squishy-card max-w-xl w-full animate-in fade-in slide-in-from-right-8 duration-500 p-8 md:p-10 relative z-10">

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
                                {isLoggedIn && (
                                    <div className="mt-4 p-3 bg-gray-100/50 rounded-2xl border border-gray-100 flex items-center justify-between">
                                        <div className="text-left">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sesión actual</p>
                                            <p className="text-sm font-bold text-gray-700 truncate max-w-[150px]">{formData.email}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                await supabase.auth.signOut();
                                                window.location.reload();
                                            }}
                                            className="text-xs font-black text-indigo-600 hover:text-indigo-700 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 transition-all hover:scale-105 active:scale-95"
                                        >
                                            Cerrar Sesión
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 gap-6">
                                <button
                                    onClick={() => setMode('INDEPENDENT')}
                                    className="relative group p-8 bg-white border-2 border-gray-100 rounded-[2rem] hover:border-indigo-500 hover:shadow-2xl hover:shadow-indigo-100 hover:-translate-y-1 transition-all text-left flex items-start"
                                >
                                    <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600 mr-6 group-hover:scale-110 transition-transform shadow-inner">
                                        <User className="w-8 h-8 inflatable-icon" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-900 mb-1">Docente Independiente</h3>
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
                                    className="relative group p-8 bg-white border-2 border-gray-100 rounded-[2rem] hover:border-purple-500 hover:shadow-2xl hover:shadow-purple-100 hover:-translate-y-1 transition-all text-left flex items-start"
                                >
                                    <div className="p-4 bg-purple-50 rounded-2xl text-purple-600 mr-6 group-hover:scale-110 transition-transform shadow-inner">
                                        <School className="w-8 h-8 inflatable-icon" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-900 mb-1">Institución Educativa</h3>
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
                                <div className="inline-block p-4 rounded-[2rem] bg-indigo-50 text-indigo-600 mb-6 shadow-inner">
                                    {mode === 'INDEPENDENT' ? <User className="w-10 h-10 inflatable-icon" /> : <School className="w-10 h-10 inflatable-icon" />}
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
                                    <div>
                                        <p className="text-slate-500 text-sm font-medium">
                                            {isLoggedIn ? 'Esta configuración será independiente de tus otros espacios' : 'Completa tus datos para comenzar'}
                                        </p>
                                        {isLoggedIn && (
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    await supabase.auth.signOut();
                                                    window.location.reload();
                                                }}
                                                className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-2 hover:underline"
                                            >
                                                ¿No eres tú? Cerrar sesión
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Nombre(s)</label>
                                    <input
                                        name="firstName"
                                        type="text"
                                        required
                                        className="input-squishy block w-full px-4 py-3 font-bold text-slate-700 placeholder:text-slate-300 outline-none uppercase"
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
                                        className="input-squishy block w-full px-4 py-3 font-bold text-slate-700 placeholder:text-slate-300 outline-none uppercase"
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
                                    className="input-squishy block w-full px-4 py-3 font-bold text-slate-700 placeholder:text-slate-300 outline-none uppercase"
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
                                        className="input-squishy block w-full pl-12 pr-4 py-3 font-bold text-slate-700 placeholder:text-slate-300 outline-none uppercase disabled:opacity-50"
                                        placeholder={mode === 'INDEPENDENT' ? "SECUNDARIA TÉCNICA" : "INSTITUTO SECUNDARIO"}
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
                                        className="input-squishy block w-full pl-11 pr-4 py-3 font-bold text-slate-700 placeholder:text-slate-300 outline-none disabled:opacity-50"
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
                                        className="input-squishy block w-full pl-11 pr-4 py-3 font-bold text-slate-700 placeholder:text-slate-300 outline-none"
                                        placeholder="Contraseña segura"
                                        value={formData.password}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="space-y-2 mb-4">
                                    <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-widest">
                                        <span className={`flex items-center gap-1 ${passwordCriteria.length ? 'text-emerald-600' : 'text-gray-400'}`}>
                                            {passwordCriteria.length ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-gray-300" />} Min 8 caracteres
                                        </span>
                                        <span className={`flex items-center gap-1 ${passwordCriteria.uppercase ? 'text-emerald-600' : 'text-gray-400'}`}>
                                            {passwordCriteria.uppercase ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-gray-300" />} 1 Mayúscula
                                        </span>
                                        <span className={`flex items-center gap-1 ${passwordCriteria.number ? 'text-emerald-600' : 'text-gray-400'}`}>
                                            {passwordCriteria.number ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-gray-300" />} 1 Número
                                        </span>
                                        <span className={`flex items-center gap-1 ${passwordCriteria.special ? 'text-emerald-600' : 'text-gray-400'}`}>
                                            {passwordCriteria.special ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-gray-300" />} 1 Símbolo
                                        </span>
                                    </div>
                                </div>

                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                    </div>
                                    <input
                                        name="confirmPassword"
                                        type="password"
                                        required
                                        className={`input-squishy block w-full pl-11 pr-4 py-3 font-bold text-slate-700 placeholder:text-slate-300 outline-none ${formData.confirmPassword && formData.password !== formData.confirmPassword ? 'border-red-300 focus:border-red-500' : ''}`}
                                        placeholder="Confirmar contraseña"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                    />
                                    {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-red-500 text-xs font-bold uppercase">
                                            No coinciden
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4 my-6">
                                <div className="flex items-start">
                                    <div className="flex items-center h-5">
                                        <input
                                            id="terms"
                                            name="terms"
                                            type="checkbox"
                                            required
                                            checked={termsAccepted}
                                            onChange={(e) => setTermsAccepted(e.target.checked)}
                                            className="w-4 h-4 border border-gray-300 rounded bg-gray-50 focus:ring-3 focus:ring-indigo-300"
                                        />
                                    </div>
                                    <div className="ml-3 text-sm">
                                        <label htmlFor="terms" className="font-medium text-gray-700">
                                            Acepto los <button type="button" onClick={() => setShowTerms(true)} className="text-indigo-600 hover:underline font-bold">Términos y Condiciones de Uso</button>
                                        </label>
                                    </div>
                                </div>
                                <div className="flex items-start">
                                    <div className="flex items-center h-5">
                                        <input
                                            id="privacy"
                                            name="privacy"
                                            type="checkbox"
                                            required
                                            checked={privacyAccepted}
                                            onChange={(e) => setPrivacyAccepted(e.target.checked)}
                                            className="w-4 h-4 border border-gray-300 rounded bg-gray-50 focus:ring-3 focus:ring-indigo-300"
                                        />
                                    </div>
                                    <div className="ml-3 text-sm">
                                        <label htmlFor="privacy" className="font-medium text-gray-700">
                                            He leído y acepto la <button type="button" onClick={() => setShowPrivacy(true)} className="text-indigo-600 hover:underline font-bold">Política de Privacidad</button>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !termsAccepted || !privacyAccepted}

                                className="btn-tactile w-full flex justify-center items-center py-4 px-6 rounded-2xl text-base font-black text-white bg-gradient-to-r from-indigo-600 to-purple-600 shadow-xl shadow-indigo-200 hover:shadow-indigo-300 transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-8 uppercase tracking-widest"
                            >
                                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : (isLoggedIn ? 'Crear Espacio' : 'Registrar Cuenta')}
                            </button>
                        </form>
                    )}
                </div>
            </div>
            {/* Modals */}
            <TermsModal isOpen={showTerms} onClose={() => setShowTerms(false)} />
            <PrivacyModal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} />
        </div>
    )
}
