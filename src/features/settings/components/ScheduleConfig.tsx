import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { Save, Plus, Trash2, Clock, Coffee, Sun, Moon, Loader2, CheckCircle2 } from 'lucide-react'
import { useTenant } from '../../../hooks/useTenant'
import { useToast } from '../../../components/ui/Toast'

export const ScheduleConfig = () => {
    const { data: tenant } = useTenant()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const { showToast } = useToast()
    // Copia de lo guardado: sirve para saber si hay cambios pendientes
    const [savedJson, setSavedJson] = useState<string>('')
    const [justSaved, setJustSaved] = useState(false)
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
            const loaded = {
                start_time: data.start_time.slice(0, 5),
                end_time: data.end_time.slice(0, 5),
                module_duration: data.module_duration,
                breaks: data.breaks || []
            }
            setSettings(loaded)
            setSavedJson(JSON.stringify(loaded))
        } else {
            setSavedJson('__nuevo__') // nunca se ha guardado: hay que guardar al menos una vez
        }
        if (error) console.error(error)
        setLoading(false)
    }

    const handleSave = async () => {
        if (settings.start_time >= settings.end_time) {
            showToast('La hora de salida debe ser después de la hora de entrada.', 'error')
            return
        }
        const badBreak = settings.breaks.find(b => b.start_time >= b.end_time || b.start_time < settings.start_time || b.end_time > settings.end_time)
        if (badBreak) {
            showToast(`Revisa el horario de "${badBreak.name || 'Receso'}": debe terminar después de empezar y quedar dentro de la jornada.`, 'error')
            return
        }

        setSaving(true)
        // For PRIMARY/TELESECUNDARIA level, we use a single large module (jornada completa)
        const moduleDuration = (tenant?.educationalLevel === 'PRIMARY' || tenant?.educationalLevel === 'TELESECUNDARIA') ? 600 : settings.module_duration;

        const { error } = await supabase
            .from('schedule_settings')
            .upsert({
                tenant_id: tenant?.id,
                start_time: settings.start_time,
                end_time: settings.end_time,
                module_duration: moduleDuration,
                breaks: settings.breaks
            }, { onConflict: 'tenant_id' })

        if (!error) {
            setSavedJson(JSON.stringify(settings))
            setJustSaved(true)
            setTimeout(() => setJustSaved(false), 3000)
            showToast('Jornada escolar guardada', 'success')
        } else {
            console.error(error)
            showToast('No se pudo guardar la jornada. Revisa tu conexión e intenta de nuevo.', 'error')
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

    const dirty = !loading && savedJson !== JSON.stringify(settings)

    // Avisa si intenta salir con cambios sin guardar
    useEffect(() => {
        if (!dirty) return
        const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
        window.addEventListener('beforeunload', h)
        return () => window.removeEventListener('beforeunload', h)
    }, [dirty])

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
        <div className="space-y-8 pb-24 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center">
                        <Clock className="w-5 h-5 mr-2 text-indigo-600" />
                        Jornada y horarios
                    </h3>
                    <p className="text-sm text-gray-500 font-medium mt-1">
                        Hora de entrada y salida, duración de cada clase y recesos. Se usa para armar tu horario y tus planeaciones.
                        Al hacer un cambio aparecerá el botón <strong>Guardar jornada</strong> abajo de la pantalla.
                    </p>
                </div>
            </div>

            {/* Visualizer */}
            <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-6">Así queda tu día</h4>

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
                            <span className="text-[11px] font-black text-orange-700 uppercase hidden sm:block truncate w-full text-center px-1">
                                {item.data.name}
                            </span>
                        </div>
                    ))}
                </div>
                <div className="flex justify-between mt-2 text-[11px] font-bold text-gray-500 font-mono">
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
                    <label className="flex items-center text-[11px] font-black text-gray-500 uppercase tracking-widest mb-3">
                        <Sun className="w-3 h-3 mr-2" />
                        Hora de entrada
                    </label>
                    <input
                        type="time"
                        value={settings.start_time}
                        onChange={(e) => setSettings({ ...settings, start_time: e.target.value })}
                        className="w-full text-2xl font-black text-gray-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer"
                    />
                </div>

                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:border-indigo-100 transition-colors">
                    <label className="flex items-center text-[11px] font-black text-gray-500 uppercase tracking-widest mb-3">
                        <Moon className="w-3 h-3 mr-2" />
                        Hora de salida
                    </label>
                    <input
                        type="time"
                        value={settings.end_time}
                        onChange={(e) => setSettings({ ...settings, end_time: e.target.value })}
                        className="w-full text-2xl font-black text-gray-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer"
                    />
                </div>

                {tenant?.educationalLevel !== 'PRIMARY' && tenant?.educationalLevel !== 'TELESECUNDARIA' ? (
                    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:border-indigo-100 transition-colors">
                        <label className="flex items-center text-[11px] font-black text-gray-500 uppercase tracking-widest mb-3">
                            <Clock className="w-3 h-3 mr-2" />
                            Duración de cada clase
                        </label>
                        <div className="flex items-end">
                            <input
                                type="number"
                                value={settings.module_duration}
                                onChange={(e) => setSettings({ ...settings, module_duration: parseInt(e.target.value) || 0 })}
                                className="w-20 text-2xl font-black text-gray-900 bg-transparent border-b-2 border-gray-100 focus:border-indigo-500 p-0 focus:ring-0 text-center"
                            />
                            <span className="ml-2 text-sm font-bold text-gray-500 mb-1">minutos</span>
                        </div>
                    </div>
                ) : (
                    <div className="bg-indigo-50 p-5 rounded-3xl border border-indigo-100 shadow-sm flex flex-col justify-center items-center text-center">
                        <Clock className="w-4 h-4 text-indigo-600 mb-2" />
                        <p className="text-[11px] font-black text-indigo-600 uppercase tracking-widest">Jornada Completa</p>
                        <p className="text-[11px] font-medium text-indigo-500 uppercase mt-1">Primaria/Telesecundaria utiliza bloques flexibles</p>
                    </div>
                )}
            </div>

            {/* Breaks Section */}
            <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center">
                            <Coffee className="w-4 h-4 mr-2 text-orange-500" />
                            Recesos
                        </h4>
                    </div>
                    <button
                        onClick={addBreak}
                        className="group flex items-center px-4 py-2 bg-gray-900 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:px-5 transition-all"
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
                                        <span className="text-[11px] font-bold text-gray-500 uppercase">De</span>
                                        <input
                                            type="time"
                                            value={b.start_time}
                                            onChange={(e) => updateBreak(index, 'start_time', e.target.value)}
                                            className="bg-white border-transparent rounded-lg text-xs font-bold text-gray-600 focus:ring-2 focus:ring-indigo-100"
                                        />
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-[11px] font-bold text-gray-500 uppercase">A</span>
                                        <input
                                            type="time"
                                            value={b.end_time}
                                            onChange={(e) => updateBreak(index, 'end_time', e.target.value)}
                                            className="bg-white border-transparent rounded-lg text-xs font-bold text-gray-600 focus:ring-2 focus:ring-indigo-100"
                                        />
                                    </div>
                                </div>
                                <button aria-label="Eliminar"
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
                            <p className="text-sm font-medium text-gray-500">No hay recesos configurados.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Botón al final (siempre) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl px-4 py-3 border bg-white border-slate-200 text-slate-700">
                <p className="text-sm font-semibold flex items-center gap-2" role="status">
                    {dirty ? 'Tienes cambios sin guardar.' : justSaved ? <><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Guardado.</> : 'Todo está guardado.'}
                </p>
                <button type="button" onClick={handleSave} disabled={saving || !dirty}
                    className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 py-3 rounded-2xl bg-emerald-500 text-white text-base font-black shadow-lg hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none">
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {saving ? 'Guardando…' : 'Guardar jornada'}
                </button>
            </div>

            {/* Aviso flotante: aparece en cuanto hay cambios, esté donde esté en la pantalla */}
            {dirty && (
                <div className="fixed left-3 right-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:bottom-6 lg:left-auto lg:right-8 lg:w-[26rem] z-40 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-2xl bg-slate-900 text-white px-4 py-3 shadow-2xl">
                    <span className="text-sm font-bold">Cambios sin guardar en tu jornada</span>
                    <button type="button" onClick={handleSave} disabled={saving}
                        className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-black disabled:opacity-50">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {saving ? 'Guardando…' : 'Guardar jornada'}
                    </button>
                </div>
            )}
        </div>
    )
}
