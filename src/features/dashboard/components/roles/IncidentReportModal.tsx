import { X, Printer, Download, Calendar, User, FileText, AlertTriangle } from 'lucide-react'

interface IncidentReportModalProps {
    isOpen: boolean
    onClose: () => void
    incident: any
}

export const IncidentReportModal = ({ isOpen, onClose, incident }: IncidentReportModalProps) => {
    if (!isOpen || !incident) return null

    const handlePrint = () => {
        window.print()
    }

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:bg-white print:p-0">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:rounded-none">
                {/* Header - Hidden in Print */}
                <div className="bg-slate-900 p-6 flex justify-between items-center text-white shrink-0 print:hidden">
                    <h3 className="text-xl font-black uppercase tracking-tight">Vista de Reporte</h3>
                    <div className="flex gap-2">
                        <button onClick={handlePrint} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors flex items-center gap-2 text-xs font-bold">
                            <Printer className="w-4 h-4" /> Imprimir
                        </button>
                        <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-12 print:p-8 space-y-8">
                    {/* Report Header for Print */}
                    <div className="text-center space-y-2 pb-8 border-b-2 border-slate-100">
                        <h1 className="text-2xl font-black uppercase tracking-tighter">Reporte de Incidencia Escolar</h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sistema de Gestión Escolar - Departamento de Prefectura</p>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                    <User className="w-3 h-3" /> Alumno(a)
                                </label>
                                <p className="font-bold text-slate-900">
                                    {incident.students ? `${incident.students.first_name} ${incident.students.last_name_paternal}` : 'Estudiante'}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Grado y Grupo</label>
                                <p className="font-bold text-slate-900">
                                    {incident.students?.groups ? `${incident.students.groups.grade}° "${incident.students.groups.section}"` : '--'}
                                </p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-1 text-right">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 justify-end">
                                    <Calendar className="w-3 h-3" /> Fecha y Hora
                                </label>
                                <p className="font-bold text-slate-900">{new Date(incident.created_at).toLocaleString()}</p>
                            </div>
                            <div className="space-y-1 text-right">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ID Reporte</label>
                                <p className="font-mono text-[10px] text-slate-400">{incident.id.slice(0, 8)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="font-black text-slate-900 uppercase text-sm flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-red-500" /> Detalle de la Incidencia
                            </h4>
                            <span className="px-3 py-1 bg-white border border-slate-200 rounded-full text-[10px] font-black uppercase tracking-widest">
                                {incident.type} / Gravedad {incident.severity}
                            </span>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-bold text-slate-900">{incident.title}</p>
                            <p className="text-sm text-slate-600 leading-relaxed">{incident.description}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-black text-slate-900 uppercase text-sm flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-500" /> Resolución y Compromisos
                        </h4>
                        <div className="grid grid-cols-1 gap-6">
                            <div className="space-y-1 border-l-4 border-blue-100 pl-4 py-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Acción Tomada</label>
                                <p className="text-sm font-medium text-slate-700">{incident.action_taken || 'Pendiente de resolución'}</p>
                            </div>
                            {incident.has_commitment && (
                                <div className="space-y-1 border-l-4 border-emerald-100 pl-4 py-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Compromiso del Alumno</label>
                                    <p className="text-sm font-medium text-slate-700">{incident.commitment_description}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Signature Section for Print */}
                    <div className="pt-24 grid grid-cols-2 gap-20">
                        <div className="text-center space-y-2">
                            <div className="border-b-2 border-slate-900 w-full" />
                            <p className="text-[10px] font-black uppercase tracking-widest">Firma del Prefecto</p>
                        </div>
                        <div className="text-center space-y-2">
                            <div className="border-b-2 border-slate-900 w-full" />
                            <p className="text-[10px] font-black uppercase tracking-widest">Firma del Tutor / Alumno</p>
                        </div>
                    </div>

                    <p className="text-[8px] text-center text-slate-300 font-bold uppercase tracking-[0.2em] pt-8">
                        Documento generado por NEMIA - Plataforma de Gestión Escolar
                    </p>
                </div>
            </div>
        </div>
    )
}
