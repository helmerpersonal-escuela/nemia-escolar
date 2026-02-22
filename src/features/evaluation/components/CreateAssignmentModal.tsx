import { useState, useEffect } from 'react'
import { X, Save, Calendar, Sparkles, ActivitySquare, Clock, RefreshCw, Mic } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { GeminiService } from '../../../lib/gemini'
import { useTenant } from '../../../hooks/useTenant'
import { AIInstrumentGenerator } from './AIInstrumentGenerator'
import { DictationModeModal } from './DictationModeModal'
import { createAssignmentAlerts } from '../../../utils/notificationUtils'

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
    const [isDictationModeOpen, setIsDictationModeOpen] = useState(false)

    // Memoized AI Service with tenant keys
    const aiService = useState(() => new GeminiService(
        tenant?.aiConfig?.geminiKey,
        tenant?.aiConfig?.apiKey,
        tenant?.aiConfig?.openaiKey
    ))[0]

    // Update keys if tenant changes
    useEffect(() => {
        if (tenant?.aiConfig) {
            (aiService as any).refreshConfig(
                tenant.aiConfig.geminiKey,
                tenant.aiConfig.apiKey,
                tenant.aiConfig.openaiKey
            )
        }
    }, [tenant, aiService])

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

    // Context from Lesson Plan
    const [activities, setActivities] = useState<any[]>([])
    const [availableDates, setAvailableDates] = useState<string[]>([])
    const [selectedActivityId, setSelectedActivityId] = useState<string>('')
    const [loadingActivities, setLoadingActivities] = useState(false)

    // Extraer actividades si hay planeacion activa y resumirlas con IA
    useEffect(() => {
        if (isOpen && lessonPlanId) {
            setLoadingActivities(true)
            const fetchPlan = async () => {
                const { data } = await supabase
                    .from('lesson_plans')
                    .select('activities_sequence')
                    .eq('id', lessonPlanId)
                    .single()

                if (data && data.activities_sequence) {
                    const extractedActivities: any[] = []
                    const dates = new Set<string>()

                    // Obtener resumen con Gemini para todas las sesiones
                    const aiSummaries = await aiService.summarizeLessonPlanSessions(data.activities_sequence)

                    data.activities_sequence.forEach((session: any, sIdx: number) => {
                        if (session.date) dates.add(session.date)

                        const summaryData = aiSummaries.find((s: any) => s.date === session.date)
                        const shortDescription = summaryData ? summaryData.summary : `Sesión ${sIdx + 1} del ${session.date}`
                        const suggestedTitle = summaryData ? summaryData.suggestedTitle : `MISIÓN: ${session.date}`
                        const roadmap = summaryData ? summaryData.instructionRoadmap : `Instrucciones para la sesión del ${session.date}`

                        // Guardamos la sesión completa como contexto oculto ("value") pero mostramos el resumen en UI
                        extractedActivities.push({
                            id: `${sIdx}-RESUMEN`,
                            description: shortDescription,
                            session: sIdx + 1,
                            phase: 'Resumen IA',
                            date: session.date,
                            suggestedTitle: suggestedTitle,
                            instructionRoadmap: roadmap,
                            rawContext: session // Contexto original pesado para el paso 2
                        })
                    })

                    setActivities(extractedActivities)
                    const sortedDates = Array.from(dates).sort() as string[]
                    setAvailableDates(sortedDates)
                }
                setLoadingActivities(false)
            }
            fetchPlan()
        }
    }, [isOpen, lessonPlanId])

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

            console.log('[CreateAssignmentModal] Submitting payload:', payload)

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
                const { data: newAssignment, error: insertError } = await supabase
                    .from('assignments')
                    .insert(payload)
                    .select()
                    .single()

                error = insertError

                // Trigger alerts for tutors
                if (!error && newAssignment) {
                    createAssignmentAlerts(newAssignment)
                }

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
                console.error('[CreateAssignmentModal] Error saving assignment (Final State):', error)
                throw error
            }

            console.log('[CreateAssignmentModal] Assignment saved successfully. Response details if any:', { error })
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md overflow-y-auto">
            {/* Background Blobs for specific Tactile feel */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-indigo-400/20 blur-[100px] animate-blob" />
                <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-400/20 blur-[100px] animate-blob transition-delay-2000" />
            </div>

            <div className="bg-[#F8FAFC] rounded-[3rem] shadow-2xl max-w-2xl w-full flex flex-col relative overflow-hidden border-8 border-white animate-in zoom-in-95 duration-300">
                {/* Header Gradient Stripe */}
                <div className="h-2 w-full animated-gradient" />

                <div className="flex justify-between items-start p-10 pb-4 shrink-0">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg rotate-[-3deg] inflatable-icon">
                                <ActivitySquare className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="text-3xl font-black text-indigo-950 uppercase italic tracking-tighter leading-none">
                                {assignmentId ? 'Actualizar Actividad' : 'Nueva Misión'}
                            </h3>
                        </div>
                        <p className="text-sm text-slate-400 font-bold uppercase tracking-widest pl-1">
                            {assignmentId ? 'Refinando los parámetros de la tarea' : 'Diseña una experiencia de aprendizaje'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 bg-white rounded-2xl shadow-md text-slate-400 hover:text-rose-500 hover:rotate-90 transition-all duration-300 btn-tactile group"
                    >
                        <X className="h-6 w-6 group-hover:scale-110" />
                    </button>
                </div>

                <div className="overflow-y-auto p-10 pt-2 custom-scrollbar max-h-[70vh]">
                    <form id="assignment-form" onSubmit={handleSubmit} className="space-y-8">
                        {/* 0. Vinculación Didáctica (Si hay planeación) */}
                        {lessonPlanId && activities.length > 0 && (
                            <div className="squishy-card p-8 bg-purple-50/50 border border-purple-100 space-y-6">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-6 bg-purple-500 rounded-full" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-600">Vinculación Didáctica</span>
                                    </div>
                                    <span className="text-[10px] font-bold bg-purple-100 text-purple-600 px-2 py-1 rounded">Planeación Activa</span>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">
                                        Estrategia / Actividad a Evaluar
                                    </label>
                                    <div className="relative">
                                        <select
                                            disabled={loadingActivities}
                                            className={`input-squishy w-full px-6 py-4 text-xs font-black bg-white border-2 cursor-pointer transition-all appearance-none ${loadingActivities ? 'border-indigo-100 text-indigo-300 animate-pulse' : 'text-purple-900 border-purple-200 focus:border-purple-400 focus:ring-4 focus:ring-purple-100'}`}
                                            value={selectedActivityId}
                                            onChange={e => {
                                                const val = e.target.value
                                                setSelectedActivityId(val)

                                                // Auto-fill title y description (Hoja de Ruta)
                                                const act = activities.find(a => a.id === val)
                                                if (act) {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        title: act.suggestedTitle.toUpperCase(),
                                                        description: act.instructionRoadmap.toUpperCase()
                                                    }))
                                                }
                                            }}
                                        >
                                            <option value="">{loadingActivities ? '-- Conectando con tu Planeación Didáctica... --' : '-- Selecciona una actividad de tu planeación --'}</option>
                                            {!loadingActivities && availableDates.map(date => (
                                                <optgroup key={date} label={`Sesión del ${new Date(date).toLocaleDateString()}`}>
                                                    {activities.filter(a => a.date === date).map(act => (
                                                        <option key={act.id} value={act.id}>
                                                            ✨ {act.description}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                        </select>
                                        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none">
                                            {loadingActivities ? (
                                                <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
                                            ) : (
                                                <Sparkles className="w-4 h-4 text-purple-400" />
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-purple-500/80 mt-2 ml-1 font-medium flex items-center gap-1.5">
                                        <Sparkles className="w-3 h-3" />
                                        La IA ha resumido los párrafos de tu planeación para facilitar tu selección.
                                    </p>

                                    {/* Previsualización de la Actividad Seleccionada */}
                                    {selectedActivityId && (
                                        <div className="mt-4 p-5 bg-purple-50/50 border-2 border-purple-100 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-500">
                                            <div className="flex items-center gap-2 mb-3">
                                                <ActivitySquare className="w-4 h-4 text-purple-500" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-purple-700">Detalle de la Sesión</span>
                                            </div>
                                            <div className="space-y-3">
                                                {(() => {
                                                    const act = activities.find(a => a.id === selectedActivityId);
                                                    if (!act || !act.rawContext || !act.rawContext.phases) return null;

                                                    return act.rawContext.phases.map((phase: any, pIdx: number) => (
                                                        <div key={pIdx} className="flex gap-3">
                                                            <div className="pt-0.5">
                                                                <div className="px-2 py-0.5 bg-white border border-purple-200 rounded text-[8px] font-black text-purple-400 uppercase tracking-tighter">
                                                                    {phase.name}
                                                                </div>
                                                            </div>
                                                            <div className="text-[11px] font-medium text-purple-900/70 leading-relaxed italic">
                                                                {phase.activities.join(' ')}
                                                            </div>
                                                        </div>
                                                    ));
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 1. Basic Info Section */}
                        <div className="squishy-card p-8 bg-white border border-indigo-50/50 space-y-6">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Identificación</span>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                                        Nombre del Desafío <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="EJ. MAPA CONCEPTUAL: LA COLONIA"
                                        className="input-squishy w-full px-6 py-4 text-indigo-950 font-black text-sm uppercase placeholder:text-slate-300"
                                        value={formData.title}
                                        onChange={e => setFormData(prev => ({ ...prev, title: e.target.value.toUpperCase() }))}
                                    />
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-2 ml-1">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Hoja de Ruta / Instrucciones <span className="text-rose-500">*</span>
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setIsDictationModeOpen(true)}
                                            className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all text-[9px] font-black uppercase tracking-widest group"
                                        >
                                            <Mic className="w-3 h-3 group-hover:scale-110 transition-transform" />
                                            Dictado
                                        </button>
                                    </div>
                                    <textarea
                                        required
                                        rows={3}
                                        placeholder="DETALLA LOS PASOS PARA EL ÉXITO..."
                                        className="input-squishy w-full px-6 py-4 text-sm font-bold text-slate-700 resize-none uppercase placeholder:text-slate-300"
                                        value={formData.description}
                                        onChange={e => setFormData(prev => ({ ...prev, description: e.target.value.toUpperCase() }))}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 2. Parameters Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Type & Environment */}
                            <div className="squishy-card p-8 bg-white border border-indigo-50/50 space-y-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-1.5 h-6 bg-purple-500 rounded-full" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400">Logística</span>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Formato</label>
                                        <select
                                            className="input-squishy w-full px-6 py-4 text-xs font-black text-indigo-900 bg-slate-50 appearance-none cursor-pointer"
                                            value={formData.type}
                                            onChange={e => setFormData(prev => ({ ...prev, type: e.target.value }))}
                                        >
                                            <option value="HOMEWORK">Tarea</option>
                                            <option value="CLASSWORK">Trabajo en Clase</option>
                                            <option value="PROJECT">Proyecto</option>
                                            <option value="EXAM">Examen</option>
                                            <option value="PARTICIPATION">Participación</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Terreno de Acción</label>
                                        <div className="flex bg-slate-100/50 p-2 rounded-[1.5rem] border-2 border-slate-50">
                                            <button
                                                type="button"
                                                onClick={() => setLocation('SCHOOL')}
                                                className={`flex-1 py-3 px-4 text-[10px] font-black uppercase tracking-tighter rounded-2xl transition-all duration-300 ${location === 'SCHOOL' ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'text-slate-400 hover:text-indigo-600'}`}
                                            >
                                                Aula/Escuela
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setLocation('HOME')}
                                                className={`flex-1 py-3 px-4 text-[10px] font-black uppercase tracking-tighter rounded-2xl transition-all duration-300 ${location === 'HOME' ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'text-slate-400 hover:text-indigo-600'}`}
                                            >
                                                Casa/Remoto
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Evaluation Section */}
                            <div className="squishy-card p-8 bg-white border border-indigo-50/50 space-y-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-1.5 h-6 bg-amber-500 rounded-full" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500">Puntaje</span>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">
                                            Criterio Aplicable <span className="text-rose-500">*</span>
                                        </label>
                                        {loadingCriteria ? (
                                            <div className="animate-pulse h-12 bg-slate-50 rounded-2xl"></div>
                                        ) : criteria.length > 0 ? (
                                            <select
                                                className="input-squishy w-full px-6 py-4 text-xs font-black text-amber-700 bg-amber-50/30 cursor-pointer"
                                                value={formData.criterion_id}
                                                onChange={e => setFormData(prev => ({ ...prev, criterion_id: e.target.value }))}
                                                required
                                            >
                                                <option value="">Seleccionar Ponderación...</option>
                                                {criteria.map(c => (
                                                    <option key={c.id} value={c.id}>
                                                        {c.name.toUpperCase()} ({c.percentage}%)
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <div className="p-4 bg-rose-50 rounded-2xl border-2 border-rose-100 animate-pulse">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        onClose()
                                                        navigate(`/evaluation/setup?groupId=${groupId}&periodId=${periodId}`)
                                                    }}
                                                    className="w-full text-[10px] font-black text-rose-600 uppercase tracking-widest hover:underline text-left"
                                                >
                                                    ⚠️ SIN CRITERIOS. CONFIGURAR AQUÍ.
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Instrumento</label>
                                        <select
                                            className="input-squishy w-full px-6 py-4 text-xs font-black text-slate-600 bg-slate-50 appearance-none"
                                            value={formData.instrument_id}
                                            onChange={e => setFormData(prev => ({ ...prev, instrument_id: e.target.value }))}
                                        >
                                            <option value="">Ninguno / Manual</option>
                                            {rubrics.map(r => (
                                                <option key={r.id} value={r.id}>
                                                    {r.title.toUpperCase()} ({r.type === 'CHECKLIST' ? 'LISTA' : 'RÚBRICA'})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 3. Dates Section */}
                        <div className="squishy-card p-10 bg-indigo-950 text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full -mr-16 -mt-16 blur-3xl" />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                                {formData.type === 'PROJECT' && (
                                    <div className="space-y-4">
                                        <label className="flex items-center gap-2 text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em]">
                                            <Calendar className="w-4 h-4" /> Lanzamiento
                                        </label>
                                        <input
                                            type="date"
                                            className="w-full bg-indigo-900/50 border-2 border-indigo-800 rounded-2xl px-6 py-4 text-white font-black text-sm outline-none focus:border-indigo-400 transition-all shadow-inner"
                                            value={formData.start_date || ''}
                                            onChange={e => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                                        />
                                    </div>
                                )}

                                <div className={formData.type === 'PROJECT' ? 'space-y-4' : 'col-span-2 space-y-4'}>
                                    <label className="flex items-center gap-2 text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em]">
                                        <Clock className="w-4 h-4" /> {formData.type === 'PROJECT' ? 'Fecha Límite Final' : 'Plazo de Entrega'} <span className="text-rose-400">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full bg-indigo-900/50 border-2 border-indigo-800 rounded-2xl px-6 py-4 text-white font-black text-sm outline-none focus:border-indigo-400 transition-all shadow-inner"
                                        value={formData.due_date}
                                        onChange={e => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Footer / Actions */}
                        <div className="flex flex-col md:flex-row justify-between items-center gap-6 pt-6 border-t border-slate-100">
                            <div>
                                {lessonPlanId && (
                                    <button
                                        type="button"
                                        onClick={() => setIsAIGeneratorOpen(true)}
                                        className="flex items-center gap-3 px-6 py-4 rounded-[2rem] bg-gradient-to-tr from-violet-600 to-indigo-600 text-white font-black uppercase text-xs tracking-widest btn-tactile shadow-xl shadow-indigo-200"
                                    >
                                        <Sparkles className="h-5 w-5 animate-pulse" />
                                        <span>Potenciar con IA</span>
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-4 w-full md:w-auto">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 md:flex-none px-8 py-4 text-slate-400 font-black uppercase text-xs tracking-widest hover:text-slate-600 transition-colors"
                                >
                                    Descartar
                                </button>
                                <button
                                    type="submit"
                                    disabled={
                                        isLoading ||
                                        criteria.length === 0 ||
                                        !formData.title.trim() ||
                                        !formData.description.trim() ||
                                        !formData.criterion_id ||
                                        !formData.due_date
                                    }
                                    className="flex-1 md:flex-none px-12 py-4 bg-indigo-600 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-indigo-200 btn-tactile hover:bg-indigo-700 disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-3"
                                >
                                    {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    <span>{isLoading ? 'Guardando...' : 'Fijar Misión'}</span>
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
                initialContext={(() => {
                    const act = activities.find(a => a.id === selectedActivityId)
                    if (!act) return undefined

                    let fullContext = act.description
                    if (act.rawContext && act.rawContext.phases) {
                        try {
                            fullContext = act.rawContext.phases.map((p: any) => `${p.name}: ${p.activities.join(' ')}`).join('\n')
                        } catch (e) {
                            console.error('Error stringifying raw context', e)
                        }
                    }

                    return { type: 'ACTIVITY', value: act, label: fullContext }
                })()}
                onInstrumentCreated={(data: any) => {
                    console.log('[CreateAssignmentModal] AI Instrument created callback data:', data)

                    // Map AI type to our internal enums to be safe
                    const validTypes = ['HOMEWORK', 'CLASSWORK', 'PROJECT', 'EXAM', 'PARTICIPATION']
                    const mappedType = validTypes.includes(data.type) ? data.type : (data.type === 'CLASS' ? 'CLASSWORK' : 'HOMEWORK')

                    setFormData(prev => ({
                        ...prev,
                        title: data.title?.toUpperCase() || prev.title,
                        description: data.description?.toUpperCase() || prev.description,
                        type: mappedType,
                        instrument_id: data.instrumentId || prev.instrument_id,
                        criterion_id: prev.criterion_id
                    }))

                    if (tenant?.id) {
                        supabase
                            .from('rubrics')
                            .select('id, title, type')
                            .eq('tenant_id', tenant.id)
                            .then(({ data: rubData }) => {
                                console.log('[CreateAssignmentModal] Refetched rubrics after AI generation:', rubData?.length)
                                setRubrics(rubData || [])
                            })
                    }
                    if (data.location) {
                        setLocation(data.location)
                    }
                    alert(`¡Misión "${data.title}" reforzada con IA!`)
                }}
            />
            <DictationModeModal
                isOpen={isDictationModeOpen}
                onClose={() => setIsDictationModeOpen(false)}
                title={formData.title || 'SIN TÍTULO'}
                content={formData.description || 'SIN INSTRUCCIONES'}
            />
        </div>
    )
}

