import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { useProfile } from '../../../hooks/useProfile'
import { useOfflineSync } from '../../../hooks/useOfflineSync'
import { GeminiService, geminiService } from '../../../lib/gemini'
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
    Hash,
    ChevronLeft,
    ChevronRight,
    Maximize2,
    Eye,
    ExternalLink,
    X,
    FileText
} from 'lucide-react'
import { PDFUpload } from '../../../components/common/PDFUpload'
import * as pdfjsLib from 'pdfjs-dist'

// Worker setup
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

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
    const [aiSuggestions, setAiSuggestions] = useState<any[]>([])
    const [selectedAiProposalIdx, setSelectedAiProposalIdx] = useState<number | null>(null)
    const [isAiPanelOpen, setIsAiPanelOpen] = useState(false)
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
                        setFormData(prev => ({
                            ...prev,
                            problem_context: prev.problem_context || match.diagnosis_narrative || ''
                        }))
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
                    await fetchSubjects(finalFormData.group_id, tenant.id)
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

                // 7. Final Period Adjustment
                if (!finalFormData.period_id) {
                    const today = new Date().toISOString().split('T')[0]
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

            let query = supabase
                .from('textbooks')
                .select('*')
                .eq('level', mappedLevel)
                .eq('grade', selectedGroup.grade)

            const { data, error } = await query

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
            if (!tenant?.id || !formData.subject_id || !formData.campo_formativo) return



            // 1. Fetch main program (One per school/cycle)
            const { data: programs, error: progErr } = await supabase
                .from('analytical_programs')
                .select('*')
                .eq('tenant_id', tenant.id)
                .order('created_at', { ascending: false })
                .limit(1)

            if (progErr) {
                console.error('[AnalyticalSync] Error buscando programa:', progErr)
                return
            }

            const program = programs?.[0]
            if (!program) {

                return
            }


            // 2. Fetch specific content for the selected subject and field
            const { data: contents, error: contErr } = await supabase
                .from('analytical_program_contents')
                .select(`
                    justification, 
                    content_id,
                    pda_ids
                `)
                .eq('program_id', program.id)
                .eq('subject_id', formData.subject_id)
                .eq('campo_formativo', formData.campo_formativo)
                .limit(1)

            if (contErr) console.error('[AnalyticalSync] Error buscando contenidos:', contErr)

            let programContent = contents?.[0] as any

            // 2b. Fallback: Search in JSONB program_by_fields if table is empty
            if (!programContent && program.program_by_fields) {

                const fieldKeyMap: Record<string, string> = {
                    'Lenguajes': 'lenguajes',
                    'Saberes y Pensamiento Científico': 'saberes',
                    'Ética, Naturaleza y Sociedades': 'etica',
                    'De lo Humano y lo Comunitario': 'humano'
                }
                const fieldKey = fieldKeyMap[formData.campo_formativo] || formData.campo_formativo.toLowerCase()
                const fieldItems = (program.program_by_fields as any)[fieldKey] || []

                // Try to find an item (since we don't have subject_id inside JSONB easily, take any relevant if available)
                if (fieldItems.length > 0) {
                    const fallbackItem = fieldItems[0] // Taking first for now
                    programContent = {
                        justification: '', // JSONB doesn't seem to have per-item justification in this version
                        content_id: fallbackItem.contentId,
                        pda_ids: fallbackItem.pda_grade_1 ? [fallbackItem.contentId] : [] // PDA handling simplified
                    }

                }
            }

            if (!programContent && !program.diagnosis_context && !(program.group_diagnosis as any)?.narrative_final) {

                return
            }

            // Fetch PDA names and Content name manually to avoid complex join typing issues
            let pdaNames: string[] = []
            let contentName = ''

            if (programContent?.content_id) {
                const { data: contentData } = await supabase
                    .from('synthetic_program_contents')
                    .select('content')
                    .eq('id', programContent.content_id)
                    .single()
                if (contentData) contentName = contentData.content
            }

            if (programContent?.pda_ids && programContent.pda_ids.length > 0) {
                const { data: pdaItems } = await supabase
                    .from('synthetic_program_contents')
                    .select('pda')
                    .in('id', programContent.pda_ids)

                if (pdaItems) {
                    pdaNames = pdaItems.map(i => i.pda).filter(Boolean)
                }
            }

            // Update formData
            setFormData(prev => {
                const updates: any = {}

                // Problem Context: Update if empty or very short
                const currentCtx = (prev.problem_context || '').trim()
                if (!currentCtx || currentCtx.length < 10) {
                    let newContext = ''
                    const diagnosisResult = program.diagnosis_context || (program.group_diagnosis as any)?.narrative_final || (program.group_diagnosis as any)?.narrative

                    if (diagnosisResult) newContext += `DIAGNÓSTICO:\n${diagnosisResult}\n\n`
                    if (programContent?.justification) newContext += `JUSTIFICACIÓN DEL CAMPO:\n${programContent.justification}`

                    if (newContext.trim()) {
                        updates.problem_context = newContext.trim()
                    }
                }

                // PDAs and Contents (if empty)
                if ((!prev.pda || prev.pda.length === 0 || prev.pda[0] === '') && pdaNames.length > 0) {
                    updates.pda = pdaNames
                }
                if ((!prev.contents || prev.contents.length === 0 || prev.contents[0] === '') && contentName) {
                    updates.contents = [contentName]
                }

                if (Object.keys(updates).length === 0) {

                    return prev
                }


                return { ...prev, ...updates }
            })
        }

        fetchAnalyticalData()
    }, [formData.subject_id, formData.campo_formativo, tenant?.id])

    // Theme Sync Effect: Auto-trigger theme generation when book is selected or auto-selected
    useEffect(() => {
        const fetchInitialThemes = async () => {
            if (formData.textbook_id && availableTextbooks.length > 0 && textbookThemesProposal.length === 0 && !generatingThemes) {
                const book = availableTextbooks.find(b => b.id === formData.textbook_id)
                if (book && book.file_url) {
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
                const aiService = apiKey.startsWith('gsk_')
                    ? new GroqService(apiKey)
                    : new GeminiService(
                        tenant?.aiConfig?.geminiKey || apiKey,
                        tenant?.aiConfig?.apiKey,
                        tenant?.aiConfig?.openaiKey
                    )

                themes = await aiService.extractThemesFromText({
                    textbookTitle: bookTitle,
                    text: extractedText,
                    field: formData.campo_formativo
                })
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
            if (formData.temporality === 'TRIMESTER') weeksToGenerate = 12
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
            const aiService = apiKey.startsWith('gsk_')
                ? new GroqService(apiKey)
                : new GeminiService(
                    tenant?.aiConfig?.geminiKey || apiKey,
                    tenant?.aiConfig?.apiKey,
                    tenant?.aiConfig?.openaiKey
                )

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
            selected_themes: prev.selected_themes.includes(theme)
                ? prev.selected_themes.filter(t => t !== theme)
                : [...prev.selected_themes, theme]
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

    if (loading) return <div className="p-20 text-center animate-pulse text-gray-400">Cargando editor...</div>

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
                            <span className="text-[10px] font-black uppercase tracking-widest">{pendingCount} Pendientes</span>
                        </div>
                    )}
                    {!isOnline && (
                        <div className="flex items-center px-3 py-1 bg-amber-50 text-amber-600 rounded-full border border-amber-100">
                            <Sparkles className="w-3 h-3 mr-1.5" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Offline</span>
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
                            style={{ width: `${((step - 1) / 3) * 100}% ` }}
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
                                className={`relative z - 10 flex flex - col items - center group transition - all duration - 500
                                    ${step === s.n ? 'scale-110' : 'opacity-70 hover:opacity-100'} 
                                    ${step > s.n ? 'text-indigo-600' : 'text-slate-300'} `}
                            >
                                <div className={`w - 14 h - 14 rounded - 2xl flex items - center justify - center border - [3px] transition - all duration - 300 btn - tactile
                                    ${step === s.n ? 'bg-indigo-600 border-indigo-400 text-white shadow-[0_6px_0_0_#4338ca]' : step > s.n ? 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-[0_6px_0_0_#e0e7ff]' : 'bg-white border-slate-100 text-slate-300 shadow-[0_6px_0_0_#f1f5f9]'} `}
                                >
                                    <s.icon className={`w - 6 h - 6 ${step === s.n ? 'animate-bounce' : ''} `} />
                                </div>
                                <span className={`text - [10px] font - black uppercase mt - 4 tracking - widest bg - white px - 3 py - 1 rounded - full shadow - sm border border - slate - 50
                                    ${step === s.n ? 'text-indigo-600 border-indigo-100' : 'text-slate-400'} `}>
                                    {s.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex gap-8 items-start relative">
                {/* Main Content Area */}
                <div className={`flex - 1 bg - white rounded - [2.5rem] shadow - tactile border - 4 border - white overflow - hidden transition - all duration - 500 ${isPreviewMode ? 'max-w-4xl mx-auto' : ''} `}>

                    {/* Header Banner (Conditional) */}
                    {isPreviewMode && (
                        <div className="bg-gray-50 border-b border-gray-100 p-8 flex justify-between items-start">
                            <div className="flex items-center">
                                <div className="p-3 bg-indigo-600 rounded-2xl text-white mr-4 shadow-lg shadow-indigo-100">
                                    <BookOpen className="w-6 h-6" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Planeación Didáctica</h1>
                                    <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-1">Vunlek • Nueva Escuela Mexicana</p>
                                </div>
                            </div>
                            <div className="text-right flex flex-col items-end">
                                <span className="text-[10px] uppercase font-black text-gray-400 mb-1">Ciclo Escolar</span>
                                <div className="flex items-center bg-white px-3 py-1 rounded-full border border-gray-100 text-sm font-bold text-gray-800 shadow-sm">
                                    <Calendar className="w-3 h-3 mr-2 text-indigo-400" />
                                    2025-2026
                                </div>
                                <button
                                    onClick={() => profile?.is_demo ? alert('Modo Demo: La impresión está deshabilitada.') : handlePrint()}
                                    className={`mt - 4 flex items - center font - bold text - [10px] uppercase tracking - widest no - print transition - colors ${profile?.is_demo ? 'text-gray-400 cursor-not-allowed' : 'text-indigo-600 hover:text-indigo-800'} `}
                                >
                                    <Printer className="w-3.5 h-3.5 mr-2" /> Imprimir / PDF
                                </button>
                            </div>
                        </div>
                    )}

                    <div className={`p - 4 md: p - 8 lg: p - 12 space - y - 6 md: space - y - 8 ${isPreviewMode ? 'print:p-0 print:space-y-8' : ''} `}>
                        {/* Section 1: Selección y Carga (Contexto) */}
                        {(step === 1 || isPreviewMode) && (<section className={isPreviewMode ? 'grid grid-cols-2 gap-8' : ''}>
                            {!isPreviewMode ? (
                                <>
                                    <div className="flex items-center space-x-3 mb-8">
                                        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                                            <Target className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-black text-gray-900 tracking-tight">Paso 01. Identificación y Formación</h2>
                                            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-1">Configura el destino de tu planeación NEM</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 bg-white p-8 rounded-[2.5rem] border-2 border-slate-50 shadow-sm">
                                        <div className="col-span-1 md:col-span-2 lg:col-span-3">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Título del Proyecto / Unidad</label>
                                            <div className="relative group">
                                                <input
                                                    type="text"
                                                    value={formData.title}
                                                    onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                                    placeholder="Ej: Explorando la Biotecnología en mi comunidad..."
                                                    className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-100 rounded-2xl px-6 py-4 text-sm font-bold text-indigo-950 outline-none transition-all"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Campo Formativo</label>
                                            <select
                                                value={formData.campo_formativo}
                                                onChange={e => setFormData(prev => ({ ...prev, campo_formativo: e.target.value }))}
                                                className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-100 rounded-2xl px-6 py-4 text-sm font-bold text-indigo-950 outline-none transition-all appearance-none cursor-pointer"
                                            >
                                                <option value="">Seleccionar Campo</option>
                                                {CAMPOS.map(c => (
                                                    <option key={c} value={c}>{c}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Grupo Escolar</label>
                                            <select
                                                value={formData.group_id}
                                                onChange={e => setFormData(prev => ({ ...prev, group_id: e.target.value, subject_id: '' }))}
                                                className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-100 rounded-2xl px-6 py-4 text-sm font-bold text-indigo-950 outline-none transition-all appearance-none cursor-pointer"
                                            >
                                                <option value="">Seleccionar Grupo</option>
                                                {groups.map(g => (
                                                    <option key={g.id} value={g.id}>{g.grade}° "{g.section}"</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Asignatura / Disciplina</label>
                                            <select
                                                value={formData.subject_id}
                                                onChange={e => setFormData(prev => ({ ...prev, subject_id: e.target.value }))}
                                                disabled={!formData.group_id}
                                                className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-100 rounded-2xl px-6 py-4 text-sm font-bold text-indigo-950 outline-none transition-all appearance-none cursor-pointer disabled:opacity-50"
                                            >
                                                <option value="">{formData.group_id ? 'Seleccionar Asignatura' : 'Primero elige un grupo'}</option>
                                                {subjects.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Periodo de Evaluación</label>
                                            <select
                                                value={formData.period_id}
                                                onChange={e => setFormData(prev => ({ ...prev, period_id: e.target.value }))}
                                                className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-100 rounded-2xl px-6 py-4 text-sm font-bold text-indigo-950 outline-none transition-all appearance-none cursor-pointer"
                                            >
                                                <option value="">Seleccionar Periodo</option>
                                                {periods.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                        </div>



                                        <div className="space-y-3">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Esquema de Planeación</label>
                                            <select
                                                value={formData.temporality}
                                                onChange={e => setFormData(prev => ({ ...prev, temporality: e.target.value }))}
                                                className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-100 rounded-2xl px-6 py-4 text-sm font-bold text-indigo-950 outline-none transition-all appearance-none cursor-pointer"
                                            >
                                                <option value="WEEKLY">Semanal (Normal)</option>
                                                <option value="MONTHLY">Mensual (Unidad)</option>
                                                <option value="PROJECT">Por Proyecto (NEM)</option>
                                            </select>
                                        </div>

                                        {formData.temporality === 'PROJECT' && (
                                            <div className="space-y-3">
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Número de Sesiones</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={formData.project_duration || 10}
                                                    onChange={e => setFormData(prev => ({ ...prev, project_duration: parseInt(e.target.value) || 1 }))}
                                                    className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-100 rounded-2xl px-6 py-4 text-sm font-bold text-indigo-950 outline-none transition-all"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {analyticalProgram && formData.group_id && (
                                        <div className="mt-8 p-6 bg-emerald-50 rounded-3xl border-2 border-emerald-100 animate-in fade-in slide-in-from-top-4 duration-500">
                                            <div className="flex items-center space-x-4">
                                                <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg">
                                                    <ClipboardCheck className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Programa Analítico Detectado</p>
                                                    <h4 className="text-sm font-black text-emerald-950 uppercase italic">
                                                        Contenidos y Problemáticas cargados automáticamente
                                                    </h4>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-6 rounded-2xl border border-gray-100">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Proyecto</p>
                                        <p className="font-bold text-gray-900">{formData.title || 'Sin Título'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Grupo</p>
                                        <p className="font-bold text-gray-900">{groups.find(g => g.id === formData.group_id)?.grade}° "{groups.find(g => g.id === formData.group_id)?.section}"</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Asignatura</p>
                                        <p className="font-bold text-gray-900">{subjects.find(s => s.id === formData.subject_id)?.name}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Temporalidad</p>
                                        <p className="font-bold text-indigo-600">
                                            {formData.temporality === 'WEEKLY' ? 'Semanal' :
                                                formData.temporality === 'MONTHLY' ? 'Mensual' : 'Proyecto'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Campo Formativo</p>
                                        <p className="font-bold text-gray-900">{formData.campo_formativo || 'No seleccionado'}</p>
                                    </div>
                                </div>
                            )}
                        </section>
                        )}

                        {/* Paso 02: Libro de Texto */}
                        {(step === 2 || isPreviewMode) && (<section className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                            {!isPreviewMode ? (
                                <>
                                    <div className="flex items-center space-x-3 mb-8">
                                        <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-100">
                                            <BookOpen className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-black text-gray-900 tracking-tight">Paso 02. Libro de Texto e Insumos</h2>
                                            <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mt-1">Selecciona el contenido base de tus actividades</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        <div className="space-y-6">
                                            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-50 shadow-sm">
                                                <h3 className="text-xs font-black text-indigo-950 uppercase tracking-widest mb-6 flex items-center">
                                                    <Search className="w-4 h-4 mr-2 text-indigo-400" />
                                                    Seleccionar Libro Oficial
                                                </h3>
                                                <select
                                                    value={formData.textbook_id}
                                                    onChange={async (e) => {
                                                        const bookId = e.target.value
                                                        setFormData(prev => ({ ...prev, textbook_id: bookId }))

                                                        if (bookId) {
                                                            const book = availableTextbooks.find(b => b.id === bookId)
                                                            if (book) {
                                                                triggerThemeGeneration(book.title)
                                                            }
                                                        } else {
                                                            setTextbookThemesProposal([])
                                                        }
                                                    }}
                                                    className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-100 rounded-2xl px-6 py-4 text-sm font-bold text-indigo-950 outline-none transition-all appearance-none cursor-pointer"
                                                >
                                                    <option value="">Seleccionar Libro CONALITEG</option>
                                                    {availableTextbooks.filter(book => {
                                                        if (!formData.campo_formativo) return true
                                                        const bField = (book.field_of_study || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                                                        const fField = formData.campo_formativo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                                                        return bField.includes(fField) || fField.includes(bField)
                                                    }).map(book => (
                                                        <option key={book.id} value={book.id}>{book.title}</option>
                                                    ))}
                                                </select>

                                                {(formData.textbook_id || formData.source_document_url) && (
                                                    <div className="mt-6 p-6 bg-slate-50 rounded-3xl border-2 border-slate-100 animate-in fade-in slide-in-from-top-4 duration-500">
                                                        <div className="flex flex-col space-y-4">
                                                            <div className="flex items-center justify-between">
                                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contexto Específico</h4>
                                                                <button
                                                                    onClick={() => {
                                                                        const url = formData.source_document_url || availableTextbooks.find(b => b.id === formData.textbook_id)?.file_url
                                                                        if (url) {
                                                                            setPdfViewerUrl(url)
                                                                            setIsPdfViewerOpen(true)
                                                                        }
                                                                    }}
                                                                    className="flex items-center space-x-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700 transition-colors"
                                                                >
                                                                    <Eye className="w-3 h-3" />
                                                                    <span>Ver Libro</span>
                                                                </button>
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div>
                                                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Página Desde</label>
                                                                    <input
                                                                        type="number"
                                                                        min="1"
                                                                        value={formData.textbook_pages_from}
                                                                        onChange={e => setFormData(prev => ({ ...prev, textbook_pages_from: e.target.value }))}
                                                                        className="w-full bg-white border-2 border-slate-100 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:border-indigo-200 transition-all"
                                                                        placeholder="Ej: 12"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Página Hasta</label>
                                                                    <input
                                                                        type="number"
                                                                        min="1"
                                                                        value={formData.textbook_pages_to}
                                                                        onChange={e => setFormData(prev => ({ ...prev, textbook_pages_to: e.target.value }))}
                                                                        className="w-full bg-white border-2 border-slate-100 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:border-indigo-200 transition-all"
                                                                        placeholder="Ej: 15"
                                                                    />
                                                                </div>
                                                            </div>

                                                            <button
                                                                onClick={async () => {
                                                                    const url = formData.source_document_url || availableTextbooks.find(b => b.id === formData.textbook_id)?.file_url
                                                                    const from = parseInt(formData.textbook_pages_from)
                                                                    const to = parseInt(formData.textbook_pages_to)
                                                                    if (url && from && to) {
                                                                        await extractSpecificPages(url, from, to)
                                                                    } else {
                                                                        alert('Por favor indica el rango de páginas y asegúrate de tener un libro seleccionado.')
                                                                    }
                                                                }}
                                                                disabled={isExtractingText || !formData.textbook_pages_from || !formData.textbook_pages_to}
                                                                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-100 flex items-center justify-center space-x-2"
                                                            >
                                                                {isExtractingText ? (
                                                                    <>
                                                                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                                        <span>Leyendo páginas...</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Sparkles className="w-3 h-3" />
                                                                        <span>Usar estas páginas para la planeación</span>
                                                                    </>
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="mt-8 border-t-2 border-slate-50 pt-8">
                                                    <h3 className="text-xs font-black text-indigo-950 uppercase tracking-widest mb-4 flex items-center">
                                                        <BookMarked className="w-4 h-4 mr-2 text-indigo-400" />
                                                        Mi Biblioteca Personal
                                                    </h3>

                                                    {personalTextbooks.length > 0 ? (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                                                            {personalTextbooks.map(book => (
                                                                <div
                                                                    key={book.id}
                                                                    onClick={() => {
                                                                        setFormData(prev => ({
                                                                            ...prev,
                                                                            source_document_url: book.file_url,
                                                                            textbook_id: '',
                                                                            textbook_pages_from: '',
                                                                            textbook_pages_to: ''
                                                                        }))
                                                                    }}
                                                                    className={`p - 3 rounded - xl border - 2 cursor - pointer transition - all flex items - center shadow - sm ${formData.source_document_url === book.file_url && !formData.textbook_id
                                                                            ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-200'
                                                                            : 'bg-white border-slate-100 hover:border-indigo-200'
                                                                        } `}
                                                                >
                                                                    <div className={`w - 8 h - 8 rounded - lg flex items - center justify - center mr - 3 ${formData.source_document_url === book.file_url && !formData.textbook_id
                                                                            ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
                                                                        } `}>
                                                                        <FileText className="w-4 h-4" />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-xs font-bold text-slate-700 truncate">{book.title}</p>
                                                                        <p className="text-[9px] font-black text-slate-400 tracking-widest uppercase">
                                                                            {new Date(book.created_at).toLocaleDateString()}
                                                                        </p>
                                                                    </div>
                                                                    {formData.source_document_url === book.file_url && !formData.textbook_id && (
                                                                        <CheckCircle2 className="w-4 h-4 text-indigo-600 ml-2" />
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-slate-400 italic mb-6">Aún no has guardado libros en tu biblioteca.</p>
                                                    )}

                                                    <h3 className="text-xs font-black text-indigo-950 uppercase tracking-widest mb-4 flex items-center">
                                                        <Plus className="w-4 h-4 mr-2 text-indigo-400" />
                                                        Subir Nuevo Libro (PDF)
                                                    </h3>
                                                    <PDFUpload
                                                        label="Subir PDF del Libro"
                                                        bucket="textbooks"
                                                        currentFileUrl={formData.source_document_url}
                                                        onUploadComplete={async (url, text, fileName) => {
                                                            // Guardar en repositorio personal
                                                            const { data: { user } } = await supabase.auth.getUser()
                                                            if (user) {
                                                                const { data: newBook } = await supabase.from('user_textbooks').insert({
                                                                    profile_id: user.id,
                                                                    title: fileName || 'Libro Personalizado',
                                                                    file_url: url
                                                                }).select().single()

                                                                if (newBook) {
                                                                    setPersonalTextbooks(prev => [newBook, ...prev])
                                                                }
                                                            }

                                                            setFormData(prev => ({
                                                                ...prev,
                                                                source_document_url: url,
                                                                extracted_text: text,
                                                                textbook_id: ''
                                                            }))

                                                            if (text) {
                                                                triggerThemeGeneration(undefined, text)
                                                            }
                                                        }}
                                                        onClear={() => {
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                source_document_url: '',
                                                                extracted_text: '',
                                                                textbook_pages_from: '',
                                                                textbook_pages_to: ''
                                                            }))
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group min-h-[300px]">
                                                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                                                    <Sparkles className="w-32 h-32 text-indigo-400" />
                                                </div>

                                                <div className="relative z-10">
                                                    <h3 className="text-xs font-black text-indigo-400 uppercase tracking-[0.2em] mb-4">Análisis Inteligente (IA)</h3>
                                                    <h4 className="text-xl font-bold text-white mb-6">Temas detectados en el recurso</h4>

                                                    {generatingThemes ? (
                                                        <div className="flex flex-col items-center justify-center py-12">
                                                            <div className="w-12 h-12 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin mb-4"></div>
                                                            <p className="text-xs font-black text-indigo-300 uppercase tracking-widest animate-pulse">Analizando PDF...</p>
                                                        </div>
                                                    ) : textbookThemesProposal.length > 0 ? (
                                                        <div className="space-y-3">
                                                            {textbookThemesProposal.map((item, idx) => (
                                                                <button
                                                                    key={idx}
                                                                    onClick={() => toggleThemeSelection(item.theme)}
                                                                    className={`w - full flex items - center justify - between p - 4 rounded - 2xl border - 2 transition - all duration - 300 ${(formData.selected_themes || []).includes(item.theme)
                                                                            ? 'bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-600/20'
                                                                            : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                                                                        } `}
                                                                >
                                                                    <div className="flex items-center space-x-3 text-left">
                                                                        <div className={`p - 2 rounded - lg ${(formData.selected_themes || []).includes(item.theme) ? 'bg-white/20' : 'bg-white/5'} `}>
                                                                            <CheckCircle2 className="w-4 h-4" />
                                                                        </div>
                                                                        <span className="text-sm font-bold uppercase tracking-tight">{item.theme}</span>
                                                                    </div>
                                                                    <span className="text-[10px] font-black opacity-60 bg-black/20 px-3 py-1 rounded-full uppercase">{item.pages}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="bg-white/5 border-2 border-dashed border-white/10 rounded-[2rem] p-12 text-center">
                                                            <p className="text-indigo-300/40 font-bold italic text-sm">Selecciona o sube un libro para que la IA proponga los temas clave aquí.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="col-span-2 bg-amber-50 p-6 rounded-2xl border border-amber-100">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Libro Seleccionado</p>
                                            <p className="font-bold text-amber-950">
                                                {availableTextbooks.find(b => b.id === formData.textbook_id)?.title || (formData.source_document_url ? 'Libro Personalizado' : 'Sin Libro')}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Temas del Libro</p>
                                            <p className="text-xs font-bold text-amber-800">
                                                {formData.selected_themes.join(', ') || 'Varios temas seleccionados'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </section>)}

                        {/* Paso 03: Metodología NEM */}
                        {(step === 3 || isPreviewMode) && (<section className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                            {!isPreviewMode ? (
                                <>
                                    <div className="flex items-center space-x-3 mb-8">
                                        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                                            <Target className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-black text-gray-900 tracking-tight">Paso 03. Metodología y Ejes Articuladores</h2>
                                            <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-1">Define el enfoque pedagógico de tu planeación</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-50 shadow-sm space-y-6">
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-3 ml-1 tracking-widest">Metodología NEM Sugerida</label>
                                                <div className="grid grid-cols-1 gap-3">
                                                    {METODOLOGIAS.map(m => (
                                                        <button
                                                            key={m}
                                                            onClick={() => setFormData(prev => ({ ...prev, metodologia: m }))}
                                                            className={`text - left px - 6 py - 4 rounded - 2xl border - 2 font - bold text - sm transition - all duration - 300 ${formData.metodologia === m
                                                                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm'
                                                                    : 'bg-slate-50 border-transparent text-gray-500 hover:border-indigo-100'
                                                                } btn - tactile`}
                                                        >
                                                            {m}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-3 ml-1 tracking-widest">Ejes Articuladores (Mínimo 2-3 sugeridos)</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {EJES.map(eje => {
                                                        const isSelected = formData.ejes_articuladores.includes(eje)
                                                        return (
                                                            <button
                                                                key={eje}
                                                                onClick={() => toggleEje(eje)}
                                                                className={`px - 4 py - 2.5 rounded - xl text - [10px] font - black uppercase tracking - wider border - 2 transition - all duration - 300
                                                                    ${isSelected
                                                                        ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-sm'
                                                                        : 'bg-slate-50 border-transparent text-gray-400 hover:bg-gray-100'
                                                                    } `}
                                                            >
                                                                {eje}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-50 shadow-sm space-y-6">
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-3 ml-1 tracking-widest">Propósito del Proyecto / Justificación</label>
                                                <textarea
                                                    rows={6}
                                                    value={formData.problem_context}
                                                    onChange={e => setFormData(prev => ({ ...prev, problem_context: e.target.value }))}
                                                    placeholder="Extraído del Programa Analítico. Puedes ajustarlo aquí..."
                                                    className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-100 rounded-2xl px-6 py-4 text-sm font-medium text-slate-700 outline-none transition-all resize-none"
                                                />
                                            </div>

                                            <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100">
                                                <div className="flex items-center space-x-3 mb-4">
                                                    <Sparkles className="w-4 h-4 text-indigo-600" />
                                                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Resumen de Contenidos cargados</p>
                                                </div>
                                                <div className="space-y-2">
                                                    {formData.pda.slice(0, 3).map((p, i) => (
                                                        <div key={i} className="flex items-start space-x-2">
                                                            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full mt-1.5 shrink-0" />
                                                            <p className="text-[11px] font-bold text-indigo-900 line-clamp-1">{p}</p>
                                                        </div>
                                                    ))}
                                                    {formData.pda.length > 3 && (
                                                        <p className="text-[9px] font-black text-indigo-400 uppercase italic mt-2">+ {formData.pda.length - 3} PDAs adicionales</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                                        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Metodología</p>
                                        <p className="font-bold text-indigo-950">{formData.metodologia}</p>
                                    </div>
                                    <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                                        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Ejes Articuladores</p>
                                        <p className="font-bold text-indigo-950">{formData.ejes_articuladores.join(', ')}</p>
                                    </div>
                                </div>
                            )}
                        </section>)}
                        {/* Section 4: Distribución, Secuencia y Evaluación */}
                        {
                            (step === 4 || isPreviewMode) && (<section className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                                <div className="flex items-center space-x-3 mb-8">
                                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                                        <Sparkles className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-gray-900 tracking-tight">Paso 04. Configuración y Generación Final</h2>
                                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-1">Revisa tu cronograma y genera las actividades con IA</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    {/* Columna Izquierda: Horario y Fechas */}
                                    <div className="lg:col-span-1 space-y-6">
                                        <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-50 shadow-sm">
                                            <div className="flex items-center justify-between mb-4">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Cronograma</label>
                                                {!isPreviewMode && (
                                                    <button
                                                        onClick={generateSequenceFromSchedule}
                                                        className="text-[9px] font-black text-indigo-600 uppercase bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 hover:bg-indigo-100 transition-all"
                                                    >
                                                        Cargar Horario
                                                    </button>
                                                )}
                                            </div>

                                            <div className="space-y-4">
                                                <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-2xl border border-transparent focus-within:border-indigo-100 transition-all">
                                                    <Calendar className="w-4 h-4 text-indigo-400" />
                                                    <div className="flex-1">
                                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Inicio</p>
                                                        <input
                                                            type="date"
                                                            value={formData.start_date}
                                                            onChange={e => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                                                            disabled={isPreviewMode}
                                                            className="w-full bg-transparent border-none p-0 text-xs font-bold text-gray-900 focus:ring-0"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-2xl border border-transparent focus-within:border-indigo-100 transition-all">
                                                    <Calendar className="w-4 h-4 text-indigo-400" />
                                                    <div className="flex-1">
                                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Fin</p>
                                                        <input
                                                            type="date"
                                                            value={formData.end_date}
                                                            onChange={e => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                                                            disabled={isPreviewMode}
                                                            className="w-full bg-transparent border-none p-0 text-xs font-bold text-gray-900 focus:ring-0"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Sesiones</span>
                                                <span className="text-sm font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">
                                                    {formData.activities_sequence.length}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-50 shadow-sm">
                                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 ml-1">Evaluación Sugerida</h3>
                                            <div className="flex flex-wrap gap-2">
                                                {['Rúbricas', 'Listas de cotejo', 'Portafolios', 'Diario', 'Boletos de salida'].map(inst => {
                                                    const isSelected = formData.evaluation_plan.instruments.includes(inst)
                                                    return (
                                                        <button
                                                            key={inst}
                                                            onClick={() => {
                                                                const current = formData.evaluation_plan.instruments
                                                                const newInst = isSelected ? current.filter(i => i !== inst) : [...current, inst]
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    evaluation_plan: { ...prev.evaluation_plan, instruments: newInst }
                                                                }))
                                                            }}
                                                            disabled={isPreviewMode}
                                                            className={`px - 3 py - 1.5 rounded - xl text - [9px] font - black uppercase transition - all duration - 300 border - 2
                                                                ${isSelected
                                                                    ? 'bg-amber-50 border-amber-500 text-amber-700'
                                                                    : 'bg-slate-50 border-transparent text-gray-400 hover:bg-gray-100'
                                                                } `}
                                                        >
                                                            {inst}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Columna Derecha: Generación y Secuencia */}
                                    <div className="lg:col-span-2 space-y-6">
                                        {!hasDecidedStrategy && formData.activities_sequence.length > 0 && !isPreviewMode ? (
                                            <div className="bg-indigo-600 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden group">
                                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl group-hover:bg-white/20 transition-all duration-700"></div>
                                                <div className="relative z-10">
                                                    <div className="flex items-center space-x-3 mb-4">
                                                        <Sparkles className="w-6 h-6 text-white" />
                                                        <span className="text-xs font-black uppercase tracking-[0.3em]">IA Estratégica</span>
                                                    </div>
                                                    <h3 className="text-3xl font-black mb-4 leading-tight">Genera tu Planeación</h3>
                                                    <p className="text-indigo-100 font-medium mb-8">
                                                        La IA usará tu Programa Analítico, Metodología y Libro de Texto para generar las actividades de las {formData.activities_sequence.length} sesiones.
                                                    </p>
                                                    <div className="flex flex-col sm:flex-row gap-4">
                                                        <button
                                                            onClick={generateAiSuggestions}
                                                            disabled={generating}
                                                            className="bg-white text-indigo-600 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center flex-1"
                                                        >
                                                            {generating ? 'Generando...' : 'Generar con Asistente IA'}
                                                        </button>
                                                        <button
                                                            onClick={() => setHasDecidedStrategy(true)}
                                                            className="bg-indigo-500/30 hover:bg-indigo-500/50 text-white border-2 border-white/20 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex-1"
                                                        >
                                                            Editar Manualmente
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-50 shadow-sm relative">
                                                <div className="flex items-center justify-between mb-8">
                                                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">Secuencia de Actividades</h3>
                                                    {formData.activities_sequence.length > 0 && !isPreviewMode && (
                                                        <button
                                                            onClick={() => setHasDecidedStrategy(false)}
                                                            className="text-[10px] font-black text-indigo-600 uppercase hover:underline"
                                                        >
                                                            Re-Generar con IA
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="space-y-6">
                                                    {formData.activities_sequence.length === 0 ? (
                                                        <div className="py-20 text-center">
                                                            <Clock className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                                            <p className="text-slate-400 font-bold text-sm">Carga el horario para comenzar.</p>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-4">
                                                            {formData.activities_sequence.slice(0, 3).map((session, idx) => (
                                                                <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border-2 border-transparent">
                                                                    <div className="flex items-center space-x-4">
                                                                        <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center font-black text-xs">
                                                                            {idx + 1}
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-[11px] font-black text-gray-900 uppercase mb-0.5">Sesión {idx + 1}</p>
                                                                            <p className="text-[10px] font-bold text-gray-400 uppercase">{new Date(session.date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center space-x-2">
                                                                        {session.phases.some((p: any) => p.activities.length > 0) ? (
                                                                            <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md uppercase">Listas</span>
                                                                        ) : (
                                                                            <span className="text-[8px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-md uppercase">Pendientes</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            {formData.activities_sequence.length > 3 && (
                                                                <div className="text-center">
                                                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">+ {formData.activities_sequence.length - 3} sesiones más</p>
                                                                </div>
                                                            )}
                                                            {!isPreviewMode && (
                                                                <button
                                                                    onClick={() => setStep(5)} // Hidden logic for detailed editing if needed, or we just let them go to preview
                                                                    className="w-full py-4 border-2 border-dashed border-slate-100 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-indigo-100 hover:text-indigo-400 transition-all"
                                                                >
                                                                    Ver todas las sesiones / Editar Detallado
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>)
                        }

                        {/* Navigation Footer */}
                        {
                            !isPreviewMode && (
                                <div className="flex justify-between items-center bg-gray-50 p-6 rounded-2xl border border-gray-100 mt-8 mb-8">
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={() => setStep(Math.max(1, step - 1))}
                                            disabled={step === 1}
                                            className={`flex items - center px - 6 py - 3 rounded - xl font - bold text - gray - 500 hover: bg - white hover: text - indigo - 600 transition - all ${step === 1 ? 'opacity-50 cursor-not-allowed' : ''} `}
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

                    </div >

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
                                            <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest">
                                                Páginas {formData.textbook_pages_from || '?'} a {formData.textbook_pages_to || '?'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        <a
                                            href={pdfViewerUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center space-x-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-black uppercase transition-all"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                            <span>Abrir en Nueva Pestaña</span>
                                        </a>
                                        <button
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
                        )
                    }

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
                </div >

                {/* AI Suggestions Modal */}
                {
                    isAiPanelOpen && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[120] flex items-end md:items-center justify-center p-0 md:p-4">
                            <div className="bg-white w-full md:max-w-2xl rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl border border-indigo-100 p-6 md:p-10 animate-in slide-in-from-bottom-10 md:zoom-in duration-300 overflow-hidden no-print flex flex-col h-[85vh] md:h-auto md:max-h-[95vh]">
                                <div className="flex justify-between items-center mb-8 shrink-0">
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

                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
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
                                                                style={{ animationDelay: `${idx * 150} ms` }}
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
                        </div>
                    )
                }

                {/* PDA Catalog Modal */}
                {
                    isPdaModalOpen && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-0 md:p-4">
                            <div className="bg-white rounded-t-[2.5rem] md:rounded-3xl w-full max-w-2xl shadow-2xl border border-indigo-100 overflow-hidden animate-in slide-in-from-bottom-10 md:fade-in md:zoom-in duration-300 flex flex-col h-[85vh] md:h-auto md:max-h-[95vh]">
                                <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-indigo-50/30 shrink-0">
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
                                <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
                                    {PDA_CATALOG[formData.campo_formativo]?.map((pdaOption) => {
                                        const isSelected = formData.pda.includes(pdaOption);
                                        return (
                                            <button
                                                key={pdaOption}
                                                onClick={() => {
                                                    setFormData(prev => {
                                                        const isSelected = prev.pda.includes(pdaOption)
                                                        if (isSelected) {
                                                            return { ...prev, pda: prev.pda.filter(p => p !== pdaOption) }
                                                        } else {
                                                            const currentPdAs = prev.pda.filter(p => p.trim() !== '')
                                                            return { ...prev, pda: [...currentPdAs, pdaOption] }
                                                        }
                                                    })
                                                }}
                                                className={`w - full text - left p - 4 rounded - 2xl border - 2 transition - all flex items - start group
                                            ${isSelected
                                                        ? 'bg-indigo-50 border-indigo-500 shadow-lg shadow-indigo-100/50'
                                                        : 'bg-white border-gray-50 hover:border-indigo-200 hover:bg-gray-50/50'
                                                    } `}
                                            >
                                                <div className={`w - 6 h - 6 rounded - lg flex items - center justify - center mr - 4 shrink - 0 mt - 0.5 border
                                            ${isSelected ? 'bg-indigo-500 border-indigo-600 text-white' : 'bg-white border-gray-200 text-transparent'} `}>
                                                    <CheckCircle2 className="w-4 h-4" />
                                                </div>
                                                <span className={`text - sm font - medium leading - relaxed ${isSelected ? 'text-indigo-900 font-bold' : 'text-gray-600'} `}>
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
                    )
                }

                {/* Resource Catalog Modal */}
                {
                    isResourceModalOpen && (
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-0 md:p-4">
                            <div className="bg-white rounded-t-[2.5rem] md:rounded-3xl w-full max-w-3xl shadow-2xl border border-emerald-100 overflow-hidden animate-in slide-in-from-bottom-10 md:fade-in md:zoom-in duration-300 flex flex-col h-[85vh] md:h-auto md:max-h-[95vh]">
                                <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-emerald-50/30 shrink-0">
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

                                <div className="flex-1 overflow-y-auto custom-scrollbar">
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

                                    {/* Note: the previous div was removed because we are wrapping everything in flex-1 overflow-y-auto */}
                                    <div className="p-8 pt-0">
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
                                                                            setFormData(prev => {
                                                                                const isResSelected = prev.resources.includes(item)
                                                                                if (isResSelected) {
                                                                                    return { ...prev, resources: prev.resources.filter(r => r !== item) }
                                                                                } else {
                                                                                    const currentResources = prev.resources.filter(r => r.trim() !== '')
                                                                                    return { ...prev, resources: [...currentResources, item] }
                                                                                }
                                                                            })
                                                                        }}
                                                                        className={`text - left p - 3 rounded - xl border - 2 transition - all flex items - center group
                                                                ${isSelected
                                                                                ? 'bg-emerald-50 border-emerald-500 shadow-sm shadow-emerald-100/50'
                                                                                : 'bg-white border-gray-50 hover:border-emerald-100 hover:bg-emerald-50/10'
                                                                            } `}
                                                                    >
                                                                        <div className={`w - 4 h - 4 rounded flex items - center justify - center mr - 3 shrink - 0 border
                                                                ${isSelected ? 'bg-emerald-500 border-emerald-600 text-white' : 'bg-white border-gray-200 text-transparent'} `}>
                                                                            <CheckCircle2 className="w-3 h-3" />
                                                                        </div>
                                                                        <span className={`text - [11px] font - bold leading - tight ${isSelected ? 'text-emerald-900' : 'text-gray-500'} `}>
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
                        </div>
                    )
                }
                {/* Error Modal */}
                {
                    errorModal.isOpen && (
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
                                    {errorModal.buttonText || 'Continuar'}
                                </button>
                            </div>
                        </div>
                    )
                }
                {/* Program Content Selector Modal */}
                {/* Program Content Selector Modal */}
                {
                    isProgramModalOpen && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[110] flex items-end md:items-center justify-center p-0 md:p-6">
                            <div className="bg-white rounded-t-[2.5rem] md:rounded-[2rem] w-full md:max-w-4xl shadow-2xl animate-in slide-in-from-bottom-10 md:fade-in md:zoom-in duration-300 h-[85vh] md:h-auto md:max-h-[85vh] overflow-hidden flex flex-col">
                                <div className="flex justify-between items-start mb-6 md:mb-8 p-6 md:p-10 pb-0 md:pb-0">
                                    <div className="flex items-center">
                                        <div className="w-12 h-12 md:w-14 md:h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mr-4 md:mr-5 shadow-xl shadow-indigo-100 shrink-0">
                                            <BookOpen className="w-6 h-6 md:w-7 md:h-7 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">Vincular Programa Analítico</h3>
                                            <p className="text-indigo-600 text-[10px] md:text-xs font-bold uppercase tracking-widest mt-1">Selecciona los contenidos contextualizados</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setIsProgramModalOpen(false)} className="bg-gray-50 p-2 rounded-xl text-gray-400 hover:text-gray-900 transition-colors">
                                        <Plus className="w-6 h-6 rotate-45" />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto px-6 md:px-10 py-4 space-y-4 custom-scrollbar">
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
                                            className="p-5 md:p-6 rounded-2xl border-2 border-gray-100 hover:border-indigo-500 hover:bg-indigo-50/30 transition-all cursor-pointer group"
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

                                <div className="p-6 md:p-10 pt-4 md:pt-6 border-t border-gray-100 flex justify-end">
                                    <button
                                        onClick={() => setIsProgramModalOpen(false)}
                                        className="w-full md:w-auto px-8 py-3 rounded-xl font-bold text-gray-400 hover:text-gray-900 transition-all bg-gray-50 md:bg-transparent"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Modal de Previsualización Imprimible */}
                {
                    isPreviewMode && (
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
                                            className={`px - 6 py - 2 rounded - xl font - black text - [10px] uppercase tracking - widest shadow - lg transition - all flex items - center ${profile?.is_demo ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'
                                                } `}
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
                                                        <div key={pIdx} className={`p - 3 ${pIdx < 2 ? 'border-r border-gray-200' : ''} `}>
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
                    )
                }
            </div >

            {/* Modal de Visor de PDF */}
            {isPdfViewerOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[300] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-6xl h-full rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-300">
                        {/* Header del Modal */}
                        <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-20">
                            <div className="flex items-center space-x-4">
                                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
                                    <BookOpen className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900 tracking-tight">Visor de Recurso</h3>
                                    <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-0.5">Consulta tu libro para seleccionar páginas</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsPdfViewerOpen(false)}
                                className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-2xl transition-all"
                            >
                                <Plus className="w-6 h-6 rotate-45" />
                            </button>
                        </div>

                        {/* Contenido del Visor */}
                        <div className="flex-1 bg-slate-800 relative">
                            <iframe
                                src={`${pdfViewerUrl} #toolbar = 1`}
                                className="w-full h-full border-none"
                                title="Visor de PDF"
                            />

                            {/* Overlay de Ayuda */}
                            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-white/90 backdrop-blur-md border border-slate-200 rounded-full shadow-2xl flex items-center space-x-4 pointer-events-none">
                                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                                <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
                                    Localiza las páginas que quieres usar y anótalas
                                </p>
                            </div>
                        </div>

                        {/* Footer del Modal (Botones Rápidos) */}
                        <div className="p-6 md:p-8 border-t border-slate-100 bg-gray-50/50 flex justify-end space-x-4">
                            <button
                                onClick={() => setIsPdfViewerOpen(false)}
                                className="px-8 py-3 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95"
                            >
                                Cerrar Visor
                            </button>
                            <button
                                onClick={() => {
                                    setIsPdfViewerOpen(false)
                                }}
                                className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95"
                            >
                                Listo, tengo mis páginas
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default PlanningEditorPage;
