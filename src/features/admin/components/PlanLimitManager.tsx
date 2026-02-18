import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Save, RefreshCw, AlertTriangle, Zap, Users, LayoutGrid, DollarSign, Clock } from 'lucide-react'

export const PlanLimitManager = () => {
    const [limits, setLimits] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    useEffect(() => {
        fetchLimits()
    }, [])

    const fetchLimits = async () => {
        setIsLoading(true)
        try {
            const { data, error } = await supabase
                .from('license_limits')
                .select('*')
                .order('plan_type')

            if (error) throw error
            setLimits(data || [])
        } catch (err: any) {
            setMessage({ type: 'error', text: 'Error al cargar límites: ' + err.message })
        } finally {
            setIsLoading(false)
        }
    }

    const handleUpdateLimit = (id: string, field: string, value: any) => {
        setLimits(prev => prev.map(limit =>
            limit.id === id ? { ...limit, [field]: value } : limit
        ))
    }

    const handleSave = async (limit: any) => {
        setIsSaving(true)
        setMessage(null)
        try {
            const { error } = await supabase
                .from('license_limits')
                .update({
                    max_groups: limit.max_groups,
                    max_students_per_group: limit.max_students_per_group,
                    price_annual: limit.price_annual,
                    trial_days: limit.trial_days,
                    updated_at: new Date().toISOString()
                })
                .eq('id', limit.id)

            if (error) throw error
            setMessage({ type: 'success', text: `Plan ${limit.plan_type.toUpperCase()} actualizado correctamente.` })
        } catch (err: any) {
            setMessage({ type: 'error', text: 'Error al guardar: ' + err.message })
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-20">
                <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-2xl font-black text-indigo-950 italic uppercase tracking-tighter">Gestión de Planes y Límites</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Configuración Core de Negocio</p>
                </div>
                <button
                    onClick={fetchLimits}
                    className="p-3 bg-white border border-indigo-50 rounded-2xl text-indigo-600 hover:border-indigo-600 transition-all active:scale-95 shadow-sm"
                >
                    <RefreshCw className="w-5 h-5" />
                </button>
            </div>

            {message && (
                <div className={`p-4 rounded-2xl border-2 flex items-center gap-3 animate-in shake duration-300 ${message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'
                    }`}>
                    {message.type === 'success' ? <Zap className="w-5 h-5 text-emerald-500" /> : <AlertTriangle className="w-5 h-5 text-rose-500" />}
                    <p className="text-sm font-bold uppercase tracking-tight">{message.text}</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {limits.map(limit => (
                    <div key={limit.id} className="squishy-card p-8 border-indigo-50 relative overflow-hidden group">
                        {/* Decorative Background Icon */}
                        <div className={`absolute -top-10 -right-10 w-40 h-40 opacity-5 group-hover:scale-110 transition-transform duration-1000 ${limit.plan_type === 'pro' ? 'text-indigo-600' : 'text-slate-400'
                            }`}>
                            {limit.plan_type === 'pro' ? <Zap className="w-full h-full" /> : <Users className="w-full h-full" />}
                        </div>

                        <div className="flex justify-between items-center mb-8 relative z-10">
                            <div>
                                <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${limit.plan_type === 'pro' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'
                                    }`}>
                                    Plan {limit.plan_type}
                                </span>
                                <h4 className="text-xl font-black text-indigo-950 uppercase italic mt-2 tracking-tighter">
                                    {limit.plan_type === 'pro' ? 'Estructura Profesional' : 'Estructura Básica'}
                                </h4>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-slate-400 font-mono tracking-tighter uppercase font-bold">
                                    Ult. Sync: {new Date(limit.updated_at).toLocaleDateString()}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-6 relative z-10">
                            {/* Max Groups */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between ml-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Zap className="w-3 h-3 text-indigo-400" /> Máximo de Grupos
                                    </label>
                                    <span className="text-xs font-black text-indigo-950">{limit.max_groups} Unidades</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="50"
                                    value={limit.max_groups}
                                    onChange={(e) => handleUpdateLimit(limit.id, 'max_groups', parseInt(e.target.value))}
                                    className="w-full accent-indigo-600 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>

                            {/* Max Students */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between ml-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Users className="w-3 h-3 text-blue-400" /> Alumnos por Grupo
                                    </label>
                                    <span className="text-xs font-black text-indigo-950">{limit.max_students_per_group} Pax</span>
                                </div>
                                <input
                                    type="number"
                                    value={limit.max_students_per_group}
                                    onChange={(e) => handleUpdateLimit(limit.id, 'max_students_per_group', parseInt(e.target.value))}
                                    className="input-squishy w-full px-4 py-3 text-sm font-black text-indigo-950 border-2 border-slate-50 focus:border-indigo-100"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Price */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <DollarSign className="w-3 h-3 text-emerald-400" /> Precio Anual
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">$</span>
                                        <input
                                            type="number"
                                            value={limit.price_annual}
                                            onChange={(e) => handleUpdateLimit(limit.id, 'price_annual', parseInt(e.target.value))}
                                            className="input-squishy w-full pl-8 pr-4 py-3 text-sm font-black text-indigo-950 border-2 border-slate-50 focus:border-indigo-100"
                                        />
                                    </div>
                                </div>

                                {/* Trial Days */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <Clock className="w-3 h-3 text-amber-400" /> Periodo Prueba
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={limit.trial_days}
                                            onChange={(e) => handleUpdateLimit(limit.id, 'trial_days', parseInt(e.target.value))}
                                            className="input-squishy w-full px-4 py-3 text-sm font-black text-indigo-950 border-2 border-slate-50 focus:border-indigo-100"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[9px] uppercase tracking-tighter">Días</span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => handleSave(limit)}
                                disabled={isSaving}
                                className="w-full py-4 mt-4 bg-indigo-600 text-white rounded-2xl font-black uppercase italic tracking-tighter hover:bg-slate-900 transition-all active:scale-95 shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 btn-tactile"
                            >
                                <Save className="w-4 h-4" />
                                {isSaving ? 'GUARDANDO...' : 'ACTUALIZAR NÚCLEO'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
