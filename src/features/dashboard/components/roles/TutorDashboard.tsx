import { useEffect, useState } from 'react'
import {
    Users, GraduationCap, Calendar, Mail, FileText, Star, Clock,
    Loader2, ChevronDown, AlertCircle, CheckCircle2, Info, Bell
} from 'lucide-react'
import { AcademicAlerts } from './AcademicAlerts'
import { supabase } from '../../../../lib/supabase'
import { useTenant } from '../../../../hooks/useTenant'
import { useAlerts } from '../../../../hooks/useAlerts'

export const TutorDashboard = () => {
    const { data: tenant } = useTenant()
    const [loading, setLoading] = useState(true)
    const [children, setChildren] = useState<any[]>([])
    const [selectedChild, setSelectedChild] = useState<any>(null)
    const [stats, setStats] = useState({ average: 0, attendance: 0 })
    const [agenda, setAgenda] = useState<any[]>([])
    const [announcements, setAnnouncements] = useState<any[]>([])
    const [pendingActivities, setPendingActivities] = useState<any[]>([])
    const [userId, setUserId] = useState<string | undefined>()

    // Notification System
    const { alerts, markAsRead, runComplianceChecks, unreadCount } = useAlerts(userId, children)

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

                // Persistence for DashboardLayout
                sessionStorage.setItem('vunlek_tutor_children_count', students.length.toString())

                if (students.length > 0) {
                    setSelectedChild(students[0])
                    setUserId(user.id)
                }

            } catch (error) {
                console.error('Tutor dashboard load error:', error)
            } finally {
                setLoading(false)
            }
        }

        loadChildren()
    }, [tenant])

    // Trigger Compliance Check once
    useEffect(() => {
        if (children.length > 0 && userId && tenant?.id) {
            runComplianceChecks(tenant.id)
        }
    }, [children.length, userId, tenant?.id])

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

            // 6. Get Pending/Missing Activities
            const thirtyDaysAgo = new Date()
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
            const nextWeek = new Date()
            nextWeek.setDate(nextWeek.getDate() + 7)

            const { data: allAssignments } = await supabase
                .from('assignments')
                .select('id, title, due_date, type, subject:subject_catalog(name)')
                .eq('tenant_id', tenant.id)
                .gte('due_date', thirtyDaysAgo.toISOString())
                .lte('due_date', nextWeek.toISOString())
                .order('due_date', { ascending: true })

            const { data: studentGrades } = await supabase
                .from('grades')
                .select('assignment_id, is_graded')
                .eq('student_id', selectedChild.id)

            const pending = (allAssignments || []).filter(asm => {
                const grade = studentGrades?.find(g => g.assignment_id === asm.id)
                return !grade || !grade.is_graded
            })

            setPendingActivities(pending)
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
        <div className="space-y-6 md:space-y-12 animate-in fade-in duration-1000 pb-20 px-4 md:px-4">
            {/* Header section */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="text-center md:text-left">
                    <h1 className="text-2xl md:text-4xl font-black text-gray-900 tracking-tight leading-none mb-2">Panel del Tutor</h1>
                    <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px] md:text-xs">Acompañamiento Académico</p>
                </div>
            </div>

            {/* Children Cards Grid (The "Mis Hijos" Selector) */}
            {children.length > 1 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-top duration-700">
                    <div className="col-span-full">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 px-2 flex items-center gap-2">
                            <Users className="w-4 h-4" /> Mis Hijos Linkeados
                        </h3>
                    </div>
                    {children.map(child => (
                        <button
                            key={child.id}
                            onClick={() => setSelectedChild(child)}
                            className={`
                                p-6 rounded-[2.5rem] border-4 transition-all text-left relative overflow-hidden active:scale-95 group
                                ${selectedChild?.id === child.id
                                    ? 'bg-white border-blue-600 shadow-2xl shadow-blue-500/10'
                                    : 'bg-slate-50 border-transparent hover:bg-white hover:border-slate-100 hover:shadow-xl'}
                            `}
                        >
                            <div className="flex items-center gap-4 relative z-10">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${selectedChild?.id === child.id ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-400'}`}>
                                    <GraduationCap className="w-8 h-8 stroke-[2.5]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-black uppercase text-blue-500 mb-1 tracking-widest">
                                        {child.group?.grade}° {child.group?.section}
                                    </p>
                                    <h4 className="text-lg font-black text-slate-900 truncate tracking-tight">
                                        {child.first_name} {child.last_name_paternal}
                                    </h4>
                                </div>
                                {selectedChild?.id === child.id && (
                                    <div className="bg-blue-600 text-white p-2 rounded-full shadow-lg shadow-blue-500/40">
                                        <CheckCircle2 className="w-5 h-5 stroke-[3]" />
                                    </div>
                                )}
                            </div>
                            {selectedChild?.id === child.id && (
                                <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 rounded-full -mr-10 -mt-10 blur-2xl" />
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* Squishy Hero Block (Highlights Selected Child) */}
            {selectedChild && (
                <div className="bg-gradient-to-br from-blue-600 to-indigo-800 rounded-[2rem] md:rounded-[3.5rem] p-6 md:p-10 text-white shadow-[0_30px_60px_-15px_rgba(37,99,235,0.4)] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl animate-pulse" />
                    <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6 md:gap-8">
                        <div className="text-center lg:text-left">
                            <div className="flex items-center justify-center lg:justify-start gap-4 mb-4">
                                <div className="bg-white/20 p-3 md:p-4 rounded-[1.5rem] backdrop-blur-md shadow-inner">
                                    <GraduationCap className="h-6 w-6 md:h-8 md:w-8 text-white stroke-[2.5]" />
                                </div>
                                <span className="font-black bg-white/20 px-4 py-1.5 md:px-6 md:py-2 rounded-full text-xs md:text-sm backdrop-blur-md border border-white/20">
                                    {selectedChild.group
                                        ? `${selectedChild.group.grade}° ${selectedChild.group.section}`
                                        : 'Sin Grupo'
                                    }
                                </span>
                            </div>
                            <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-2 drop-shadow-md">
                                {selectedChild.first_name} <br className="md:hidden" /> {selectedChild.last_name_paternal}
                            </h2>
                            <p className="text-blue-100 text-sm md:text-lg font-bold opacity-80 uppercase tracking-wide">Reporte en tiempo real</p>
                        </div>
                        <div className="flex gap-4 md:gap-6 w-full md:w-auto justify-center">
                            <div className="bg-white/10 backdrop-blur-xl p-4 md:p-8 rounded-[2rem] md:rounded-[3rem] text-center flex-1 md:min-w-[140px] border border-white/10 shadow-xl active:scale-95 transition-transform">
                                <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-blue-200 mb-1">Promedio</p>
                                <p className="text-2xl md:text-4xl font-black leading-none">{stats.average.toFixed(1)}</p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-xl p-4 md:p-8 rounded-[2rem] md:rounded-[3rem] text-center flex-1 md:min-w-[140px] border border-white/10 shadow-xl active:scale-95 transition-transform">
                                <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-blue-200 mb-1">Asistencia</p>
                                <p className="text-2xl md:text-4xl font-black leading-none">{stats.attendance}%</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SECTION 1: ACTVIDADES PENDIENTES (The #1 Priority) */}
            <div className="space-y-6">
                <div className="flex items-center gap-4 px-2 md:px-4">
                    <div className="p-2 md:p-3 bg-amber-100 text-amber-600 rounded-xl md:rounded-2xl">
                        <AlertCircle className="w-6 h-6 md:w-8 md:h-8 stroke-[3]" />
                    </div>
                    <div>
                        <h3 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight">Actividades Pendientes</h3>
                        <p className="text-slate-500 font-bold text-[10px] md:text-sm uppercase tracking-widest">Lo que requiere atención inmediata</p>
                    </div>
                    {pendingActivities.length > 0 && (
                        <span className="ml-auto bg-amber-500 text-white px-6 py-2 rounded-full font-black text-xl shadow-lg shadow-amber-500/30">
                            {pendingActivities.length}
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-2">
                    {pendingActivities.length === 0 ? (
                        <div className="col-span-full bg-emerald-50 rounded-[3rem] p-16 text-center border-4 border-dashed border-emerald-100 outline-none">
                            <div className="bg-white w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/10 active:scale-95 transition-transform cursor-pointer">
                                <CheckCircle2 className="w-12 h-12 text-emerald-500 stroke-[3]" />
                            </div>
                            <h4 className="text-2xl font-black text-emerald-900 mb-2">¡Todo al día!</h4>
                            <p className="text-emerald-600 font-bold text-lg">No hay actividades atrasadas ni pendientes.</p>
                        </div>
                    ) : (
                        pendingActivities.map((item) => {
                            const isOverdue = new Date(item.due_date) < new Date()
                            return (
                                <div
                                    key={item.id}
                                    className={`p-5 md:p-8 rounded-[2rem] md:rounded-[3rem] border-4 flex flex-col md:flex-row items-center gap-4 md:gap-6 transition-all active:scale-95 cursor-pointer shadow-[0_20px_50px_rgba(0,0,0,0.08)] ${isOverdue ? 'bg-rose-50 border-rose-100 text-rose-900' : 'bg-amber-50 border-amber-100 text-amber-900'
                                        }`}
                                >
                                    <div className={`p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] shadow-inner ${isOverdue ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                                        <Clock className="w-6 h-6 md:w-10 md:h-10 stroke-[3]" />
                                    </div>
                                    <div className="flex-1 text-center md:text-left">
                                        <h4 className="text-2xl font-black leading-tight mb-2 tracking-tight">{item.title}</h4>
                                        <p className="text-sm font-black uppercase tracking-widest opacity-60 mb-3">
                                            {item.subject?.name} • Límite: {new Date(item.due_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                                        </p>
                                        {isOverdue && (
                                            <span className="inline-block px-4 py-1.5 bg-rose-600 text-white text-[10px] font-black rounded-full uppercase tracking-[0.2em] shadow-lg shadow-rose-600/30 animate-pulse">
                                                Atrasado
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>

                {selectedChild && (
                    <div className="mt-4 px-2 md:px-4">
                        <div className="bg-white rounded-[2rem] md:rounded-[3.5rem] p-5 md:p-8 border-4 border-slate-50 shadow-2xl shadow-slate-200/50">
                            <AcademicAlerts studentId={selectedChild.id} />
                        </div>
                    </div>
                )}
            </div>

            {/* SECTION 2: ALERTAS Y SEGUIMIENTO (Real-time logs) */}
            {(alerts.length > 0 || unreadCount > 0) && (
                <div className="bg-white p-6 md:p-10 rounded-[4rem] shadow-[0_40px_80px_-15px_rgba(0,0,0,0.08)] border-4 border-slate-50 animate-in slide-in-from-bottom-12 duration-1000">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-10">
                        <div className="flex items-center gap-4">
                            <div className="p-4 bg-rose-100 text-rose-600 rounded-[1.5rem] shadow-inner animate-bounce-slow">
                                <Bell className="w-8 h-8 stroke-[3]" />
                            </div>
                            <div>
                                <h3 className="text-4xl font-black text-gray-900 tracking-tight">Bitácora de Alertas</h3>
                                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Seguimiento de comportamiento y logros</p>
                            </div>
                        </div>
                        {unreadCount > 0 && (
                            <span className="px-6 py-2 bg-rose-600 text-white text-sm font-black rounded-full shadow-xl shadow-rose-600/30 uppercase tracking-widest">
                                {unreadCount} NUEVAS
                            </span>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {alerts.map((alert) => (
                            <AlertItem
                                key={alert.id}
                                alert={alert}
                                onRead={() => !alert.read_at && markAsRead(alert.id)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* SECTION 3: PRÓXIMAS ENTREGAS & AVISOS (The Grid) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Upcoming Tasks - Squishy Style */}
                <div className="bg-slate-50 p-6 md:p-10 rounded-[2.5rem] md:rounded-[4rem] border-4 border-white shadow-inner">
                    <div className="flex items-center gap-4 mb-6 md:mb-8 px-2">
                        <div className="p-2 md:p-3 bg-blue-100 text-blue-600 rounded-xl md:rounded-2xl">
                            <Calendar className="w-6 h-6 md:w-8 md:h-8 stroke-[3]" />
                        </div>
                        <h3 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Próximas Tareas</h3>
                    </div>

                    <div className="space-y-6">
                        {agenda.length === 0 ? (
                            <div className="bg-white/50 p-12 rounded-[2.5rem] text-center border-2 border-dashed border-slate-200">
                                <p className="text-gray-400 font-black italic">Sin tareas próximas en agenda.</p>
                            </div>
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
                </div>

                {/* Announcements Card */}
                <div className="bg-cyan-50 p-6 md:p-10 rounded-[2.5rem] md:rounded-[4rem] border-4 border-white shadow-inner">
                    <div className="flex items-center gap-4 mb-6 md:mb-8 px-2">
                        <div className="p-2 md:p-3 bg-cyan-100 text-cyan-600 rounded-xl md:rounded-2xl">
                            <Mail className="w-6 h-6 md:w-8 md:h-8 stroke-[3]" />
                        </div>
                        <h3 className="text-2xl md:text-3xl font-black text-cyan-900 tracking-tight">Avisos Escuela</h3>
                    </div>

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

const AlertItem = ({ alert, onRead }: { alert: any, onRead: () => void }) => {
    const isUnread = !alert.read_at
    const isCompliance = alert.type === 'COMPLIANCE_REPORT'
    const isFulfilled = alert.metadata?.status === 'FULFILLED'

    return (
        <div
            onClick={onRead}
            className={`p-5 md:p-8 rounded-[2.5rem] border-4 transition-all cursor-pointer relative overflow-hidden active:scale-95 shadow-lg group ${isUnread ? 'bg-white border-blue-200 shadow-blue-500/5' : 'bg-slate-50 border-slate-100 opacity-60'
                }`}
        >
            {isUnread && (
                <div className="absolute top-6 right-6 w-4 h-4 bg-blue-500 rounded-full shadow-lg shadow-blue-500/40 animate-pulse"></div>
            )}

            <div className="flex flex-col gap-6">
                <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-inner ${isCompliance ? (isFulfilled ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600')
                    : 'bg-blue-100 text-blue-600'
                    }`}>
                    {isCompliance ? (isFulfilled ? <CheckCircle2 className="w-8 h-8 stroke-[2.5]" /> : <AlertCircle className="w-8 h-8 stroke-[2.5]" />) : <Info className="w-8 h-8 stroke-[2.5]" />}
                </div>

                <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        {new Date(alert.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'long' })}
                    </p>
                    <h5 className={`text-xl font-black leading-tight tracking-tight ${isUnread ? 'text-slate-900' : 'text-slate-600'}`}>
                        {alert.title}
                    </h5>
                    <p className="text-sm font-bold text-slate-500 leading-relaxed">
                        {alert.message}
                    </p>
                </div>
            </div>
        </div>
    )
}

const EventItem = ({ title, type, date }: any) => (
    <div className="flex flex-col md:flex-row items-center justify-between p-6 bg-white rounded-[2.5rem] border-4 border-slate-100 hover:border-blue-200 transition-all active:scale-95 shadow-md shadow-slate-200/50 group cursor-pointer gap-4">
        <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
            <div className={`p-4 rounded-3xl shadow-inner ${type === 'EXAMEN' ? 'bg-rose-100 text-rose-600 border border-rose-200' : 'bg-blue-100 text-blue-600 border border-blue-200'}`}>
                <Star className="w-8 h-8 stroke-[2.5]" />
            </div>
            <div>
                <h5 className="text-xl font-black text-slate-900 tracking-tight leading-tight mb-1">{title}</h5>
                <p className="text-xs font-black text-blue-400 uppercase tracking-widest">{type} • {date}</p>
            </div>
        </div>
        <div className="p-3 bg-slate-50 rounded-2xl text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <Clock className="w-6 h-6 stroke-[3]" />
        </div>
    </div>
)

const AnnouncementItem = ({ title, date }: any) => (
    <div className="p-8 bg-white hover:bg-cyan-600 rounded-[2.5rem] transition-all cursor-pointer group border-4 border-transparent hover:border-cyan-400 active:scale-95 shadow-lg shadow-cyan-900/5">
        <p className="text-xs font-black text-cyan-400 group-hover:text-white/80 uppercase tracking-widest mb-3 leading-none">{date}</p>
        <h5 className="text-xl font-black text-slate-900 group-hover:text-white leading-tight tracking-tight">{title}</h5>
    </div>
)
