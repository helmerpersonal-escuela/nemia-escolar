import { useState, useEffect } from 'react'
import { X, Save, Trash2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'

type ScheduleEntry = {
    id: string
    group_id: string
    day_of_week: string
    start_time: string
    end_time: string
    subject_id?: string
    custom_subject?: string
}

type EditScheduleModalProps = {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    entry: Partial<ScheduleEntry> | null // null means new entry
    groupId: string
    initialDay?: string
    initialStartTime?: string
    initialEndTime?: string
}

export const EditScheduleModal = ({
    isOpen,
    onClose,
    onSuccess,
    entry,
    groupId,
    initialDay = 'MONDAY',
    initialStartTime = '08:00',
    initialEndTime = '08:50'
}: EditScheduleModalProps) => {
    const { data: tenant } = useTenant()
    const [isLoading, setIsLoading] = useState(false)
    const [groups, setGroups] = useState<any[]>([])
    const [mySubjects, setMySubjects] = useState<any[]>([])
    const [formData, setFormData] = useState({
        group_id: '',
        day_of_week: 'MONDAY',
        start_time: '08:00',
        end_time: '09:00',
        subject_id: '',
        custom_subject: ''
    })

    // Fetch Groups
    useEffect(() => {
        const loadGroups = async () => {
            if (!tenant?.id) return
            const { data } = await supabase
                .from('groups')
                .select('id, grade, section, shift')
                .eq('tenant_id', tenant.id)
                .order('grade')
                .order('section')
            if (data) setGroups(data)
        }
        loadGroups()
    }, [tenant?.id])

    // Load subjects for the selected group AND user's profile subjects
    useEffect(() => {
        const loadSubjects = async () => {
            if (!formData.group_id || !tenant?.id) {
                setMySubjects([])
                return
            }

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // 1. Fetch subjects already in the group
            const { data: groupData } = await supabase
                .from('group_subjects')
                .select('subject_catalog_id, custom_name, subject_catalog(name)')
                .eq('group_id', formData.group_id)

            // 2. Fetch user's profile subjects (what they "have" to teach)
            const { data: profileData } = await supabase
                .from('profile_subjects')
                .select('subject_catalog_id, custom_detail, subject_catalog(name)')
                .eq('profile_id', user.id)

            const groupSubs = (groupData || []).map((s: any) => ({
                id: s.subject_catalog_id,
                name: s.subject_catalog?.name || s.custom_name,
                isCustom: !s.subject_catalog_id,
                isLinked: true
            }))

            const profileSubs = (profileData || []).map((s: any) => ({
                id: s.subject_catalog_id,
                name: s.subject_catalog?.name || s.custom_detail,
                isCustom: !s.subject_catalog_id,
                isLinked: false
            }))

            // Merge them, prioritizing group associations
            const merged = [...groupSubs]
            profileSubs.forEach(ps => {
                const exists = merged.some(ms =>
                    (ms.id && ms.id === ps.id) ||
                    (ms.isCustom && ps.isCustom && ms.name === ps.name)
                )
                if (!exists) merged.push(ps)
            })

            setMySubjects(merged)
        }
        loadSubjects()
    }, [formData.group_id, tenant?.id])

    useEffect(() => {
        if (isOpen) {
            if (entry?.id) {
                // Editing existing entry
                setFormData({
                    group_id: entry.group_id || groupId || (groups.length > 0 ? groups[0].id : ''),
                    day_of_week: entry.day_of_week || 'MONDAY',
                    start_time: entry.start_time?.slice(0, 5) || '08:00',
                    end_time: entry.end_time?.slice(0, 5) || '09:00',
                    subject_id: entry.subject_id || '',
                    custom_subject: entry.custom_subject || ''
                })
            } else {
                // New entry
                setFormData({
                    group_id: groupId || (groups.length > 0 ? groups[0].id : ''),
                    day_of_week: initialDay || 'MONDAY',
                    start_time: initialStartTime || '08:00',
                    end_time: initialEndTime || '09:00',
                    subject_id: '',
                    custom_subject: ''
                })
            }
        }
    }, [isOpen, entry, groupId, groups, initialDay, initialStartTime, initialEndTime])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!tenant?.id) return

        if (!formData.group_id) {
            alert('Selecciona un grupo')
            return
        }

        if (!formData.subject_id) {
            alert('Selecciona una materia')
            return
        }

        setIsLoading(true)
        try {
            // Step 1: Ensure subject-group association exists
            const selectedSub = mySubjects.find(s =>
                (s.id && s.id === formData.subject_id) ||
                (s.isCustom && s.name === formData.custom_subject)
            )

            if (selectedSub && !selectedSub.isLinked) {
                // Link it now
                const { error: linkError } = await supabase
                    .from('group_subjects')
                    .insert({
                        group_id: formData.group_id,
                        tenant_id: tenant.id,
                        subject_catalog_id: selectedSub.id || null,
                        custom_name: selectedSub.isCustom ? selectedSub.name : null,
                        teacher_id: (await supabase.auth.getUser()).data.user?.id
                    })
                if (linkError) throw linkError
            }

            const dataToSave = {
                tenant_id: tenant.id,
                group_id: formData.group_id,
                day_of_week: formData.day_of_week,
                start_time: formData.start_time,
                end_time: formData.end_time,
                subject_id: formData.subject_id || null,
                custom_subject: formData.subject_id ? null : (formData.custom_subject || 'Actividad Personalizada')
            }

            if (entry?.id) {
                const { error } = await supabase
                    .from('schedules')
                    .update(dataToSave)
                    .eq('id', entry.id)
                if (error) throw error
            } else {
                const { error } = await supabase
                    .from('schedules')
                    .insert(dataToSave)
                if (error) throw error
            }

            onSuccess()
            onClose()
        } catch (error: any) {
            alert('Error al guardar horario: ' + error.message)
        } finally {
            setIsLoading(false)
        }
    }

    const handleDelete = async () => {
        if (!entry?.id || !confirm('¿Estás seguro de eliminar esta clase?')) return

        setIsLoading(true)
        try {
            const { error } = await supabase.from('schedules').delete().eq('id', entry.id)
            if (error) throw error
            onSuccess()
            onClose()
        } catch (error: any) {
            alert('Error al eliminar: ' + error.message)
        } finally {
            setIsLoading(false)
        }
    }

    if (!isOpen) return null

    const dayLabels: Record<string, string> = {
        'MONDAY': 'Lunes',
        'TUESDAY': 'Martes',
        'WEDNESDAY': 'Miércoles',
        'THURSDAY': 'Jueves',
        'FRIDAY': 'Viernes',
        'SATURDAY': 'Sábado',
        'SUNDAY': 'Domingo'
    }

    const formatTime = (time: string) => {
        if (!time) return ''
        const [h, m] = time.split(':')
        const hour = parseInt(h)
        const ampm = hour >= 12 ? 'p.m.' : 'a.m.'
        const hour12 = hour % 12 || 12
        return `${hour12}:${m} ${ampm}`
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 my-8">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">
                            {entry?.id ? 'Editar Clase' : 'Agregar Clase'}
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            {dayLabels[formData.day_of_week]} • {formatTime(formData.start_time)} - {formatTime(formData.end_time)}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Group Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Seleccionar Grupo</label>
                        <select
                            className="mt-1 block w-full rounded-md border border-gray-300 py-2.5 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-base"
                            value={formData.group_id}
                            onChange={e => setFormData({ ...formData, group_id: e.target.value })}
                            required
                        >
                            <option value="">-- Elige el grupo --</option>
                            {groups.map(g => (
                                <option key={g.id} value={g.id}>
                                    {g.grade}° "{g.section}" - {g.shift === 'MORNING' ? 'Matutino' : 'Vespertino'}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Subject Selection (Filtered) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Materia / Actividad</label>

                        {mySubjects.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                {mySubjects.map(subject => (
                                    <div
                                        key={subject.id || subject.name}
                                        onClick={() => setFormData({ ...formData, subject_id: subject.id, custom_subject: subject.isCustom ? subject.name : '' })}
                                        className={`cursor-pointer border rounded-lg p-3 flex items-center transition-all ${(subject.id && formData.subject_id === subject.id) || (subject.isCustom && formData.custom_subject === subject.name)
                                            ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:border-blue-200'}`}
                                    >
                                        <div className={`w-4 h-4 rounded-full border mr-3 flex items-center justify-center ${(subject.id && formData.subject_id === subject.id) || (subject.isCustom && formData.custom_subject === subject.name)
                                            ? 'border-blue-600' : 'border-gray-300'}`}>
                                            {((subject.id && formData.subject_id === subject.id) || (subject.isCustom && formData.custom_subject === subject.name)) && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-xs text-gray-900 uppercase">{subject.name}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="mb-4 p-4 bg-amber-50 text-amber-800 rounded-md text-sm border border-amber-100">
                                {formData.group_id
                                    ? 'Este grupo no tiene materias asignadas. Ve a "Mis Grupos" y edita el grupo para asignarle materias.'
                                    : 'Selecciona un grupo primero para ver sus materias.'}
                            </div>
                        )}

                        {/* Hidden Custom Subject Input (Removed as per restriction) 
                            User must verify permissions first if they want custom activities
                        */}
                    </div>

                    <div className="flex justify-between pt-4 border-t">
                        {entry?.id ? (
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200"
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                            </button>
                        ) : <div></div>}

                        <div className="flex space-x-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                            >
                                <Save className="h-4 w-4 mr-2" />
                                {isLoading ? 'Guardando...' : 'Guardar Horario'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}
