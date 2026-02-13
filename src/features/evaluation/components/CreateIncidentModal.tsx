import { useState, useEffect } from 'react'
import { X, Save, AlertTriangle, FileText, CheckCircle } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

interface CreateIncidentModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    groupId: string
    students: any[]
    defaultStudentId?: string | null
    tenantId: string
    teacherId: string
    incident?: any | null
}

export const CreateIncidentModal = ({
    isOpen,
    onClose,
    onSuccess,
    groupId,
    students,
    defaultStudentId,
    tenantId,
    teacherId,
    incident
}: CreateIncidentModalProps) => {
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        student_id: '',
        title: '',
        type: 'CONDUCTA',
        severity: 'BAJA',
        description: '',
        has_commitment: false,
        commitment_description: ''
    })

    useEffect(() => {
        if (isOpen) {
            if (incident) {
                setFormData({
                    student_id: incident.student_id,
                    title: incident.title,
                    type: incident.type,
                    severity: incident.severity,
                    description: incident.description,
                    has_commitment: incident.has_commitment,
                    commitment_description: incident.commitment_description || ''
                })
            } else {
                setFormData({
                    student_id: defaultStudentId || '',
                    title: '',
                    type: 'CONDUCTA',
                    severity: 'BAJA',
                    description: '',
                    has_commitment: false,
                    commitment_description: ''
                })
            }
        }
    }, [isOpen, defaultStudentId, incident])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.student_id || !formData.title || !formData.description) {
            alert('Por favor complete los campos obligatorios')
            return
        }

        setLoading(true)
        try {
            if (incident) {
                // UPDATE
                const { error } = await supabase
                    .from('student_incidents')
                    .update({
                        // student_id: formData.student_id, // Usually we don't change student on edit, but could allow
                        title: formData.title,
                        type: formData.type,
                        severity: formData.severity,
                        description: formData.description,
                        has_commitment: formData.has_commitment,
                        commitment_description: formData.has_commitment ? formData.commitment_description : null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', incident.id)

                if (error) throw error
            } else {
                // INSERT
                const { error } = await supabase.from('student_incidents').insert({
                    tenant_id: tenantId,
                    student_id: formData.student_id,
                    teacher_id: teacherId,
                    title: formData.title,
                    type: formData.type,
                    severity: formData.severity,
                    description: formData.description,
                    has_commitment: formData.has_commitment,
                    commitment_description: formData.has_commitment ? formData.commitment_description : null,
                    status: formData.has_commitment ? 'OPEN' : 'RESOLVED'
                })

                if (error) throw error
            }

            onSuccess()
            onClose()
        } catch (error: any) {
            console.error('Error creating incident:', error)
            alert('Error al guardar el reporte: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center">
                        <AlertTriangle className="w-6 h-6 mr-2 text-orange-600" />
                        {incident ? 'Editar Reporte' : 'Nuevo Reporte de Conducta'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Student Selection */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Alumno</label>
                        <select
                            value={formData.student_id}
                            onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                            className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-gray-50 disabled:bg-gray-100 disabled:text-gray-500"
                            required
                            disabled={!!incident}
                        >
                            <option value="">Seleccionar alumno...</option>
                            {students.map(student => (
                                <option key={student.id} value={student.id}>
                                    {student.last_name_paternal} {student.last_name_maternal} {student.first_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Report Specifics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Tipo de Reporte</label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            >
                                <option value="CONDUCTA">Conducta / Disciplina</option>
                                <option value="ACADEMICO">Académico / Desempeño</option>
                                <option value="EMOCIONAL">Emocional / Actitud</option>
                                <option value="SALUD">Salud / Higiene</option>
                                <option value="POSITIVO">Reconocimiento / Positivo</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Severidad / Impacto</label>
                            <select
                                value={formData.severity}
                                onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                                className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            >
                                <option value="BAJA">Baja (Observación)</option>
                                <option value="MEDIA">Media (Llamada de atención)</option>
                                <option value="ALTA">Alta (Citatorio / Grave)</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Título del Reporte</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="Ej. Falta de respeto en clase, Tarea no entregada..."
                            className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Descripción Detallada</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={4}
                            placeholder="Describe los hechos tal como ocurrieron..."
                            className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            required
                        />
                    </div>

                    {/* Commitment Section */}
                    <div className={`p-4 rounded-xl border-2 transition-all ${formData.has_commitment ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-200'}`}>
                        <div className="flex items-center mb-4">
                            <input
                                type="checkbox"
                                id="has_commitment"
                                checked={formData.has_commitment}
                                onChange={(e) => setFormData({ ...formData, has_commitment: e.target.checked })}
                                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 mr-3"
                            />
                            <label htmlFor="has_commitment" className="text-gray-900 font-bold cursor-pointer select-none flex items-center">
                                <FileText className="w-5 h-5 mr-2 text-blue-600" />
                                Generar Acta de Compromiso
                            </label>
                        </div>

                        {formData.has_commitment && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                <p className="text-sm text-blue-700 mb-2">
                                    Se generará un formato para impresión donde el alumno y/o padre se comprometen a:
                                </p>
                                <textarea
                                    value={formData.commitment_description}
                                    onChange={(e) => setFormData({ ...formData, commitment_description: e.target.value })}
                                    rows={3}
                                    placeholder="Ej. Entregar tareas pendientes antes del viernes, Mejorar comportamiento en clase..."
                                    className="w-full p-3 rounded-xl border border-blue-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                    required={formData.has_commitment}
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 rounded-xl text-gray-700 font-bold hover:bg-gray-100 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-3 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-200 flex items-center"
                        >
                            {loading ? (
                                <span className="flex items-center">
                                    <span className="animate-spin mr-2">⏳</span> Guardando...
                                </span>
                            ) : (
                                <>
                                    <Save className="w-5 h-5 mr-2" />
                                    Guardar Reporte
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
