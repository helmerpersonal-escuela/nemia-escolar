
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Plus, Trash2, Calendar, AlertCircle, Edit2 } from 'lucide-react'
import { useTenant } from '../../../hooks/useTenant'

interface Period {
    id: string
    name: string
    start_date: string
    end_date: string
    is_active: boolean
}

interface PeriodManagerProps {
    onSelectPeriod?: (period: Period) => void
    selectedPeriodId?: string | null
    readOnly?: boolean
}

export const PeriodManager = ({ onSelectPeriod, selectedPeriodId, readOnly = false }: PeriodManagerProps) => {
    const { data: tenant } = useTenant()
    const [periods, setPeriods] = useState<Period[]>([])
    const [loading, setLoading] = useState(true)
    const [isCreating, setIsCreating] = useState(false)
    const [newPeriod, setNewPeriod] = useState({
        name: '',
        start_date: '',
        end_date: ''
    })
    const [editingPeriod, setEditingPeriod] = useState<Period | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (tenant) fetchPeriods()
    }, [tenant])

    const fetchPeriods = async () => {
        try {
            const { data, error } = await supabase
                .from('evaluation_periods')
                .select('*')
                .eq('tenant_id', tenant?.id)
                .order('start_date', { ascending: true })

            if (error) throw error
            setPeriods(data || [])
        } catch (err: any) {
            console.error('Error fetching periods:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        if (!tenant) return

        if (newPeriod.start_date > newPeriod.end_date) {
            setError('La fecha de inicio debe ser anterior a la fecha de fin.')
            return
        }

        try {
            const { data, error } = await supabase
                .from('evaluation_periods')
                .insert([{
                    tenant_id: tenant.id,
                    name: newPeriod.name,
                    start_date: newPeriod.start_date,
                    end_date: newPeriod.end_date,
                    is_active: periods.length === 0 // Make active if it's the first one
                }])
                .select()
                .single()

            if (error) throw error

            setPeriods([...periods, data])
            setIsCreating(false)
            setNewPeriod({ name: '', start_date: '', end_date: '' })
        } catch (err: any) {
            setError(err.message)
        }
    }

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingPeriod) return
        setError(null)

        if (editingPeriod.start_date > editingPeriod.end_date) {
            setError('La fecha de inicio debe ser anterior a la fecha de fin.')
            return
        }

        try {
            const { error } = await supabase
                .from('evaluation_periods')
                .update({
                    name: editingPeriod.name,
                    start_date: editingPeriod.start_date,
                    end_date: editingPeriod.end_date
                })
                .eq('id', editingPeriod.id)

            if (error) throw error

            setPeriods(periods.map(p => p.id === editingPeriod.id ? editingPeriod : p))
            setEditingPeriod(null)
        } catch (err: any) {
            setError(err.message)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro? Esto eliminará también los criterios asociados.')) return

        try {
            const { error } = await supabase
                .from('evaluation_periods')
                .delete()
                .eq('id', id)

            if (error) throw error
            setPeriods(periods.filter(p => p.id !== id))
        } catch (err: any) {
            alert('Error al eliminar: ' + err.message)
        }
    }

    const formatDate = (dateString: string) => {
        if (!dateString) return ''
        // Evitar desfase de zona horaria dividiendo la cadena YYYY-MM-DD
        const [year, month, day] = dateString.split('-').map(Number)
        return `${day}/${month}/${year}`
    }

    if (loading) return <div>Cargando periodos...</div>

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Calendar className="w-5 h-5 mr-2 text-indigo-600" />
                    Periodos de Evaluación
                </h3>
                {!readOnly && (
                    <button
                        onClick={() => { setIsCreating(true); setEditingPeriod(null); }}
                        className="text-sm bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors font-medium flex items-center"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        Nuevo Periodo
                    </button>
                )}
            </div>

            {!readOnly && (isCreating || editingPeriod) && (
                <form onSubmit={editingPeriod ? handleUpdate : handleCreate} className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4 border border-gray-200">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Periodo</label>
                        <input
                            type="text"
                            placeholder="Ej. Primer Trimestre"
                            className="w-full px-3 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            value={editingPeriod ? editingPeriod.name : newPeriod.name}
                            onChange={e => editingPeriod ? setEditingPeriod(prev => prev ? ({ ...prev, name: e.target.value }) : null) : setNewPeriod(prev => ({ ...prev, name: e.target.value }))}
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Inicio</label>
                            <input
                                type="date"
                                className="w-full px-3 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                value={editingPeriod ? editingPeriod.start_date : newPeriod.start_date}
                                onChange={e => editingPeriod ? setEditingPeriod(prev => prev ? ({ ...prev, start_date: e.target.value }) : null) : setNewPeriod(prev => ({ ...prev, start_date: e.target.value }))}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fin</label>
                            <input
                                type="date"
                                className="w-full px-3 py-2 rounded-md border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                value={editingPeriod ? editingPeriod.end_date : newPeriod.end_date}
                                onChange={e => editingPeriod ? setEditingPeriod(prev => prev ? ({ ...prev, end_date: e.target.value }) : null) : setNewPeriod(prev => ({ ...prev, end_date: e.target.value }))}
                                required
                            />
                        </div>
                    </div>
                    {error && (
                        <div className="text-red-600 text-sm flex items-center bg-red-50 p-2 rounded">
                            <AlertCircle className="w-4 h-4 mr-2" />
                            {error}
                        </div>
                    )}
                    <div className="flex justify-end space-x-2">
                        <button
                            type="button"
                            onClick={() => { setIsCreating(false); setEditingPeriod(null); }}
                            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                        >
                            {editingPeriod ? 'Actualizar' : 'Guardar'}
                        </button>
                    </div>
                </form>
            )}

            <div className="space-y-3">
                {periods.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4 italic">No hay periodos configurados.</p>
                ) : (
                    periods.map(period => (
                        <div
                            key={period.id}
                            onClick={() => onSelectPeriod && onSelectPeriod(period)}
                            className={`flex items-center justify-between p-4 rounded-xl group transition-all cursor-pointer border
                                ${selectedPeriodId === period.id
                                    ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-300'
                                    : 'bg-white border-gray-100 hover:bg-gray-50 hover:border-gray-200 shadow-sm'
                                }`}
                        >
                            <div className="flex items-center space-x-4">
                                <div className={`p-2 rounded-lg ${selectedPeriodId === period.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                    <Calendar className="w-4 h-4" />
                                </div>
                                <div>
                                    <h4 className={`font-black text-xs uppercase tracking-tight ${selectedPeriodId === period.id ? 'text-indigo-900' : 'text-gray-900'}`}>
                                        {period.name}
                                    </h4>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">
                                        {formatDate(period.start_date)} — {formatDate(period.end_date)}
                                    </p>
                                </div>
                            </div>
                            {!readOnly && (
                                <div className="flex items-center space-x-1">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setEditingPeriod(period)
                                            setIsCreating(false)
                                        }}
                                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                        title="Editar periodo"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleDelete(period.id)
                                        }}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                        title="Eliminar periodo"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
