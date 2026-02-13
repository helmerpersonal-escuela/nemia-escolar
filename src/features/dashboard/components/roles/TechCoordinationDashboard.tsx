import { useState, useEffect } from 'react'
import { Settings, AlertTriangle, Hammer, ClipboardCheck, BarChart3, Clock } from 'lucide-react'

export const TechCoordinationDashboard = () => {
    const [currentTime, setCurrentTime] = useState(new Date())

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000)
        return () => clearInterval(timer)
    }, [])
    return (
        <div className="space-y-6 animate-in fade-in duration-700 pb-12">
            {/* Welcome Section */}
            <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 flex flex-col md:flex-row items-center justify-between relative overflow-hidden mb-8">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-50 to-red-50 opacity-50" />
                <div className="relative z-10 mb-6 md:mb-0">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-orange-100 p-2 rounded-xl">
                            <Settings className="w-6 h-6 text-orange-700" />
                        </div>
                        <h1 className="text-4xl font-black text-gray-900 tracking-tight">
                            Coordinación Tecnológica
                        </h1>
                    </div>
                    <p className="text-gray-600 text-lg">
                        Gestión de talleres, laboratorios e inventarios técnicos.
                    </p>
                </div>
                <div className="relative z-10">
                    <div className="text-right">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Hora Actual</p>
                        <p className="text-3xl font-black text-gray-900">{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard title="Insumos Totales" value="1,240" icon={Settings} color="blue" />
                <StatCard title="Talleres Activos" value="8" icon={Hammer} color="emerald" />
                <StatCard title="Planeaciones Validadas" value="92%" icon={ClipboardCheck} color="purple" />
                <StatCard title="Prácticas Semanales" value="45" icon={BarChart3} color="orange" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-100 border border-slate-50">
                    <h3 className="text-xl font-bold mb-6 flex items-center">
                        <AlertTriangle className="w-5 h-5 mr-3 text-amber-500" /> Alertas de Inventario
                    </h3>
                    <div className="space-y-4">
                        <InventoryAlert item="Martillos 12oz" shop="Carpintería" stock="2" min="5" type="warning" />
                        <InventoryAlert item="Hojas Máquina" shop="Ofimática" stock="0" min="10" type="error" />
                        <InventoryAlert item="Estaño para Soldar" shop="Electrónica" stock="3" min="5" type="warning" />
                    </div>
                </div>

                <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-100 border border-slate-50">
                    <h3 className="text-xl font-bold mb-6 flex items-center">
                        <ClipboardCheck className="w-5 h-5 mr-3 text-blue-600" /> Planeaciones Técnicas
                    </h3>
                    <div className="space-y-4">
                        <TechPlan teacher="Ing. Roberto Gomez" shop="Electricidad" status="PENDIENTE" />
                        <TechPlan teacher="Profra. Martha Soto" shop="Contabilidad" status="LISTO" />
                    </div>
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
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${colors[color]}`}>
                <Icon className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">{title}</p>
            <h4 className="text-2xl font-black text-slate-900">{value}</h4>
        </div>
    )
}

const InventoryAlert = ({ item, shop, stock, min, type }: any) => (
    <div className={`p-4 rounded-2xl border-l-4 flex justify-between items-center ${type === 'warning' ? 'bg-amber-50 border-amber-400' : 'bg-red-50 border-red-400'}`}>
        <div>
            <h5 className="font-bold text-slate-900">{item}</h5>
            <p className="text-xs text-slate-500">{shop}</p>
        </div>
        <div className="text-right">
            <p className="text-sm font-black text-slate-900">{stock} / {min}</p>
            <p className="text-[10px] uppercase font-black text-slate-400 tracking-tighter">Stock Actual</p>
        </div>
    </div>
)

const TechPlan = ({ teacher, shop, status }: any) => (
    <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl hover:bg-slate-50 transition-all">
        <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                <Hammer className="w-5 h-5 text-slate-400" />
            </div>
            <div>
                <h5 className="font-bold text-slate-900">{teacher}</h5>
                <p className="text-xs text-slate-500 font-medium">{shop}</p>
            </div>
        </div>
        <span className={`text-[10px] font-black px-2 py-1 rounded-md ${status === 'PENDIENTE' ? 'bg-orange-50 text-orange-600' : 'bg-emerald-50 text-emerald-600'}`}>
            {status}
        </span>
    </div>
)
