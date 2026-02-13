import { useEffect, useState } from 'react'
import { Users, GraduationCap, Calendar, Mail, FileText, Star, Clock, Loader2, ChevronDown } from 'lucide-react'
import { AcademicAlerts } from './AcademicAlerts'
import { supabase } from '../../../../lib/supabase'
import { useTenant } from '../../../../hooks/useTenant'

export const TutorDashboard = () => {
    const { data: tenant } = useTenant()
    const [loading, setLoading] = useState(true)
    const [children, setChildren] = useState<any[]>([])
    const [selectedChild, setSelectedChild] = useState<any>(null)
    const [stats, setStats] = useState({ average: 0, attendance: 0 })
    const [agenda, setAgenda] = useState<any[]>([])
    const [announcements, setAnnouncements] = useState<any[]>([])

    useEffect(() => {
        const loadChildren = async () => {
            if (!tenant) return

            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return

                // 1. Get Children via Guardians table
                const { data: guardianship, error: guardError } = await supabase
                    .from('guardians')
                    .select('student_id, student:students(id, first_name, last_name_paternal, group:groups(grade, section))')
                    .eq('user_id', user.id)

                if (guardError) {
                    console.error('Error fetching guardianship:', guardError)
                    setLoading(false)
                    return
                }

                const students = guardianship?.map((g: any) => g.student) || []
                setChildren(students)

                if (students.length > 0) {
                    setSelectedChild(students[0])
                }

            } catch (error) {
                console.error('Tutor dashboard load error:', error)
            } finally {
                setLoading(false)
            }
        }

        loadChildren()
    }, [tenant])

    useEffect(() => {
        const loadChildData = async () => {
            if (!selectedChild || !tenant) return

            // 2. Get Average Grade
            const { data: grades } = await supabase
                .from('grades')
                .select('score')
                .eq('student_id', selectedChild.id)

            let avg = 0
            if (grades && grades.length > 0) {
                const sum = grades.reduce((acc: number, curr: any) => acc + (curr.score || 0), 0)
                avg = sum / grades.length
            }

            // 3. Get Attendance
            const { data: attendance } = await supabase
                .from('attendance')
                .select('status')
                .eq('student_id', selectedChild.id)

            let attPercentage = 100
            if (attendance && attendance.length > 0) {
                const present = attendance.filter((a: any) => ['PRESENT', 'LATE'].includes(a.status)).length
                attPercentage = Math.round((present / attendance.length) * 100)
            }

            setStats({ average: avg, attendance: attPercentage })

            // 4. Get Agenda
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
        }

        if (selectedChild) {
            loadChildData()
        }
    }, [selectedChild, tenant])

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        )
    }

    if (children.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-10 h-10 text-blue-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">No hay estudiantes vinculados</h2>
                <p className="text-gray-500 mt-2">No hemos encontrado alumnos asociados a tu cuenta de tutor.</p>
                <p className="text-xs text-gray-400 mt-4">Contacta a la escuela para vincular a tu hijo(a).</p>
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-gray-900">Panel de Tutor</h1>
                    <p className="text-gray-500">Monitoreo académico y comunicación.</p>
                </div>

                {children.length > 1 && (
                    <div className="relative">
                        <select
                            value={selectedChild?.id || ''}
                            onChange={(e) => {
                                const child = children.find(c => c.id === e.target.value)
                                setSelectedChild(child)
                            }}
                            className="appearance-none bg-white border border-gray-200 text-gray-700 py-2 pl-4 pr-10 rounded-xl leading-tight focus:outline-none focus:bg-white focus:border-blue-500 font-bold"
                        >
                            {children.map(child => (
                                <option key={child.id} value={child.id}>
                                    {child.first_name} {child.last_name_paternal}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                            <ChevronDown className="h-4 w-4" />
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-cyan-700 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm">
                                <GraduationCap className="h-6 w-6 text-white" />
                            </div>
                            <span className="font-bold bg-white/20 px-3 py-1 rounded-full text-xs backdrop-blur-sm">
                                {selectedChild?.group?.grade}° {selectedChild?.group?.section}
                            </span>
                        </div>
                        <h2 className="text-3xl font-black tracking-tight">{selectedChild?.first_name} {selectedChild?.last_name_paternal}</h2>
                        <p className="text-cyan-100 text-sm mt-1 font-medium">Visualizando reporte académico en tiempo real.</p>
                    </div>
                    <div className="mt-6 md:mt-0 flex gap-4">
                        <div className="bg-white/20 backdrop-blur-md p-4 rounded-2xl text-center min-w-[100px]">
                            <p className="text-[10px] font-black uppercase tracking-widest text-cyan-200">Promedio</p>
                            <p className="text-2xl font-black">{stats.average.toFixed(1)}</p>
                        </div>
                        <div className="bg-white/20 backdrop-blur-md p-4 rounded-2xl text-center min-w-[100px]">
                            <p className="text-[10px] font-black uppercase tracking-widest text-cyan-200">Asistencia</p>
                            <p className="text-2xl font-black">{stats.attendance}%</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-100 border border-slate-50">
                    <h3 className="text-xl font-bold mb-6 flex items-center">
                        <Calendar className="w-5 h-5 mr-3 text-blue-600" /> Próximas Entregas
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
                    {selectedChild && (
                        <div className="mt-8 pt-8 border-t border-slate-50">
                            <AcademicAlerts studentId={selectedChild.id} />
                        </div>
                    )}
                </div>

                <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-100 border border-slate-50">
                    <h3 className="text-xl font-bold mb-6 flex items-center">
                        <Mail className="w-5 h-5 mr-3 text-cyan-600" /> Avisos Escuela
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
        <h5 className="font-bold text-slate-900 group-hover:text-cyan-600">{title}</h5>
    </div>
)
