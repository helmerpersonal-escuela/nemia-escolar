import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { ShieldCheck, Sparkles, Loader2, Lock, Mail, ArrowRight } from 'lucide-react'

export const LoginPage = () => {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            console.log('Intentando login con:', { email, passwordLength: password.length })
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password: password.trim(),
            })

            if (error) {
                console.error('Error detallado de Supabase:', error)
                throw error
            }
            console.log('Login exitoso:', data)
            // Redirect handled by Auth Listener
        } catch (err: any) {
            console.error('Captura de error en LoginPage:', err)
            setError(err.message === 'Invalid login credentials'
                ? 'Credenciales incorrectas. Por favor verifica tu correo y contraseña.'
                : err.message)
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
                    <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center mx-auto mb-8 border border-white/20 shadow-2xl">
                        <Sparkles className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-5xl font-black mb-6 tracking-tight leading-tight">
                        NEMIA <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">Inteligencia Escolar</span>
                    </h1>
                    <p className="text-xl text-blue-100/80 font-medium leading-relaxed">
                        Optimiza la administración académica, planeación didáctica y seguimiento de alumnos en una sola plataforma unificada.
                    </p>
                </div>

                {/* Decorative Circles */}
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-600 rounded-full blur-3xl opacity-20"></div>
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-600 rounded-full blur-3xl opacity-20"></div>
            </div>

            {/* Right Side - Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50/50">
                <div className="max-w-md w-full animate-in fade-in slide-in-from-right-8 duration-500">
                    <div className="text-center mb-10">
                        <h2 className="text-3xl font-black text-slate-900 mb-2">Bienvenido de nuevo</h2>
                        <p className="text-slate-500 font-medium">Ingresa a tu panel de control</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-4">
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                </div>
                                <input
                                    type="email"
                                    required
                                    className="block w-full pl-11 pr-4 py-4 bg-white border-2 border-gray-100 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-0 transition-all font-medium"
                                    placeholder="correo@institucion.edu"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>

                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                </div>
                                <input
                                    type="password"
                                    required
                                    className="block w-full pl-11 pr-4 py-4 bg-white border-2 border-gray-100 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-0 transition-all font-medium"
                                    placeholder="••••••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end">
                            <Link to="#" className="text-sm font-bold text-indigo-600 hover:text-indigo-500 hover:underline">
                                ¿Olvidaste tu contraseña?
                            </Link>
                        </div>

                        {error && (
                            <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-bold flex items-center animate-in shake">
                                <span className="mr-2">⚠️</span> {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center items-center py-4 px-6 border border-transparent rounded-2xl text-base font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all shadow-lg shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {loading ? <Loader2 className="animate-spin h-5 w-5" /> : (
                                <>
                                    Iniciar Sesión
                                    <ArrowRight className="ml-2 w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-10 text-center space-y-4">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-200"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-4 bg-gray-50 text-gray-500 font-medium">¿Aún no tienes cuenta?</span>
                            </div>
                        </div>

                        <Link
                            to="/register"
                            className="block w-full py-4 px-6 border-2 border-gray-200 rounded-2xl text-base font-bold text-slate-600 bg-white hover:bg-gray-50 hover:border-gray-300 focus:outline-none transition-all text-center"
                        >
                            Crear cuenta nueva
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
