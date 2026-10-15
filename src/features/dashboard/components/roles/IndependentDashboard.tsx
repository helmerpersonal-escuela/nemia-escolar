import { loadDayContext, adjustClasses, isoDate, type SpecialDay } from '../../../../lib/specialDays'
import { SpecialDayBanner } from '../../../../components/schedule/SpecialDayBanner'

import { useState, useEffect } from 'react'
import { useTenant } from '../../../../hooks/useTenant'
import { useProfile } from '../../../../hooks/useProfile'
import { useNavigate } from 'react-router-dom'
import {
    Users,
    Calendar,
    CheckSquare,
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
import { StudentSelectionModal } from './StudentSelectionModal'
import { ContinuousImprovementCard } from '../../../../components/academic/ContinuousImprovementCard'
import { FirstSteps } from '../FirstSteps'

export const IndependentDashboard = () => {
    const { data: tenant } = useTenant()
    const { profile } = useProfile()
    const navigate = useNavigate()
    const [currentTime, setCurrentTime] = useState(new Date())

    const { rooms, loading: chatLoading } = useChat()
    const [announcements, setAnnouncements] = useState<any[]>([])
    const [upcomingClasses, setUpcomingClasses] = useState<any[]>([])
    const [specialDay, setSpecialDay] = useState<SpecialDay | null>(null)
    const [suspendedCount, setSuspendedCount] = useState(0)
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

            // Día con horario especial: ajusta horarios y quita las clases suspendidas
            const { special, standard } = await loadDayContext(tenant.id, isoDate(new Date()))
            setSpecialDay(special)
            const adjusted = adjustClasses((schedData || []) as any[], special, standard)
            setSuspendedCount(adjusted.filter(c => c.status === 'cancelled').length)
            setUpcomingClasses(adjusted.filter(c => c.status !== 'cancelled'))

            // 3. Fetch Professional Stats
            const [groupsRes, studentsRes] = await Promise.all([
                supabase
                    .from('groups')
                    .select('*', { count: 'exact', head: true })
                    .eq('tenant_id', tenant.id).is('archived_at', null),
                supabase
                    .from('students')
                    .select('*', { count: 'exact', head: true })
                    .eq('tenant_id', tenant.id).or('status.is.null,status.not.in.(GRADUATED,INACTIVE)')
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
            <FirstSteps />
            <SpecialDayBanner special={specialDay} suspended={suspendedCount} />

            {/* 1. Saludo compacto y accesos rápidos */}
            <header className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 sm:p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="min-w-0">
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                            {currentTime.getHours() < 12 ? 'Buenos días' : currentTime.getHours() < 19 ? 'Buenas tardes' : 'Buenas noches'},{' '}
                            <span className="text-indigo-600">{profile?.first_name || 'Profesor'}</span>
                        </h1>
                        <p className="mt-0.5 text-xs sm:text-sm text-slate-500 font-medium truncate">
                            <span className="capitalize">{currentTime.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' })}</span> · Aula privada
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 md:flex md:gap-3 shrink-0">
                        <button
                            onClick={() => navigate('/gradebook?tab=EVALUATION')}
                            className="flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 min-h-[56px] md:min-h-[44px] px-2 md:px-4 rounded-2xl text-[11px] sm:text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                        >
                            <CheckSquare className="w-5 h-5 md:w-4 md:h-4" />
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
                            className="flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 min-h-[56px] md:min-h-[44px] px-2 md:px-4 rounded-2xl text-[11px] sm:text-xs font-bold bg-slate-50 text-slate-800 border border-slate-100 hover:bg-indigo-50 transition-colors"
                        >
                            <Printer className="w-5 h-5 md:w-4 md:h-4 text-indigo-600" />
                            Informe alumno
                        </button>
                    </div>
                </div>
            </header>


            {/* 2. Lo del día: agenda y clases */}
            < div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8" >

                {/* A. Main Module: Agenda (2/3 width) */}
                < div className="lg:col-span-2 space-y-8" >
                    <div className="bg-white rounded-[2rem] sm:rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                        <div className="p-8 pb-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-slate-100 rounded-2xl text-slate-900">
                                    <CalendarDays className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Tu Agenda</h3>
                                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mt-0.5">Gestión de clases diarias</p>
                                </div>
                            </div>
                            <button onClick={() => navigate('/schedule')} className="p-3 hover:bg-slate-50 rounded-xl transition-colors text-slate-500 group">
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
                                                    <span className="text-[11px] font-black text-indigo-600 uppercase tracking-widest">{session.start_time.slice(0, 5)} - {session.end_time.slice(0, 5)}</span>
                                                    <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{session.group?.grade}° "{session.group?.section}"</span>
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
                                    <p className="text-slate-600 font-bold text-sm">Aún no tienes clases en tu horario</p>
                                    <p className="text-slate-500 text-sm mt-1 max-w-xs">Captúralo una vez y aquí verás qué clase sigue cada día.</p>
                                    <button
                                        onClick={() => navigate('/schedule')}
                                        className="mt-6 px-6 py-3 bg-indigo-50 text-indigo-600 rounded-xl font-black text-[11px] uppercase tracking-widest border border-indigo-100 hover:bg-indigo-100 transition-all"
                                    >
                                        Capturar mi horario
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div >

                {/* B. Side Bento: Chat & Community (1/3 width) */}
                < div className="space-y-8" >
                    {/* Compact Chat */}
                    < div className="bg-white rounded-[2rem] sm:rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col" >
                        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-purple-600 rounded-xl text-white">
                                    <MessageSquare className="w-5 h-5" />
                                </div>
                                <h3 className="text-base font-black text-slate-800 tracking-tight">Tutores</h3>
                            </div>
                            <button onClick={() => navigate('/messages')} className="text-[11px] font-black text-purple-600 uppercase tracking-widest hover:underline">Chat</button>
                        </div>
                        <div className="p-6 space-y-4">
                            {rooms.slice(0, 3).map(room => (
                                <div key={room.id} onClick={() => navigate(`/messages/${room.id}`)} className="flex items-center gap-4 group cursor-pointer">
                                    <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center font-black text-slate-500 text-xs group-hover:bg-purple-100 group-hover:text-purple-600 transition-all">
                                        {room.name[0]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-slate-800 text-sm truncate">{room.name}</h4>
                                        <p className="text-[11px] text-slate-500 truncate mt-0.5">{room.last_message?.content || 'Inicia chat'}</p>
                                    </div>
                                </div>
                            ))}
                            {rooms.length === 0 && (
                                <p className="text-center py-4 text-slate-300 font-black text-[11px] uppercase tracking-widest italic">Nada nuevo</p>
                            )}
                        </div>
                    </div >

                    {/* Compact Announcements */}
                    < div className="bg-white rounded-[2rem] sm:rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col" >
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
                                    <p className="text-[11px] text-amber-800/70 mt-1 line-clamp-1">{ann.content}</p>
                                </div>
                            ))}
                            {announcements.length === 0 && (
                                <p className="text-center py-4 text-slate-300 font-black text-[11px] uppercase tracking-widest italic">Sin avisos</p>
                            )}
                        </div>
                    </div >
                </div >
            </div >

            {/* 3. Resumen (después de lo del día) */}
            < div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6" >
                {
                    [
                        { label: 'Grupos Activos', value: loading ? '...' : stats.groups.toString(), icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
                        { label: 'Alumnos Totales', value: loading ? '...' : stats.students.toString(), icon: GraduationCap, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                        { label: 'Clases Hoy', value: loading ? '...' : upcomingClasses.length.toString(), icon: Presentation, color: 'text-purple-600', bg: 'bg-purple-50' },
                        { label: 'Materias s/Plan', value: loading ? '...' : stats.pending.toString(), icon: Clock, color: 'text-amber-700', bg: 'bg-amber-50' },
                    ].map((stat, i) => (
                        <div key={i} className="bg-white p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-indigo-100/50 transition-all flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-5 group min-w-0">
                            <div className={`p-3 sm:p-4 ${stat.bg} ${stat.color} rounded-2xl group-hover:scale-110 transition-transform`}>
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
                                <div className="text-[11px] font-black text-slate-500 uppercase tracking-wider sm:tracking-widest mt-0.5">{stat.label}</div>
                            </div>
                        </div>
                    ))
                }
            </div >

            {/* 4. Mejora continua: al final, no es de uso diario */}
            <ContinuousImprovementCard />

            {/* Modal Components */}
            < StudentSelectionModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
            />
        </div >
    )
}
