import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { useProfile } from '../../../hooks/useProfile'
import { useOfflineSync } from '../../../hooks/useOfflineSync'
import { GeminiService } from '../../../lib/gemini'
import {
    Save,
    ArrowLeft,
    Clock,
    Plus,
    Target,
    BookOpen,
    Layers,
    ClipboardCheck,
    Sparkles,
    Printer,
    Calendar,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    X
} from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'

// Worker setup
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

import { PDA_CATALOG } from '../constants/planningConstants'
import type { LessonPlanFormData, Session, AiSuggestion } from '../types/planning.types'
import { Step1Context } from '../components/editor/Step1Context'
import { Step2Resources } from '../components/editor/Step2Resources'
import { Step3Methodology } from '../components/editor/Step3Methodology'
import { Step4Sequence } from '../components/editor/Step4Sequence'
import { PdaCatalogModal } from '../components/editor/modals/PdaCatalogModal'
import { ResourceCatalogModal } from '../components/editor/modals/ResourceCatalogModal'
import { AiSuggestionsModal } from '../components/editor/modals/AiSuggestionsModal'
import { PdfViewerModal } from '../components/editor/modals/PdfViewerModal'
import { ProgramContentModal } from '../components/editor/modals/ProgramContentModal'
import { TemplateBankModal } from '../components/editor/modals/TemplateBankModal'
import { ErrorModal } from '../components/editor/modals/ErrorModal'
import { PreviewModal } from '../components/editor/modals/PreviewModal'
import { todayISO } from '../../../lib/dates'

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

