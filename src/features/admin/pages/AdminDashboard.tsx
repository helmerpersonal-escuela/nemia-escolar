import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import {
    Users,
    UserCheck,
    Library,
    Calendar,
    AlertCircle,
    ArrowRight,
    TrendingUp,
    ShieldCheck,
    Building2,
    Search,
    BookOpen,
    ClipboardCheck,
    Stethoscope,
    FileText,
    ArrowUpRight,
    MessageSquare,
    PieChart
} from 'lucide-react'
import { Link } from 'react-router-dom'

export const AdminDashboard = () => {
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({
        totalStudents: 0,
        totalStaff: 0,
        totalGroups: 0,
        activeCycle: 'N/A',
        attendanceRate: 0,
        pemcProgress: 0,
        academicLagRef: 0
    })
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [isSearching, setIsSearching] = useState(false)

    useEffect(() => {
        loadStats()
    }, [])

    const loadStats = async () => {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase
                .from('profiles')
                .select('tenant_id')
                .eq('id', user.id)
                .single()

            if (!profile) return

            // Load counts
            const [students, staff, groups, cycle] = await Promise.all([
                supabase.from('students').select('*', { count: 'exact', head: true }).eq('tenant_id', profile.tenant_id),
                supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('tenant_id', profile.tenant_id),
                supabase.from('groups').select('*', { count: 'exact', head: true }).eq('tenant_id', profile.tenant_id),
                supabase.from('academic_years').select('name').eq('tenant_id', profile.tenant_id).eq('is_active', true).single()
            ])

            setStats({
                totalStudents: students.count || 0,
                totalStaff: staff.count || 0,
                totalGroups: groups.count || 0,
                activeCycle: cycle.data?.name || 'No configurado',
                attendanceRate: 94, // Mocked for now
                pemcProgress: 45, // Mocked for now
                academicLagRef: 12 // % of students in risk
            })
        } catch (error) {
            console.error('Error loading admin stats:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSearch = async (query: string) => {
        setSearchQuery(query)
        if (query.length < 3) {
            setSearchResults([])
            return
        }
        setIsSearching(true)
        const { data } = await supabase
            .from('students')
            .select('*, groups(name)')
            .ilike('full_name', `%${query}%`)
            .limit(5)
        setSearchResults(data || [])
        setIsSearching(false)
    }

    if (loading) {
        return (
            <div className="p-8 space-y-6 animate-pulse">
                <div className="h-20 bg-gray-100 rounded-3xl w-1/3" />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-gray-100 rounded-3xl" />)}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header / Search Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight">Consola de Dirección</h1>
                    <p className="text-gray-500 font-medium">Gestión integral bajo los principios de la Nueva Escuela Mexicana.</p>
                </div>

                <div className="relative w-full md:w-96 group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar alumno por nombre..."
                        className="block w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl text-sm font-bold shadow-sm focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none"
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                    />

                    {searchResults.length > 0 && (
                        <div className="absolute top-full mt-2 w-full bg-white rounded-2xl shadow-2xl border border-gray-50 overflow-hidden z-20 animate-in slide-in-from-top-2">
                            {searchResults.map(s => (
                                <Link
                                    key={s.id}
                                    to={`/students/${s.id}`}
                                    className="flex items-center p-4 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 mr-4">
                                        <Users className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900 uppercase">{s.first_name} {s.last_name_paternal}</p>
                                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{s.groups?.name || 'Sin Grupo'}</p>
                                    </div>
                                    <ArrowUpRight className="w-4 h-4 ml-auto text-gray-300" />
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                            <Users className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Alumnos</span>
                    </div>
                    <h3 className="text-3xl font-black text-gray-900">{stats.totalStudents}</h3>
                    <p className="text-xs text-gray-400 font-medium mt-1">Matrícula Total</p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
                            <UserCheck className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Personal</span>
                    </div>
                    <h3 className="text-3xl font-black text-gray-900">{stats.totalStaff}</h3>
                    <p className="text-xs text-gray-400 font-medium mt-1">Docentes y Administrativos</p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                            <Library className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Grupos</span>
                    </div>
                    <h3 className="text-3xl font-black text-gray-900">{stats.totalGroups}</h3>
                    <p className="text-xs text-gray-400 font-medium mt-1">Ciclo Vigente</p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                            <Calendar className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ciclo</span>
                    </div>
                    <h3 className="text-xl font-black text-gray-900 truncate">{stats.activeCycle}</h3>
                    <p className="text-xs text-gray-400 font-medium mt-1">Estado del Ciclo</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Academic Status & NEM Widgets */}
                <div className="lg:col-span-2 space-y-8">
                    {/* NEM Implementation Status */}
                    <div className="bg-gradient-to-br from-indigo-900 via-blue-900 to-indigo-950 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
                        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/20 rounded-full blur-[100px] -mr-40 -mt-40" />
                        <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-500/20 rounded-full blur-[80px] -ml-20 -mb-20" />

                        <div className="relative z-10 flex flex-col md:flex-row gap-10">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-1.5 h-6 bg-emerald-400 rounded-full" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-200/80">Gestión NEM 2026</span>
                                </div>
                                <h2 className="text-3xl font-black mb-6 leading-tight">Programa Escolar de Mejora Continua</h2>
                                <p className="text-blue-100/60 text-sm mb-10 leading-relaxed max-w-sm">
                                    Tu diagnóstico socioeducativo tiene un avance del 45%. Completa las acciones del Campo "Aprovechamiento Académico".
                                </p>
                                <div className="flex flex-wrap gap-4">
                                    <Link to="/admin/pemc" className="px-8 py-4 bg-white text-gray-900 rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-blue-50 transition-all shadow-xl shadow-black/20 flex items-center group">
                                        Gestionar PEMC
                                        <ArrowUpRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                    </Link>
                                    <button className="px-8 py-4 bg-white/10 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-white/20 transition-all border border-white/10 backdrop-blur-md">
                                        Imprimir diagnóstico
                                    </button>
                                </div>
                            </div>

                            <div className="w-full md:w-56 flex flex-col justify-center items-center gap-6">
                                <div className="relative w-40 h-40 bg-white/5 rounded-full border border-white/10 flex items-center justify-center">
                                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                                        <circle cx="80" cy="80" r="70" className="fill-none stroke-white/5 stroke-[12]" />
                                        <circle cx="80" cy="80" r="70" className="fill-none stroke-emerald-400 stroke-[12] transition-all duration-1000" strokeDasharray="440" strokeDashoffset={440 - (440 * stats.pemcProgress / 100)} strokeLinecap="round" />
                                    </svg>
                                    <div className="text-center">
                                        <span className="text-4xl font-black block">{stats.pemcProgress}%</span>
                                        <span className="text-[8px] font-black uppercase tracking-widest opacity-50">Global</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 w-full gap-2">
                                    <div className="bg-white/5 p-3 rounded-2xl border border-white/10 text-center">
                                        <span className="text-lg font-black block text-emerald-400">12</span>
                                        <span className="text-[8px] font-black uppercase opacity-60">Acciones</span>
                                    </div>
                                    <div className="bg-white/5 p-3 rounded-2xl border border-white/10 text-center">
                                        <span className="text-lg font-black block text-blue-400">4</span>
                                        <span className="text-[8px] font-black uppercase opacity-60">Metas</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
                                <PieChart className="w-24 h-24 text-blue-600" />
                            </div>
                            <h4 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-8">Rezago Educativo</h4>
                            <div className="flex items-end gap-4 mb-4">
                                <h3 className="text-4xl font-black text-gray-900">{stats.academicLagRef}%</h3>
                                <span className="text-rose-500 text-xs font-bold mb-2 flex items-center">
                                    <ArrowUpRight className="w-3 h-3 mr-1" />
                                    +2% este mes
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 font-medium leading-relaxed mb-8">
                                Estudiantes identificados con barreras para el aprendizaje. Requieren atención prioritaria.
                            </p>
                            <Link to="/reports" className="px-6 py-3 bg-blue-50 text-blue-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all inline-flex items-center">
                                Ver Alumnos en Riesgo
                            </Link>
                        </div>

                        <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
                                <ClipboardCheck className="w-24 h-24 text-emerald-600" />
                            </div>
                            <h4 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em] mb-8">Asistencia Personal</h4>
                            <div className="flex items-end gap-4 mb-4">
                                <h3 className="text-4xl font-black text-gray-900">98%</h3>
                                <div className="flex gap-1 mb-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 font-medium leading-relaxed mb-8">
                                Hoy: 12 presentes, 0 faltas, 1 permiso.
                            </p>
                            <Link to="/admin/staff" className="px-6 py-3 bg-emerald-50 text-emerald-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all inline-flex items-center">
                                Registro de Firmas
                            </Link>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
                            <h4 className="text-lg font-bold text-gray-900 mb-2 flex items-center">
                                <Building2 className="w-5 h-5 mr-3 text-blue-500" />
                                Configuración Escolar
                            </h4>
                            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                                Actualiza los datos oficiales de la institución, turno, zona y sector.
                            </p>
                            <Link to="/settings" className="text-blue-600 text-sm font-bold flex items-center hover:underline">
                                Ir a Configuración de Escuela <ArrowRight className="w-4 h-4 ml-2" />
                            </Link>
                        </div>
                        <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
                            <h4 className="text-lg font-bold text-gray-900 mb-2 flex items-center">
                                <ShieldCheck className="w-5 h-5 mr-3 text-purple-500" />
                                Gestión de Personal
                            </h4>
                            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                                Agrega nuevos docentes, coordinadores o personal administrativo.
                            </p>
                            <Link to="/settings" className="text-purple-600 text-sm font-bold flex items-center hover:underline">
                                Gestionar Personal e Invitaciones <ArrowRight className="w-4 h-4 ml-2" />
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Right Column / Actions & Alerts */}
                <div className="space-y-6">
                    <div className="bg-amber-50 border border-amber-100 p-6 rounded-[2rem] relative overflow-hidden">
                        <div className="flex items-center gap-3 mb-4">
                            <AlertCircle className="w-5 h-5 text-amber-600" />
                            <h4 className="text-sm font-black text-amber-900 uppercase tracking-tight">Acciones Pendientes</h4>
                        </div>
                        <div className="space-y-4">
                            <div className="p-3 bg-white/50 rounded-xl border border-amber-200/50">
                                <p className="text-xs font-bold text-amber-800">Cierre de Trimester</p>
                                <p className="text-[10px] text-amber-600 mt-0.5">Faltan 4 grupos por capturar calificaciones finales.</p>
                            </div>
                            <div className="p-3 bg-white/50 rounded-xl border border-amber-200/50">
                                <p className="text-xs font-bold text-amber-800">Programa Analítico</p>
                                <p className="text-[10px] text-amber-600 mt-0.5">Revisar el colectivo escolar del Fase 6.</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Acceso Rápido Directivo</h4>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: 'Inscripciones', path: '/groups', icon: UserCheck, color: 'bg-blue-50 text-blue-600' },
                                { label: 'Horarios', path: '/schedule', icon: Calendar, color: 'bg-purple-50 text-purple-600' },
                                { label: 'Comunicados', path: '/messages', icon: MessageSquare, color: 'bg-indigo-50 text-indigo-600' },
                                { label: 'Analítico', path: '/analytical-program', icon: BookOpen, color: 'bg-emerald-50 text-emerald-600' },
                                { label: 'Permisos', path: '/admin/staff', icon: Stethoscope, color: 'text-rose-600 bg-rose-50' },
                                { label: 'Expedientes', path: '/students', icon: FileText, color: 'text-amber-600 bg-amber-50' },
                            ].map(item => (
                                <Link
                                    key={item.label}
                                    to={item.path}
                                    className="flex flex-col items-center justify-center p-4 rounded-2xl border border-gray-50 hover:border-blue-100 hover:shadow-xl hover:shadow-blue-50 hover:bg-white transition-all group"
                                >
                                    <div className={`p-3 rounded-xl mb-3 ${item.color} group-hover:scale-110 transition-transform`}>
                                        <item.icon className="w-5 h-5" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase text-gray-500 group-hover:text-gray-900">{item.label}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

const ChevronRight = ({ className }: { className: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
)
