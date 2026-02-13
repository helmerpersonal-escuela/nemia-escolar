import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Settings, Edit2, Save } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { useProfile } from '../../../hooks/useProfile'
import { ScheduleGrid } from '../components/ScheduleGrid'
import { EditScheduleModal } from '../components/EditScheduleModal'
import { ScheduleSettingsForm } from '../components/ScheduleSettingsForm'

export const SchedulePage = () => {
    const { data: tenant } = useTenant()
    const { profile } = useProfile()
    const [isEditing, setIsEditing] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)

    const isTeacher = profile?.role === 'TEACHER' || profile?.role === 'INDEPENDENT_TEACHER'
    const isStaff = ['ADMIN', 'DIRECTOR', 'ACADEMIC_COORD', 'TECH_COORD', 'SCHOOL_CONTROL', 'INDEPENDENT_TEACHER'].includes(profile?.role || '')

    const [viewType, setViewType] = useState<'GROUP' | 'TEACHER'>('GROUP')
    const [selectedGroupId, setSelectedGroupId] = useState<string>('')
    const [selectedTeacherId, setSelectedTeacherId] = useState<string>('')

    const [modalData, setModalData] = useState<{
        entry: any | null,
        initialDay?: string,
        initialStartTime?: string
        initialEndTime?: string
    }>({ entry: null })

    // Fetch Settings
    const { data: settings, refetch: refetchSettings } = useQuery({
        queryKey: ['schedule_settings', tenant?.id],
        enabled: !!tenant?.id,
        queryFn: async () => {
            const { data } = await supabase
                .from('schedule_settings')
                .select('*')
                .eq('tenant_id', tenant?.id)
                .maybeSingle()
            return data
        }
    })

    // Fetch Master Schedule
    const { data: scheduleEntries, isLoading: loadingSchedule, refetch: refetchSchedule } = useQuery({
        queryKey: ['schedule_master', tenant?.id, viewType, selectedGroupId, selectedTeacherId, profile?.id],
        enabled: !!tenant?.id && !!profile?.id,
        queryFn: async () => {
            // 1. If filtering by teacher, we first need their assignments
            let teacherAssignments: any[] = []
            if (viewType === 'TEACHER' && selectedTeacherId) {
                const { data } = await supabase
                    .from('group_subjects')
                    .select('group_id, subject_catalog_id, custom_name')
                    .eq('teacher_id', selectedTeacherId)
                teacherAssignments = data || []
            }

            let query = supabase
                .from('schedules')
                .select(`
                    *,
                    subject:subject_catalog (
                        id,
                        name,
                        field_of_study
                    ),
                    group:groups (
                        id,
                        grade,
                        section,
                        shift
                    )
                `)
                .eq('tenant_id', tenant?.id)

            if (viewType === 'GROUP' && selectedGroupId) {
                query = query.eq('group_id', selectedGroupId)
            }

            const { data, error } = await query
            if (error) throw error

            if (viewType === 'TEACHER' && selectedTeacherId) {
                return data.filter((item: any) =>
                    teacherAssignments.some(a =>
                        a.group_id === item.group_id &&
                        (a.subject_catalog_id === item.subject_id || a.custom_name === item.custom_subject)
                    )
                ).map((item: any) => ({
                    ...item,
                    subject: item.subject,
                    group: item.group
                }))
            }

            if (isTeacher && !selectedGroupId && viewType === 'GROUP') {
                // Default teacher view filter
                const { data: assignments } = await supabase
                    .from('group_subjects')
                    .select('group_id, subject_catalog_id, custom_name')
                    .eq('teacher_id', profile.id)

                return data.filter((item: any) =>
                    assignments?.some(a =>
                        a.group_id === item.group_id &&
                        (a.subject_catalog_id === item.subject_id || a.custom_name === item.custom_subject)
                    )
                ).map((item: any) => ({ ...item }))
            }

            return data.map((item: any) => ({ ...item }))
        }
    })

    // Fetch Teachers
    const { data: teachers } = useQuery({
        queryKey: ['teachers', tenant?.id],
        enabled: !!tenant?.id,
        queryFn: async () => {
            const { data } = await supabase
                .from('profiles')
                .select('id, first_name, last_name_paternal, role')
                .eq('tenant_id', tenant?.id)
                .eq('role', 'TEACHER')
                .order('first_name')
            return data || []
        }
    })

    // Fetch Groups for color indexing
    const { data: groups } = useQuery({
        queryKey: ['groups', tenant?.id],
        enabled: !!tenant?.id,
        queryFn: async () => {
            const { data } = await supabase
                .from('groups')
                .select('id, grade, section, shift')
                .eq('tenant_id', tenant?.id)
                .order('grade', { ascending: true })
                .order('section', { ascending: true })
            return data || []
        }
    })

    const handleSlotClick = (day: string, startTime: string, endTime: string) => {
        if (!isEditing) return
        setModalData({
            entry: null,
            initialDay: day,
            initialStartTime: startTime,
            initialEndTime: endTime
        })
        setIsModalOpen(true)
    }

    const handleEntryClick = (entry: any) => {
        if (!isEditing) return
        setModalData({
            entry: entry
        })
        setIsModalOpen(true)
    }

    const handleSettingsSuccess = () => {
        refetchSettings()
        setIsSettingsOpen(false)
    }

    if (isSettingsOpen) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                        <Settings className="mr-2 h-7 w-7 text-blue-600" />
                        Configuración de Horario
                    </h1>
                    <button
                        onClick={() => setIsSettingsOpen(false)}
                        className="text-gray-600 hover:text-gray-900"
                    >
                        Volver al Horario
                    </button>
                </div>
                <ScheduleSettingsForm onSuccess={handleSettingsSuccess} />
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-12 animate-in fade-in duration-500">
            <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-indigo-50 opacity-50" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 flex items-center tracking-tight">
                            <span className="p-2 bg-blue-600 rounded-xl mr-3 shadow-lg shadow-blue-200">
                                <Calendar className="h-6 w-6 text-white" />
                            </span>
                            {isTeacher ? 'Mi Horario' : 'Horario Maestro'}
                        </h1>
                        <p className="mt-2 text-gray-600 font-medium ml-1">
                            {isTeacher
                                ? 'Consulta tus clases y horarios asignados para este ciclo escolar.'
                                : isEditing
                                    ? 'Modo Edición: Haz clic en los espacios para agregar o modificar clases.'
                                    : 'Vista de lectura. Activa la edición para realizar cambios.'
                            }
                        </p>
                    </div>

                    {isStaff && (
                        <div className="flex flex-col sm:flex-row items-center gap-3">
                            <button
                                onClick={() => profile?.is_demo ? alert('Modo Demo: La configuración de bloques está deshabilitada.') : setIsSettingsOpen(true)}
                                className={`w-full sm:w-auto inline-flex justify-center items-center px-4 py-3 border shadow-sm text-sm font-bold rounded-xl transition-all ${profile?.is_demo ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'text-gray-700 bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                                    }`}
                            >
                                <Settings className="h-4 w-4 mr-2 text-gray-400" />
                                Configurar Bloques
                            </button>

                            <button
                                onClick={() => profile?.is_demo ? alert('Modo Demo: La edición del horario está deshabilitada.') : setIsEditing(!isEditing)}
                                className={`w-full sm:w-auto inline-flex justify-center items-center px-4 py-3 border border-transparent shadow-lg text-sm font-bold rounded-xl text-white transition-all transform hover:scale-105 ${profile?.is_demo ? 'bg-gray-400 cursor-not-allowed' : (isEditing ? 'bg-green-600 hover:bg-green-700 shadow-green-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200')
                                    }`}
                            >
                                {isEditing ? (
                                    <>
                                        <Save className="h-4 w-4 mr-2" />
                                        Guardar y Salir
                                    </>
                                ) : (
                                    <>
                                        <Edit2 className="h-4 w-4 mr-2" />
                                        Editar Horario
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Filters Section */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col md:flex-row items-center gap-6">
                <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button
                        onClick={() => {
                            setViewType('GROUP')
                            setSelectedTeacherId('')
                        }}
                        className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${viewType === 'GROUP' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Por Grupo
                    </button>
                    <button
                        onClick={() => {
                            setViewType('TEACHER')
                            setSelectedGroupId('')
                        }}
                        className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${viewType === 'TEACHER' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Por Docente
                    </button>
                </div>

                <div className="flex-1 w-full">
                    {viewType === 'GROUP' ? (
                        <select
                            value={selectedGroupId}
                            onChange={(e) => setSelectedGroupId(e.target.value)}
                            className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-blue-100 outline-none"
                        >
                            <option value="">{isTeacher ? 'Mi Horario (Selecciona grupo para filtrar)' : 'Seleccionar Grupo...'}</option>
                            {groups?.map(g => (
                                <option key={g.id} value={g.id}>{g.grade}° {g.section} - {g.shift}</option>
                            ))}
                        </select>
                    ) : (
                        <select
                            value={selectedTeacherId}
                            onChange={(e) => setSelectedTeacherId(e.target.value)}
                            className="w-full bg-gray-50 border-none rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-blue-100 outline-none"
                        >
                            <option value="">Seleccionar Docente...</option>
                            {teachers?.map(t => (
                                <option key={t.id} value={t.id}>{t.first_name} {t.last_name_paternal}</option>
                            ))}
                        </select>
                    )}
                </div>

                {loadingSchedule && (
                    <div className="flex items-center gap-2 text-blue-600 animate-pulse">
                        <div className="w-2 h-2 bg-current rounded-full" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Actualizando...</span>
                    </div>
                )}
            </div>

            {settings ? (
                <div className={`transition-opacity ${isEditing ? 'opacity-100' : 'opacity-90'}`}>
                    <ScheduleGrid
                        entries={scheduleEntries || []}
                        settings={settings}
                        onSlotClick={handleSlotClick}
                        onEntryClick={handleEntryClick}
                        groups={groups || []}
                    />
                </div>
            ) : (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                    <Settings className="mx-auto h-12 w-12 text-gray-300" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">
                        {isTeacher ? 'Horario no disponible' : 'Configuración requerida'}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                        {isTeacher
                            ? 'Aún no se ha configurado el horario escolar. Por favor, contacta al administrador.'
                            : 'Primero define los módulos y recesos.'
                        }
                    </p>
                    {isStaff && (
                        <div className="mt-6">
                            <button
                                onClick={() => setIsSettingsOpen(true)}
                                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                            >
                                <Settings className="-ml-1 mr-2 h-5 w-5" />
                                Configurar Ahora
                            </button>
                        </div>
                    )}
                </div>
            )}

            {isModalOpen && (
                <EditScheduleModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={() => {
                        refetchSchedule()
                    }}
                    entry={modalData.entry}
                    groupId={selectedGroupId} // Pass selected group ID for defaulting
                    initialDay={modalData.initialDay}
                    initialStartTime={modalData.initialStartTime}
                    initialEndTime={modalData.initialEndTime}
                />
            )}
        </div>
    )
}
