import { useEffect, useState } from 'react'
import { Calendar, ChevronDown, CheckCircle2, AlertCircle, XCircle, Clock } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { useProfile } from '../../../hooks/useProfile'

export const StudentAttendancePage = () => {
    const { data: tenant } = useTenant()
    const { profile } = useProfile()
    const [loading, setLoading] = useState(true)
    const [children, setChildren] = useState<any[]>([])
    const [selectedChild, setSelectedChild] = useState<any>(null)
    const [attendance, setAttendance] = useState<any[]>([])
    const [stats, setStats] = useState({ present: 0, late: 0, absent: 0, excused: 0 })

    const isTutor = profile?.role === 'TUTOR'

    useEffect(() => {
        const loadIdentity = async () => {
            if (!tenant || !profile) return
            setLoading(true)

            try {
                if (isTutor) {
                    const { data: guardianship } = await supabase
                        .from('guardians')
                        .select('student_id, student:students(id, first_name, last_name_paternal, group:groups(grade, section))')
                        .eq('user_id', profile.id)

                    const studs = guardianship?.map((g: any) => g.student) || []
                    setChildren(studs)
                    if (studs.length > 0) setSelectedChild(studs[0])
                } else {
                    const { data: student } = await supabase
                        .from('students')
                        .select('id, first_name, last_name_paternal, group:groups(grade, section)')
                        .eq('user_id', profile.id)
                        .single()

                    if (student) setSelectedChild(student)
                }
            } catch (error) {
                console.error('Error loading identity:', error)
            } finally {
                setLoading(false)
            }
        }
        loadIdentity()
    }, [tenant, profile])

    useEffect(() => {
        const loadAttendance = async () => {
            if (!selectedChild || !tenant) return
            setLoading(true)

            try {
                const { data } = await supabase
                    .from('attendance')
                    .select('*')
                    .eq('student_id', selectedChild.id)
                    .order('date', { ascending: false })

                if (data) {
                    setAttendance(data)
                    const stats = data.reduce((acc: any, curr: any) => {
                        const s = curr.status.toLowerCase()
                        acc[s] = (acc[s] || 0) + 1
                        return acc
                    }, { present: 0, late: 0, absent: 0, excused: 0 })
                    setStats(stats)
                }

            } catch (error) {
                console.error('Error loading attendance:', error)
            } finally {
                setLoading(false)
            }
        }

        if (selectedChild) loadAttendance()
    }, [selectedChild, tenant])

    if (loading && !selectedChild) return <div className="p-8 text-center">Cargando asistencia...</div>

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                        <Calendar className="w-8 h-8 text-blue-500" />
                        Historial de Asistencia
                    </h1>
                    <p className="text-gray-500 font-medium ml-11">Registro detallado de puntualidad.</p>
                </div>

                {isTutor && children.length > 1 && (
                    <div className="relative">
                        <select
                            value={selectedChild?.id || ''}
                            onChange={(e) => {
                                const child = children.find(c => c.id === e.target.value)
                                setSelectedChild(child)
                            }}
                            className="bg-white border border-gray-200 text-gray-700 py-2 pl-4 pr-10 rounded-xl font-bold shadow-sm"
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Asistencias" value={stats.present} color="text-green-600" bg="bg-green-50" icon={CheckCircle2} />
                    <StatCard label="Retardos" value={stats.late} color="text-amber-600" bg="bg-amber-50" icon={Clock} />
                    <StatCard label="Faltas" value={stats.absent} color="text-red-600" bg="bg-red-50" icon={XCircle} />
                    <StatCard label="Justificadas" value={stats.excused} color="text-blue-600" bg="bg-blue-50" icon={AlertCircle} />
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-600 font-bold uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4">Fecha</th>
                                <th className="px-6 py-4">Estado</th>
                                <th className="px-6 py-4">Observaciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {attendance.map((record) => (
                                <tr key={record.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900">
                                        {new Date(record.date).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                    </td>
                                    <td className="px-6 py-4">
                                        <StatusBadge status={record.status} />
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 italic">
                                        {record.notes || '-'}
                                    </td>
                                </tr>
                            ))}
                            {attendance.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-6 py-8 text-center text-gray-400">
                                        No hay registros de asistencia.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

const StatCard = ({ label, value, color, bg, icon: Icon }: any) => (
    <div className={`p-4 rounded-2xl border border-transparent ${bg} flex items-center justify-between`}>
        <div>
            <p className={`text-xs font-black uppercase tracking-widest ${color} opacity-70`}>{label}</p>
            <p className={`text-2xl font-black ${color}`}>{value}</p>
        </div>
        <Icon className={`w-8 h-8 ${color} opacity-20`} />
    </div>
)

const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
        PRESENT: 'bg-green-100 text-green-700',
        LATE: 'bg-amber-100 text-amber-700',
        ABSENT: 'bg-red-100 text-red-700',
        EXCUSED: 'bg-blue-100 text-blue-700'
    }
    const labels: Record<string, string> = {
        PRESENT: 'Asistencia',
        LATE: 'Retardo',
        ABSENT: 'Falta',
        EXCUSED: 'Justificado'
    }
    return (
        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
            {labels[status] || status}
        </span>
    )
}
