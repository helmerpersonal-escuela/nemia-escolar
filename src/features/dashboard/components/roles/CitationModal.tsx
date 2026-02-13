import { useState, useEffect } from 'react'
import { X, Search, ChevronRight, AlertCircle, Calendar, Clock, Loader2 } from 'lucide-react'
import { supabase } from '../../../../lib/supabase'
import { useTenant } from '../../../../hooks/useTenant'

interface CitationModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

export const CitationModal = ({ isOpen, onClose, onSuccess }: CitationModalProps) => {
    const { data: tenant } = useTenant()
    const [step, setStep] = useState<'STUDENT' | 'FORM'>('STUDENT')
    const [groups, setGroups] = useState<any[]>([])
    const [selectedGroupId, setSelectedGroupId] = useState<string>('')
    const [students, setStudents] = useState<any[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedStudent, setSelectedStudent] = useState<any | null>(null)
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    const [formData, setFormData] = useState({
        reason: '',
        meeting_date: new Date().toISOString().split('T')[0],
        meeting_time: '08:00',
        notes: ''
    })

    useEffect(() => {
        if (isOpen && tenant) {
            fetchGroups()
        }
    }, [isOpen, tenant])

    const fetchGroups = async () => {
        const { data } = await supabase.from('groups').select('*').eq('tenant_id', tenant?.id)
        if (data) {
            setGroups(data)
            if (data.length > 0) setSelectedGroupId(data[0].id)
        }
    }

    useEffect(() => {
        if (selectedGroupId) {
            fetchStudents()
        }
    }, [selectedGroupId])

    const fetchStudents = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('students')
            .select('*')
            .eq('group_id', selectedGroupId)
        if (data) setStudents(data)
        setLoading(false)
    }

    const handleSubmit = async () => {
        if (!selectedStudent || !tenant) return
        setSubmitting(true)
        const { error } = await supabase.from('student_citations').insert([{
            ...formData,
            student_id: selectedStudent.id,
            tenant_id: tenant.id,
            requested_by: (await supabase.auth.getUser()).data.user?.id
        }])

        if (!error) {
            onSuccess()
            onClose()
            setStep('STUDENT')
            setSelectedStudent(null)
            setFormData({
                reason: '',
                meeting_date: new Date().toISOString().split('T')[0],
                meeting_time: '08:00',
                notes: ''
            })
        }
        setSubmitting(false)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-white/20 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-8 bg-blue-600 text-white flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="text-2xl font-black tracking-tight uppercase leading-none">Generar Citatorio</h3>
                        <p className="text-blue-100 text-[10px] font-bold uppercase tracking-widest mt-1">
                            {step === 'STUDENT' ? 'Paso 1: Seleccionar Alumno' : `Paso 2: Detalles de la Cita (${selectedStudent?.first_name})`}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                    {step === 'STUDENT' ? (
                        <div className="space-y-6">
                            <div className="flex gap-4">
                                <select
                                    value={selectedGroupId}
                                    onChange={(e) => setSelectedGroupId(e.target.value)}
                                    className="px-4 py-3 bg-slate-50 border-2 border-transparent rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                                >
                                    {groups.map(g => (
                                        <option key={g.id} value={g.id}>{g.grade}° "{g.section}"</option>
                                    ))}
                                </select>
                                <div className="relative flex-1">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                    <input
                                        type="text"
                                        placeholder="Filtrar por nombre..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {loading ? (
                                    <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-300">
                                        <Loader2 className="w-8 h-8 animate-spin mb-4" />
                                        <p className="text-[10px] font-black uppercase tracking-widest">Buscando alumnos...</p>
                                    </div>
                                ) : students.filter(s => `${s.first_name} ${s.last_name_paternal}`.toLowerCase().includes(searchQuery.toLowerCase())).map(student => (
                                    <button
                                        key={student.id}
                                        onClick={() => {
                                            setSelectedStudent(student)
                                            setStep('FORM')
                                        }}
                                        className="p-4 rounded-2xl border-2 border-slate-50 hover:border-blue-200 hover:bg-blue-50/30 transition-all text-left flex items-center justify-between group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-all">
                                                {student.first_name[0]}
                                            </div>
                                            <span className="font-bold text-slate-700 text-sm">{student.first_name} {student.last_name_paternal}</span>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-slate-200 group-hover:text-blue-400" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha de la Cita</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                        <input
                                            type="date"
                                            value={formData.meeting_date}
                                            onChange={(e) => setFormData({ ...formData, meeting_date: e.target.value })}
                                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hora</label>
                                    <div className="relative">
                                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                        <input
                                            type="time"
                                            value={formData.meeting_time}
                                            onChange={(e) => setFormData({ ...formData, meeting_time: e.target.value })}
                                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Motivo del Citatorio</label>
                                <textarea
                                    rows={3}
                                    placeholder="Ej: Seguimiento académico y problemas de conducta..."
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observaciones Internas</label>
                                <textarea
                                    rows={2}
                                    placeholder="Notas adicionales solo para el personal..."
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                />
                            </div>

                            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-blue-600 shrink-0" />
                                <p className="text-[10px] font-bold text-blue-700 leading-relaxed uppercase">
                                    Al guardar, se generará un registro oficial. Asegúrate de que la fecha y hora sean correctas antes de proceder.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-slate-50 flex gap-3 shrink-0">
                    {step === 'FORM' && (
                        <button
                            onClick={() => setStep('STUDENT')}
                            className="px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all"
                        >
                            Atrás
                        </button>
                    )}
                    <button
                        onClick={step === 'STUDENT' ? onClose : handleSubmit}
                        disabled={submitting || (step === 'FORM' && !formData.reason)}
                        className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all transform hover:-translate-y-1 active:translate-y-0 disabled:opacity-30 disabled:transform-none uppercase text-xs tracking-widest"
                    >
                        {submitting ? 'Guardando...' : step === 'STUDENT' ? 'Cancelar' : 'Generar Citatorio'}
                    </button>
                </div>
            </div>
        </div>
    )
}