const CAMPOS = [
    'Lenguajes',
    'Saberes y Pensamiento Científico',
    'Ética, Naturaleza y Sociedades',
    'De lo Humano y lo Comunitario'
]

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
    const [availableTextbooks, setAvailableTextbooks] = useState<any[]>([])
    const [personalTextbooks, setPersonalTextbooks] = useState<any[]>([])

    // Catalog Modals state
    const [isPdaModalOpen, setIsPdaModalOpen] = useState(false)
    const [isResourceModalOpen, setIsResourceModalOpen] = useState(false)
    const [resourceSearch, setResourceSearch] = useState('')

    // Form State
    const [step, setStep] = useState(1) // Wizard Step State
    const [profileData, setProfileData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [isPreviewMode, setIsPreviewMode] = useState(false)
    const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([])
    const [selectedAiProposalIdx, setSelectedAiProposalIdx] = useState<number | null>(null)
    const [isAiPanelOpen, setIsAiPanelOpen] = useState(false)
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
    const [templates, setTemplates] = useState<any[]>([])
    const [loadingTemplates, setLoadingTemplates] = useState(false)
    const [analyticalProgram, setAnalyticalProgram] = useState<any>(null)
    const [programContents, setProgramContents] = useState<any[]>([])
    const [isProgramModalOpen, setIsProgramModalOpen] = useState(false)
    const [activeSessionTab, setActiveSessionTab] = useState(0)
    const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false)
    const [pdfViewerUrl, setPdfViewerUrl] = useState('')
    const [errorModal, setErrorModal] = useState({ isOpen: false, title: '', message: '', buttonText: 'Ir al Programa Analítico', action: null as any })
    const [hasDecidedStrategy, setHasDecidedStrategy] = useState(false)
    const [generatingThemes, setGeneratingThemes] = useState(false)
    const [isExtractingText, setIsExtractingText] = useState(false)
    const [textbookThemesProposal, setTextbookThemesProposal] = useState<any[]>([])
    const [formData, setFormData] = useState<LessonPlanFormData>({
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
        activities_sequence: [] as Session[],
        resources: [''],
        evaluation_plan: {
            instruments: ['']
        },
        evaluation_instruments: [] as string[],
        evaluation_criteria: '',
        textbook_id: '',
        textbook_pages_from: '',
        textbook_pages_to: '',
        selected_themes: [] as string[],
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

    // Persistence: Save to localStorage (GUARDED BY LOADING)
    useEffect(() => {
        if (loading) return // Don't save while loading
        const draftId = id || 'new'
        const draft = { formData, step, timestamp: new Date().getTime() }
        localStorage.setItem(`lp_draft_${draftId}`, JSON.stringify(draft))
    }, [formData, step, id, loading])

    // Fetch Analytical Program Contents for the selected Subject
    useEffect(() => {
        const fetchProgramContents = async () => {
            if (!analyticalProgram?.id || !formData.subject_id) {
                setProgramContents([])
                return
            }

            // 1. Resolve the correct Subject Catalog ID
            // The formData.subject_id might be a group_subject_id or profile_subject_id
            // But the Analytical Program contents are linked to subject_catalog_id
            let targetSubjectId = formData.subject_id

            // Try to find if this ID corresponds to a group_subject and get its catalog ID
            const { data: groupSubject } = await supabase
                .from('group_subjects')
                .select('subject_catalog_id')
                .eq('id', formData.subject_id)
                .maybeSingle()

            if (groupSubject?.subject_catalog_id) {
                targetSubjectId = groupSubject.subject_catalog_id
            } else {
                // Try profile_subjects
                const { data: profileSubject } = await supabase
                    .from('profile_subjects')
                    .select('subject_catalog_id')
                    .eq('id', formData.subject_id)
                    .maybeSingle()

                if (profileSubject?.subject_catalog_id) {
                    targetSubjectId = profileSubject.subject_catalog_id
                }
            }


            // 2. Fetch All Contents for the Program and Attempt Matching
            const { data, error } = await supabase
                .from('analytical_program_contents')
                .select('*, subject_catalog(name)')
                .eq('program_id', analyticalProgram.id)

            if (data) {
                const selectedSubject = subjects.find(s => s.id === formData.subject_id)

                // Helper for fuzzy matching
                const normalize = (str: string) => str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : ''

                const filtered = data.filter((c: any) => {
                    // 1. Precise ID Match
                    if (c.subject_id === formData.subject_id) return true
                    if (c.subject_id === targetSubjectId) return true

                    // 2. Name Match (Fuzzy)
                    if (selectedSubject?.name && c.subject_catalog?.name) {
                        const s1 = normalize(selectedSubject.name)
                        const s2 = normalize(c.subject_catalog.name)

                        // Exact match after normalization
                        if (s1 === s2) return true
                        // Partials
                        if (s1.includes(s2) || s2.includes(s1)) return true
                    }
                    return false
                })

                setProgramContents(filtered)

                // If new planning, pre-populate first content/pda if available
                if (!id || id === 'new') {
                    if (filtered.length > 0) {
                        setFormData(prev => ({
                            ...prev,
                            campo_formativo: filtered[0].campo_formativo || prev.campo_formativo,
                            ejes_articuladores: filtered[0].ejes_articuladores || prev.ejes_articuladores
                        }))
                    }
                }
            }
        }
        fetchProgramContents()
    }, [analyticalProgram?.id, formData.subject_id, id, subjects])

    // Unified Subject Fetching to prevent race conditions
    const fetchSubjects = async (groupId: string, tenantId: string) => {
        if (!tenantId) return []

        // 1. Fetch Group specific subjects
        let groupSubjectsData: any[] = []
        if (groupId) {
            const { data } = await supabase
                .from('group_subjects')
                .select(`
                    id, 
                    subject_catalog_id, 
                    custom_name,
                    subject_catalog(name)
                `)
                .eq('group_id', groupId)
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
            const subjectId = gs.subject_catalog_id || gs.id
            subjectsMap.set(subjectId, {
                id: subjectId,
                name: gs.subject_catalog?.name || gs.custom_name
            })
        })

        // Add Profile Subjects (they might override or add new ones)
        profileSubjectsData.forEach(ps => {
            const subjectId = ps.subject_catalog_id || ps.id
            if (!subjectsMap.has(subjectId)) {
                subjectsMap.set(subjectId, {
                    id: subjectId,
                    name: ps.subject_catalog?.name || ps.custom_detail || 'Materia Personalizada'
                })
            }
        })

        const formattedSubjects = Array.from(subjectsMap.values())
        setSubjects(formattedSubjects)
        return formattedSubjects
    }

    // Reactive Subject Fetching strictly for interactive changes (manual group change)
    useEffect(() => {
        if (loading || !formData.group_id || !tenant?.id) return
        fetchSubjects(formData.group_id, tenant.id)
    }, [formData.group_id, tenant?.id])

    // Reactive re-matching of Analytical Program when Group changes
    useEffect(() => {
        if (!groups.length || !formData.group_id) return

        const matchingGroup = groups.find(g => g.id === formData.group_id)
        if (matchingGroup) {
            // Attempt to find a program that matches this grade
            const fetchMatchedProgram = async () => {
                const { data: programs } = await supabase
                    .from('analytical_programs')
                    .select('*')
                    .eq('tenant_id', tenant?.id)

                if (programs) {
                    const match = programs.find((p: any) => {
                        const gs = p.school_data?.grades || ''
                        return gs.includes(matchingGroup.grade)
                    })
                    if (match) {
                        setAnalyticalProgram(match)
                        const newContext = match.diagnosis_narrative || ''
                        setFormData(prev => {
                            if (prev.problem_context === newContext || (!prev.problem_context && !newContext)) {
                                return prev
                            }
                            return {
                                ...prev,
                                problem_context: prev.problem_context || newContext
                            }
                        })
                    }
                }
            }
            fetchMatchedProgram()
        }
    }, [formData.group_id, groups, tenant?.id])

    const fetchProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single()
            if (profileData) {
                setProfileData(profileData)
            }
        }
    }

    useEffect(() => {
        fetchProfile()
    }, [])

    useEffect(() => {
        if (!tenant?.id) return

        const fetchData = async () => {
            setLoading(true)

            try {
                // 1. Initial Data Setup
                const isNew = !id || id === 'new'
                let finalFormData = { ...formData }

                // 2. Load basic dependencies (Groups, Periods, Year)
                const [groupsRes, periodsRes, activeYearRes] = await Promise.all([
                    supabase.from('groups').select('id, grade, section').eq('tenant_id', tenant.id),
                    supabase.from('evaluation_periods').select('id, name, is_active, start_date, end_date').eq('tenant_id', tenant.id),
                    supabase.from('academic_years').select('id').eq('tenant_id', tenant.id).eq('is_active', true).maybeSingle()
                ])

                if (groupsRes.data) setGroups(groupsRes.data)
                if (periodsRes.data) setPeriods(periodsRes.data)
                const activeYear = activeYearRes.data

                // PREVENTIVE VALIDATION: Groups are mandatory for Lesson Plans
                if (isNew && (!groupsRes.data || groupsRes.data.length === 0)) {
                    setErrorModal({
                        isOpen: true,
                        title: 'Grupos Requeridos',
                        message: 'Para construir tu planeación didáctica, primero debes tener al menos un grupo creado. Por favor, configura tus grupos primero.',
                        buttonText: 'Ir a Grupos y Alumnos',
                        action: () => navigate('/groups')
                    })
                    setLoading(false)
                    return
                }

                // 3. Load Analytical Program
                // 3. Load Analytical Program (Matching Grade)
                let programQuery = supabase
                    .from('analytical_programs')
                    .select('*')
                    .eq('tenant_id', tenant.id)
                    .order('updated_at', { ascending: false })

                if (activeYear) programQuery = programQuery.eq('academic_year_id', activeYear.id)

                const { data: programs } = await programQuery

                // Filter programs to find one that matches the group's grade
                const selectedGroup = groupsRes.data?.find((g: any) => g.id === finalFormData.group_id)
                let matchedProgram = null

                if (programs && programs.length > 0) {
                    if (selectedGroup) {
                        // Try exact match on grade definition in school_data
                        matchedProgram = programs.find((p: any) => {
                            const grades = p.school_data?.grades || ''
                            return grades.includes(selectedGroup.grade)
                        })
                    }

                    // Fallback to latest if no match or group not selected yet
                    if (!matchedProgram) matchedProgram = programs[0]
                }


                if (!matchedProgram && isNew) {
                    setErrorModal({
                        isOpen: true,
                        title: 'Programa Analítico Requerido',
                        message: selectedGroup
                            ? `No se encontró un Programa Analítico que incluya el grado ${selectedGroup.grade}°. Por favor crea uno primero.`
                            : 'Para cumplir con el Plan de Estudio 2022 (NEM), es obligatorio contar con un Programa Analítico previo. Por favor, crea tu programa primero.',
                        buttonText: 'Ir al Programa Analítico',
                        action: () => navigate('/analytical-program/new')
                    })
                    setLoading(false)
                    return
                }
                if (matchedProgram) setAnalyticalProgram(matchedProgram)

                // 4. Resolve Plan Data (Existing vs New)
                if (id && id !== 'new') {
                    const { data: plan } = await supabase.from('lesson_plans').select('*').eq('id', id).single()
                    if (plan) {
                        const dbData = {
                            ...plan,
                            source_document_url: plan.source_document_url || '',
                            extracted_text: plan.extracted_text || '',
                            objectives: plan.objectives || [''],
                            contents: plan.contents || [''],
                            pda: plan.pda || [''],
                            ejes_articuladores: plan.ejes_articuladores || [],
                            activities_sequence: plan.activities_sequence || [],
                            resources: plan.resources || [''],
                            evaluation_plan: plan.evaluation_plan || { instruments: [''] },
                            evaluation_instruments: plan.evaluation_instruments || [],
                            evaluation_criteria: plan.evaluation_criteria || '',
                            selected_themes: plan.selected_themes || []
                        }
                        const localDraft = localStorage.getItem(`lp_draft_${id}`)
                        if (localDraft) {
                            try {
                                const parsed = JSON.parse(localDraft)
                                finalFormData = {
                                    ...dbData,
                                    ...parsed.formData
                                }
                                setStep(parsed.step || 1)
                            } catch (e) {
                                finalFormData = dbData
                            }
                        } else {
                            finalFormData = dbData
                        }
                    }
                } else {
                    const suggestion = matchedProgram?.pedagogical_strategies?.main_methodology || (matchedProgram?.pedagogical_strategies as any)?.methodology || 'Aprendizaje Basado en Proyectos (ABP)'
                    const match = METODOLOGIAS.find(m => suggestion.includes(m)) || METODOLOGIAS[0]

                    const defaultData = {
                        ...finalFormData,
                        metodologia: match,
                        problem_context: matchedProgram?.diagnosis_context || ''
                    }

                    const localDraft = localStorage.getItem('lp_draft_new')
                    if (localDraft) {
                        try {
                            const parsed = JSON.parse(localDraft)
                            finalFormData = {
                                ...parsed.formData,
                                problem_context: parsed.formData.problem_context || defaultData.problem_context,
                                metodologia: parsed.formData.metodologia || defaultData.metodologia,
                                selected_themes: parsed.formData.selected_themes || []
                            }
                            setStep(parsed.step || 1)
                        } catch (e) {
                            finalFormData = defaultData
                        }
                    } else {
                        finalFormData = defaultData
                    }

                    // URL PRE-POPULATION
                    const urlGroupId = searchParams.get('groupId')
                    const urlSubjectId = searchParams.get('subjectId')
                    const urlPeriodId = searchParams.get('periodId')
                    if (urlGroupId) finalFormData.group_id = urlGroupId
                    if (urlSubjectId) finalFormData.subject_id = urlSubjectId
                    if (urlPeriodId) finalFormData.period_id = urlPeriodId
                }

                // 5. AUTO-FETCH SUBJECTS (CRITICAL STEP to prevent race conditions)
                if (finalFormData.group_id) {
                    const fetchedSubjects = await fetchSubjects(finalFormData.group_id, tenant.id)
                    if (isNew && fetchedSubjects.length === 0) {
                        setErrorModal({
                            isOpen: true,
                            title: 'Materias Requeridas',
                            message: 'No se encontraron materias asignadas a este grupo. Para crear una planeación, primero debes definir las materias en la configuración del grupo.',
                            buttonText: 'Ir a Grupos',
                            action: () => navigate('/groups')
                        })
                        setLoading(false)
                        return
                    }
                }

                // 6. AUTO-MATCH PROGRAM (If Group Selected)
                if (finalFormData.group_id && groupsRes.data) {
                    const selGroup = groupsRes.data.find((g: any) => g.id === finalFormData.group_id)
                    if (selGroup && programs) {
                        const match = programs.find((p: any) => {
                            const gs = p.school_data?.grades || ''
                            return gs.includes(selGroup.grade)
                        })
                        if (match) {
                            setAnalyticalProgram(match)
                            finalFormData.problem_context = match.diagnosis_context || ''
                        }
                    }
                }
                // 7. Schedule Validation
                if (isNew && finalFormData.group_id) {
                    const { data: schedule } = await supabase
                        .from('schedules') // la tabla de horarios se llama 'schedules' (group_schedules no existe)
                        .select('id')
                        .eq('group_id', finalFormData.group_id)
                        .limit(1)

                    if (!schedule || schedule.length === 0) {
                        setErrorModal({
                            isOpen: true,
                            title: 'Horario Requerido',
                            message: 'Para generar una secuencia de sesiones realista, es obligatorio contar con un horario configurado para este grupo.',
                            buttonText: 'Configurar Horario',
                            action: () => navigate(`/groups/${finalFormData.group_id}`)
                        })
                        setLoading(false)
                        return
                    }
                }

                // 7. Final Period Adjustment
                if (!finalFormData.period_id) {
                    const today = todayISO()
                    const currentPeriod = periodsRes.data?.find((p: any) => today >= p.start_date && today <= p.end_date)
                    if (currentPeriod) {
                        finalFormData.period_id = currentPeriod.id
                    } else if (periodsRes.data && periodsRes.data.length > 0) {
                        finalFormData.period_id = periodsRes.data[0].id
                    }
                }

                // 7. Detect if strategy is already decided (non-default activities)
                const hasRealActivities = finalFormData.activities_sequence?.some((s: any) =>
                    s.phases?.some((p: any) =>
                        p.activities?.some((a: string) =>
                            a && !a.includes('Recuperación de saberes') &&
                            !a.includes('Realización de actividad práctica') &&
                            !a.includes('Reflexión grupal')
                        )
                    )
                )
                if (hasRealActivities) setHasDecidedStrategy(true)

                setFormData(finalFormData)
            } catch (error) {
                console.error('Error initializing planning data:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [id, tenant?.id, searchParams])

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

    // Fetch Personal Textbooks
    useEffect(() => {
        const fetchPersonalTextbooks = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data, error } = await supabase
                .from('user_textbooks')
                .select('*')
                .eq('profile_id', user.id)
                .order('created_at', { ascending: false })

            if (data && !error) {
                setPersonalTextbooks(data)
            }
        }
        fetchPersonalTextbooks()
    }, [])

    // Fetch Relevant Textbooks
    useEffect(() => {
        const fetchTextbooks = async () => {
            if (!tenant?.educationalLevel || !formData.group_id) {
                setAvailableTextbooks([])
                return
            }

            const selectedGroup = groups.find(g => g.id === formData.group_id)
            if (!selectedGroup) return

            // Map tenant level to textbook level
            const levelMap: any = {
                'PRIMARY': 'PRIMARIA',
                'SECONDARY': 'SECUNDARIA',
                'TELESECUNDARIA': 'TELESECUNDARIA'
            }
            const mappedLevel = levelMap[tenant.educationalLevel] || 'PRIMARIA'

            // Catálogo oficial vigente (CONALITEG): libros del grado y multigrado.
            const grade = Number(selectedGroup.grade)
            const { data, error } = await supabase
                .from('textbooks')
                .select('id, title, level, grade, grades, field_of_study, file_url, reader_url, text_status, source')
                .eq('level', mappedLevel)
                .eq('is_current', true)
                .or(`grade.eq.${grade},grades.cs.{${grade}}`)
                .order('title')

            if (!error && data) {
                setAvailableTextbooks(data)

                // Auto-select if ONLY ONE book exists and none is selected
                if (data.length === 1 && !formData.textbook_id) {
                    const onlyBook = data[0]
                    setFormData(prev => ({ ...prev, textbook_id: onlyBook.id }))
                    triggerThemeGeneration(onlyBook.title)
                }
            }
        }
        fetchTextbooks()
    }, [formData.group_id, tenant?.educationalLevel, groups])

    // Analytical Program Sync Effect: Auto-populate context, contents, and PDAs
    useEffect(() => {
        const fetchAnalyticalData = async () => {
            console.log('[DEBUG] fetchAnalyticalData triggered', {
                hasProgram: !!analyticalProgram,
                campoFormativo: formData.campo_formativo,
                groupId: formData.group_id
            })

            if (!analyticalProgram || !formData.campo_formativo || !formData.group_id) return

            console.log('[DEBUG] fetchAnalyticalData passed early return checks')

            const selectedGroup = groups.find(g => g.id === formData.group_id)
            const grade = selectedGroup?.grade || 1

            console.log('[DEBUG] fetchAnalyticalData group info', {
                grade,
                subjectId: formData.subject_id
            })

            const pdaNames: string[] = []
            const contentNames: string[] = []
            let programJustification = ''

            // 1. Fetch from 'analytical_program_contents' table for Secondary (where subject_id exists)
            if (formData.subject_id) {
                const { data: contents } = await supabase
                    .from('analytical_program_contents')
                    .select(`
                        justification, 
                        content_id,
                        pda_ids
                    `)
                    .eq('program_id', analyticalProgram.id)
                    .eq('subject_id', formData.subject_id)
                    .eq('campo_formativo', formData.campo_formativo)

                if (contents && contents.length > 0) {
                    for (const cont of contents) {
                        if (cont.justification) programJustification += cont.justification + '\n'

                        // Fetch Content Text
                        if (cont.content_id) {
                            const { data: cData } = await supabase
                                .from('synthetic_program_contents')
                                .select('content')
                                .eq('id', cont.content_id)
                                .single()
                            if (cData?.content && !contentNames.includes(cData.content)) contentNames.push(cData.content)
                        }

                        // Fetch PDA Text
                        if (cont.pda_ids && cont.pda_ids.length > 0) {
                            const { data: pItems } = await supabase
                                .from('synthetic_program_contents')
                                .select('pda')
                                .in('id', cont.pda_ids)
                            if (pItems) {
                                pItems.forEach(i => {
                                    if (i.pda && !pdaNames.includes(i.pda)) pdaNames.push(i.pda)
                                })
                            }
                        }
                    }
                }
            }

            // 2. Fetch from JSONB program_by_fields (Used by both Secondary and Primary to store contextualized PDAs)
            const hasDataInTable = contentNames.length > 0
            if (analyticalProgram.program_by_fields) {
                // Mapping from full campo formativo to the short keys used in DEFAULT_FIELDS
                const fieldMapping: Record<string, string> = {
                    'Lenguajes': 'lenguajes',
                    'Saberes y Pensamiento Científico': 'saberes',
                    'Ética, Naturaleza y Sociedades': 'etica',
                    'De lo Humano y lo Comunitario': 'humano'
                }

                const fieldKeyFull = formData.campo_formativo
                const fieldKeyShort = fieldMapping[fieldKeyFull] || fieldKeyFull.toLowerCase().split(' ')[0]

                let fieldItems = (analyticalProgram.program_by_fields as any)[fieldKeyShort]
                if (!fieldItems || fieldItems.length === 0) {
                    fieldItems = (analyticalProgram.program_by_fields as any)[fieldKeyFull]
                }
                if (!fieldItems) {
                    fieldItems = []
                }

                console.log(`[DEBUG] Found field items for keys (short: ${fieldKeyShort}, full: ${fieldKeyFull}):`, fieldItems)

                fieldItems.forEach((item: any) => {
                    const extractedContentName = item.contentName || item.content
                    if (extractedContentName && !contentNames.includes(extractedContentName)) {
                        contentNames.push(extractedContentName)
                    }

                    const pdaText = item[`pda_grade_${grade}`] || item.pda_grade_1 || item.pda_grade_2 || item.pda_grade_3 || item.pda
                    if (pdaText && typeof pdaText === 'string' && !pdaNames.includes(pdaText)) {
                        pdaNames.push(pdaText)
                    }
                })

                console.log('[DEBUG] Merged with JSON data', { contentNames, pdaNames })
            }

            console.log('[DEBUG] Final extracted data before setState', {
                contentNames,
                pdaNames,
                programJustification
            })

            // Update formData
            setFormData(prev => {
                const updates: any = {}
                let hasChanges = false

                // Problem Context: Update if empty or very short
                const currentCtx = (prev.problem_context || '').trim()
                if (!currentCtx || currentCtx.length < 10) {
                    let newContext = ''
                    const diagnosisResult = analyticalProgram.diagnosis_context || (analyticalProgram.group_diagnosis as any)?.narrative_final || (analyticalProgram.group_diagnosis as any)?.narrative
                    const problemsArray = (analyticalProgram.group_diagnosis as any)?.problem_situations
                    let problemsText = ''

                    if (problemsArray && Array.isArray(problemsArray) && problemsArray.length > 0) {
                        problemsText = problemsArray.map(p => p.description || p).join('; ')
                    }

                    if (diagnosisResult) newContext += `DIAGNÓSTICO:\n${diagnosisResult}\n\n`
                    if (problemsText) newContext += `PROBLEMÁTICAS DETECTADAS:\n${problemsText}\n\n`
                    if (programJustification) newContext += `JUSTIFICACIÓN DEL CAMPO:\n${programJustification.trim()}`

                    if (newContext.trim() && currentCtx !== newContext.trim()) {
                        updates.problem_context = newContext.trim()
                        hasChanges = true
                    }
                }

                // PDAs and Contents
                if (pdaNames.length > 0) {
                    // Solo actualizar si son diferentes para evitar loop de referencias
                    if (JSON.stringify(prev.pda) !== JSON.stringify(pdaNames)) {
                        updates.pda = pdaNames
                        hasChanges = true
                    }
                }

                if (contentNames.length > 0) {
                    if (JSON.stringify(prev.contents) !== JSON.stringify(contentNames)) {
                        updates.contents = contentNames
                        hasChanges = true
                    }
                }

                if (!hasChanges) {
                    return prev
                }

                return { ...prev, ...updates }
            })
        }

        fetchAnalyticalData()
    }, [formData.subject_id, formData.campo_formativo, formData.group_id, analyticalProgram, groups])

    // Theme Sync Effect: Auto-trigger theme generation when book is selected or auto-selected
    useEffect(() => {
        const fetchInitialThemes = async () => {
            if (formData.textbook_id && availableTextbooks.length > 0 && textbookThemesProposal.length === 0 && !generatingThemes) {
                const book = availableTextbooks.find(b => b.id === formData.textbook_id)
                if (book && book.source === 'CONALITEG') {
                    // Libros oficiales: el texto solo existe si CONALITEG publica el PDF sin cifrar.
                    setGeneratingThemes(true)
                    let indexText: string | undefined
                    if (book.text_status === 'done') {
                        const { data } = await supabase.rpc('get_textbook_text', { p_textbook: book.id, p_from: 1, p_to: 25 })
                        indexText = (data as string | null) || undefined
                    }
                    await triggerThemeGeneration(book.title, indexText)
                } else if (book && book.file_url) {
                    setGeneratingThemes(true) // Lock early
                    try {
                        const loadingTask = pdfjsLib.getDocument(book.file_url)
                        const pdf = await loadingTask.promise
                        const endPage = Math.min(25, pdf.numPages) // First 25 pages covers index and intro
                        let initialText = ''
                        for (let i = 1; i <= endPage; i++) {
                            const page = await pdf.getPage(i)
                            const content = await page.getTextContent()
                            const strings = content.items.map((item: any) => item.str)
                            initialText += strings.join(' ') + '\n'
                        }
                        await triggerThemeGeneration(book.title, initialText || undefined)
                    } catch (err) {
                        console.error('Error auto-reading PDF index', err)
                        triggerThemeGeneration(book.title) // Fallback to title only if failed
                    }
                } else if (book) {
                    triggerThemeGeneration(book.title)
                }
            }
        }
        fetchInitialThemes()
    }, [formData.textbook_id, availableTextbooks, textbookThemesProposal.length, generatingThemes])

    const extractSpecificPages = async (fileUrl: string, from: number, to: number) => {
        if (!fileUrl || !from || !to || from > to) return

        setIsExtractingText(true)
        try {
            // Libro oficial del catálogo: usar el texto indexado (si existe) en vez del PDF.
            const officialBook = !formData.source_document_url
                ? availableTextbooks.find(b => b.id === formData.textbook_id && b.source === 'CONALITEG')
                : undefined
            if (officialBook) {
                if (officialBook.text_status !== 'done') {
                    alert('Este libro está protegido por CONALITEG: ábrelo con "Ver libro", copia el texto de esas páginas y pégalo en el recuadro de abajo.')
                    return
                }
                const { data, error } = await supabase.rpc('get_textbook_text', { p_textbook: officialBook.id, p_from: from, p_to: to })
                if (error) throw error
                const text = (data as string | null) ?? ''
                setFormData(prev => ({ ...prev, extracted_text: text }))
                if (text.length > 100) triggerThemeGeneration(undefined, text)
                return
            }

            const loadingTask = pdfjsLib.getDocument(fileUrl)
            const pdf = await loadingTask.promise

            let fullText = ''
            // Ensure we don't exceed total pages
            const endPage = Math.min(to, pdf.numPages)
            const startPage = Math.max(1, from)

            for (let i = startPage; i <= endPage; i++) {
                const page = await pdf.getPage(i)
                const content = await page.getTextContent()
                const strings = content.items.map((item: any) => item.str)
                fullText += strings.join(' ') + '\n'
            }


            setFormData(prev => ({ ...prev, extracted_text: fullText }))

            // Optionally trigger AI generation if we have enough context
            if (fullText.length > 100) {
                triggerThemeGeneration(undefined, fullText)
            }
        } catch (error) {
            console.error('[PDFExtract] Error al extraer páginas:', error)
            alert('No se pudo extraer el texto de las páginas seleccionadas.')
        } finally {
            setIsExtractingText(false)
        }
    }

    const triggerThemeGeneration = async (bookTitle?: string, extractedText?: string) => {
        setGeneratingThemes(true)
        try {
            let themes: any[] = []
            const apiKey = tenant?.aiConfig?.apiKey

            // 1. Try AI Generation
            if ((bookTitle || extractedText) && apiKey) {
                try {
                    const aiService = new GeminiService(
                        tenant?.aiConfig?.geminiKey || apiKey,
                        tenant?.aiConfig?.groqKey || (apiKey.startsWith('gsk_') ? apiKey : ''),
                        tenant?.aiConfig?.openaiKey
                    )

                    themes = await aiService.extractThemesFromText({
                        textbookTitle: bookTitle,
                        text: extractedText,
                        field: formData.campo_formativo
                    })
                } catch (aiError) {
                    console.error('AI extraction failed, using fallback:', aiError)
                    // Let it fall through to the fallback logic
                }
            }

            // 2. FALLBACK: If AI returned nothing (missing key or error), use local catalog
            if (!themes || themes.length === 0) {
                const catalogItems = PDA_CATALOG[formData.campo_formativo] || []
                // Extract some keywords from catalog descriptions to create "Themes"
                themes = catalogItems.slice(0, 6).map(desc => {
                    // Get first few words or a cleaned version
                    const theme = desc.length > 40 ? desc.substring(0, 37) + '...' : desc
                    return { theme, pages: 'Catálogo' }
                })

                // If it's still empty, provide generic NEM themes
                if (themes.length === 0) {
                    themes = [
                        { theme: 'Pensamiento Crítico', pages: 'Base' },
                        { theme: 'Inclusión y Equidad', pages: 'Base' },
                        { theme: 'Interculturalidad', pages: 'Base' },
                        { theme: 'Vida Saludable', pages: 'Base' }
                    ]
                }
            }

            // Map strings to objects if necessary (extractThemesFromText returns string[] usually)
            const normalizedThemes = themes.map(t => typeof t === 'string' ? { theme: t, pages: 'IA' } : t)
            setTextbookThemesProposal(normalizedThemes)
        } catch (error) {
            console.error('Error in triggerThemeGeneration:', error)
            // Ensure we never leave it empty to prevent infinite loop
            setTextbookThemesProposal([
                { theme: 'Error al cargar', pages: 'N/A' },
                { theme: 'Pensamiento Crítico', pages: 'Base' }
            ])
        } finally {
            setGeneratingThemes(false)
        }
    }

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



            const { data: scheduleSettings } = await supabase
                .from('schedule_settings')
                .select('module_duration')
                .eq('tenant_id', tenant.id)
                .maybeSingle()

            const moduleDuration = scheduleSettings?.module_duration || 50

            if (!schedule || schedule.length === 0) {
                console.warn('[ScheduleDebug] No hay registros en schedules para este grupo/tenant.')
                alert('No se encontró un horario cargado para este grupo.')
                return
            }

            const daysOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
            const sessions: any[] = []

            let weeksToGenerate = 1
            if (formData.temporality === 'MONTHLY') weeksToGenerate = 4
            if (formData.temporality === 'TRIMESTER' as any) weeksToGenerate = 12
            if (formData.temporality === 'PROJECT') weeksToGenerate = 2

            const referenceDate = new Date()
            const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()

            const filteredSchedule = schedule
                .filter(s => {
                    const isCatalogMatch = s.subject_id === formData.subject_id

                    const sName = s.custom_subject || ''
                    const targetName = selectedSubjectName || ''
                    const isNameMatch = sName && targetName && normalize(sName) === normalize(targetName)



                    return isCatalogMatch || isNameMatch
                })
                .sort((a, b) => {
                    const dayDiff = daysOrder.indexOf(a.day_of_week) - daysOrder.indexOf(b.day_of_week)
                    if (dayDiff !== 0) return dayDiff
                    return a.start_time.localeCompare(b.start_time)
                })



            if (filteredSchedule.length === 0) {
                alert(`No se encontraron clases para "${selectedSubjectName}" en el horario. Verifica que la asignatura coincida exactamente.`)
                return
            }

            const blocks: any[] = []
            let currentBlock: any = null

            filteredSchedule.forEach(item => {
                if (!currentBlock || currentBlock.day_of_week !== item.day_of_week || item.start_time !== currentBlock.end_time) {
                    if (currentBlock) blocks.push(currentBlock)
                    currentBlock = { ...item, duration: moduleDuration }
                } else {
                    currentBlock.end_time = item.end_time
                    currentBlock.duration += moduleDuration
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

            setFormData(prev => ({
                ...prev,
                activities_sequence: sessions,
                start_date: sessions.length > 0 ? sessions[0].date : '',
                end_date: sessions.length > 0 ? sessions[sessions.length - 1].date : ''
            }))
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

    const sanitizePlanData = (data: any) => {
        const { selected_themes, ...sanitized } = data
        if (!sanitized.textbook_id || sanitized.textbook_id === '') sanitized.textbook_id = null
        if (sanitized.textbook_pages_from === '') sanitized.textbook_pages_from = null
        if (sanitized.textbook_pages_to === '') sanitized.textbook_pages_to = null
        if (!sanitized.subject_id || sanitized.subject_id === '') sanitized.subject_id = null
        if (!sanitized.period_id || sanitized.period_id === '') sanitized.period_id = null

        // Also ensure we don't send anything else not in schema if found
        delete (sanitized as any).availableTextbooks
        delete (sanitized as any).textbookThemesProposal

        return sanitized
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
        setHasDecidedStrategy(true)

        try {
            const aiService = new GeminiService(
                tenant?.aiConfig?.geminiKey || apiKey,
                tenant?.aiConfig?.groqKey || (apiKey.startsWith('gsk_') ? apiKey : ''),
                tenant?.aiConfig?.openaiKey
            )

            const suggestions = await aiService.generateLessonPlanSuggestions({
                topic: formData.title || 'Tema General',
                subject: subjects.find(s => s.id === formData.subject_id)?.name,
                grade: groups.find(g => g.id === formData.group_id)?.grade,
                level: tenant?.educationalLevel, // Enviar Nivel Educativo para mejor contexto
                field: formData.campo_formativo,
                methodology: formData.metodologia,
                problemContext: formData.problem_context,
                pdaDetail: formData.pda.join('. '),
                sessions: formData.activities_sequence.map(s => ({ date: s.date, duration: s.duration })),
                temporality: formData.temporality,
                purpose: formData.purpose,
                textbook: availableTextbooks.find(b => b.id === formData.textbook_id)?.title,
                pagesFrom: formData.textbook_pages_from,
                pagesTo: formData.textbook_pages_to,
                extractedText: formData.extracted_text
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

        setFormData(prev => ({
            ...prev,
            activities_sequence: newSequence
        }))
        setIsAiPanelOpen(false)
        setSelectedAiProposalIdx(null)
        setHasDecidedStrategy(true)

        // El autoguardado a BD fue removido para prevenir registros duplicados de planeaciones "nuevas".
        // El hook useEffect(..., [formData]) se encarga de persistir el progreso en localStorage.
        // El docente debe hacer clic en "Guardar" para instanciar la planeación en la base de datos.
    }

    const handleSave = async () => {
        if (profile?.is_demo) {
            alert('Modo Demo: El guardado de planeaciones está deshabilitado.')
            return
        }
        if (!tenant) return
        setSaving(true)
        try {
            const rawPlanData = {
                ...formData,
                tenant_id: tenant.id,
                updated_at: new Date().toISOString()
            }
            const planData = sanitizePlanData(rawPlanData)

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
                const { error: updateError } = await supabase.from('lesson_plans').update(planData).eq('id', id)
                if (updateError) throw updateError
                localStorage.removeItem(`lp_draft_${id}`)
            } else {
                const { data, error: insertError } = await supabase.from('lesson_plans').insert([planData]).select().single()
                if (insertError) throw insertError
                if (data?.id) {
                    localStorage.removeItem('lp_draft_new')
                    localStorage.removeItem(`lp_draft_${data.id}`)
                }
            }
            alert('Planeación guardada con éxito')
            navigate('/planning')
        } catch (error: any) {
            console.error('Error al guardar planeación:', error)
            alert('Error al guardar: ' + (error.message || 'Error desconocido'))
        } finally {
            setSaving(false)
        }
    }

    const addItem = (field: 'objectives' | 'contents' | 'pda' | 'resources') => {
        setFormData(prev => ({ ...prev, [field]: [...prev[field], ''] }))
    }

    const toggleThemeSelection = (theme: string) => {
        setFormData(prev => ({
            ...prev,
            selected_themes: (prev.selected_themes || []).includes(theme)
                ? (prev.selected_themes || []).filter(t => t !== theme)
                : [...(prev.selected_themes || []), theme]
        }))
    }

    const removeItem = (field: 'objectives' | 'contents' | 'pda' | 'resources', index: number) => {
        setFormData(prev => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }))
    }

    const updateItem = (field: 'objectives' | 'contents' | 'pda' | 'resources', index: number, value: string) => {
        setFormData(prev => {
            const newList = [...prev[field]]
            newList[index] = value
            return { ...prev, [field]: newList }
        })
    }

    const toggleEje = (eje: string) => {
        setFormData(prev => {
            const current = prev.ejes_articuladores
            if (current.includes(eje)) {
                return { ...prev, ejes_articuladores: current.filter(e => e !== eje) }
            } else {
                return { ...prev, ejes_articuladores: [...current, eje] }
            }
        })
    }

    const fetchTemplates = async () => {
        if (!formData.group_id) {
            alert('Selecciona un grupo primero para cargar plantillas compatibles.')
            return
        }
        setLoadingTemplates(true)
        setIsTemplateModalOpen(true)
        try {
            const selectedGroup = groups.find(g => g.id === formData.group_id)
            const level = tenant?.educationalLevel || 'PRIMARY'
            const grade = selectedGroup?.grade || 1

            let query = supabase
                .from('lesson_plan_templates')
                .select('*')
                .eq('educational_level', level)
                .eq('grade', grade)

            if (formData.subject_id) {
                const subject = subjects.find(s => s.id === formData.subject_id)
                if (subject) {
                    query = query.ilike('subject_name', `%${subject.name}%`)
                }
            }

            const { data, error } = await query
            if (error) throw error
            setTemplates(data || [])
        } catch (error) {
            console.error('Error fetching templates:', error)
        } finally {
            setLoadingTemplates(false)
        }
    }

    const applyTemplate = async (template: any) => {
        if (confirm(`¿Deseas cargar la plantilla "${template.title}"? Esto reemplazará el progreso actual.`)) {
            setFormData(prev => ({
                ...prev,
                title: template.title,
                campo_formativo: template.campo_formativo || prev.campo_formativo,
                metodologia: template.metodologia || prev.metodologia,
                purpose: template.purpose || prev.purpose,
                pda: template.pda && template.pda.length > 0 ? template.pda : prev.pda,
                activities_sequence: template.activities_sequence || prev.activities_sequence
            }))
            setIsTemplateModalOpen(false)
            setHasDecidedStrategy(true)
        }
    }

    const validateStep = (currentStep: number) => {
        if (isPreviewMode) return true

        switch (currentStep) {
            case 1:
                if (!formData.title) return alert('Debes ingresar un título para el proyecto.')
                if (!formData.group_id) return alert('Selecciona un grupo.')
                if (!formData.subject_id) return alert('Selecciona una asignatura.')
                if (!formData.campo_formativo) return alert('Selecciona un Campo Formativo.')
                if (!formData.temporality) return alert('Define la temporalidad.')
                return true
            case 2:
                // Libros son opcionales o se validan visualmente
                return true
            case 3:
                if (!formData.metodologia) return alert('Selecciona una Metodología.')
                if (!formData.problem_context) return alert('Describe la problemática o contexto (Propósito).')
                if (formData.ejes_articuladores.length === 0) return alert('Selecciona al menos un Eje Articulador.')
                return true
            case 4:
                if (formData.activities_sequence.length === 0) return alert('Debes cargar las sesiones del horario antes de continuar.')
                if (!formData.start_date || !formData.end_date) return alert('Define las fechas de inicio y fin del periodo.')
                return true
            default:
                return true
        }
    }

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const currentGroup = groups.find(g => g.id === formData.group_id);
        const currentSubject = subjects.find(s => s.id === formData.subject_id);

        const activitiesHtml = formData.activities_sequence.map((session: any, sIdx: number) => `
            <div style="margin-bottom: 30pt; page-break-inside: avoid; border: 1pt solid #eee;">
                <div style="background: #000; color: #fff; padding: 8pt; font-size: 10pt; font-weight: 900; display: flex; justify-content: space-between; text-transform: uppercase;">
                    <span>Sesión ${sIdx + 1}: ${new Date(session.date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                    <span>${session.duration}m</span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); background: #fff;">
                    ${session.phases.map((phase: any, pIdx: number) => `
                        <div style="padding: 10pt; ${pIdx < 2 ? 'border-right: 1pt solid #eee;' : ''}">
                            <div style="font-weight: 900; font-size: 8pt; text-transform: uppercase; border-bottom: 1pt solid #eee; padding-bottom: 4pt; margin-bottom: 8pt; display: flex; justify-content: space-between;">
                                <span>${phase.name}</span>
                                <span style="font-style: italic; opacity: 0.7;">(${phase.duration || 0}m)</span>
                            </div>
                            <div style="font-size: 9pt; line-height: 1.5; text-align: justify; color: #333;">
                                ${phase.activities.map((act: string) => `<div style="margin-bottom: 4pt;">• ${act}</div>`).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');

        printWindow.document.write(`
            <html>
                <head>
                    <title>Planeación Didáctica - ${formData.title}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
                        body { 
                            font-family: 'Inter', -apple-system, sans-serif; 
                            padding: 2cm; 
                            color: black; 
                            background: white;
                            line-height: 1.4;
                        }
                        .header-table { width: 100%; margin-bottom: 20pt; border-bottom: 2pt solid black; padding-bottom: 10pt; }
                        .info-grid { 
                            display: grid; 
                            grid-template-columns: repeat(2, 1fr); 
                            border: 1.5pt solid black; 
                            margin-bottom: 20pt;
                            font-size: 9pt;
                            text-transform: uppercase;
                        }
                        .info-item { padding: 6pt; border: 0.5pt solid black; }
                        .label { font-weight: 900; background: #f9f9f9; width: 120pt; display: inline-block; }
                        .section-title { 
                            background: #eee; 
                            padding: 8pt; 
                            font-weight: 900; 
                            text-align: center; 
                            border: 1.5pt solid black; 
                            margin-bottom: 20pt;
                            text-transform: uppercase;
                        }
                        @media print {
                            body { padding: 1cm; }
                            @page { margin: 1cm; }
                        }
                    </style>
                </head>
                <body>
                    <table class="header-table">
                        <tr>
                            <td width="20%"><img src="${tenant?.logoLeftUrl || ''}" style="max-width: 80pt; max-height: 80pt; object-contain: fit;"></td>
                            <td align="center">
                                <h1 style="font-size: 16pt; font-weight: 900; margin: 0; text-transform: uppercase;">Planeación Didáctica</h1>
                                <p style="font-size: 10pt; font-weight: bold; margin: 5pt 0;">Ciclo Escolar 2024-2025</p>
                            </td>
                            <td width="20%" align="right"><img src="${tenant?.logoRightUrl || ''}" style="max-width: 80pt; max-height: 80pt; object-contain: fit;"></td>
                        </tr>
                    </table>

                    <div class="info-grid">
                        <div class="info-item"><span class="label">Fase:</span> Fase 6 (Secundaria)</div>
                        <div class="info-item"><span class="label">Escuela:</span> ${tenant?.name || ''}</div>
                        <div class="info-item"><span class="label">Disciplina:</span> ${currentSubject?.name || ''}</div>
                        <div class="info-item"><span class="label">CCT:</span> ${tenant?.cct || ''}</div>
                        <div class="info-item"><span class="label">Docente:</span> PROF. ${profile?.full_name?.toUpperCase() || ''}</div>
                        <div class="info-item"><span class="label">Grado / Grupo:</span> ${currentGroup?.grade || ''}° ${currentGroup?.section || ''}</div>
                        <div class="info-item"><span class="label" style="width: 100%;">Temporalidad: ${formData.temporality}</span></div>
                    </div>

                    <div style="border: 1.5pt solid black; margin-bottom: 20pt; background: #fafafa; padding: 15pt;">
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); font-size: 8pt; font-weight: 900; font-style: italic; margin-bottom: 10pt; border-bottom: 1pt solid #ddd; padding-bottom: 5pt;">
                            <div>CAMP: ${formData.campo_formativo}</div>
                            <div align="center">METODOLOGÍA: ${formData.metodologia}</div>
                            <div align="right">SESIONES: ${formData.activities_sequence.length}</div>
                        </div>
                        <h2 style="font-size: 12pt; font-weight: 900; text-decoration: underline; margin-bottom: 10pt; text-transform: uppercase;">${formData.title || 'SIN TÍTULO'}</h2>
                        <div style="font-size: 10pt; text-align: justify;">
                            <p><strong>Problemática:</strong> ${formData.problem_context || ''}</p>
                            <p><strong>PDA:</strong></p>
                            <ul style="padding-left: 20pt;">
                                ${formData.pda.map(p => `<li>${p}</li>`).join('')}
                            </ul>
                        </div>
                    </div>

                    <div class="section-title">Secuencia Didáctica</div>

                    ${activitiesHtml}

                    <div style="margin-top: 50pt; display: grid; grid-template-columns: repeat(2, 1fr); gap: 100pt;">
                        <div style="text-align: center; border-top: 1pt solid black; padding-top: 10pt;">
                            <p style="font-size: 10pt; font-weight: 900; margin: 0;">${profile?.full_name?.toUpperCase()}</p>
                            <p style="font-size: 8pt; font-weight: bold; color: #666; margin: 0; text-transform: uppercase;">Firma del Docente</p>
                        </div>
                        <div style="text-align: center; border-top: 1pt solid black; padding-top: 10pt;">
                            <p style="font-size: 10pt; font-weight: 900; margin: 0;">&nbsp;</p>
                            <p style="font-size: 8pt; font-weight: bold; color: #666; margin: 0; text-transform: uppercase;">Visto Bueno Dirección</p>
                        </div>
                    </div>

                    <script>
                        window.onload = () => {
                            setTimeout(() => {
                                window.print();
                                // Comentado para permitir previsualización manual si falla el auto-close
                                // window.close();
                            }, 500);
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    }

    if (loading) return <div className="p-20 text-center animate-pulse text-gray-500">Cargando editor...</div>

    return (
        <div className="max-w-6xl mx-auto px-4 py-8 pb-32">
            {/* Top Navigation & Actions */}
            <div className="flex flex-col-reverse md:flex-row justify-between items-start md:items-center gap-4 md:gap-8 mb-6 md:mb-8">
                <button
                    onClick={() => navigate('/planning')}
                    className="flex items-center text-gray-500 hover:text-gray-900 transition-colors font-bold text-sm btn-tactile w-full md:w-auto justify-center md:justify-start p-3 md:p-0 bg-gray-50 md:bg-transparent rounded-xl md:rounded-none"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Volver al listado
                </button>
                <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 w-full md:w-auto">
                    {pendingCount > 0 && (
                        <div className="flex items-center px-3 py-1 bg-blue-50 text-blue-600 rounded-full border border-blue-100 animate-pulse">
                            <Clock className="w-3 h-3 mr-1.5" />
                            <span className="text-[11px] font-black uppercase tracking-widest">{pendingCount} Pendientes</span>
                        </div>
                    )}
                    {!isOnline && (
                        <div className="flex items-center px-3 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-100">
                            <Sparkles className="w-3 h-3 mr-1.5" />
                            <span className="text-[11px] font-black uppercase tracking-widest">Offline</span>
                        </div>
                    )}
                    {!isPreviewMode && (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-xs font-black shadow-lg shadow-indigo-100 flex items-center hover:bg-indigo-700 transition-all uppercase tracking-wider disabled:opacity-50 btn-tactile ml-auto md:ml-0"
                        >
                            <Save className="w-3.5 h-3.5 mr-2" />
                            {saving ? 'Guardando...' : 'Guardar'}
                        </button>
                    )}
                </div>
            </div>

            {/* Stepper Progress (Only in Editor Mode) */}
            {!isPreviewMode && (
                <div className="hidden lg:block bg-white rounded-[2.5rem] p-8 shadow-tactile border-4 border-white mb-10 overflow-x-auto print:hidden">
                    <div className="flex justify-between items-center min-w-[700px] relative px-4">
                        {/* Connecting Line */}
                        <div className="absolute top-[24px] left-0 w-full h-2 bg-slate-100 rounded-full z-0"></div>
                        <div
                            className="absolute top-[24px] left-0 h-2 bg-indigo-500 rounded-full z-0 transition-all duration-700 ease-out"
                            style={{ width: `${((step - 1) / 3) * 100}%` }}
                        ></div>

                        {[
                            { n: 1, label: 'Datos', icon: BookOpen },
                            { n: 2, label: 'Libro', icon: Target },
                            { n: 3, label: 'Metodología', icon: Layers },
                            { n: 4, label: 'Finalizar', icon: Sparkles }
                        ].map((s) => (
                            <button
                                key={s.n}
                                onClick={() => {
                                    if (s.n < step) setStep(s.n)
                                    else if (validateStep(step)) setStep(s.n)
                                }}
                                className={`relative z-10 flex flex-col items-center group transition-all duration-500
                                    ${step === s.n ? 'scale-110' : 'opacity-70 hover:opacity-100'} 
                                    ${step > s.n ? 'text-indigo-600' : 'text-slate-300'}`}
                            >
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border-[3px] transition-all duration-300 btn-tactile
                                    ${step === s.n ? 'bg-indigo-600 border-indigo-400 text-white shadow-[0_6px_0_0_#4338ca]' : step > s.n ? 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-[0_6px_0_0_#e0e7ff]' : 'bg-white border-slate-100 text-slate-300 shadow-[0_6px_0_0_#f1f5f9]'}`}
                                >
                                    <s.icon className={`w-6 h-6 ${step === s.n ? 'animate-bounce' : ''}`} />
                                </div>
                                <span className={`text-[11px] font-black uppercase mt-4 tracking-widest bg-white px-3 py-1 rounded-full shadow-sm border border-slate-50
                                    ${step === s.n ? 'text-indigo-600 border-indigo-100' : 'text-slate-500'}`}>
                                    {s.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex gap-8 items-start relative">
                {/* Main Content Area */}
                <div className={`flex-1 bg-white rounded-[2.5rem] shadow-tactile border-4 border-white overflow-hidden transition-all duration-500 ${isPreviewMode ? 'max-w-4xl mx-auto' : ''}`}>

                    {/* Header Banner (Conditional) */}
                    {isPreviewMode && (
                        <div className="bg-gray-50 border-b border-gray-100 p-8 flex justify-between items-start">
                            <div className="flex items-center">
                                <div className="p-3 bg-indigo-600 rounded-2xl text-white mr-4 shadow-lg shadow-indigo-100">
                                    <BookOpen className="w-6 h-6" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Planeación Didáctica</h1>
                                    <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest mt-1">Vunlek • Nueva Escuela Mexicana</p>
                                </div>
                            </div>
                            <div className="text-right flex flex-col items-end">
                                <span className="text-[11px] uppercase font-black text-gray-500 mb-1">Ciclo Escolar</span>
                                <div className="flex items-center bg-white px-3 py-1 rounded-full border border-gray-100 text-sm font-bold text-gray-800 shadow-sm">
                                    <Calendar className="w-3 h-3 mr-2 text-indigo-400" />
                                    2025-2026
                                </div>
                                <button
                                    onClick={() => profile?.is_demo ? alert('Modo Demo: La impresión está deshabilitada.') : handlePrint()}
                                    className={`mt-4 flex items-center font-bold text-[11px] uppercase tracking-widest no-print transition-colors ${profile?.is_demo ? 'text-gray-500 cursor-not-allowed' : 'text-indigo-600 hover:text-indigo-800'}`}
                                >
                                    <Printer className="w-3.5 h-3.5 mr-2" /> Imprimir / PDF
                                </button>
                            </div>
                        </div>
                    )}

                    <div className={`p-4 md:p-8 lg:p-12 space-y-6 md:space-y-8 ${isPreviewMode ? 'print:p-0 print:space-y-8' : ''}`}>
                        {/* Section 1: Selección y Carga (Contexto) */}
                        {/* Paso 1: Datos Generales */}
                        {(step === 1 || isPreviewMode) && (
                            <Step1Context
                                formData={formData}
                                setFormData={setFormData}
                                groups={groups}
                                subjects={subjects}
                                periods={periods}
                                CAMPOS={CAMPOS}
                                isPreviewMode={isPreviewMode}
                                fetchTemplates={fetchTemplates}
                                generateAiSuggestions={generateAiSuggestions}
                                generating={generating}
                                analyticalProgram={analyticalProgram}
                            />
                        )}

                        {/* Paso 02: Libro de Texto */}
                        {/* Paso 02: Libro de Texto */}
                        {(step === 2 || isPreviewMode) && (
                            <Step2Resources
                                formData={formData}
                                setFormData={setFormData}
                                isPreviewMode={isPreviewMode}
                                availableTextbooks={availableTextbooks}
                                personalTextbooks={personalTextbooks}
                                setPersonalTextbooks={setPersonalTextbooks}
                                triggerThemeGeneration={triggerThemeGeneration}
                                isExtractingText={isExtractingText}
                                extractSpecificPages={extractSpecificPages}
                                generatingThemes={generatingThemes}
                                textbookThemesProposal={textbookThemesProposal}
                                toggleThemeSelection={toggleThemeSelection}
                                setIsPdfViewerOpen={setIsPdfViewerOpen}
                                setPdfViewerUrl={setPdfViewerUrl}
                            />
                        )}

                        {/* Paso 03: Metodología NEM */}
                        {/* Paso 03: Metodología NEM */}
                        {(step === 3 || isPreviewMode) && (
                            <Step3Methodology
                                formData={formData}
                                setFormData={setFormData}
                                isPreviewMode={isPreviewMode}
                                METODOLOGIAS={METODOLOGIAS}
                                EJES={EJES}
                                toggleEje={toggleEje}
                            />
                        )}
                        {/* Section 4: Distribución, Secuencia y Evaluación */}
                        {(step === 4 || isPreviewMode) && (
                            <Step4Sequence
                                formData={formData}
                                setFormData={setFormData}
                                isPreviewMode={isPreviewMode}
                                generating={generating}
                                hasDecidedStrategy={hasDecidedStrategy}
                                setHasDecidedStrategy={setHasDecidedStrategy}
                                generateSequenceFromSchedule={generateSequenceFromSchedule}
                                generateAiSuggestions={generateAiSuggestions}
                                setStep={setStep}
                            />
                        )}

                        {/* Navigation Footer */}
                        {
                            !isPreviewMode && (
                                <div className="flex justify-between items-center bg-gray-50 p-6 rounded-2xl border border-gray-100 mt-8 mb-8">
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={() => setStep(Math.max(1, step - 1))}
                                            disabled={step === 1}
                                            className={`flex items-center px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-white hover:text-indigo-600 transition-all ${step === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            <ChevronLeft className="w-5 h-5 mr-2" />
                                            Anterior
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (window.confirm('¿Estás seguro de que deseas cancelar? Se perderán todos los datos no guardados.')) {
                                                    const draftId = id || 'new'
                                                    localStorage.removeItem(`lp_draft_${draftId} `)
                                                    navigate('/planning')
                                                }
                                            }}
                                            className="flex items-center px-4 py-3 rounded-xl font-bold text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-all text-xs uppercase tracking-widest"
                                        >
                                            <X className="w-4 h-4 mr-2" />
                                            Cancelar
                                        </button>
                                    </div>
                                    <div className="text-xs font-black text-gray-300 uppercase tracking-widest">
                                        Paso {step} de 4
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (validateStep(step)) {
                                                if (step < 4) setStep(step + 1)
                                                else setIsPreviewMode(true) // Final step goes to preview
                                            }
                                        }}
                                        className="flex items-center bg-indigo-600 text-white px-8 py-3 rounded-xl font-black shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:scale-105 transition-all group"
                                    >
                                        {step === 4 ? 'Finalizar y Ver' : 'Siguiente Paso'}
                                        <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            )
                        }

                        {
                            !isPreviewMode && step === 5 && (
                                <div className="pt-8 flex justify-center pb-20">
                                    <button
                                        onClick={generateAiSuggestions}
                                        disabled={generating}
                                        className="bg-indigo-600 text-white px-10 py-5 rounded-[2rem] text-sm font-black shadow-[0_8px_0_0_#4338ca] border-4 border-white flex items-center hover:shadow-none hover:translate-y-2 active:scale-95 transition-all uppercase tracking-widest group"
                                    >
                                        <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center mr-4 group-hover:rotate-12 transition-transform shadow-inner">
                                            <Sparkles className="w-5 h-5 text-white" />
                                        </div>
                                        {generating ? 'Consultando IA...' : 'Usar Asistente IA'}
                                    </button>
                                </div>
                            )
                        }

                        {/* PDF Viewer Modal */}
                        {
                            isPdfViewerOpen && (
                                <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[200] flex flex-col no-print">
                                    <div className="flex justify-between items-center p-6 bg-white/5 border-b border-white/10">
                                        <div className="flex items-center space-x-4">
                                            <div className="p-3 bg-indigo-600 text-white rounded-2xl">
                                                <BookOpen className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h3 className="text-white font-black uppercase text-sm tracking-tight">
                                                    {availableTextbooks.find(b => b.id === formData.textbook_id)?.title || 'Visualizador de Libro'}
                                                </h3>
                                                <p className="text-[11px] text-indigo-300 font-bold uppercase tracking-widest">
                                                    Páginas {formData.textbook_pages_from || '?'} a {formData.textbook_pages_to || '?'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-4">
                                            <a
                                                href={pdfViewerUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center space-x-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[11px] font-black uppercase transition-all"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                                <span>Abrir en Nueva Pestaña</span>
                                            </a>
                                            <button aria-label="Agregar"
                                                onClick={() => setIsPdfViewerOpen(false)}
                                                className="bg-rose-500/20 hover:bg-rose-500 text-rose-500 hover:text-white p-3 rounded-2xl transition-all"
                                            >
                                                <Plus className="w-6 h-6 rotate-45" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex-1 bg-slate-800 relative overflow-hidden">
                                        <iframe
                                            src={pdfViewerUrl}
                                            className="w-full h-full border-none"
                                            title="PDF Viewer"
                                        />
                                    </div>
                                </div>
                            )}

                        {/* Footer Validation */}
                        <div className="bg-gray-50 border-t border-gray-100 p-8 flex justify-between items-center text-[11px] font-black uppercase text-gray-500 print:bg-white print:border-t-2">
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

                    <AiSuggestionsModal
                        isOpen={isAiPanelOpen}
                        onClose={() => setIsAiPanelOpen(false)}
                        generating={generating}
                        aiSuggestions={aiSuggestions}
                        selectedAiProposalIdx={selectedAiProposalIdx}
                        setSelectedAiProposalIdx={setSelectedAiProposalIdx}
                        applyAiSuggestion={applyAiSuggestion}
                        generateAiSuggestions={generateAiSuggestions}
                        setAiSuggestions={setAiSuggestions}
                    />

                    <PdaCatalogModal
                        isOpen={isPdaModalOpen}
                        onClose={() => setIsPdaModalOpen(false)}
                        campoFormativo={formData.campo_formativo}
                        selectedPdas={formData.pda}
                        onTogglePda={(pdaOption) => {
                            setFormData(prev => {
                                const isSelected = (prev.pda || []).includes(pdaOption)
                                if (isSelected) {
                                    return { ...prev, pda: (prev.pda || []).filter(p => p !== pdaOption) }
                                } else {
                                    const currentPdAs = (prev.pda || []).filter(p => p.trim() !== '')
                                    return { ...prev, pda: [...currentPdAs, pdaOption] }
                                }
                            })
                        }}
                    />

                    <ResourceCatalogModal
                        isOpen={isResourceModalOpen}
                        onClose={() => setIsResourceModalOpen(false)}
                        searchTerm={resourceSearch}
                        onSearchChange={setResourceSearch}
                        selectedResources={formData.resources}
                        onToggleResource={(item) => {
                            setFormData(prev => {
                                const isSelected = (prev.resources || []).includes(item)
                                if (isSelected) {
                                    return { ...prev, resources: (prev.resources || []).filter(r => r !== item) }
                                } else {
                                    const currentResources = (prev.resources || []).filter(r => r.trim() !== '')
                                    return { ...prev, resources: [...currentResources, item] }
                                }
                            })
                        }}
                    />

                    <ErrorModal
                        isOpen={errorModal.isOpen}
                        title={errorModal.title}
                        message={errorModal.message}
                        buttonText={errorModal.buttonText}
                        action={errorModal.action}
                        onClose={() => setErrorModal({ ...errorModal, isOpen: false })}
                    />

                    <ProgramContentModal
                        isOpen={isProgramModalOpen}
                        onClose={() => setIsProgramModalOpen(false)}
                        programContents={programContents}
                        onSelectContent={(content) => {
                            setFormData(prev => ({
                                ...prev,
                                campo_formativo: content.campo_formativo || prev.campo_formativo,
                                ejes_articuladores: [...new Set([...(prev.ejes_articuladores || []), ...(content.ejes_articuladores || [])])],
                                contents: [...new Set([...(prev.contents || []), content.custom_content])].filter(c => c),
                                pda: [...new Set([...(prev.pda || []), ...(content.pda_ids || []).map((id: string) => (PDA_CATALOG as any)[id] || id)])].filter(p => p)
                            }))
                            setIsProgramModalOpen(false)
                        }}
                    />

                    <PreviewModal
                        isOpen={isPreviewMode}
                        onClose={() => setIsPreviewMode(false)}
                        formData={formData}
                        tenant={tenant}
                        profile={profile}
                        groups={groups}
                        subjects={subjects}
                    />

                    <TemplateBankModal
                        isOpen={isTemplateModalOpen}
                        onClose={() => setIsTemplateModalOpen(false)}
                        loadingTemplates={loadingTemplates}
                        templates={templates}
                        applyTemplate={applyTemplate}
                    />

                    <PdfViewerModal
                        isOpen={isPdfViewerOpen}
                        onClose={() => setIsPdfViewerOpen(false)}
                        title={formData.title}
                        pagesFrom={formData.textbook_pages_from || null}
                        pagesTo={formData.textbook_pages_to || null}
                        pdfUrl={pdfViewerUrl}
                    />
                </div>
            </div>
        </div>
    );
};

export default PlanningEditorPage;
