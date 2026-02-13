import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { useProfile } from '../../../hooks/useProfile'
import {
    Plus,
    BookOpen,
    ChevronRight,
    Info,
    Trash2,
    Eye,
    Shield
} from 'lucide-react'

export const AnalyticalProgramListPage = () => {
    console.log('AnalyticalProgramListPage: MOUNTING...')
    const navigate = useNavigate()
    const { data: tenant } = useTenant()
    const { profile } = useProfile()
    const isIndependent = tenant?.type === 'INDEPENDENT'
    const isDirectorOrAdmin = ['DIRECTOR', 'ADMIN', 'INDEPENDENT_TEACHER'].includes(profile?.role || '') || isIndependent
    const [programs, setPrograms] = useState<any[]>([])
    const [cycles, setCycles] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!tenant) return
        fetchData()
    }, [tenant])

    const fetchData = async () => {
        setLoading(true)
        try {
            // Fetch Programs
            const { data: programsData, error: progError } = await supabase
                .from('analytical_programs')
                .select('*')
                .eq('tenant_id', tenant?.id)
                .order('updated_at', { ascending: false })

            if (progError) {
                console.error('Error fetching programs:', progError)
            } else {
                setPrograms(programsData || [])
            }

            // Fetch Cycles for manual mapping (more robust than join)
            const { data: cyclesData, error: cycleError } = await supabase
                .from('academic_years')
                .select('id, name')
                .eq('tenant_id', tenant?.id)

            if (cycleError) {
                console.error('Error fetching cycles:', cycleError)
            } else {
                setCycles(cyclesData || [])
            }
        } catch (err) {
            console.error('CRITICAL ERROR in AnalyticalProgramListPage:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (e: React.MouseEvent, programId: string) => {
        e.stopPropagation()
        if (profile?.is_demo) {
            alert('Modo Demo: La eliminación de programas está deshabilitada.')
            return
        }
        if (!window.confirm('¿Estás seguro de que deseas eliminar este Programa Analítico? Esta acción no se puede deshacer.')) return

        try {
            const { error } = await supabase
                .from('analytical_programs')
                .delete()
                .eq('id', programId)

            if (error) throw error

            setPrograms(programs.filter(p => p.id !== programId))
            alert('Programa eliminado correctamente.')
        } catch (error: any) {
            console.error('Delete error:', error)
            alert('Error al eliminar el programa: ' + error.message)
        }
    }

    if (loading) return <div className="p-20 text-center animate-pulse text-gray-400 font-bold uppercase tracking-widest italic font-sans">Buscando Programas Analíticos...</div>

    return (
        <div className="max-w-6xl mx-auto px-4">
            <div className="flex justify-between items-center mb-12">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tighter">Programas Analíticos (NEM)</h1>
                    <p className="text-sm text-gray-400 font-bold uppercase tracking-widest mt-2 flex items-center">
                        <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2 animate-pulse" />
                        Sesión Permanente de CTE
                    </p>
                </div>
                <div className="flex space-x-4">
                    {isDirectorOrAdmin && (
                        <button
                            onClick={() => {
                                if (profile?.is_demo) {
                                    alert('Modo Demo: La creación de nuevos programas está deshabilitada.')
                                    return
                                }
                                navigate('/analytical-program/new')
                            }}
                            className={`px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all flex items-center scale-100 hover:scale-105 active:scale-95 ${profile?.is_demo ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                }`}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Nuevo Programa
                        </button>
                    )}
                </div>
            </div>

            {programs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {programs.map((prog) => (
                        <div
                            key={prog.id}
                            onClick={() => navigate(`/analytical-program/${prog.id}`)}
                            className="bg-white rounded-[2.5rem] p-8 border border-gray-50 shadow-sm hover:shadow-2xl hover:scale-[1.02] transition-all cursor-pointer group flex flex-col"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                    <BookOpen className="w-6 h-6" />
                                </div>
                                <div className="flex items-center space-x-2">
                                    <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 px-3 py-1 rounded-lg">
                                        {prog.status || 'ACTIVO'}
                                    </span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            navigate(`/analytical-program/${prog.id}?print=true`)
                                        }}
                                        className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                        title="Vista Previa"
                                    >
                                        <Eye className="w-3 h-3" />
                                    </button>
                                    {isDirectorOrAdmin && (
                                        <button
                                            onClick={(e) => handleDelete(e, prog.id)}
                                            className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                                            title="Eliminar Programa"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="mb-8">
                                <h2 className="text-lg font-black text-gray-900 leading-tight mb-2 uppercase break-words">
                                    {prog.school_data?.name || "PROGRAMA ESCOLAR"}
                                </h2>
                                <div className="flex flex-wrap gap-2">
                                    <span className="text-[9px] font-black uppercase text-gray-400 px-2 py-1 bg-gray-50 rounded-md border border-gray-100">
                                        {prog.school_data?.level || "NIVEL NO DEF."}
                                    </span>
                                    <span className="text-[9px] font-black uppercase text-indigo-500 px-2 py-1 bg-indigo-50/50 rounded-md border border-indigo-100">
                                        CICLO {cycles.find(c => c.id === prog.academic_year_id)?.name || "2023-2024"}
                                    </span>
                                </div>
                            </div>

                            <p className="text-xs font-bold text-gray-400 leading-relaxed mb-10 line-clamp-3 italic">
                                {prog.group_diagnosis?.narrative || "Sin narrativa diagnóstica capturada aún..."}
                            </p>

                            <div className="mt-auto pt-6 border-t border-gray-50 flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black uppercase tracking-widest text-gray-300">Último ajuste</span>
                                    <span className="text-[10px] font-black text-gray-500">
                                        {new Date(prog.updated_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </span>
                                </div>
                                <div className="p-2 bg-gray-50 rounded-xl text-gray-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                    <ChevronRight className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white p-20 rounded-[3rem] border-2 border-dashed border-gray-100 text-center max-w-2xl mx-auto">
                    <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 mx-auto mb-8">
                        <Plus className="w-10 h-10" />
                    </div>
                    <h3 className="text-2xl font-black text-gray-900 mb-4 tracking-tight">No hay programas registrados</h3>
                    <p className="text-gray-400 font-bold text-sm leading-relaxed mb-10">
                        Inicia la construcción del Programa Analítico de tu escuela para este ciclo escolar siguiendo los lineamientos de la NEM.
                    </p>
                    {isDirectorOrAdmin ? (
                        <button
                            onClick={() => navigate('/analytical-program/new')}
                            className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all font-sans"
                        >
                            Comenzar Ahora
                        </button>
                    ) : (
                        <p className="text-amber-600 font-black text-xs uppercase tracking-widest bg-amber-50 px-6 py-3 rounded-xl border border-amber-100 inline-block">
                            Consulta con la dirección para la creación del programa
                        </p>
                    )}
                </div>
            )}

            <div className="mt-20 bg-amber-50 rounded-[2.5rem] p-10 border border-amber-100 flex items-start max-w-4xl mx-auto">
                <div className="p-3 bg-amber-100 rounded-2xl text-amber-600 mr-6">
                    <Info className="w-6 h-6" />
                </div>
                <div>
                    <h4 className="font-black text-amber-900 uppercase text-xs tracking-widest mb-2">Nota del Colectivo</h4>
                    <p className="text-sm font-bold text-amber-800/80 leading-relaxed">
                        El Programa Analítico es un documento de trabajo vivo que se construye y ajusta permanentemente en las sesiones de CTE. Es la base para la planeación didáctica de todos los docentes de la institución.
                    </p>
                </div>
            </div>
        </div>
    )
}
