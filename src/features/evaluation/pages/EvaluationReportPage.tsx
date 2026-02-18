import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { ArrowLeft, Printer, Download } from 'lucide-react'

export const EvaluationReportPage = () => {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const { data: tenant } = useTenant()

    const groupId = searchParams.get('groupId')
    const periodId = searchParams.get('periodId')
    // type can be 'TRIMESTER', 'BIMESTER', 'SEMESTER', 'PERIOD', or 'ACADEMIC_YEAR'
    const type = searchParams.get('type') || 'TRIMESTER'

    const [loading, setLoading] = useState(true)
    const [group, setGroup] = useState<any>(null)
    const [period, setPeriod] = useState<any>(null)
    const [snapshots, setSnapshots] = useState<any[]>([])
    const [students, setStudents] = useState<any[]>([])

    useEffect(() => {
        loadData()
    }, [groupId, periodId, type, tenant?.id])

    const loadData = async () => {
        if (!groupId || !tenant?.id) return

        try {
            setLoading(true)

            // 1. Fetch Group
            const { data: groupData } = await supabase
                .from('groups')
                .select('*, academic_years(name)')
                .eq('id', groupId)
                .single()

            setGroup(groupData)

            // 2. Fetch Period (if applicable)
            if (periodId && type === 'TRIMESTER') {
                const { data: periodData } = await supabase
                    .from('evaluation_periods')
                    .select('*')
                    .eq('id', periodId)
                    .single()
                setPeriod(periodData)
            }

            // 3. Fetch Snapshots
            let query = supabase
                .from('evaluation_snapshots')
                .select('*, students!inner(*)') // Join with students to get names
                .eq('group_id', groupId)
                .eq('type', type)

            if (periodId) {
                query = query.eq('period_id', periodId)
            }

            const { data: snapshotsData, error } = await query

            if (error) throw error

            // Sort by student name
            const sorted = (snapshotsData || []).sort((a: any, b: any) => {
                const nameA = `${a.students.last_name_paternal} ${a.students.last_name_maternal} ${a.students.first_name}`
                const nameB = `${b.students.last_name_paternal} ${b.students.last_name_maternal} ${b.students.first_name}`
                return nameA.localeCompare(nameB)
            })

            setSnapshots(sorted)

        } catch (error) {
            console.error('Error loading report data:', error)
        } finally {
            setLoading(false)
        }
    }

    const handlePrint = () => {
        window.print()
    }

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
            </div>
        )
    }

    if (!group) return <div>No se encontraron datos.</div>

    return (
        <div className="min-h-screen bg-white text-slate-900 p-8 print:p-0">
            {/* Action Bar (Hidden when printing) */}
            <div className="fixed top-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-b border-gray-200 flex justify-between items-center print:hidden shadow-sm z-10">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center text-gray-600 hover:text-gray-900 font-medium"
                >
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Volver
                </button>
                <div className="flex space-x-3">
                    <button
                        onClick={handlePrint}
                        className="flex items-center px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-bold"
                    >
                        <Printer className="w-5 h-5 mr-2" />
                        Imprimir / Guardar PDF
                    </button>
                </div>
            </div>

            {/* Report Content */}
            <div className="max-w-5xl mx-auto mt-16 print:mt-0 bg-white print:w-full">

                {/* Header Section */}
                <div className="border-b-4 border-slate-900 pb-8 mb-10 flex items-start justify-between relative overflow-hidden">
                    <div className="absolute -top-10 -left-10 w-40 h-40 bg-slate-50 rounded-full blur-3xl opacity-50 -z-10"></div>
                    <div>
                        <div className="inline-flex items-center gap-2 mb-4 bg-slate-900 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">
                            Reporte Oficial Vunlek
                        </div>
                        <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900 leading-none mb-2">
                            {type === 'ACADEMIC_YEAR' ? 'Boleta de Evaluación Anual' :
                                type === 'BIMESTER' ? 'Reporte de Evaluación Bimestral' :
                                    type === 'SEMESTER' ? 'Reporte de Evaluación Semestral' :
                                        type === 'TRIMESTER' ? 'Reporte de Evaluación Trimestral' : 'Reporte de Evaluación'}
                        </h1>
                        <h2 className="text-2xl font-bold text-slate-500 flex items-center gap-2">
                            <span className="w-2 h-2 bg-slate-400 rounded-full"></span>
                            {tenant?.name || 'Vunlek Gestión Educativa'}
                        </h2>
                    </div>
                    <div className="text-right">
                        <div className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">Ciclo Escolar</div>
                        <div className="text-2xl font-black text-slate-900">{group.academic_years?.name || 'N/A'}</div>
                        <div className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1 mt-6">Fecha de Emisión</div>
                        <div className="text-lg font-bold text-slate-700">{new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    </div>
                </div>

                {/* Group Details */}
                <div className="grid grid-cols-2 gap-8 mb-10 bg-slate-50 p-8 rounded-3xl border border-slate-100 print:bg-transparent print:p-4 print:border-slate-200">
                    <div>
                        <div className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-1">Grupo y Grado</div>
                        <div className="text-xl font-bold">{group.grade}° "{group.section}"</div>
                    </div>
                    {type === 'TRIMESTER' && period && (
                        <div>
                            <div className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-1">Periodo Evaluado</div>
                            <div className="text-xl font-bold">{period.name}</div>
                        </div>
                    )}
                </div>

                {/* Table */}
                <div className="overflow-hidden rounded-lg border border-slate-200 print:border-slate-900">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100 text-slate-900 font-black uppercase text-xs print:bg-slate-200">
                            <tr>
                                <th className="px-4 py-3 border-b border-slate-200 print:border-slate-900 w-12 text-center">#</th>
                                <th className="px-4 py-3 border-b border-slate-200 print:border-slate-900">Alumno</th>
                                <th className="px-4 py-3 border-b border-slate-200 print:border-slate-900 text-center w-32">Asistencia</th>
                                {type === 'TRIMESTER' && (
                                    <>
                                        <th className="px-4 py-3 border-b border-slate-200 print:border-slate-900 text-center w-32">Faltas</th>
                                    </>
                                )}
                                <th className="px-4 py-3 border-b border-slate-200 print:border-slate-900 text-right w-32 bg-slate-200 print:bg-slate-300">Promedio Final</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 print:divide-slate-900">
                            {snapshots.map((snap, index) => (
                                <tr key={snap.id} className="break-inside-avoid">
                                    <td className="px-4 py-3 text-center text-slate-500 font-bold">{index + 1}</td>
                                    <td className="px-4 py-3 font-medium text-slate-900 uppercase">
                                        {snap.students.last_name_paternal} {snap.students.last_name_maternal} {snap.students.first_name}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {snap.stats?.attendance || 0}
                                    </td>
                                    {type === 'TRIMESTER' && (
                                        <>
                                            <td className="px-4 py-3 text-center text-slate-500">
                                                {snap.stats?.absences || 0}
                                            </td>
                                        </>
                                    )}
                                    <td className="px-4 py-3 text-right font-black text-slate-900 text-base bg-slate-50 print:bg-transparent">
                                        {snap.final_score}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Signatures */}
                <div className="mt-20 grid grid-cols-2 gap-20 print:flex print:justify-between">
                    <div className="text-center">
                        <div className="border-t border-slate-900 w-48 mx-auto mb-2"></div>
                        <div className="font-bold text-sm uppercase">Firma del Docente</div>
                    </div>
                    <div className="text-center">
                        <div className="border-t border-slate-900 w-48 mx-auto mb-2"></div>
                        <div className="font-bold text-sm uppercase">Sello de la Institución</div>
                    </div>
                </div>
            </div>
        </div>
    )
}
