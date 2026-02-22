import { useState, useEffect } from 'react'
import { X, Save, Calendar, Clock, Bell, Users } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

type EventModalProps = {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    tenantId: string
    userId: string
    userRole: string
    initialDate?: Date
}

export const EventModal = ({
    isOpen,
    onClose,
    onSuccess,
    tenantId,
    userId,
    userRole,
    initialDate
}: EventModalProps) => {
    const [isLoading, setIsLoading] = useState(false)
    const [groups, setGroups] = useState<any[]>([])
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        date: initialDate ? initialDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        time: '09:00',
        notifyTutors: false,
        groupId: '',
        type: 'teacher' // teacher or school
    })

    useEffect(() => {
        if (isOpen) {
            fetchGroups()
            if (initialDate) {
                setFormData(prev => ({ ...prev, date: initialDate.toISOString().split('T')[0] }))
            }
        }
    }, [isOpen, initialDate])

    const fetchGroups = async () => {
        try {
            let query = supabase.from('groups').select('id, grade, section').eq('tenant_id', tenantId)

            // If teacher, maybe filter by group_subjects?
            // For now, let's show all groups if they are Director/Admin, or we can just show all groups for the teacher to choose which one to notify.

            const { data, error } = await query
            if (error) throw error
            setGroups(data || [])
        } catch (err) {
            console.error('Error fetching groups:', err)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.title) return

        setIsLoading(true)
        try {
            const start_time = `${formData.date}T${formData.time}:00`
            const end_time = `${formData.date}T${formData.time}:00` // 0 duration for now

            let eventId: string | null = null

            if (formData.type === 'school') {
                const { data, error } = await supabase.from('calendar_events').insert({
                    title: formData.title,
                    description: formData.description,
                    start_date: formData.date,
                    end_date: formData.date,
                    tenant_id: tenantId,
                    type: 'direction'
                }).select().single()
                if (error) throw error
                eventId = data.id
            } else {
                const { data, error } = await supabase.from('teacher_events').insert({
                    title: formData.title,
                    description: formData.description,
                    start_time,
                    end_time,
                    teacher_id: userId,
                    tenant_id: tenantId,
                    notify_tutors: formData.notifyTutors,
                    group_id: formData.groupId || null
                }).select().single()
                if (error) throw error
                eventId = data.id

                // Handle Notifications
                if (formData.notifyTutors) {
                    await createTutorNotifications(eventId!, formData)
                }
            }

            onSuccess()
            onClose()
        } catch (err: any) {
            alert('Error al guardar el evento: ' + err.message)
        } finally {
            setIsLoading(false)
        }
    }

    const createTutorNotifications = async (eventId: string, data: any) => {
        try {
            // Find students in the target group (or all students if no group)
            let studentQuery = supabase.from('students').select('id, first_name').eq('tenant_id', tenantId)
            if (data.groupId) {
                studentQuery = studentQuery.eq('group_id', data.groupId)
            }

            const { data: students } = await studentQuery
            if (!students) return

            for (const student of students) {
                // Find guardians
                const { data: guardians } = await supabase
                    .from('guardians')
                    .select('user_id')
                    .eq('student_id', student.id)

                if (!guardians) continue

                for (const guardian of guardians) {
                    await supabase.from('student_alerts').insert({
                        tenant_id: tenantId,
                        tutor_id: guardian.user_id,
                        student_id: student.id,
                        type: 'CALENDAR_EVENT',
                        title: 'Nuevo Evento / Citatorio',
                        message: `Se ha programado: ${data.title}. Fecha: ${new Date(data.date).toLocaleDateString()}. Hora: ${data.time}. ${data.description ? `Nota: ${data.description}` : ''}`,
                        metadata: {
                            event_id: eventId,
                            date: data.date,
                            time: data.time
                        }
                    })
                }
            }
        } catch (err) {
            console.error('Error creating tutor notifications:', err)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                <div className="p-8 bg-gradient-to-r from-indigo-600 to-blue-600 flex justify-between items-center text-white shrink-0">
                    <div>
                        <h2 className="text-2xl font-black tracking-tight">Nuevo Evento</h2>
                        <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest mt-1">Agenda Escolar</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Título del Evento</label>
                            <input
                                type="text"
                                required
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                                placeholder="Ej: Reunión con Padres de Familia"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Fecha</label>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="date"
                                        required
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-5 py-4 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Hora</label>
                                <div className="relative">
                                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="time"
                                        required
                                        value={formData.time}
                                        onChange={e => setFormData({ ...formData, time: e.target.value })}
                                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-5 py-4 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Descripción (Opcional)</label>
                            <textarea
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 outline-none min-h-[100px]"
                                placeholder="Añade más detalles sobre el evento..."
                            />
                        </div>

                        {(userRole === 'DIRECTOR' || userRole === 'ADMIN') && (
                            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="eventType"
                                        checked={formData.type === 'teacher'}
                                        onChange={() => setFormData({ ...formData, type: 'teacher' })}
                                        className="w-4 h-4 text-indigo-600"
                                    />
                                    <span className="text-xs font-bold text-gray-700">Mi Agenda</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="eventType"
                                        checked={formData.type === 'school'}
                                        onChange={() => setFormData({ ...formData, type: 'school' })}
                                        className="w-4 h-4 text-indigo-600"
                                    />
                                    <span className="text-xs font-bold text-gray-700">Evento Escolar (Global)</span>
                                </label>
                            </div>
                        )}

                        <div className={`p-6 rounded-[2rem] border-2 transition-all ${formData.notifyTutors ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-100'}`}>
                            <label className="flex items-center justify-between cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-xl ${formData.notifyTutors ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                        <Bell className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <span className="block text-sm font-black text-gray-900">Notificar a Padres</span>
                                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">Enviar aviso por sistema</span>
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={formData.notifyTutors}
                                    onChange={e => setFormData({ ...formData, notifyTutors: e.target.checked })}
                                    className="w-5 h-5 rounded-lg border-gray-300 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                                />
                            </label>

                            {formData.notifyTutors && (
                                <div className="mt-6 pt-6 border-t border-indigo-100 animate-in slide-in-from-top-4 duration-300">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-2">¿A quién notificar?</label>
                                    <div className="relative">
                                        <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                                        <select
                                            value={formData.groupId}
                                            onChange={e => setFormData({ ...formData, groupId: e.target.value })}
                                            className="w-full bg-white border border-indigo-100 rounded-xl pl-12 pr-5 py-3 text-xs font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none appearance-none"
                                        >
                                            <option value="">A todos los alumnos de la escuela</option>
                                            {groups.map(g => (
                                                <option key={g.id} value={g.id}>{g.grade}° {g.section}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-3xl shadow-xl shadow-indigo-200 transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 mt-4"
                    >
                        {isLoading ? (
                            <Clock className="w-5 h-5 animate-spin" />
                        ) : (
                            <Save className="w-5 h-5" />
                        )}
                        {isLoading ? 'Guardando...' : 'Crear Evento'}
                    </button>
                </form>
            </div>
        </div>
    )
}
