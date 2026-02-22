import { useEffect, useState } from 'react'
import {
    AlertTriangle,
    ShieldAlert,
    Calendar as CalendarIcon,
    Loader2,
    ChevronDown,
    Award
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { useProfile } from '../../../hooks/useProfile'

export const TutorIncidentsPage = () => {
    const { data: tenant } = useTenant()
    const { profile } = useProfile()
    const [loading, setLoading] = useState(true)
    const [children, setChildren] = useState<any[]>([])
    const [selectedChild, setSelectedChild] = useState<any>(null)
    const [incidents, setIncidents] = useState<any[]>([])

    useEffect(() => {
        const loadLayout = async () => {
            if (!tenant || !profile) return
            setLoading(true)

            try {
                // Get Children
                const { data: guardianship } = await supabase
                    .from('guardians')
                    .select('student_id, student:students(id, first_name, last_name_paternal, group_id, group:groups(grade, section))')
                    .eq('user_id', profile.id)

                const studs = guardianship?.map((g: any) => g.student) || []
                setChildren(studs)
                if (studs.length > 0) setSelectedChild(studs[0])
            } catch (error) {
                console.error('Error loading children:', error)
            } finally {
                setLoading(false)
            }
        }
        loadLayout()
    }, [tenant, profile])

    useEffect(() => {
        const loadIncidents = async () => {
            if (!selectedChild || !tenant) return
            setLoading(true)

            try {
                const { data } = await supabase
                    .from('student_incidents')
                    .select('*')
                    .eq('student_id', selectedChild.id)
                    .order('created_at', { ascending: false })

                setIncidents(data || [])
            } catch (error) {
                console.error('Error loading incidents:', error)
            } finally {
                setLoading(false)
            }
        }

        if (selectedChild) loadIncidents()
    }, [selectedChild, tenant])

    const getSeverityStyles = (severity: string) => {
        switch (severity) {
            case 'ALTA': return 'bg-red-50 text-red-700 border-red-100'
            case 'MEDIA': return 'bg-amber-50 text-amber-700 border-amber-100'
            default: return 'bg-blue-50 text-blue-700 border-blue-100'
        }
    }

    if (loading && !selectedChild) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-slate-300">
                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                <p className="text-xs font-black uppercase tracking-widest">Cargando incidencias...</p>
            </div>
        )
    }

    return (
        <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <AlertTriangle className="w-8 h-8 text-orange-500" />
                        Incidencias y Reportes
                    </h1>
                    <p className="text-slate-500 font-medium ml-11">Bitácora de seguimiento de conducta y desempeño.</p>
                </div>

                {children.length > 1 && (
                    <div className="relative">
                        <select
                            value={selectedChild?.id || ''}
                            onChange={(e) => {
                                const child = children.find(c => c.id === e.target.value)
                                setSelectedChild(child)
                            }}
                            className="bg-white border border-gray-200 text-gray-700 py-2 pl-4 pr-10 rounded-xl font-bold shadow-sm appearance-none outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {children.map(child => (
                                <option key={child.id} value={child.id}>
                                    {child.first_name} {child.last_name_paternal}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                )}
            </div>

            {selectedChild && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">{selectedChild.first_name} {selectedChild.last_name_paternal}</h2>
                        <p className="text-sm text-gray-500 font-medium">
                            {selectedChild.group
                                ? `Grupo ${selectedChild.group.grade}° ${selectedChild.group.section}`
                                : 'Sin grupo asignado'
                            }
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-6">
                {incidents.map((incident) => (
                    <div key={incident.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50 p-6 space-y-4">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <span className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg border ${getSeverityStyles(incident.severity)}`}>
                                    {incident.severity}
                                </span>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <CalendarIcon className="w-3 h-3" />
                                    {new Date(incident.created_at).toLocaleDateString()}
                                </span>
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{incident.type}</span>
                        </div>

                        <div>
                            <h3 className="text-lg font-black text-slate-800">{incident.title || 'Sin Título'}</h3>
                            <p className="text-sm text-slate-600 mt-2 leading-relaxed">{incident.description}</p>
                        </div>

                        {(incident.action_taken || incident.has_commitment) && (
                            <div className="pt-4 mt-4 border-t border-slate-50 space-y-3">
                                {incident.action_taken && (
                                    <div className="flex gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                                        <p className="text-xs text-slate-600"><span className="font-bold">Acción tomada:</span> {incident.action_taken}</p>
                                    </div>
                                )}
                                {incident.has_commitment && (
                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Compromiso</p>
                                        <p className="text-sm italic text-slate-700">{incident.commitment_description}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}

                {incidents.length === 0 && !loading && (
                    <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                        <Award className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                        <p className="text-slate-400 font-bold text-sm uppercase">No hay reportes ni incidencias registradas</p>
                        <p className="text-xs text-slate-300 mt-2 px-8">¡Felicidades! El alumno mantiene un historial limpio.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
