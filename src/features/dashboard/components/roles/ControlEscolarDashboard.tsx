import { useState, useEffect } from 'react'
import { UserPlus, FileText, BadgeCheck, FileSearch, Download, Users, Clock } from 'lucide-react'

export const ControlEscolarDashboard = () => {
    const [currentTime, setCurrentTime] = useState(new Date())

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000)
        return () => clearInterval(timer)
    }, [])

    const selectedDate = new Date()
    return (
        <div className="space-y-6 animate-in fade-in duration-700 pb-12">
            {/* Welcome Section */}
            <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 flex flex-col md:flex-row items-center justify-between relative overflow-hidden mb-8">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 to-blue-50 opacity-50" />
                <div className="relative z-10 mb-6 md:mb-0">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-indigo-100 p-2 rounded-xl">
                            <FileText className="w-6 h-6 text-indigo-700" />
                        </div>
                        <h1 className="text-4xl font-black text-gray-900 tracking-tight">
                            Control Escolar
                        </h1>
                    </div>
                    <p className="text-gray-600 text-lg">
                        Gestión administrativa y expedientes académicos.
                    </p>
                </div>
                <div className="relative z-10 flex gap-4">
                    <div className="text-right hidden md:block mr-4">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Hora Actual</p>
                        <p className="text-3xl font-black text-gray-900">{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <button className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 flex items-center hover:bg-indigo-700 transition-all">
                        <UserPlus className="w-5 h-5 mr-2" /> Nueva Inscripción
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <ActionCard title="Inscripciones" description="Proceso de nuevo ingreso" icon={UserPlus} color="blue" />
                <ActionCard title="Expedientes" description="Consulta y edición masiva" icon={FileSearch} color="indigo" />
                <ActionCard title="Boletas" description="Generación de documentos" icon={FileText} color="emerald" />
                <ActionCard title="Certificados" description="Validación oficial SEP" icon={BadgeCheck} color="purple" />
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-100 border border-slate-50">
                <h3 className="text-xl font-bold mb-6">Trámites en Curso</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                <th className="pb-4">Folio</th>
                                <th className="pb-4">Alumno</th>
                                <th className="pb-4">Trámite</th>
                                <th className="pb-4">Estado</th>
                                <th className="pb-4">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            <TramiteRow folio="INS-042" name="Sofía Méndez" type="Inscripción" status="EN REVISIÓN" />
                            <TramiteRow folio="BO-211" name="Carlos Villa" type="Reposición Boleta" status="LISTO" />
                            <TramiteRow folio="CERT-09" name="Ana Paula K." type="Certificación" status="PENDIENTE" />
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

const ActionCard = ({ title, description, icon: Icon, color }: any) => {
    const colors: any = {
        blue: 'hover:border-blue-200 hover:bg-blue-50/50',
        indigo: 'hover:border-indigo-200 hover:bg-indigo-50/50',
        emerald: 'hover:border-emerald-200 hover:bg-emerald-50/50',
        purple: 'hover:border-purple-200 hover:bg-purple-50/50'
    }
    const iconColors: any = {
        blue: 'text-blue-600 bg-blue-50',
        indigo: 'text-indigo-600 bg-indigo-50',
        emerald: 'text-emerald-600 bg-emerald-50',
        purple: 'text-purple-600 bg-purple-50'
    }
    return (
        <button className={`p-6 bg-white rounded-3xl border border-slate-100 text-left transition-all group ${colors[color]}`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 ${iconColors[color]}`}>
                <Icon className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-900">{title}</h4>
            <p className="text-xs text-slate-400 font-medium leading-relaxed">{description}</p>
        </button>
    )
}

const TramiteRow = ({ folio, name, type, status }: any) => (
    <tr className="hover:bg-slate-50 transition-colors group">
        <td className="py-4 text-xs font-black text-slate-400">{folio}</td>
        <td className="py-4 font-bold text-slate-900">{name}</td>
        <td className="py-4 text-sm font-medium text-slate-500">{type}</td>
        <td className="py-4">
            <span className={`text-[10px] font-black px-2 py-1 rounded-md ${status === 'LISTO' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{status}</span>
        </td>
        <td className="py-4">
            <button className="p-2 text-slate-300 hover:text-indigo-600">
                <Download className="w-4 h-4" />
            </button>
        </td>
    </tr>
)
