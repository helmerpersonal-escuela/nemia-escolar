import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Award, CheckCircle, Download, AlertCircle } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { calculateAcademicYearGrade } from '../utils/gradingUtils'

interface CloseAcademicYearModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    group: {
        id: string
        grade: string
        section: string
        academic_year_id?: string
    }
    students: any[]
}

export const CloseAcademicYearModal = ({
    isOpen,
    onClose,
    onSuccess,
    group,
    students
}: CloseAcademicYearModalProps) => {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [step, setStep] = useState<'REVIEW' | 'SUCCESS'>('REVIEW')
    const [yearSummary, setYearSummary] = useState<any[]>([])
    const [fetchingData, setFetchingData] = useState(true)

    useEffect(() => {
        if (isOpen && group?.id) {
            fetchTrimesterData()
        }
    }, [isOpen, group?.id, students])

    const fetchTrimesterData = async () => {
        setFetchingData(true)
        try {
            // Fetch all trimester snapshots for this group
            const { data: snapshots, error } = await supabase
                .from('evaluation_snapshots')
                .select('*')
                .eq('group_id', group.id)
                .in('type', ['TRIMESTER', 'BIMESTER', 'SEMESTER', 'PERIOD'])

            if (error) throw error

            // Process data per student
            const summary = students.map(student => {
                const studentSnapshots = (snapshots || []).filter((s: any) => s.student_id === student.id)

                // Calculate Final Average
                const finalAverage = calculateAcademicYearGrade(studentSnapshots)

                // Calculate Total Attendance
                const totalAttendance = studentSnapshots.reduce((acc: number, curr: any) => acc + (curr.stats?.attendance || 0), 0)
                const totalAbsences = studentSnapshots.reduce((acc: number, curr: any) => acc + (curr.stats?.absences || 0), 0)

                return {
                    student,
                    snapshots: studentSnapshots,
                    finalAverage,
                    stats: {
                        attendance: totalAttendance,
                        absences: totalAbsences
                    }
                }
            })

            setYearSummary(summary)
        } catch (err) {
            console.error('Error fetching trimester data:', err)
        } finally {
            setFetchingData(false)
        }
    }

    const handleCloseYear = async () => {
        setLoading(true)
        try {
            // 1. Delete existing snapshots for this academic year/group (re-closing logic)
            // Note: If we had an explicit academic_year_id to filter by it would be better, 
            // but filtered by group_id and type='ACADEMIC_YEAR' is safe for now assuming one academic year per group.
            const { error: deleteError } = await supabase
                .from('evaluation_snapshots')
                .delete()
                .match({
                    group_id: group.id,
                    type: 'ACADEMIC_YEAR'
                })

            if (deleteError) throw deleteError

            // 2. Create Academic Year Snapshots
            const yearSnapshots = yearSummary.map(item => ({
                tenant_id: item.student.tenant_id,
                student_id: item.student.id,
                group_id: group.id,
                academic_year_id: group.academic_year_id || null, // Best effort linkage
                type: 'ACADEMIC_YEAR',
                final_score: item.finalAverage,
                stats: item.stats,
                breakdown: { trimester_snapshots: item.snapshots.map((s: any) => s.id) }, // Link to source snapshots
                status: 'FINAL'
            }))

            if (yearSnapshots.length > 0) {
                const { error } = await supabase
                    .from('evaluation_snapshots')
                    .insert(yearSnapshots)

                if (error) throw error
            }

            setStep('SUCCESS')
        } catch (error) {
            console.error('Error closing academic year:', error)
            alert('Error al cerrar el ciclo escolar.')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-gray-100">

                {/* Header */}
                <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 flex items-center">
                            <Award className="w-8 h-8 mr-3 text-amber-500" />
                            Cierre de Ciclo Escolar
                        </h2>
                        <p className="text-gray-500 mt-1 font-medium">
                            Grupo {group.grade}° "{group.section}" — Promedios Finales (Ciclo Escolar)
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 bg-white">
                    {fetchingData ? (
                        <div className="flex justify-center py-20">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                    ) : step === 'REVIEW' ? (
                        <div className="space-y-8">
                            <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 flex items-start">
                                <AlertCircle className="w-6 h-6 text-amber-600 mr-4 mt-1 flex-shrink-0" />
                                <div>
                                    <h3 className="font-bold text-amber-900 text-lg">Confirmación de Promedios Anuales</h3>
                                    <p className="text-amber-800 mt-2 leading-relaxed">
                                        El sistema ha calculado el promedio final de cada alumno basándose en los periodos cerrados (Trimestres, Bimestres, etc.).
                                        Al confirmar, se generará el acta final del ciclo escolar. Asegúrate de que todos los periodos estén correctamente cerrados.
                                    </p>
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-xs tracking-wider">
                                        <tr>
                                            <th className="px-6 py-4">Alumno</th>
                                            <th className="px-6 py-4 text-center">Periodos Evaluados</th>
                                            <th className="px-6 py-4 text-center">Asistencia Total</th>
                                            <th className="px-6 py-4 text-right">Promedio Final</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                        {yearSummary.map((item) => (
                                            <tr key={item.student.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-gray-900 text-sm">
                                                        {item.student.last_name_paternal} {item.student.last_name_maternal} {item.student.first_name}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.snapshots.length >= 3 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                                        }`}>
                                                        {item.snapshots.length} / 3
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center text-gray-600 text-sm font-medium">
                                                    {item.stats.attendance}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className={`text-lg font-black ${item.finalAverage >= 6 ? 'text-blue-600' : 'text-red-600'
                                                        }`}>
                                                        {item.finalAverage}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center py-16 space-y-8 animate-in fade-in zoom-in duration-300">
                            <div className="w-24 h-24 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-full flex items-center justify-center shadow-lg border-4 border-white">
                                <Award className="w-12 h-12 text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="text-3xl font-black text-gray-900 tracking-tight">¡Ciclo Escolar Cerrado!</h3>
                                <p className="text-gray-500 mt-3 text-lg max-w-lg mx-auto">
                                    Se han generado las actas finales. El ciclo ha concluido exitosamente para este grupo.
                                </p>
                            </div>
                            <button
                                onClick={() => navigate(`/reports/evaluation?groupId=${group.id}&type=ACADEMIC_YEAR`)}
                                className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold flex items-center hover:bg-gray-800 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1"
                            >
                                <Download className="w-5 h-5 mr-3" />
                                Descargar Boleta Final
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-gray-100 bg-gray-50/50 flex justify-end space-x-4">
                    {step === 'REVIEW' && (
                        <>
                            <button
                                onClick={onClose}
                                className="px-6 py-3 text-gray-600 font-bold hover:bg-gray-200 rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCloseYear}
                                disabled={loading || fetchingData}
                                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl flex items-center"
                            >
                                {loading ? 'Procesando...' : 'Finalizar Ciclo Escolar'}
                            </button>
                        </>
                    )}
                    {step === 'SUCCESS' && (
                        <button
                            onClick={onSuccess}
                            className="px-8 py-3 bg-white border-2 border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                        >
                            Volver al Inicio
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
