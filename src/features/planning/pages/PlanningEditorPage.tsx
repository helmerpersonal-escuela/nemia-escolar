import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { useProfile } from '../../../hooks/useProfile'
import { useOfflineSync } from '../../../hooks/useOfflineSync'
import { GeminiService } from '../../../lib/gemini'
import { GroqService } from '../../../lib/groq'
import {
    Save,
    ArrowLeft,
    Clock,
    Plus,
    Trash2,
    Target,
    BookOpen,
    Layers,
    ClipboardCheck,
    Sparkles,
    Printer,
    CheckCircle2,
    Calendar,
    Search,
    BookMarked,
    Briefcase,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react'
import { PDFUpload } from '../../../components/common/PDFUpload'
import { PDA_CATALOG, RESOURCE_CATALOG } from '../constants/planningConstants'

interface Group {
    id: string
    grade: string
    section: string
}

interface Subject {
    id: string
    name: string
}

interface EvaluationPeriod {
    id: string
    name: string
}

export const PlanningEditorPage = () => {
    const { profile } = useProfile()
    const { id } = useParams()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const { data: tenant } = useTenant()
    const { isOnline, addToQueue, pendingCount } = useOfflineSync()

    // Check for preview mode in URL
    useEffect(() => {
        if (searchParams.get('mode') === 'preview') {
            setIsPreviewMode(true)
        }
    }, [searchParams])

    // Data Lists
    const [groups, setGroups] = useState<Group[]>([])
    const [periods, setPeriods] = useState<EvaluationPeriod[]>([])
    const [subjects, setSubjects] = useState<Subject[]>([])

    // Catalog Modals state
    const [isPdaModalOpen, setIsPdaModalOpen] = useState(false)
    const [isResourceModalOpen, setIsResourceModalOpen] = useState(false)
    const [resourceSearch, setResourceSearch] = useState('')

    // Form State
    const [step, setStep] = useState(1) // Wizard Step State
    const [profileData, setProfileData] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [isPreviewMode, setIsPreviewMode] = useState(false)
    const [aiSuggestions, setAiSuggestions] = useState<any[]>([])
    const [selectedAiProposalIdx, setSelectedAiProposalIdx] = useState<number | null>(null)
    const [isAiPanelOpen, setIsAiPanelOpen] = useState(false)
    const [analyticalProgram, setAnalyticalProgram] = useState<any>(null)
    const [programContents, setProgramContents] = useState<any[]>([])
    const [isProgramModalOpen, setIsProgramModalOpen] = useState(false)
    const [activeSessionTab, setActiveSessionTab] = useState(0)
    const [errorModal, setErrorModal] = useState({ isOpen: false, title: '', message: '', action: null as any })
    const [formData, setFormData] = useState({
        title: '',
        group_id: '',
        subject_id: '',
        period_id: '',
        temporality: 'WEEKLY',
        purpose: '',
        project_duration: 10,
        start_date: '',
        end_date: '',
        campo_formativo: 'Lenguajes',
        metodologia: 'Aprendizaje Basado en Proyectos (ABP)',
        problem_context: '',
        objectives: [''],
        contents: [''],
        pda: [''],
        ejes_articuladores: [] as string[],
        activities_sequence: [] as any[],
        resources: [''],
        evaluation_plan: {
            instruments: ['']
        },
        source_document_url: '',
        extracted_text: ''
    })

    const EJES = [
        'Inclusión',
        'Pensamiento Crítico',
        'Interculturalidad Crítica',
        'Igualdad de Género',
        'Vida Saludable',
        'Fomento a la Lectura y Escritura',
        'Artes y Experiencias Estéticas'
    ]

    const CAMPOS = [
        'Lenguajes',
        'Saberes y Pensamiento Científico',
        'Ética, Naturaleza y Sociedades',
        'De lo Humano y lo Comunitario'
    ]

    const METODOLOGIAS = [
        'Aprendizaje Basado en Proyectos (ABP)',
        'Aprendizaje Basado en Indagación (STEAM)',
        'Aprendizaje Basado en Problemas (ABP-Problemas)',
        'Aprendizaje Servicio (AS)'
    ]

    // Persistence: Save to localStorage
    useEffect(() => {
        const draftId = id || 'new'
        const draft = { formData, step, timestamp: new Date().getTime() }
        localStorage.setItem(`lp_draft_${draftId}`, JSON.stringify(draft))
    }, [formData, step, id])

    // Fetch Analytical Program Contents for the selected Subject
    useEffect(() => {
        const fetchProgramContents = async () => {
            if (!analyticalProgram?.id || !formData.subject_id) {
                setProgramContents([])
                return
            }

            const { data } = await supabase
                .from('analytical_program_contents')
                .select('*')
                .eq('program_id', analyticalProgram.id)
                .eq('subject_id', formData.subject_id)

            if (data) {
                setProgramContents(data)
                // If new planning, pre-populate first content/pda if available
                if (!id || id === 'new') {
                    if (data.length > 0) {
                        setFormData(prev => ({
                            ...prev,
                            campo_formativo: data[0].campo_formativo || prev.campo_formativo,
                            ejes_articuladores: data[0].ejes_articuladores || prev.ejes_articuladores
                        }))
                    }
                }
            }
        }
        fetchProgramContents()
    }, [analyticalProgram?.id, formData.subject_id, id])

    // Reactive Subject Fetching based on Group Selection
    useEffect(() => {
        const fetchSubjects = async () => {
            if (!tenant?.id) {
                setSubjects([])
                return
            }

            // 1. Fetch Group specific subjects
            let groupSubjectsData: any[] = []
            if (formData.group_id) {
                const { data } = await supabase
                    .from('group_subjects')
                    .select(`
                        id, 
                        subject_catalog_id, 
                        custom_name,
                        subject_catalog(name)
                    `)
                    .eq('group_id', formData.group_id)
                if (data) groupSubjectsData = data
            }

            // 2. Fetch User Profile subjects (from settings)
            const { data: { user } } = await supabase.auth.getUser()
            let profileSubjectsData: any[] = []
            if (user) {
                const { data } = await supabase
                    .from('profile_subjects')
                    .select(`
                        id,
                        subject_catalog_id,
                        custom_detail,
                        subject_catalog(name)
                    `)
                    .eq('profile_id', user.id)
                if (data) profileSubjectsData = data
            }

            // 3. Merge and Deduplicate
            const subjectsMap = new Map()

            // Process Group Subjects first
            groupSubjectsData.forEach(gs => {
                const id = gs.subject_catalog_id || gs.id
                subjectsMap.set(id, {
                    id,
                    name: gs.subject_catalog?.name || gs.custom_name
                })
            })

            // Add Profile Subjects (they might override or add new ones)
            profileSubjectsData.forEach(ps => {
                const id = ps.subject_catalog_id || ps.id
                if (!subjectsMap.has(id)) {
                    subjectsMap.set(id, {
                        id,
                        name: ps.subject_catalog?.name || ps.custom_detail || 'Materia Personalizada'
                    })
                }
            })

            const formattedSubjects = Array.from(subjectsMap.values())
            setSubjects(formattedSubjects)

            // Auto-clear subject if not in the new list
            // CRITICAL FIX: Don't clear if we are in edit mode and just loaded the plan, 
            // as the subjects list might still be fetching or the mapping might be different.
            const isEditing = id && id !== 'new'
            if (formData.subject_id && !formattedSubjects.some(s => s.id === formData.subject_id) && !isEditing) {
                setFormData(prev => ({ ...prev, subject_id: '' }))
            }
        }

        fetchSubjects()
    }, [formData.group_id, tenant?.id])

    const fetchProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { data: profileData } = await supabase.from('profiles').select('*').single()
            if (profileData) {
                setProfileData(profileData)
            }
        }
    }

    useEffect(() => {
        fetchProfile()
    }, [])

    useEffect(() => {
        if (!tenant) return
        const fetchData = async () => {
            setLoading(true)

            // Fetch Groups
            const { data: groupsData } = await supabase
                .from('groups')
                .select('id, grade, section')
                .eq('tenant_id', tenant.id)

            // Fetch Periods
            const { data: periodsData } = await supabase
                .from('evaluation_periods')
                .select('id, name, is_active, start_date, end_date')
                .eq('tenant_id', tenant.id)

            if (groupsData) setGroups(groupsData)
            if (periodsData) setPeriods(periodsData)

            // 1. Fetch Active Analytical Program
            const { data: program } = await supabase
                .from('analytical_programs')
                .select('*')
                .eq('tenant_id', tenant.id)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            const isNew = !id || id === 'new'
            if (!program && isNew) {
                setErrorModal({
                    isOpen: true,
                    title: 'Programa Analítico Requerido',
                    message: 'Para cumplir con el Plan de Estudio 2022 (NEM), es obligatorio contar con un Programa Analítico previo a la Planeación Didáctica. Por favor, crea tu programa primero.',
                    action: () => navigate('/analytical-program/new')
                })
                setLoading(false)
                return
            }

            if (program) setAnalyticalProgram(program)

            if (id && id !== 'new') {
                const { data: plan } = await supabase
                    .from('lesson_plans')
                    .select('*')
                    .eq('id', id)
                    .single()

                if (plan) {
                    const dbData = {
                        ...plan,
                        source_document_url: plan.source_document_url || '',
                        extracted_text: plan.extracted_text || ''
                    }

                    // Check for local draft
                    const localDraft = localStorage.getItem(`lp_draft_${id}`)
                    if (localDraft) {
                        try {
                            const parsed = JSON.parse(localDraft)
                            setFormData(parsed.formData)
                            setStep(parsed.step)
                            console.log('Restored state from local storage')
                        } catch (e) {
                            console.error('Error parsing local draft:', e)
                            setFormData(dbData)
                        }
                    } else {
                        setFormData(dbData)
                    }
                }
            } else {
                // Pre-populate context from Analytical Program if available
                const suggestion = program.pedagogical_strategies?.main_methodology ||
                    (program.pedagogical_strategies as any)?.methodology ||
                    'Aprendizaje Basado en Proyectos (ABP)'

                // Find closest match or default
                const match = METODOLOGIAS.find(m => suggestion.includes(m)) || METODOLOGIAS[0]

                const defaultData = {
                    ...formData,
                    metodologia: match,
                    problem_context: program.diagnosis_narrative || ''
                }

                // Check for draft for NEW plan
                const localDraft = localStorage.getItem('lp_draft_new')
                if (localDraft) {
                    try {
                        const parsed = JSON.parse(localDraft)
                        setFormData(parsed.formData)
                        setStep(parsed.step)
                        console.log('Restored NEW plan draft from local storage')
                    } catch (e) {
                        console.error('Error parsing local draft:', e)
                        setFormData(prev => ({ ...prev, ...defaultData }))
                    }
                } else {
                    setFormData(prev => ({ ...prev, ...defaultData }))
                }
            }
            // Auto-select period based on current date
            const today = new Date().toISOString().split('T')[0]
            const currentPeriod = periodsData?.find((p: any) => today >= p.start_date && today <= p.end_date)
            setLoading(false)
        }
        fetchData()
    }, [tenant, id])

    // Fetch Criteria when Group/Period changes
    useEffect(() => {
        const loadCriteria = async () => {
            if (formData.group_id && formData.period_id) {
                const { data } = await supabase
                    .from('evaluation_criteria')
                    .select('name, percentage')
                    .eq('group_id', formData.group_id)
                    .eq('period_id', formData.period_id)

                if (data && data.length > 0) {
                    const criteriaNames = data.map(c => `${c.name} (${c.percentage}%)`)
                    setFormData(prev => ({
                        ...prev,
                        evaluation_plan: {
                            ...prev.evaluation_plan,
                            criteria: criteriaNames
                        }
                    }))
                }
            }
        }
        loadCriteria()
    }, [formData.group_id, formData.period_id])

    const calculatePhaseDurations = (totalDuration: number) => {
        const apertura = Math.round(totalDuration * 0.15)
        const cierre = Math.round(totalDuration * 0.15)
        const desarrollo = totalDuration - apertura - cierre
        return { apertura, desarrollo, cierre }
    }

    const formatSession = (block: any, date: Date) => {
        const { apertura, desarrollo, cierre } = calculatePhaseDurations(block.duration)
        return {
            date: date.toISOString().split('T')[0],
            start_time: block.start_time,
            end_time: block.end_time,
            duration: block.duration,
            status: 'ACTIVE',
            phases: [
                { name: 'Apertura', duration: apertura, activities: ['Recuperación de saberes previos mediante lluvia de ideas.'] },
                { name: 'Desarrollo', duration: desarrollo, activities: ['Realización de actividad práctica según el contenido del PDA.'] },
                { name: 'Cierre', duration: cierre, activities: ['Reflexión grupal sobre el aprendizaje del día.'] }
            ]
        }
    }

    const generateSequenceFromSchedule = async () => {
        if (profile?.is_demo) {
            alert('Modo Demo: La generación de secuencias desde el horario está deshabilitada.')
            return
        }
        if (!tenant || !formData.group_id || !formData.subject_id) {
            alert('Por favor selecciona un Grupo y una Asignatura primero.')
            return
        }

        const selectedSubjectName = subjects.find(s => s.id === formData.subject_id)?.name

        setGenerating(true)
        try {
            const { data: schedule } = await supabase
                .from('schedules')
                .select('*')
                .eq('tenant_id', tenant.id)
                .eq('group_id', formData.group_id)
                .order('start_time', { ascending: true })

            if (!schedule || schedule.length === 0) {
                alert('No se encontró un horario cargado para este grupo.')
                return
            }

            const daysOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
            const sessions: any[] = []

            let weeksToGenerate = 1
            if (formData.temporality === 'MONTHLY') weeksToGenerate = 4
            if (formData.temporality === 'TRIMESTER') weeksToGenerate = 12
            if (formData.temporality === 'PROJECT') weeksToGenerate = 2

            const referenceDate = new Date()

            const filteredSchedule = schedule
                .filter(s => {
                    const isCatalogMatch = s.subject_id === formData.subject_id
                    const isNameMatch = s.custom_subject && selectedSubjectName &&
                        s.custom_subject.toLowerCase() === selectedSubjectName.toLowerCase()
                    return isCatalogMatch || isNameMatch
                })
                .sort((a, b) => {
                    const dayDiff = daysOrder.indexOf(a.day_of_week) - daysOrder.indexOf(b.day_of_week)
                    if (dayDiff !== 0) return dayDiff
                    return a.start_time.localeCompare(b.start_time)
                })

            if (filteredSchedule.length === 0) {
                alert('No se encontraron clases para esta asignatura en el horario.')
                return
            }

            const blocks: any[] = []
            let currentBlock: any = null

            filteredSchedule.forEach(item => {
                if (!currentBlock || currentBlock.day_of_week !== item.day_of_week || item.start_time !== currentBlock.end_time) {
                    if (currentBlock) blocks.push(currentBlock)
                    currentBlock = { ...item, duration: 50 }
                } else {
                    currentBlock.end_time = item.end_time
                    currentBlock.duration += 50
                }
            })
            if (currentBlock) blocks.push(currentBlock)

            let week = 0
            const targetCount = formData.temporality === 'PROJECT' ? (formData.project_duration || 10) : (weeksToGenerate * blocks.length)

            while (sessions.length < targetCount) {
                if (week > 52) break

                for (const block of blocks) {
                    if (sessions.length >= targetCount) break

                    const targetDayIdx = daysOrder.indexOf(block.day_of_week)
                    const currentDayIdx = referenceDate.getDay() === 0 ? 6 : referenceDate.getDay() - 1

                    let daysUntil = targetDayIdx - currentDayIdx
                    if (daysUntil < 0 || (daysUntil === 0 && week === 0)) {
                        if (daysUntil < 0) daysUntil += 7
                    }

                    const sessionDate = new Date(referenceDate)
                    sessionDate.setDate(referenceDate.getDate() + daysUntil + (week * 7))

                    sessions.push(formatSession(block, sessionDate))
                }
                week++
            }

            sessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

            setFormData({
                ...formData,
                activities_sequence: sessions,
                start_date: sessions.length > 0 ? sessions[0].date : '',
                end_date: sessions.length > 0 ? sessions[sessions.length - 1].date : ''
            })
            setActiveSessionTab(0)
            alert(`Se han generado ${sessions.length} sesiones.`)
        } catch (error) {
            console.error(error)
            alert('Error al generar la secuencia.')
        } finally {
            setGenerating(false)
        }
    }

    const getSessionTitle = (session: any) => {
        const date = new Date(session.date + 'T12:00:00')
        const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
        const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

        const dayName = dayNames[date.getDay()]
        const dayNumber = date.getDate()
        const monthName = monthNames[date.getMonth()]

        const startTime = (session.start_time || '').slice(0, 5).replace(/^0/, '')
        const endTime = (session.end_time || '').slice(0, 5).replace(/^0/, '')

        return `${dayName} ${dayNumber} de ${monthName} de ${startTime} a ${endTime} ${session.duration} min.`
    }

    const generateAiSuggestions = async () => {
        if (!formData.campo_formativo || !formData.metodologia) {
            alert('Define el Campo Formativo y Metodología primero.')
            return
        }

        const apiKey = tenant?.aiConfig?.apiKey
        if (!apiKey) {
            if (confirm('No se ha configurado la API Key de IA para la escuela. ¿Deseas configurarla ahora?')) {
                navigate('/settings')
            }
            return
        }

        setIsAiPanelOpen(true)
        setAiSuggestions([])
        setSelectedAiProposalIdx(null)
        setGenerating(true)

        try {
            const aiService = apiKey.startsWith('gsk_')
                ? new GroqService(apiKey)
                : new GeminiService(apiKey)

            const suggestions = await aiService.generateLessonPlanSuggestions({
                topic: formData.title || 'Tema General',
                subject: subjects.find(s => s.id === formData.subject_id)?.name,
                grade: groups.find(g => g.id === formData.group_id)?.grade,
                field: formData.campo_formativo,
                methodology: formData.metodologia,
                problemContext: formData.problem_context,
                pdaDetail: formData.pda.join('. '),
                sessions: formData.activities_sequence.map(s => ({ date: s.date, duration: s.duration })),
                temporality: formData.temporality,
                purpose: formData.purpose
            })

            setAiSuggestions(suggestions)
        } catch (error) {
            console.error(error)
            alert('Error al generar sugerencias con IA. Verifica tu cuota o conexión.')
        } finally {
            setGenerating(false)
        }
    }

    const applyAiSuggestion = async (suggestion: any) => {
        if (profile?.is_demo) {
            alert('Modo Demo: No puedes aplicar sugerencias de IA en este perfil de prueba.')
            return
        }
        const newSequence = formData.activities_sequence.map((session) => {
            // Buscar si la sugerencia tiene contenido para esta fecha específica
            const sessionSuggestion = suggestion.sessions?.find((s: any) => s.date === session.date)

            if (sessionSuggestion) {
                const { apertura, desarrollo, cierre } = calculatePhaseDurations(session.duration)
                return {
                    ...session,
                    phases: [
                        { name: 'Apertura', duration: apertura, activities: [sessionSuggestion.apertura] },
                        { name: 'Desarrollo', duration: desarrollo, activities: [sessionSuggestion.desarrollo] },
                        { name: 'Cierre', duration: cierre, activities: [sessionSuggestion.cierre] }
                    ]
                }
            }
            return session
        })

        const updatedFormData = {
            ...formData,
            activities_sequence: newSequence
        }

        setFormData(updatedFormData)
        setIsAiPanelOpen(false)
        setSelectedAiProposalIdx(null)

        // Autoguardado
        if (tenant?.id) {
            setSaving(true)
            try {
                const planData = {
                    ...updatedFormData,
                    tenant_id: tenant.id,
                    updated_at: new Date().toISOString(),
                    source_document_url: formData.source_document_url,
                    extracted_text: formData.extracted_text
                }

                if (!isOnline) {
                    addToQueue({
                        table: 'lesson_plans',
                        action: id && id !== 'new' ? 'UPDATE' : 'INSERT',
                        data: planData,
                        filters: id && id !== 'new' ? { id } : undefined
                    })
                    if (!id || id === 'new') {
                        localStorage.removeItem('lp_draft_new')
                    } else {
                        localStorage.removeItem(`lp_draft_${id}`)
                    }
                    console.log('Sugerencia de IA encolada (Offline)')
                } else {
                    if (id && id !== 'new') {
                        await supabase.from('lesson_plans').update(planData).eq('id', id)
                    } else {
                        const { data } = await supabase.from('lesson_plans').insert([planData]).select().single()
                        if (data?.id) {
                            localStorage.removeItem('lp_draft_new')
                            localStorage.removeItem(`lp_draft_${data.id}`)
                        }
                    }
                    if (id && id !== 'new') localStorage.removeItem(`lp_draft_${id}`)
                    console.log('Autoguardado completado tras aplicar IA')
                }
            } catch (error) {
                console.error('Fallo el autoguardado:', error)
            } finally {
                setSaving(false)
            }
        }
    }

    const handleSave = async () => {
        if (profile?.is_demo) {
            alert('Modo Demo: El guardado de planeaciones está deshabilitado.')
            return
        }
        if (!tenant) return
        setSaving(true)
        try {
            const planData = {
                ...formData,
                tenant_id: tenant.id,
                updated_at: new Date().toISOString()
            }

            if (!isOnline) {
                addToQueue({
                    table: 'lesson_plans',
                    action: id && id !== 'new' ? 'UPDATE' : 'INSERT',
                    data: planData,
                    filters: id && id !== 'new' ? { id } : undefined
                })
                if (id && id !== 'new') {
                    localStorage.removeItem(`lp_draft_${id}`)
                } else {
                    localStorage.removeItem('lp_draft_new')
                }
                alert('Modo Offline: Planeación guardada localmente. Se sincronizarán al recuperar internet.')
                navigate('/planning')
                return
            }

            if (id && id !== 'new') {
                await supabase.from('lesson_plans').update(planData).eq('id', id)
                localStorage.removeItem(`lp_draft_${id}`)
            } else {
                const { data } = await supabase.from('lesson_plans').insert([planData]).select().single()
                if (data?.id) {
                    localStorage.removeItem('lp_draft_new')
                    localStorage.removeItem(`lp_draft_${data.id}`)
                }
            }
            alert('Planeación guardada con éxito')
            navigate('/planning')
        } catch (error) {
            console.error(error)
            alert('Error al guardar')
        } finally {
            setSaving(false)
        }
    }

    const addItem = (field: 'objectives' | 'contents' | 'pda' | 'resources') => {
        setFormData({ ...formData, [field]: [...formData[field], ''] })
    }

    const removeItem = (field: 'objectives' | 'contents' | 'pda' | 'resources', index: number) => {
        setFormData({ ...formData, [field]: formData[field].filter((_, i) => i !== index) })
    }

    const updateItem = (field: 'objectives' | 'contents' | 'pda' | 'resources', index: number, value: string) => {
        const newList = [...formData[field]]
        newList[index] = value
        setFormData({ ...formData, [field]: newList })
    }

    const toggleEje = (eje: string) => {
        const current = formData.ejes_articuladores
        if (current.includes(eje)) {
            setFormData({ ...formData, ejes_articuladores: current.filter(e => e !== eje) })
        } else {
            setFormData({ ...formData, ejes_articuladores: [...current, eje] })
        }
    }

    const validateStep = (currentStep: number) => {
        if (isPreviewMode) return true

        switch (currentStep) {
            case 1:
                if (!formData.title) return alert('Debes ingresar un título para el proyecto.')
                if (!formData.group_id) return alert('Selecciona un grupo.')
                if (!formData.subject_id) return alert('Selecciona una asignatura.')
                if (!formData.temporality) return alert('Define la temporalidad.')
                return true
            case 2:
                if (!formData.campo_formativo) return alert('Selecciona un Campo Formativo.')
                if (!formData.metodologia) return alert('Selecciona una Metodología.')
                if (!formData.problem_context) return alert('Describe la problemática o contexto.')
                if (formData.ejes_articuladores.length === 0) return alert('Selecciona al menos un Eje Articulador.')
                return true
            case 3:
                // Contenidos y PDA son flexibles, pero idealmente debería haber al menos 1
                return true
            default:
                return true
        }
    }

    if (loading) return <div className="p-20 text-center animate-pulse text-gray-400">Cargando editor...</div>

    return (
        <div className="max-w-6xl mx-auto px-4 py-8 pb-32">
            {/* Top Navigation & Actions */}
            <div className="flex justify-between items-center mb-8">
                <button
                    onClick={() => navigate('/planning')}
                    className="flex items-center text-gray-500 hover:text-gray-900 transition-colors font-bold text-sm"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Volver al listado
                </button>
                <div className="flex items-center space-x-3">
                    {pendingCount > 0 && (
                        <div className="flex items-center px-3 py-1 bg-blue-50 text-blue-600 rounded-full border border-blue-100 animate-pulse">
                            <Clock className="w-3 h-3 mr-1.5" />
                            <span className="text-[10px] font-black uppercase tracking-widest">{pendingCount} Pendientes</span>
                        </div>
                    )}
                    {!isOnline && (
                        <div className="flex items-center px-3 py-1 bg-amber-50 text-amber-600 rounded-full border border-amber-100">
                            <Sparkles className="w-3 h-3 mr-1.5" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Modo Offline</span>
                        </div>
                    )}
                    {!isPreviewMode && (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-xs font-black shadow-lg shadow-indigo-100 flex items-center hover:bg-indigo-700 transition-all uppercase tracking-wider disabled:opacity-50"
                        >
                            <Save className="w-3.5 h-3.5 mr-2" />
                            {saving ? 'Guardando...' : 'Guardar Progreso'}
                        </button>
                    )}
                </div>
            </div>

            {/* Stepper Progress (Only in Editor Mode) */}
            {!isPreviewMode && (
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-8 overflow-x-auto">
                    <div className="flex justify-between items-center min-w-[600px] relative">
                        {/* Connecting Line */}
                        <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-50 -translate-y-1/2 z-0"></div>

                        {[
                            { n: 1, label: 'Datos Generales', icon: BookOpen },
                            { n: 2, label: 'Estructura NEM', icon: Target },
                            { n: 3, label: 'Contenidos', icon: Layers },
                            { n: 4, label: 'Secuencia', icon: Clock },
                            { n: 5, label: 'Cierre', icon: ClipboardCheck }
                        ].map((s) => (
                            <button
                                key={s.n}
                                onClick={() => {
                                    if (s.n < step) setStep(s.n)
                                    else if (validateStep(step)) setStep(s.n)
                                }}
                                className={`relative z-10 flex flex-col items-center group focus:outline-none transition-all ${step === s.n ? 'scale-110' : 'opacity-60 hover:opacity-100'}`}
                            >
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-4 transition-all duration-300
                                    ${step >= s.n
                                        ? 'bg-indigo-600 border-indigo-100 text-white shadow-lg shadow-indigo-100'
                                        : 'bg-white border-gray-100 text-gray-300'}`}
                                >
                                    <s.icon className="w-5 h-5" />
                                </div>
                                <span className={`text-[10px] font-black uppercase mt-3 tracking-wider bg-white px-2 rounded-full
                                    ${step >= s.n ? 'text-indigo-600' : 'text-gray-400'}`}>
                                    {s.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex gap-8 items-start relative">
                {/* Main Content Area */}
                <div className={`flex-1 bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-white overflow-hidden transition-all duration-500 ${isPreviewMode ? 'max-w-4xl mx-auto' : ''}`}>

                    {/* Header Banner (Conditional) */}
                    {isPreviewMode && (
                        <div className="bg-gray-50 border-b border-gray-100 p-8 flex justify-between items-start">
                            <div className="flex items-center">
                                <div className="p-3 bg-indigo-600 rounded-2xl text-white mr-4 shadow-lg shadow-indigo-100">
                                    <BookOpen className="w-6 h-6" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Planeación Didáctica</h1>
                                    <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-1">Gobernanza Escolar • Nueva Escuela Mexicana</p>
                                </div>
                            </div>
                            <div className="text-right flex flex-col items-end">
                                <span className="text-[10px] uppercase font-black text-gray-400 mb-1">Ciclo Escolar</span>
                                <div className="flex items-center bg-white px-3 py-1 rounded-full border border-gray-100 text-sm font-bold text-gray-800 shadow-sm">
                                    <Calendar className="w-3 h-3 mr-2 text-indigo-400" />
                                    2025-2026
                                </div>
                                <button
                                    onClick={() => profile?.is_demo ? alert('Modo Demo: La impresión está deshabilitada.') : window.print()}
                                    className={`mt-4 flex items-center font-bold text-[10px] uppercase tracking-widest no-print transition-colors ${profile?.is_demo ? 'text-gray-400 cursor-not-allowed' : 'text-indigo-600 hover:text-indigo-800'
                                        }`}
                                >
                                    <Printer className="w-3.5 h-3.5 mr-2" /> Imprimir / PDF
                                </button>
                            </div>
                        </div>
                    )}

                    <div className={`p-8 md:p-12 space-y-8 ${isPreviewMode ? 'print:p-0 print:space-y-8' : ''}`}>

                        {/* Section 1: Contexto y Datos */}
                        {(step === 1 || isPreviewMode) && (<section className={isPreviewMode ? 'grid grid-cols-2 gap-8' : ''}>
                            {!isPreviewMode ? (
                                <>
                                    <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center">
                                        <span className="w-8 h-[1px] bg-gray-200 mr-3"></span>
                                        01. Identificación y Contexto
                                    </h2>

                                    {/* Carga de PDF Existente (Opcional) - Solo al crear nueva */}
                                    {(!id || id === 'new') && (
                                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 mb-8 col-span-3">
                                            <div className="flex gap-6 items-start">
                                                <div className="flex-1">
                                                    <h3 className="text-sm font-bold text-indigo-900 uppercase mb-2 flex items-center">
                                                        <BookOpen className="w-4 h-4 mr-2 text-indigo-600" />
                                                        ¿Ya tienes tu Planeación en PDF?
                                                    </h3>
                                                    <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                                                        Sube tu planeación existente. Validaremos su estructura (Inicio, Desarrollo, Cierre) y la guardaremos para que la IA la utilice como contexto.
                                                    </p>
                                                    <PDFUpload
                                                        label="Subir Planeación (PDF)"
                                                        validationKeywords={['Inicio', 'Desarrollo', 'Cierre']}
                                                        onUploadComplete={(url, text) => {
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                source_document_url: url,
                                                                extracted_text: text
                                                            }))
                                                            alert('Planeación cargada y vinculada correctamente.')
                                                        }}
                                                    />
                                                    {formData.source_document_url && (
                                                        <div className="mt-2 text-xs text-emerald-600 font-bold flex items-center">
                                                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                                            Archivo vinculado
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="col-span-1 md:col-span-2">
                                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Proyecto / Título de la Planeación</label>
                                            <input
                                                type="text"
                                                value={formData.title}
                                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                                placeholder="Ej: Innovación Tecnológica para la Comunidad..."
                                            />
                                        </div>
                                        {formData.temporality === 'PROJECT' && (
                                            <div className="col-span-1 md:col-span-2">
                                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Propósito del Proyecto</label>
                                                <textarea
                                                    value={formData.purpose || ''}
                                                    onChange={e => setFormData({ ...formData, purpose: e.target.value })}
                                                    placeholder="Ej: Que los alumnos investiguen el valor nutricional..."
                                                    rows={2}
                                                    className="w-full bg-gray-50/50 border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-800 focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                                                />
                                            </div>
                                        )}
                                        {formData.temporality === 'PROJECT' && (
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Duración (Sesiones)</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={formData.project_duration || 10}
                                                    onChange={e => setFormData({ ...formData, project_duration: parseInt(e.target.value) || 1 })}
                                                    className="w-full bg-gray-50/50 border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-800 focus:ring-2 focus:ring-indigo-500 transition-all"
                                                />
                                            </div>
                                        )}
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Temporalidad</label>
                                            <select
                                                value={formData.temporality}
                                                onChange={e => setFormData({ ...formData, temporality: e.target.value })}
                                                className="w-full bg-gray-50/50 border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-800 focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="WEEKLY">Semanal</option>
                                                <option value="MONTHLY">Mensual</option>
                                                <option value="TRIMESTER">Trimestral</option>
                                                <option value="PROJECT">Por Proyecto</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Grupo</label>
                                            <select
                                                value={formData.group_id}
                                                onChange={e => setFormData({ ...formData, group_id: e.target.value })}
                                                className="w-full bg-gray-50/50 border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-800 focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="">Seleccionar Grupo</option>
                                                {groups.map(g => (
                                                    <option key={g.id} value={g.id}>{g.grade}° "{g.section}"</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Asignatura</label>
                                            <select
                                                value={formData.subject_id}
                                                onChange={e => setFormData({ ...formData, subject_id: e.target.value })}
                                                className="w-full bg-gray-50/50 border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-800 focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="">Seleccionar Asignatura</option>
                                                {subjects.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Periodo</label>
                                            <select
                                                value={formData.period_id}
                                                onChange={e => setFormData({ ...formData, period_id: e.target.value })}
                                                className="w-full bg-gray-50/50 border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-800 focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="">Seleccionar Periodo</option>
                                                {periods.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="col-span-2 grid grid-cols-2 gap-4 bg-gray-50 p-6 rounded-2xl border border-gray-100">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Proyecto</p>
                                        <p className="font-bold text-gray-900">{formData.title || 'Proyecto sin Título'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Temporalidad</p>
                                        <p className="font-bold text-indigo-600">
                                            {formData.temporality === 'WEEKLY' ? 'Semanal' :
                                                formData.temporality === 'MONTHLY' ? 'Mensual' :
                                                    formData.temporality === 'TRIMESTER' ? 'Trimestral' :
                                                        'Por Proyecto'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Grado y Grupo</p>
                                        <p className="font-bold text-gray-900">{groups.find(g => g.id === formData.group_id)?.grade}° "{groups.find(g => g.id === formData.group_id)?.section}"</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Asignatura</p>
                                        <p className="font-bold text-gray-900">{subjects.find(s => s.id === formData.subject_id)?.name}</p>
                                    </div>
                                </div>
                            )}
                        </section>)}

                        {/* Section 2: Estructura NEM */}
                        {(step === 2 || isPreviewMode) && (<section>
                            <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center">
                                <span className="w-8 h-[1px] bg-gray-200 mr-3"></span>
                                02. Estructura Curricular (NEM)
                            </h2>
                            <div className={`grid grid-cols-1 md:grid-cols-2 gap-8 ${isPreviewMode ? 'bg-white' : ''}`}>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Campo Formativo</label>
                                        {!isPreviewMode ? (
                                            <div className="grid grid-cols-1 gap-2">
                                                {CAMPOS.map(c => (
                                                    <button
                                                        key={c}
                                                        onClick={() => setFormData({ ...formData, campo_formativo: c })}
                                                        className={`text-left px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all
                                                            ${formData.campo_formativo === c
                                                                ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm'
                                                                : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200'}`}
                                                    >
                                                        {c}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex items-center space-x-2 bg-indigo-50 text-indigo-700 px-4 py-3 rounded-xl font-bold border border-indigo-100">
                                                <Target className="w-4 h-4" />
                                                <span>{formData.campo_formativo}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Situación Problemática / Justificación</label>
                                        {!isPreviewMode ? (
                                            <textarea
                                                rows={4}
                                                value={formData.problem_context}
                                                onChange={e => setFormData({ ...formData, problem_context: e.target.value })}
                                                placeholder="Describe la problemática detectada en la comunidad o aula..."
                                                className="w-full bg-gray-50/50 border-gray-200 rounded-xl px-4 py-3 font-medium text-gray-700 focus:ring-2 focus:ring-indigo-500"
                                            />
                                        ) : (
                                            <p className="text-sm font-medium text-gray-600 leading-relaxed italic bg-gray-50 p-4 rounded-xl border border-gray-100">
                                                "{formData.problem_context || 'No se definió una situación problemática.'}"
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Metodología Sugerida</label>
                                        {!isPreviewMode ? (
                                            <select
                                                value={formData.metodologia}
                                                onChange={e => setFormData({ ...formData, metodologia: e.target.value })}
                                                className="w-full bg-gray-50/50 border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-800 focus:ring-2 focus:ring-indigo-500"
                                            >
                                                {METODOLOGIAS.map(m => (
                                                    <option key={m} value={m}>{m}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <div className="flex items-center space-x-2 bg-purple-50 text-purple-700 px-4 py-3 rounded-xl font-bold border border-purple-100">
                                                <Layers className="w-4 h-4" />
                                                <span>{formData.metodologia}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Ejes Articuladores</label>
                                        <div className="flex flex-wrap gap-2">
                                            {EJES.map(eje => {
                                                const isSelected = formData.ejes_articuladores.includes(eje)
                                                if (isPreviewMode && !isSelected) return null
                                                return (
                                                    <button
                                                        key={eje}
                                                        onClick={() => !isPreviewMode && toggleEje(eje)}
                                                        className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider border-2 transition-all
                                                            ${isSelected
                                                                ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-sm'
                                                                : 'bg-gray-50 border-transparent text-gray-400 hover:bg-gray-100'}`}
                                                    >
                                                        {eje}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>)}

                        {/* Section 3: PDAs y Contenidos */}
                        {(step === 3 || isPreviewMode) && (<section className={`${isPreviewMode ? 'bg-white' : 'bg-indigo-50/30 -mx-10 px-10 py-10'}`}>
                            <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center">
                                <span className="w-8 h-[1px] bg-gray-200 mr-3"></span>
                                03. Contenidos y Procesos (PDA)
                            </h2>
                            <div className="space-y-8">
                                <div>
                                    <div className="flex justify-between items-center mb-4">
                                        <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Contenidos Priorizados</label>
                                        {!isPreviewMode && (
                                            <div className="flex space-x-3">
                                                {programContents.length > 0 && (
                                                    <button
                                                        onClick={() => setIsProgramModalOpen(true)}
                                                        className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold text-[10px] uppercase flex items-center px-3 py-1 rounded-lg border border-indigo-100"
                                                    >
                                                        <Search className="w-3 h-3 mr-1.5" /> Vincular Programa Analítico
                                                    </button>
                                                )}
                                                <button onClick={() => addItem('contents')} className="text-gray-400 hover:text-indigo-600 font-bold text-[10px] uppercase flex items-center">
                                                    <Plus className="w-3 h-3 mr-1" /> Añadir Manual
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        {formData.contents.map((c, i) => (
                                            <div key={i} className="flex space-x-2">
                                                <div className={`rounded-xl flex-1 p-1 flex items-center ${isPreviewMode ? 'bg-white border-b-2 border-gray-50' : 'bg-white border border-indigo-100 shadow-sm'}`}>
                                                    <Target className="w-4 h-4 text-indigo-300 ml-3 mr-2 shrink-0" />
                                                    {!isPreviewMode ? (
                                                        <input
                                                            value={c}
                                                            onChange={e => updateItem('contents', i, e.target.value)}
                                                            className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-700"
                                                            placeholder="Contenido del programa sintético..."
                                                        />
                                                    ) : (
                                                        <span className="py-2 text-sm font-bold text-gray-800">{c || 'Sin especificar'}</span>
                                                    )}
                                                    {!isPreviewMode && (
                                                        <button onClick={() => removeItem('contents', i)} className="p-2 text-gray-200 hover:text-red-400">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-4">
                                        <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Procesos de Desarrollo de Aprendizaje (PDA)</label>
                                        {!isPreviewMode && (
                                            <div className="flex space-x-3">
                                                <button
                                                    onClick={() => setIsPdaModalOpen(true)}
                                                    className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold text-[10px] uppercase flex items-center px-3 py-1 rounded-lg border border-indigo-100"
                                                >
                                                    <BookMarked className="w-3 h-3 mr-1.5" /> Ver Catálogo
                                                </button>
                                                <button onClick={() => addItem('pda')} className="text-gray-400 hover:text-indigo-600 font-bold text-[10px] uppercase flex items-center">
                                                    <Plus className="w-3 h-3 mr-1" /> Añadir Manual
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        {formData.pda.map((p, i) => (
                                            <div key={i} className="flex space-x-2">
                                                <div className={`rounded-xl flex-1 p-1 flex items-center ${isPreviewMode ? 'bg-white border-b-2 border-gray-50' : 'bg-white border border-indigo-100 shadow-sm'}`}>
                                                    <Layers className="w-4 h-4 text-indigo-300 ml-3 mr-2 shrink-0" />
                                                    {!isPreviewMode ? (
                                                        <input
                                                            value={p}
                                                            onChange={e => updateItem('pda', i, e.target.value)}
                                                            className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-700"
                                                            placeholder="¿Qué se espera que el alumno logre progresivamente?"
                                                        />
                                                    ) : (
                                                        <span className="py-2 text-sm font-bold text-gray-800">{p || 'Sin especificar'}</span>
                                                    )}
                                                    {!isPreviewMode && (
                                                        <button onClick={() => removeItem('pda', i)} className="p-2 text-gray-200 hover:text-red-400">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>)}
                        {/* Section 4: Secuencia Didáctica */}
                        {(step === 4 || isPreviewMode) && (<section>
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] flex items-center">
                                    <span className="w-8 h-[1px] bg-gray-200 mr-3"></span>
                                    04. Secuencia de Actividades (Sesiones)
                                </h2>
                                {!isPreviewMode && (
                                    <div className="flex space-x-3 items-center">
                                        <p className="text-[10px] font-bold text-indigo-400 uppercase bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
                                            ¿Deseas usar sugerencias de la IA o agregar tus propias estrategias?
                                        </p>
                                        <button
                                            onClick={generateSequenceFromSchedule}
                                            disabled={generating}
                                            className="bg-purple-50 text-purple-600 px-3 py-1.5 rounded-xl text-[10px] font-black border border-purple-100 flex items-center hover:bg-purple-100 transition-all uppercase tracking-wider disabled:opacity-50"
                                        >
                                            <Clock className="w-3.5 h-3.5 mr-1.5" />
                                            Cargar de Horario
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Fechas del Periodo Calculadas */}
                            {formData.start_date && formData.end_date && (
                                <div className="mb-6 bg-indigo-50 border border-indigo-100 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                                    <div className="flex items-center space-x-4">
                                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                                            <Calendar className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Inicio del Periodo</p>
                                            {!isPreviewMode ? (
                                                <input
                                                    type="date"
                                                    value={formData.start_date}
                                                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                                    className="bg-white border border-indigo-100 text-gray-800 text-sm font-bold rounded-lg px-2 py-1 focus:ring-2 focus:ring-indigo-500 outline-none w-full"
                                                />
                                            ) : (
                                                <p className="font-bold text-gray-800 text-sm">{formData.start_date}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                                            <Calendar className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Fin del Periodo</p>
                                            {!isPreviewMode ? (
                                                <input
                                                    type="date"
                                                    value={formData.end_date}
                                                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                                    className="bg-white border border-indigo-100 text-gray-800 text-sm font-bold rounded-lg px-2 py-1 focus:ring-2 focus:ring-indigo-500 outline-none w-full"
                                                />
                                            ) : (
                                                <p className="font-bold text-gray-800 text-sm">{formData.end_date}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Sesiones</p>
                                        <p className="font-bold text-gray-900">{formData.activities_sequence.length}</p>
                                    </div>
                                </div>
                            )}


                            {!isPreviewMode && formData.activities_sequence.length === 0 && (
                                <div className="p-12 text-center border-2 border-dashed border-gray-100 rounded-2xl">
                                    <Clock className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                                    <p className="text-gray-400 font-bold text-sm">Usa el botón "Cargar de Horario" para generar las sesiones automáticamente.</p>
                                </div>
                            )}

                            <div className="space-y-8 print:space-y-12">
                                {!isPreviewMode && formData.activities_sequence.length > 0 && (
                                    <div className="flex space-x-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
                                        {formData.activities_sequence.map((_, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setActiveSessionTab(idx)}
                                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap border-2 
                                                    ${activeSessionTab === idx
                                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100'
                                                        : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'}`}
                                            >
                                                Sesión {idx + 1}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {formData.activities_sequence.map((session, sIdx) => {
                                    // In Editor mode, only show the active tab. In Preview, show all.
                                    if (!isPreviewMode && sIdx !== activeSessionTab) return null;

                                    return (
                                        <div key={sIdx} className={`${isPreviewMode ? 'bg-white border-l-4 border-indigo-600 pl-8 pb-8' : 'bg-gray-50/30 rounded-2xl p-6 border border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300'}`}>
                                            <div className="flex justify-between items-center mb-6">
                                                <div className="flex items-center">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black mr-4 ${isPreviewMode ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : session.status === 'ACTIVE' ? 'bg-indigo-100 text-indigo-600' : 'bg-red-100 text-red-600'}`}>
                                                        {sIdx + 1}
                                                    </div>
                                                    <div>
                                                        <h3 className={`font-black uppercase text-sm tracking-tight ${session.status !== 'ACTIVE' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                                            {getSessionTitle(session)}
                                                        </h3>
                                                        <div className="flex items-center space-x-3 mt-1">
                                                            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">{session.duration} minutos sesión</span>
                                                            {session.status === 'SUSPENDED' && <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">Suspensión de labores</span>}
                                                            {session.status === 'ABSENCE' && <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest bg-red-50 px-2 py-0.5 rounded-full border border-red-100">Inasistencia Docente</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                                {!isPreviewMode && (
                                                    <div className="flex items-center space-x-3">
                                                        <div className="flex flex-col items-end mr-4">
                                                            <label className="text-[8px] font-black text-gray-400 uppercase mb-1">Estado de Sesión</label>
                                                            <select
                                                                value={session.status}
                                                                onChange={e => {
                                                                    const newSeq = [...formData.activities_sequence]
                                                                    newSeq[sIdx].status = e.target.value
                                                                    setFormData({ ...formData, activities_sequence: newSeq })
                                                                }}
                                                                className="text-[10px] font-bold border-gray-200 rounded-lg bg-white px-2 py-1 focus:ring-1 focus:ring-indigo-500"
                                                            >
                                                                <option value="ACTIVE">Clase Normal</option>
                                                                <option value="SUSPENDED">Suspensión de labores</option>
                                                                <option value="ABSENCE">Inasistencia Docente</option>
                                                            </select>
                                                        </div>
                                                        <div className="flex flex-col items-end mr-4">
                                                            <label className="text-[8px] font-black text-gray-400 uppercase mb-1">Cambiar Fecha</label>
                                                            <input
                                                                type="date"
                                                                value={session.date}
                                                                onChange={e => {
                                                                    const newSeq = [...formData.activities_sequence]
                                                                    newSeq[sIdx].date = e.target.value
                                                                    setFormData({ ...formData, activities_sequence: newSeq })
                                                                }}
                                                                className="text-[10px] font-bold border-gray-200 rounded-lg bg-white px-2 py-1 focus:ring-1 focus:ring-indigo-500"
                                                            />
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                const newSeq = [...formData.activities_sequence]
                                                                newSeq.splice(sIdx, 1)
                                                                setFormData({ ...formData, activities_sequence: newSeq })
                                                                // Adjust active tab if needed
                                                                if (activeSessionTab >= newSeq.length) {
                                                                    setActiveSessionTab(Math.max(0, newSeq.length - 1))
                                                                }
                                                            }}
                                                            className="text-gray-300 hover:text-red-500 transition-colors p-2"
                                                        >
                                                            <Trash2 className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            <div className={`grid grid-cols-1 gap-8 ${session.status !== 'ACTIVE' ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                                                {session.phases.map((phase: any, pIdx: number) => (
                                                    <div key={pIdx} className="space-y-4">
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex items-center space-x-2">
                                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center">
                                                                    <span className="w-2 h-2 rounded-full bg-indigo-300 mr-2"></span>
                                                                    {phase.name}
                                                                </label>
                                                                <span className="text-[9px] font-bold text-indigo-400 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                                                                    {phase.duration || 0} min.
                                                                </span>
                                                            </div>
                                                            {!isPreviewMode && (
                                                                <button
                                                                    onClick={() => {
                                                                        const newSeq = [...formData.activities_sequence]
                                                                        newSeq[sIdx].phases[pIdx].activities.push('')
                                                                        setFormData({ ...formData, activities_sequence: newSeq })
                                                                    }}
                                                                    className="text-indigo-600 hover:text-indigo-800 font-bold text-[10px] uppercase flex items-center"
                                                                >
                                                                    <Plus className="w-3 h-3 mr-1" /> Añadir
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div className="space-y-3">
                                                            {phase.activities.map((act: string, aIdx: number) => (
                                                                <div key={aIdx} className="flex space-x-2">
                                                                    {!isPreviewMode ? (
                                                                        <>
                                                                            <textarea
                                                                                value={act}
                                                                                onChange={e => {
                                                                                    const newSeq = [...formData.activities_sequence]
                                                                                    newSeq[sIdx].phases[pIdx].activities[aIdx] = e.target.value
                                                                                    setFormData({ ...formData, activities_sequence: newSeq })
                                                                                }}
                                                                                rows={2}
                                                                                placeholder={`Actividad de ${phase.name.toLowerCase()}...`}
                                                                                className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
                                                                            />
                                                                            <button
                                                                                onClick={() => {
                                                                                    const newSeq = [...formData.activities_sequence]
                                                                                    newSeq[sIdx].phases[pIdx].activities.splice(aIdx, 1)
                                                                                    setFormData({ ...formData, activities_sequence: newSeq })
                                                                                }}
                                                                                className="p-2 text-gray-200 hover:text-red-400 mt-2 shrink-0"
                                                                            >
                                                                                <Trash2 className="w-4 h-4" />
                                                                            </button>
                                                                        </>
                                                                    ) : (
                                                                        <div className="flex items-start">
                                                                            <div className="w-5 h-5 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-400 mr-3 mt-0.5 shadow-sm border border-indigo-100 shrink-0">
                                                                                <CheckCircle2 className="w-3 h-3" />
                                                                            </div>
                                                                            <p className="text-sm font-medium text-gray-700 leading-relaxed">{act || 'Sin actividad registrada.'}</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>)}

                        {/* Section 5: Evaluación y Recursos */}
                        {(step === 5 || isPreviewMode) && (<section className={`grid grid-cols-1 md:grid-cols-2 gap-12 border-t border-gray-50 pt-12 ${isPreviewMode ? 'print:pt-8' : ''}`}>
                            <div>
                                <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center">
                                    <span className="w-8 h-[1px] bg-gray-200 mr-3"></span>
                                    05. Evaluación Formativa
                                </h2>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-3 ml-1">Instrumentos Sugeridos</label>

                                        {!isPreviewMode ? (
                                            <div className="space-y-4">
                                                {[
                                                    {
                                                        title: 'Observación y Registro',
                                                        items: ['Rúbricas', 'Listas de cotejo', 'Escalas de valoración', 'Diario de clase', 'Registro anecdótico']
                                                    },
                                                    {
                                                        title: 'Desempeño y Producción',
                                                        items: ['Portafolios', 'Mapas conceptuales', 'Cuadernos de clase', 'Resolución de problemas', 'Proyectos']
                                                    },
                                                    {
                                                        title: 'Interrogación y Feedback',
                                                        items: ['Boletos de salida', 'Cuestionarios rápidos', 'Debate', 'Autoevaluación']
                                                    }
                                                ].map(group => (
                                                    <div key={group.title}>
                                                        <p className="text-[9px] font-black text-gray-300 uppercase mb-2 tracking-tighter">{group.title}</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {group.items.map(inst => (
                                                                <button
                                                                    key={inst}
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        const current = formData.evaluation_plan.instruments
                                                                        if (current.includes(inst)) {
                                                                            setFormData({ ...formData, evaluation_plan: { ...formData.evaluation_plan, instruments: current.filter(i => i !== inst) } })
                                                                        } else {
                                                                            setFormData({ ...formData, evaluation_plan: { ...formData.evaluation_plan, instruments: [...current, inst] } })
                                                                        }
                                                                    }}
                                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border-2 transition-all
                                                                        ${formData.evaluation_plan.instruments.includes(inst)
                                                                            ? 'bg-white border-indigo-500 text-indigo-700 shadow-sm'
                                                                            : 'bg-transparent border-indigo-50 text-indigo-300 hover:border-indigo-200'}`}
                                                                >
                                                                    {inst}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                {formData.evaluation_plan.instruments.length > 0 ? (
                                                    formData.evaluation_plan.instruments.map(inst => (
                                                        <span key={inst} className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border border-indigo-100 shadow-sm">
                                                            {inst}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-xs text-gray-400 font-bold italic">No se seleccionaron instrumentos.</span>
                                                )}
                                            </div>
                                        )}

                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] flex items-center">
                                        <span className="w-8 h-[1px] bg-gray-200 mr-3"></span>
                                        06. Recursos Necesarios
                                    </h2>
                                    {!isPreviewMode && (
                                        <div className="flex space-x-3">
                                            <button
                                                onClick={() => setIsResourceModalOpen(true)}
                                                className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-bold text-[10px] uppercase flex items-center px-3 py-1 rounded-lg border border-emerald-100"
                                            >
                                                <Briefcase className="w-3 h-3 mr-1.5" /> Ver Catálogo
                                            </button>
                                            <button onClick={() => addItem('resources')} className="text-gray-400 hover:text-emerald-600 font-bold text-[10px] uppercase flex items-center">
                                                <Plus className="w-3 h-3 mr-1" /> Añadir Manual
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className={`grid gap-3 ${isPreviewMode ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                    {formData.resources.map((res, i) => (
                                        <div key={i} className={`flex items-center rounded-xl px-3 py-2 ${isPreviewMode ? 'bg-white border-b border-gray-50' : 'bg-gray-50/50 border border-gray-100 shadow-sm'}`}>
                                            <Briefcase className="w-3.5 h-3.5 text-emerald-300 mr-3 shrink-0" />
                                            {!isPreviewMode ? (
                                                <>
                                                    <input
                                                        value={res}
                                                        onChange={e => updateItem('resources', i, e.target.value)}
                                                        className="w-full bg-transparent border-none focus:ring-0 text-[11px] font-bold text-gray-600 p-0"
                                                        placeholder="Nombre del recurso..."
                                                    />
                                                    <button onClick={() => removeItem('resources', i)} className="p-1 text-gray-200 hover:text-red-400 shrink-0">
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </>
                                            ) : (
                                                <span className="text-sm font-bold text-gray-800">{res || 'Recurso genérico'}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>)}

                        {/* Navigation Footer */}
                        {!isPreviewMode && (
                            <div className="flex justify-between items-center bg-gray-50 p-6 rounded-2xl border border-gray-100 mt-8 mb-8">
                                <button
                                    onClick={() => setStep(Math.max(1, step - 1))}
                                    disabled={step === 1}
                                    className={`flex items-center px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-white hover:text-indigo-600 transition-all ${step === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <ChevronLeft className="w-5 h-5 mr-2" />
                                    Anterior
                                </button>
                                <div className="text-xs font-black text-gray-300 uppercase tracking-widest">
                                    Paso {step} de 5
                                </div>
                                <button
                                    onClick={() => {
                                        if (validateStep(step)) {
                                            if (step < 5) setStep(step + 1)
                                            else setIsPreviewMode(true) // Final step goes to preview
                                        }
                                    }}
                                    className="flex items-center bg-indigo-600 text-white px-8 py-3 rounded-xl font-black shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:scale-105 transition-all group"
                                >
                                    {step === 5 ? 'Finalizar y Ver' : 'Siguiente Paso'}
                                    <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        )}

                        {!isPreviewMode && step === 4 && (
                            <div className="pt-8 flex justify-center">
                                <button
                                    onClick={generateAiSuggestions}
                                    disabled={generating}
                                    className="bg-indigo-600 text-white px-10 py-5 rounded-[2rem] text-sm font-black shadow-2xl shadow-indigo-200 border-4 border-white flex items-center hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all uppercase tracking-widest group"
                                >
                                    <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center mr-4 group-hover:rotate-12 transition-transform">
                                        <Sparkles className="w-5 h-5 text-white" />
                                    </div>
                                    {generating ? 'Consultando IA...' : 'Usar Asistente IA'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Footer Validation */}
                    <div className="bg-gray-50 border-t border-gray-100 p-8 flex justify-between items-center text-[10px] font-black uppercase text-gray-400 print:bg-white print:border-t-2">
                        <div className="flex items-center">
                            <ClipboardCheck className="w-4 h-4 mr-2 text-green-500" />
                            Validado para el programa sintético
                        </div>
                        <div className="flex items-center">
                            <span className="mr-4 italic">Firma Digital del Docente</span>
                            <div className="w-32 h-[1px] bg-gray-300 mr-4"></div>
                            {new Date().toLocaleDateString()}
                        </div>
                    </div>
                </div>

                {/* AI Suggestions Modal */}
                {isAiPanelOpen && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
                        <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl border border-indigo-100 p-10 animate-in fade-in zoom-in duration-300 overflow-hidden no-print">
                            <div className="flex justify-between items-center mb-8">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                                        <Sparkles className="w-5 h-5 text-white animate-pulse" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-gray-900 tracking-tight">Asistente IA</h3>
                                        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-1">Sugerencias Pedagógicas</p>
                                    </div>
                                </div>
                                <button onClick={() => { setIsAiPanelOpen(false); setSelectedAiProposalIdx(null); }} className="bg-gray-50 p-2 rounded-xl text-gray-400 hover:text-gray-900 transition-colors">
                                    <Plus className="w-6 h-6 rotate-45" />
                                </button>
                            </div>

                            {selectedAiProposalIdx === null ? (
                                <>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6 leading-relaxed bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                        Selecciona una propuesta para revisarla y editarla antes de aplicarla.
                                    </p>

                                    <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                                        {!Array.isArray(aiSuggestions) || aiSuggestions.length === 0 ? (
                                            <div className="space-y-3">
                                                {[1, 2, 3].map(i => (
                                                    <div key={i} className="h-24 bg-gray-50 rounded-2xl animate-pulse"></div>
                                                ))}
                                            </div>
                                        ) : (
                                            <>
                                                {Array.isArray(aiSuggestions) && aiSuggestions.map((suggestion, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => setSelectedAiProposalIdx(idx)}
                                                        className="w-full text-left p-5 rounded-3xl bg-white border-2 border-gray-50 hover:border-indigo-500 hover:bg-indigo-50/30 transition-all group scale-in-center shadow-sm"
                                                        style={{ animationDelay: `${idx * 150}ms` }}
                                                    >
                                                        <div className="flex items-start">
                                                            <div className="p-2 bg-indigo-50 rounded-lg mr-4 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white transition-colors">
                                                                <Sparkles className="w-4 h-4" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-black text-gray-800 group-hover:text-indigo-600 transition-colors">{suggestion.title}</p>
                                                                <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold">Haz clic para ver fases y editar</p>
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))}
                                                <div className="pt-4">
                                                    <button
                                                        onClick={generateAiSuggestions}
                                                        disabled={generating}
                                                        className="w-full py-4 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 hover:text-indigo-600 hover:border-indigo-200 font-bold text-sm transition-all"
                                                    >
                                                        {generating ? 'Generando nuevas opciones...' : '+ Solicitar otras estrategias'}
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                    <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-3 custom-scrollbar">
                                        <div>
                                            <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">Título de la Propuesta</label>
                                            <input
                                                value={aiSuggestions[selectedAiProposalIdx].title}
                                                onChange={e => {
                                                    const newSugs = [...aiSuggestions]
                                                    newSugs[selectedAiProposalIdx].title = e.target.value
                                                    setAiSuggestions(newSugs)
                                                }}
                                                className="w-full bg-gray-50 border-gray-100 rounded-xl px-4 py-2 font-bold text-gray-800"
                                            />
                                        </div>

                                        <div className="space-y-6 pt-4">
                                            {aiSuggestions[selectedAiProposalIdx].sessions?.map((sessionSug: any, sIdx: number) => (
                                                <div key={sIdx} className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100 space-y-4">
                                                    <div className="flex items-center space-x-2 mb-2">
                                                        <div className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center text-[10px] font-black">
                                                            {sIdx + 1}
                                                        </div>
                                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                            Sesión: {sessionSug.date}
                                                        </span>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-4">
                                                        <div>
                                                            <label className="text-[8px] font-black text-indigo-300 uppercase tracking-widest mb-1 block">Apertura</label>
                                                            <textarea
                                                                value={sessionSug.apertura}
                                                                onChange={e => {
                                                                    const newSugs = [...aiSuggestions]
                                                                    newSugs[selectedAiProposalIdx].sessions[sIdx].apertura = e.target.value
                                                                    setAiSuggestions(newSugs)
                                                                }}
                                                                rows={2}
                                                                className="w-full bg-white border-gray-50 rounded-xl px-3 py-2 text-xs text-gray-700 leading-relaxed"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[8px] font-black text-indigo-300 uppercase tracking-widest mb-1 block">Desarrollo</label>
                                                            <textarea
                                                                value={sessionSug.desarrollo}
                                                                onChange={e => {
                                                                    const newSugs = [...aiSuggestions]
                                                                    newSugs[selectedAiProposalIdx].sessions[sIdx].desarrollo = e.target.value
                                                                    setAiSuggestions(newSugs)
                                                                }}
                                                                rows={3}
                                                                className="w-full bg-white border-gray-50 rounded-xl px-3 py-2 text-xs text-gray-700 leading-relaxed"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[8px] font-black text-indigo-300 uppercase tracking-widest mb-1 block">Cierre</label>
                                                            <textarea
                                                                value={sessionSug.cierre}
                                                                onChange={e => {
                                                                    const newSugs = [...aiSuggestions]
                                                                    newSugs[selectedAiProposalIdx].sessions[sIdx].cierre = e.target.value
                                                                    setAiSuggestions(newSugs)
                                                                }}
                                                                rows={2}
                                                                className="w-full bg-white border-gray-50 rounded-xl px-3 py-2 text-xs text-gray-700 leading-relaxed"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex space-x-4 pt-4 border-t border-gray-100">
                                        <button
                                            onClick={() => setSelectedAiProposalIdx(null)}
                                            className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all"
                                        >
                                            Volver al listado
                                        </button>
                                        <button
                                            onClick={() => applyAiSuggestion(aiSuggestions[selectedAiProposalIdx])}
                                            className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                                        >
                                            Aplicar sugerencia validada
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* PDA Catalog Modal */}
            {isPdaModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-indigo-100 overflow-hidden anime-in fade-in zoom-in duration-300">
                        <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-indigo-50/30">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter flex items-center">
                                    <BookMarked className="w-5 h-5 mr-3 text-indigo-600" />
                                    Catálogo de PDAs: {formData.campo_formativo}
                                </h3>
                                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-1">
                                    Selecciona los procesos que deseas incluir en tu planeación
                                </p>
                            </div>
                            <button onClick={() => setIsPdaModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <Plus className="w-6 h-6 rotate-45" />
                            </button>
                        </div>
                        <div className="p-8 max-h-[60vh] overflow-y-auto space-y-4">
                            {PDA_CATALOG[formData.campo_formativo]?.map((pdaOption) => {
                                const isSelected = formData.pda.includes(pdaOption);
                                return (
                                    <button
                                        key={pdaOption}
                                        onClick={() => {
                                            if (isSelected) {
                                                setFormData({ ...formData, pda: formData.pda.filter(p => p !== pdaOption) });
                                            } else {
                                                // Remove empty placeholder if any
                                                const currentPdAs = formData.pda.filter(p => p.trim() !== '');
                                                setFormData({ ...formData, pda: [...currentPdAs, pdaOption] });
                                            }
                                        }}
                                        className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-start group
                                            ${isSelected
                                                ? 'bg-indigo-50 border-indigo-500 shadow-lg shadow-indigo-100/50'
                                                : 'bg-white border-gray-50 hover:border-indigo-200 hover:bg-gray-50/50'}`}
                                    >
                                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center mr-4 shrink-0 mt-0.5 border
                                            ${isSelected ? 'bg-indigo-500 border-indigo-600 text-white' : 'bg-white border-gray-200 text-transparent'}`}>
                                            <CheckCircle2 className="w-4 h-4" />
                                        </div>
                                        <span className={`text-sm font-medium leading-relaxed ${isSelected ? 'text-indigo-900 font-bold' : 'text-gray-600'}`}>
                                            {pdaOption}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="p-8 bg-gray-50 border-t border-gray-100 flex justify-end">
                            <button
                                onClick={() => setIsPdaModalOpen(false)}
                                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                            >
                                Listo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Resource Catalog Modal */}
            {isResourceModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl border border-emerald-100 overflow-hidden anime-in fade-in zoom-in duration-300">
                        <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-emerald-50/30">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter flex items-center">
                                    <Briefcase className="w-5 h-5 mr-3 text-emerald-600" />
                                    Catálogo de Recursos de Aula
                                </h3>
                                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mt-1">
                                    Explora y selecciona los materiales necesarios para tu proyecto
                                </p>
                            </div>
                            <button onClick={() => setIsResourceModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <Plus className="w-6 h-6 rotate-45" />
                            </button>
                        </div>

                        <div className="p-8 bg-emerald-50/10 border-b border-emerald-50">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar materiales (ej: proyector, hojas, libros...)"
                                    value={resourceSearch}
                                    onChange={(e) => setResourceSearch(e.target.value)}
                                    className="w-full bg-white border-2 border-emerald-50/50 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-emerald-200"
                                />
                            </div>
                        </div>

                        <div className="p-8 max-h-[50vh] overflow-y-auto custom-scrollbar">
                            <div className="space-y-10">
                                {RESOURCE_CATALOG.map((cat) => {
                                    const filteredItems = cat.items.filter(item =>
                                        item.toLowerCase().includes(resourceSearch.toLowerCase())
                                    );
                                    if (filteredItems.length === 0) return null;

                                    return (
                                        <div key={cat.category}>
                                            <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-4 flex items-center">
                                                <span className="w-4 h-px bg-emerald-100 mr-2"></span>
                                                {cat.category}
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                                {filteredItems.map((item) => {
                                                    const isSelected = formData.resources.includes(item);
                                                    return (
                                                        <button
                                                            key={item}
                                                            onClick={() => {
                                                                if (isSelected) {
                                                                    setFormData({ ...formData, resources: formData.resources.filter(r => r !== item) });
                                                                } else {
                                                                    const currentResources = formData.resources.filter(r => r.trim() !== '');
                                                                    setFormData({ ...formData, resources: [...currentResources, item] });
                                                                }
                                                            }}
                                                            className={`text-left p-3 rounded-xl border-2 transition-all flex items-center group
                                                                ${isSelected
                                                                    ? 'bg-emerald-50 border-emerald-500 shadow-sm shadow-emerald-100/50'
                                                                    : 'bg-white border-gray-50 hover:border-emerald-100 hover:bg-emerald-50/10'}`}
                                                        >
                                                            <div className={`w-4 h-4 rounded flex items-center justify-center mr-3 shrink-0 border
                                                                ${isSelected ? 'bg-emerald-500 border-emerald-600 text-white' : 'bg-white border-gray-200 text-transparent'}`}>
                                                                <CheckCircle2 className="w-3 h-3" />
                                                            </div>
                                                            <span className={`text-[11px] font-bold leading-tight ${isSelected ? 'text-emerald-900' : 'text-gray-500'}`}>
                                                                {item}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="p-8 bg-gray-50 border-t border-gray-100 flex justify-end">
                            <button
                                onClick={() => setIsResourceModalOpen(false)}
                                className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all"
                            >
                                Finalizar Selección
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Error Modal */}
            {errorModal.isOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                            <Briefcase className="w-8 h-8 text-amber-600" />
                        </div>
                        <h3 className="text-xl font-black text-gray-900 text-center mb-2">{errorModal.title}</h3>
                        <p className="text-gray-500 text-center text-sm leading-relaxed mb-8">
                            {errorModal.message}
                        </p>
                        <button
                            onClick={() => {
                                if (errorModal.action) errorModal.action()
                                else setErrorModal({ ...errorModal, isOpen: false })
                            }}
                            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all uppercase tracking-widest"
                        >
                            Ir al Programa Analítico
                        </button>
                    </div>
                </div>
            )}
            {/* Program Content Selector Modal */}
            {isProgramModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[110] flex items-center justify-center p-6">
                    <div className="bg-white rounded-[2rem] p-10 max-w-4xl w-full shadow-2xl animate-in fade-in zoom-in duration-300 max-h-[85vh] overflow-hidden flex flex-col">
                        <div className="flex justify-between items-start mb-8">
                            <div className="flex items-center">
                                <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mr-5 shadow-xl shadow-indigo-100">
                                    <BookOpen className="w-7 h-7 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-gray-900 tracking-tight">Vincular Programa Analítico</h3>
                                    <p className="text-indigo-600 text-xs font-bold uppercase tracking-widest mt-1">Selecciona los contenidos contextualizados</p>
                                </div>
                            </div>
                            <button onClick={() => setIsProgramModalOpen(false)} className="bg-gray-50 p-2 rounded-xl text-gray-400 hover:text-gray-900 transition-colors">
                                <Plus className="w-6 h-6 rotate-45" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-4 space-y-4 custom-scrollbar">
                            {programContents.map((content) => (
                                <div
                                    key={content.id}
                                    onClick={() => {
                                        setFormData(prev => ({
                                            ...prev,
                                            campo_formativo: content.campo_formativo || prev.campo_formativo,
                                            ejes_articuladores: [...new Set([...prev.ejes_articuladores, ...(content.ejes_articuladores || [])])],
                                            contents: [...new Set([...prev.contents, content.custom_content])].filter(c => c),
                                            pda: [...new Set([...prev.pda, ...(content.pda_ids || []).map((id: string) => PDA_CATALOG[id as keyof typeof PDA_CATALOG] || id)])].filter(p => p)
                                        }))
                                        setIsProgramModalOpen(false)
                                    }}
                                    className="p-6 rounded-2xl border-2 border-gray-100 hover:border-indigo-500 hover:bg-indigo-50/30 transition-all cursor-pointer group"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                                            {content.campo_formativo || 'Campo no definido'}
                                        </span>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">{content.temporality}</span>
                                    </div>
                                    <h4 className="font-bold text-gray-900 text-sm mb-3 group-hover:text-indigo-700 transition-colors">{content.custom_content}</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {(content.ejes_articuladores || []).map((eje: string) => (
                                            <span key={eje} className="bg-rose-50 text-rose-600 px-2 py-0.5 rounded text-[9px] font-bold uppercase">{eje}</span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
                            <button
                                onClick={() => setIsProgramModalOpen(false)}
                                className="px-8 py-3 rounded-xl font-bold text-gray-400 hover:text-gray-900 transition-all"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Previsualización Imprimible */}
            {isPreviewMode && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4 overflow-y-auto no-print">
                    <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="text-sm font-black text-gray-900 uppercase tracking-tighter flex items-center">
                                    <Printer className="w-4 h-4 mr-2 text-indigo-600" />
                                    Vista Previa de Impresión
                                </h3>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Formato Oficial de Planeación Didáctica</p>
                            </div>
                            <div className="flex space-x-3">
                                <button
                                    onClick={() => profile?.is_demo ? alert('Modo Demo: La impresión está deshabilitada.') : window.print()}
                                    className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all flex items-center ${profile?.is_demo ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'
                                        }`}
                                >
                                    <Printer className="w-4 h-4 mr-2" /> Imprimir
                                </button>
                                <button
                                    onClick={() => setIsPreviewMode(false)}
                                    className="px-6 py-2 bg-white border border-gray-200 text-gray-500 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-all"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-12 bg-gray-100/30">
                            <div className="bg-white shadow-xl mx-auto p-12 border border-gray-200 print:shadow-none print:border-none print:p-0" style={{ width: '210mm', minHeight: '297mm' }}>
                                <div className="mb-8 border-b-2 border-gray-900 pb-4">
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="w-24 h-24 flex items-center justify-center">
                                            {tenant?.logoLeftUrl && <img src={tenant.logoLeftUrl} alt="Logo Izquierdo" className="max-w-full max-h-full object-contain" />}
                                        </div>
                                        <div className="text-center flex-1 px-4">
                                            <h1 className="text-lg font-black uppercase tracking-widest">Planeación Didáctica</h1>
                                            <p className="text-sm font-bold uppercase">Ciclo Escolar 2024-2025</p>
                                        </div>
                                        <div className="w-24 h-24 flex items-center justify-center">
                                            {tenant?.logoRightUrl && <img src={tenant.logoRightUrl} alt="Logo Derecho" className="max-w-full max-h-full object-contain" />}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-0 border-2 border-gray-900 mb-6 text-[11px] uppercase">
                                    <div className="p-2 border-r border-b border-gray-900 font-black bg-gray-50">Fase:</div>
                                    <div className="p-2 border-b border-gray-900 font-bold">Fase 6 (Secundaria)</div>

                                    <div className="p-2 border-r border-b border-gray-900 font-black bg-gray-50">Escuela:</div>
                                    <div className="p-2 border-b border-gray-900 font-bold">{tenant?.name || 'Nombre de la Escuela'}</div>

                                    <div className="p-2 border-r border-b border-gray-900 font-black bg-gray-50">Disciplina:</div>
                                    <div className="p-2 border-b border-gray-900 font-bold">{subjects.find(s => s.id === formData.subject_id)?.name || 'Materia'}</div>

                                    <div className="p-2 border-r border-b border-gray-900 font-black bg-gray-50">CCT:</div>
                                    <div className="p-2 border-b border-gray-900 font-bold">{tenant?.cct?.toUpperCase() || '00DST0000X'}</div>

                                    <div className="p-2 border-r border-b border-gray-900 font-black bg-gray-50">Docente:</div>
                                    <div className="p-2 border-b border-gray-900 font-bold">PROF. {profile?.full_name?.toUpperCase() || 'DOCENTE'}</div>

                                    <div className="p-2 border-r border-b border-gray-900 font-black bg-gray-50">Grado / Grupo:</div>
                                    <div className="p-2 border-b border-gray-900 font-bold">
                                        {groups.find(g => g.id === formData.group_id)?.grade}° {groups.find(g => g.id === formData.group_id)?.section}
                                    </div>

                                    <div className="p-2 border-r border-gray-900 font-black bg-gray-50">Temporalidad:</div>
                                    <div className="p-2 font-bold">{formData.temporality}</div>
                                </div>

                                <div className="border-2 border-gray-900 mb-6 bg-gray-50">
                                    <div className="grid grid-cols-3 gap-0 border-b border-gray-900 text-[10px] font-black italic">
                                        <div className="p-1 border-r border-gray-900 text-center">Campo: {formData.campo_formativo}</div>
                                        <div className="p-1 border-r border-gray-900 text-center">Metodología: {formData.metodologia}</div>
                                        <div className="p-1 text-center">Sesiones: {formData.activities_sequence.length}</div>
                                    </div>
                                    <div className="p-4">
                                        <h4 className="text-[12px] font-black uppercase mb-2 underline decoration-2">{formData.title || 'SIN TÍTULO'}</h4>
                                        <div className="space-y-4 text-xs text-justify">
                                            <div>
                                                <span className="font-black">Problemática:</span> {formData.problem_context || 'No especificada'}
                                            </div>
                                            <div>
                                                <span className="font-black">PDA:</span>
                                                <ul className="list-disc pl-5 mt-1 space-y-1">
                                                    {formData.pda.map((p, i) => <li key={i}>{p}</li>)}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-center font-black uppercase text-sm border-2 border-gray-900 bg-gray-100 p-2 mb-6">
                                    Secuencia Didáctica
                                </div>

                                {formData.activities_sequence.map((session: any, sIdx: number) => (
                                    <div key={sIdx} className="mb-8 break-inside-avoid border border-gray-200">
                                        <div className="flex justify-between items-center bg-gray-900 text-white p-2 text-[10px] font-black uppercase tracking-widest">
                                            <span>Sesión {sIdx + 1}: {new Date(session.date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                                            <span>{session.duration}m</span>
                                        </div>

                                        <div className="grid grid-cols-3 gap-0">
                                            {session.phases.map((phase: any, pIdx: number) => (
                                                <div key={pIdx} className={`p-3 ${pIdx < 2 ? 'border-r border-gray-200' : ''}`}>
                                                    <div className="font-black text-[9px] uppercase border-b border-gray-100 pb-1 flex justify-between mb-2">
                                                        <span>{phase.name}</span>
                                                        <span className="italic">({phase.duration || 0}m)</span>
                                                    </div>
                                                    <div className="text-[10px] leading-relaxed text-justify text-gray-700">
                                                        {phase.activities.map((act: string, aIdx: number) => (
                                                            <div key={aIdx} className="mb-1">
                                                                • {act}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}

                                <div className="mt-16 grid grid-cols-2 gap-20">
                                    <div className="text-center border-t border-gray-900 pt-2">
                                        <p className="text-[9px] font-black uppercase">{profile?.full_name}</p>
                                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">Firma del Docente</p>
                                    </div>
                                    <div className="text-center border-t border-gray-900 pt-2">
                                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">Visto Bueno Dirección</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
