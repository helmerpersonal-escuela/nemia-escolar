import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useSubscription } from '../../../hooks/useSubscription'
import { CreditCard, Calendar, CheckCircle2, AlertTriangle, Zap, ArrowRight, ShieldCheck, Mail } from 'lucide-react'

export const BillingSection = () => {
    const { subscription, loading, isActive, isTrialExpired } = useSubscription()
    const [isCreatingPreference, setIsCreatingPreference] = useState(false)
    const [mpPublicKey, setMpPublicKey] = useState('')

    useEffect(() => {
        const fetchMPKey = async () => {
            const { data } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'mercadopago_public_key')
                .maybeSingle()
            if (data?.value) setMpPublicKey(data.value)
        }
        fetchMPKey()
    }, [])

    const handleSubscribe = async () => {
        setIsCreatingPreference(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user?.id).single()

            const response = await supabase.functions.invoke('create-payment-preference', {
                body: {
                    title: 'Licencia PRO Anual - Sistema Escolar',
                    price: 1500, // Example price in MXN
                    quantity: 1,
                    userId: user?.id,
                    tenantId: profile?.tenant_id
                }
            })

            if (response.error) throw response.error

            const { preferenceId } = response.data
            // Redirect to Mercado Pago Checkout
            window.location.href = `https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=${preferenceId}`
        } catch (error: any) {
            console.error('Error creating preference:', error)
            alert('Error al iniciar el proceso de pago: ' + error.message)
        } finally {
            setIsCreatingPreference(false)
        }
    }

    if (loading) return <div className="p-8 text-center">Cargando información de suscripción...</div>

    const statusColors = {
        trialing: isTrialExpired() ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-blue-100 text-blue-700 border-blue-200',
        active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        past_due: 'bg-rose-100 text-rose-700 border-rose-200',
        canceled: 'bg-gray-100 text-gray-700 border-gray-200',
        unpaid: 'bg-red-100 text-red-700 border-red-200',
        none: 'bg-gray-100 text-gray-700 border-gray-200'
    }

    const statusLabels = {
        trialing: isTrialExpired() ? 'PERIODO DE PRUEBA EXPIRADO' : 'PERIODO DE PRUEBA ACTIVO',
        active: 'SUSCRIPCIÓN PRO ACTIVA',
        past_due: 'PAGO PENDIENTE',
        canceled: 'CANCELADA',
        unpaid: 'IMPAGADA',
        none: 'SIN SUSCRIPCIÓN'
    }

    const currentStatus = subscription?.status || 'none'

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Subscription Status Card */}
            <div className="bg-white border border-gray-100 rounded-[2rem] overflow-hidden shadow-sm">
                <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                            <Zap className="w-5 h-5 text-blue-600" />
                            Estado de la Suscripción
                        </h3>
                        <p className="text-xs text-gray-500 font-medium mt-1">Gestiona tu plan y pagos del sistema.</p>
                    </div>
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black border uppercase tracking-widest ${statusColors[currentStatus]}`}>
                        {statusLabels[currentStatus]}
                    </span>
                </div>

                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="bg-blue-50 p-3 rounded-2xl">
                                <Calendar className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-gray-900 uppercase">Validez del Plan</h4>
                                <p className="text-lg font-bold text-gray-700">
                                    {subscription?.current_period_end
                                        ? new Date(subscription.current_period_end).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
                                        : 'No disponible'}
                                </p>
                                <p className="text-xs text-gray-400 font-medium">Fecha de renovación o expiración.</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="bg-purple-50 p-3 rounded-2xl">
                                <CreditCard className="w-6 h-6 text-purple-600" />
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-gray-900 uppercase">Método de Pago</h4>
                                <p className="text-lg font-bold text-gray-700">Mercado Pago</p>
                                <p className="text-xs text-gray-400 font-medium">Procesado de forma segura.</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-[1.5rem] p-6 text-white flex flex-col justify-between relative overflow-hidden group">
                        <Zap className="absolute top-0 right-0 w-32 h-32 text-white/5 -mr-8 -mt-8 rotate-12 transition-transform group-hover:scale-110" />
                        <div className="relative z-10">
                            <h4 className="text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Plan Actual</h4>
                            <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-4">Licencia PRO Anual</h3>
                            <ul className="space-y-2 mb-6">
                                <li className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                    IA Ilimitada (Gemini/OpenAI)
                                </li>
                                <li className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                    Hasta 500 Alumnos por ciclo
                                </li>
                                <li className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                    Soporte Técnico Prioritario
                                </li>
                            </ul>
                        </div>

                        {(currentStatus === 'trialing' || currentStatus === 'none' || isTrialExpired()) && (
                            <button
                                onClick={handleSubscribe}
                                disabled={isCreatingPreference}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-blue-900/40 relative z-10 flex items-center justify-center gap-2"
                            >
                                {isCreatingPreference ? 'Procesando...' : 'Activar Licencia PRO'}
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Trial Info / Warnings */}
            {currentStatus === 'trialing' && !isTrialExpired() && (
                <div className="bg-amber-50 border border-amber-100 rounded-[1.5rem] p-6 flex items-start gap-4">
                    <div className="bg-amber-100 p-2 rounded-xl">
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-amber-900 uppercase">Modo de Prueba Activo</h4>
                        <p className="text-xs text-amber-700 font-medium mt-1">
                            Tu periodo de prueba gratuito finaliza pronto. Activa tu suscripción anual para evitar interrupciones en el servicio y mantener acceso a todas las herramientas de IA.
                        </p>
                    </div>
                </div>
            )}

            {isTrialExpired() && (
                <div className="bg-red-50 border border-red-100 rounded-[1.5rem] p-6 flex items-start gap-4 shadow-sm">
                    <div className="bg-red-100 p-2 rounded-xl">
                        <ShieldCheck className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-red-900 uppercase italic tracking-tight">Acceso Restringido</h4>
                        <p className="text-xs text-red-700 font-medium mt-1">
                            Tu periodo de prueba ha expirado. Por favor, realiza el pago de tu licencia anual para reactivar el acceso a los módulos de planificación y evaluación.
                        </p>
                    </div>
                </div>
            )}

            {/* Support section */}
            <div className="bg-gray-50 rounded-[2rem] p-8 border border-gray-100">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="bg-white p-3 rounded-2xl shadow-sm">
                            <Mail className="w-6 h-6 text-gray-400" />
                        </div>
                        <div>
                            <h4 className="text-sm font-black text-gray-900 uppercase">¿Necesitas ayuda con tu facturación?</h4>
                            <p className="text-xs text-gray-500 font-medium">Contáctanos para temas de facturas, duplicados o problemas técnicos.</p>
                        </div>
                    </div>
                    <button className="px-6 py-3 bg-white border border-gray-200 rounded-xl font-bold text-xs text-gray-700 hover:bg-gray-50 transition-all shadow-sm">
                        Contactar Soporte
                    </button>
                </div>
            </div>
        </div>
    )
}
