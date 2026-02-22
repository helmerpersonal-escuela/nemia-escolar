import { useState, useMemo } from 'react'
import { Plus, Search, Filter, AlertTriangle, FileText, CheckCircle, Download, Trash2, Printer, Pencil, ChevronDown, Calendar, ShieldCheck } from 'lucide-react'
import { CreateIncidentModal } from './CreateIncidentModal'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'

interface ConductReportsTabProps {
    groupId: string
    students: any[]
    incidents: any[]
    onRefresh: () => void
    tenantId: string
    userProfile: any
}

export const ConductReportsTab = ({
    groupId,
    students,
    incidents,
    onRefresh,
    tenantId,
    userProfile
}: ConductReportsTabProps) => {
    const { data: tenant } = useTenant()
    const [searchTerm, setSearchTerm] = useState('')
    const [filterType, setFilterType] = useState('ALL')
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
    const [incidentToEdit, setIncidentToEdit] = useState<any | null>(null)

    const filteredIncidents = useMemo(() => {
        return incidents.filter(incident => {
            const student = students.find(s => s.id === incident.student_id)
            const fullName = `${student?.first_name} ${student?.last_name_paternal} ${student?.last_name_maternal}`.toLowerCase()
            const matchesSearch = fullName.includes(searchTerm.toLowerCase()) || incident.title.toLowerCase().includes(searchTerm.toLowerCase())
            const matchesType = filterType === 'ALL' || incident.type === filterType

            return matchesSearch && matchesType
        })
    }, [incidents, students, searchTerm, filterType])

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este reporte?')) return
        try {
            const { error } = await supabase.from('student_incidents').delete().eq('id', id)
            if (error) throw error
            onRefresh()
        } catch (err) {
            console.error('Error deleting incident:', err)
            alert('Error al eliminar')
        }
    }

    const handleEdit = (incident: any) => {
        setIncidentToEdit(incident)
        setIsCreateModalOpen(true)
    }

    const handleExportCSV = () => {
        if (filteredIncidents.length === 0) {
            alert('No hay reportes para exportar.')
            return
        }

        const headers = ['Fecha', 'Alumno', 'Grado/Grupo', 'Tipo', 'Gravedad', 'Título', 'Descripción', 'Compromiso']
        const rows = filteredIncidents.map(incident => {
            const student = students.find(s => s.id === incident.student_id)
            return [
                new Date(incident.created_at).toLocaleDateString(),
                `"${student?.last_name_paternal} ${student?.last_name_maternal} ${student?.first_name}"`,
                `"${student?.group?.grade || ''}° ${student?.group?.section || ''}"`,
                incident.type,
                incident.severity,
                `"${incident.title.replace(/"/g, '""')}"`,
                `"${incident.description?.replace(/"/g, '""') || ''}"`,
                `"${incident.has_commitment ? 'SI' : 'NO'}"`
            ].join(',')
        })

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows].join('\n')
        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", `Reportes_Conducta_${new Date().toISOString().split('T')[0]}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const handlePrintCommitment = (incident: any, student: any) => {
        const printWindow = window.open('', '_blank')
        if (!printWindow) return

        const date = new Date(incident.created_at).toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })

        const content = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Acta de Compromiso - ${student.first_name} ${student.last_name_paternal}</title>
                <style>
                    body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 40px; }
                    .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #333; padding-bottom: 20px; }
                    .logo { font-size: 24px; font-weight: bold; text-transform: uppercase; margin-bottom: 10px; }
                    .title { font-size: 20px; font-weight: bold; text-transform: uppercase; margin-bottom: 20px; text-align: center; }
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                    .section { margin-bottom: 30px; }
                    .section-title { font-weight: bold; text-transform: uppercase; font-size: 14px; border-bottom: 1px solid #ccc; margin-bottom: 10px; }
                    .commitment-box { background-color: #f9f9f9; border: 1px solid #ddd; padding: 20px; border-radius: 8px; margin-bottom: 40px; }
                    .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 40px; margin-top: 80px; text-align: center; }
                    .signature-line { border-top: 1px solid #333; padding-top: 10px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
                    @media print {
                        body { padding: 20px; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo">${tenant?.name || 'ESCUELA BASICA'}</div>
                    <div class="logo" style="font-size: 14px; margin-top: 5px;">CCT: ${tenant?.cct || 'S/D'}</div>
                    <div>Departamento de Orientación Educativa y Trabajo Social</div>
                </div>

                <div class="title">Acta de Compromiso y Corresponsabilidad</div>

                <div class="info-grid">
                    <div>
                        <strong>Fecha:</strong> ${date}
                    </div>
                    <div>
                        <strong>Lugar:</strong> Tuxtla Gutiérrez, Chiapas
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">Datos del Alumno</div>
                    <p><strong>Nombre:</strong> ${student.last_name_paternal} ${student.last_name_maternal} ${student.first_name}</p>
                    <p><strong>Incidencia Reportada:</strong> ${incident.title}</p>
                </div>

                <div class="section">
                    <div class="section-title">Descripción de los Hechos</div>
                    <p>${incident.description}</p>
                </div>

                <div class="section">
                    <div class="section-title">Acuerdos y Compromisos</div>
                    <div class="commitment-box">
                        <p>Por medio de la presente, yo, <strong>${student.first_name} ${student.last_name_paternal}</strong>, reconozco la falta cometida y me comprometo a:</p>
                        <p style="font-style: italic; margin-top: 10px; white-space: pre-wrap;">${incident.commitment_description}</p>
                        <br/>
                        <p>Así mismo, yo como padre/tutor, me comprometo a dar seguimiento desde casa y apoyar las medidas disciplinarias establecidas por la institución.</p>
                    </div>
                </div>

                <div class="signatures">
                    <div>
                        <div class="signature-line">Firma del Alumno</div>
                    </div>
                    <div>
                        <div class="signature-line">Firma del Padre o Tutor</div>
                    </div>
                    <div>
                        <div class="signature-line">Trabajo Social / Orientación</div>
                    </div>
                </div>

                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `

        printWindow.document.write(content)
        printWindow.document.close()
    }

    const getSeverityStyles = (severity: string) => {
        switch (severity) {
            case 'ALTA': return 'text-rose-600 bg-rose-50 border-rose-100'
            case 'MEDIA': return 'text-amber-600 bg-amber-50 border-amber-100'
            default: return 'text-indigo-600 bg-indigo-50 border-indigo-100'
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Actions - Tactile Bar */}
            <div className="squishy-card p-4 flex flex-col md:flex-row gap-4 justify-between items-center bg-white/80 backdrop-blur-md border-none shadow-xl shadow-slate-200/50">
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80 group/search">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within/search:text-indigo-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar por alumno o título..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-slate-100 bg-slate-50/50 focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all text-sm font-bold text-slate-700 placeholder:text-slate-400 placeholder:font-black placeholder:uppercase placeholder:tracking-widest placeholder:text-[10px]"
                        />
                    </div>
                    <div className="relative group/filter">
                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within/filter:text-indigo-500 transition-colors pointer-events-none" />
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="pl-12 pr-10 py-3 rounded-2xl border-2 border-slate-100 bg-slate-50/50 focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all text-sm font-black uppercase tracking-widest text-[10px] text-slate-600 appearance-none cursor-pointer"
                        >
                            <option value="ALL">Todos</option>
                            <option value="CONDUCTA">Conducta</option>
                            <option value="ACADEMICO">Académico</option>
                            <option value="POSITIVO">Positivo</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                </div>

                <div className="flex w-full md:w-auto gap-3">
                    <button
                        onClick={handleExportCSV}
                        className="btn-tactile w-full md:w-auto px-6 py-3 bg-white text-indigo-600 border border-slate-200 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-slate-50 shadow-sm"
                        title="Exportar a CSV"
                    >
                        <Download className="w-4 h-4" />
                        Exportar
                    </button>
                    <button
                        onClick={() => {
                            setSelectedStudentId(null)
                            setIncidentToEdit(null)
                            setIsCreateModalOpen(true)
                        }}
                        className="btn-tactile w-full md:w-auto px-8 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Nuevo Reporte
                    </button>
                </div>
            </div>

            {/* Incidents Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredIncidents.length > 0 ? (
                    filteredIncidents.map((incident) => {
                        const student = students.find(s => s.id === incident.student_id)
                        return (
                            <div key={incident.id} className="squishy-card p-6 bg-white border-none shadow-lg shadow-slate-100 group/card relative flex flex-col">
                                <div className="flex justify-between items-start mb-5">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner transition-transform group-hover/card:scale-110 ${incident.has_commitment ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'
                                            }`}>
                                            {incident.has_commitment ? <FileText className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                                        </div>
                                        <div>
                                            <h4 className="font-black text-slate-800 line-clamp-1 leading-tight">{incident.title}</h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Calendar className="w-3 h-3 text-slate-300" />
                                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                                                    {new Date(incident.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-[0.2em] border-2 ${getSeverityStyles(incident.severity)}`}>
                                        {incident.severity}
                                    </span>
                                </div>

                                <div className="bg-slate-50 rounded-2xl p-4 mb-4 border border-slate-100 group-hover/card:bg-white group-hover/card:border-indigo-100 transition-colors">
                                    <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-1 opacity-60">Alumno</p>
                                    <p className="text-sm font-black text-slate-700">
                                        {student?.last_name_paternal} {student?.last_name_maternal}
                                    </p>
                                    <p className="text-xs font-bold text-slate-500">{student?.first_name}</p>
                                </div>

                                <div className="relative">
                                    <p className="text-slate-600 text-sm leading-relaxed line-clamp-3 italic">
                                        "{incident.description}"
                                    </p>
                                </div>

                                {incident.has_commitment && (
                                    <div className="mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100/50">
                                        <ShieldCheck className="w-4 h-4" />
                                        Requiere Acta
                                    </div>
                                )}

                                <div className="flex justify-end items-center gap-2 pt-5 border-t border-slate-50 mt-auto">
                                    {incident.has_commitment && (
                                        <button
                                            onClick={() => handlePrintCommitment(incident, student)}
                                            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all hover:scale-110 active:scale-90"
                                            title="Imprimir Acta"
                                        >
                                            <Printer className="w-5 h-5" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleEdit(incident)}
                                        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all hover:scale-110 active:scale-90"
                                        title="Editar Reporte"
                                    >
                                        <Pencil className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(incident.id)}
                                        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all hover:scale-110 active:scale-90"
                                        title="Eliminar Reporte"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        )
                    })
                ) : (
                    <div className="col-span-full py-20 text-center bg-slate-50/50 rounded-[3rem] border-4 border-dashed border-slate-100 flex flex-col items-center justify-center">
                        <div className="w-20 h-20 bg-white rounded-[2rem] shadow-xl flex items-center justify-center mb-6 scale-110">
                            <ShieldCheck className="w-10 h-10 text-emerald-500" />
                        </div>
                        <p className="font-black text-2xl text-slate-800 uppercase tracking-widest mb-2">Paz y Litoral</p>
                        <p className="text-slate-400 font-bold max-w-sm mx-auto">No hay incidencias registradas. ¡Tu grupo parece estar en excelente armonía!</p>
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="mt-8 px-8 py-3 bg-white border-2 border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-lg"
                        >
                            Crear primer reporte
                        </button>
                    </div>
                )}
            </div>

            <CreateIncidentModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={onRefresh}
                groupId={groupId}
                students={students}
                defaultStudentId={selectedStudentId}
                tenantId={tenantId}
                teacherId={userProfile?.id}
                incident={incidentToEdit}
            />
        </div>
    )
}
