import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Plus, Trash2, Calendar as CalendarIcon, Sparkles, Clock, AlertTriangle } from 'lucide-react'
import { useTenant } from '../../../hooks/useTenant'

export const SpecialScheduleManager = () => {
    const { data: tenant } = useTenant()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [specialSchedules, setSpecialSchedules] = useState<any[]>([])
    const [useStandardBreaks, setUseStandardBreaks] = useState(true)
    const [numBreaks, setNumBreaks] = useState(1)
    const [standardSettings, setStandardSettings] = useState<any>(null)
    const [formData, setFormData] = useState({
        target_date: new Date().toISOString().split('T')[0],
        name: '',
        start_time: '07:00',
        end_time: '12:00',
        module_duration: 35,
        breaks: [] as any[]
    })
    const [isProposing, setIsProposing] = useState(false)

    useEffect(() => {
        if (tenant) {
            fetchSpecialSchedules()
            fetchStandardSettings()
        }
    }, [tenant])

    useEffect(() => {
        if (useStandardBreaks && standardSettings) {
            setFormData(prev => ({ ...prev, breaks: standardSettings.breaks || [] }))
        } else if (!useStandardBreaks) {
            // Initialize custom breaks based on numBreaks
            const newBreaks = Array.from({ length: numBreaks }).map((_, i) => ({
                name: `Receso ${i + 1}`,
                start_time: '10:00',
                end_time: '10:30'
            }))
            setFormData(prev => ({ ...prev, breaks: newBreaks }))
        }
    }, [useStandardBreaks, standardSettings, numBreaks])

    const fetchSpecialSchedules = async () => {
        const { data } = await supabase
            .from('special_schedule_structure')
            .select('*')
            .eq('tenant_id', tenant?.id)
            .order('target_date', { ascending: true })
        setSpecialSchedules(data || [])
        setLoading(false)
    }

    const fetchStandardSettings = async () => {
        const { data } = await supabase
            .from('schedule_settings')
            .select('*')
            .eq('tenant_id', tenant?.id)
            .maybeSingle()
        if (data) {
            setStandardSettings(data)
            setFormData(prev => ({
                ...prev,
                start_time: data.start_time.slice(0, 5),
                module_duration: data.module_duration,
                breaks: data.breaks || []
            }))
        }
    }

    const calculateProposal = () => {
        if (!standardSettings) return

        // 1. Calculate how many modules are in a standard day
        const stdStart = parseTime(standardSettings.start_time)
        const stdEnd = parseTime(standardSettings.end_time)
        const stdTotalMin = stdEnd - stdStart
        const stdBreaksMin = (standardSettings.breaks || []).reduce((acc: number, b: any) => acc + (parseTime(b.end_time) - parseTime(b.start_time)), 0)
        const availableStdMin = stdTotalMin - stdBreaksMin
        const numModules = Math.floor(availableStdMin / standardSettings.module_duration)

        // 2. Calculate available time in special day
        const specStart = parseTime(formData.start_time)
        const specEnd = parseTime(formData.end_time)
        const specTotalMin = specEnd - specStart
        const specBreaksMin = (formData.breaks || []).reduce((acc: number, b: any) => acc + (parseTime(b.end_time) - parseTime(b.start_time)), 0)
        const availableSpecMin = specTotalMin - specBreaksMin

        // 3. Propose new duration
        const proposedDuration = Math.floor(availableSpecMin / numModules)

        setFormData({
            ...formData,
            module_duration: proposedDuration
        })
        setIsProposing(true)
        setTimeout(() => setIsProposing(false), 2000)
    }

    const parseTime = (t: string) => {
        if (!t) return 0
        const [h, m] = t.split(':').map(Number)
        return h * 60 + (m || 0)
    }

    const handleSave = async () => {
        setSaving(true)
        const { error } = await supabase
            .from('special_schedule_structure')
            .upsert({
                tenant_id: tenant?.id,
                target_date: formData.target_date,
                name: formData.name,
                start_time: formData.start_time + (formData.start_time.length === 5 ? ':00' : ''),
                end_time: formData.end_time + (formData.end_time.length === 5 ? ':00' : ''),
                module_duration: formData.module_duration,
                breaks: formData.breaks
            })

        if (!error) {
            fetchSpecialSchedules()
            setFormData({ ...formData, name: '' })
        } else {
            console.error(error)
            alert('Error al guardar: ' + error.message)
        }
        setSaving(false)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este ajuste?')) return
        await supabase.from('special_schedule_structure').delete().eq('id', id)
        fetchSpecialSchedules()
    }

    if (loading) return null

    return (
        <div className="space-y-12">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-black text-gray-900 tracking-tight">Actividades Extraordinarias</h3>
                    <p className="text-sm text-gray-500 font-medium tracking-tight">Ajusta los tiempos de clase para días con eventos especiales.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Form Section */}
                <div className="bg-gray-50 p-8 rounded-[2.5rem] border border-gray-100 space-y-8">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="col-span-2">
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Nombre del Evento</label>
                            <input
                                type="text"
                                placeholder="Ej: Festival Navideño, Acto Cívico..."
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-5 py-4 bg-white border border-transparent rounded-[1.25rem] text-sm font-bold text-gray-900 focus:ring-4 focus:ring-indigo-100 outline-none shadow-sm transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Fecha</label>
                            <input
                                type="date"
                                value={formData.target_date}
                                onChange={e => setFormData({ ...formData, target_date: e.target.value })}
                                className="w-full px-5 py-4 bg-white border border-transparent rounded-[1.25rem] text-sm font-bold text-gray-900 focus:ring-4 focus:ring-indigo-100 outline-none shadow-sm transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Hora Salida Ajustada</label>
                            <input
                                type="time"
                                value={formData.end_time}
                                onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                                className="w-full px-5 py-4 bg-white border border-transparent rounded-[1.25rem] text-sm font-bold text-gray-900 focus:ring-4 focus:ring-indigo-100 outline-none shadow-sm transition-all text-center"
                            />
                        </div>
                    </div>

                    {/* BREAKS LOGIC */}
                    <div className="space-y-6 pt-4 border-t border-gray-100">
                        <h4 className="text-[10px] font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                            <Clock className="w-4 h-4 text-indigo-500" /> Gestión de Recesos
                        </h4>

                        <div className="flex gap-4 p-2 bg-white rounded-2xl border border-gray-100 shadow-sm">
                            <button
                                onClick={() => setUseStandardBreaks(true)}
                                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${useStandardBreaks ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}
                            >
                                Usar Estándar
                            </button>
                            <button
                                onClick={() => setUseStandardBreaks(false)}
                                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!useStandardBreaks ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}
                            >
                                Personalizar
                            </button>
                        </div>

                        {!useStandardBreaks && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">
                                <div className="flex items-center justify-between px-2">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Número de recesos</span>
                                    <div className="flex bg-white rounded-lg border border-gray-100 p-1">
                                        {[1, 2, 3].map(n => (
                                            <button
                                                key={n}
                                                onClick={() => setNumBreaks(n)}
                                                className={`w-8 h-8 rounded-md text-xs font-black transition-all ${numBreaks === n ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`}
                                            >
                                                {n}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-3">
                                    {formData.breaks.map((b, i) => (
                                        <div key={i} className="flex gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                            <div className="flex-1">
                                                <label className="block text-[8px] font-black text-gray-400 uppercase mb-1">Inicio</label>
                                                <input
                                                    type="time"
                                                    value={b.start_time}
                                                    onChange={e => {
                                                        const newBreaks = [...formData.breaks]
                                                        newBreaks[i].start_time = e.target.value
                                                        setFormData({ ...formData, breaks: newBreaks })
                                                    }}
                                                    className="w-full text-xs font-bold bg-transparent border-none p-0 focus:ring-0"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-[8px] font-black text-gray-400 uppercase mb-1">Fin</label>
                                                <input
                                                    type="time"
                                                    value={b.end_time}
                                                    onChange={e => {
                                                        const newBreaks = [...formData.breaks]
                                                        newBreaks[i].end_time = e.target.value
                                                        setFormData({ ...formData, breaks: newBreaks })
                                                    }}
                                                    className="w-full text-xs font-bold bg-transparent border-none p-0 focus:ring-0"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {useStandardBreaks && (
                            <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 border-dashed">
                                <p className="text-[10px] font-bold text-indigo-600 leading-relaxed text-center">
                                    Se respetarán los {standardSettings?.breaks?.length || 0} recesos configurados en el horario oficial de la escuela.
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Sparkles className={`w-5 h-5 ${isProposing ? 'text-indigo-600 animate-bounce' : 'text-gray-400'}`} />
                                <span className="text-xs font-black text-gray-900 uppercase tracking-widest">Duración Sugerida</span>
                            </div>
                            <button
                                onClick={calculateProposal}
                                className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all"
                            >
                                Proponer Ajuste
                            </button>
                        </div>
                        <div className="flex items-center gap-4">
                            <input
                                type="number"
                                value={formData.module_duration}
                                onChange={e => setFormData({ ...formData, module_duration: parseInt(e.target.value) })}
                                className="text-3xl font-black text-indigo-600 bg-transparent border-none p-0 focus:ring-0 w-24"
                            />
                            <span className="text-xs font-bold text-gray-400 uppercase">Minutos por Módulo</span>
                        </div>
                        <p className="text-[10px] text-gray-400 font-medium leading-relaxed italic">
                            Este ajuste reduce proporcionalmente el tiempo de cada clase para que la jornada termine a la hora indicada.
                        </p>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={saving || !formData.name}
                        className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50"
                    >
                        {saving ? 'Guardando...' : 'Programar Ajuste'}
                    </button>
                </div>

                {/* List Section */}
                <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 ml-1">
                        <CalendarIcon className="w-3 h-3" /> Ajustes Programados
                    </h4>
                    <div className="grid grid-cols-1 gap-4 overflow-y-auto max-h-[700px] pr-2 custom-scrollbar">
                        {specialSchedules.map(s => (
                            <div key={s.id} className="p-6 bg-white border border-gray-100 rounded-3xl shadow-sm hover:shadow-xl hover:shadow-indigo-50 hover:border-indigo-100 transition-all relative group overflow-hidden">
                                <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-50 rounded-bl-full -mr-8 -mt-8 opacity-40 group-hover:scale-150 transition-transform" />
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <div>
                                        <h5 className="text-sm font-black text-gray-900 uppercase leading-snug">{s.name}</h5>
                                        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-0.5">{s.target_date}</p>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(s.id)}
                                        className="p-2 text-gray-300 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="flex items-center gap-6 relative z-10">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-3.5 h-3.5 text-indigo-400" />
                                        <span className="text-[10px] font-bold text-gray-600">{s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-sm shadow-indigo-200" />
                                        <span className="text-[10px] font-black text-slate-500 uppercase">{s.module_duration} min / clase</span>
                                    </div>
                                </div>
                                {s.breaks && s.breaks.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-gray-50 flex flex-wrap gap-2 relative z-10">
                                        {s.breaks.map((b: any, i: number) => (
                                            <span key={i} className="px-2 py-1 bg-gray-50 text-[8px] font-black text-gray-400 uppercase rounded-md">
                                                Receso: {b.start_time.slice(0, 5)} - {b.end_time.slice(0, 5)}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                        {specialSchedules.length === 0 && (
                            <div className="py-20 flex flex-col items-center justify-center text-gray-300 bg-gray-50/50 rounded-[2.5rem] border-2 border-dashed border-gray-100">
                                <div className="p-4 bg-white rounded-full shadow-sm mb-4">
                                    <CalendarIcon className="w-10 h-10 text-gray-200" />
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">No hay eventos extraordinarios</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
