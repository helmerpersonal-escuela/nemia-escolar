import { useEffect, useState } from 'react'
import { GraduationCap, Calendar, Mail, FileText, Star, Clock, Loader2, AlertTriangle } from 'lucide-react'
import { AcademicAlerts } from './AcademicAlerts'
import { supabase } from '../../../../lib/supabase'
import { useTenant } from '../../../../hooks/useTenant'

export const StudentDashboard = () => {
    const { data: tenant } = useTenant()
    const [loading, setLoading] = useState(true)
    const [studentName, setStudentName] = useState('')
    const [studentId, setStudentId] = useState<string | null>(null)
    const [stats, setStats] = useState({ average: 0, attendance: 0 })
    const [agenda, setAgenda] = useState<any[]>([])
    const [announcements, setAnnouncements] = useState<any[]>([])

    useEffect(() => {
        const loadDashboard = async () => {
            if (!tenant) return

            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return

                // 1. Get Student ID - Use regular query instead of .single() to avoid PGRST116
                const { data: students, error: studentError } = await supabase
                    .from('students')
                    .select('id, first_name')
                    .eq('user_id', user.id)
                    .limit(1)

                if (studentError) {
                    console.error('Error fetching student:', studentError)
                    return
                }

                if (!students || students.length === 0) {
                    console.warn('No student record found for user:', user.id)
                    setStudentId(null)
                    return
                }

                const student = students[0]
                setStudentName(student.first_name)
                setStudentId(student.id)

                // 2. Get Average Grade
                const { data: grades } = await supabase
                    .from('grades')
                    .select('score')
                    .eq('student_id', student.id)

                let avg = 0
                if (grades && grades.length > 0) {
                    const sum = grades.reduce((acc, curr) => acc + (curr.score || 0), 0)
                    avg = sum / grades.length
                }

                // 3. Get Attendance
                const { data: attendance } = await supabase
                    .from('attendance')
                    .select('status')
                    .eq('student_id', student.id)

                let attPercentage = 100
                if (attendance && attendance.length > 0) {
                    const present = attendance.filter(a => ['PRESENT', 'LATE'].includes(a.status)).length
                    attPercentage = Math.round((present / attendance.length) * 100)
                }

                setStats({ average: avg, attendance: attPercentage })

                // 4. Get Agenda (Assignments & Events)
                const today = new Date().toISOString()
                const { data: assignments } = await supabase
                    .from('assignments')
                    .select('title, due_date, type')
                    .eq('tenant_id', tenant.id)
                    .gte('due_date', today)
                    .order('due_date', { ascending: true })
                    .limit(5)

                setAgenda(assignments || [])

                // 5. Get Announcements
                const { data: messages } = await supabase
                    .from('school_announcements')
                    .select('title, created_at, content')
                    .eq('tenant_id', tenant.id)
                    .order('created_at', { ascending: false })
                    .limit(3)

                setAnnouncements(messages || [])

            } catch (error) {
                console.error('Dashboard load error:', error)
            } finally {
                setLoading(false)
            }
        }

        loadDashboard()
    }, [tenant])

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        )
    }

    if (!studentId) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-[3rem] shadow-xl border border-slate-100 text-center animate-in fade-in zoom-in duration-500">
                <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center mb-8 border border-amber-100">
                    <AlertTriangle className="w-12 h-12 text-amber-500" />
                </div>
                <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Expediente Incompleto</h2>
                <p className="text-slate-500 max-w-md mx-auto leading-relaxed font-medium mb-8">
                    Tu usuario tiene el rol de <span className="text-indigo-600 font-bold uppercase tracking-widest text-xs">Alumno</span>, pero aún no se ha creado tu expediente oficial en la base de datos de la escuela.
                </p>
                <div className="space-y-4 w-full max-w-sm">
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-left">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">¿Qué hacer?</p>
                        <ul className="space-y-3">
                            <li className="flex gap-3 text-sm text-slate-600 font-medium leading-tight">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                                Contacta al área de Control Escolar de tu escuela.
                            </li>
                            <li className="flex gap-3 text-sm text-slate-600 font-medium leading-tight">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                                Proporciona tu CURP y nombre completo para tu alta.
                            </li>
                        </ul>
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
                    >
                        Reintentar carga
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-black tracking-tight">¡Hola, {studentName}!</h1>
                        <p className="text-indigo-100 text-lg mt-2 font-medium">Aquí está tu resumen académico de hoy.</p>
                    </div>
                    <div className="mt-6 md:mt-0 flex gap-4">
                        <div className="bg-white/20 backdrop-blur-md p-4 rounded-2xl text-center min-w-[100px]">
                            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Promedio</p>
                            <p className="text-2xl font-black">{stats.average.toFixed(1)}</p>
                        </div>
                        <div className="bg-white/20 backdrop-blur-md p-4 rounded-2xl text-center min-w-[100px]">
                            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Asistencia</p>
                            <p className="text-2xl font-black">{stats.attendance}%</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-100 border border-slate-50">
                    <h3 className="text-xl font-bold mb-6 flex items-center">
                        <Calendar className="w-5 h-5 mr-3 text-indigo-600" /> Próximas Entregas
                    </h3>
                    <div className="space-y-4">
                        {agenda.length === 0 ? (
                            <p className="text-gray-400 italic text-sm">No hay tareas pendientes.</p>
                        ) : (
                            agenda.map((item, idx) => (
                                <EventItem
                                    key={idx}
                                    title={item.title}
                                    type={item.type || 'TAREA'}
                                    date={new Date(item.due_date).toLocaleDateString('es-MX', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}
                                />
                            ))
                        )}
                    </div>
                    {studentId && (
                        <div className="mt-8 pt-8 border-t border-slate-50">
                            <AcademicAlerts studentId={studentId} />
                        </div>
                    )}
                </div>

                <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-100 border border-slate-50">
                    <h3 className="text-xl font-bold mb-6 flex items-center">
                        <Mail className="w-5 h-5 mr-3 text-purple-600" /> Avisos Escolares
                    </h3>
                    <div className="space-y-4">
                        {announcements.length === 0 ? (
                            <p className="text-gray-400 italic text-sm">No hay avisos recientes.</p>
                        ) : (
                            announcements.map((item, idx) => (
                                <AnnouncementItem
                                    key={idx}
                                    title={item.title}
                                    date={new Date(item.created_at).toLocaleDateString('es-MX')}
                                />
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

const EventItem = ({ title, type, date }: any) => (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
        <div className="flex items-center gap-4">
            <div className={`p-2 rounded-xl scale-90 ${type === 'EXAMEN' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'}`}>
                <Star className="w-5 h-5" />
            </div>
            <div>
                <h5 className="font-bold text-slate-900">{title}</h5>
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">{type} • {date}</p>
            </div>
        </div>
        <Clock className="w-4 h-4 text-slate-300" />
    </div>
)

const AnnouncementItem = ({ title, date }: any) => (
    <div className="p-4 hover:bg-slate-50 rounded-2xl transition-colors cursor-pointer group border border-transparent hover:border-slate-100">
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{date}</p>
        <h5 className="font-bold text-slate-900 group-hover:text-purple-600">{title}</h5>
    </div>
)
