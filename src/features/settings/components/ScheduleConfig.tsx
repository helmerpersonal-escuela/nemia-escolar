import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Save, Plus, Trash2, Clock, Coffee } from 'lucide-react'
import { useTenant } from '../../../hooks/useTenant'

export const ScheduleConfig = () => {
    const { data: tenant } = useTenant()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [settings, setSettings] = useState({
        start_time: '07:00',
        end_time: '14:00',
        module_duration: 50,
        breaks: [] as { name: string, start_time: string, end_time: string }[]
    })

    useEffect(() => {
        if (tenant) fetchSettings()
    }, [tenant])

    const fetchSettings = async () => {
        const { data, error } = await supabase
            .from('schedule_settings')
            .select('*')
            .eq('tenant_id', tenant?.id)
            .maybeSingle()

        if (data) {
            setSettings({
                start_time: data.start_time.slice(0, 5),
                end_time: data.end_time.slice(0, 5),
                module_duration: data.module_duration,
                breaks: data.breaks || []
            })
        }
        setLoading(false)
    }

    const handleSave = async () => {
        setSaving(true)
        const { error } = await supabase
            .from('schedule_settings')
            .upsert({
                tenant_id: tenant?.id,
                start_time: settings.start_time,
                end_time: settings.end_time,
                module_duration: settings.module_duration,
                breaks: settings.breaks
            }, { onConflict: 'tenant_id' })

        if (!error) {
            alert('Configuración guardada correctamente')
        } else {
            console.error(error)
            alert('Error al guardar la configuración')
        }
        setSaving(false)
    }

    const addBreak = () => {
        setSettings({
            ...settings,
            breaks: [...settings.breaks, { name: 'Receso', start_time: '10:00', end_time: '10:30' }]
        })
    }

    const removeBreak = (index: number) => {
        setSettings({
            ...settings,
            breaks: settings.breaks.filter((_, i) => i !== index)
        })
    }

    if (loading) return <div className="p-8 text-center text-gray-400">Cargando configuración de horarios...</div>

    return (
        <div className="space-y-10">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-black text-gray-900 tracking-tight">Jornada Escolar Estándar</h3>
                    <p className="text-sm text-gray-500 font-medium">Define la estructura base para el horario de clases y recesos.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-3 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-gray-200 disabled:opacity-50 flex items-center"
                >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Guardando...' : 'Guardar Jornada'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Hora de Entrada</label>
                    <div className="relative">
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="time"
                            value={settings.start_time}
                            onChange={(e) => setSettings({ ...settings, start_time: e.target.value })}
                            className="w-full pl-12 pr-4 py-3 bg-white border border-transparent rounded-2xl text-gray-900 font-bold focus:ring-4 focus:ring-blue-100 outline-none"
                        />
                    </div>
                </div>

                <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Hora de Salida</label>
                    <div className="relative">
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="time"
                            value={settings.end_time}
                            onChange={(e) => setSettings({ ...settings, end_time: e.target.value })}
                            className="w-full pl-12 pr-4 py-3 bg-white border border-transparent rounded-2xl text-gray-900 font-bold focus:ring-4 focus:ring-blue-100 outline-none"
                        />
                    </div>
                </div>

                <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Tiempo por Módulo (min)</label>
                    <div className="relative">
                        <input
                            type="number"
                            value={settings.module_duration}
                            onChange={(e) => setSettings({ ...settings, module_duration: parseInt(e.target.value) })}
                            className="w-full px-5 py-3 bg-white border border-transparent rounded-2xl text-gray-900 font-bold focus:ring-4 focus:ring-blue-100 outline-none"
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                    <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center">
                        <Coffee className="w-5 h-5 mr-3 text-orange-500" />
                        Recesos y Descansos
                    </h4>
                    <button
                        onClick={addBreak}
                        className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Añadir Receso
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {settings.breaks.map((b, index) => (
                        <div key={index} className="p-6 bg-white border border-gray-100 rounded-3xl shadow-sm space-y-4 group">
                            <div className="flex justify-between items-center">
                                <input
                                    type="text"
                                    value={b.name}
                                    onChange={(e) => {
                                        const newBreaks = [...settings.breaks]
                                        newBreaks[index].name = e.target.value
                                        setSettings({ ...settings, breaks: newBreaks })
                                    }}
                                    className="text-sm font-black text-gray-900 bg-transparent border-none p-0 focus:ring-0 w-full"
                                />
                                <button
                                    onClick={() => removeBreak(index)}
                                    className="p-2 text-gray-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <input
                                    type="time"
                                    value={b.start_time}
                                    onChange={(e) => {
                                        const newBreaks = [...settings.breaks]
                                        newBreaks[index].start_time = e.target.value
                                        setSettings({ ...settings, breaks: newBreaks })
                                    }}
                                    className="px-3 py-2 bg-gray-50 border-transparent rounded-xl text-xs font-bold"
                                />
                                <input
                                    type="time"
                                    value={b.end_time}
                                    onChange={(e) => {
                                        const newBreaks = [...settings.breaks]
                                        newBreaks[index].end_time = e.target.value
                                        setSettings({ ...settings, breaks: newBreaks })
                                    }}
                                    className="px-3 py-2 bg-gray-50 border-transparent rounded-xl text-xs font-bold"
                                />
                            </div>
                        </div>
                    ))}
                    {settings.breaks.length === 0 && (
                        <div className="col-span-full py-12 border-2 border-dashed border-gray-100 rounded-[2rem] text-center text-gray-400 italic text-sm">
                            No hay recesos configurados.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
