import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { useProfile } from '../../../hooks/useProfile'

interface EditGroupModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    group: {
        id: string
        grade: string
        section: string
        shift: string
        subjects?: Array<{
            id: string
            subject_catalog_id: string | null
            custom_name: string | null
        }>
    }
}

export const EditGroupModal = ({ isOpen, onClose, onSuccess, group }: EditGroupModalProps) => {
    const { data: tenant } = useTenant()
    const { profile } = useProfile()
    const [isLoading, setIsLoading] = useState(false)
    const [formData, setFormData] = useState<{
        grade: string
        section: string
        shift: string
        selectedSubjects: any[] // Array of { id, name, isCustom, teacher_id }
    }>({
        grade: group.grade,
        section: group.section,
        shift: group.shift,
        selectedSubjects: []
    })
    const [teacherSubjects, setTeacherSubjects] = useState<any[]>([])
    const [allStaff, setAllStaff] = useState<any[]>([])
    const [isCustomSection, setIsCustomSection] = useState(false)

    const isStaff = ['ADMIN', 'DIRECTOR', 'ACADEMIC_COORD', 'TECH_COORD', 'SCHOOL_CONTROL'].includes(profile?.role || '')

    useEffect(() => {
        const loadData = async () => {
            if (!isOpen || !tenant?.id) return

            // Load Subjects (Catalog if admin, Profile if teacher)
            let subjectsToChoose: any[] = []
            if (isStaff) {
                const { data: catSubs } = await supabase
                    .from('subject_catalog')
                    .select('*')
                    .eq('educational_level', tenant.educationalLevel || 'PRIMARY')

                subjectsToChoose = (catSubs || []).map((s: any) => ({
                    id: s.id,
                    name: s.name,
                    isCustom: false
                }))

                // Load all staff for teacher assignment
                const { data: staffData } = await supabase
                    .from('profiles')
                    .select('id, full_name, role')
                    .eq('tenant_id', tenant.id)
                    .in('role', ['TEACHER', 'ADMIN', 'DIRECTOR', 'ACADEMIC_COORD', 'TECH_COORD', 'SCHOOL_CONTROL'])

                setAllStaff(staffData || [])
            } else {
                const { data: { user } } = await supabase.auth.getUser()
                if (user) {
                    const { data: profSubs } = await supabase
                        .from('profile_subjects')
                        .select('subject_catalog_id, custom_detail, subject_catalog(name)')
                        .eq('profile_id', user.id)

                    subjectsToChoose = (profSubs || []).map((s: any) => ({
                        id: s.subject_catalog_id,
                        name: s.subject_catalog?.name || s.custom_detail || 'Materia Personalizada',
                        isCustom: !s.subject_catalog_id,
                        customDetail: s.custom_detail
                    }))
                }
            }
            setTeacherSubjects(subjectsToChoose)

            // Initialize form with current values
            // group.subjects contains { id, subject_catalog_id, custom_name, teacher_id }
            setFormData({
                grade: group.grade,
                section: group.section,
                shift: group.shift,
                selectedSubjects: (group.subjects || []).map(gs => ({
                    id: gs.subject_catalog_id,
                    name: gs.custom_name || 'Materia',
                    isCustom: !gs.subject_catalog_id,
                    teacher_id: (gs as any).teacher_id || null
                }))
            })

            setIsCustomSection(!['A', 'B', 'C', 'D', 'E', 'F'].includes(group.section))
        }

        loadData()
    }, [isOpen, group])

    if (!isOpen) return null

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        try {
            // Step 1: Update Group
            const { error: groupError } = await supabase
                .from('groups')
                .update({
                    grade: formData.grade,
                    section: formData.section,
                    shift: formData.shift
                })
                .eq('id', group.id)

            if (groupError) throw groupError

            // Step 2: Sync Subjects
            // First, delete current associations
            const { error: deleteError } = await supabase
                .from('group_subjects')
                .delete()
                .eq('group_id', group.id)

            if (deleteError) throw deleteError

            // Then, insert new ones
            if (formData.selectedSubjects.length > 0) {
                const associations = formData.selectedSubjects.map(sub => ({
                    group_id: group.id,
                    tenant_id: tenant?.id,
                    subject_catalog_id: sub.isCustom ? null : sub.id,
                    custom_name: sub.isCustom ? sub.name : null,
                    teacher_id: sub.teacher_id || profile?.id
                }))

                const { error: insertError } = await supabase
                    .from('group_subjects')
                    .insert(associations)

                if (insertError) throw insertError
            }

            onSuccess()
            onClose()
        } catch (error: any) {
            console.error('Error creating group:', error)
            alert('Error al actualizar grupo: ' + error.message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Editar Grupo</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Grado</label>
                            <select
                                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border"
                                value={formData.grade}
                                onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                            >
                                {getGradeOptions().map(g => <option key={g} value={g}>{g}°</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Sección / Grupo</label>
                            {!isCustomSection ? (
                                <select
                                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border"
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
                                    <option value="CUSTOM">Otro (Manual)</option>
                                </select>
                            ) : (
                                <div className="flex space-x-2">
                                    <input
                                        type="text"
                                        required
                                        autoFocus
                                        maxLength={5}
                                        placeholder="Ej. G"
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                        value={formData.section}
                                        onChange={(e) => setFormData({ ...formData, section: e.target.value.toUpperCase() })}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setIsCustomSection(false)}
                                        className="mt-1 px-2 text-sm text-blue-600 hover:text-blue-800"
                                    >
                                        Ver Lista
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Turno</label>
                        <select
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border"
                            value={formData.shift}
                            onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                        >
                            <option value="MORNING">Matutino</option>
                            <option value="AFTERNOON">Vespertino</option>
                            <option value="FULL_TIME">Tiempo Completo</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Materias y Docentes <span className="text-red-500">*</span></label>
                        <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto p-2 border rounded-md bg-gray-50">
                            {teacherSubjects.map((sub: any) => {
                                const isSelected = formData.selectedSubjects.some(s => s.id === sub.id)
                                const selectedSub = formData.selectedSubjects.find(s => s.id === sub.id)

                                return (
                                    <div key={sub.id || sub.name} className={`flex flex-col p-2 space-y-2 rounded-lg border transition-all ${isSelected ? 'bg-white border-blue-200 shadow-sm' : 'border-transparent'}`}>
                                        <label className="flex items-center space-x-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                checked={isSelected}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setFormData({ ...formData, selectedSubjects: [...formData.selectedSubjects, { ...sub, teacher_id: isStaff ? null : (profile?.id || null) }] })
                                                    } else {
                                                        setFormData({ ...formData, selectedSubjects: formData.selectedSubjects.filter(s => s.id !== sub.id) })
                                                    }
                                                }}
                                            />
                                            <span className="text-sm font-bold text-gray-700 uppercase">{sub.name}</span>
                                        </label>

                                        {isSelected && isStaff && (
                                            <div className="pl-7">
                                                <select
                                                    className="block w-full text-xs border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                                    value={selectedSub?.teacher_id || ''}
                                                    onChange={(e) => {
                                                        const newSelected = formData.selectedSubjects.map(s =>
                                                            s.id === sub.id ? { ...s, teacher_id: e.target.value } : s
                                                        )
                                                        setFormData({ ...formData, selectedSubjects: newSelected })
                                                    }}
                                                >
                                                    <option value="">-- Seleccionar Docente --</option>
                                                    {allStaff.map(s => (
                                                        <option key={s.id} value={s.id}>{s.full_name || 'Sin nombre'}</option>
                                                    ))}
                                                </select>
                                                {!selectedSub?.teacher_id && <p className="text-[10px] text-red-500 mt-1">Asignación pendiente</p>}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                            {teacherSubjects.length === 0 && (
                                <div className="text-xs text-amber-600 p-2 italic">
                                    No hay materias disponibles para este nivel educativo.
                                </div>
                            )}
                        </div>
                        <p className="mt-1 text-[10px] text-gray-400">Selecciona las materias y asigna al docente responsable.</p>
                    </div>

                    <div className="mt-6 flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                            disabled={isLoading}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                            disabled={isLoading || formData.selectedSubjects.length === 0 || (isStaff && formData.selectedSubjects.some(s => !s.teacher_id))}
                        >
                            {isLoading ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
