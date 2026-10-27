import { useEffect, useState } from 'react'
import { FamilyAccessCard } from '../../../family/components/FamilyAccessCard'
import { Link } from 'react-router-dom'
import { EmergencyPhonesForm } from '../../../family/components/EmergencyPhonesForm'
import {
    Users, GraduationCap, Calendar, Mail, Star, Clock,
    Loader2, AlertCircle, CheckCircle2, Info, Bell
} from 'lucide-react'
import { AcademicAlerts } from './AcademicAlerts'
import { PendingBySubject } from '../tutor/PendingBySubject'
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
    const [showPhones, setShowPhones] = useState(false)
    const [showAccess, setShowAccess] = useState(false)

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
                    .select('student_id, student:students(id, first_name, last_name_paternal, group_id, group:groups(grade, section))')
                    .eq('user_id', user.id)

                if (guardError) {
                    console.error('Error fetching guardianship:', guardError)
                    setLoading(false)
                    return
                }

                const students = (guardianship?.map((g: any) => g.student) || []).filter(Boolean)
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
        // Evita que la respuesta de un hijo anterior pise la del hijo recién elegido
        let cancelled = false

        const loadChildData = async () => {
            if (!selectedChild || !tenant) return
            const groupId: string | null = selectedChild.group_id ?? null

            // Limpiar lo del hijo anterior mientras carga el nuevo
            setStats({ average: 0, attendance: 100 })
            setAgenda([])
            setPendingActivities([])

            // 2. Get Average Grade
            const { data: grades } = await supabase
                .from('grades')
                .select('score')
                .eq('student_id', selectedChild.id)
                .eq('is_graded', true)
                .not('score', 'is', null)

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

            if (cancelled) return
            setStats({ average: avg, attendance: attPercentage })

            // Sin grupo asignado no hay tareas que mostrar
            if (!groupId) {
                setAgenda([])
                setPendingActivities([])
            }

            // 4. Get Agenda
            const today = new Date().toISOString()
            const { data: assignments } = await supabase
                .from('assignments')
                .select('title, due_date, type')
                .eq('tenant_id', tenant.id)
                .eq('group_id', groupId ?? '00000000-0000-0000-0000-000000000000')
                .gte('due_date', today)
                .order('due_date', { ascending: true })
                .limit(5)

            if (cancelled) return
            setAgenda(assignments || [])

            // 5. Get Announcements
            const { data: messages } = await supabase
                .from('school_announcements')
                .select('title, created_at, content')
                .eq('tenant_id', tenant.id)
                .order('created_at', { ascending: false })
                .limit(3)


            if (cancelled) return
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
                .eq('group_id', groupId ?? '00000000-0000-0000-0000-000000000000')
                .gte('due_date', thirtyDaysAgo.toISOString())
                .lte('due_date', nextWeek.toISOString())
                .order('due_date', { ascending: true })

            const { data: studentGrades } = await supabase
                .from('grades')
                .select('assignment_id, is_graded, delivered_at')
                .eq('student_id', selectedChild.id)

            // Pendiente = ni calificada ni entregada
            const byAssignment = new Map((studentGrades || []).map((g: any) => [g.assignment_id, g]))
            const pending = (allAssignments || []).filter((asm: any) => {
                const grade: any = byAssignment.get(asm.id)
                return !grade || (!grade.is_graded && !grade.delivered_at)
            })

            if (cancelled) return
            setPendingActivities(pending)
        }

        if (selectedChild) {
            loadChildData()
        }
        return () => { cancelled = true }
    }, [selectedChild?.id, tenant?.id])

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
                <h2 className="text-xl font-bold text-gray-900">Aún no ligas a tu hijo(a)</h2>
                <p className="text-gray-600 mt-2">Escribe el código que viene en la hoja que te dio la escuela.</p>
                <Link to="/familia" className="inline-flex mt-5 px-5 py-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-black text-sm">Escribir el código</Link>
                <p className="text-xs text-gray-500 mt-4">¿No tienes la hoja? Pídela en control escolar.</p>
            </div>
        )
    }

    return (
        <div className="space-y-4 md:space-y-8 animate-in fade-in duration-1000 pb-20 px-3 md:px-4">
            {/* Encabezado compacto */}
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
                <h1 className="text-xl md:text-3xl font-black text-gray-900 tracking-tight leading-tight">Panel del tutor</h1>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs md:text-sm font-bold">
                    <Link to="/familia" className="text-rose-600 hover:underline">+ Agregar hijo(a)</Link>
                    <button type="button" onClick={() => setShowPhones(v => !v)} className="text-slate-600 hover:underline">
                        {showPhones ? 'Ocultar mis teléfonos' : 'Mis teléfonos de emergencia'}
                    </button>
                    <button type="button" onClick={() => setShowAccess(v => !v)} className="text-slate-600 hover:underline">
                        {showAccess ? 'Ocultar cuentas de mi familia' : 'Cuentas de mi familia'}
                    </button>
                </div>
            </div>

            {/* El acceso de la familia no es lo prioritario: solo un aviso de una línea si hay algo que atender */}
            {showAccess ? <FamilyAccessCard /> : <FamilyAccessCard variant="notice" onOpen={() => setShowAccess(true)} />}
            {showPhones && (
                <div className="max-w-md">
                    <EmergencyPhonesForm onSaved={() => setShowPhones(false)} />
                </div>
            )}
            <div className="hidden">
            </div>

            {/* Selector de hijos: fila compacta */}
            {children.length > 1 && (
                <div role="tablist" aria-label="Mis hijos" className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                    {children.map(child => {
                        const active = selectedChild?.id === child.id
                        return (
                            <button
                                key={child.id}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => setSelectedChild(child)}
                                className={`shrink-0 flex items-center gap-2 pl-2 pr-4 py-2 rounded-2xl border-2 text-left transition-colors ${active ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-800 hover:border-blue-300'}`}
                            >
                                <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${active ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>
                                    <GraduationCap className="w-5 h-5" />
                                </span>
                                <span className="leading-tight">
                                    <span className="block text-sm font-black">{child.first_name}</span>
                                    <span className={`block text-[11px] font-bold ${active ? 'text-blue-100' : 'text-slate-500'}`}>
                                        {child.group ? `${child.group.grade}° ${child.group.section}` : 'Sin grupo'}
                                    </span>
                                </span>
                            </button>
                        )
                    })}
                </div>
            )}

            {/* Hijo seleccionado: nombre, grupo, promedio y asistencia en una franja */}
            {selectedChild && (
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-4 md:p-6 text-white shadow-lg shadow-blue-500/20">
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-[11px] md:text-xs font-bold text-blue-100 uppercase tracking-widest">
                                {selectedChild.group ? `${selectedChild.group.grade}° ${selectedChild.group.section}` : 'Sin grupo'}
                            </p>
                            <h2 className="text-xl md:text-3xl font-black tracking-tight leading-tight truncate">
                                {selectedChild.first_name} {selectedChild.last_name_paternal}
                            </h2>
                        </div>
                        <div className="flex gap-2 shrink-0">
                            <div className="bg-white/15 rounded-2xl px-3 py-2 md:px-5 md:py-3 text-center min-w-[72px]">
                                <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-blue-100">Promedio</p>
                                <p className="text-xl md:text-2xl font-black leading-none mt-0.5">{stats.average.toFixed(1)}</p>
                            </div>
                            <div className="bg-white/15 rounded-2xl px-3 py-2 md:px-5 md:py-3 text-center min-w-[72px]">
                                <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-blue-100">Asistencia</p>
                                <p className="text-xl md:text-2xl font-black leading-none mt-0.5">{stats.attendance}%</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Lo que más le importa al tutor: qué falta entregar y las alertas, agrupado por materia */}
            <section className="space-y-2">
                <div className="flex items-baseline justify-between gap-2 px-1">
                    <h3 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight">Actividades sin entregar</h3>
                    {pendingActivities.length > 0 && (() => {
                        const late = pendingActivities.filter((p: any) => new Date(p.due_date) < new Date()).length
                        return (
                            <span className="text-xs md:text-sm font-bold text-slate-500 shrink-0">
                                {pendingActivities.length}{late > 0 && <span className="text-rose-700"> · {late} {late === 1 ? 'atrasada' : 'atrasadas'}</span>}
                            </span>
                        )
                    })()}
                </div>
                <PendingBySubject items={pendingActivities} />
            </section>

            {selectedChild && (
                <section>
                    <AcademicAlerts studentId={selectedChild.id} />
                </section>
            )}

            {/* SECTION 2: ALERTAS Y SEGUIMIENTO (Real-time logs) */}
            {(alerts.length > 0 || unreadCount > 0) && (
                <div className="bg-white p-6 md:p-10 rounded-[4rem] shadow-[0_40px_80px_-15px_rgba(0,0,0,0.08)] border-4 border-slate-50 animate-in slide-in-from-bottom-12 duration-1000">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-10">
                        <div className="flex items-center gap-4">
                            <div className="p-4 bg-rose-100 text-rose-600 rounded-[1.5rem] shadow-inner animate-bounce-slow">
                                <Bell className="w-8 h-8 stroke-[3]" />
                            </div>
                            <div>
                                <h3 className="text-2xl sm:text-4xl font-black text-gray-900 tracking-tight">Bitácora de Alertas</h3>
                                <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Seguimiento de comportamiento y logros</p>
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
                            <div className="bg-white/50 p-6 sm:p-12 rounded-[1.75rem] sm:rounded-[2.5rem] text-center border-2 border-dashed border-slate-200">
                                <p className="text-gray-500 font-black italic">Sin tareas próximas en agenda.</p>
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
                            <p className="text-gray-500 italic text-sm">No hay avisos recientes.</p>
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
                <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-inner ${isCompliance ? (isFulfilled ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600')
                    : 'bg-blue-100 text-blue-600'
                    }`}>
                    {isCompliance ? (isFulfilled ? <CheckCircle2 className="w-8 h-8 stroke-[2.5]" /> : <AlertCircle className="w-8 h-8 stroke-[2.5]" />) : <Info className="w-8 h-8 stroke-[2.5]" />}
                </div>

                <div className="space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
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
    <div className="flex flex-col md:flex-row items-center justify-between p-6 bg-white rounded-[1.75rem] sm:rounded-[2.5rem] border-4 border-slate-100 hover:border-blue-200 transition-all active:scale-95 shadow-md shadow-slate-200/50 group cursor-pointer gap-4">
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
    <div className="p-5 sm:p-8 bg-white hover:bg-cyan-600 rounded-[1.75rem] sm:rounded-[2.5rem] transition-all cursor-pointer group border-4 border-transparent hover:border-cyan-400 active:scale-95 shadow-lg shadow-cyan-900/5">
        <p className="text-xs font-black text-cyan-400 group-hover:text-white/80 uppercase tracking-widest mb-3 leading-none">{date}</p>
        <h5 className="text-xl font-black text-slate-900 group-hover:text-white leading-tight tracking-tight">{title}</h5>
    </div>
)
