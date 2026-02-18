import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, AlertTriangle, Lock, Download, CheckCircle } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { calculateStudentPeriodGrade } from '../utils/gradingUtils'

interface ClosePeriodModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    period: {
        id: string
        name: string
        start_date: string
        end_date: string
    }
    group: {
        id: string
        grade: string
        section: string
        academic_year_id?: string
    }
    students: any[]
    assignments: any[]
    grades: any[]
    criteria: any[]
    attendance: any[]
    subjectId?: string
}

export const ClosePeriodModal = ({
    isOpen,
    onClose,
    onSuccess,
    period,
    group,
    students,
    assignments,
    grades,
    criteria,
    attendance,
    subjectId
}: ClosePeriodModalProps) => {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [step, setStep] = useState<'REVIEW' | 'CONFIRM' | 'SUCCESS'>('REVIEW')
    const [summary, setSummary] = useState<any[]>([])
    const [overriddenGrades, setOverriddenGrades] = useState<Record<string, number>>({})

    const getPeriodType = (name: string) => {
        const lowerName = name.toLowerCase()
        if (lowerName.includes('trimestre')) return 'TRIMESTER'
        if (lowerName.includes('bimestre')) return 'BIMESTER'
        if (lowerName.includes('semestre')) return 'SEMESTER'
        return 'PERIOD'
    }

    const periodType = getPeriodType(period.name)
    const periodLabel = periodType === 'TRIMESTER' ? 'Trimestre' :
        periodType === 'BIMESTER' ? 'Bimestre' :
            periodType === 'SEMESTER' ? 'Semestre' : 'Periodo'


    useEffect(() => {
        if (isOpen) {
            calculateSummary()
        }
    }, [isOpen, students, assignments, grades, criteria, attendance])

    const calculateSummary = () => {
        const results = students.map(student => {
            const result = calculateStudentPeriodGrade(
                student.id,
                assignments,
                grades,
                criteria,
                attendance,
                period.id,
                { start: period.start_date, end: period.end_date }
            )
            return {
                student,
                ...result
            }
        })
        setSummary(results)
    }

    const handleClosePeriod = async () => {
        setLoading(true)
        try {
            // 1. Delete existing snapshots for this period/group (re-closing logic)
            const { error: deleteError } = await supabase
                .from('evaluation_snapshots')
                .delete()
                .match({
                    group_id: group.id,
                    period_id: period.id,
                    type: periodType
                })

            if (deleteError) throw deleteError

            // 2. Create Snapshots for each student
            const snapshots = summary.map(item => {
                const finalGrade = overriddenGrades[item.student.id] ?? (item.finalScore < 5 ? 5 : item.finalScore)

                return {
                    tenant_id: students[0]?.tenant_id,
                    student_id: item.student.id,
                    group_id: group.id,
                    period_id: period.id,
                    subject_id: subjectId || null,
                    type: periodType,
                    final_score: finalGrade,
                    stats: item.stats,
                    breakdown: {
                        ...item.breakdown,
                        original_score: item.finalScore,
                        is_adjusted: finalGrade !== item.finalScore
                    },
                    status: 'FINAL'
                }
            })

            if (snapshots.length > 0) {
                const { error: snapshotError } = await supabase
                    .from('evaluation_snapshots')
                    .insert(snapshots)

                if (snapshotError) throw snapshotError
            }

            // 2. Mark Period as Closed
            const { error: periodError } = await supabase
                .from('evaluation_periods')
                .update({ is_closed: true })
                .eq('id', period.id)

            if (periodError) throw periodError

            setStep('SUCCESS')
        } catch (error) {
            console.error('Error closing period:', error)
            alert('Error al cerrar el periodo. Ver consola para detalles.')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">

                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 flex items-center">
                            <Lock className="w-5 h-5 mr-2 text-amber-600" />
                            Cierre de {periodLabel}: {period.name}
                        </h2>
                        <p className="text-sm text-gray-500">
                            Grupo {group.grade}° "{group.section}" — Revisión de Calificaciones
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {step === 'REVIEW' && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start">
                                <AlertTriangle className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
                                <div>
                                    <h3 className="font-bold text-blue-900">Revisión Preliminar: Criterios SEP México</h3>
                                    <p className="text-sm text-blue-700 mt-1">
                                        Calificación mínima en boleta: **5.0**. Si el promedio es menor, se ajustará automáticamente a 5.0.
                                        Puedes realizar ajustes manuales antes de cerrar el periodo.
                                    </p>
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-xl border border-gray-200">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-wider">
                                        <tr>
                                            <th className="px-4 py-3">Alumno</th>
                                            <th className="px-4 py-3 text-center">Asistencias</th>
                                            <th className="px-4 py-3 text-center w-24">Cálculo</th>
                                            <th className="px-4 py-3 text-right w-32">Final (SEP)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {summary.map((item) => {
                                            const originalGrade = item.finalScore
                                            const currentFinal = overriddenGrades[item.student.id] ?? (originalGrade < 5 ? 5 : originalGrade)
                                            const isAdjusted = originalGrade < 5 && currentFinal === 5

                                            return (
                                                <tr key={item.student.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-4 py-3 font-medium text-gray-900">
                                                        {item.student.last_name_paternal} {item.student.last_name_maternal} {item.student.first_name}
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-gray-600">
                                                        {(item.stats.attendance / (item.stats.attendance + item.stats.absences + item.stats.lates || 1) * 100).toFixed(0)}%
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-mono text-gray-400">
                                                        {originalGrade}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center justify-end space-x-2">
                                                            <input
                                                                type="number"
                                                                step="0.1"
                                                                min="5"
                                                                max="10"
                                                                className={`w-20 px-2 py-1 text-right font-black rounded-lg border focus:ring-2 transition-all ${isAdjusted
                                                                    ? 'text-rose-600 bg-rose-50 border-rose-200'
                                                                    : 'text-blue-600 bg-white border-gray-200'
                                                                    }`}
                                                                value={currentFinal}
                                                                onChange={(e) => {
                                                                    const val = parseFloat(e.target.value)
                                                                    if (!isNaN(val)) {
                                                                        setOverriddenGrades(prev => ({
                                                                            ...prev,
                                                                            [item.student.id]: val
                                                                        }))
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {step === 'SUCCESS' && (
                        <div className="flex flex-col items-center justify-center text-center py-12 space-y-6">
                            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center animate-bounce">
                                <CheckCircle className="w-10 h-10 text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-gray-900">¡Periodo Cerrado Exitosamente!</h3>
                                <p className="text-gray-500 mt-2 max-w-md mx-auto">
                                    Las calificaciones han sido guardadas en el histórico. Puedes generar la sábana de calificaciones ahora.
                                </p>
                            </div>
                            <button
                                onClick={() => navigate(`/reports/evaluation?groupId=${group.id}&periodId=${period.id}&type=${periodType}`)}
                                className="px-6 py-3 bg-gray-900 text-white rounded-xl font-bold flex items-center hover:bg-gray-800 transition-all shadow-lg"
                            >
                                <Download className="w-5 h-5 mr-2" />
                                Descargar Reporte Final
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end space-x-3">
                    {step === 'REVIEW' && (
                        <>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleClosePeriod}
                                disabled={loading}
                                className="px-6 py-2 bg-gray-900 text-white font-bold rounded-lg hover:bg-gray-800 transition-colors shadow-lg flex items-center"
                            >
                                {loading ? 'Cerrando...' : 'Confirmar Cierre'}
                            </button>
                        </>
                    )}
                    {step === 'SUCCESS' && (
                        <button
                            onClick={onSuccess}
                            className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
                        >
                            Volver a la Libreta
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
