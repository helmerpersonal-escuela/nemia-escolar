
import { useState, useEffect } from 'react'
import { useTenant } from '../../../hooks/useTenant'
import { supabase } from '../../../lib/supabase'
import { useNavigate, Link } from 'react-router-dom'
import { useChat } from '../../../hooks/useChat'
import {
    Clock, Users, CheckSquare, Coffee, ArrowRight, Calendar, Settings,
    BookOpen, ClipboardList, MessageSquare, Bell, ChevronRight,
    Printer, Plus, ArrowUpRight, GraduationCap, Presentation
} from 'lucide-react'
import { CreateAssignmentModal } from '../components/CreateAssignmentModal'
import { DayScheduleModal } from '../../schedule/components/DayScheduleModal'
import { AttendanceWidget } from '../../dashboard/components/AttendanceWidget'
import { StudentSelectionModal } from '../../dashboard/components/roles/StudentSelectionModal'
import { CTEAgendaModal } from '../../dashboard/components/CTE/CTEAgendaModal'

export const TeacherDashboard = () => {
    const { data: tenant } = useTenant()
    const navigate = useNavigate()

    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [currentClass, setCurrentClass] = useState<any>(null)

    // Security Check
    useEffect(() => {
        if (!loading && tenant && !['TEACHER', 'INDEPENDENT_TEACHER', 'SUPER_ADMIN'].includes(tenant.role || '')) {
            navigate('/')
        }
    }, [tenant, loading])

    const { rooms } = useChat()
    const [announcements, setAnnouncements] = useState<any[]>([])

    const [nextClass, setNextClass] = useState<any>(null)
    const [currentBreak, setCurrentBreak] = useState<any>(null)
    const [timelineItems, setTimelineItems] = useState<any[]>([])
    const [selectedDate] = useState(new Date())
    const [currentTime, setCurrentTime] = useState(new Date())

    // Modal State
    const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false)
    const [selectedClassForAssignment, setSelectedClassForAssignment] = useState<any>(null)
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
    const [isReportModalOpen, setIsReportModalOpen] = useState(false)
    const [isAgendaModalOpen, setIsAgendaModalOpen] = useState(false)

    // Update time every minute
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000)
        return () => clearInterval(timer)
    }, [])

    // Onboarding State
    const [hasGroups, setHasGroups] = useState<boolean | null>(null)

    const [error, setError] = useState<string | null>(null)

    const loadData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            if (!profile) {
                const { data: profileData, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).single()
                if (profileError) throw profileError
                setProfile(profileData)
            }

            if (tenant?.id) {
                // Check if user has any groups (for onboarding)
                const { count, error: countError } = await supabase
                    .from('groups')
                    .select('*', { count: 'exact', head: true })
                    .eq('tenant_id', tenant.id)

                if (countError) throw countError

                if (count === 0) {
                    setHasGroups(false)
                    setLoading(false)
                    return
                } else {
                    setHasGroups(true)
                }

                const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
                const currentDay = days[selectedDate.getDay()]

                // Fetch Schedule for Today
                const { data: fullSchedule, error: scheduleError } = await supabase
                    .from('schedules')
                    .select(`
                        id, group_id, subject_id, start_time, end_time, custom_subject,
                        group:groups(id, grade, section),
                        subject:subject_catalog(id, name)
                    `)
                    .eq('tenant_id', tenant.id)
                    .eq('day_of_week', currentDay)
                    .order('start_time')

                if (scheduleError) throw scheduleError

                // Fetch Breaks
                const { data: settingsData, error: settingsError } = await supabase
                    .from('schedule_settings')
                    .select('breaks')
                    .eq('tenant_id', tenant.id)
                    .maybeSingle()

                if (settingsError) throw settingsError

                let combinedTimeline: any[] = []

                if (fullSchedule) {
                    const scheduleWithDetails = fullSchedule.map((item: any) => ({
                        ...item,
                        start_time: item.start_time.slice(0, 5),
                        end_time: item.end_time.slice(0, 5),
                        type: 'class',
                        group: Array.isArray(item.group) ? item.group[0] : item.group,
                        subject: Array.isArray(item.subject) ? item.subject[0] : item.subject
                    }))
                    combinedTimeline = [...scheduleWithDetails]
                }

                if (settingsData?.breaks) {
                    const breaks: any[] = typeof settingsData.breaks === 'string' ? JSON.parse(settingsData.breaks) : settingsData.breaks
                    combinedTimeline = [
                        ...combinedTimeline,
                        ...breaks.map(b => ({ ...b, start_time: b.start_time.slice(0, 5), end_time: b.end_time.slice(0, 5), type: 'break' }))
                    ]
                }

                combinedTimeline.sort((a, b) => a.start_time.localeCompare(b.start_time))
                setTimelineItems(combinedTimeline)

                const nowStr = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })

                const activeClass = combinedTimeline.find(item => item.type === 'class' && nowStr >= item.start_time && nowStr < item.end_time)
                setCurrentClass(activeClass || null)

                const activeBreak = combinedTimeline.find(item => item.type === 'break' && nowStr >= item.start_time && nowStr < item.end_time)
                setCurrentBreak(activeBreak || null)

                const next = combinedTimeline.find(item => item.type === 'class' && item.start_time > nowStr)
                setNextClass(next || null)

                // 3. Fetch Announcements
                const { data: annData } = await supabase
                    .from('school_announcements')
                    .select('*')
                    .eq('tenant_id', tenant.id)
                    .order('created_at', { ascending: false })
                    .limit(3)
                setAnnouncements(annData || [])
            }
        } catch (err: any) {
            console.error('TeacherDashboard loadData error:', err)
            setError(err.message || 'Error cargando datos')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadData() }, [tenant?.id, selectedDate])

    // Realtime Check
    useEffect(() => {
        if (loading) return
        const nowStr = currentTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })

        const activeClass = timelineItems.find(item => item.type === 'class' && nowStr >= item.start_time && nowStr < item.end_time)
        setCurrentClass(activeClass || null)

        const activeBreak = timelineItems.find(item => item.type === 'break' && nowStr >= item.start_time && nowStr < item.end_time)
        setCurrentBreak(activeBreak || null)

        const next = timelineItems.find(item => item.type === 'class' && item.start_time > nowStr)
        setNextClass(next || null)

    }, [currentTime, timelineItems])


    if (loading) return <div className="p-8">Cargando...</div>
    if (error) return <div className="p-8 text-red-600">Error: {error}</div>

    return (
        <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-1000 pb-20 px-4 sm:px-6">

            {/* 1. Header & Quick Actions */}
            <header className="relative overflow-hidden bg-slate-900 rounded-[2.5rem] sm:rounded-[3rem] p-6 sm:p-12 text-white shadow-2xl">
                {/* Background Pattern */}
                <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-500/20 to-transparent skew-x-12 translate-x-1/4 pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <span className="px-3 py-1 bg-blue-500/20 border border-blue-400/30 rounded-full text-[10px] font-black uppercase tracking-widest text-blue-300 backdrop-blur-md">
                                {tenant?.name || 'Escuela'}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {currentTime.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </span>
                        </div>
                        <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
                            {currentTime.getHours() < 12 ? 'Buenos días' : currentTime.getHours() < 19 ? 'Buenas tardes' : 'Buenas noches'},<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-indigo-300">
                                {profile?.first_name || 'Profesor'}
                            </span>
                        </h1>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={() => navigate('/groups')}
                            className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-3 shadow-xl group btn-tactile"
                        >
                            <BookOpen className="w-4 h-4 group-hover:scale-110 transition-transform" />
                            Libreta
                        </button>
                        <button
                            onClick={() => setIsReportModalOpen(true)}
                            className="bg-white text-slate-900 px-4 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-3 shadow-xl group border border-slate-100 btn-tactile"
                        >
                            <Printer className="w-4 h-4 text-blue-600 group-hover:rotate-12 transition-transform" />
                            Informe Alumno
                        </button>
                        {tenant?.type !== 'INDEPENDENT' && (
                            <button
                                onClick={() => setIsAgendaModalOpen(true)}
                                className="bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-3 shadow-xl group btn-tactile"
                            >
                                <ClipboardList className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                Agenda CTE
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <CTEAgendaModal
                isOpen={isAgendaModalOpen}
                onClose={() => setIsAgendaModalOpen(false)}
                canEdit={false}
            />

            {/* 2. Top Tier Widgets */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Attendance Widget (Large) */}
                {tenant?.type !== 'INDEPENDENT' && (
                    <div className="lg:col-span-1">
                        <AttendanceWidget />
                    </div>
                )}

                {/* Main Action Card (Contextual) */}
                <div className={`lg:col-span-${tenant?.type === 'INDEPENDENT' ? '2' : '2'} space-y-6`}>
                    {currentClass ? (
                        <div className="bg-blue-600 rounded-[3rem] p-8 text-white shadow-2xl shadow-blue-200 relative overflow-hidden h-full flex flex-col justify-between squishy-card border-none">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />

                            <div>
                                <div className="flex justify-between items-center mb-6">
                                    <span className="px-3 py-1 bg-white/20 border border-white/30 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
                                        En Curso Ahora
                                    </span>
                                    <span className="text-blue-100 font-black text-xs flex items-center gap-2">
                                        <Clock className="w-4 h-4" />
                                        {currentClass.start_time} - {currentClass.end_time}
                                    </span>
                                </div>
                                <h2 className="text-4xl font-black leading-tight mb-2 uppercase">
                                    {currentClass.subject?.name || currentClass.custom_subject || 'Clase Actual'}
                                </h2>
                                <p className="text-blue-100 flex items-center gap-2 font-bold text-lg">
                                    <Users className="w-6 h-6 opacity-50" />
                                    Grupo {currentClass.group?.grade}° "{currentClass.group?.section}"
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-8">
                                <Link
                                    to={`/gradebook?groupId=${currentClass.group_id}&subjectId=${currentClass.subject_id}`}
                                    className="flex items-center justify-center gap-3 p-4 bg-white/10 hover:bg-white text-white hover:text-blue-600 rounded-2xl font-black text-xs uppercase transition-all backdrop-blur-md border border-white/20 btn-tactile"
                                >
                                    <CheckSquare className="w-4 h-4" />
                                    Evaluar
                                </Link>
                                <button
                                    onClick={() => {
                                        setSelectedClassForAssignment(currentClass)
                                        setIsAssignmentModalOpen(true)
                                    }}
                                    className="flex items-center justify-center gap-3 p-4 bg-white text-blue-600 hover:bg-blue-50 rounded-2xl font-black text-xs uppercase transition-all shadow-xl btn-tactile"
                                >
                                    <Plus className="w-4 h-4" />
                                    Nueva Actividad
                                </button>
                            </div>
                        </div>
                    ) : currentBreak ? (
                        <div className="bg-emerald-500 rounded-[3rem] p-12 text-white shadow-2xl shadow-emerald-200 flex flex-col items-center justify-center text-center h-full squishy-card border-none">
                            <div className="p-6 bg-white/20 rounded-full mb-6">
                                <Coffee className="w-12 h-12" />
                            </div>
                            <h2 className="text-4xl font-black mb-4 uppercase tracking-tight">Tiempo de Receso</h2>
                            <p className="text-emerald-100 font-bold">
                                Tu siguiente clase comienza a las <span className="bg-white/20 px-3 py-1 rounded-lg ml-2">{currentBreak.end_time}</span>
                            </p>
                        </div>
                    ) : (
                        <div className="squishy-card p-12 text-center border-2 border-dashed border-slate-200 h-full flex flex-col items-center justify-center">
                            <div className="p-6 bg-slate-50 rounded-full mb-6">
                                <Clock className="w-12 h-12 text-slate-300" />
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 mb-2 uppercase">Sin clase programada</h2>
                            <p className="text-slate-400 font-bold mb-8">Disfruta tu tiempo o adelanta planeaciones.</p>

                            {nextClass && (
                                <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 text-left flex items-center justify-between w-full max-w-sm group hover:scale-105 transition-transform cursor-pointer btn-tactile">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Próxima Clase</p>
                                        <p className="font-black text-slate-900 uppercase">
                                            {nextClass.subject?.name || nextClass.custom_subject}
                                        </p>
                                        <p className="text-xs font-bold text-slate-500 mt-1">
                                            {nextClass.start_time} • {nextClass.group?.grade}° {nextClass.group?.section}
                                        </p>
                                    </div>
                                    <div className="p-3 bg-white rounded-xl shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all">
                                        <ArrowRight className="w-5 h-5" />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* 3. Bottom Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Recent Chats */}
                <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-purple-600 rounded-2xl text-white shadow-lg shadow-purple-100">
                                <MessageSquare className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-800 tracking-tight">Tutores</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chat directo activo</p>
                            </div>
                        </div>
                        <Link to="/messages" className="text-[10px] font-black text-purple-600 uppercase tracking-widest hover:underline p-3 h-12 hover:bg-purple-50 rounded-xl transition-all flex items-center">Mensajes</Link>
                    </div>
                    <div className="p-6 space-y-4">
                        {rooms.slice(0, 3).map(room => (
                            <div
                                key={room.id}
                                onClick={() => navigate(`/messages/${room.id}`)}
                                className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-all cursor-pointer group border border-transparent hover:border-slate-100"
                            >
                                <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center font-black text-purple-600 text-sm group-hover:bg-purple-600 group-hover:text-white transition-all">
                                    {room.name[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-black text-slate-800 text-sm truncate">{room.name}</h4>
                                    <p className="text-[10px] text-slate-400 truncate mt-0.5 font-bold italic">"{room.last_message?.content || 'Inicia una conversación'}"</p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-purple-600 transition-colors" />
                            </div>
                        ))}
                        {rooms.length === 0 && (
                            <div className="text-center py-10 opacity-30">
                                <MessageSquare className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                                <p className="font-black text-[10px] uppercase tracking-widest text-slate-400">Sin chats recientes</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Announcements */}
                <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-8 border-b border-slate-50 flex items-center gap-4">
                        <div className="p-3 bg-amber-500 rounded-2xl text-white shadow-lg shadow-amber-100">
                            <Bell className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight">Comunicados</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Boletín institucional</p>
                        </div>
                    </div>
                    <div className="p-6 space-y-4">
                        {announcements.map(ann => (
                            <div key={ann.id} className="p-6 bg-amber-50 rounded-[2rem] border border-amber-100 group hover:scale-[1.02] transition-all cursor-pointer">
                                <h4 className="font-black text-amber-900 text-sm mb-1 uppercase tracking-tighter">{ann.title}</h4>
                                <p className="text-xs text-amber-800/70 line-clamp-2 leading-relaxed font-bold">{ann.content}</p>
                            </div>
                        ))}
                        {announcements.length === 0 && (
                            <div className="text-center py-10 opacity-30">
                                <Bell className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                                <p className="font-black text-[10px] uppercase tracking-widest text-slate-400">Sin comunicados hoy</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modals */}
            <DayScheduleModal
                isOpen={isScheduleModalOpen}
                onClose={() => setIsScheduleModalOpen(false)}
                timelineItems={timelineItems}
                currentTime={currentTime}
                currentClass={currentClass}
                currentBreak={currentBreak}
            />

            <StudentSelectionModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
            />

            {selectedClassForAssignment && (
                <CreateAssignmentModal
                    isOpen={isAssignmentModalOpen}
                    onClose={() => {
                        setIsAssignmentModalOpen(false)
                        setSelectedClassForAssignment(null)
                    }}
                    onSuccess={() => {
                        setIsAssignmentModalOpen(false)
                    }}
                    groupId={selectedClassForAssignment.group_id}
                    subjectId={selectedClassForAssignment.subject_id}
                    defaultSubjectName={selectedClassForAssignment.subject?.name || selectedClassForAssignment.custom_subject}
                />
            )}
        </div>
    )
}
