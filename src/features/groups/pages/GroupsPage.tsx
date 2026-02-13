import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Users, School, Trash2, Edit, AlertTriangle, ArrowRight, BookOpen, GraduationCap, ClipboardList } from 'lucide-react'
import { EditGroupModal } from '../components/EditGroupModal'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { useProfile } from '../../../hooks/useProfile'

type Group = {
    id: string
    grade: string
    section: string
    shift: string
    student_count?: number
    subjects?: Array<{
        id: string
        subject_catalog_id: string | null
        custom_name: string | null
        catalog_name?: string
        display_name?: string
    }>
    students?: Array<{ count: number }>
}

export const GroupsPage = () => {
    const navigate = useNavigate()
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isModifyingGroup, setIsModifyingGroup] = useState<Group | null>(null)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const queryClient = useQueryClient()
    const { data: tenant } = useTenant()
    const { profile } = useProfile()

    const isTeacher = profile?.role === 'TEACHER'
    const isStaff = ['ADMIN', 'DIRECTOR', 'ACADEMIC_COORD', 'TECH_COORD', 'SCHOOL_CONTROL'].includes(profile?.role || '')

    // Fetch Groups with their subjects
    const { data: groups, isLoading } = useQuery({
        queryKey: ['groups', tenant?.id],
        enabled: !!tenant?.id,
        queryFn: async () => {
            const { data: groupsData, error: groupsError } = await supabase
                .from('groups')
                .select('*, subjects:group_subjects(*, teacher:profiles(full_name)), students:students(count)')
                .eq('tenant_id', tenant?.id)
                .order('grade', { ascending: true })
                .order('section', { ascending: true })

            if (groupsError) throw groupsError

            const { data: { user } } = await supabase.auth.getUser()

            let specialtyMap: any = {}
            if (user) {
                const { data: profileSubjects } = await supabase
                    .from('profile_subjects')
                    .select('subject_catalog_id, custom_detail')
                    .eq('profile_id', user.id)

                specialtyMap = (profileSubjects || []).reduce((acc: any, curr: any) => {
                    if (curr.custom_detail) {
                        acc[curr.subject_catalog_id] = curr.custom_detail
                    }
                    return acc
                }, {})
            }

            const { data: catalogData } = await supabase.from('subject_catalog').select('id, name')
            const catalogMap = (catalogData || []).reduce((acc: any, curr: any) => {
                acc[curr.id] = curr.name
                return acc
            }, {})

            return (groupsData as any[]).map(g => ({
                ...g,
                subjects: (g.subjects || []).map((s: any) => {
                    const catalogName = s.subject_catalog_id ? catalogMap[s.subject_catalog_id] : s.custom_name
                    let displayName = s.custom_name || catalogName

                    if (s.subject_catalog_id && specialtyMap[s.subject_catalog_id] && displayName && !displayName.includes(specialtyMap[s.subject_catalog_id])) {
                        displayName = `${catalogName}: ${specialtyMap[s.subject_catalog_id]}`
                    }

                    return {
                        ...s,
                        catalog_name: catalogName,
                        display_name: displayName,
                        teacher_name: s.teacher?.full_name
                    }
                })
            })) as Group[]
        }
    })

    // Fetch Teacher Subjects (for registration)
    const { data: teacherSubjects } = useQuery({
        queryKey: ['teacher_subjects'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return []

            const { data, error } = await supabase
                .from('profile_subjects')
                .select('subject_catalog_id, custom_detail, subject_catalog(name)')
                .eq('profile_id', user.id)

            if (error) throw error
            return data.map((s: any) => ({
                id: s.subject_catalog_id,
                name: s.subject_catalog?.name || s.custom_detail || 'Materia Personalizada',
                isCustom: !s.subject_catalog_id,
                customDetail: s.custom_detail
            }))
        }
    })

    const createGroupMutation = useMutation({
        mutationFn: async (newGroup: { grade: string; section: string; shift: string; selectedSubjects: any[] }) => {
            if (!tenant?.id) throw new Error('No tenant ID')
            if (newGroup.selectedSubjects.length === 0) throw new Error('Debes seleccionar al menos una materia')

            const { data: years } = await supabase.from('academic_years').select('id').eq('is_active', true).limit(1)
            let yearId = years?.[0]?.id

            if (!yearId) {
                const { data: newYear, error: yearError } = await supabase.from('academic_years').insert({
                    tenant_id: tenant.id,
                    name: 'Ciclo Actual',
                    start_date: new Date().toISOString(),
                    end_date: new Date().toISOString(),
                    is_active: true
                }).select().single()
                if (yearError) throw yearError
                yearId = newYear.id
            }

            const { data: group, error: groupError } = await supabase
                .from('groups')
                .insert({
                    grade: Number(newGroup.grade),
                    section: newGroup.section,
                    shift: newGroup.shift,
                    tenant_id: tenant.id,
                    academic_year_id: yearId
                })
                .select()
                .single()

            if (groupError) throw groupError

            if (newGroup.selectedSubjects.length > 0) {
                const subjectInserts = newGroup.selectedSubjects.map(subject => ({
                    group_id: group.id,
                    tenant_id: tenant.id,
                    subject_catalog_id: subject.id,
                    custom_name: subject.customDetail ? `${subject.name}: ${subject.customDetail}` : null,
                    teacher_id: profile?.id // Automatically assign the creator if teacher
                }))

                const { error: subjectsError } = await supabase
                    .from('group_subjects')
                    .insert(subjectInserts)

                if (subjectsError) throw subjectsError
            }

            return group
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['groups'] })
            setIsModalOpen(false)
            setFormData({ grade: '1', section: 'A', shift: 'MORNING', selectedSubjects: [] })
            navigate(`/groups/${data.id}`, { state: { openAddStudent: true } })
        }
    })

    const [formData, setFormData] = useState<{
        grade: string
        section: string
        shift: string
        selectedSubjects: any[]
    }>({ grade: '1', section: 'A', shift: 'MORNING', selectedSubjects: [] })
    const [isCustomSection, setIsCustomSection] = useState(false)

    const getGradeOptions = () => {
        const level = tenant?.educationalLevel || 'PRIMARY'
        switch (level) {
            case 'PRESCHOOL': return ['1', '2', '3']
            case 'PRIMARY': return ['1', '2', '3', '4', '5', '6']
            case 'SECONDARY': return ['1', '2', '3']
            case 'HIGH_SCHOOL': return ['1', '2', '3', '4', '5', '6']
            default: return ['1', '2', '3', '4', '5', '6']
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        createGroupMutation.mutate(formData)
    }

    // Flatten groups into subject cards
    const subjectCards = groups?.flatMap(group => {
        if (!group.subjects || group.subjects.length === 0) {
            return [{ ...group, currentSubject: null }]
        }
        return group.subjects.map((s: any) => ({
            ...group,
            currentSubject: s
        }))
    }) || []

    return (
        <div className="space-y-8 pb-12 animate-in fade-in duration-500">
            <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-cyan-50 opacity-50" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 flex items-center tracking-tight">
                            <span className="p-2 bg-blue-600 rounded-xl mr-3 shadow-lg shadow-blue-200">
                                <Users className="h-6 w-6 text-white" />
                            </span>
                            Mis Materias y Grupos
                        </h1>
                        <p className="mt-2 text-gray-600 font-medium ml-1">
                            Selecciona una materia para gestionar tu libreta de calificaciones.
                        </p>
                    </div>
                    {isStaff && (
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="inline-flex justify-center items-center px-6 py-3 border border-transparent shadow-lg shadow-blue-200 text-sm font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 hover:scale-105 transition-all"
                        >
                            <Plus className="h-5 w-5 mr-2" />
                            Nuevo Grupo
                        </button>
                    )}
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-12">Cargando grupos...</div>
            ) : subjectCards.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300 shadow-sm">
                    <div className="mx-auto w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                        <School className="h-10 w-10 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">No hay grupos registrados</h3>
                    <p className="text-gray-500 max-w-sm mx-auto mb-8">
                        {isTeacher
                            ? "Aún no tienes grupos asignados para este ciclo escolar. Contacta al administrador."
                            : "Para comenzar a evaluar y pasar lista, necesitas crear tu primer grupo escolar."
                        }
                    </p>
                    {!isTeacher && (
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="inline-flex items-center px-6 py-3 border border-transparent shadow-lg text-sm font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 transition-all hover:scale-105"
                        >
                            <Plus className="h-5 w-5 mr-2" />
                            Crear Primer Grupo
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {subjectCards.map((item, idx) => (
                        <div
                            key={`${item.id}-${idx}`}
                            onClick={() => navigate(`/gradebook?groupId=${item.id}${item.currentSubject ? `&subjectId=${item.currentSubject.subject_catalog_id || item.currentSubject.id}` : ''}`)}
                            className="bg-white rounded-2xl shadow-lg shadow-gray-100 border border-gray-100 p-6 hover:shadow-xl hover:scale-[1.02] hover:border-blue-200 transition-all cursor-pointer group relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <BookOpen className="w-24 h-24 text-blue-600 transform rotate-12" />
                            </div>

                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-3 rounded-xl transition-colors ${item.grade === '1' ? 'bg-blue-100 text-blue-600' :
                                        item.grade === '2' ? 'bg-emerald-100 text-emerald-600' :
                                            item.grade === '3' ? 'bg-violet-100 text-violet-600' :
                                                item.grade === '4' ? 'bg-amber-100 text-amber-600' :
                                                    'bg-gray-100 text-gray-600'
                                        }`}>
                                        <GraduationCap className="h-6 w-6" />
                                    </div>
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-gray-50 text-gray-500 border border-gray-100 shadow-sm">
                                        {item.shift === 'MORNING' ? 'Matutino' : item.shift === 'AFTERNOON' ? 'Vespertino' : 'Tiempo Completo'}
                                    </span>
                                </div>

                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex-1">
                                        <h3 className="text-lg font-black text-blue-600 uppercase tracking-tight leading-tight mb-1 group-hover:text-blue-700 transition-colors">
                                            {item.currentSubject?.display_name || 'Sin Materia'}
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            <span className="text-3xl font-black text-gray-900">
                                                {item.grade}° "{item.section}"
                                            </span>
                                            <div className="h-1.5 w-1.5 bg-gray-300 rounded-full" />
                                            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">
                                                Ciclo Actual
                                            </p>
                                        </div>
                                    </div>

                                    {isStaff && (
                                        <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setIsModifyingGroup(item)
                                                    setIsEditModalOpen(true)
                                                }}
                                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Editar Grupo"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center text-xs text-gray-500 bg-gray-50/80 p-3 rounded-xl border border-gray-100/50 backdrop-blur-sm">
                                        <Users className="w-4 h-4 mr-2 text-blue-400" />
                                        <span className="font-extrabold text-gray-900 mr-1">{item.students?.[0]?.count || 0}</span> Alumnos en lista
                                    </div>
                                </div>

                                <div className="mt-8 pt-4 border-t border-gray-50 flex items-center justify-between">
                                    <div className="flex items-center text-[10px] text-gray-400 font-black uppercase tracking-widest">
                                        <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
                                        Evaluar Materia
                                    </div>
                                    <span className="text-sm font-black text-blue-600 group-hover:text-blue-700 flex items-center uppercase tracking-tighter">
                                        Libreta <ArrowRight className="w-4 h-4 ml-1.5 transform group-hover:translate-x-1 transition-transform" />
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 border border-gray-100 animate-in zoom-in-95 duration-200">
                        <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center">
                            <Plus className="w-6 h-6 mr-3 text-blue-600" />
                            Nuevo Grupo
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Grado</label>
                                    <select
                                        className="block w-full px-4 py-3 bg-gray-50 border-gray-200 focus:bg-white focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-xl border transition-all"
                                        value={formData.grade}
                                        onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                                    >
                                        {getGradeOptions().map(g => <option key={g} value={g}>{g}°</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Sección</label>
                                    {!isCustomSection ? (
                                        <select
                                            className="block w-full px-4 py-3 bg-gray-50 border-gray-200 focus:bg-white focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-xl border transition-all"
                                            value={formData.section}
                                            onChange={(e) => {
                                                if (e.target.value === 'CUSTOM') {
                                                    setIsCustomSection(true)
                                                    setFormData({ ...formData, section: '' })
                                                } else {
                                                    setFormData({ ...formData, section: e.target.value })
                                                }
                                            }}
                                        >
                                            {['A', 'B', 'C', 'D', 'E', 'F'].map(s => <option key={s} value={s}>{s}</option>)}
                                            <option value="CUSTOM">Otro...</option>
                                        </select>
                                    ) : (
                                        <div className="flex space-x-2">
                                            <input
                                                type="text"
                                                required
                                                autoFocus
                                                maxLength={5}
                                                className="block w-full px-4 py-3 bg-gray-50 border-gray-200 focus:bg-white focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-xl border transition-all"
                                                value={formData.section}
                                                onChange={(e) => setFormData({ ...formData, section: e.target.value.toUpperCase() })}
                                            />
                                            <button type="button" onClick={() => setIsCustomSection(false)} className="text-xs text-blue-600 font-bold">Lista</button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Turno</label>
                                <select
                                    className="block w-full px-4 py-3 bg-gray-50 border-gray-200 focus:bg-white focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-xl border transition-all"
                                    value={formData.shift}
                                    onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                                >
                                    <option value="MORNING">Matutino</option>
                                    <option value="AFTERNOON">Vespertino</option>
                                    <option value="FULL_TIME">Tiempo Completo</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Materias <span className="text-red-500">*</span></label>
                                <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto p-4 bg-gray-50 rounded-xl border border-gray-100">
                                    {teacherSubjects?.map((sub: any) => (
                                        <label key={sub.id || sub.name} className="flex items-center space-x-3 p-2 hover:bg-white hover:shadow-sm rounded-lg cursor-pointer transition-all border border-transparent">
                                            <input
                                                type="checkbox"
                                                className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded-md"
                                                checked={formData.selectedSubjects.some(s => s.id === sub.id && s.name === sub.name)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setFormData({ ...formData, selectedSubjects: [...formData.selectedSubjects, sub] })
                                                    } else {
                                                        setFormData({ ...formData, selectedSubjects: formData.selectedSubjects.filter(s => !(s.id === sub.id && s.name === sub.name)) })
                                                    }
                                                }}
                                            />
                                            <span className="text-xs font-black text-gray-700 uppercase tracking-tight">{sub.name}</span>
                                        </label>
                                    ))}
                                </div>
                                <p className="mt-2 text-[10px] text-gray-400 font-medium italic">Selecciona las materias que impartes a este grupo.</p>
                            </div>

                            <div className="flex justify-end space-x-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-6 py-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={createGroupMutation.isPending || formData.selectedSubjects.length === 0}
                                    className="px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-100 disabled:opacity-50 transition-all"
                                >
                                    {createGroupMutation.isPending ? 'Creando...' : 'Crear Grupo'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isModifyingGroup && (
                <EditGroupModal
                    isOpen={isEditModalOpen}
                    onClose={() => {
                        setIsEditModalOpen(false)
                        setIsModifyingGroup(null)
                    }}
                    onSuccess={() => {
                        queryClient.invalidateQueries({ queryKey: ['groups'] })
                    }}
                    group={isModifyingGroup}
                />
            )}
        </div>
    )
}
