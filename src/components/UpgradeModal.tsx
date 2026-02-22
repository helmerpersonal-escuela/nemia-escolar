import { X, Zap, Check, ArrowRight, ShieldCheck, Star, Globe } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useState, useEffect } from 'react'
import { useTenant } from '../hooks/useTenant'
import { useSubscriptionLimits } from '../hooks/useSubscriptionLimits'
import { PaymentModule } from './payment/PaymentModule'
import { Capacitor } from '@capacitor/core'

interface UpgradeModalProps {
    isOpen: boolean
    onClose: () => void
    currentPlan: 'basic' | 'pro'
    currentGroups: number
    maxGroups: number
    reason?: 'groups' | 'students'
}

export const UpgradeModal = ({ isOpen, onClose, currentPlan, currentGroups, maxGroups, reason = 'groups' }: UpgradeModalProps) => {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [preferenceId, setPreferenceId] = useState<string | null>(null)
    const [publicKey, setPublicKey] = useState<string | null>(null)
    const { data: tenant } = useTenant()
    const { maxGroups: limitMaxGroups, maxStudentsPerGroup: limitMaxStudentsPerGroup, priceAnnual } = useSubscriptionLimits()
    const [animateLogo, setAnimateLogo] = useState(false)

    useEffect(() => {
        const fetchPublicKey = async () => {
            try {
                const { data, error } = await supabase
                    .from('system_settings')
                    .select('value')
                    .eq('key', 'mercadopago_public_key')
                    .single()

                if (error) throw error
                if (data?.value) {
                    console.log("Loaded MP Public Key from DB:", data.value.substring(0, 10) + "...")
                    setPublicKey(data.value)
                }
            } catch (err) {
                console.warn("Could not load MP Public Key from DB, falling back to ENV:", err)
            }
        }
        fetchPublicKey()
    }, [])

    useEffect(() => {
        if (isOpen) {
            setAnimateLogo(true)
        } else {
            setAnimateLogo(false)
        }
    }, [isOpen])

    if (!isOpen) return null

    const handleUpgrade = async () => {
        setLoading(true)
        setError(null)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            const response = await supabase.functions.invoke('create-payment-preference', {
                body: {
                    title: 'Upgrade a Plan PRO - Vunlek',
                    price: priceAnnual || 999,
                    quantity: 1,
                    userId: user?.id,
                    tenantId: tenant?.id,
                    planType: 'pro',
                    email: user?.email // Explicitly send email
                }
            })

            if (response.error) throw response.error

            const { preferenceId } = response.data
            setPreferenceId(preferenceId)
        } catch (error: any) {
            console.error('Error creating upgrade preference:', error)
            setError('Error al procesar el upgrade: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const PlanFeature = ({ text, highlight = false }: { text: string, highlight?: boolean }) => (
        <div className="flex items-center gap-3 group">
            <div className={`
                w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110
                ${highlight ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}
            `}>
                <Check className="w-5 h-5" />
            </div>
            <span className={`text-base font-medium ${highlight ? 'text-slate-800' : 'text-slate-600'}`}>
                {text}
            </span>
        </div>
    )

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
            {/* Animated Background Branding */}
            <div className={`absolute inset-0 pointer-events-none flex items-center justify-center opacity-5 transition-transform duration-1000 ${animateLogo ? 'scale-110' : 'scale-75'}`}>
                <span className="text-[400px] font-black italic tracking-tighter text-indigo-900 blur-3xl select-none">VUNLEK</span>
            </div>

            <div className="
                relative w-full max-w-5xl bg-white/90 backdrop-blur-xl rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] 
                border-2 border-white/50 flex flex-col md:flex-row animate-in zoom-in-95 slide-in-from-bottom-8 duration-500
                max-h-[90vh] overflow-y-auto md:overflow-hidden touch-auto
            ">
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-200/40 to-purple-200/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-blue-200/40 to-cyan-200/40 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

                <button
                    onClick={onClose}
                    className="
                        absolute top-6 right-6 z-20 p-3 bg-white/50 hover:bg-white rounded-2xl text-slate-400 hover:text-slate-700 
                        transition-all duration-300 hover:scale-110 hover:shadow-lg backdrop-blur-sm border border-white/60
                    "
                >
                    <X className="w-6 h-6" />
                </button>

                {/* Left Side: Visual & Context */}
                <div className="
                    w-full md:w-2/5 bg-gradient-to-br from-slate-50 to-indigo-50/50 p-8 md:p-12 
                    flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-100 relative overflow-hidden
                ">
                    <div className="relative z-10">
                        <div className="
                            inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-lg border border-indigo-100 
                            mb-8 animate-in slide-in-from-left-4 duration-700 delay-100 text-indigo-700 font-bold text-sm
                        ">
                            <Star className="w-4 h-4 fill-indigo-500 text-indigo-500" />
                            Plan Profesional Vunlek
                        </div>

                        <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-[1.1] mb-6">
                            {reason === 'groups' ? (
                                <>
                                    Rompe tus <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">límites.</span>
                                </>
                            ) : (
                                <>
                                    Crece sin <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">freno.</span>
                                </>
                            )}
                        </h2>

                        <p className="text-lg text-slate-600 font-medium leading-relaxed mb-8">
                            {reason === 'groups'
                                ? `Has alcanzado el máximo de ${maxGroups} grupos. Desbloquea el potencial completo de Vunlek.`
                                : `Respetamos el límite de ${limitMaxStudentsPerGroup} estudiantes. Organiza mejor con más grupos y herramientas PRO.`
                            }
                        </p>

                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-white rounded-2xl shadow-xl flex items-center justify-center p-2 rotate-3 hover:rotate-6 transition-transform duration-300">
                                <span className="text-2xl font-black text-indigo-600">V</span>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">POWERED BY</p>
                                <p className="text-xl font-black text-slate-800">Vunlek</p>
                            </div>
                        </div>
                    </div>

                    {/* Left decorative circle */}
                    <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-indigo-500/10 rounded-full blur-2xl" />
                </div>

                {/* Right Side: Action & Payment */}
                <div className="w-full md:w-3/5 p-8 md:p-12 flex flex-col justify-center relative bg-white/40">

                    {error && (
                        <div className="mb-6 p-4 bg-red-50/80 border-2 border-red-100 rounded-2xl animate-in shake duration-300 flex items-start gap-3">
                            <Zap className="w-5 h-5 text-red-500 mt-0.5" />
                            <p className="text-sm text-red-700 font-bold">{error}</p>
                        </div>
                    )}

                    {preferenceId ? (
                        <div className="animate-in fade-in slide-in-from-right-8 duration-500 w-full max-w-md mx-auto">
                            <div className="text-center mb-8">
                                <div className="inline-flex p-4 bg-green-100 text-green-600 rounded-full mb-4 shadow-sm animate-bounce">
                                    <ShieldCheck className="w-8 h-8" />
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 mb-2">Transacción Protegida</h3>
                                <p className="text-slate-500 font-medium">Activa tu licencia mediante Mercado Pago</p>
                            </div>

                            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-2 transform transition-all hover:shadow-2xl">
                                <PaymentModule
                                    preferenceId={preferenceId}
                                    publicKey={publicKey || undefined}
                                    onReady={() => console.log('Payment Brick Ready')}
                                    onError={(e) => setError('Error en pasarela: ' + e)}
                                />
                            </div>

                            <button
                                onClick={() => setPreferenceId(null)}
                                className="w-full mt-6 py-3 text-slate-400 hover:text-slate-600 font-bold text-sm transition-colors"
                            >
                                ← Volver a los detalles
                            </button>
                        </div>
                    ) : (
                        <div className={`w-full max-w-md mx-auto animate-in fade-in slide-in-from-bottom-8 duration-500 delay-150`}>
                            {currentPlan === 'basic' ? (
                                <>
                                    <div className="bg-white rounded-[2rem] shadow-xl shadow-indigo-100/50 border border-indigo-50 p-8 mb-8 relative group hover:border-indigo-100 transition-colors duration-300">
                                        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

                                        <div className="flex justify-between items-end mb-6">
                                            <div>
                                                <p className="text-sm font-bold text-indigo-500 uppercase tracking-wider mb-1">Anual</p>
                                                {!Capacitor.isNativePlatform() ? (
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-5xl font-black text-slate-900 tracking-tight">${priceAnnual}</span>
                                                        <span className="text-xl font-bold text-slate-400">mxn</span>
                                                    </div>
                                                ) : (
                                                    <div className="text-2xl font-black text-slate-900 tracking-tight">Plan Profesional</div>
                                                )}
                                            </div>
                                            {!Capacitor.isNativePlatform() && (
                                                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white px-4 py-2 rounded-xl text-sm font-black shadow-lg shadow-indigo-200 transform group-hover:scale-105 transition-transform">
                                                    AHORRAS 40%
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-4">
                                            <PlanFeature text="Hasta 10 Grupos Activos" highlight />
                                            <PlanFeature text="50 Estudiantes por Grupo" />
                                            <PlanFeature text="Soporte Prioritario 24/7" highlight />
                                            <PlanFeature text="Módulo de Inteligencia Artificial" />
                                            <PlanFeature text="Respaldos Automáticos" />
                                        </div>
                                    </div>

                                    {!Capacitor.isNativePlatform() ? (
                                        <>
                                            <div className="flex gap-4">
                                                <button
                                                    onClick={handleUpgrade}
                                                    disabled={loading}
                                                    className="
                                                        flex-1 py-5 bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 text-white rounded-2xl 
                                                        font-black text-lg hover:shadow-2xl hover:shadow-indigo-500/30 transform hover:-translate-y-1 active:scale-95 
                                                        transition-all duration-300 flex items-center justify-center gap-3 group relative overflow-hidden
                                                    "
                                                >
                                                    <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                                                    <Zap className="w-5 h-5 group-hover:text-yellow-300 transition-colors" />
                                                    <span>{loading ? 'Cargando...' : 'Desbloquear PRO'}</span>
                                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                                </button>
                                            </div>

                                            <p className="text-center text-xs font-bold text-slate-300 mt-6 tracking-wide uppercase">
                                                Inversión anual • Renovación y cancelación flexibles
                                            </p>
                                        </>
                                    ) : (
                                        <div className="text-center bg-indigo-50/50 rounded-2xl p-6 border border-indigo-100">
                                            <div className="w-12 h-12 bg-indigo-100 text-indigo-500 flex items-center justify-center rounded-xl mx-auto mb-4">
                                                <Globe className="w-6 h-6" />
                                            </div>
                                            <h4 className="font-black text-slate-800 mb-2">Gestión desde Web</h4>
                                            <p className="text-slate-500 font-medium text-sm leading-relaxed">
                                                Por políticas de la tienda de aplicaciones, las actualizaciones de plan y gestiones de facturación solo están disponibles iniciando sesión desde <b>vunlek.com</b> en el navegador de tu computadora o celular.
                                            </p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-center py-12 bg-white rounded-[2.5rem] shadow-xl border border-slate-100">
                                    <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                                        <Star className="w-12 h-12 fill-green-500" />
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900 mb-4">¡Ya eres PRO!</h3>
                                    <p className="text-slate-500 font-medium mb-8 max-w-xs mx-auto">
                                        Tienes acceso ilimitado a todas las herramientas. ¡Sigue rompiéndola en clase!
                                    </p>
                                    <button
                                        onClick={onClose}
                                        className="px-8 py-4 bg-slate-100 text-slate-700 rounded-2xl font-black text-lg hover:bg-slate-200 transition-all hover:scale-105"
                                    >
                                        ¡A darle! 🚀
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
