import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Plus, Trash2, Save } from 'lucide-react'

type Break = {
    name: string
    start_time: string
    end_time: string
}

type ScheduleSettings = {
    start_time: string
    end_time: string
    module_duration: number
    breaks: Break[]
}

export const ScheduleSettingsForm = ({ onSuccess }: { onSuccess: () => void }) => {
    const { data: tenant } = useTenant()
    const [loading, setLoading] = useState(false)
    const [settings, setSettings] = useState<ScheduleSettings>({
        start_time: '07:00',
        end_time: '14:00',
        module_duration: 50,
        breaks: []
    })

    useEffect(() => {
        if (!tenant?.id) return

        const fetchSettings = async () => {
            const { data } = await supabase
                .from('schedule_settings')
                .select('*')
                .eq('tenant_id', tenant.id)
                .maybeSingle()

            if (data) {
                setSettings({
                    start_time: data.start_time.slice(0, 5),
                    end_time: data.end_time.slice(0, 5),
                    module_duration: data.module_duration,
                    breaks: data.breaks || []
                })
            }
        }
        fetchSettings()
    }, [tenant?.id])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!tenant?.id) return

        setLoading(true)
        try {
            // Upsert
            const { error } = await supabase
                .from('schedule_settings')
                .upsert({
                    tenant_id: tenant.id,
                    ...settings
                }, { onConflict: 'tenant_id' })

            if (error) throw error
            onSuccess()
            alert('Configuración guardada.')

        } catch (error: any) {
            alert('Error: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const addBreak = () => {
        setSettings({
            ...settings,
            breaks: [...settings.breaks, { name: 'Receso', start_time: '10:00', end_time: '10:30' }]
        })
    }

    const removeBreak = (index: number) => {
        const newBreaks = [...settings.breaks]
        newBreaks.splice(index, 1)
        setSettings({ ...settings, breaks: newBreaks })
    }

    const updateBreak = (index: number, field: keyof Break, value: string) => {
        const newBreaks = [...settings.breaks]
        newBreaks[index] = { ...newBreaks[index], [field]: value }
        setSettings({ ...settings, breaks: newBreaks })
    }

    return (
        <form onSubmit={handleSave} className="space-y-6 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Configuración General del Horario</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Inicio de Jornada</label>
                    <input
                        type="time"
                        required
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        value={settings.start_time}
                        onChange={e => setSettings({ ...settings, start_time: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Fin de Jornada</label>
                    <input
                        type="time"
                        required
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        value={settings.end_time}
                        onChange={e => setSettings({ ...settings, end_time: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Duración Módulo (min)</label>
                    <input
                        type="number"
                        required
                        min="10"
                        max="120"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        value={settings.module_duration}
                        onChange={e => setSettings({ ...settings, module_duration: parseInt(e.target.value) })}
                    />
                </div>
            </div>

            <div>
                <div className="flex justify-between items-center mb-4">
                    <label className="block text-sm font-medium text-gray-700">Recesos / Descansos</label>
                    <button
                        type="button"
                        onClick={addBreak}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200"
                    >
                        <Plus className="h-4 w-4 mr-1" />
                        Agregar Receso
                    </button>
                </div>

                {settings.breaks.length === 0 && (
                    <p className="text-sm text-gray-500 italic">No hay recesos configurados.</p>
                )}

                <div className="space-y-3">
                    {settings.breaks.map((brk, index) => (
                        <div key={index} className="flex gap-4 items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                            <div className="flex-1">
                                <input
                                    type="text"
                                    placeholder="Nombre"
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                    value={brk.name}
                                    onChange={e => updateBreak(index, 'name', e.target.value)}
                                />
                            </div>
                            <div>
                                <input
                                    type="time"
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                    value={brk.start_time}
                                    onChange={e => updateBreak(index, 'start_time', e.target.value)}
                                />
                            </div>
                            <span>-</span>
                            <div>
                                <input
                                    type="time"
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                                    value={brk.end_time}
                                    onChange={e => updateBreak(index, 'end_time', e.target.value)}
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => removeBreak(index)}
                                className="text-red-500 hover:text-red-700"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex justify-end pt-4">
                <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                    <Save className="h-4 w-4 mr-2" />
                    {loading ? 'Guardando...' : 'Guardar Configuración'}
                </button>
            </div>
        </form>
    )
}
