import { useState, useEffect } from 'react'
import { X, Search, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../../../lib/supabase'
import { useTenant } from '../../../../hooks/useTenant'

interface IncidentModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

export const IncidentModal = ({ isOpen, onClose, onSuccess }: IncidentModalProps) => {
    const { data: tenant } = useTenant()
    const [step, setStep] = useState<'STUDENT' | 'FORM'>('STUDENT')
    const [groups, setGroups] = useState<any[]>([])
    const [selectedGroup, setSelectedGroup] = useState<any | null>(null)
    const [students, setStudents] = useState<any[]>([])
    const [selectedStudent, setSelectedStudent] = useState<any | null>(null)
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    const [formData, setFormData] = useState({
        title: '',
        type: 'CONDUCTA',
        severity: 'MEDIA',
        description: '',
        action_taken: '',
        is_private: false,
        has_commitment: false,
        commitment_description: ''
    })

    useEffect(() => {
        if (isOpen && tenant) {
            setStep('STUDENT')
            setSelectedGroup(null)
            setSelectedStudent(null)
            setFormData({
                title: '',
                type: 'CONDUCTA',
                severity: 'MEDIA',
                description: '',
                action_taken: '',
                is_private: false,
                has_commitment: false,
                commitment_description: ''
            })
            fetchGroups()
        }
    }, [isOpen, tenant])

    const fetchGroups = async () => {
        if (!tenant) return
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('groups')
                .select('*')
                .eq('tenant_id', tenant.id)
                .order('grade')
                .order('section')
            if (error) throw error
            if (data) setGroups(data)
        } catch (error: any) {
            console.error('Error fetching groups:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleGroupSelect = async (group: any) => {
        setSelectedGroup(group)
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('students')
                .select('*')
                .eq('group_id', group.id)
                .order('last_name_paternal', { ascending: true })
            if (error) throw error
            if (data) setStudents(data)
        } catch (error: any) {
            console.error('Error fetching students:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleStudentSelect = (student: any) => {
        setSelectedStudent(student)
        setStep('FORM')
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!tenant || !selectedStudent) return

        setSubmitting(true)
        try {
            // Get current user ID
            const { data: { user } } = await supabase.auth.getUser()

            const { error } = await supabase
                .from('student_incidents')
                .insert([{
                    tenant_id: tenant.id,
                    student_id: selectedStudent.id,
                    teacher_id: user?.id || null,
                    ...formData
                }])

            if (error) throw error
            onSuccess()
            onClose()
        } catch (error: any) {
            alert('Error al guardar: ' + error.message)
        } finally {
            setSubmitting(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-red-600 p-6 flex justify-between items-center text-white shrink-0">
                    <div>
                        <h3 className="text-xl font-black uppercase tracking-tight">Reportar Incidencia</h3>
                        {selectedStudent && (
                            <p className="text-red-100 text-xs font-bold uppercase tracking-widest mt-1">
                                Para: {selectedStudent.first_name} {selectedStudent.last_name_paternal} ({selectedGroup.grade}° "{selectedGroup.section}")
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 min-h-[300px]">
                    {step === 'STUDENT' ? (
                        <div className="space-y-6">
                            {loading && !selectedGroup ? (
                                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                    <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
                                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Cargando grupos...</p>
                                </div>
                            ) : !selectedGroup ? (
                                <>
                                    <label className="block text-sm font-bold text-slate-500 mb-4">Seleccione el grupo del alumno:</label>
                                    {groups.length === 0 ? (
                                        <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                                            <p className="font-bold text-slate-400">No se encontraron grupos disponibles.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                            {groups.map(group => (
                                                <button
                                                    key={group.id}
                                                    onClick={() => handleGroupSelect(group)}
                                                    className="p-6 bg-slate-50 hover:bg-red-50 border-2 border-transparent hover:border-red-500/20 rounded-2xl text-left transition-all group relative overflow-hidden"
                                                >
                                                    <div className="relative z-10">
                                                        <span className="block text-2xl font-black text-slate-800 group-hover:text-red-700">
                                                            {group.grade}° "{group.section}"
                                                        </span>
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider group-hover:text-red-400">
                                                            {group.shift === 'MORNING' ? 'Matutino' : 'Vespertino'}
                                                        </span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="space-y-4">
                                    <button onClick={() => setSelectedGroup(null)} className="text-xs font-bold text-red-600 uppercase">← Volver a grupos</button>

                                    {loading ? (
                                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                            <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
                                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Cargando alumnos...</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="relative">
                                                <Search className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                                                <input
                                                    placeholder="Filtrar por nombre..."
                                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl outline-none focus:ring-2 ring-red-100 font-medium"
                                                    value={searchQuery}
                                                    onChange={e => setSearchQuery(e.target.value)}
                                                />
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {students.length === 0 ? (
                                                    <div className="col-span-full text-center py-8 text-slate-400 font-medium italic">
                                                        No hay alumnos registrados en este grupo.
                                                    </div>
                                                ) : students
                                                    .filter(s => `${s.first_name} ${s.last_name_paternal}`.toLowerCase().includes(searchQuery.toLowerCase()))
                                                    .map(s => (
                                                        <button
                                                            key={s.id}
                                                            onClick={() => handleStudentSelect(s)}
                                                            className="flex items-center p-4 hover:bg-red-50 rounded-2xl text-left gap-3 transition-colors border border-transparent hover:border-red-100"
                                                        >
                                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-500 text-sm">
                                                                {s.first_name[0]}{s.last_name_paternal[0]}
                                                            </div>
                                                            <span className="font-bold text-sm text-slate-700">{s.first_name} {s.last_name_paternal}</span>
                                                        </button>
                                                    ))
                                                }
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Título del Reporte</label>
                                <input
                                    required
                                    className="w-full px-4 py-3 bg-slate-50 rounded-2xl outline-none focus:ring-2 ring-red-100 font-bold"
                                    placeholder="Ej: Falta de uniforme, Fuera del aula..."
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Tipo</label>
                                    <select
                                        className="w-full px-4 py-3 bg-slate-50 rounded-2xl outline-none focus:ring-2 ring-red-100 font-bold appearance-none"
                                        value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                                    >
                                        <option value="CONDUCTA">Conducta / Disciplina</option>
                                        <option value="ACADEMICO">Académico</option>
                                        <option value="SALUD">Salud</option>
                                        <option value="EMOCIONAL">Emocional</option>
                                        <option value="POSITIVO">Mérito / Positivo</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Gravedad</label>
                                    <select
                                        className="w-full px-4 py-3 bg-slate-50 rounded-2xl outline-none focus:ring-2 ring-red-100 font-bold appearance-none"
                                        value={formData.severity}
                                        onChange={e => setFormData({ ...formData, severity: e.target.value })}
                                    >
                                        <option value="BAJA">Baja</option>
                                        <option value="MEDIA">Media</option>
                                        <option value="ALTA">Alta / Crítica</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Descripción detallada</label>
                                <textarea
                                    required
                                    rows={4}
                                    className="w-full px-4 py-3 bg-slate-50 rounded-2xl outline-none focus:ring-2 ring-red-100 font-medium"
                                    placeholder="Explique lo sucedido..."
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Acción tomada</label>
                                <input
                                    className="w-full px-4 py-3 bg-slate-50 rounded-2xl outline-none focus:ring-2 ring-red-100 font-medium"
                                    placeholder="Ej: Notificación a padres, Reporte verbal..."
                                    value={formData.action_taken}
                                    onChange={e => setFormData({ ...formData, action_taken: e.target.value })}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full py-4 bg-red-600 text-white rounded-2xl font-black shadow-lg shadow-red-100 hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                            >
                                {submitting ? 'Guardando...' : (
                                    <>
                                        <CheckCircle2 className="w-5 h-5" /> Enviar Reporte
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
