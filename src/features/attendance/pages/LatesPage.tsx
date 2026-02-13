import { useState, useEffect } from 'react'
import {
    Clock,
    Search,
    Calendar as CalendarIcon,
    User,
    ChevronRight,
    CheckCircle2,
    AlertCircle,
    Download,
    Filter,
    Loader2
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'

interface LateRecord {
    id: string
    student_id: string
    date: string
    notes?: string
    student: {
        first_name: string
        last_name_paternal: string
        last_name_maternal: string
        group: {
            grade: string
            section: string
        }
    }
}

export const LatesPage = () => {
    const { data: tenant } = useTenant()
    const [lates, setLates] = useState<LateRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])

    useEffect(() => {
        if (tenant?.id) {
            fetchLates()
        }
    }, [tenant?.id, filterDate])

    const fetchLates = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('attendance')
            .select(`
                *,
                student:students (
                    first_name,
                    last_name_paternal,
                    last_name_maternal,
                    group:groups (grade, section)
                )
            `)
            .eq('tenant_id', tenant?.id)
            .eq('status', 'LATE')
            .eq('date', filterDate)
            .order('created_at', { ascending: false })

        if (data) setLates(data as any[])
        setLoading(false)
    }

    const filteredLates = lates.filter(l =>
        `${l.student.first_name} ${l.student.last_name_paternal}`.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Control de Retardos</h1>
                    <p className="text-slate-400 font-bold text-sm uppercase tracking-widest mt-1">Monitoreo de Puntualidad Estudiantil</p>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    <input
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="flex-1 sm:flex-none px-4 py-2 bg-white border-2 border-slate-100 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                    />
                    <button className="px-6 py-2 bg-slate-900 text-white font-black rounded-xl shadow-lg hover:bg-black transition-all flex items-center gap-2 uppercase text-[10px] tracking-widest">
                        <Download className="w-4 h-4" /> Exportar
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Hoy</p>
                    <p className="text-3xl font-black text-slate-800">{lates.length}</p>
                </div>
                {/* Visual indicator of "critical" groups or similar could go here */}
            </div>

            {/* Main Content */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex flex-col sm:flex-row gap-4 justify-between items-center">
                    <div className="relative w-full sm:w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <input
                            type="text"
                            placeholder="Buscar por alumno..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button className="p-3 rounded-xl bg-slate-50 text-slate-400 hover:text-slate-600 transition-all">
                            <Filter className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50/50">
                            <tr>
                                <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Alumno</th>
                                <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Grupo</th>
                                <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                                <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Notas</th>
                                <th className="px-8 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredLates.map(late => (
                                <tr key={late.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400">
                                                {late.student.first_name[0]}
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-700 text-sm">{late.student.first_name} {late.student.last_name_paternal}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">{late.student.group.grade}° "{late.student.group.section}"</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                            {late.student.group.grade}° {late.student.group.section}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-2 text-slate-600">
                                            <CalendarIcon className="w-3 h-3" />
                                            <span className="text-xs font-bold">{new Date(late.date).toLocaleDateString()}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <p className="text-xs font-medium text-slate-500 italic">{late.notes || 'Sin observaciones'}</p>
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
                            <p className="text-xs font-black uppercase tracking-widest">Consultando retardos...</p>
                        </div>
                    )}
                    {!loading && filteredLates.length === 0 && (
                        <div className="p-20 text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="w-8 h-8 text-slate-200" />
                            </div>
                            <p className="text-slate-400 font-bold text-sm uppercase">Sin retardos registrados para esta fecha</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-[2rem] p-8 flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-1" />
                <div>
                    <h4 className="text-amber-900 font-black uppercase text-sm tracking-tight">Política de Puntualidad</h4>
                    <p className="text-amber-700/80 text-xs font-medium mt-2 leading-relaxed">
                        Recuerda que los retardos acumulados pueden generar un citatorio automático según el reglamento institucional.
                        Este panel muestra únicamente los registros marcados como "RETARDO" en la asistencia diaria.
                    </p>
                </div>
            </div>
        </div>
    )
}
