import { useState, useEffect } from 'react'
import {
    AlertTriangle,
    Search,
    Filter,
    Download,
    ChevronRight,
    Calendar as CalendarIcon,
    Loader2,
    ShieldAlert
} from 'lucide-react'
import { supabase } from '../../../../lib/supabase'
import { useTenant } from '../../../../hooks/useTenant'

interface IncidentRecord {
    id: string
    type: string
    severity: string
    description: string
    created_at: string
    student: {
        first_name: string
        last_name_paternal: string
        group: {
            grade: string
            section: string
        }
    }
}

export const IncidentsLogPage = () => {
    const { data: tenant } = useTenant()
    const [incidents, setIncidents] = useState<IncidentRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [filterType, setFilterType] = useState('ALL')

    useEffect(() => {
        if (tenant?.id) {
            fetchIncidents()
        }
    }, [tenant?.id, filterType])

    const fetchIncidents = async () => {
        setLoading(true)
        let query = supabase
            .from('student_incidents')
            .select(`
                *,
                student:students (
                    first_name,
                    last_name_paternal,
                    group:groups (grade, section)
                )
            `)
            .eq('tenant_id', tenant?.id)
            .order('created_at', { ascending: false })

        if (filterType !== 'ALL') {
            query = query.eq('type', filterType)
        }

        const { data } = await query
        if (data) setIncidents(data as any[])
        setLoading(false)
    }

    const filteredIncidents = incidents.filter(i =>
        `${i.student.first_name} ${i.student.last_name_paternal} ${i.description}`.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const getSeverityStyles = (severity: string) => {
        switch (severity) {
            case 'ALTA': return 'bg-red-50 text-red-700 border-red-100'
            case 'MEDIA': return 'bg-amber-50 text-amber-700 border-amber-100'
            default: return 'bg-blue-50 text-blue-700 border-blue-100'
        }
    }

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Bitácora de Incidencias</h1>
                    <p className="text-slate-400 font-bold text-sm uppercase tracking-widest mt-1">Historial General de Disciplina y Seguimiento</p>
                </div>
                <button className="w-full sm:w-auto px-6 py-2 bg-slate-900 text-white font-black rounded-xl shadow-lg hover:bg-black transition-all flex items-center justify-center gap-2 uppercase text-[10px] tracking-widest">
                    <Download className="w-4 h-4" /> Exportar Reporte
                </button>
            </div>

            {/* Main Content */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex flex-col sm:flex-row gap-4 justify-between items-center">
                    <div className="relative w-full sm:w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <input
                            type="text"
                            placeholder="Buscar por alumno o descripción..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                        />
                    </div>
                    <div className="flex gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
                        {['ALL', 'CONDUCTA', 'ACADEMICO', 'SALUD', 'POSITIVO'].map(type => (
                            <button
                                key={type}
                                onClick={() => setFilterType(type)}
                                className={`px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all
                                    ${filterType === type ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                            >
                                {type === 'ALL' ? 'Todos' : type}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50/50">
                            <tr>
                                <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Alumno / Grupo</th>
                                <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                                <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo / Prioridad</th>
                                <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Descripción</th>
                                <th className="px-8 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredIncidents.map(incident => (
                                <tr key={incident.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-8 py-5">
                                        <div>
                                            <p className="font-black text-slate-700 text-sm">{incident.student.first_name} {incident.student.last_name_paternal}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">{incident.student.group.grade}° "{incident.student.group.section}"</p>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-2 text-slate-600">
                                            <CalendarIcon className="w-3 h-3" />
                                            <span className="text-xs font-bold">{new Date(incident.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[9px] font-black text-slate-400 uppercase">{incident.type}</span>
                                            <span className={`w-fit px-2 py-0.5 rounded-md border text-[8px] font-black uppercase ${getSeverityStyles(incident.severity)}`}>
                                                {incident.severity}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <p className="text-xs font-medium text-slate-600 line-clamp-2 max-w-sm">{incident.description}</p>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <button className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all">
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {loading && (
                        <div className="p-20 flex flex-col items-center justify-center text-slate-300">
                            <Loader2 className="w-8 h-8 animate-spin mb-4" />
                            <p className="text-xs font-black uppercase tracking-widest">Cargando bitácora...</p>
                        </div>
                    )}
                    {!loading && filteredIncidents.length === 0 && (
                        <div className="p-20 text-center">
                            <ShieldAlert className="w-16 h-16 text-slate-100 mx-auto mb-4" />
                            <p className="text-slate-400 font-bold text-sm uppercase">No hay incidencias registradas</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
