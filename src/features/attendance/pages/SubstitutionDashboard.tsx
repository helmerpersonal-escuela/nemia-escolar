import { useState, useEffect } from 'react'
import { Calendar, UserPlus, ClipboardList, CheckCircle2, AlertCircle, Trash2, ExternalLink } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'

export const SubstitutionDashboard = () => {
    const { data: tenant } = useTenant()
    const [absences, setAbsences] = useState<any[]>([])
    const [activities, setActivities] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (tenant?.id) {
            fetchSubstitutions()
        }
    }, [tenant?.id])

    const fetchSubstitutions = async () => {
        if (!tenant) return
        setLoading(true)

        // Fetch active/pending absences
        const { data: absenceData } = await supabase
            .from('teacher_absences')
            .select(`
                *,
                profile:profiles(full_name)
            `)
            .eq('tenant_id', tenant.id)
            .order('start_date', { ascending: false })

        // Fetch activities for these absences
        if (absenceData && absenceData.length > 0) {
            const absenceIds = absenceData.map(a => a.id)
            const { data: activityData } = await supabase
                .from('substitution_activities')
                .select(`
                    *,
                    group:groups(grade, section),
                    subject:subject_catalog(name)
                `)
                .in('absence_id', absenceIds)

            setActivities(activityData || [])
        }

        setAbsences(absenceData || [])
        setLoading(false)
    }

    const handleCompleteActivity = async (activityId: string) => {
        const { error } = await supabase
            .from('substitution_activities')
            .update({ is_completed: true, attended_by: (tenant as any).profile_id })
            .eq('id', activityId)

        if (!error) fetchSubstitutions()
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Cobertura de Suplencias</h1>
                <p className="text-slate-500 font-medium">Gestión de actividades escolares ante la ausencia de personal docente.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Active Absences */}
                <div className="lg:col-span-1 space-y-6">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-indigo-600" /> Ausencias Registradas
                    </h3>
                    <div className="space-y-4">
                        {loading ? (
                            <div className="p-4 bg-slate-50 rounded-2xl animate-pulse text-xs font-bold text-slate-400 text-center">Cargando ausencias...</div>
                        ) : absences.length > 0 ? (
                            absences.map(abs => (
                                <div key={abs.id} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
                                    <div className={`absolute top-0 left-0 bottom-0 w-1 ${abs.status === 'PENDING' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                                    <h4 className="font-bold text-slate-900">{abs.profile?.full_name}</h4>
                                    <div className="flex gap-2 mt-2">
                                        <span className="text-[10px] font-black text-slate-400 uppercase">{new Date(abs.start_date).toLocaleDateString()} al {new Date(abs.end_date).toLocaleDateString()}</span>
                                    </div>
                                    <p className="mt-2 text-xs text-slate-500 font-medium italic">"{abs.reason || 'Sin motivo especificado'}"</p>
                                </div>
                            ))
                        ) : (
                            <div className="p-8 border-2 border-dashed border-slate-100 rounded-2xl text-center">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sin ausencias reportadas</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Substitution Activities */}
                <div className="lg:col-span-2 space-y-6">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-indigo-600" /> Plan de Actividades por Grupo
                    </h3>
                    <div className="space-y-4">
                        {loading ? (
                            <div className="p-10 text-center text-slate-400">Cargando actividades...</div>
                        ) : activities.length > 0 ? (
                            activities.map(act => (
                                <div key={act.id} className={`p-6 bg-white rounded-[2rem] border shadow-md transition-all ${act.is_completed ? 'border-emerald-100 bg-emerald-50/10 opacity-70' : 'border-slate-100 hover:shadow-lg'}`}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-2">
                                                Grupo {act.group?.grade}° "{act.group?.section}" - {act.subject?.name || 'Varios'}
                                            </span>
                                            <h4 className="text-xl font-black text-slate-900">{act.activity_title}</h4>
                                        </div>
                                        {!act.is_completed ? (
                                            <button
                                                onClick={() => handleCompleteActivity(act.id)}
                                                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center gap-2"
                                            >
                                                <CheckCircle2 className="w-4 h-4" /> Marcar Atendido
                                            </button>
                                        ) : (
                                            <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs">
                                                <CheckCircle2 className="w-5 h-5" /> Atendido
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-slate-600 text-sm whitespace-pre-wrap">{act.activity_description}</p>

                                    {act.ai_generated_hints && (
                                        <div className="mt-4 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                            <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest flex items-center mb-1">
                                                <AlertCircle className="w-3 h-3 mr-1" /> Sugerencia de la IA para el Prefecto
                                            </p>
                                            <p className="text-xs text-amber-800 font-medium italic">{act.ai_generated_hints}</p>
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="p-20 border-2 border-dashed border-slate-100 rounded-[2rem] text-center bg-slate-50/50">
                                <ClipboardList className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                <h4 className="text-slate-900 font-bold">Sin tareas asignadas</h4>
                                <p className="text-slate-400 text-sm">Cuando un docente reporte una inasistencia, aquí aparecerán las actividades para los grupos sugeridas por IA.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
