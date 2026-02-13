import { BarChart3, TrendingUp, Users, GraduationCap, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export const SchoolStatsPage = () => {
    const navigate = useNavigate()
    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-white rounded-xl transition-colors">
                    <ArrowLeft className="w-6 h-6 text-slate-400" />
                </button>
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Estadísticas Escolares</h1>
                    <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">Análisis de Desempeño y Asistencia Global</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard title="Aprovechamiento" value="8.4" trend="+0.2" icon={GraduationCap} color="blue" />
                <MetricCard title="Asistencia" value="94.2%" trend="-0.5%" icon={Users} color="emerald" />
                <MetricCard title="Altas/Bajas" value="12" trend="+2" icon={TrendingUp} color="purple" />
                <MetricCard title="Incidencias" value="45" trend="-8" icon={BarChart3} color="orange" />
            </div>

            <div className="bg-white p-10 rounded-[3rem] shadow-2xl shadow-slate-100 border border-slate-100 flex flex-col items-center justify-center min-h-[400px]">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                    <BarChart3 className="w-10 h-10 text-slate-200" />
                </div>
                <h3 className="text-2xl font-black text-slate-300 uppercase tracking-widest">Gráficos de Análisis</h3>
                <p className="text-slate-300 font-bold text-sm uppercase mt-4 text-center max-w-xs">Estamos procesando los datos históricos para generar visualizaciones detalladas.</p>
            </div>
        </div>
    )
}

const MetricCard = ({ title, value, trend, icon: Icon, color }: any) => {
    const colors: any = {
        blue: 'text-blue-600 bg-blue-50',
        emerald: 'text-emerald-600 bg-emerald-50',
        purple: 'text-purple-600 bg-purple-50',
        orange: 'text-orange-600 bg-orange-50'
    }
    return (
        <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-100 border border-slate-50">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${colors[color]}`}>
                <Icon className="w-7 h-7" />
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
            <div className="flex items-baseline gap-3">
                <h4 className="text-3xl font-black text-slate-900">{value}</h4>
                <span className={`text-[10px] font-black ${trend.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>{trend}</span>
            </div>
        </div>
    )
}
