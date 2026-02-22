import { useNavigate } from 'react-router-dom'
import { ShieldAlert, Zap, ArrowRight, CreditCard, LogOut, Check } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useState } from 'react'
import { useSubscriptionLimits } from '../../../hooks/useSubscriptionLimits'
import { UpgradeModal } from '../../../components/UpgradeModal'
import { useAppMode } from '../../../hooks/useAppMode'

export const PaywallPage = () => {
    const navigate = useNavigate()
    const limits = useSubscriptionLimits()
    const { isAppMode } = useAppMode()
    const [showUpgrade, setShowUpgrade] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        navigate('/login')
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Animated background elements */}
            <div className="absolute top-0 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] translate-x-1/2 translate-y-1/2" />

            <div className="max-w-4xl w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-[3rem] p-8 md:p-16 relative z-10 shadow-2xl animate-in zoom-in-95 duration-500">
                <div className="text-center mb-12">
                    <div className="inline-flex p-4 bg-amber-500/20 text-amber-500 rounded-3xl mb-6 shadow-inner ring-1 ring-amber-500/30">
                        <ShieldAlert className="w-12 h-12" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-4 lowercase">
                        Acceso restringido
                    </h1>
                    <p className="text-slate-400 text-lg font-medium max-w-xl mx-auto">
                        Tu periodo de prueba o licencia ha finalizado. Para seguir utilizando las herramientas profesionales de Vunlek, adquiere tu licencia escolar hoy mismo.
                    </p>
                </div>

                {isAppMode && (
                    <div className="mb-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <Zap className="w-4 h-4 text-blue-400" />
                        </div>
                        <p className="text-xs text-blue-200 font-bold">
                            Estás usando la aplicación móvil. Para gestionar tu suscripción y acceder a más detalles, por favor inicia sesión desde vunlek.com en tu navegador.
                        </p>
                    </div>
                )}

                {isAppMode ? (
                    <div className="flex flex-col items-center gap-8 py-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <p className="text-slate-500 text-sm font-bold uppercase tracking-widest text-center max-w-xs leading-relaxed">
                            Adquiere una licencia <span className="text-indigo-400">Básica</span> o <span className="text-purple-400">Pro</span> desde nuestra plataforma web
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                        {/* Basic Plan Info */}
                        <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 flex flex-col justify-between hover:bg-white/[0.07] transition-colors group">
                            <div>
                                <div className="flex justify-between items-start mb-6">
                                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">Plan Básico</h3>
                                    <div className="text-right">
                                        <div className="text-2xl font-black text-white">${limits.priceAnnual}</div>
                                        <div className="text-[10px] font-black text-slate-500 uppercase">MXN / anual</div>
                                    </div>
                                </div>
                                <div className="space-y-3 mb-8">
                                    <div className="flex items-center gap-3 text-slate-300">
                                        <Check className="w-5 h-5 text-emerald-500" />
                                        <span className="text-sm font-bold">Hasta {limits.maxGroups} Grupos Activos</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-300">
                                        <Check className="w-5 h-5 text-emerald-500" />
                                        <span className="text-sm font-bold">{limits.maxStudentsPerGroup} Estudiantes por Grupo</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-300">
                                        <Check className="w-5 h-5 text-emerald-500" />
                                        <span className="text-sm font-bold">Gestión de Calificaciones</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowUpgrade(true)}
                                className="w-full py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all"
                            >
                                Activar Básico
                            </button>
                        </div>

                        {/* Pro Plan Info */}
                        <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border-2 border-indigo-500/50 rounded-[2.5rem] p-8 flex flex-col justify-between relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-3 bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-bl-2xl">Recomendado</div>
                            <div>
                                <div className="flex justify-between items-start mb-6">
                                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic flex items-center gap-2">
                                        Plan Pro <Zap className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                                    </h3>
                                    <div className="text-right">
                                        <div className="text-2xl font-black text-white">$599</div>
                                        <div className="text-[10px] font-black text-slate-500 uppercase">MXN / anual</div>
                                    </div>
                                </div>
                                <div className="space-y-3 mb-8">
                                    <div className="flex items-center gap-3 text-white">
                                        <Check className="w-5 h-5 text-indigo-400" />
                                        <span className="text-sm font-black">Hasta 10 Grupos Activos</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-white">
                                        <Check className="w-5 h-5 text-indigo-400" />
                                        <span className="text-sm font-black">Inteligencia Artificial Ilimitada</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-white">
                                        <Check className="w-5 h-5 text-indigo-400" />
                                        <span className="text-sm font-black">Soporte Prioritario 24/7</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowUpgrade(true)}
                                className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-500/25 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                            >
                                Obtener Pro <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-8 border-t border-white/10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
                            <span className="text-2xl font-black text-indigo-600">V</span>
                        </div>
                        <div className="text-left">
                            <p className="text-white font-black text-sm">Vunlek</p>
                            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Tecnología Educativa</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleSignOut}
                            className="p-4 text-slate-500 hover:text-red-400 transition-colors flex items-center gap-2 text-xs font-black uppercase tracking-widest"
                        >
                            <LogOut className="w-4 h-4" /> Cerrar Sesión
                        </button>
                    </div>
                </div>
            </div >

            <UpgradeModal
                isOpen={showUpgrade}
                onClose={() => setShowUpgrade(false)}
                currentPlan={limits.planType}
                currentGroups={limits.currentGroups}
                maxGroups={limits.maxGroups}
            />
        </div >
    )
}
