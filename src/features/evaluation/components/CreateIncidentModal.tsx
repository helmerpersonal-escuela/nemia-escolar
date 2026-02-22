import { useState, useEffect } from 'react'
import { X, Save, AlertTriangle, FileText, CheckCircle, ChevronDown } from 'lucide-react'
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
            <div className="squishy-card bg-white shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border-none animate-in zoom-in-95 duration-300">
                <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-white z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center shadow-inner">
                            <AlertTriangle className="w-6 h-6 text-amber-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 leading-tight">
                                {incident ? 'Editar Reporte' : 'Nuevo Reporte de Conducta'}
                            </h2>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Gestión de convivencia</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center hover:bg-slate-50 rounded-xl transition-all hover:rotate-90 active:scale-90"
                    >
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-8 overflow-y-auto custom-scrollbar">
                    {/* Student Selection */}
                    <div className="group/field">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1 group-focus-within/field:text-indigo-500 transition-colors">Alumno</label>
                        <div className="relative">
                            <select
                                value={formData.student_id}
                                onChange={(e) => setFormData(prev => ({ ...prev, student_id: e.target.value }))}
                                className="w-full p-4 pl-5 rounded-2xl border-2 border-slate-100 bg-slate-50/50 focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all text-sm font-bold text-slate-700 appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    {/* Report Specifics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="group/field">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1 group-focus-within/field:text-indigo-500 transition-colors">Tipo de Reporte</label>
                            <div className="relative">
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                                    className="w-full p-4 pl-5 rounded-2xl border-2 border-slate-100 bg-slate-50/50 focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all text-sm font-bold text-slate-700 appearance-none cursor-pointer"
                                >
                                    <option value="CONDUCTA">Conducta / Disciplina</option>
                                    <option value="ACADEMICO">Académico / Desempeño</option>
                                    <option value="EMOCIONAL">Emocional / Actitud</option>
                                    <option value="SALUD">Salud / Higiene</option>
                                    <option value="POSITIVO">Reconocimiento / Positivo</option>
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                        <div className="group/field">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1 group-focus-within/field:text-indigo-500 transition-colors">Severidad / Impacto</label>
                            <div className="relative">
                                <select
                                    value={formData.severity}
                                    onChange={(e) => setFormData(prev => ({ ...prev, severity: e.target.value }))}
                                    className="w-full p-4 pl-5 rounded-2xl border-2 border-slate-100 bg-slate-50/50 focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all text-sm font-bold text-slate-700 appearance-none cursor-pointer"
                                >
                                    <option value="BAJA">Baja (Observación)</option>
                                    <option value="MEDIA">Media (Aviso)</option>
                                    <option value="ALTA">Alta (Citatorio)</option>
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    <div className="group/field">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1 group-focus-within/field:text-indigo-500 transition-colors">Título del Reporte</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="Ej. Falta de respeto en el aula"
                            className="w-full p-4 pl-5 rounded-2xl border-2 border-slate-100 bg-slate-50/50 focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all text-sm font-bold text-slate-700 placeholder:text-slate-300 placeholder:font-bold"
                            required
                        />
                    </div>

                    <div className="group/field">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1 group-focus-within/field:text-indigo-500 transition-colors">Descripción Detallada</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            rows={4}
                            placeholder="Escribe aquí los motivos del reporte..."
                            className="w-full p-5 rounded-2xl border-2 border-slate-100 bg-slate-50/50 focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all text-sm font-bold text-slate-700 placeholder:text-slate-300 placeholder:font-bold resize-none"
                            required
                        />
                    </div>

                    {/* Commitment Section - Squishy Sub-card */}
                    <div className={`p-6 rounded-[2rem] border-4 transition-all duration-500 ${formData.has_commitment ? 'border-indigo-500 bg-indigo-50/30' : 'border-slate-50 bg-slate-50/30 hover:border-slate-100'}`}>
                        <div className="flex items-center justify-between mb-2">
                            <label htmlFor="has_commitment" className="flex items-center gap-4 cursor-pointer group/label">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${formData.has_commitment ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white text-slate-400 shadow-inner group-hover/label:bg-indigo-50 group-hover/label:text-indigo-400'}`}>
                                    <FileText className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="font-black text-slate-800 leading-none">Acta de Compromiso</p>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Generar documento legal</p>
                                </div>
                            </label>
                            <div className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    id="has_commitment"
                                    checked={formData.has_commitment}
                                    onChange={(e) => setFormData(prev => ({ ...prev, has_commitment: e.target.checked }))}
                                    className="sr-only peer"
                                />
                                <div className="w-14 h-8 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600"></div>
                            </div>
                        </div>

                        {formData.has_commitment && (
                            <div className="mt-6 space-y-4 animate-in slide-in-from-top-4 duration-500">
                                <div className="p-4 bg-white/60 rounded-2xl border border-indigo-100">
                                    <p className="text-[10px] text-indigo-500 font-black uppercase tracking-widest mb-3 leading-tight opacity-60">Compromisos específicos</p>
                                    <textarea
                                        value={formData.commitment_description}
                                        onChange={(e) => setFormData(prev => ({ ...prev, commitment_description: e.target.value }))}
                                        rows={3}
                                        placeholder="Ej. Mejorar el lenguaje utilizado en el aula..."
                                        className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm font-bold text-slate-700 placeholder:text-slate-300 resize-none"
                                        required={formData.has_commitment}
                                    />
                                </div>
                                <div className="flex items-center gap-2 px-2 py-1 bg-amber-50 rounded-lg">
                                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-600">Requiere firmas de tutor y alumno</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-4 p-8 bg-slate-50 mt-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-all active:scale-95"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-tactile px-10 py-3 rounded-2xl bg-slate-900 text-white font-black uppercase tracking-widest text-[10px] flex items-center gap-3 disabled:opacity-50"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
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
