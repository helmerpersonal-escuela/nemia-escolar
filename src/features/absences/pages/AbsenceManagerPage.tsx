
import { useState } from 'react'
import { Plus, Calendar, FileText, Printer, Trash2, Edit3, ArrowRight, Clock, AlertCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { useProfile } from '../../../hooks/useProfile'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { AbsenceRequestModal } from '../components/AbsenceRequestModal'
import { AbsenceDetailView } from '../components/AbsenceDetailView'

export const AbsenceManagerPage = () => {
    const { data: tenant } = useTenant()
    const { profile } = useProfile()
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedAbsence, setSelectedAbsence] = useState<any>(null)

    const { data: absences, isLoading, refetch } = useQuery({
        queryKey: ['absences', tenant?.id, profile?.id],
        enabled: !!tenant?.id && !!profile?.id,
        queryFn: async () => {
            const { data } = await supabase
                .from('teacher_absences')
                .select(`
                    *,
                    activities:substitution_activities(
                        *,
                        group:groups(grade, section),
                        subject:subject_catalog(name)
                    )
                `)
                .eq('profile_id', profile?.id)
                .order('start_date', { ascending: false })
            return data || []
        }
    })

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este registro de ausencia y sus actividades?')) return
        // Cascase delete happens automatically if configured, otherwise we should delete activities first
        await supabase.from('substitution_activities').delete().eq('absence_id', id)
        await supabase.from('teacher_absences').delete().eq('id', id)
        refetch()
    }

    return (
        <div className="p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">
                        Gestión de <span className="text-indigo-600">Ausencias</span>
                    </h1>
                    <p className="text-slate-500 font-medium">
                        Planifica tus inasistencias y genera fichas de guardia automáticas para tus alumnos.
                    </p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-bold shadow-xl shadow-indigo-100 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                    <Plus className="w-5 h-5" />
                    Nueva Ausencia
                </button>
            </div>

            {/* Stats / Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5">
                    <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
                        <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-slate-900">{absences?.length || 0}</div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Total Registros</div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5">
                    <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl">
                        <Clock className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-slate-900">
                            {absences?.filter(a => new Date(a.end_date) >= new Date()).length || 0}
                        </div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Próximas o Activas</div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-5">
                    <div className="p-4 bg-purple-50 text-purple-600 rounded-2xl">
                        <FileText className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-slate-900">
                            {absences?.reduce((acc: number, curr: any) => acc + (curr.activities?.length || 0), 0)}
                        </div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Actividades Generadas</div>
                    </div>
                </div>
            </div>

            {/* List */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-bold animate-pulse">Cargando ausencias...</p>
                </div>
            ) : absences?.length === 0 ? (
                <div className="bg-white rounded-[2.5rem] p-12 text-center border-2 border-dashed border-slate-200">
                    <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-3xl flex items-center justify-center mx-auto mb-6">
                        <AlertCircle className="w-10 h-10" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">No hay inasistencias registradas</h3>
                    <p className="text-slate-500 max-w-xs mx-auto mb-8">
                        Cuando registres una falta, aquí aparecerán tus fichas de trabajo para el suplente.
                    </p>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="text-indigo-600 font-black uppercase tracking-widest text-xs hover:underline"
                    >
                        Registrar mi primera ausencia
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {absences?.map((absence: any) => (
                        <div
                            key={absence.id}
                            className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-indigo-50/50 transition-all group overflow-hidden"
                        >
                            <div className="flex flex-col md:flex-row items-stretch">
                                {/* Date Side */}
                                <div className="bg-slate-50 p-8 flex flex-col items-center justify-center text-center min-w-[200px] border-r border-slate-100">
                                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Periodo</div>
                                    <div className="text-2xl font-black text-slate-900">
                                        {format(new Date(absence.start_date), 'dd MMM', { locale: es })}
                                    </div>
                                    {absence.start_date !== absence.end_date && (
                                        <>
                                            <ArrowRight className="w-4 h-4 my-1 text-indigo-400" />
                                            <div className="text-2xl font-black text-slate-900">
                                                {format(new Date(absence.end_date), 'dd MMM', { locale: es })}
                                            </div>
                                        </>
                                    )}
                                    <div className="text-[10px] font-bold text-slate-400 mt-2 uppercase">
                                        {new Date(absence.start_date).getFullYear()}
                                    </div>
                                </div>

                                {/* Content Side */}
                                <div className="p-8 flex-1 flex flex-col justify-between">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h3 className="text-xl font-black text-slate-900 mb-1">
                                                {absence.reason || 'Sin motivo especificado'}
                                            </h3>
                                            <div className="flex items-center gap-3">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${absence.status === 'FINAL' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                    {absence.status === 'FINAL' ? '✓ Finalizada' : '• Borrador'}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                    {absence.activities?.length || 0} CLASES AFECTADAS
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => setSelectedAbsence(absence)}
                                                className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all"
                                                title="Editar Actividades"
                                            >
                                                <Edit3 className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => window.print()}
                                                className="p-3 bg-slate-50 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all"
                                                title="Imprimir Fichas"
                                            >
                                                <Printer className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(absence.id)}
                                                className="p-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition-all"
                                                title="Eliminar"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Activities Preview */}
                                    <div className="flex flex-wrap gap-2 mt-auto">
                                        {absence.activities?.map((act: any, idx: number) => (
                                            <div key={idx} className="bg-indigo-50/50 border border-indigo-100 px-3 py-1.5 rounded-xl text-[10px] font-bold text-indigo-700">
                                                {act.group?.grade}° {act.group?.section} - {act.activity_title}
                                            </div>
                                        ))}
                                        {absence.activities?.length === 0 && (
                                            <p className="text-xs italic text-slate-400">Sin actividades generadas aún.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modales */}
            <AbsenceRequestModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); refetch(); }} />
            <AbsenceDetailView
                isOpen={!!selectedAbsence}
                absence={selectedAbsence}
                onClose={() => setSelectedAbsence(null)}
                onUpdate={() => { refetch(); setSelectedAbsence(null); }}
            />
        </div>
    )
}
