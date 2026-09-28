import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { Plus, Trash2, Calendar, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { useTenant } from '../../../hooks/useTenant'
import { DateInput } from '../../../components/ui/DateInput'
import { OfficialCycleNote, type CycleSource } from '../../../components/academic/OfficialCycleNote'
import { useOfficialCycle } from '../../../lib/officialCalendar'
import { askConfirm } from '../../../components/ui/ConfirmDialog'
import { SettingsCard, SettingsActionButton } from './SettingsUI'

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
    const navigate = useNavigate()

    // Prellenado con el calendario oficial de la SEP (con conexión); se puede editar.
    const { data: officialCycle, isLoading: officialLoading } = useOfficialCycle()
    const [cycleSource, setCycleSource] = useState<CycleSource>('estimado')
    const officialAlreadyRegistered = !!officialCycle && years.some(y => y.start_date === officialCycle.startDate && y.end_date === officialCycle.endDate)
    const applyOfficialCycle = () => {
        if (!officialCycle) return
        setNewYear(prev => ({ ...prev, name: officialCycle.name, start_date: officialCycle.startDate, end_date: officialCycle.endDate }))
        setCycleSource('oficial')
    }
    useEffect(() => {
        if ((isCreating || years.length === 0) && officialCycle && !officialAlreadyRegistered && !newYear.name && !newYear.start_date && !newYear.end_date) {
            applyOfficialCycle()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isCreating, years.length, officialCycle])

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
            setCycleSource('estimado')
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
        if (!(await askConfirm('¿Estás seguro? Esto podría desconectar grupos y datos asociados.'))) return

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

    if (loading) return <div className="text-center py-4 text-gray-500 text-xs">Cargando ciclos...</div>

    return (
        <SettingsCard icon={Calendar} title="Ciclo escolar" hint="El año escolar con sus fechas de inicio y fin. Solo uno puede estar activo."
            action={!readOnly ? <SettingsActionButton onClick={() => (years.length > 0 ? navigate('/nuevo-ciclo') : setIsCreating(true))}>Nuevo ciclo</SettingsActionButton> : undefined}>

            {(isCreating || years.length === 0) && (
                <form onSubmit={handleCreate} className="p-6 bg-gray-50 rounded-3xl border border-gray-100 space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div>
                        <label className="block text-[11px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Nombre Oficial</label>
                        <input aria-label="Nombre Oficial"
                            type="text"
                            placeholder="Ej. Ciclo Escolar 2024-2025"
                            className="w-full px-4 py-3 bg-white border border-transparent rounded-xl text-sm font-bold text-gray-900 focus:ring-4 focus:ring-blue-100 outline-none"
                            value={newYear.name}
                            onChange={e => { setNewYear(prev => ({ ...prev, name: e.target.value })); setCycleSource('manual') }}
                            required
                        />
                    </div>
                    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[11px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Inicio</label>
                            <DateInput aria-label="Inicio"
                                className="w-full px-4 py-3 bg-white border border-transparent rounded-xl text-sm font-bold text-gray-900 focus:ring-4 focus:ring-blue-100 outline-none"
                                value={newYear.start_date}
                                onChange={e => { setNewYear(prev => ({ ...prev, start_date: e.target.value })); setCycleSource('manual') }}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Fin</label>
                            <DateInput aria-label="Fin"
                                className="w-full px-4 py-3 bg-white border border-transparent rounded-xl text-sm font-bold text-gray-900 focus:ring-4 focus:ring-blue-100 outline-none"
                                value={newYear.end_date}
                                onChange={e => { setNewYear(prev => ({ ...prev, end_date: e.target.value })); setCycleSource('manual') }}
                                required
                            />
                        </div>
                    </div>
                    {(cycleSource !== 'estimado' || !officialAlreadyRegistered) && (
                        <OfficialCycleNote source={cycleSource} official={officialAlreadyRegistered ? null : officialCycle} loading={officialLoading} onUseOfficial={applyOfficialCycle} />
                    )}
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
                        <p className="text-gray-500 font-bold text-sm">No has registrado ningún ciclo escolar.</p>
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
                                        <Calendar className={`w-4 h-4 ${year.is_active ? 'text-blue-200' : 'text-gray-500'}`} />
                                        <h4 className={`text-lg font-black tracking-tight ${year.is_active ? 'text-white' : 'text-gray-900'}`}>
                                            {year.name}
                                        </h4>
                                    </div>
                                    <p className={`text-xs font-bold uppercase tracking-wider ${year.is_active ? 'text-blue-100' : 'text-gray-500'}`}>
                                        {formatDate(year.start_date)} — {formatDate(year.end_date)}
                                    </p>

                                    {year.is_active ? (
                                        <div className="mt-6 inline-flex items-center px-3 py-1 bg-white/20 rounded-full backdrop-blur-sm border border-white/20">
                                            <CheckCircle2 className="w-3 h-3 text-white mr-2" />
                                            <span className="text-[11px] font-black uppercase tracking-widest text-white">Ciclo Activo</span>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleActivate(year.id)}
                                            className="mt-6 inline-flex items-center px-4 py-2 bg-gray-50 text-gray-600 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                        >
                                            Activar este ciclo
                                        </button>
                                    )}
                                </div>

                                {!readOnly && (
                                    <button aria-label="Eliminar"
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
        </SettingsCard>
    )
}
