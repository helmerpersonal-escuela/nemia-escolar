import { useState, useEffect } from 'react'
import { ClipboardCheck, BookOpen, BarChart3, Users, Clock, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react'
import { supabase } from '../../../../lib/supabase'
import { useTenant } from '../../../../hooks/useTenant'
import { useNavigate } from 'react-router-dom'
import { CTEAgendaModal } from '../CTE/CTEAgendaModal'

export const CoordinationDashboard = () => {
    const { data: tenant } = useTenant()
    const navigate = useNavigate()
    const [currentTime, setCurrentTime] = useState(new Date())
    const [pendingPlans, setPendingPlans] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({
        pending: 0,
        approved: 0,
        total: 0
    })
    const [cteConfig, setCteConfig] = useState<{ next_date?: string, link?: string } | null>(null)
    const [isAgendaModalOpen, setIsAgendaModalOpen] = useState(false)

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        if (tenant?.id) fetchDashboardData()
    }, [tenant?.id])

    const fetchDashboardData = async () => {
        try {
            if (!tenant?.id) return

            // 1. Fetch Submitted Plans (Pending Validation)
            const { data: plans, error } = await supabase
                .from('lesson_plans')
                .select(`
                    id,
                    title,
                    status,
                    end_date,
                    group_id,
                    subject_id,
                    groups (grade, section),
                    subject_catalog (name)
                `)
                .eq('tenant_id', tenant.id)
                .eq('status', 'SUBMITTED')
                .order('end_date', { ascending: true })
                .limit(5)

            // 1b. Fetch School Details for CTE Config
            const { data: schoolDetails } = await supabase
                .from('school_details')
                .select('cte_config')
                .eq('tenant_id', tenant.id)
                .maybeSingle()

            if (schoolDetails?.cte_config) setCteConfig(schoolDetails.cte_config)

            if (error) throw error

            // 2. Resolve Teachers for these plans
            const enrichedPlans = await Promise.all((plans || []).map(async (plan: any) => {
                const { data: assignment } = await supabase
                    .from('group_subjects')
                    .select('teacher_id, profiles(first_name, last_name, avatar_url)')
                    .eq('group_id', plan.group_id)
                    .eq('subject_id', plan.subject_id)
                    .maybeSingle()

                // Handle profiles as array or object depending on Supabase response type
                const profileData = Array.isArray(assignment?.profiles)
                    ? assignment.profiles[0]
                    : assignment?.profiles

                return {
                    ...plan,
                    teacher: profileData
                        ? `${profileData.first_name} ${profileData.last_name}`
                        : 'Sin Asignar',
                    avatarUrl: profileData?.avatar_url
                }
            }))

            setPendingPlans(enrichedPlans)

            // 3. Fetch Basic Stats
            if (!tenant?.id) return

            const { count: pendingCount } = await supabase
                .from('lesson_plans')
                .select('id', { count: 'exact', head: true })
                .eq('tenant_id', tenant.id)
                .eq('status', 'SUBMITTED')

            const { count: approvedCount } = await supabase
                .from('lesson_plans')
                .select('id', { count: 'exact', head: true })
                .eq('tenant_id', tenant.id)
                .eq('status', 'APPROVED')

            setStats({
                pending: pendingCount || 0,
                approved: approvedCount || 0,
                total: (pendingCount || 0) + (approvedCount || 0)
            })

            setLoading(false)
        } catch (error) {
            console.error('Error fetching coordination data:', error)
            setLoading(false)
        }
    }


    const getNextCTE = () => {
        if (cteConfig?.next_date) return new Date(cteConfig.next_date + 'T12:00:00') // Force noon to avoid timezone issues

        // Auto-calculate: Last Friday of the current month
        const today = new Date()
        const currentMonth = today.getMonth()
        const nextMonth = currentMonth + 1
        const year = today.getFullYear()

        // Function to get last Friday of a month
        const getLastFriday = (y: number, m: number) => {
            const d = new Date(y, m + 1, 0) // Last day of month
            const day = d.getDay()
            const diff = (day + 2) % 7 // Difference to Friday (5) -> 5 is Friday. 0 is Sun, 6 is Sat.
            // If day is 5 (Fri), diff is 0. If 6 (Sat), diff is 1. If 0 (Sun), diff is 2.
            // Formula: date - ((day + 2) % 7) might not be correct relative to Friday.
            // Friday is 5.
            // If d is Fri(5), we want d.
            // If d is Sat(6), we want d-1.
            // If d is Sun(0), we want d-2.
            // ...
            // If d is Thu(4), we want d-6.

            // Simpler: iterate backwards from last day
            while (d.getDay() !== 5) {
                d.setDate(d.getDate() - 1)
            }
            return d
        }

        let nextCTE = getLastFriday(year, currentMonth)

        // If today is past the last Friday, get next month's
        if (today > nextCTE) {
            nextCTE = getLastFriday(year, nextMonth)
        }

        return nextCTE
    }

    const nextCteDate = getNextCTE()
    const daysUntilCte = Math.ceil((nextCteDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))

    return (
        <div className="space-y-6 animate-in fade-in duration-700 pb-12">
            {/* Welcome Section */}
            <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 flex flex-col md:flex-row items-center justify-between relative overflow-hidden mb-8">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-emerald-50 opacity-50" />
                <div className="relative z-10 mb-6 md:mb-0">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-blue-100 p-2 rounded-xl">
                            <ClipboardCheck className="w-6 h-6 text-blue-700" />
                        </div>
                        <h1 className="text-4xl font-black text-gray-900 tracking-tight">
                            Coordinación Académica
                        </h1>
                    </div>
                    <p className="text-gray-600 text-lg">
                        Seguimiento pedagógico y validación de planeaciones.
                    </p>
                </div>
                <div className="relative z-10">
                    <div className="text-right">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Hora Actual</p>
                        <p className="text-3xl font-black text-gray-900">{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-100 border border-slate-50 md:col-span-2">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold flex items-center">
                            <ClipboardCheck className="w-5 h-5 mr-3 text-blue-600" />
                            Planeaciones por Validar
                            {stats.pending > 0 && (
                                <span className="ml-3 bg-red-100 text-red-600 text-xs font-black px-2 py-1 rounded-full animate-pulse">
                                    {stats.pending} Nuevas
                                </span>
                            )}
                        </h3>
                        <button
                            onClick={() => navigate('/planning')}
                            className="text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center transition-colors"
                        >
                            Ver Todas <ArrowRight className="w-4 h-4 ml-1" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        {loading ? (
                            <div className="space-y-4">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-20 bg-slate-50 rounded-2xl animate-pulse" />
                                ))}
                            </div>
                        ) : pendingPlans.length === 0 ? (
                            <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-50" />
                                <p className="text-slate-500 font-medium">¡Todo al día! No hay planeaciones pendientes.</p>
                            </div>
                        ) : (
                            pendingPlans.map(plan => (
                                <CoordItem
                                    key={plan.id}
                                    teacher={plan.teacher}
                                    subject={plan.subject_catalog?.name || 'Asignatura Desconocida'}
                                    deadline={new Date(plan.end_date).toLocaleDateString()}
                                    status={plan.status}
                                    grade={plan.groups?.grade}
                                    section={plan.groups?.section}
                                    onClick={() => navigate(`/planning/${plan.id}`)}
                                />
                            ))
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-lg shadow-slate-100/50">
                        <h4 className="font-bold flex items-center mb-4 text-slate-800">
                            <BarChart3 className="w-5 h-5 mr-2 text-emerald-500" /> Estatus General
                        </h4>
                        <div className="space-y-4">
                            <ProgressRow
                                label="Validado"
                                value={stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0}
                                color="emerald"
                                count={stats.approved}
                            />
                            <ProgressRow
                                label="Pendiente"
                                value={stats.total > 0 ? Math.round((stats.pending / stats.total) * 100) : 0}
                                color="orange"
                                count={stats.pending}
                            />
                        </div>
                        <div className="mt-6 pt-4 border-t border-slate-50">
                            <p className="text-xs text-center text-slate-400 font-medium">
                                Ciclo Escolar Actual
                            </p>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-3xl text-white shadow-xl shadow-blue-200 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl transform translate-x-10 -translate-y-10 group-hover:bg-white/20 transition-all duration-700" />

                        <div className="relative z-10">
                            <Clock className="w-10 h-10 mb-4 text-blue-200" />
                            <h4 className="text-lg font-bold">Próximo Consejo Técnico</h4>
                            <p className="text-blue-100 mt-2 font-medium capitalize">
                                {nextCteDate.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </p>

                            <div className="mt-6 flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full animate-pulse ${daysUntilCte <= 5 ? 'bg-red-400' : 'bg-emerald-400'}`} />
                                <span className="text-xs font-bold text-blue-200 uppercase tracking-wider">
                                    {daysUntilCte === 0 ? '¡ES HOY!' : `Faltan ${daysUntilCte} Días`}
                                </span>
                            </div>

                            <button
                                onClick={() => {
                                    if (cteConfig?.link) {
                                        window.open(cteConfig.link, '_blank')
                                    } else {
                                        navigate('/dashboard/settings?tab=school')
                                    }
                                }}
                                className="mt-6 w-full py-3 bg-white/10 hover:bg-white/20 hover:scale-[1.02] active:scale-95 rounded-xl font-bold text-sm transition-all border border-white/10 backdrop-blur-sm flex items-center justify-center"
                            >
                                <BookOpen className="w-4 h-4 mr-2" />
                                {cteConfig?.link ? 'Ver Orden del Día (Ext)' : 'Configurar Link Externo'}
                            </button>

                            <button
                                onClick={() => setIsAgendaModalOpen(true)}
                                className="mt-3 w-full py-3 bg-white text-blue-600 hover:bg-blue-50 hover:scale-[1.02] active:scale-95 rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center"
                            >
                                <ClipboardCheck className="w-4 h-4 mr-2" />
                                Gestionar Agenda Interna
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <CTEAgendaModal
                isOpen={isAgendaModalOpen}
                onClose={() => setIsAgendaModalOpen(false)}
                canEdit={true}
            />
        </div>
    )
}

