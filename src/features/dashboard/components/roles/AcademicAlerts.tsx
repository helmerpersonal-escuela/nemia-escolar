import { useEffect, useState } from 'react'
import { AlertTriangle, Clock, XCircle, FileWarning } from 'lucide-react'
import { supabase } from '../../../../lib/supabase'

export const AcademicAlerts = ({ studentId }: { studentId: string }) => {
    const [alerts, setAlerts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (studentId) loadAlerts()
    }, [studentId])

    const loadAlerts = async () => {
        setLoading(true)
        try {
            // 1. Recent Attendance Issues (Last 14 days)
            const twoWeeksAgo = new Date()
            twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

            const { data: attendance } = await supabase
                .from('attendance')
                .select('*')
                .eq('student_id', studentId)
                .in('status', ['LATE', 'ABSENT'])
                .gte('date', twoWeeksAgo.toISOString().split('T')[0])
                .order('date', { ascending: false })

            // 2. Failing Grades (Recent assignments)
            // Simplified: Fetch assignments with grades < 6 (assuming 0-10 scale)
            // This requires joining assignments and grades.
            // Optimized query:
            const { data: lowGrades } = await supabase
                .from('grades')
                .select('score, assignment:assignments(title)')
                .eq('student_id', studentId)
                .lt('score', 6)
                .limit(5)

            // Combine alerts
            const attendanceAlerts = (attendance || []).map(a => ({
                id: `att-${a.id}`,
                type: a.status === 'LATE' ? 'LATE' : 'ABSENT',
                title: a.status === 'LATE' ? 'Retardo Registrado' : 'Falta Registrada',
                date: a.date,
                description: a.notes || 'Sin justificación'
            }))

            const gradeAlerts = (lowGrades || []).map((g: any, i: number) => ({
                id: `grade-${i}`,
                type: 'GRADE',
                title: 'Calificación Baja / Reprobatoria',
                date: new Date().toISOString().split('T')[0], // Approximate
                description: `${g.assignment?.title}: ${g.score}`
            }))

            setAlerts([...attendanceAlerts, ...gradeAlerts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))

        } catch (error) {
            console.error('Error loading alerts:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) return <div className="animate-pulse h-20 bg-gray-100 rounded-2xl"></div>

    if (alerts.length === 0) {
        return (
            <div className="bg-green-50 rounded-2xl p-6 border border-green-100 flex items-center gap-4">
                <div className="p-3 bg-green-100 text-green-600 rounded-full">
                    <CheckCircleIcon className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="font-bold text-green-800">Todo en orden</h3>
                    <p className="text-sm text-green-600">No tienes alertas académicas recientes.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
            <div className="p-4 bg-red-50 border-b border-red-100 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h3 className="font-bold text-red-800">Alertas Académicas</h3>
            </div>
            <div className="divide-y divide-red-50">
                {alerts.map(alert => (
                    <div key={alert.id} className="p-4 hover:bg-red-50/30 transition-colors flex items-start gap-3">
                        {alert.type === 'LATE' && <Clock className="w-5 h-5 text-amber-500 mt-0.5" />}
                        {alert.type === 'ABSENT' && <XCircle className="w-5 h-5 text-red-500 mt-0.5" />}
                        {alert.type === 'GRADE' && <FileWarning className="w-5 h-5 text-orange-500 mt-0.5" />}

                        <div>
                            <p className="font-bold text-gray-800 text-sm">{alert.title}</p>
                            <p className="text-xs text-gray-500 mb-1">{new Date(alert.date).toLocaleDateString()}</p>
                            <p className="text-sm text-gray-600">{alert.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

function CheckCircleIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <path d="m9 11 3 3L22 4" />
        </svg>
    )
}
