import { useState, useMemo } from 'react'
import { Plus, Search, Filter, AlertTriangle, FileText, CheckCircle, Download, Trash2, Printer, Pencil } from 'lucide-react'
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

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'ALTA': return 'text-red-600 bg-red-50 border-red-200'
            case 'MEDIA': return 'text-orange-600 bg-orange-50 border-orange-200'
            default: return 'text-blue-600 bg-blue-50 border-blue-200'
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Actions */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar por alumno o título..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                    </div>
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="pl-10 pr-8 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 text-sm appearance-none bg-white"
                        >
                            <option value="ALL">Todos los tipos</option>
                            <option value="CONDUCTA">Conducta</option>
                            <option value="ACADEMICO">Académico</option>
                            <option value="POSITIVO">Positivo</option>
                        </select>
                    </div>
                </div>

                <button
                    onClick={() => {
                        setSelectedStudentId(null)
                        setIncidentToEdit(null)
                        setIsCreateModalOpen(true)
                    }}
                    className="w-full md:w-auto px-6 py-2 bg-gray-900 text-white rounded-xl font-bold flex items-center justify-center hover:bg-black transition-all shadow-lg shadow-gray-200 hover:shadow-xl"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    Nuevo Reporte
                </button>
            </div>

            {/* Incidents Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredIncidents.length > 0 ? (
                    filteredIncidents.map((incident) => {
                        const student = students.find(s => s.id === incident.student_id)
                        return (
                            <div key={incident.id} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all group relative">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center space-x-3">
                                        <div className={`p-2 rounded-xl ${incident.has_commitment ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
                                            {incident.has_commitment ? <FileText className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 line-clamp-1">{incident.title}</h4>
                                            <p className="text-xs text-gray-500 font-medium">
                                                {new Date(incident.created_at).toLocaleDateString()} • {incident.type}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase border ${getSeverityColor(incident.severity)}`}>
                                        {incident.severity}
                                    </span>
                                </div>

                                <p className="text-sm font-bold text-blue-900 mb-2">
                                    Alumno: {student?.first_name} {student?.last_name_paternal}
                                </p>
                                <p className="text-gray-600 text-sm line-clamp-3 mb-4 bg-gray-50 p-3 rounded-xl">
                                    "{incident.description}"
                                </p>

                                {incident.has_commitment && (
                                    <div className="mb-4 flex items-center text-xs font-bold text-purple-700 bg-purple-50 p-2 rounded-lg border border-purple-100">
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        Requiere Acta de Compromiso
                                    </div>
                                )}

                                <div className="flex justify-end items-center gap-2 pt-4 border-t border-gray-50 mt-auto">
                                    {incident.has_commitment && (
                                        <button
                                            onClick={() => handlePrintCommitment(incident, student)}
                                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="Imprimir Acta"
                                        >
                                            <Printer className="w-4 h-4" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleEdit(incident)}
                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Editar Reporte"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(incident.id)}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Eliminar Reporte"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )
                    })
                ) : (
                    <div className="col-span-full py-12 text-center text-gray-400 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                        <div className="p-4 bg-white rounded-full inline-block mb-4 shadow-sm">
                            <CheckCircle className="w-8 h-8 text-green-500" />
                        </div>
                        <p className="font-bold text-lg text-gray-600">No hay reportes registrados</p>
                        <p className="text-sm">Utiliza el botón "Nuevo Reporte" para agregar incidencias.</p>
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
