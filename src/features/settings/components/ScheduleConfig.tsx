import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { Save, Plus, Trash2, Clock, Coffee, AlertCircle, Info, Sun, Moon } from 'lucide-react'
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
        if (settings.start_time >= settings.end_time) {
            alert('La hora de salida debe ser posterior a la hora de entrada.')
            return
        }

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
            // alert('Configuración guardada correctamente') 
            // Silent success or toast? Let's use a subtle feedback
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

    const updateBreak = (index: number, field: string, value: string) => {
        const newBreaks = [...settings.breaks]
        newBreaks[index] = { ...newBreaks[index], [field]: value }
        setSettings({ ...settings, breaks: newBreaks })
    }

    // Visualization Logic
    const timeline = useMemo(() => {
        const parseTime = (t: string) => {
            const [h, m] = t.split(':').map(Number)
            return h * 60 + m
        }

        const start = parseTime(settings.start_time)
        const end = parseTime(settings.end_time)
        const totalMinutes = end - start

        if (totalMinutes <= 0) return []

        // Calculate positions
        // Calculate positions
        const items: any[] = []

        // Add Breaks
        settings.breaks.forEach((b, i) => {
            const bStart = parseTime(b.start_time)
            const bEnd = parseTime(b.end_time)

            // Validate break is within range
            if (bStart >= start && bEnd <= end && bEnd > bStart) {
                const left = ((bStart - start) / totalMinutes) * 100
                const width = ((bEnd - bStart) / totalMinutes) * 100
                items.push({ type: 'break', left, width, data: b, id: `break-${i}` })
            }
        })

        // Add Teaching Blocks (Gaps)
        // This is complex because breaks might overlap or be unordered.
        // For simple visualization, just overlay breaks on a "class" background.
        return items
    }, [settings])


    if (loading) return (
        <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
    )

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center">
                        <Clock className="w-5 h-5 mr-2 text-indigo-600" />
                        Jornada y Horarios
                    </h3>
                    <p className="text-sm text-gray-500 font-medium mt-1">
                        Configura la estructura de tiempo de tu escuela. Esto afectará la generación automática de planeaciones.
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200 disabled:opacity-50 flex items-center active:scale-95"
                >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
            </div>

            {/* Visualizer */}
            <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Visualización de la Jornada</h4>

                <div className="relative h-16 bg-gray-50 rounded-xl w-full border border-gray-100 flex items-center overflow-hidden">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '10px 10px' }}></div>

                    {/* Base Day */}
                    <div className="absolute inset-0 bg-indigo-50/50 w-full h-full" />

                    {/* Timeline Items */}
                    {timeline.map((item: any) => (
                        <div
                            key={item.id}
                            className="absolute h-full top-0 bg-orange-100 border-l border-r border-orange-200 flex flex-col justify-center items-center group/break hover:bg-orange-200 transition-colors cursor-pointer"
                            style={{ left: `${item.left}%`, width: `${item.width}%` }}
                            title={`${item.data.name}: ${item.data.start_time} - ${item.data.end_time}`}
                        >
                            <Coffee className="w-3 h-3 text-orange-500 mb-1" />
                            <span className="text-[9px] font-black text-orange-700 uppercase hidden sm:block truncate w-full text-center px-1">
                                {item.data.name}
                            </span>
                        </div>
                    ))}
                </div>
                <div className="flex justify-between mt-2 text-[10px] font-bold text-gray-400 font-mono">
                    <span>{settings.start_time}</span>
                    <span className="text-center">Duración del día: {
                        (() => {
                            const [sh, sm] = settings.start_time.split(':').map(Number);
                            const [eh, em] = settings.end_time.split(':').map(Number);
                            const diff = (eh * 60 + em) - (sh * 60 + sm);
                            const hours = Math.floor(diff / 60);
                            const mins = diff % 60;
                            return `${hours}h ${mins}m`;
                        })()
                    }</span>
                    <span>{settings.end_time}</span>
                </div>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:border-indigo-100 transition-colors">
                    <label className="flex items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
                        <Sun className="w-3 h-3 mr-2" />
                        Inicio de Labores
                    </label>
                    <input
                        type="time"
                        value={settings.start_time}
                        onChange={(e) => setSettings({ ...settings, start_time: e.target.value })}
                        className="w-full text-2xl font-black text-gray-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer"
                    />
                </div>

                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:border-indigo-100 transition-colors">
                    <label className="flex items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
                        <Moon className="w-3 h-3 mr-2" />
                        Fin de Labores
                    </label>
                    <input
                        type="time"
                        value={settings.end_time}
                        onChange={(e) => setSettings({ ...settings, end_time: e.target.value })}
                        className="w-full text-2xl font-black text-gray-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer"
                    />
                </div>

                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:border-indigo-100 transition-colors">
                    <label className="flex items-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
                        <Clock className="w-3 h-3 mr-2" />
                        Duración Módulo
                    </label>
                    <div className="flex items-end">
                        <input
                            type="number"
                            value={settings.module_duration}
                            onChange={(e) => setSettings({ ...settings, module_duration: parseInt(e.target.value) || 0 })}
                            className="w-20 text-2xl font-black text-gray-900 bg-transparent border-b-2 border-gray-100 focus:border-indigo-500 p-0 focus:ring-0 text-center"
                        />
                        <span className="ml-2 text-sm font-bold text-gray-400 mb-1">minutos</span>
                    </div>
                </div>
            </div>

            {/* Breaks Section */}
            <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center">
                            <Coffee className="w-4 h-4 mr-2 text-orange-500" />
                            Recesos y Pausas
                        </h4>
                    </div>
                    <button
                        onClick={addBreak}
                        className="group flex items-center px-4 py-2 bg-gray-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:px-5 transition-all"
                    >
                        <Plus className="w-3 h-3 mr-2 group-hover:rotate-90 transition-transform" />
                        Agregar
                    </button>
                </div>

                <div className="space-y-3">
                    {settings.breaks.length > 0 ? (
                        settings.breaks.map((b, index) => (
                            <div key={index} className="group flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-md transition-all duration-300">
                                <div className="p-2 bg-white rounded-full text-gray-300">
                                    <Coffee className="w-4 h-4" />
                                </div>
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <input
                                        type="text"
                                        value={b.name}
                                        onChange={(e) => updateBreak(index, 'name', e.target.value)}
                                        placeholder="Nombre del receso"
                                        className="bg-transparent border-none font-bold text-gray-700 text-sm focus:ring-0 p-0 placeholder-gray-300"
                                    />
                                    <div className="flex items-center space-x-2">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">De</span>
                                        <input
                                            type="time"
                                            value={b.start_time}
                                            onChange={(e) => updateBreak(index, 'start_time', e.target.value)}
                                            className="bg-white border-transparent rounded-lg text-xs font-bold text-gray-600 focus:ring-2 focus:ring-indigo-100"
                                        />
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">A</span>
                                        <input
                                            type="time"
                                            value={b.end_time}
                                            onChange={(e) => updateBreak(index, 'end_time', e.target.value)}
                                            className="bg-white border-transparent rounded-lg text-xs font-bold text-gray-600 focus:ring-2 focus:ring-indigo-100"
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={() => removeBreak(index)}
                                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-10 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                            <Coffee className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                            <p className="text-sm font-medium text-gray-400">No hay recesos configurados.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
