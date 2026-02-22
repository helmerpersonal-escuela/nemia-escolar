import { useState } from 'react'
import { CreditCard, Zap, Check, TrendingUp, Calendar, Users, GraduationCap, AlertCircle } from 'lucide-react'
import { useSubscriptionLimits } from '../../../hooks/useSubscriptionLimits'
import { UpgradeModal } from '../../../components/UpgradeModal'
import { supabase } from '../../../lib/supabase'
import { Capacitor } from '@capacitor/core'

export const BillingSection = () => {
    const limits = useSubscriptionLimits()
    const [showUpgradeModal, setShowUpgradeModal] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleUpgrade = () => {
        setShowUpgradeModal(true)
    }

    const handleManageSubscription = async () => {
        setShowUpgradeModal(true)
    }

    const handleRefresh = async () => {
        setLoading(true)
        try {
            await limits.refreshLimits()
        } finally {
            setLoading(false)
        }
    }

    if (limits.isLoading) {
        return (
            <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                    <div className="h-32 bg-gray-200 rounded"></div>
                </div>
            </div>
        )
    }

    const isBasic = limits.planType === 'basic'
    const groupUsagePercent = (limits.currentGroups / limits.maxGroups) * 100

    return (
        <div className="space-y-6">
            {/* Current Plan Card */}
            <div className={`bg-gradient-to-br ${isBasic ? 'from-gray-50 to-slate-50' : 'from-indigo-50 to-purple-50'} rounded-2xl shadow-lg p-8 border-2 ${isBasic ? 'border-gray-200' : 'border-indigo-200'}`}>
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <CreditCard className={`w-8 h-8 ${isBasic ? 'text-gray-600' : 'text-indigo-600'}`} />
                            <h2 className="text-2xl font-black text-gray-900">Plan Actual</h2>
                        </div>
                        {!Capacitor.isNativePlatform() && (
                            <p className="text-gray-600 font-medium">Gestiona tu suscripción y límites</p>
                        )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <span className={`px-4 py-2 ${isBasic ? 'bg-gray-200 text-gray-700' : 'bg-indigo-600 text-white'} text-sm font-black rounded-full uppercase shadow-sm`}>
                            {isBasic ? 'Básico' : 'Pro'}
                        </span>
                        <button
                            onClick={handleRefresh}
                            disabled={loading}
                            className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 flex items-center gap-1 uppercase tracking-tighter"
                        >
                            <TrendingUp className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                            Sincronizar Estado
                        </button>
                    </div>
                </div>

                {/* Plan Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="bg-white/80 backdrop-blur-sm p-6 rounded-xl border border-gray-200">
                        <div className="flex items-center gap-2 mb-3">
                            <Users className="w-5 h-5 text-blue-600" />
                            <h3 className="font-bold text-gray-900">Límite de Grupos</h3>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black text-gray-900">{limits.currentGroups}</span>
                                <span className="text-gray-500 font-bold">/ {limits.maxGroups}</span>
                                <span className="text-sm text-gray-400 font-medium">grupos</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-500 ${groupUsagePercent >= 100 ? 'bg-red-500' : groupUsagePercent >= 80 ? 'bg-amber-500' : 'bg-blue-500'}`}
                                    style={{ width: `${Math.min(groupUsagePercent, 100)}%` }}
                                />
                            </div>
                            {groupUsagePercent >= 100 && (
                                <div className="flex items-center gap-2 text-red-600 text-sm font-bold">
                                    <AlertCircle className="w-4 h-4" />
                                    Límite alcanzado
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white/80 backdrop-blur-sm p-6 rounded-xl border border-gray-200">
                        <div className="flex items-center gap-2 mb-3">
                            <GraduationCap className="w-5 h-5 text-emerald-600" />
                            <h3 className="font-bold text-gray-900">Estudiantes por Grupo</h3>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black text-gray-900">{limits.maxStudentsPerGroup}</span>
                                <span className="text-sm text-gray-400 font-medium">máximo</span>
                            </div>
                            <p className="text-xs text-gray-500 font-medium">
                                Límite pedagógico recomendado para mantener calidad educativa
                            </p>
                        </div>
                    </div>
                </div>

                {/* Plan Features */}
                <div className="bg-white/80 backdrop-blur-sm p-6 rounded-xl border border-gray-200 mb-6">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Check className="w-5 h-5 text-green-600" />
                        Características Incluidas
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex items-center gap-2 text-sm">
                            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                            <span className="text-gray-700 font-medium">Hasta {limits.maxGroups} grupos</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                            <span className="text-gray-700 font-medium">50 estudiantes por grupo</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                            <span className="text-gray-700 font-medium">Gestión de calificaciones</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                            <span className="text-gray-700 font-medium">Control de asistencia</span>
                        </div>
                        {!isBasic && (
                            <>
                                <div className="flex items-center gap-2 text-sm">
                                    <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                                    <span className="text-gray-700 font-medium">Soporte prioritario 24/7</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                                    <span className="text-gray-700 font-medium">Actualizaciones continuas</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Pricing - Hidden on native/mobile per user request */}
                {!Capacitor.isNativePlatform() && (
                    <div className="bg-white/80 backdrop-blur-sm p-6 rounded-xl border border-gray-200 mb-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500 font-medium mb-1">Precio Anual</p>
                                <div className="flex items-baseline gap-2">
                                    <span className={`text-4xl font-black ${isBasic ? 'text-gray-900' : 'text-indigo-600'}`}>
                                        ${limits.priceAnnual}
                                    </span>
                                    <span className="text-gray-500 font-bold">MXN / año</span>
                                </div>
                            </div>
                            <Calendar className="w-12 h-12 text-gray-300" />
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-4">
                    {isBasic ? (
                        <button
                            onClick={handleUpgrade}
                            className="flex-1 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-black text-lg hover:from-indigo-700 hover:to-purple-700 shadow-xl shadow-indigo-200 transform hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                            <TrendingUp className="w-5 h-5" />
                            ¿Quieres más?
                            <Zap className="w-5 h-5" />
                        </button>
                    ) : (
                        <button
                            onClick={handleManageSubscription}
                            disabled={loading}
                            className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-xl font-bold text-lg hover:bg-gray-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <CreditCard className="w-5 h-5" />
                            {loading ? 'Cargando...' : 'Gestionar Suscripción'}
                        </button>
                    )}
                </div>
            </div>

            {/* Info Card */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
                <div className="flex items-start gap-3">
                    <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-bold text-blue-900 mb-1">Información Importante</h3>
                        <p className="text-sm text-blue-700 font-medium">
                            {isBasic
                                ? 'Actualiza a Pro para acceder a hasta 10 grupos y soporte prioritario 24/7.'
                                : 'Tienes acceso completo a todas las funcionalidades del plan Pro. ¡Gracias por tu confianza!'
                            }
                        </p>
                    </div>
                </div>
            </div>

            <UpgradeModal
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                currentPlan={limits.planType}
                currentGroups={limits.currentGroups}
                maxGroups={limits.maxGroups}
                reason="groups"
            />
        </div>
    )
}
