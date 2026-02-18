import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { Sparkles, Loader2, Lock, ArrowRight, AlertTriangle, CheckCircle } from 'lucide-react'

export const ResetPasswordPage = () => {
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const navigate = useNavigate()

    useEffect(() => {
        // Check if we are in a recovery session
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                // No active session found
            }
        }
        checkSession()
    }, [])

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden')
            return
        }
        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres')
            return
        }

        setLoading(true)
        setError(null)

        try {
            const { error } = await supabase.auth.updateUser({
                password: password.trim()
            })

            if (error) throw error
            setSuccess(true)
            setTimeout(() => {
                navigate('/login')
            }, 3000)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-b from-indigo-50 to-white relative overflow-hidden">
            <div className="squishy-card max-w-md w-full animate-in fade-in zoom-in duration-500 p-8 md:p-10 relative z-10">
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-200">
                        <Lock className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-3xl font-black text-slate-800 mb-2 tracking-tight">Nueva Contraseña</h2>
                    <p className="text-slate-500 font-bold">Establece tu nuevo acceso seguro</p>
                </div>

                {!success ? (
                    <form onSubmit={handleUpdatePassword} className="space-y-6">
                        <div className="space-y-5">
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-indigo-300 group-focus-within:text-indigo-500 transition-colors" />
                                </div>
                                <input
                                    type="password"
                                    required
                                    className="input-squishy block w-full pl-11 pr-4 py-4 font-bold text-slate-700 placeholder:text-slate-300"
                                    placeholder="Nueva contraseña"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>

                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-indigo-300 group-focus-within:text-indigo-500 transition-colors" />
                                </div>
                                <input
                                    type="password"
                                    required
                                    className="input-squishy block w-full pl-11 pr-4 py-4 font-bold text-slate-700 placeholder:text-slate-300"
                                    placeholder="Confirmar contraseña"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>
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
                                    Actualizar Contraseña
                                    <ArrowRight className="ml-2 w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>
                ) : (
                    <div className="text-center space-y-6 animate-in zoom-in duration-300">
                        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="w-10 h-10 text-emerald-500" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800">¡Contraseña Actualizada!</h3>
                        <p className="text-slate-500 font-bold">Serás redirigido al inicio de sesión en unos segundos...</p>
                        <button
                            onClick={() => navigate('/login')}
                            className="w-full py-4 text-indigo-500 font-black uppercase tracking-widest text-xs hover:bg-indigo-50 rounded-2xl transition-all"
                        >
                            Ir al login ahora
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
