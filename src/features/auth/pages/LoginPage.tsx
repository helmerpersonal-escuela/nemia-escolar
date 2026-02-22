import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { ShieldCheck, Sparkles, Loader2, Lock, Mail, ArrowRight, AlertTriangle } from 'lucide-react'

export const LoginPage = () => {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [forgotMode, setForgotMode] = useState(false)
    const [resetSent, setResetSent] = useState(false)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const cleanEmail = email.replace(/\s+/g, '').toLowerCase()
            const { error } = await supabase.auth.signInWithPassword({
                email: cleanEmail,
                password: password.trim(),
            })

            if (error) throw error
        } catch (err: any) {
            console.error('Captura de error en LoginPage:', err)
            setError(err.message === 'Invalid login credentials'
                ? 'Credenciales incorrectas. Por favor verifica tu correo y contraseña.'
                : err.message)
            alert("Error de Inicio de Sesión: " + err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const cleanEmail = email.replace(/\s+/g, '').toLowerCase()
            const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
                redirectTo: `${window.location.origin}/reset-password`,
            })

            if (error) throw error
            setResetSent(true)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex bg-white">
            {/* Left Side - Hero Section */}
            <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative overflow-hidden items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/30 to-blue-900/40 z-10" />
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1524178232363-1fb2b075b655?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-40 grayscale mix-blend-multiply" />

                <div className="relative z-20 max-w-xl px-12 text-center text-white">
                    <div className="w-24 h-24 bg-white/10 backdrop-blur-md rounded-[2rem] flex items-center justify-center mx-auto mb-8 border-2 border-white/20 shadow-2xl">
                        <Sparkles className="w-12 h-12 text-white inflatable-icon" />
                    </div>
                    <h1 className="text-5xl font-black mb-6 tracking-tight leading-tight">
                        VUNLEK <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">Inteligencia Escolar</span>
                    </h1>
                    <p className="text-xl text-blue-100/80 font-medium leading-relaxed">
                        Optimiza la administración académica, planeación didáctica y seguimiento de alumnos en una sola plataforma unificada.
                    </p>
                </div>
            </div>

            {/* Right Side - Form Section */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gradient-to-b from-indigo-50 to-white relative overflow-hidden">
                <div className="squishy-card max-w-md w-full animate-in fade-in slide-in-from-right-8 duration-500 p-8 md:p-10 relative z-10">
                    <div className="text-center mb-10">
                        <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-200 lg:hidden">
                            <Sparkles className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-3xl font-black text-slate-800 mb-2 tracking-tight">
                            {resetSent ? 'Revisa tu correo' : (forgotMode ? 'Recuperar Acceso' : 'Bienvenido')}
                        </h2>
                        <p className="text-slate-500 font-bold">
                            {resetSent ? 'Te enviamos instrucciones para volver a entrar' : (forgotMode ? 'Ingresa tu correo institucional' : 'Ingresa a tu espacio digital')}
                        </p>
                    </div>

                    {!resetSent ? (
                        <form onSubmit={forgotMode ? handleResetPassword : handleLogin} className="space-y-6">
                            <div className="space-y-5">
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Mail className="h-5 w-5 text-indigo-300 group-focus-within:text-indigo-500 transition-colors" />
                                    </div>
                                    <input
                                        type="email"
                                        required
                                        className="input-squishy block w-full pl-11 pr-4 py-4 font-bold text-slate-700 placeholder:text-slate-300"
                                        placeholder="correo@institucion.edu"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>

                                {!forgotMode && (
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Lock className="h-5 w-5 text-indigo-300 group-focus-within:text-indigo-500 transition-colors" />
                                        </div>
                                        <input
                                            type="password"
                                            required
                                            className="input-squishy block w-full pl-11 pr-4 py-4 font-bold text-slate-700 placeholder:text-slate-300"
                                            placeholder="••••••••••••"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            autoCapitalize="none"
                                            autoCorrect="off"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-end">
                                <button
                                    type="button"
                                    onClick={() => { setForgotMode(!forgotMode); setError(null); }}
                                    className="text-sm font-bold text-indigo-500 hover:text-indigo-700 hover:underline transition-all"
                                >
                                    {forgotMode ? 'Volver al Inicio' : '¿Olvidaste tu contraseña?'}
                                </button>
                            </div>

                            {error && (
                                <div className="p-4 rounded-2xl bg-red-50 border-2 border-red-100 text-red-500 text-sm font-black flex items-center animate-in shake">
                                    <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0" />
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center items-center py-4 px-6 rounded-2xl text-base font-black text-white bg-gradient-to-r from-indigo-600 to-purple-600 shadow-xl shadow-indigo-200 hover:shadow-indigo-300 transition-all disabled:opacity-70 disabled:cursor-not-allowed uppercase tracking-widest btn-tactile"
                            >
                                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : (
                                    <>
                                        {forgotMode ? 'Enviar Instrucciones' : 'Iniciar Sesión'}
                                        <ArrowRight className="ml-2 w-5 h-5" />
                                    </>
                                )}
                            </button>
                        </form>
                    ) : (
                        <div className="space-y-8 animate-in zoom-in duration-300">
                            <div className="bg-emerald-50 p-6 rounded-3xl border-2 border-emerald-100 text-emerald-800 text-sm font-medium leading-relaxed">
                                Hemos enviado un enlace de recuperación a <b>{email}</b>. Por favor revisa tu bandeja de entrada y correo no deseado.
                            </div>
                            <button
                                onClick={() => { setResetSent(false); setForgotMode(false); }}
                                className="w-full py-4 text-slate-500 font-black uppercase tracking-widest text-xs hover:bg-slate-50 rounded-2xl transition-all"
                            >
                                Volver al login
                            </button>
                        </div>
                    )}

                    <div className="mt-10 text-center space-y-6">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t-2 border-slate-100"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-4 bg-white text-slate-400 font-bold uppercase tracking-wider">Soporte Técnico</span>
                            </div>
                        </div>

                        <p className="text-xs text-slate-400 font-medium px-4">
                            Si no recuerdas tu correo o tienes problemas de acceso, contacta al administrador en <br />
                            <a href="mailto:soporte@vunlek.com" className="text-indigo-500 font-black hover:underline">soporte@vunlek.com</a>
                        </p>

                        {!forgotMode && !resetSent && (
                            <Link
                                to="/register"
                                className="block w-full py-4 px-6 border-2 border-slate-200 rounded-2xl text-base font-black text-slate-500 hover:text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-all text-center btn-tactile"
                            >
                                Registro Nuevo
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
