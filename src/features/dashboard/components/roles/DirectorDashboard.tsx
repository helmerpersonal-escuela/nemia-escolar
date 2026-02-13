import { LayoutDashboard, Users, PieChart, TrendingUp, Bell } from 'lucide-react'

export const DirectorDashboard = () => {
    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Welcome Section */}
            <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 flex flex-col md:flex-row items-center justify-between relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-indigo-50 opacity-50" />
                <div className="relative z-10 mb-6 md:mb-0">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-blue-100 p-2 rounded-xl">
                            <LayoutDashboard className="w-6 h-6 text-blue-700" />
                        </div>
                        <h1 className="text-4xl font-black text-gray-900 tracking-tight">
                            Panel Directivo
                        </h1>
                    </div>
                    <p className="text-gray-600 text-lg">
                        Supervisión global del plantel educativo.
                    </p>
                </div>
                <div className="relative z-10">
                    <button className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center">
                        <Bell className="w-5 h-5 mr-2" /> Crear Comunicado
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard title="Total Alumnos" value="452" icon={Users} color="blue" />
                <StatCard title="Docentes Activos" value="28" icon={Users} color="emerald" />
                <StatCard title="Planeaciones Validadas" value="85%" icon={PieChart} color="purple" />
                <StatCard title="Asistencia General" value="94%" icon={TrendingUp} color="orange" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-100 border border-slate-50">
                    <h3 className="text-xl font-bold mb-6">Alertas Académicas</h3>
                    <div className="space-y-4">
                        <AlertItem title="Planeaciones pendientes" subtitle="12 docentes no han entregado" type="warning" />
                        <AlertItem title="Baja asistencia en 3ºB" subtitle="Promedio debajo del 80%" type="error" />
                    </div>
                </div>
                <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-100 border border-slate-50">
                    <h3 className="text-xl font-bold mb-6">Últimos Comunicados</h3>
                    <p className="text-slate-400 font-medium text-center py-10">No hay comunicados recientes.</p>
                </div>
            </div>
        </div>
    )
}

const StatCard = ({ title, value, icon: Icon, color }: any) => {
    const colors: any = {
        blue: 'text-blue-600 bg-blue-50',
        emerald: 'text-emerald-600 bg-emerald-50',
        purple: 'text-purple-600 bg-purple-50',
        orange: 'text-orange-600 bg-orange-50'
    }
    return (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${colors[color]}`}>
                <Icon className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">{title}</p>
            <h4 className="text-2xl font-black text-slate-900">{value}</h4>
        </div>
    )
}

const AlertItem = ({ title, subtitle, type }: any) => (
    <div className={`p-4 rounded-2xl border-l-4 flex gap-4 ${type === 'warning' ? 'bg-orange-50 border-orange-400' : 'bg-red-50 border-red-400'}`}>
        <div className="flex-grow">
            <h5 className="font-bold text-slate-900">{title}</h5>
            <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
    </div>
)
