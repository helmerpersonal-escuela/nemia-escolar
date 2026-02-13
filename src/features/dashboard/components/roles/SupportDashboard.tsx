import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useTenant } from '../../../../hooks/useTenant'
import {
    Users,
    Calendar,
    AlertTriangle,
    FileText,
    Search,
    Plus,
    Clock,
    CheckCircle2
} from 'lucide-react'

import { useNavigate } from 'react-router-dom'
import { TrackingEntryModal } from './TrackingEntryModal'

export const SupportDashboard = () => {
    const { data: tenant } = useTenant()
    const navigate = useNavigate()
    const [showEntryModal, setShowEntryModal] = useState(false)
    const [stats, setStats] = useState({
        activeTracking: 0,
        interviewsToday: 0,
        highRiskCases: 0
    })
    const [recentTracking, setRecentTracking] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (tenant) fetchSupportData()
    }, [tenant])

    const fetchSupportData = async () => {
        if (!tenant) return

        try {
            // 1. Get Stats using separate queries for accuracy

            // Active Tracking Cases (Open or In Process)
            const { count: activeCount } = await supabase
                .from('student_tracking')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenant.id)
                .in('status', ['ABIERTO', 'EN_PROCESO'])

            // High Risk Cases (Dropout Risk)
            const { count: riskCount } = await supabase
                .from('dropout_risk_cases')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenant.id)
                .in('status', ['DETECTADO', 'INTERVENCION', 'MONITOREO'])

            // Interviews Today
            const today = new Date().toISOString().split('T')[0]
            const { count: interviewCount } = await supabase
                .from('student_tracking')
                .select('*', { count: 'exact', head: true })
                .eq('tenant_id', tenant.id)
                .eq('type', 'ENTREVISTA')
                .gte('created_at', `${today}T00:00:00`)
                .lte('created_at', `${today}T23:59:59`)

            setStats({
                activeTracking: activeCount || 0,
                highRiskCases: riskCount || 0,
                interviewsToday: interviewCount || 0
            })

            // 2. Get Recent Activity
            const { data: recent } = await supabase
                .from('student_tracking')
                .select(`
                    *,
                    students (first_name, last_name_paternal)
                `)
                .eq('tenant_id', tenant.id)
                .order('updated_at', { ascending: false })
                .limit(5)

            if (recent) setRecentTracking(recent)

        } catch (error) {
            console.error('Error fetching support dashboard:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) return <div className="p-8 text-center text-slate-400">Cargando panel de apoyo...</div>

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-12">
            {/* Welcome Section */}
            <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 flex flex-col md:flex-row items-center justify-between relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-50 to-teal-50 opacity-50" />
                <div className="relative z-10 mb-6 md:mb-0">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-emerald-100 p-2 rounded-xl">
                            <Users className="w-6 h-6 text-emerald-700" />
                        </div>
                        <h1 className="text-4xl font-black text-gray-900 tracking-tight">
                            Panel de Apoyo Educativo
                        </h1>
                    </div>
                    <p className="text-gray-600 text-lg">
                        Seguimiento Psicosocial y Orientación
                    </p>
                </div>
                <div className="relative z-10 flex gap-2">
                    <button
                        onClick={() => setShowEntryModal(true)}
                        className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold shadow-lg shadow-slate-200 hover:bg-black transition-all flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" /> Nuevo Caso
                    </button>
                    <button
                        onClick={() => navigate('/tracking')}
                        className="px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center gap-2"
                    >
                        <Search className="w-5 h-5" /> Buscar Alumno
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <Users className="w-24 h-24 text-blue-600" />
                    </div>
                    <div className="relative z-10">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3 text-blue-600">
                            <FileText className="w-5 h-5" />
                        </div>
                        <h3 className="text-3xl font-black text-slate-800 mb-1">{stats.activeTracking}</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Casos en Seguimiento</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <AlertTriangle className="w-24 h-24 text-red-600" />
                    </div>
                    <div className="relative z-10">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center mb-3 text-amber-600">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <h3 className="text-3xl font-black text-slate-800 mb-1">{stats.highRiskCases}</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Riesgo de Deserción</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <Calendar className="w-24 h-24 text-emerald-600" />
                    </div>
                    <div className="relative z-10">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3 text-emerald-600">
                            <Users className="w-5 h-5" />
                        </div>
                        <h3 className="text-3xl font-black text-slate-800 mb-1">{stats.interviewsToday}</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Entrevistas Hoy</p>
                    </div>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-3xl shadow-md border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">Actividad Reciente</h3>
                    <button onClick={() => navigate('/tracking')} className="text-xs font-bold text-blue-600 hover:text-blue-700">Ver todo</button>
                </div>
                {recentTracking.length > 0 ? (
                    <div className="divide-y divide-slate-50">
                        {recentTracking.map((item) => (
                            <div key={item.id} className="p-4 hover:bg-slate-50/50 transition-colors flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                    <div className={`w-2 h-12 rounded-full ${item.severity === 'ALTA' ? 'bg-red-500' :
                                        item.severity === 'MEDIA' ? 'bg-amber-400' : 'bg-blue-400'
                                        }`} />
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm">{item.students?.first_name} {item.students?.last_name_paternal}</h4>
                                        <p className="text-xs text-slate-500">{item.title}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${item.status === 'EN_PROCESO' ? 'bg-blue-50 text-blue-600' :
                                        item.status === 'CERRADO' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-600'
                                        }`}>
                                        {item.status.replace('_', ' ')}
                                    </span>
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        {new Date(item.updated_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-12 text-center">
                        <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                            <FileText className="w-8 h-8 text-slate-300" />
                        </div>
                        <h3 className="text-slate-800 font-bold">Sin actividad reciente</h3>
                        <p className="text-slate-500 text-sm">Comienza registrando un nuevo caso o entrevista.</p>
                    </div>
                )}
                {showEntryModal && (
                    <TrackingEntryModal
                        onClose={() => setShowEntryModal(false)}
                        onSuccess={() => {
                            fetchSupportData()
                            setShowEntryModal(false)
                        }}
                    />
                )}
            </div>
        </div>
    )
}
