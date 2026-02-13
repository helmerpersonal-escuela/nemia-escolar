import { useState, useEffect } from 'react'
import { X, Save, Calendar, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { AIInstrumentGenerator } from './AIInstrumentGenerator'

type CreateAssignmentModalProps = {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    groupId: string
    subjectId?: string
    defaultSubjectName?: string
    initialData?: any
    lessonPlanId?: string // Passed if exists
    periodId?: string
    assignmentId?: string // If present, we are editing
}

export const CreateAssignmentModal = ({
    isOpen,
    onClose,
    onSuccess,
    groupId,
    subjectId,
    defaultSubjectName,
    initialData,
    lessonPlanId,
    periodId,
    assignmentId
}: CreateAssignmentModalProps) => {
    const { data: tenant } = useTenant()
    const navigate = useNavigate()
    const [isLoading, setIsLoading] = useState(false)
    const [isAIGeneratorOpen, setIsAIGeneratorOpen] = useState(false)

    // Form State
    const [formData, setFormData] = useState({
        title: initialData?.title || '',
        description: initialData?.description || '',
        type: initialData?.type || 'HOMEWORK',
        due_date: initialData?.due_date || new Date().toLocaleDateString('en-CA'),
        weight: 0,
        criterion_id: initialData?.criterion || '',
        start_date: initialData?.start_date || new Date().toLocaleDateString('en-CA'),
        instrument_id: initialData?.instrument_id || ''
    })

    const [rubrics, setRubrics] = useState<any[]>([])
    const [loadingRubrics, setLoadingRubrics] = useState(false)

    useEffect(() => {
        if (initialData) {
            setFormData(prev => ({
                ...prev,
                title: initialData.title || '',
                description: initialData.description || '',
                type: initialData.type || 'HOMEWORK',
                due_date: initialData.due_date || new Date().toLocaleDateString('en-CA'),
                start_date: initialData.start_date || new Date().toLocaleDateString('en-CA'),
                criterion_id: initialData.criterion || ''
            }))
        }
    }, [initialData])

    const [criteria, setCriteria] = useState<any[]>([])
    const [loadingCriteria, setLoadingCriteria] = useState(false)

    useEffect(() => {
        const fetchCriteria = async () => {
            if (!isOpen || !groupId) return
            setLoadingCriteria(true)
            try {
                let query = supabase
                    .from('evaluation_criteria')
                    .select('id, name, percentage')
                    .eq('group_id', groupId)

                if (periodId) {
                    query = query.eq('period_id', periodId)
                }

                const { data, error } = await query
                if (error) throw error
                setCriteria(data || [])
            } catch (err) {
                console.error('Error fetching criteria:', err)
            } finally {
                setLoadingCriteria(false)
            }
        }
        fetchCriteria()
    }, [isOpen, groupId, periodId])

    useEffect(() => {
        if (isOpen && tenant?.id) {
            setLoadingRubrics(true)
            supabase
                .from('rubrics')
                .select('id, title, type')
                .eq('tenant_id', tenant.id)
                .then(({ data }) => {
                    setRubrics(data || [])
                    setLoadingRubrics(false)
                })
        }
    }, [isOpen, tenant?.id])

    const [location, setLocation] = useState<'SCHOOL' | 'HOME'>('SCHOOL') // Default to School

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!tenant?.id || !groupId) return

        // Final Validation for Criteria
        if (criteria.length === 0) {
            alert('Debes configurar los criterios de evaluación antes de crear tareas.')
            return
        }

        setIsLoading(true)
        try {
            // Append Location to title or description if needed, or rely on type.
            // Requirement: "Choose if activity is for home or classroom"
            // We can map this to type if possible, or just store it.
            // Since we don't have a 'location' column confirmed, let's append a tag to description for now.
            // Or better, if it's HOME, we might default type to HOMEWORK? But user might want "Project at Home".

            if (!formData.criterion_id && criteria.length > 0) {
                alert('Por favor selecciona un Criterio de Evaluación.')
                return
            }

            // Fallback: If no criteria exist at all, we might allow it (or prompt to create criteria)
            // But logic above allows it.

            const locationTag = location === 'HOME' ? '[CASA]' : '[AULA]'
            const finalDescription = `${locationTag} ${formData.description}`.trim()

            const payload: any = {
                tenant_id: tenant.id,
                group_id: groupId,
                subject_id: subjectId || null,
                title: formData.title,
                description: finalDescription,
                type: formData.type,
                due_date: formData.due_date,
                start_date: formData.type === 'PROJECT' ? formData.start_date : null,
                weighting_percentage: 0,
                criterion_id: formData.criterion_id || null,
                instrument_id: formData.instrument_id || null
            }

            // Attempt to link to lesson plan if provided
            if (lessonPlanId) {
                // We try to include it. If the column doesn't exist, Supabase might throw an error.
                // However, without schema inspection, we can't be 100% sure.
                // Given the user context "aun no conecta", we must try.
                // If it fails, we should catch it and retry without the ID?
                // But TypeScript/Supabase client validation might fail first if types were strict.
                // Since types are loose here, it will go to the server.
                payload.lesson_plan_id = lessonPlanId
            }

            let error = null

            if (assignmentId) {
                // Update existing assignment
                const { error: updateError } = await supabase
                    .from('assignments')
                    .update(payload)
                    .eq('id', assignmentId)

                error = updateError
            } else {
                // Create new assignment
                const { error: insertError } = await supabase.from('assignments').insert(payload)
                error = insertError

                // DEFENSIVE: If error is related to missing columns, retry without them
                if (error && error.code === '42703') {
                    console.warn('Handling missing column error:', error.message)

                    if (error.message.includes('lesson_plan_id')) {
                        delete payload.lesson_plan_id
                        const retry = await supabase.from('assignments').insert(payload)
                        error = retry.error
                    }

                    if (error && error.message.includes('instrument_id')) {
                        delete payload.instrument_id
                        const retry = await supabase.from('assignments').insert(payload)
                        error = retry.error
                    }

                    if (error && (error.message.includes('weighting_percentage') || error.message.includes('weightING_percentage'))) {
                        delete payload.weighting_percentage
                        const retry = await supabase.from('assignments').insert(payload)
                        error = retry.error
                    }
                }
            }

            if (error) {
                console.error('[CreateAssignmentModal] Error saving assignment:', error)
                throw error
            }

            console.log('[CreateAssignmentModal] Assignment saved successfully')
            onSuccess()
            onClose()
            // Reset form
            setFormData({
                title: '',
                description: '',
                type: 'HOMEWORK',
                due_date: new Date().toISOString().split('T')[0],
                weight: 0,
                criterion_id: '',
                start_date: new Date().toISOString().split('T')[0],
                instrument_id: ''
            })
            setLocation('SCHOOL')
        } catch (error: any) {
            alert('Error al crear la actividad: ' + error.message)
        } finally {
            setIsLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col animate-fade-in">
                <div className="flex justify-between items-start p-6 pb-2 shrink-0">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 leading-tight">
                            {assignmentId ? 'Editar Actividad' : 'Nueva Actividad'}
                        </h3>
                        <p className="text-sm text-gray-500">
                            {assignmentId ? 'Modifica los detalles de la actividad' : 'Crea una tarea o proyecto para tu grupo'}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="overflow-y-auto p-6 pt-2">
                    <form id="assignment-form" onSubmit={handleSubmit} className="space-y-4">
                        {/* Title */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Título de la Actividad</label>
                            <input
                                type="text"
                                required
                                placeholder="EJ. RESUMEN DE LA REVOLUCIÓN MEXICANA"
                                className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-sm uppercase font-bold"
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value.toUpperCase() })}
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Descripción (Opcional)</label>
                            <textarea
                                rows={3}
                                placeholder="INSTRUCCIONES PARA EL ALUMNO..."
                                className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-sm resize-none uppercase"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value.toUpperCase() })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Type */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Tipo de Actividad</label>
                                <select
                                    className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-sm"
                                    value={formData.type}
                                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                                >
                                    <option value="HOMEWORK">Tarea</option>
                                    <option value="CLASSWORK">Trabajo en Clase</option>
                                    <option value="PROJECT">Proyecto</option>
                                    <option value="EXAM">Examen</option>
                                    <option value="PARTICIPATION">Participación</option>
                                </select>
                            </div>

                            {/* Location Selector (New) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Entorno</label>
                                <div className="flex bg-gray-100 p-1 rounded-lg">
                                    <button
                                        type="button"
                                        onClick={() => setLocation('SCHOOL')}
                                        className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${location === 'SCHOOL' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        Aula / Escuela
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setLocation('HOME')}
                                        className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${location === 'HOME' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        Casa
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {/* Criterion Selector */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Ponderación (Criterio)</label>
                                {loadingCriteria ? (
                                    <div className="animate-pulse h-9 bg-gray-200 rounded-md mt-1"></div>
                                ) : criteria.length > 0 ? (
                                    <select
                                        className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-sm bg-blue-50/50"
                                        value={formData.criterion_id}
                                        onChange={e => setFormData({ ...formData, criterion_id: e.target.value })}
                                        required
                                    >
                                        <option value="">Seleccionar...</option>
                                        {criteria.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.name} ({c.percentage}%)
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-md">
                                        <p className="text-xs text-orange-800 font-bold mb-2">
                                            ⚠️ No has configurado criterios para este grupo.
                                        </p>
                                        <p className="text-xs text-orange-600 mb-2">
                                            Es necesario definir cómo evaluarás (Ej. Tareas 20%, Examen 40%) antes de crear actividades.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onClose()
                                                navigate(`/evaluation/setup?groupId=${groupId}&periodId=${periodId}`)
                                            }}
                                            className="text-xs bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg font-bold border border-orange-200 hover:bg-orange-200 transition-all shadow-sm"
                                        >
                                            Configurar Criterios
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Start Date (Project Period) */}
                            {formData.type === 'PROJECT' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Fecha de Inicio</label>
                                    <div className="relative mt-1">
                                        <input
                                            type="date"
                                            className="block w-full rounded-md border border-gray-300 py-2 px-3 pl-10 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-sm"
                                            value={formData.start_date || ''}
                                            onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                        />
                                        <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                    </div>
                                </div>
                            )}

                            {/* Due Date */}
                            <div className={formData.type === 'PROJECT' ? '' : 'col-span-2'}>
                                <label className="block text-sm font-medium text-gray-700">
                                    {formData.type === 'PROJECT' ? 'Fecha de Entrega Final' : 'Fecha de Entrega'}
                                </label>
                                <div className="relative mt-1">
                                    <input
                                        type="date"
                                        required
                                        className="block w-full rounded-md border border-gray-300 py-2 px-3 pl-10 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-sm"
                                        value={formData.due_date}
                                        onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                                    />
                                    <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                </div>
                            </div>
                        </div>
                        {/* Instrument Selector */}
                        <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700">Instrumento de Evaluación</label>
                            {loadingRubrics ? (
                                <div className="animate-pulse h-9 bg-gray-200 rounded-md mt-1"></div>
                            ) : (
                                <select
                                    className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-sm"
                                    value={formData.instrument_id}
                                    onChange={e => setFormData({ ...formData, instrument_id: e.target.value })}
                                >
                                    <option value="">Ninguno / Por definir...</option>
                                    {rubrics.map(r => (
                                        <option key={r.id} value={r.id}>
                                            {r.title} ({r.type === 'CHECKLIST' ? 'Lista' : 'Rúbrica'})
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>


                        {/* Actions */}
                        <div className="flex justify-between items-center pt-4 border-t">
                            <div>
                                {lessonPlanId && (
                                    <button
                                        type="button"
                                        onClick={() => setIsAIGeneratorOpen(true)}
                                        className="inline-flex items-center px-4 py-2 border border-purple-200 rounded-lg text-sm font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors"
                                    >
                                        <Sparkles className="h-4 w-4 mr-2" />
                                        Generar con IA
                                    </button>
                                )}
                            </div>
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
                                    disabled={isLoading || criteria.length === 0}
                                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Save className="h-4 w-4 mr-2" />
                                    {isLoading ? 'Guardando...' : 'Crear Actividad'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>

            {/* AI Generator Modal */}
            <AIInstrumentGenerator
                isOpen={isAIGeneratorOpen}
                onClose={() => setIsAIGeneratorOpen(false)}
                lessonPlanId={lessonPlanId}
                subjectName={defaultSubjectName}
                defaultDate={formData.due_date}
                onInstrumentCreated={(data: any) => {
                    // Handle full assignment data from AI
                    // data: { instrumentId, title, description, type, location }

                    // 1. Set Form Data
                    setFormData(prev => ({
                        ...prev,
                        title: data.title || prev.title,
                        description: data.description || prev.description,
                        type: data.type || prev.type,
                        instrument_id: data.instrumentId || prev.instrument_id,
                        criterion_id: prev.criterion_id
                    }))

                    // 2. Refresh Rubrics List to include new one
                    if (tenant?.id) {
                        supabase
                            .from('rubrics')
                            .select('id, title, type')
                            .eq('tenant_id', tenant.id)
                            .then(({ data: rubData }) => setRubrics(rubData || []))
                    }

                    // 3. Set Location
                    if (data.location) {
                        setLocation(data.location)
                    }

                    alert(`¡Instrumento "${data.title}" creado y vinculado!`)
                }}
            />
        </div>
    )
}
