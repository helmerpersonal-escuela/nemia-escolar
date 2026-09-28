import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { Trash2, Clock, Coffee } from 'lucide-react'
import { SettingsCard, SettingsActionButton, SaveBar } from './SettingsUI'
import { WizardField, wizardInput } from '../../../components/wizard/Wizard'
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
            // Aún no se ha guardado: se usan los valores sugeridos; la barra aparece en cuanto cambie algo
            setSavedJson(JSON.stringify(settings))
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

    const isFlexible = tenant?.educationalLevel === 'PRIMARY' || tenant?.educationalLevel === 'TELESECUNDARIA'
    const dayLength = (() => {
        const [sh, sm] = settings.start_time.split(':').map(Number)
        const [eh, em] = settings.end_time.split(':').map(Number)
        const diff = (eh * 60 + em) - (sh * 60 + sm)
        return diff > 0 ? `${Math.floor(diff / 60)} h ${diff % 60} min` : '—'
    })()
    const discard = () => { try { if (savedJson) setSettings(JSON.parse(savedJson)) } catch { /* nada */ } }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <SettingsCard icon={Clock} title="Horario de la escuela" hint="La hora en que empiezan y terminan las clases.">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <WizardField label="Hora de entrada">
                        <input type="time" className={wizardInput} value={settings.start_time} onChange={(e) => setSettings({ ...settings, start_time: e.target.value })} />
                    </WizardField>
                    <WizardField label="Hora de salida">
                        <input type="time" className={wizardInput} value={settings.end_time} onChange={(e) => setSettings({ ...settings, end_time: e.target.value })} />
                    </WizardField>
                    {!isFlexible ? (
                        <WizardField label="Duración de cada clase" hint="En minutos.">
                            <input type="number" min={10} max={180} inputMode="numeric" className={wizardInput} value={settings.module_duration}
                                onChange={(e) => setSettings({ ...settings, module_duration: parseInt(e.target.value) || 0 })} />
                        </WizardField>
                    ) : (
                        <div className="rounded-2xl bg-indigo-50 border border-indigo-100 px-4 py-3 text-sm text-indigo-900">
                            <strong>Jornada completa.</strong> En primaria y telesecundaria las clases se organizan en bloques flexibles.
                        </div>
                    )}
                </div>

                {/* Así queda el día */}
                <div>
                    <div className="relative h-12 rounded-xl w-full border border-slate-100 bg-indigo-50/60 overflow-hidden">
                        {timeline.map((item: any) => (
                            <div key={item.id} className="absolute h-full top-0 bg-orange-100 border-x border-orange-200 flex items-center justify-center"
                                style={{ left: `${item.left}%`, width: `${item.width}%` }} title={`${item.data.name}: ${item.data.start_time} - ${item.data.end_time}`}>
                                <Coffee className="w-3.5 h-3.5 text-orange-500" />
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between mt-2 text-xs font-semibold text-slate-500">
                        <span>{settings.start_time}</span>
                        <span>Duración del día: {dayLength}</span>
                        <span>{settings.end_time}</span>
                    </div>
                </div>
            </SettingsCard>

            <SettingsCard icon={Coffee} title="Recesos" hint="Los tiempos sin clase. Se descuentan al armar tu horario."
                action={<SettingsActionButton onClick={addBreak}>Agregar receso</SettingsActionButton>}>
                {settings.breaks.length > 0 ? (
                    <div className="space-y-3">
                        {settings.breaks.map((b, index) => (
                            <div key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] items-end gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <WizardField label="Nombre">
                                    <input type="text" className={wizardInput} value={b.name} onChange={(e) => updateBreak(index, 'name', e.target.value)} placeholder="Ej. Receso" />
                                </WizardField>
                                <WizardField label="De">
                                    <input type="time" className={wizardInput} value={b.start_time} onChange={(e) => updateBreak(index, 'start_time', e.target.value)} />
                                </WizardField>
                                <WizardField label="A">
                                    <input type="time" className={wizardInput} value={b.end_time} onChange={(e) => updateBreak(index, 'end_time', e.target.value)} />
                                </WizardField>
                                <button type="button" aria-label={`Quitar ${b.name || 'receso'}`} onClick={() => removeBreak(index)}
                                    className="justify-self-end min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl">
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-slate-500 text-center py-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                        Aún no hay recesos. Usa “Agregar receso” si tu escuela tiene uno.
                    </p>
                )}
            </SettingsCard>

            <SaveBar dirty={dirty} saving={saving} onSave={handleSave} onDiscard={discard}
                label="Guardar jornada" what="cambios en la jornada" saved={justSaved} />
        </div>
    )
}
