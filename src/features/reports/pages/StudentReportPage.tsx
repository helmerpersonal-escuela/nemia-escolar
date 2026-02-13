import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Printer, ArrowLeft, School, AlertTriangle, CheckCircle } from 'lucide-react'

export const StudentReportPage = () => {
    const { studentId } = useParams()
    const navigate = useNavigate()
    const { data: tenant } = useTenant()

    const [loading, setLoading] = useState(true)
    const [student, setStudent] = useState<any>(null)
    const [assignments, setAssignments] = useState<any[]>([])
    const [stats, setStats] = useState({
        average: 0,
        submitted: 0,
        missing: 0,
        attendance: { present: 0, absent: 0, late: 0, excused: 0 },
        incidents: [] as any[]
    })

    useEffect(() => {
        if (studentId && tenant) {
            fetchData()
        }
    }, [studentId, tenant])

    const fetchData = async () => {
        setLoading(true)
        if (!tenant || !studentId) return

        // 1. Student Info
        const { data: studentData } = await supabase
            .from('students')
            .select('*, group:groups(grade, section)')
            .eq('id', studentId)
            .single()

        if (studentData) setStudent(studentData)

        // 2. Assignments & Grades
        // First get all assignments for this group
        const { data: groupAssignments } = await supabase
            .from('assignments')
            .select('id, title, type, due_date, subject:subject_catalog(name)')
            .eq('group_id', studentData.group_id)
            .order('due_date', { ascending: false })

        if (groupAssignments) {
            // Get grades for this student
            const { data: studentGrades } = await supabase
                .from('grades')
                .select('*')
                .eq('student_id', studentId)
                .in('assignment_id', groupAssignments.map(a => a.id))

            const processedAssignments = groupAssignments.map(assignment => {
                const grade = studentGrades?.find(g => g.assignment_id === assignment.id)
                const isPastDue = new Date(assignment.due_date) < new Date()

                let status = 'PENDING'
                if (grade?.score !== null && grade?.score !== undefined) status = 'GRADED'
                else if (isPastDue) status = 'MISSING'

                return {
                    ...assignment,
                    score: grade?.score,
                    feedback: grade?.feedback,
                    status
                }
            })

            setAssignments(processedAssignments)

            const graded = processedAssignments.filter(a => a.status === 'GRADED')
            const sum = graded.reduce((acc, curr) => acc + (curr.score || 0), 0)
            const average = graded.length > 0 ? sum / graded.length : 0

            setStats(prev => ({
                ...prev,
                average,
                submitted: graded.length,
                missing: processedAssignments.filter(a => a.status === 'MISSING').length
            }))
        }

        // 3. Attendance
        const { data: attendanceData } = await supabase
            .from('attendance')
            .select('status')
            .eq('student_id', studentId)

        if (attendanceData) {
            const counts = attendanceData.reduce((acc: any, curr) => {
                acc[curr.status.toLowerCase()] = (acc[curr.status.toLowerCase()] || 0) + 1
                return acc
            }, { present: 0, absent: 0, late: 0, excused: 0 })

            setStats(prev => ({ ...prev, attendance: counts }))
        }

        // 4. Incidents
        const { data: incidentsData } = await supabase
            .from('student_incidents')
            .select('*')
            .eq('student_id', studentId)
            .order('created_at', { ascending: false })

        if (incidentsData) {
            setStats(prev => ({ ...prev, incidents: incidentsData }))
        }

        setLoading(false)
    }

    if (loading) return <div className="p-10 text-center font-bold text-gray-400">Generando reporte...</div>

    return (
        <div className="bg-gray-100 min-h-screen p-8 print:bg-white print:p-0">
            {/* Action Bar (Hidden in Print) */}
            <div className="max-w-4xl mx-auto mb-8 flex justify-between items-center print:hidden">
                <button onClick={() => navigate(-1)} className="flex items-center text-gray-600 font-bold hover:text-gray-900">
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Volver
                </button>
                <button
                    onClick={() => window.print()}
                    className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center shadow-lg hover:bg-blue-700 transition-all"
                >
                    <Printer className="w-5 h-5 mr-3" />
                    Imprimir Reporte
                </button>
            </div>

            {/* Report Paper */}
            <div className="max-w-4xl mx-auto bg-white shadow-2xl rounded-[2rem] overflow-hidden print:shadow-none print:rounded-none">
                {/* Header */}
                <div className="bg-blue-900 text-white p-12 print:bg-white print:text-black print:p-0 print:border-b-2 print:border-black print:mb-8 text-center sm:text-left print:break-inside-avoid">
                    <div className="flex flex-col sm:flex-row justify-between items-start">
                        <div className="mb-6 sm:mb-0">
                            <div className="flex items-center justify-center sm:justify-start space-x-3 mb-2">
                                <School className="w-8 h-8 text-blue-300 print:text-black" />
                                <h1 className="text-3xl font-black uppercase tracking-widest">{tenant?.name || 'Escuela'}</h1>
                            </div>
                            <p className="text-blue-200 print:text-black font-medium text-sm">Reporte de Desempeño Escolar</p>
                            <p className="text-blue-200 print:text-black font-medium text-xs opacity-70 mt-1">
                                Generado el: {new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                        </div>
                        <div className="text-center sm:text-right w-full sm:w-auto">
                            <h2 className="text-4xl font-black tracking-tight mb-1">
                                {student?.first_name} {student?.last_name_paternal}
                            </h2>
                            <p className="text-xl font-bold text-blue-200 print:text-black">
                                {student?.group?.grade}° "{student?.group?.section}"
                            </p>
                            <div className="mt-4 inline-flex items-center bg-blue-800/50 px-4 py-2 rounded-lg print:hidden">
                                <span className="text-xs font-bold uppercase tracking-widest text-blue-200 mr-2">Promedio General</span>
                                <span className="text-2xl font-black text-white">{stats.average.toFixed(1)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-12 space-y-12 print:p-0">

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 print:grid-cols-4 print:gap-4 print:break-inside-avoid">
                        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 print:border-black text-center">
                            <span className="block text-3xl font-black text-gray-900">{stats.submitted}</span>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tareas Entregadas</span>
                        </div>
                        <div className="p-4 bg-red-50 rounded-2xl border border-red-100 print:border-black text-center">
                            <span className="block text-3xl font-black text-red-600 print:text-black">{stats.missing}</span>
                            <span className="text-[10px] font-bold text-red-400 print:text-black uppercase tracking-widest">Tareas Faltantes</span>
                        </div>
                        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 print:border-black text-center">
                            <span className="block text-3xl font-black text-blue-600 print:text-black">{stats.attendance.present}</span>
                            <span className="text-[10px] font-bold text-blue-400 print:text-black uppercase tracking-widest">Asistencias</span>
                        </div>
                        <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 print:border-black text-center">
                            <span className="block text-3xl font-black text-orange-600 print:text-black">{stats.attendance.absent}</span>
                            <span className="text-[10px] font-bold text-orange-400 print:text-black uppercase tracking-widest">Faltas</span>
                        </div>
                    </div>

                    {/* Assignments List */}
                    <div>
                        <h3 className="text-xl font-black text-gray-900 border-b-2 border-gray-100 pb-2 mb-6 uppercase tracking-tight flex items-center">
                            <CheckCircle className="w-5 h-5 mr-2 text-blue-600 print:hidden" />
                            Desempeño Académico
                        </h3>
                        {assignments.length > 0 ? (
                            <div className="overflow-hidden rounded-xl border border-gray-100 print:border-black print:break-inside-avoid">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-wider border-b print:bg-white print:text-black">
                                        <tr>
                                            <th className="px-6 py-4">Actividad</th>
                                            <th className="px-6 py-4">Materia</th>
                                            <th className="px-6 py-4">Fecha</th>
                                            <th className="px-6 py-4 text-center">Estado</th>
                                            <th className="px-6 py-4 text-right">Calificación</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 print:divide-black">
                                        {assignments.map((assignment) => (
                                            <tr key={assignment.id} className="hover:bg-gray-50/50">
                                                <td className="px-6 py-4 font-bold text-gray-800">
                                                    {assignment.title}
                                                </td>
                                                <td className="px-6 py-4 text-gray-600 font-medium">
                                                    {assignment.subject?.name || 'General'}
                                                </td>
                                                <td className="px-6 py-4 text-gray-500 font-medium text-xs">
                                                    {new Date(assignment.due_date).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wide border
                                                        ${assignment.status === 'GRADED' ? 'bg-green-50 text-green-600 border-green-200 print:border-black print:text-black' :
                                                            assignment.status === 'MISSING' ? 'bg-red-50 text-red-600 border-red-200 print:border-black print:text-black' :
                                                                'bg-gray-50 text-gray-500 border-gray-200 print:border-black print:text-black'}`}>
                                                        {assignment.status === 'GRADED' ? 'Entregada' :
                                                            assignment.status === 'MISSING' ? 'Faltante' : 'Pendiente'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right font-black text-gray-900">
                                                    {assignment.score !== null ? assignment.score : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-gray-400 italic text-center py-6">No hay actividades registradas.</p>
                        )}
                    </div>

                    {/* Incidents / Conduct */}
                    <div>
                        <h3 className="text-xl font-black text-gray-900 border-b-2 border-gray-100 pb-2 mb-6 uppercase tracking-tight flex items-center">
                            <AlertTriangle className="w-5 h-5 mr-2 text-orange-600 print:hidden" />
                            Reporte de Conducta e Incidencias
                        </h3>
                        {stats.incidents.length > 0 ? (
                            <div className="space-y-4 print:break-inside-avoid">
                                {stats.incidents.map((incident) => (
                                    <div key={incident.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50 print:bg-white print:border-black print:break-inside-avoid">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center space-x-2">
                                                <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded border
                                                    ${incident.type === 'POSITIVO' ? 'bg-green-100 text-green-700 border-green-200' :
                                                        incident.type === 'CONDUCTA' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                                            'bg-blue-100 text-blue-700 border-blue-200'} print:border-black print:text-black print:bg-white`}>
                                                    {incident.type}
                                                </span>
                                                <span className="text-xs font-bold text-gray-500">
                                                    {new Date(incident.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-black uppercase text-gray-400">
                                                Gravedad: {incident.severity}
                                            </span>
                                        </div>
                                        <h4 className="text-sm font-black text-gray-900 mb-1">{incident.title}</h4>
                                        <p className="text-sm text-gray-800 mb-2">{incident.description}</p>

                                        {incident.has_commitment && (
                                            <div className="mt-2 text-xs bg-white border border-gray-200 p-3 rounded-lg print:border-black">
                                                <p className="font-bold text-gray-900 uppercase mb-1">Compromiso / Acuerdo:</p>
                                                <p className="italic text-gray-600 print:text-black">{incident.commitment_description}</p>
                                            </div>
                                        )}

                                        {incident.action_taken && (
                                            <p className="text-xs text-gray-600 mt-2">
                                                <span className="font-bold">Acción tomada:</span> {incident.action_taken}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-6 rounded-xl border border-gray-100 bg-gray-50 text-center print:border-black print:bg-white print:break-inside-avoid">
                                <CheckCircle className="w-8 h-8 mx-auto text-green-500 mb-2 print:hidden" />
                                <p className="text-gray-500 font-bold">Sin incidencias negativas registradas.</p>
                                <p className="text-xs text-gray-400">El alumno ha mantenido una buena conducta durante este periodo.</p>
                            </div>
                        )}
                    </div>

                    {/* Footer for Signature */}
                    <div className="pt-24 print:pt-32 flex justify-between px-12 print:break-inside-avoid">
                        <div className="text-center">
                            <div className="w-64 border-t-2 border-black mb-2"></div>
                            <p className="text-sm font-bold uppercase">Firma del Maestro(a)</p>
                        </div>
                        <div className="text-center">
                            <div className="w-64 border-t-2 border-black mb-2"></div>
                            <p className="text-sm font-bold uppercase">Firma Padre o Tutor</p>
                        </div>
                    </div>
                </div>
            </div >
        </div >
    )
}