const CoordItem = ({ teacher, subject, deadline, status, grade, section, onClick }: any) => (
    <div
        onClick={onClick}
        className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:bg-slate-50 hover:border-blue-200 hover:shadow-md transition-all cursor-pointer group"
    >
        <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <BookOpen className="w-5 h-5" />
            </div>
            <div>
                <h5 className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{teacher}</h5>
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-1">
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{grade}° {section}</span>
                    <span>•</span>
                    <span>{subject}</span>
                    <span>•</span>
                    <span className="text-orange-500">Vence: {deadline}</span>
                </div>
            </div>
        </div>
        <div className="flex flex-col items-end gap-2">
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${status === 'SUBMITTED' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                    'bg-blue-50 text-blue-600 border-blue-100'
                }`}>
                {status === 'SUBMITTED' ? 'POR VALIDAR' : status}
            </span>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transform group-hover:translate-x-1 transition-all" />
        </div>
    </div>
)

const ProgressRow = ({ label, value, color, count }: any) => (
    <div className="space-y-2">
        <div className="flex justify-between items-end">
            <span className="text-xs font-bold text-slate-600">{label}</span>
            <div className="text-right">
                <span className={`text-lg font-black text-${color}-600 block leading-none`}>{value}%</span>
                <span className="text-[10px] text-slate-400 font-medium">{count} Planeaciones</span>
            </div>
        </div>
        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
                className={`h-full bg-${color}-500 rounded-full transition-all duration-1000 ease-out`}
                style={{ width: `${value}%` }}
            />
        </div>
    </div>
)
