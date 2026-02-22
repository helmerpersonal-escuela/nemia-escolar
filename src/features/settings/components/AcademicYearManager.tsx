import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Plus, Trash2, Calendar, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { useTenant } from '../../../hooks/useTenant'

interface AcademicYear {
    id: string
    name: string
    start_date: string
    end_date: string
    is_active: boolean
}

export const AcademicYearManager = ({ readOnly = false }: { readOnly?: boolean }) => {
    const { data: tenant } = useTenant()
    const [years, setYears] = useState<AcademicYear[]>([])
    const [loading, setLoading] = useState(true)
    const [isCreating, setIsCreating] = useState(false)
    const [newYear, setNewYear] = useState({
        name: '',
        start_date: '',
        end_date: ''
    })
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (tenant) fetchYears()
    }, [tenant])

    const fetchYears = async () => {
        try {
            const { data, error } = await supabase
                .from('academic_years')
                .select('*')
                .eq('tenant_id', tenant?.id)
                .order('start_date', { ascending: false })

            if (error) throw error
            setYears(data || [])
        } catch (err: any) {
            console.error('Error fetching academic years:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        if (!tenant) return

        if (newYear.start_date > newYear.end_date) {
            setError('La fecha de inicio debe ser anterior a la fecha de fin.')
            return
        }

        try {
            const { data, error } = await supabase
                .from('academic_years')
                .insert([{
                    tenant_id: tenant.id,
                    name: newYear.name,
                    start_date: newYear.start_date,
                    end_date: newYear.end_date,
                    is_active: years.length === 0 // Make active if it's the first one
                }])
                .select()
                .single()

            if (error) throw error

            setYears([data, ...years])
            setIsCreating(false)
            setNewYear({ name: '', start_date: '', end_date: '' })
        } catch (err: any) {
            setError(err.message)
        }
    }

    const handleActivate = async (id: string) => {
        try {
            // Optimistic update
            const updatedYears = years.map(y => ({
                ...y,
                is_active: y.id === id
            }))
            setYears(updatedYears)

            // Trigger handles setting others to false, we just need to set this one to true
            const { error } = await supabase
                .from('academic_years')
                .update({ is_active: true })
                .eq('id', id)

            if (error) throw error

            // Re-fetch to ensure sync with trigger logic
            await fetchYears()
        } catch (err: any) {
            alert('Error al activar ciclo: ' + err.message)
            fetchYears() // Revert on error
        }
    }

    const handleDelete = async (id: string, isActive: boolean) => {
        if (isActive) {
            alert('No puedes eliminar el ciclo escolar activo. Activa otro primero.')
            return
        }
        if (!confirm('¿Estás seguro? Esto podría desconectar grupos y datos asociados.')) return

        try {
            const { error } = await supabase
                .from('academic_years')
                .delete()
                .eq('id', id)

            if (error) throw error
            setYears(years.filter(y => y.id !== id))
        } catch (err: any) {
            alert('Error al eliminar: ' + err.message)
        }
    }

    const formatDate = (dateString: string) => {
        if (!dateString) return ''
        const [year, month, day] = dateString.split('-').map(Number)
        return `${day}/${month}/${year}`
    }

    if (loading) return <div className="text-center py-4 text-gray-400 text-xs">Cargando ciclos...</div>

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-black text-gray-900 tracking-tight">Ciclos Escolares</h3>
                    <p className="text-sm text-gray-500 font-medium">Define los años lectivos (ej. 2024-2025). Solo uno puede estar activo.</p>
                </div>
                {!readOnly && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="px-6 py-3 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-gray-200 flex items-center"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Nuevo Ciclo
                    </button>
                )}
            </div>

            {(isCreating || years.length === 0) && (
                <form onSubmit={handleCreate} className="p-6 bg-gray-50 rounded-3xl border border-gray-100 space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Nombre Oficial</label>
                        <input
                            type="text"
                            placeholder="Ej. Ciclo Escolar 2024-2025"
                            className="w-full px-4 py-3 bg-white border border-transparent rounded-xl text-sm font-bold text-gray-900 focus:ring-4 focus:ring-blue-100 outline-none"
                            value={newYear.name}
                            onChange={e => setNewYear(prev => ({ ...prev, name: e.target.value }))}
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Inicio</label>
                            <input
                                type="date"
                                className="w-full px-4 py-3 bg-white border border-transparent rounded-xl text-sm font-bold text-gray-900 focus:ring-4 focus:ring-blue-100 outline-none"
                                value={newYear.start_date}
                                onChange={e => setNewYear(prev => ({ ...prev, start_date: e.target.value }))}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Fin</label>
                            <input
                                type="date"
                                className="w-full px-4 py-3 bg-white border border-transparent rounded-xl text-sm font-bold text-gray-900 focus:ring-4 focus:ring-blue-100 outline-none"
                                value={newYear.end_date}
                                onChange={e => setNewYear(prev => ({ ...prev, end_date: e.target.value }))}
                                required
                            />
                        </div>
                    </div>
                    {error && (
                        <div className="text-red-500 text-xs font-bold flex items-center bg-red-50 p-3 rounded-xl">
                            <AlertCircle className="w-4 h-4 mr-2" />
                            {error}
                        </div>
                    )}
                    <div className="flex justify-end space-x-2 pt-2">
                        <button
                            type="button"
                            onClick={() => setIsCreating(false)}
                            className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-900"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-100"
                        >
                            Guardar Ciclo
                        </button>
                    </div>
                </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {years.length === 0 && !isCreating ? (
                    <div className="col-span-full py-12 text-center bg-gray-50 border-2 border-dashed border-gray-100 rounded-[2rem]">
                        <p className="text-gray-400 font-bold text-sm">No has registrado ningún ciclo escolar.</p>
                    </div>
                ) : (
                    years.map(year => (
                        <div
                            key={year.id}
                            className={`p-6 rounded-3xl border transition-all relative overflow-hidden group
                                ${year.is_active
                                    ? 'bg-blue-600 text-white border-blue-500 shadow-xl shadow-blue-200/50'
                                    : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-lg'
                                }`}
                        >
                            <div className="relative z-10 flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Calendar className={`w-4 h-4 ${year.is_active ? 'text-blue-200' : 'text-gray-400'}`} />
                                        <h4 className={`text-lg font-black tracking-tight ${year.is_active ? 'text-white' : 'text-gray-900'}`}>
                                            {year.name}
                                        </h4>
                                    </div>
                                    <p className={`text-xs font-bold uppercase tracking-wider ${year.is_active ? 'text-blue-100' : 'text-gray-400'}`}>
                                        {formatDate(year.start_date)} — {formatDate(year.end_date)}
                                    </p>

                                    {year.is_active ? (
                                        <div className="mt-6 inline-flex items-center px-3 py-1 bg-white/20 rounded-full backdrop-blur-sm border border-white/20">
                                            <CheckCircle2 className="w-3 h-3 text-white mr-2" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-white">Ciclo Activo</span>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleActivate(year.id)}
                                            className="mt-6 inline-flex items-center px-4 py-2 bg-gray-50 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                        >
                                            Activar este ciclo
                                        </button>
                                    )}
                                </div>

                                {!readOnly && (
                                    <button
                                        onClick={() => handleDelete(year.id, year.is_active)}
                                        className={`p-2 rounded-xl transition-all ${year.is_active ? 'text-blue-200 hover:bg-white/10 hover:text-white' : 'text-gray-300 hover:bg-red-50 hover:text-red-500'}`}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            {/* Decorative Background */}
                            {year.is_active && (
                                <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12">
                                    <Clock className="w-32 h-32 text-white" />
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
