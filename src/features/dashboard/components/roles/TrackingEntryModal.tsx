import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useTenant } from '../../../../hooks/useTenant'
import { X, Save, Search, User, FileText, CheckCircle2 } from 'lucide-react'

interface TrackingEntryModalProps {
    onClose: () => void
    onSuccess: () => void
}

export const TrackingEntryModal = ({ onClose, onSuccess }: TrackingEntryModalProps) => {
    const { data: tenant } = useTenant()
    const [step, setStep] = useState(1) // 1: Select Student, 2: Fill Details
    const [searchTerm, setSearchTerm] = useState('')
    const [students, setStudents] = useState<any[]>([])
    const [selectedStudent, setSelectedStudent] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [searching, setSearching] = useState(false)

    // Form Data
    const [formData, setFormData] = useState({
        type: 'ENTREVISTA',
        severity: 'MEDIA',
        title: '',
        description: '',
        agreements: ''
    })

    // Search Students
    useEffect(() => {
        const searchStudents = async () => {
            if (searchTerm.length < 3 || !tenant) {
                setStudents([])
                return
            }

            setSearching(true)
            try {
                const { data } = await supabase
                    .from('students')
                    .select('id, first_name, last_name_paternal, last_name_maternal, groups(grade, section)')
                    .eq('tenant_id', tenant.id)
                    .ilike('first_name', `%${searchTerm}%`) // Simple search for demo, ideally full text search or combining fields
                    .limit(5)

                setStudents(data || [])
            } catch (error) {
                console.error('Error searching students:', error)
            } finally {
                setSearching(false)
            }
        }

        const debounce = setTimeout(searchStudents, 500)
        return () => clearTimeout(debounce)
    }, [searchTerm, tenant])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedStudent || !tenant) return

        setLoading(true)
        try {
            const { error } = await supabase.from('student_tracking').insert({
                tenant_id: tenant.id,
                student_id: selectedStudent.id,
                type: formData.type,
                severity: formData.severity,
                title: formData.title,
                description: formData.description,
                agreements: formData.agreements,
                status: 'ABIERTO',
                created_by: (await supabase.auth.getUser()).data.user?.id
            })

            if (error) throw error

            onSuccess()
            onClose()
        } catch (error) {
            console.error('Error creating tracking entry:', error)
            alert('Error al guardar el registro. Intente nuevamente.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-black text-slate-800">Nuevo Registro de Seguimiento</h2>
                        <p className="text-sm text-slate-500 font-medium">
                            {step === 1 ? 'Paso 1: Seleccionar Alumno' : `Paso 2: Detalles del Registro (${selectedStudent?.first_name})`}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {step === 1 ? (
                        <div className="space-y-6">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar alumno por nombre..."
                                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-xl text-lg font-medium focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div className="space-y-2">
                                {searching ? (
                                    <p className="text-center text-gray-400 py-4">Buscando...</p>
                                ) : students.length > 0 ? (
                                    students.map(student => (
                                        <button
                                            key={student.id}
                                            onClick={() => {
                                                setSelectedStudent(student)
                                                setStep(2)
                                            }}
                                            className="w-full text-left p-4 hover:bg-blue-50 border border-transparent hover:border-blue-200 rounded-xl transition-all group flex justify-between items-center"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                                                    {student.first_name[0]}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-800">{student.first_name} {student.last_name_paternal} {student.last_name_maternal}</p>
                                                    <p className="text-sm text-gray-500">{student.groups?.grade}° "{student.groups?.section}"</p>
                                                </div>
                                            </div>
                                            <CheckCircle2 className="w-5 h-5 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                    ))
                                ) : searchTerm.length > 2 && (
                                    <div className="text-center py-8">
                                        <User className="w-12 h-12 text-gray-200 mx-auto mb-2" />
                                        <p className="text-gray-400">No se encontraron alumnos</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <form id="trackingForm" onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Tipo de Registro</label>
                                    <select
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                        value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                                    >
                                        <option value="ENTREVISTA">Entrevista con Padres</option>
                                        <option value="CANALIZACION">Canalización</option>
                                        <option value="SEGUIMIENTO">Seguimiento General</option>
                                        <option value="BITACORA">Bitácora Socioemocional</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Nivel de Prioridad</label>
                                    <select
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                                        value={formData.severity}
                                        onChange={e => setFormData({ ...formData, severity: e.target.value })}
                                    >
                                        <option value="BAJA">Baja</option>
                                        <option value="MEDIA">Media</option>
                                        <option value="ALTA">Alta</option>
                                        <option value="URGENTE">Urgente</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Título / Asunto</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Ej. Entrevista por bajo rendimiento, Reporte de conducta..."
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Descripción de la Situación</label>
                                <textarea
                                    required
                                    rows={4}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                    placeholder="Detalles de lo observado en la entrevista o incidencia..."
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Acuerdos y Compromisos</label>
                                <textarea
                                    rows={3}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                    placeholder="Acuerdos establecidos con el alumno o padre de familia..."
                                    value={formData.agreements}
                                    onChange={e => setFormData({ ...formData, agreements: e.target.value })}
                                />
                            </div>
                        </form>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-2xl">
                    {step === 2 && (
                        <button
                            type="button"
                            onClick={() => setStep(1)}
                            className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors"
                        >
                            Atrás
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 text-slate-500 font-bold hover:bg-slate-200 rounded-xl transition-colors"
                    >
                        Cancelar
                    </button>
                    {step === 2 && (
                        <button
                            type="submit"
                            form="trackingForm"
                            disabled={loading}
                            className="px-8 py-2.5 bg-slate-900 text-white font-bold rounded-xl shadow-lg shadow-slate-300 hover:bg-black hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                        >
                            {loading ? 'Guardando...' : <><Save className="w-4 h-4" /> Guardar Registro</>}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
