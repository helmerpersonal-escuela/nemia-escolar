import { X, Zap, Check, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useState } from 'react'
import { useTenant } from '../hooks/useTenant'

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
    const { data: tenant } = useTenant()

    if (!isOpen) return null

    const handleUpgrade = async () => {
        setLoading(true)
        setError(null)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            const response = await supabase.functions.invoke('create-payment-preference', {
                body: {
                    title: 'Upgrade a Plan PRO - Sistema Escolar',
                    price: 599,
                    quantity: 1,
                    userId: user?.id,
                    tenantId: tenant?.id,
                    planType: 'pro'
                }
            })

            if (response.error) throw response.error

            const { preferenceId } = response.data
            // Redirect to Mercado Pago
            window.location.href = `https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=${preferenceId}`
        } catch (error: any) {
            console.error('Error creating upgrade preference:', error)
            setError('Error al procesar el upgrade: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-8 border border-gray-100 animate-in zoom-in-95 duration-200 relative">
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="text-center mb-8">
                    <div className="inline-flex p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-[2rem] text-indigo-600 mb-4 border-2 border-indigo-100">
                        <Zap className="w-10 h-10" />
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">
                        {reason === 'groups' ? '¡Has alcanzado tu límite de grupos!' : '¡Límite de estudiantes alcanzado!'}
                    </h2>
                    <p className="text-slate-600 font-medium">
                        {reason === 'groups'
                            ? `Actualmente tienes ${currentGroups} de ${maxGroups} grupos disponibles en tu plan ${currentPlan === 'basic' ? 'Básico' : 'Pro'}.`
                            : 'Has alcanzado el límite de 50 estudiantes por grupo. Considera crear un nuevo grupo para organizar mejor a tus alumnos.'
                        }
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-2xl">
                        <p className="text-sm text-red-700 font-medium">{error}</p>
                    </div>
                )}

                {reason === 'students' ? (
                    <div className="text-center py-8">
                        <p className="text-gray-600 font-medium mb-6">
                            El límite de 50 estudiantes por grupo es una buena práctica pedagógica. Te recomendamos crear un nuevo grupo para mantener una mejor organización.
                        </p>
                        <button
                            onClick={onClose}
                            className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all"
                        >
                            Entendido
                        </button>
                    </div>
                ) : currentPlan === 'basic' ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                            {/* Current Plan */}
                            <div className="bg-gray-50 p-6 rounded-2xl border-2 border-gray-200">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-black text-gray-900">Plan Actual</h3>
                                    <span className="px-3 py-1 bg-gray-200 text-gray-700 text-xs font-black rounded-full uppercase">Básico</span>
                                </div>
                                <div className="space-y-3 mb-6">
                                    <div className="flex items-start gap-2 text-sm">
                                        <Check className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                                        <span className="text-gray-600 font-medium">Hasta 2 grupos</span>
                                    </div>
                                    <div className="flex items-start gap-2 text-sm">
                                        <Check className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                                        <span className="text-gray-600 font-medium">50 estudiantes por grupo</span>
                                    </div>
                                    <div className="flex items-start gap-2 text-sm">
                                        <Check className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                                        <span className="text-gray-600 font-medium">Funciones básicas</span>
                                    </div>
                                </div>
                                <div className="text-center">
                                    <span className="text-2xl font-black text-gray-700">$399</span>
                                    <span className="text-gray-500 font-bold text-sm ml-1">MXN / año</span>
                                </div>
                            </div>

                            {/* Pro Plan */}
                            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-2xl border-2 border-indigo-200 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-2">
                                    <span className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-black rounded-full uppercase">Recomendado</span>
                                </div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-black text-gray-900">Plan Pro</h3>
                                    <span className="px-3 py-1 bg-indigo-600 text-white text-xs font-black rounded-full uppercase">Pro</span>
                                </div>
                                <div className="space-y-3 mb-6">
                                    <div className="flex items-start gap-2 text-sm">
                                        <Check className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                                        <span className="text-gray-700 font-medium"><strong>Hasta 5 grupos</strong></span>
                                    </div>
                                    <div className="flex items-start gap-2 text-sm">
                                        <Check className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                                        <span className="text-gray-700 font-medium">50 estudiantes por grupo</span>
                                    </div>
                                    <div className="flex items-start gap-2 text-sm">
                                        <Check className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                                        <span className="text-gray-700 font-medium">Soporte prioritario 24/7</span>
                                    </div>
                                    <div className="flex items-start gap-2 text-sm">
                                        <Check className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                                        <span className="text-gray-700 font-medium">Actualizaciones continuas</span>
                                    </div>
                                </div>
                                <div className="text-center">
                                    <span className="text-2xl font-black text-indigo-600">$599</span>
                                    <span className="text-indigo-500 font-bold text-sm ml-1">MXN / año</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={onClose}
                                className="flex-1 py-4 bg-white border-2 border-gray-200 text-gray-600 rounded-2xl font-black text-lg hover:bg-gray-50 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleUpgrade}
                                disabled={loading}
                                className="flex-[2] py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-black text-lg hover:from-indigo-700 hover:to-purple-700 shadow-xl shadow-indigo-300 transform hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <Zap className="w-5 h-5" />
                                {loading ? 'Procesando...' : 'Actualizar a Pro'}
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>

                        <p className="text-xs text-center text-slate-400 font-medium mt-4">
                            💳 Pago seguro procesado por <span className="font-black text-slate-600">Mercado Pago</span>
                        </p>
                    </>
                ) : (
                    <div className="text-center py-8">
                        <p className="text-gray-600 font-medium mb-6">
                            Ya estás en el plan Pro con el máximo de 5 grupos disponibles.
                        </p>
                        <button
                            onClick={onClose}
                            className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all"
                        >
                            Entendido
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
