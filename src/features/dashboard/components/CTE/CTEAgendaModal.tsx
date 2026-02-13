
import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Save, Clock, User, FileText, CheckCircle2, AlertCircle } from 'lucide-react'
import { supabase } from '../../../../lib/supabase'
import { useTenant } from '../../../../hooks/useTenant'

interface AgendaItem {
    id: string
    time: string
    topic: string
    responsible: string
    status: 'pending' | 'in_progress' | 'completed'
}

interface CTEAgendaModalProps {
    isOpen: boolean
    onClose: () => void
    canEdit?: boolean // If true, allows adding/editing/deleting items
}

export const CTEAgendaModal = ({ isOpen, onClose, canEdit = false }: CTEAgendaModalProps) => {
    const { data: tenant } = useTenant()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([])
    const [nextDate, setNextDate] = useState<string>('')

    useEffect(() => {
        if (isOpen && tenant?.id) {
            loadAgenda()
        }
    }, [isOpen, tenant?.id])

    const loadAgenda = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('school_details')
                .select('cte_config')
                .eq('tenant_id', tenant?.id)
                .single()

            if (error) throw error

            if (data?.cte_config?.agenda) {
                setAgendaItems(data.cte_config.agenda)
            } else {
                setAgendaItems([])
            }

            if (data?.cte_config?.next_date) {
                setNextDate(data.cte_config.next_date)
            }

        } catch (error) {
            console.error('Error loading agenda:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        if (!tenant?.id) return
        setSaving(true)
        try {
            // Fetch current config first to preserve other fields like link/date
            const { data: currentData } = await supabase
                .from('school_details')
                .select('cte_config')
                .eq('tenant_id', tenant.id)
                .single()

            const currentConfig = currentData?.cte_config || {}

            const { error } = await supabase
                .from('school_details')
                .update({
                    cte_config: {
                        ...currentConfig,
                        agenda: agendaItems
                    }
                })
                .eq('tenant_id', tenant.id)

            if (error) throw error
            onClose()
        } catch (error) {
            console.error('Error saving agenda:', error)
            alert('Error al guardar la agenda.')
        } finally {
            setSaving(false)
        }
    }

    const addItem = () => {
        setAgendaItems([
            ...agendaItems,
            {
                id: crypto.randomUUID(),
                time: '08:00',
                topic: '',
                responsible: '',
                status: 'pending'
            }
        ])
    }

    const updateItem = (id: string, field: keyof AgendaItem, value: string) => {
        setAgendaItems(prev => prev.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ))
    }

    const deleteItem = (id: string) => {
        setAgendaItems(prev => prev.filter(item => item.id !== id))
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

                {/* Header */}
                <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                            <FileText className="w-6 h-6 text-blue-600" />
                            Orden del Día - Consejo Técnico
                        </h2>
                        {nextDate && (
                            <p className="text-sm font-bold text-gray-400 mt-1 flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                Próxima Sesión: {new Date(nextDate + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-6 h-6 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-6">
                    {loading ? (
                        <div className="flex justify-center py-20">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                    ) : (
                        <>
                            {agendaItems.length === 0 ? (
                                <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                                    <div className="p-4 bg-white rounded-full inline-flex mb-4 shadow-sm">
                                        <FileText className="w-8 h-8 text-gray-400" />
                                    </div>
                                    <p className="text-gray-400 font-bold">No hay puntos en la agenda aún.</p>
                                    {canEdit && (
                                        <button
                                            onClick={addItem}
                                            className="mt-4 px-6 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold hover:bg-blue-100 transition-colors"
                                        >
                                            Agregar Primer Punto
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {agendaItems.map((item, index) => (
                                        <div key={item.id} className="flex gap-4 items-start group">
                                            {/* Time Column */}
                                            <div className="w-24 flex-shrink-0 pt-3">
                                                {canEdit ? (
                                                    <input
                                                        type="time"
                                                        value={item.time}
                                                        onChange={(e) => updateItem(item.id, 'time', e.target.value)}
                                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                                                    />
                                                ) : (
                                                    <div className="font-black text-gray-900 text-lg text-right">{item.time}</div>
                                                )}
                                            </div>

                                            {/* Timeline Connector (Visual) */}
                                            <div className="flex flex-col items-center self-stretch relative pt-4">
                                                <div className="w-3 h-3 rounded-full bg-blue-500 shadow-lg shadow-blue-200 z-10" />
                                                {index !== agendaItems.length - 1 && (
                                                    <div className="w-0.5 flex-1 bg-gray-200 my-1" />
                                                )}
                                            </div>

                                            {/* Content Card */}
                                            <div className="flex-1 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm group-hover:shadow-md transition-all">
                                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                                    <div className="md:col-span-8">
                                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Actividad / Tema</label>
                                                        {canEdit ? (
                                                            <textarea
                                                                value={item.topic}
                                                                onChange={(e) => updateItem(item.id, 'topic', e.target.value)}
                                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium text-gray-900 resize-none h-20 focus:bg-white transition-all outline-none focus:border-blue-500"
                                                                placeholder="Descripción de la actividad..."
                                                            />
                                                        ) : (
                                                            <p className="text-gray-800 font-medium leading-relaxed">{item.topic}</p>
                                                        )}
                                                    </div>
                                                    <div className="md:col-span-4 flex flex-col justify-between">
                                                        <div>
                                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Responsable</label>
                                                            {canEdit ? (
                                                                <input
                                                                    type="text"
                                                                    value={item.responsible}
                                                                    onChange={(e) => updateItem(item.id, 'responsible', e.target.value)}
                                                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium text-gray-900 focus:bg-white transition-all outline-none focus:border-blue-500"
                                                                    placeholder="Nombre del responsable"
                                                                />
                                                            ) : (
                                                                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-xl text-blue-700 font-bold text-sm">
                                                                    <User className="w-4 h-4" />
                                                                    {item.responsible || 'Sin asignar'}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {canEdit && (
                                                            <button
                                                                onClick={() => deleteItem(item.id)}
                                                                className="self-end mt-2 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Eliminar punto"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {canEdit && (
                                <button
                                    onClick={addItem}
                                    className="w-full py-4 mt-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 font-bold hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                                >
                                    <Plus className="w-5 h-5" />
                                    Agregar Nuevo Punto
                                </button>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 text-gray-600 font-bold hover:bg-gray-200 rounded-xl transition-colors"
                    >
                        Cerrar
                    </button>
                    {canEdit && (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-3 bg-gray-900 text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-black transition-all shadow-lg shadow-gray-300 flex items-center gap-2 disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Guardando...' : 'Guardar Agenda'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
