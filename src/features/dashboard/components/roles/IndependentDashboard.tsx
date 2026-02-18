
import { useState, useEffect } from 'react'
import { useTenant } from '../../../../hooks/useTenant'
import { useProfile } from '../../../../hooks/useProfile'
import { useNavigate } from 'react-router-dom'
import {
    LayoutDashboard,
    BookOpen,
    Users,
    Calendar,
    Settings,
    Plus,
    FileText,
    CheckSquare,
    ChevronRight,
    TrendingUp,
    Users2,
    BookMarked,
    Clock,
    MessageSquare,
    Bell,
    GraduationCap,
    Presentation,
    Printer,
    ArrowUpRight,
    CalendarDays
} from 'lucide-react'
import { useChat } from '../../../../hooks/useChat'
import { supabase } from '../../../../lib/supabase'
import { AttendanceWidget } from '../AttendanceWidget'
import { StudentSelectionModal } from './StudentSelectionModal'

export const IndependentDashboard = () => {
    const { data: tenant } = useTenant()
    const { profile } = useProfile()
    const navigate = useNavigate()
    const [currentTime, setCurrentTime] = useState(new Date())

    const { rooms, loading: chatLoading } = useChat()
    const [announcements, setAnnouncements] = useState<any[]>([])
    const [upcomingClasses, setUpcomingClasses] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isReportModalOpen, setIsReportModalOpen] = useState(false)

    // Dynamic Stats
    const [stats, setStats] = useState({
        groups: 0,
        students: 0,
        pending: 0
    })

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000)
        loadDashboardData()
        return () => clearInterval(timer)
    }, [tenant?.id])

    const loadDashboardData = async () => {
        if (!tenant?.id) return
        setLoading(true)
        try {
            // 1. Fetch Announcements
            const { data: annData } = await supabase
                .from('school_announcements')
                .select('*')
                .eq('tenant_id', tenant.id)
                .order('created_at', { ascending: false })
                .limit(3)
            setAnnouncements(annData || [])

            // 2. Fetch Todays Schedule
            const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
            const currentDay = days[new Date().getDay()]
            const { data: schedData } = await supabase
                .from('schedules')
                .select(`
                    id, start_time, end_time, 
                    group:groups(grade, section),
                    subject:subject_catalog(name)
                `)
                .eq('tenant_id', tenant.id)
                .eq('day_of_week', currentDay)
                .order('start_time')

            setUpcomingClasses(schedData || [])

            // 3. Fetch Professional Stats
            const [groupsRes, studentsRes] = await Promise.all([
                supabase
                    .from('groups')
                    .select('*', { count: 'exact', head: true })
                    .eq('tenant_id', tenant.id),
                supabase
                    .from('students')
                    .select('*', { count: 'exact', head: true })
                    .eq('tenant_id', tenant.id)
            ])

            // Calculate pending (for now: subjects without plans in this tenant)
            const { count: pendingPlans } = await supabase
                .from('group_subjects')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenant.id)
            // This is a simplified logic for "pending", could be refined later

            setStats({
                groups: groupsRes.count || 0,
                students: studentsRes.count || 0,
                pending: pendingPlans || 0
            })

        } catch (error) {
            console.error('Error loading dashboard:', error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-1000 pb-20 px-4 sm:px-6">

            {/* 1. Header & Quick Actions */}
            <header className="relative overflow-hidden bg-slate-900 rounded-[3rem] p-8 sm:p-12 text-white shadow-2xl shadow-indigo-900/20">
                {/* Visual Accent */}
                <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-indigo-500/20 to-transparent skew-x-12 translate-x-1/4 pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <span className="px-3 py-1 bg-indigo-500/20 border border-indigo-400/30 rounded-full text-[10px] font-black uppercase tracking-widest text-indigo-300 backdrop-blur-md">
                                Aula Privada Activa
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {currentTime.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </span>
                        </div>
                        <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
                            {currentTime.getHours() < 12 ? 'Buenos días' : currentTime.getHours() < 19 ? 'Buenas tardes' : 'Buenas noches'},<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-purple-300">
                                {profile?.first_name || 'Profesor'}
                            </span>
                        </h1>
                    </div>

                    <div className="flex flex-wrap gap-4">
                        <button
                            onClick={() => navigate('/gradebook')}
                            className="bg-indigo-600 text-white px-12 py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-3 shadow-xl shadow-indigo-500/20 group transform hover:scale-105"
                        >
                            <CheckSquare className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            Libreta
                        </button>
                        <button
                            onClick={() => {
                                if (profile?.is_demo) {
                                    alert('Modo Demo: La impresión de reportes está deshabilitada.')
                                    return
                                }
                                setIsReportModalOpen(true)
                            }}
                            className="bg-white text-slate-900 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-3 shadow-xl group border border-slate-100"
                        >
                            <Printer className="w-4 h-4 text-indigo-600 group-hover:rotate-12 transition-transform" />
                            Informe Alumno
                        </button>
                    </div>
                </div>
            </header >

            {/* 2. Professional Stats Row */}
            < div className="grid grid-cols-2 lg:grid-cols-4 gap-6" >
                {
                    [
                        { label: 'Grupos Activos', value: loading ? '...' : stats.groups.toString(), icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
                        { label: 'Alumnos Totales', value: loading ? '...' : stats.students.toString(), icon: GraduationCap, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                        { label: 'Clases Hoy', value: loading ? '...' : upcomingClasses.length.toString(), icon: Presentation, color: 'text-purple-600', bg: 'bg-purple-50' },
                        { label: 'Materias s/Plan', value: loading ? '...' : stats.pending.toString(), icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
                    ].map((stat, i) => (
                        <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-indigo-100/50 transition-all flex items-center gap-5 group">
                            <div className={`p-4 ${stat.bg} ${stat.color} rounded-2xl group-hover:scale-110 transition-transform`}>
                                <stat.icon className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="text-2xl font-black text-slate-900 leading-tight">
                                    {stat.value === '...' ? (
                                        <div className="h-8 w-12 bg-slate-100 animate-pulse rounded-lg" />
                                    ) : (
                                        stat.value
                                    )}
                                </div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{stat.label}</div>
                            </div>
                        </div>
                    ))
                }
            </div >

            {/* 3. Bento Layout Grid */}
            < div className="grid grid-cols-1 lg:grid-cols-3 gap-8" >

                {/* A. Main Module: Agenda (2/3 width) */}
                < div className="lg:col-span-2 space-y-8" >
                    <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                        <div className="p-8 pb-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-slate-100 rounded-2xl text-slate-900">
                                    <CalendarDays className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Tu Agenda</h3>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Gestión de clases diarias</p>
                                </div>
                            </div>
                            <button onClick={() => navigate('/schedule')} className="p-3 hover:bg-slate-50 rounded-xl transition-colors text-slate-400 group">
                                <ArrowUpRight className="w-5 h-5 group-hover:text-indigo-600" />
                            </button>
                        </div>

                        <div className="flex-1 p-8 space-y-4">
                            {upcomingClasses.length > 0 ? (
                                upcomingClasses.map((session, i) => (
                                    <div
                                        key={i}
                                        className="group p-6 rounded-[2rem] bg-slate-50 border border-slate-100 hover:bg-white hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-50 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6"
                                    >
                                        <div className="flex items-center gap-6">
                                            <div className="h-16 w-1 hover:h-20 bg-indigo-500 rounded-full transition-all" />
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{session.start_time.slice(0, 5)} - {session.end_time.slice(0, 5)}</span>
                                                    <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{session.group?.grade}° "{session.group?.section}"</span>
                                                </div>
                                                <h4 className="text-xl font-black text-slate-900 uppercase">
                                                    {session.subject?.name || 'Clase de Reforzamiento'}
                                                </h4>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => navigate('/gradebook')}
                                            className="w-full sm:w-auto px-8 py-3 bg-white border border-slate-100 rounded-2xl text-xs font-black uppercase text-slate-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                        >
                                            Evaluar
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center py-12 text-center">
                                    <div className="p-6 bg-slate-50 rounded-full mb-4">
                                        <Calendar className="w-10 h-10 text-slate-300" />
                                    </div>
                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Sin clases programadas</p>
                                    <button
                                        onClick={() => navigate('/schedule')}
                                        className="mt-6 px-6 py-3 bg-indigo-50 text-indigo-600 rounded-xl font-black text-[10px] uppercase tracking-widest border border-indigo-100 hover:bg-indigo-100 transition-all"
                                    >
                                        Configurar Horario
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div >

                {/* B. Side Bento: Chat & Community (1/3 width) */}
                < div className="space-y-8" >
                    {/* Compact Chat */}
                    < div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col" >
                        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-purple-600 rounded-xl text-white">
                                    <MessageSquare className="w-5 h-5" />
                                </div>
                                <h3 className="text-base font-black text-slate-800 tracking-tight">Tutores</h3>
                            </div>
                            <button onClick={() => navigate('/messages')} className="text-[10px] font-black text-purple-600 uppercase tracking-widest hover:underline">Chat</button>
                        </div>
                        <div className="p-6 space-y-4">
                            {rooms.slice(0, 3).map(room => (
                                <div key={room.id} onClick={() => navigate(`/messages/${room.id}`)} className="flex items-center gap-4 group cursor-pointer">
                                    <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center font-black text-slate-500 text-xs group-hover:bg-purple-100 group-hover:text-purple-600 transition-all">
                                        {room.name[0]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-slate-800 text-sm truncate">{room.name}</h4>
                                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{room.last_message?.content || 'Inicia chat'}</p>
                                    </div>
                                </div>
                            ))}
                            {rooms.length === 0 && (
                                <p className="text-center py-4 text-slate-300 font-black text-[10px] uppercase tracking-widest italic">Nada nuevo</p>
                            )}
                        </div>
                    </div >

                    {/* Compact Announcements */}
                    < div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col" >
                        <div className="p-6 border-b border-slate-50 flex items-center gap-3">
                            <div className="p-2.5 bg-amber-500 rounded-xl text-white">
                                <Bell className="w-5 h-5" />
                            </div>
                            <h3 className="text-base font-black text-slate-800 tracking-tight">Comunicados</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            {announcements.map(ann => (
                                <div key={ann.id} className="p-4 bg-amber-50 rounded-2xl border border-amber-100 group hover:scale-[1.02] transition-transform cursor-pointer">
                                    <h4 className="font-black text-amber-900 text-xs truncate uppercase tracking-tighter">{ann.title}</h4>
                                    <p className="text-[10px] text-amber-800/70 mt-1 line-clamp-1">{ann.content}</p>
                                </div>
                            ))}
                            {announcements.length === 0 && (
                                <p className="text-center py-4 text-slate-300 font-black text-[10px] uppercase tracking-widest italic">Sin avisos</p>
                            )}
                        </div>
                    </div >
                </div >
            </div >

            {/* Modal Components */}
            < StudentSelectionModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
            />
        </div >
    )
}
