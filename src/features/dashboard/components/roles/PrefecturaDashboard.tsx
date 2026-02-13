import { useState, useEffect } from 'react'
import { ShieldAlert, UserCheck, ScrollText, AlertTriangle, Search, Plus, Clock } from 'lucide-react'
import { supabase } from '../../../../lib/supabase'
import { useTenant } from '../../../../hooks/useTenant'
import { IncidentModal } from './IncidentModal'
import { IncidentReportModal } from './IncidentReportModal'
import { AttendanceWidget } from '../AttendanceWidget'

export const PrefecturaDashboard = () => {
    const { data: tenant } = useTenant()
    const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false)
    const [selectedIncident, setSelectedIncident] = useState<any | null>(null)
    const [incidents, setIncidents] = useState<any[]>([])
    const [stats, setStats] = useState({
        todayAttendance: 0,
        todayLates: 0,
        pendingIncidents: 0
    })
    const [loading, setLoading] = useState(true)
    const [monitoringData, setMonitoringData] = useState<any[]>([])
    const [substitutionStats, setSubstitutionStats] = useState({
        activeAbsences: 0,
        pendingActivities: 0
    })

    useEffect(() => {
        if (tenant?.id) {
            fetchDashboardData()
            const timer = setInterval(fetchDashboardData, 300000) // Refresh every 5 mins
            return () => clearInterval(timer)
        }
    }, [tenant?.id])

    const [selectedDate] = useState(new Date())
    const [currentTime, setCurrentTime] = useState(new Date())

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000)
        return () => clearInterval(timer)
    }, [])

    const isCurrentModule = (start: string, end: string) => {
        const now = new Date()
        const [startH, startM] = start.split(':').map(Number)
        const [endH, endM] = end.split(':').map(Number)
        const startTime = new Date()
        startTime.setHours(startH, startM, 0)
        const endTime = new Date()
        endTime.setHours(endH, endM, 0)
        return now >= startTime && now <= endTime
    }

    const fetchDashboardData = async () => {
        if (!tenant) return

        const today = new Date().toISOString().split('T')[0]
        const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
        const dayOfWeek = days[new Date().getDay()]

        // 1. Monitoring: Fetch all schedule entries for today
        const { data: scheduleData } = await supabase
            .from('schedules')
            .select(`
                *,
                groups(grade, section),
                subject_catalog(name)
            `)
            .eq('tenant_id', tenant.id)
            .eq('day_of_week', dayOfWeek)

        // 2. Fetch assignments to know who teaches what
        const { data: assignments } = await supabase
            .from('group_subjects')
            .select(`
                group_id,
                subject_catalog_id,
                custom_name,
                teacher:profiles(first_name, last_name_paternal, last_name_maternal)
            `)
            .eq('tenant_id', tenant.id)

        // Fetch all attendance for these modules today (Global check)
        let moduleAtt: any[] = []
        try {
            const { data } = await supabase
                .from('teacher_module_attendance')
                .select('schedule_id, teacher_id')
                .eq('tenant_id', tenant.id)
                .eq('date', today)
            moduleAtt = data || []
        } catch (e) {
            console.warn('Teacher module attendance table not ready yet')
        }

        const monitoring = (scheduleData || []).map(entry => {
            // Find teacher through group_subjects
            const assignment = assignments?.find(a =>
                a.group_id === entry.group_id &&
                (a.subject_catalog_id === entry.subject_id || a.custom_name === entry.custom_subject)
            )

            const teacherNames = assignment?.teacher as any
            const fullName = teacherNames
                ? `${teacherNames.first_name || ''} ${teacherNames.last_name_paternal || ''}`.trim()
                : null

            return {
                ...entry,
                teacher_full_name: fullName,
                is_active: isCurrentModule(entry.start_time, entry.end_time),
                is_attended: moduleAtt?.some(a => a.schedule_id === entry.id)
            }
        })

        setMonitoringData(monitoring)

        // 2. Substitutions: Fetch active
        let absCount = 0
        let actCount = 0

        try {
            const { count } = await supabase
                .from('teacher_absences')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenant.id)
                .eq('status', 'PENDING')
            absCount = count || 0
        } catch (e) { }

        try {
            const { count } = await supabase
                .from('substitution_activities')
                .select('*', { count: 'exact', head: true })
                .eq('is_completed', false)
            actCount = count || 0
        } catch (e) { }

        setSubstitutionStats({
            activeAbsences: absCount,
            pendingActivities: actCount
        })

        // 3. Incidents
        const { data: incidentData } = await supabase
            .from('student_incidents')
            .select(`
                *,
                students (
                    first_name,
                    last_name_paternal,
                    last_name_maternal,
                    groups (
                        grade,
                        section
                    )
                )
            `)
            .eq('tenant_id', tenant.id)
            .order('created_at', { ascending: false })
            .limit(3)

        // 4. Daily attendance stats
        const { data: attendanceData } = await supabase
            .from('attendance')
            .select('status')
            .eq('tenant_id', tenant.id)
            .eq('date', today)

        const total = attendanceData?.length || 0
        const present = attendanceData?.filter(a => a.status === 'PRESENT').length || 0
        const lates = attendanceData?.filter(a => a.status === 'LATE').length || 0
        const attendancePct = total > 0 ? Math.round((present / total) * 100) : 0

        const { count: pendingCount } = await supabase
            .from('student_incidents')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id)
            .neq('status', 'RESOLVED')

        setIncidents(incidentData || [])
        setStats({
            todayAttendance: attendancePct,
            todayLates: lates,
            pendingIncidents: pendingCount || 0
        })
        setLoading(false)
    }

    const activeModules = monitoringData.filter(m => m.is_active)
    const unattendedGroups = activeModules.filter(m => !m.is_attended)

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMin = Math.round(diffMs / 60000)

        if (diffMin < 60) return `Hace ${diffMin} min`
        const diffHrs = Math.floor(diffMin / 60)
        if (diffHrs < 24) return `Hace ${diffHrs} h`
        return date.toLocaleDateString()
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-700 pb-12">
            {/* Welcome Section */}
            <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 flex flex-col md:flex-row items-center justify-between relative overflow-hidden mb-8">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-50 to-orange-50 opacity-50" />
                <div className="relative z-10 mb-6 md:mb-0">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-amber-100 p-2 rounded-xl">
                            <ShieldAlert className="w-6 h-6 text-amber-700" />
                        </div>
                        <h1 className="text-4xl font-black text-gray-900 tracking-tight">
                            Panel de Prefectura
                        </h1>
                    </div>
                    <p className="text-gray-600 text-lg">
                        {selectedDate.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                </div>
                <div className="relative z-10 flex gap-4">
                    <div className="text-right hidden md:block mr-4">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Hora Actual</p>
                        <p className="text-3xl font-black text-gray-900">{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <button
                        onClick={() => setIsIncidentModalOpen(true)}
                        className="px-6 py-3 bg-red-600 text-white rounded-2xl font-bold shadow-lg shadow-red-200 flex items-center hover:bg-red-700 transition-all hover:scale-105"
                    >
                        <AlertTriangle className="w-5 h-5 mr-2" /> Reportar Incidencia
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-8">
                    {/* MONITOREO EN TIEMPO REAL */}
                    <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-100 border border-slate-50">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-xl font-black text-slate-900">Módulos en Curso</h3>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Estatus actual de los grupos</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> {activeModules.length - unattendedGroups.length} Con Docente
                                </span>
                                {unattendedGroups.length > 0 && (
                                    <span className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                                        <div className="w-2 h-2 rounded-full bg-red-500" /> {unattendedGroups.length} Sin Docente
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {loading ? (
                                <div className="col-span-full py-10 text-center text-slate-400 animate-pulse font-bold text-xs uppercase tracking-widest">Cargando monitoreo...</div>
                            ) : activeModules.length > 0 ? (
                                activeModules.map(module => (
                                    <div key={module.id} className={`p-4 rounded-2xl border transition-all ${!module.is_attended ? 'bg-red-50/50 border-red-100' : 'bg-slate-50/50 border-slate-100'}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] font-black text-slate-400">{module.start_time.slice(0, 5)} - {module.end_time.slice(0, 5)}</span>
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${!module.is_attended ? 'text-red-700 bg-red-100' : 'text-emerald-700 bg-emerald-100'}`}>
                                                {module.is_attended ? 'Registrado' : 'NO REGISTRADO'}
                                            </span>
                                        </div>
                                        <h4 className="font-black text-slate-900 leading-tight">Grupo {module.groups?.grade}° "{module.groups?.section}"</h4>
                                        <p className="text-xs font-bold text-slate-500 mt-1">{module.subject_catalog?.name || module.custom_subject}</p>
                                        <p className="text-[10px] font-medium text-slate-400 mt-2 italic flex items-center gap-1">
                                            <UserCheck className="w-3 h-3" /> {module.teacher_full_name || 'Sin docente asignado'}
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-full py-10 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100">
                                    <Clock className="w-10 h-10 mx-auto mb-2 opacity-20 text-slate-400" />
                                    <p className="font-bold text-xs uppercase tracking-widest text-slate-400">Sin módulos activos en este momento</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RECIENTES E INCIDENCIAS */}
                    <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-100 border border-slate-50">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-slate-900">Bitácora de Incidencias</h3>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                <input placeholder="Buscar alumno..." className="pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm outline-none focus:ring-2 ring-blue-100" />
                            </div>
                        </div>
                        <div className="space-y-4">
                            {loading ? (
                                <div className="py-10 text-center text-slate-400 animate-pulse font-bold uppercase tracking-widest text-xs">Cargando incidencias...</div>
                            ) : incidents.length > 0 ? (
                                incidents.map(inc => (
                                    <IncidentRow
                                        key={inc.id}
                                        name={inc.students ? `${inc.students.first_name} ${inc.students.last_name_paternal}` : 'Estudiante'}
                                        group={inc.students?.groups ? `${inc.students.groups.grade}° ${inc.students.groups.section}` : '--'}
                                        type={inc.type}
                                        time={formatTime(inc.created_at)}
                                        status={inc.status}
                                        onViewReport={() => setSelectedIncident(inc)}
                                    />
                                ))
                            ) : (
                                <div className="py-10 text-center text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100">
                                    <ScrollText className="w-10 h-10 mx-auto mb-2 opacity-20" />
                                    <p className="font-bold text-xs uppercase tracking-widest">Sin incidencias recientes</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <AttendanceWidget />

                    {/* COBERTURA DE SUPLENCIAS */}
                    <div className="bg-indigo-600 p-8 rounded-[2rem] text-white shadow-xl shadow-indigo-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                                <ScrollText className="w-6 h-6" />
                            </div>
                            <h4 className="text-lg font-bold">Cobertura Activa</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest leading-none">Ausencias</p>
                                <p className="text-3xl font-black mt-1">{substitutionStats.activeAbsences}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest leading-none">Pendientes</p>
                                <p className="text-3xl font-black mt-1">{substitutionStats.pendingActivities}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => window.location.href = '/substitutions'}
                            className="w-full mt-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-white/10"
                        >
                            Ver Detalles
                        </button>
                    </div>

                    <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-100 border border-slate-50">
                        <h4 className="text-lg font-black mb-4 flex items-center">
                            <UserCheck className="w-5 h-5 mr-2 text-indigo-500" /> Control de Personal
                        </h4>
                        <div className="space-y-4">
                            <div className="p-4 bg-indigo-50 rounded-2xl flex items-center justify-between">
                                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Asistencia Hoy</span>
                                <span className="text-2xl font-black text-indigo-600">{stats.todayAttendance}%</span>
                            </div>
                            <div className="p-4 bg-amber-50 rounded-2xl flex items-center justify-between">
                                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Retardos</span>
                                <span className="text-2xl font-black text-amber-600">{stats.todayLates}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-100 border border-slate-50">
                        <h4 className="text-lg font-black mb-4 flex items-center">
                            <ShieldAlert className="w-5 h-5 mr-2 text-red-500" /> Pendientes
                        </h4>
                        <div className="space-y-4">
                            <div className="p-4 bg-red-50 rounded-2xl flex items-center justify-between">
                                <span className="text-xs font-bold text-red-700 uppercase tracking-wider">Casos Abiertos</span>
                                <span className="text-2xl font-black text-red-600">{stats.pendingIncidents}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {isIncidentModalOpen && (
                <IncidentModal
                    isOpen={isIncidentModalOpen}
                    onClose={() => setIsIncidentModalOpen(false)}
                    onSuccess={() => {
                        fetchDashboardData()
                        setIsIncidentModalOpen(false)
                    }}
                />
            )}

            {selectedIncident && (
                <IncidentReportModal
                    isOpen={!!selectedIncident}
                    onClose={() => setSelectedIncident(null)}
                    incident={selectedIncident}
                />
            )}
        </div>
    )
}

const IncidentRow = ({ name, group, type, time, status, onViewReport }: any) => {
    const typeColors: any = {
        CONDUCTA: 'text-red-600 bg-red-50',
        ACADEMICO: 'text-blue-600 bg-blue-50',
        SALUD: 'text-amber-600 bg-amber-50',
        EMOCIONAL: 'text-purple-600 bg-purple-50',
        POSITIVO: 'text-emerald-600 bg-emerald-50'
    }
    return (
        <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 group">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500">
                    {name?.[0]}
                </div>
                <div>
                    <h5 className="font-bold text-slate-900">{name} <span className="text-slate-400 ml-2">{group}</span></h5>
                    <div className="flex items-center gap-3 mt-1">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${typeColors[type] || 'text-slate-600 bg-slate-100'}`}>{type}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{time}</span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <span className={`text-[10px] font-black px-2 py-1 rounded-full ${status === 'OPEN' ? 'text-red-500 bg-red-50' : 'text-slate-400 bg-slate-100'}`}>{status}</span>
                <button
                    onClick={onViewReport}
                    className="p-2 bg-white rounded-xl shadow-sm border border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Ver Reporte"
                >
                    <Plus className="w-4 h-4 text-slate-400" />
                </button>
            </div>
        </div>
    )
}

