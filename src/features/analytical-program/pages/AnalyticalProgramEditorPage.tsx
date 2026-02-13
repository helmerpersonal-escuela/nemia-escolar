import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { GroqService } from '../../../lib/groq'
import { useProfile } from '../../../hooks/useProfile'
import {
    Save,
    ArrowLeft,
    Sparkles,
    CheckCircle2,
    Layers,
    Plus,
    Trash2,
    Info,
    ChevronLeft,
    ChevronRight,
    MessageSquare,
    BookOpen,
    Search,
    BookMarked,
    Brain,
    Printer,
    FileText,
    AlertCircle,
    Layout,
    Clock,
    User,
    FileDown,
    X,
    LayoutDashboard,
    Shield
} from 'lucide-react'
import { ErrorModal } from '../../../components/common/ErrorModal'
import {
    EXTERNAL_CONTEXT_CATALOG,
    INTERNAL_CONTEXT_CATALOG,
    PROBLEM_SITUATIONS_CATALOG,
    INTEREST_TOPICS_CATALOG,
    GROUP_DIAGNOSIS_CATALOG
} from '../constants/nemCatalogs'
import { AIProposalManager } from '../components/AIProposalManager'
import { PDFUpload } from '../../../components/common/PDFUpload'
// Constants derived from NEM
const CAMPOS = [
    { id: 'lenguajes', name: 'Lenguajes', color: 'bg-orange-50 text-orange-700 border-orange-200' },
    { id: 'saberes', name: 'Saberes y Pensamiento Científico', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { id: 'etica', name: 'Ética, Naturaleza y Sociedades', color: 'bg-green-50 text-green-700 border-green-200' },
    { id: 'humano', name: 'De lo Humano y lo Comunitario', color: 'bg-rose-50 text-rose-700 border-rose-200' }
]

const STRATEGIES_MET = [
    'Aprendizaje Basado en Proyectos Comunitarios',
    'Enfoque STEAM',
    'Aprendizaje Basado en Problemas',
    'Aprendizaje en el Servicio',
    'Tutorías-Comunidades de aprendizaje'
]

const EVALUATION_INSTRUMENTS = [
    'Rúbricas',
    'Diario de clase',
    'Guía de observación',
    'Escala de actitudes',
    'Registro anecdótico',
    'Portafolio de evidencias',
    'Cuaderno del alumno',
    'Grupos de discusión',
    'Debates'
]

const NATIONAL_STRATEGIES = [
    { id: 'lectura', name: 'Estrategia Nacional de Lectura' },
    { id: 'inclusiva', name: 'Estrategia Nacional de Educación Inclusiva' },
    { id: 'multilingue', name: 'Estrategia Nacional de Educación Multilingüe e Intercultural' },
    { id: 'genero', name: 'Estrategia Nacional para la Igualdad de Género' }
]

const NIVELES_CATALOG = ['PREESCOLAR', 'PRIMARIA', 'SECUNDARIA', 'TELESECUNDARIA']
const MODALIDADES_CATALOG = ['GENERAL', 'INDÍGENA', 'TÉCNICA', 'TELESECUNDARIA']
const SOSTENIMIENTO_CATALOG = ['FEDERAL', 'ESTATAL', 'PARTICULAR']
const TURNOS_CATALOG = ['MATUTINO', 'VESPERTINO', 'NOCTURNO', 'TIEMPO COMPLETO']
const ESTADOS_CATALOG = [
    'AGUASCALIENTES', 'BAJA CALIFORNIA', 'BAJA CALIFORNIA SUR', 'CAMPECHE', 'CHIAPAS', 'CHIHUAHUA', 'CIUDAD DE MÉXICO', 'COAHUILA',
    'COLIMA', 'DURANGO', 'ESTADO DE MÉXICO', 'GUANAJUATO', 'GUERRERO', 'HIDALGO', 'JALISCO', 'MICHOACÁN', 'MORELOS', 'NAYARIT',
    'NUEVO LEÓN', 'OAXACA', 'PUEBLA', 'QUERÉTARO', 'QUINTANA ROO', 'SAN LUIS POTOSÍ', 'SINALOA', 'SONORA', 'TABASCO',
    'TAMAULIPAS', 'TLAXCALA', 'VERACRUZ', 'YUCATÁN', 'ZACATECAS'
]

const getPhase = (level: string, grades: string): number => {
    const lvl = level.toUpperCase()
    if (lvl === 'INICIAL') return 1
    if (lvl === 'PREESCOLAR') return 2
    if (lvl === 'SECUNDARIA' || lvl === 'TELESECUNDARIA') return 6

    // Primaria
    if (grades.includes('1') || grades.includes('2')) return 3
    if (grades.includes('3') || grades.includes('4')) return 4
    if (grades.includes('5') || grades.includes('6')) return 5

    return 3 // Default Primaria
}

export const AnalyticalProgramEditorPage = () => {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { profile } = useProfile()
    const { data: tenant } = useTenant()
    const isIndependent = tenant?.type === 'INDEPENDENT'
    const isDirectorOrAdmin = ['DIRECTOR', 'ADMIN', 'INDEPENDENT_TEACHER'].includes(profile?.role || '') || isIndependent
    const isReadOnly = (!isDirectorOrAdmin && id !== 'new') || profile?.is_demo

    // Service Instance
    const groqService = useMemo(() => new GroqService((tenant as any)?.groqApiKey || ''), [(tenant as any)?.groqApiKey])

    // UI State
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    // Form Data
    const [formData, setFormData] = useState({
        academic_year_id: '',
        diagnosis_narrative: '',
        problems: [] as { id: string, description: string }[],
        contents: [] as any[],
        last_cte_session: '',
        status: 'DRAFT',

        // New NEM Format Fields
        school_data: {
            name: '',
            cct: '',
            level: 'Primaria',
            modality: 'General',
            support: 'Federal',
            grades: '',
            shift: 'Matutino',
            state: 'Guanajuato',
            municipality: '',
            location: '',
            total_students: '',
            total_groups: '',
            avg_students_per_group: '',
            total_teachers: '',
            group_students_info: ''
        },
        external_context: {
            favors: '',
            difficults: ''
        },
        internal_context: {
            favors: '',
            difficults: ''
        },
        group_diagnosis: {
            narrative: '',
            problem_situations: [] as string[],
            interest_topics: [] as string[]
        },
        pedagogical_strategies: [] as string[],
        evaluation_strategies: {
            description: '',
            instruments: [] as string[],
            feedback_guidelines: [] as string[]
        },
        national_strategies: [] as { name: string, description: string }[],
        program_by_fields: {
            lenguajes: [] as any[],
            saberes: [] as any[],
            etica: [] as any[],
            humano: [] as any[]
        },
        source_document_url: '',
        extracted_text: ''
    })

    const [isSyntheticModalOpen, setIsSyntheticModalOpen] = useState(false)
    const [isAIProposalManagerOpen, setIsAIProposalManagerOpen] = useState(false)
    const [syntheticSearch, setSyntheticSearch] = useState('')
    const [editingContentIdx, setEditingContentIdx] = useState<number | null>(null)

    const [errorModal, setErrorModal] = useState<{
        isOpen: boolean
        title: string
        message: string
        details?: string
    }>({
        isOpen: false,
        title: '',
        message: ''
    })

    const [subjectsCatalog, setSubjectsCatalog] = useState<any[]>([])
    const [syntheticCatalog, setSyntheticCatalog] = useState<any[]>([])
    const [cycles, setCycles] = useState<any[]>([])

    const currentPhase = getPhase(formData.school_data.level, formData.school_data.grades)

    useEffect(() => {
        const fetchSynthetic = async () => {
            const { data } = await supabase
                .from('synthetic_program_contents')
                .select('*')
                .eq('phase', currentPhase)

            if (data) setSyntheticCatalog(data)
        }
        fetchSynthetic()
    }, [currentPhase])

    // Persistence: Save to localStorage
    useEffect(() => {
        const draftId = id || 'new'
        const draft = { formData, step, timestamp: new Date().getTime() }
        localStorage.setItem(`ap_draft_${draftId}`, JSON.stringify(draft))
    }, [formData, step, id])

    useEffect(() => {
        if (!tenant) return
        const fetchData = async () => {
            if (!id || id === 'undefined' || id.includes('undefined')) {
                console.log('Initializing NEW program mode (skipped redundant fetch)')
                // We still need to load catalogs for NEW mode
            } else {
                setLoading(true)
                console.log('Fetching data for ID:', id)
            }

            // Parallel fetch for basic catalogs and config
            const [catRes, cyclesRes, schoolRes, profileSubjectsRes] = await Promise.all([
                supabase.from('subject_catalog').select('*').order('name'),
                supabase.from('academic_years').select('id, name').eq('tenant_id', tenant.id).order('name', { ascending: false }),
                supabase.from('school_details').select('*').eq('tenant_id', tenant.id).maybeSingle(),
                profile ? supabase.from('profile_subjects').select('*, subject_catalog(*)').eq('profile_id', profile.id) : Promise.resolve({ data: null })
            ])

            // Handle Subjects Catalog (Merge with profile subjects if available)
            if (catRes.data) {
                const uniqueSubjects = catRes.data.reduce((acc: any[], curr: any) => {
                    if (!acc.find(s => s.name === curr.name)) {
                        acc.push(curr)
                    }
                    return acc
                }, [])

                // If user has custom subjects, we can prioritize them
                const userSubjects = profileSubjectsRes.data?.map((ps: any) => ({
                    ...ps.subject_catalog,
                    id: ps.subject_catalog_id, // Use the catalog ID for consistency
                    custom_detail: ps.custom_detail
                })) || []

                // Merge: User subjects first, then the rest
                const mergedSubjects = [...userSubjects]
                uniqueSubjects.forEach(s => {
                    if (!mergedSubjects.find(us => us.name === s.name)) {
                        mergedSubjects.push(s)
                    }
                })

                setSubjectsCatalog(mergedSubjects)
            }

            if (cyclesRes.data) setCycles(cyclesRes.data)

            const schoolDetails = schoolRes.data

            const isNew = !id || id === 'new' || id === 'undefined' || id.includes('undefined')

            if (isNew) {
                console.log('Initializing NEW program mode')
                // Pre-fill school data from tenant and aggregation
                const levelMap: Record<string, string> = {
                    'PRESCHOOL': 'Preescolar',
                    'PRIMARY': 'Primaria',
                    'SECONDARY': 'Secundaria',
                    'HIGH_SCHOOL': 'Bachillerato',
                    'UNIVERSIDAD': 'Universidad',
                    'UNIVERSITY': 'Universidad',
                    'PREESCOLAR': 'Preescolar',
                    'PRIMARIA': 'Primaria',
                    'SECUNDARIA': 'Secundaria',
                    'TELESECUNDARIA': 'Telesecundaria',
                    'BACHILLERATO': 'Bachillerato',
                    'INICIAL': 'Inicial'
                }

                const educationalLevel = schoolDetails?.educational_level || tenant.educationalLevel as string || ''
                const mappedLevel = levelMap[educationalLevel.toUpperCase()] || educationalLevel || 'Primaria'

                // Default cycle to the newest one if available
                const defaultCycle = cyclesRes.data && cyclesRes.data.length > 0 ? cyclesRes.data[0].id : ''

                // Parallel fetch for aggregation data
                const [groupsRes, profilesRes] = await Promise.all([
                    supabase.from('groups').select('grade, section, students(count)').eq('tenant_id', tenant.id),
                    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('role', 'TEACHER')
                ])

                const groups = groupsRes.data || []
                const teacherCount = profilesRes.count || 0

                const totalStudents = groups.reduce((acc, g: any) => acc + (g.students?.[0]?.count || 0), 0)
                const totalGroups = groups.length
                const avgStudents = totalGroups > 0 ? Math.round(totalStudents / totalGroups) : 0
                const groupInfo = groups.map((g: any) => `${g.grade}°${g.section} (${g.students?.[0]?.count || 0})`).join(', ')

                setFormData(prev => ({
                    ...prev,
                    academic_year_id: defaultCycle,
                    school_data: {
                        ...prev.school_data,
                        name: schoolDetails?.official_name || tenant.name || '',
                        cct: schoolDetails?.cct || tenant.cct || '',
                        level: mappedLevel,
                        modality: schoolDetails?.educational_level || prev.school_data.modality,
                        support: schoolDetails?.regime || prev.school_data.support,
                        shift: schoolDetails?.shift === 'MORNING' ? 'Matutino' :
                            schoolDetails?.shift === 'AFTERNOON' ? 'Vespertino' :
                                schoolDetails?.shift === 'FULL_TIME' ? 'Tiempo Completo' :
                                    prev.school_data.shift,
                        state: schoolDetails?.address_state || prev.school_data.state,
                        municipality: schoolDetails?.address_municipality || '',
                        location: schoolDetails?.address_neighborhood || '',
                        total_students: totalStudents.toString(),
                        total_groups: totalGroups.toString(),
                        avg_students_per_group: avgStudents.toString(),
                        total_teachers: teacherCount.toString(),
                        group_students_info: groupInfo
                    }
                }))
            } else {
                console.log('Loading EXISTING program (Split Queries):', id)

                // 1. Fetch Program Metadata
                const { data: program, error: progError } = await supabase
                    .from('analytical_programs')
                    .select('*')
                    .eq('id', id)
                    .maybeSingle()

                if (progError) {
                    console.error('Error fetching program metadata:', progError)
                }

                // 2. Fetch Contents separately to avoid 400 relationship error
                const { data: contents, error: contError } = await supabase
                    .from('analytical_program_contents')
                    .select('*')
                    .eq('program_id', id)

                if (contError) {
                    console.error('Error fetching program contents:', contError)
                }

                if (program) {
                    console.log('Program loaded:', program)
                    console.log('Contents loaded:', contents)

                    const dbData = {
                        academic_year_id: program.academic_year_id || '',
                        diagnosis_narrative: program.diagnosis_narrative || '',
                        problems: program.problem_statements || [],
                        contents: contents || [],
                        last_cte_session: program.last_cte_session || '',
                        status: program.status,
                        school_data: program.school_data || formData.school_data,
                        external_context: program.external_context || formData.external_context,
                        internal_context: program.internal_context || formData.internal_context,
                        group_diagnosis: program.group_diagnosis || formData.group_diagnosis,
                        pedagogical_strategies: program.pedagogical_strategies || formData.pedagogical_strategies,
                        evaluation_strategies: program.evaluation_strategies || formData.evaluation_strategies,
                        national_strategies: program.national_strategies || formData.national_strategies,
                        program_by_fields: program.program_by_fields || {
                            lenguajes: [],
                            saberes: [],
                            etica: [],
                            humano: []
                        },
                        source_document_url: program.source_document_url || '',
                        extracted_text: program.extracted_text || ''
                    }

                    // Check for local draft
                    const localDraft = localStorage.getItem(`ap_draft_${id}`)
                    if (localDraft) {
                        try {
                            const parsed = JSON.parse(localDraft)
                            // Only restore if it's RECENT (e.g. within last 24h) and user confirms or we just do it
                            // For simplicity and to solve the user's immediate "minimize" problem, 
                            // we restore if it exists and hasn't been cleared.
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
                } else {
                    console.warn('Program not found for ID:', id)
                }
            }

            // After loading DB data for NEW mode, ALSO check for draft
            if (isNew) {
                const localDraft = localStorage.getItem('ap_draft_new')
                if (localDraft) {
                    try {
                        const parsed = JSON.parse(localDraft)
                        setFormData(parsed.formData)
                        setStep(parsed.step)
                        console.log('Restored NEW program draft from local storage')
                    } catch (e) {
                        console.error('Error parsing local draft:', e)
                    }
                }
            }

            setLoading(false)
        }
        fetchData()
    }, [tenant?.id, id])

    const cleanUuid = (id: any) => {
        if (!id) return null
        if (typeof id === 'string') {
            if (id === 'undefined' || id === 'null' || id.trim() === '') return null
        }
        return id
    }



    const validateStep = (s: number) => {
        const errors: string[] = []

        if (s === 1) {
            if (!formData.academic_year_id) errors.push('Ciclo Escolar')
            if (!formData.school_data.name) errors.push('Nombre de la Escuela')
            if (!formData.school_data.cct) errors.push('CCT')
            if (!formData.school_data.level) errors.push('Nivel')
            if (!formData.school_data.modality) errors.push('Modalidad')
            if (!formData.school_data.support) errors.push('Sostenimiento')
            if (!formData.school_data.shift) errors.push('Turno')
            if (!formData.school_data.state) errors.push('Estado')
            if (!formData.school_data.municipality) errors.push('Municipio')
            if (!formData.school_data.location) errors.push('Localidad')
            if (!formData.school_data.total_teachers) errors.push('No. Docentes')
            if (!formData.school_data.group_students_info) errors.push('Alumnos del Grupo')

            if (!formData.external_context.favors) errors.push('Contexto Externo (Favorecen)')
            if (!formData.external_context.difficults) errors.push('Contexto Externo (Dificultan)')
            if (!formData.internal_context.favors) errors.push('Contexto Interno (Favorecen)')
            if (!formData.internal_context.difficults) errors.push('Contexto Interno (Dificultan)')
        }

        if (s === 2) {
            if (!formData.group_diagnosis.narrative || formData.group_diagnosis.narrative.length < 50) {
                errors.push('Narrativa Pedagógica (mínimo 50 caracteres)')
            }
            if (formData.group_diagnosis.problem_situations.filter(p => p.trim()).length === 0) {
                errors.push('Al menos una Situación-Problema')
            }
            if (formData.group_diagnosis.interest_topics.filter(t => t.trim()).length === 0) {
                errors.push('Al menos un Tema de Interés')
            }
        }

        if (s === 3) {
            if (formData.contents.length === 0) {
                errors.push('Al menos un Contenido para la Contextualización')
            } else {
                formData.contents.forEach((c, i) => {
                    if (!c.subject_id) errors.push(`Asignatura en el contenido ${i + 1} `)
                    if (!c.campo_formativo) errors.push(`Campo Formativo en el contenido ${i + 1} `)
                    if (!c.temporality) errors.push(`Temporalidad en el contenido ${i + 1} `)
                    if (!c.custom_content) errors.push(`Contenido / Codiseño en el contenido ${i + 1} `)
                })
            }
        }

        if (s === 4) {
            if (formData.pedagogical_strategies.length === 0) errors.push('Al menos una Metodología Sociocrítica')
            if (formData.evaluation_strategies.instruments.length === 0) errors.push('Al menos un Instrumento de Evaluación')
            if (!formData.evaluation_strategies.description) errors.push('Pautas para la retroalimentación')
            if (formData.national_strategies.length === 0) {
                errors.push('Al menos una Estrategia Nacional')
            } else {
                formData.national_strategies.forEach((s) => {
                    if (!s.description) errors.push(`Descripción para la estrategia: ${s.name} `)
                })
            }
        }

        if (errors.length > 0) {
            setErrorModal({
                isOpen: true,
                title: 'Campos Obligatorios Faltantes',
                message: 'Para generar un Programa Analítico eficiente, por favor completa los siguientes campos:',
                details: errors.join('\n • ')
            })
            return false
        }

        return true
    }

    const handleSave = async (redirect = true) => {
        // Enforce validation on save too
        for (let i = 1; i <= 4; i++) {
            if (!validateStep(i)) {
                setStep(i)
                return null
            }
        }
        if (profile?.is_demo) {
            alert('Modo Demo: El guardado de programas analíticos está deshabilitado.')
            return null
        }
        setSaving(true)
        try {
            let academicYearId = cleanUuid(formData.academic_year_id)
            if (!academicYearId) {
                // Try to find the active cycle if not selected
                const { data: ayData } = await supabase
                    .from('academic_years')
                    .select('id')
                    .eq('tenant_id', tenant?.id)
                    .eq('is_active', true)
                    .maybeSingle()

                if (ayData) academicYearId = ayData.id
            }

            if (!academicYearId) {
                throw new Error('Debes seleccionar un Ciclo Escolar válido para guardar el programa.')
            }

            const cleanTenantId = cleanUuid(tenant?.id)
            if (!cleanTenantId) throw new Error('No se ha detectado una sesión válida. Recarga la página.')

            const programData = {
                tenant_id: cleanTenantId,
                academic_year_id: academicYearId,
                diagnosis_narrative: formData.diagnosis_narrative,
                problem_statements: formData.problems,
                last_cte_session: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                status: 'ACTIVE',
                school_data: formData.school_data,
                external_context: formData.external_context,
                internal_context: formData.internal_context,
                group_diagnosis: formData.group_diagnosis,
                pedagogical_strategies: formData.pedagogical_strategies,
                evaluation_strategies: formData.evaluation_strategies,
                national_strategies: formData.national_strategies,
                program_by_fields: formData.program_by_fields,
                source_document_url: formData.source_document_url,
                extracted_text: formData.extracted_text
            }

            let programId = id
            // Safely handle 'undefined' string or null in URL params
            const isNew = !id || id === 'new' || id === 'undefined' || id.includes('undefined')

            if (isNew) {
                const { data, error: insertError } = await supabase.from('analytical_programs').insert([programData]).select().single()

                // Fallback for INSERT if column missing
                if (insertError && (insertError.code === 'PGRST204' || insertError.message?.includes('program_by_fields'))) {
                    console.warn('Fallback: inserting without program_by_fields column')
                    const { program_by_fields, ...safeData } = programData
                    const { data: retryData, error: retryError } = await supabase.from('analytical_programs').insert([safeData]).select().single()
                    if (retryError) throw retryError
                    programId = retryData.id
                } else if (insertError) {
                    throw insertError
                } else {
                    programId = data.id
                }

                window.history.replaceState(null, '', `/analytical-program/${programId}`)
            } else {
                const { error } = await supabase.from('analytical_programs').update(programData).eq('id', id)

                // Fallback: If column 'program_by_fields' does not exist yet (400)
                if (error && error.code === 'PGRST204' || (error && error.message?.includes('program_by_fields'))) {
                    console.warn('Fallback: saving without program_by_fields column')
                    const { program_by_fields, ...safeData } = programData
                    const { error: retryError } = await supabase.from('analytical_programs').update(safeData).eq('id', id)
                    if (retryError) throw retryError
                } else if (error) {
                    throw error
                }
            }

            // Save contents sanitized
            await supabase.from('analytical_program_contents').delete().eq('program_id', programId)

            if (formData.contents.length > 0) {
                const contentsToInsert = formData.contents.map(c => ({
                    program_id: cleanUuid(programId), // Ensure programId is clean
                    subject_id: cleanUuid(c.subject_id),
                    campo_formativo: c.campo_formativo,
                    content_id: cleanUuid(c.content_id),
                    custom_content: c.custom_content,
                    temporality: c.temporality || '',
                    pda_ids: c.pda_ids || [],
                    justification: c.justification || '',
                    ejes_articuladores: c.ejes_articuladores || []
                }))

                const { error: contentError } = await supabase.from('analytical_program_contents').insert(contentsToInsert)
                if (contentError) throw contentError
            }

            // Success: Clear Persistence
            localStorage.removeItem(`ap_draft_${id || 'new'}`)
            localStorage.removeItem(`ap_draft_${programId}`) // Also clear with the new real ID

            if (redirect) navigate('/analytical-program')
            return programId
        } catch (error: any) {
            console.error(error)
            setErrorModal({
                isOpen: true,
                title: 'Error al Guardar',
                message: 'No se pudo guardar el Programa Analítico.',
                details: error.message || 'Verifica que hayas seleccionado un Ciclo Escolar.'
            })
            return null
        } finally {
            setSaving(false)
        }
    }





    const [searchParams] = useSearchParams()
    const isPrintViewFromUrl = searchParams.get('print') === 'true'
    const [isPrintView, setIsPrintView] = useState(false)

    useEffect(() => {
        setIsPrintView(isPrintViewFromUrl)
    }, [isPrintViewFromUrl])

    if (loading) return <div className="p-20 text-center animate-pulse text-gray-400 font-bold uppercase tracking-widest italic">Cargando editor inteligente...</div>

    if (isPrintView) {
        return (
            <div className="bg-white p-12 max-w-5xl mx-auto print:p-0 text-gray-900">
                {/* Header Impresión */}
                <div className="border-2 border-black p-4 mb-8 bg-gray-50">
                    <div className="flex justify-between items-center mb-4">
                        <div className="w-24 h-24 flex items-center justify-center">
                            {(tenant as any)?.logoLeftUrl && <img src={(tenant as any).logoLeftUrl} alt="Logo Izquierdo" className="max-w-full max-h-full object-contain" />}
                        </div>
                        <div className="text-center flex-1 px-4">
                            <h1 className="text-2xl font-black uppercase mb-1 leading-tight">Programa Analítico (NEM)</h1>
                            <p className="text-sm font-bold uppercase tracking-widest">
                                {formData.school_data.name || tenant?.name} • {cycles.find(c => c.id === formData.academic_year_id)?.name || 'Ciclo Escolar'}
                            </p>
                        </div>
                        <div className="w-24 h-24 flex items-center justify-center">
                            {(tenant as any)?.logoRightUrl && <img src={(tenant as any).logoRightUrl} alt="Logo Derecho" className="max-w-full max-h-full object-contain" />}
                        </div>
                    </div>
                    <div className="flex justify-center space-x-8 mt-2 text-[10px] font-black uppercase text-gray-500 border-t border-gray-300 pt-2">
                        <span>CCT: {formData.school_data.cct}</span>
                        <span>Grados: {formData.school_data.grades}</span>
                        <span>Turno: {formData.school_data.shift}</span>
                    </div>
                </div>

                {/* 1. Contexto Socioeducativo */}
                <section className="mb-10 page-break-after-avoid">
                    <h2 className="text-sm font-black bg-black text-white px-4 py-2 uppercase mb-4">1. Contexto Socioeducativo de la Escuela</h2>

                    <div className="grid grid-cols-2 gap-px bg-black border border-black text-[10px] mb-6">
                        <div className="bg-white p-2"><strong>Nombre:</strong> {formData.school_data.name}</div>
                        <div className="bg-white p-2"><strong>CCT:</strong> {formData.school_data.cct}</div>
                        <div className="bg-white p-2"><strong>Nivel:</strong> {formData.school_data.level}</div>
                        <div className="bg-white p-2"><strong>Modalidad:</strong> {formData.school_data.modality}</div>
                        <div className="bg-white p-2"><strong>Sostenimiento:</strong> {formData.school_data.support}</div>
                        <div className="bg-white p-2"><strong>Grados:</strong> {formData.school_data.grades}</div>
                        <div className="bg-white p-2"><strong>Turno:</strong> {formData.school_data.shift}</div>
                        <div className="bg-white p-2"><strong>Estado:</strong> {formData.school_data.state}</div>
                        <div className="bg-white p-2"><strong>Municipio:</strong> {formData.school_data.municipality}</div>
                        <div className="bg-white p-2"><strong>Localidad:</strong> {formData.school_data.location}</div>
                        <div className="bg-white p-2"><strong>Docentes:</strong> {formData.school_data.total_teachers}</div>
                        <div className="bg-white p-2"><strong>Alumnos del grupo:</strong> {formData.school_data.group_students_info}</div>
                    </div>

                    <h3 className="text-[11px] font-black uppercase mb-3 text-gray-700">1.2 Análisis del Contexto Externo</h3>
                    <div className="grid grid-cols-2 gap-6 mb-6">
                        <div className="border border-gray-200 p-4 rounded-lg bg-green-50/20">
                            <h4 className="text-[9px] font-black uppercase text-green-700 mb-2">Favorecen el Aprendizaje</h4>
                            <p className="text-[10px] leading-relaxed whitespace-pre-wrap">{formData.external_context.favors}</p>
                        </div>
                        <div className="border border-gray-200 p-4 rounded-lg bg-rose-50/20">
                            <h4 className="text-[9px] font-black uppercase text-rose-700 mb-2">Dificultan el Aprendizaje</h4>
                            <p className="text-[10px] leading-relaxed whitespace-pre-wrap">{formData.external_context.difficults}</p>
                        </div>
                    </div>

                    <h3 className="text-[11px] font-black uppercase mb-3 text-gray-700">1.3 Análisis del Contexto Interno</h3>
                    <div className="grid grid-cols-2 gap-6 mb-6">
                        <div className="border border-gray-200 p-4 rounded-lg bg-green-50/20">
                            <h4 className="text-[9px] font-black uppercase text-green-700 mb-2">Favorecen el Aprendizaje</h4>
                            <p className="text-[10px] leading-relaxed whitespace-pre-wrap">{formData.internal_context.favors}</p>
                        </div>
                        <div className="border border-gray-200 p-4 rounded-lg bg-rose-50/20">
                            <h4 className="text-[9px] font-black uppercase text-rose-700 mb-2">Dificultan el Aprendizaje</h4>
                            <p className="text-[10px] leading-relaxed whitespace-pre-wrap">{formData.internal_context.difficults}</p>
                        </div>
                    </div>
                </section>

                {/* 2. Diagnóstico del Grupo */}
                <section className="mb-10 page-break-after-avoid">
                    <h2 className="text-sm font-black bg-black text-white px-4 py-2 uppercase mb-4">2. Diagnóstico del Grupo</h2>
                    <div className="border-l-4 border-gray-200 pl-4 py-2 mb-6">
                        <p className="text-[11px] leading-relaxed italic text-gray-700 whitespace-pre-wrap">{formData.group_diagnosis.narrative}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <h3 className="text-[10px] font-black uppercase mb-3 flex items-center">
                                <span className="w-1.5 h-1.5 bg-rose-500 rounded-full mr-2"></span>
                                Situaciones-problema
                            </h3>
                            <ul className="space-y-2">
                                {formData.group_diagnosis.problem_situations.map((p, i) => (
                                    <li key={i} className="text-[10px] p-2 bg-gray-50 border border-gray-100 rounded-md">• {p}</li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h3 className="text-[10px] font-black uppercase mb-3 flex items-center">
                                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-2"></span>
                                Temas de interés
                            </h3>
                            <ul className="space-y-2">
                                {formData.group_diagnosis.interest_topics.map((t, i) => (
                                    <li key={i} className="text-[10px] p-2 bg-gray-50 border border-gray-100 rounded-md">• {t}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>

                {/* 3. Propuesta Didáctica (Fase 6) - Generado por IA */}
                <section className="mb-10 page-break-after-avoid">
                    <h2 className="text-sm font-black bg-black text-white px-4 py-2 uppercase mb-4">3. Propuesta Didáctica (Fase {currentPhase})</h2>

                    {Object.keys(formData.program_by_fields).some(k => formData.program_by_fields[k as keyof typeof formData.program_by_fields].length > 0) ? (
                        <div className="space-y-8">
                            {CAMPOS.map(campo => {
                                const items = formData.program_by_fields[campo.id as keyof typeof formData.program_by_fields] || []
                                if (items.length === 0) return null

                                return (
                                    <div key={campo.id} className="avoid-break-inside">
                                        <h3 className={`text-[10px] font-black uppercase p-2 border-l-4 mb-2 ${campo.color}`}>{campo.name}</h3>
                                        <table className="w-full border-collapse border border-gray-300">
                                            <thead>
                                                <tr className="bg-gray-100 text-[9px] uppercase font-black">
                                                    <th className="border border-gray-300 p-1.5 text-left w-1/5">Contenidos (Sintético)</th>
                                                    <th className="border border-gray-300 p-1.5 text-left w-1/4">Procesos de Desarrollo de Aprendizaje (PDA)</th>
                                                    <th className="border border-gray-300 p-1.5 text-left w-1/6">Problemática / Interés</th>
                                                    <th className="border border-gray-300 p-1.5 text-left w-1/6">Ejes Articuladores</th>
                                                    <th className="border border-gray-300 p-1.5 text-left">Orientaciones Didácticas</th>
                                                    <th className="border border-gray-300 p-1.5 text-center w-12">Días</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-[9px]">
                                                {items.map((item: any, idx: number) => (
                                                    <tr key={idx}>
                                                        <td className="border border-gray-300 p-2 align-top">
                                                            {typeof item.content === 'object' ? JSON.stringify(item.content) : (item.content || 'Sin contenido')}
                                                        </td>
                                                        <td className="border border-gray-300 p-2 align-top italic text-gray-700">
                                                            {typeof item.pda === 'object' ? JSON.stringify(item.pda) : (item.pda || '')}
                                                        </td>
                                                        <td className="border border-gray-300 p-2 align-top text-red-700 font-bold">
                                                            {typeof item.problem === 'object' ? JSON.stringify(item.problem) : (item.problem || '')}
                                                        </td>
                                                        <td className="border border-gray-300 p-2 align-top">
                                                            <div className="flex flex-wrap gap-1">
                                                                {Array.isArray(item.axes) ? item.axes.map((ax: any, i: number) => (
                                                                    <span key={i} className="inline-block bg-gray-50 border border-gray-200 px-1 rounded">
                                                                        {typeof ax === 'object' ? JSON.stringify(ax) : ax}
                                                                    </span>
                                                                )) : <span className="text-gray-400 italic">No asignados</span>}
                                                            </div>
                                                        </td>
                                                        <td className="border border-gray-300 p-2 align-top text-gray-600">
                                                            {typeof item.guidelines === 'object' ? JSON.stringify(item.guidelines) : (item.guidelines || '')}
                                                        </td>
                                                        <td className="border border-gray-300 p-2 align-top text-center font-black">{item.duration || '10'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <p className="text-[10px] text-gray-400 italic text-center p-4 border border-dashed border-gray-300 rounded">
                            No se ha generado una propuesta estructurada con IA para esta sección.
                        </p>
                    )}
                </section>

                {/* 4. Contextualización y Codiseño (Manual) */}
                <section className="mb-10">
                    <h2 className="text-sm font-black bg-black text-white px-4 py-2 uppercase mb-4">4. Contextualización y Codiseño (Adicional)</h2>
                    {CAMPOS.map(campo => {
                        const campoContents = formData.contents.filter(c => c.campo_formativo === campo.name)
                        if (campoContents.length === 0) return null
                        return (
                            <div key={campo.id} className="mb-6 last:mb-0">
                                <h3 className={`text-[10px] font-black uppercase p-2 border-l-4 mb-2 ${campo.color}`}>{campo.name}</h3>
                                <table className="w-full border-collapse border border-gray-300">
                                    <thead>
                                        <tr className="bg-gray-100 text-[9px] uppercase font-black">
                                            <th className="border border-gray-300 p-2 text-left w-1/4">Disciplina</th>
                                            <th className="border border-gray-300 p-2 text-left">Contenido Contextualizado / Codiseño</th>
                                            <th className="border border-gray-300 p-2 text-center w-24">Tiempo</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-[10px]">
                                        {campoContents.map((c, i) => (
                                            <tr key={i}>
                                                <td className="border border-gray-300 p-2 font-bold">{subjectsCatalog.find(s => s.id === c.subject_id)?.name || 'Materia'}</td>
                                                <td className="border border-gray-300 p-2 italic leading-relaxed text-gray-700">{c.custom_content}</td>
                                                <td className="border border-gray-300 p-2 text-center font-black uppercase">{c.temporality}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    })}
                </section>

                {/* 4. Estrategias */}
                <section className="mb-10 grid grid-cols-2 gap-8 page-break-before-auto">
                    <div>
                        <h2 className="text-sm font-black bg-black text-white px-4 py-2 uppercase mb-4">4. Estrategias Metodológicas</h2>
                        <ul className="space-y-1">
                            {formData.pedagogical_strategies.map((s, i) => (
                                <li key={i} className="text-[10px] flex items-center p-2 border border-gray-100 rounded-md">
                                    <span className="w-1 h-1 bg-black rounded-full mr-2"></span>
                                    {s}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <h2 className="text-sm font-black bg-black text-white px-4 py-2 uppercase mb-4">5. Estrategias de Evaluación</h2>
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-[9px] font-black uppercase text-gray-400 mb-2">Instrumentos a emplear:</h4>
                                <div className="flex flex-wrap gap-2">
                                    {formData.evaluation_strategies.instruments.map((ins, i) => (
                                        <span key={i} className="text-[9px] px-2 py-1 bg-gray-50 border border-gray-200 rounded-md">{ins}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 6. Estrategias Nacionales */}
                <section className="mb-10">
                    <h2 className="text-sm font-black bg-black text-white px-4 py-2 uppercase mb-4">6. Estrategias Nacionales a Incorporar</h2>
                    <div className="space-y-3">
                        {formData.national_strategies.map((s, i) => (
                            <div key={i} className="p-4 border border-gray-200 rounded-lg bg-gray-50/30">
                                <h4 className="text-[10px] font-black uppercase mb-1">{s.name}</h4>
                                <p className="text-[10px] leading-relaxed text-gray-600">{s.description}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Footer Navegación */}
                <div className="fixed bottom-8 right-8 print:hidden flex space-x-4">
                    <button
                        onClick={() => navigate(`/analytical-program/${id}`)}
                        className="bg-white text-gray-700 border-2 border-gray-200 px-8 py-3 rounded-2xl font-bold shadow-lg hover:bg-gray-50 transition-all"
                    >
                        Volver al Editor
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="bg-black text-white px-8 py-3 rounded-2xl font-bold shadow-lg hover:bg-gray-800 transition-all font-black uppercase tracking-widest"
                    >
                        Imprimir Formato Final
                    </button>
                </div>
            </div >
        )
    }

    return (
        <div className="max-w-6xl mx-auto pb-32">
            {/* Cabecera */}
            <div className="flex justify-between items-center mb-8">
                <button onClick={() => navigate('/analytical-program')} className="flex items-center text-gray-500 hover:text-gray-900 font-bold text-sm">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Volver Listado
                </button>
                <div className="flex items-center space-x-4">
                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                        Sesión Permanente NEM
                    </span>
                    {isDirectorOrAdmin && (
                        <button
                            onClick={() => handleSave()}
                            disabled={saving}
                            className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center scale-100 hover:scale-105 active:scale-95 disabled:opacity-50"
                        >
                            <Save className="w-4 h-4 mr-2" />
                            {saving ? 'Guardando...' : 'Guardar Programa'}
                        </button>
                    )}
                </div>
            </div>

            {/* Stepper Progresivo (5 Etapas) */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-8 overflow-x-auto">
                <div className="flex justify-between items-center min-w-[700px] relative">
                    {/* Connecting Line */}
                    <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-50 -translate-y-1/2 z-0"></div>

                    {[
                        { n: 1, label: 'Contexto', icon: MessageSquare },
                        { n: 2, label: 'Diagnóstico G.', icon: Layers },
                        { n: 3, label: 'Contextualización', icon: BookOpen },
                        { n: 4, label: 'Estrategias', icon: Info },
                        { n: 5, label: 'Resumen', icon: CheckCircle2 }
                    ].map((s) => (
                        <button
                            key={s.n}
                            onClick={() => {
                                // Only allow going back or to next step if current is valid
                                if (s.n < step) {
                                    setStep(s.n)
                                } else if (s.n > step) {
                                    if (validateStep(step)) {
                                        // Special case: if trying to jump far ahead, we'd need to validate intermediate steps
                                        // For simplicity, we only allow +1 or validate all intermediate
                                        let valid = true
                                        for (let i = step; i < s.n; i++) {
                                            if (!validateStep(i)) {
                                                setStep(i)
                                                valid = false
                                                break
                                            }
                                        }
                                        if (valid) setStep(s.n)
                                    }
                                }
                            }}
                            className={`relative z-10 flex flex-col items-center group focus:outline-none transition-all ${step === s.n ? 'scale-110' : 'opacity-60 hover:opacity-100'}`}
                        >
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-4 transition-all duration-300
                                ${step >= s.n
                                    ? 'bg-indigo-600 border-indigo-100 text-white shadow-lg shadow-indigo-100'
                                    : 'bg-white border-gray-100 text-gray-300'
                                }`}
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

            {/* ERI: Etapa 1 - Contexto Socioeducativo */}
            {step === 1 && (
                <div className="animate-in fade-in slide-in-from-bottom-6 duration-500">
                    <div className="bg-white rounded-[2.5rem] p-12 shadow-xl border border-gray-50 mb-10">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-black text-gray-900 flex items-center">
                                <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 mr-5">
                                    <MessageSquare className="w-7 h-7" />
                                </div>
                                1. Contexto Socioeducativo de la Escuela
                            </h2>
                        </div>

                        <div className="grid grid-cols-3 gap-6 mb-12 bg-gray-50/50 p-8 rounded-3xl border border-gray-100">
                            {/* PDF Upload Section - Only when creating new */}
                            {(!id || id === 'new') && (
                                <div className="col-span-3 mb-8 bg-white p-6 rounded-2xl shadow-sm border border-indigo-50">
                                    <h3 className="text-sm font-bold text-indigo-900 uppercase mb-2 flex items-center">
                                        <BookOpen className="w-4 h-4 mr-2 text-indigo-600" />
                                        Cargar Programa Analítico Existente (PDF)
                                    </h3>
                                    <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                                        Si ya tienes un documento PDF de tu Programa Analítico, súbelo aquí para extraer el diagnóstico y contexto automáticamente.
                                    </p>
                                    <PDFUpload
                                        label="Subir Programa Analítico (PDF)"
                                        validationKeywords={['Diagnóstico', 'Contexto', 'Problemática', 'Escuela']}
                                        onUploadComplete={(url, text) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                source_document_url: url,
                                                extracted_text: text,
                                                diagnosis_narrative: text ? text.substring(0, 5000) : prev.diagnosis_narrative // Auto-fill diagnosis with extracted text safe-guard
                                            }))
                                        }}
                                        currentFileUrl={formData.source_document_url}
                                    />
                                </div>
                            )}

                            <div className="col-span-3 mb-4">
                                <label className="text-[10px] font-black text-indigo-500 uppercase mb-2 block ml-1 tracking-widest">Ciclo Escolar (Vigencia del Programa)</label>
                                <select
                                    disabled={isReadOnly}
                                    className="w-full bg-indigo-50/50 border-indigo-200 text-indigo-700 rounded-xl px-4 py-3 text-sm font-black shadow-sm focus:ring-2 focus:ring-indigo-500 uppercase disabled:opacity-75 disabled:cursor-not-allowed"
                                >
                                    <option value="">SELECCIONAR CICLO...</option>
                                    {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Nombre de la Escuela</label>
                                <input
                                    disabled={isReadOnly}
                                    className="w-full bg-white border-gray-100 rounded-xl px-4 py-3 text-sm font-bold shadow-sm focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">CCT</label>
                                <input
                                    disabled={isReadOnly}
                                    className="w-full bg-white border-gray-100 rounded-xl px-4 py-3 text-sm font-bold shadow-sm focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Nivel</label>
                                <select
                                    disabled={isReadOnly}
                                    className="w-full bg-white border-gray-100 rounded-xl px-4 py-3 text-sm font-bold shadow-sm focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
                                >
                                    <option value="">SELECCIONAR...</option>
                                    {NIVELES_CATALOG.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Modalidad</label>
                                <select
                                    value={formData.school_data.modality}
                                    onChange={e => setFormData({
                                        ...formData,
                                        school_data: { ...formData.school_data, modality: e.target.value }
                                    })}
                                    className="w-full bg-white border-gray-100 rounded-xl px-4 py-3 text-sm font-bold shadow-sm focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">SELECCIONAR...</option>
                                    {MODALIDADES_CATALOG.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Sostenimiento</label>
                                <select
                                    value={formData.school_data.support}
                                    onChange={e => setFormData({
                                        ...formData,
                                        school_data: { ...formData.school_data, support: e.target.value }
                                    })}
                                    className="w-full bg-white border-gray-100 rounded-xl px-4 py-3 text-sm font-bold shadow-sm focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">SELECCIONAR...</option>
                                    {SOSTENIMIENTO_CATALOG.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Grados</label>
                                <input
                                    value={formData.school_data.grades}
                                    readOnly
                                    className="w-full bg-gray-50 border-gray-100 rounded-xl px-4 py-3 text-sm font-bold shadow-sm cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Turno</label>
                                <select
                                    disabled={isReadOnly}
                                    className="w-full bg-white border-gray-100 rounded-xl px-4 py-3 text-sm font-bold shadow-sm focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
                                >
                                    <option value="">SELECCIONAR...</option>
                                    {TURNOS_CATALOG.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Estado</label>
                                <select
                                    value={formData.school_data.state}
                                    onChange={e => setFormData({
                                        ...formData,
                                        school_data: { ...formData.school_data, state: e.target.value }
                                    })}
                                    className="w-full bg-white border-gray-100 rounded-xl px-4 py-3 text-sm font-bold shadow-sm focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">SELECCIONAR...</option>
                                    {ESTADOS_CATALOG.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Municipio</label>
                                <input
                                    value={formData.school_data.municipality}
                                    onChange={e => setFormData({
                                        ...formData,
                                        school_data: { ...formData.school_data, municipality: e.target.value.toUpperCase() }
                                    })}
                                    className="w-full bg-white border-gray-100 rounded-xl px-4 py-3 text-sm font-bold shadow-sm focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Localidad</label>
                                <input
                                    value={formData.school_data.location}
                                    onChange={e => setFormData({
                                        ...formData,
                                        school_data: { ...formData.school_data, location: e.target.value.toUpperCase() }
                                    })}
                                    className="w-full bg-white border-gray-100 rounded-xl px-4 py-3 text-sm font-bold shadow-sm focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">No. Docentes</label>
                                <input
                                    value={formData.school_data.total_teachers}
                                    onChange={e => setFormData({
                                        ...formData,
                                        school_data: { ...formData.school_data, total_teachers: e.target.value }
                                    })}
                                    className="w-full bg-white border-gray-100 rounded-xl px-4 py-3 text-sm font-bold shadow-sm focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block ml-1">Alumnos Grupo</label>
                                <input
                                    value={formData.school_data.group_students_info}
                                    onChange={e => setFormData({
                                        ...formData,
                                        school_data: { ...formData.school_data, group_students_info: e.target.value.toUpperCase() }
                                    })}
                                    placeholder="EJEM: 27 (12N / 15M)"
                                    className="w-full bg-white border-gray-100 rounded-xl px-4 py-3 text-sm font-bold shadow-sm focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-10">
                            <div className="space-y-8">
                                <h3 className="text-xs font-black uppercase text-gray-400 border-l-4 border-indigo-200 pl-4">1.2 Análisis Contexto Externo</h3>
                                <div className="space-y-4">
                                    <textarea
                                        value={formData.external_context.favors}
                                        onChange={e => setFormData({ ...formData, external_context: { ...formData.external_context, favors: e.target.value } })}
                                        rows={4}
                                        disabled={isReadOnly}
                                        className="w-full bg-white border-2 border-gray-100 rounded-2xl px-6 py-4 text-sm font-bold shadow-sm focus:border-green-300 transition-all disabled:bg-gray-50"
                                        placeholder="Escolaridad de padres, acceso a internet, festividades..."
                                    />
                                    {!isReadOnly && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {EXTERNAL_CONTEXT_CATALOG.favors.slice(0, 8).map(opt => (
                                                <button
                                                    key={opt}
                                                    onClick={() => {
                                                        const current = formData.external_context.favors
                                                        const newValue = current ? `${current} \n• ${opt} ` : `• ${opt} `
                                                        setFormData({ ...formData, external_context: { ...formData.external_context, favors: newValue } })
                                                    }}
                                                    className="text-[9px] font-black uppercase tracking-tighter bg-green-50 text-green-700 px-3 py-1.5 rounded-lg border border-green-100 hover:bg-green-100 transition-all"
                                                >
                                                    + {opt.split(' ')[0]} {opt.split(' ')[1]}...
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    <label className="text-[10px] font-black text-rose-500 uppercase block mt-6">Aspectos que DIFICULTAN</label>
                                    <textarea
                                        value={formData.external_context.difficults}
                                        onChange={e => setFormData({ ...formData, external_context: { ...formData.external_context, difficults: e.target.value } })}
                                        rows={4}
                                        className="w-full bg-white border-2 border-gray-100 rounded-2xl px-6 py-4 text-sm font-bold shadow-sm focus:border-rose-300 transition-all"
                                        placeholder="Inseguridad, falta de valores, economía..."
                                    />
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {EXTERNAL_CONTEXT_CATALOG.difficults.slice(0, 8).map(opt => (
                                            <button
                                                key={opt}
                                                onClick={() => {
                                                    const current = formData.external_context.difficults
                                                    const newValue = current ? `${current} \n• ${opt} ` : `• ${opt} `
                                                    setFormData({ ...formData, external_context: { ...formData.external_context, difficults: newValue } })
                                                }}
                                                className="text-[9px] font-black uppercase tracking-tighter bg-rose-50 text-rose-700 px-3 py-1.5 rounded-lg border border-rose-100 hover:bg-rose-100 transition-all"
                                            >
                                                + {opt.split(' ')[0]} {opt.split(' ')[1]}...
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-8">
                                <h3 className="text-xs font-black uppercase text-gray-400 border-l-4 border-indigo-200 pl-4">1.3 Análisis Contexto Interno</h3>
                                <div className="space-y-4">
                                    <textarea
                                        value={formData.internal_context.favors}
                                        onChange={e => setFormData({ ...formData, internal_context: { ...formData.internal_context, favors: e.target.value } })}
                                        rows={4}
                                        className="w-full bg-white border-2 border-gray-100 rounded-2xl px-6 py-4 text-sm font-bold shadow-sm focus:border-green-300 transition-all font-sans"
                                        placeholder="Acceso a TICs, bibilioteca, espacios recreativos..."
                                    />
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {INTERNAL_CONTEXT_CATALOG.favors.slice(0, 8).map(opt => (
                                            <button
                                                key={opt}
                                                onClick={() => {
                                                    const current = formData.internal_context.favors
                                                    const newValue = current ? `${current} \n• ${opt} ` : `• ${opt} `
                                                    setFormData({ ...formData, internal_context: { ...formData.internal_context, favors: newValue } })
                                                }}
                                                className="text-[9px] font-black uppercase tracking-tighter bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-100 hover:bg-emerald-100 transition-all"
                                            >
                                                + {opt.split(' ')[0]} {opt.split(' ')[1]}...
                                            </button>
                                        ))}
                                    </div>
                                    <label className="text-[10px] font-black text-rose-500 uppercase block mt-6">Aspectos que DIFICULTAN</label>
                                    <textarea
                                        value={formData.internal_context.difficults}
                                        onChange={e => setFormData({ ...formData, internal_context: { ...formData.internal_context, difficults: e.target.value } })}
                                        rows={4}
                                        className="w-full bg-white border-2 border-gray-100 rounded-2xl px-6 py-4 text-sm font-bold shadow-sm focus:border-rose-300 transition-all font-sans"
                                        placeholder="Inasistencias, rezago, falta de hábitos..."
                                    />
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {INTERNAL_CONTEXT_CATALOG.difficults.slice(0, 8).map(opt => (
                                            <button
                                                key={opt}
                                                onClick={() => {
                                                    const current = formData.internal_context.difficults
                                                    const newValue = current ? `${current} \n• ${opt} ` : `• ${opt} `
                                                    setFormData({ ...formData, internal_context: { ...formData.internal_context, difficults: newValue } })
                                                }}
                                                className="text-[9px] font-black uppercase tracking-tighter bg-rose-50 text-rose-700 px-3 py-1.5 rounded-lg border border-rose-100 hover:bg-rose-100 transition-all"
                                            >
                                                + {opt.split(' ')[0]} {opt.split(' ')[1]}...
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>


                    <div className="flex justify-between items-center bg-gray-50 p-6 rounded-2xl border border-gray-100 mt-12">
                        <div></div> {/* Spacer */}
                        <div className="text-xs font-black text-gray-300 uppercase tracking-widest">
                            Paso 1 de 5
                        </div>
                        <button
                            onClick={() => {
                                if (validateStep(1)) setStep(2)
                            }}
                            className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black text-sm flex items-center shadow-indigo-100 shadow-xl hover:bg-indigo-700 hover:scale-105 transition-all"
                        >
                            Siguiente: Diagnóstico
                            <ChevronRight className="w-5 h-5 ml-2" />
                        </button>
                    </div>
                </div>
            )
            }


            {/* Stage 2: Diagnóstico del Grupo */}
            {
                step === 2 && (

                    <div className="animate-in fade-in slide-in-from-bottom-6 duration-500">
                        <div className="bg-white rounded-[2.5rem] p-12 shadow-xl border border-gray-50 mb-10">
                            <h2 className="text-2xl font-black text-gray-900 mb-8 flex items-center">
                                <div className="p-3 bg-pink-50 rounded-2xl text-pink-600 mr-5">
                                    <Layers className="w-7 h-7" />
                                </div>
                                2. Diagnóstico del Grupo
                            </h2>

                            <div className="mb-10">
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-4 block">Narrativa Pedagógica del Grupo</label>
                                <textarea
                                    value={formData.group_diagnosis.narrative}
                                    onChange={e => setFormData({
                                        ...formData,
                                        group_diagnosis: { ...formData.group_diagnosis, narrative: e.target.value }
                                    })}
                                    rows={8}
                                    disabled={isReadOnly}
                                    className="w-full bg-pink-50/20 border-pink-100 rounded-3xl px-8 py-6 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-pink-500 shadow-sm disabled:cursor-not-allowed"
                                    placeholder="Describe el rezago, intereses, dinámicas de colaboración..."
                                />
                            </div>

                            {/* Predefined Options for Narrative */}
                            {!isReadOnly && (
                                <div className="mb-10 p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100">
                                    <h3 className="text-xs font-black uppercase text-indigo-400 mb-4 flex items-center">
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        Sugerencias de Redacción (Clic para agregar)
                                    </h3>
                                    <div className="space-y-6">
                                        <div>
                                            <label className="text-[10px] font-black text-gray-400 uppercase block mb-2">Contexto del Grupo</label>
                                            <div className="flex flex-wrap gap-2">
                                                {GROUP_DIAGNOSIS_CATALOG.context.map((opt, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => {
                                                            const current = formData.group_diagnosis.narrative
                                                            const newValue = current ? `${current} \n - ${opt} ` : ` - ${opt} `
                                                            setFormData({ ...formData, group_diagnosis: { ...formData.group_diagnosis, narrative: newValue } })
                                                        }}
                                                        className="text-[10px] bg-white border border-indigo-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 hover:text-indigo-700 transition-all text-left"
                                                    >
                                                        + {opt.length > 50 ? opt.substring(0, 50) + '...' : opt}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-gray-400 uppercase block mb-2">Práctica Pedagógica</label>
                                            <div className="flex flex-wrap gap-2">
                                                {GROUP_DIAGNOSIS_CATALOG.pedagogy.map((opt, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => {
                                                            const current = formData.group_diagnosis.narrative
                                                            const newValue = current ? `${current} \n - ${opt} ` : ` - ${opt} `
                                                            setFormData({ ...formData, group_diagnosis: { ...formData.group_diagnosis, narrative: newValue } })
                                                        }}
                                                        className="text-[10px] bg-white border border-indigo-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 hover:text-indigo-700 transition-all text-left"
                                                    >
                                                        + {opt.length > 50 ? opt.substring(0, 50) + '...' : opt}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <label className="text-[10px] font-black text-gray-400 uppercase block mb-2">Análisis PDA</label>
                                                <div className="flex flex-col gap-2">
                                                    {GROUP_DIAGNOSIS_CATALOG.pda.map((opt, idx) => (
                                                        <button
                                                            key={idx}
                                                            onClick={() => {
                                                                const current = formData.group_diagnosis.narrative
                                                                const newValue = current ? `${current} \n - ${opt} ` : ` - ${opt} `
                                                                setFormData({ ...formData, group_diagnosis: { ...formData.group_diagnosis, narrative: newValue } })
                                                            }}
                                                            className="text-[10px] bg-white border border-indigo-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 hover:text-indigo-700 transition-all text-left truncate"
                                                            title={opt}
                                                        >
                                                            + {opt}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-gray-400 uppercase block mb-2">Evidencias Impacto</label>
                                                <div className="flex flex-col gap-2">
                                                    {GROUP_DIAGNOSIS_CATALOG.evidence.map((opt, idx) => (
                                                        <button
                                                            key={idx}
                                                            onClick={() => {
                                                                const current = formData.group_diagnosis.narrative
                                                                const newValue = current ? `${current} \n - ${opt} ` : ` - ${opt} `
                                                                setFormData({ ...formData, group_diagnosis: { ...formData.group_diagnosis, narrative: newValue } })
                                                            }}
                                                            className="text-[10px] bg-white border border-indigo-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 hover:text-indigo-700 transition-all text-left truncate"
                                                            title={opt}
                                                        >
                                                            + {opt}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-gray-400 uppercase block mb-2">Reflexión Crítica</label>
                                                <div className="flex flex-col gap-2">
                                                    {GROUP_DIAGNOSIS_CATALOG.reflection.map((opt, idx) => (
                                                        <button
                                                            key={idx}
                                                            onClick={() => {
                                                                const current = formData.group_diagnosis.narrative
                                                                const newValue = current ? `${current} \n - ${opt} ` : ` - ${opt} `
                                                                setFormData({ ...formData, group_diagnosis: { ...formData.group_diagnosis, narrative: newValue } })
                                                            }}
                                                            className="text-[10px] bg-white border border-indigo-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 hover:text-indigo-700 transition-all text-left truncate"
                                                            title={opt}
                                                        >
                                                            + {opt}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-12">
                                <div>
                                    <h3 className="text-xs font-black uppercase text-gray-400 mb-6 flex items-center">
                                        <Info className="w-4 h-4 mr-2 text-rose-500" />
                                        2.1 Situaciones-problema
                                    </h3>
                                    <div className="space-y-3">
                                        {formData.group_diagnosis.problem_situations.map((prob, idx) => (
                                            <div key={idx} className="flex items-center group">
                                                <input
                                                    value={prob}
                                                    onChange={e => {
                                                        const newProb = [...formData.group_diagnosis.problem_situations]
                                                        newProb[idx] = e.target.value
                                                        setFormData({ ...formData, group_diagnosis: { ...formData.group_diagnosis, problem_situations: newProb } })
                                                    }}
                                                    className="flex-1 bg-gray-50 border-gray-100 rounded-xl px-4 py-3 text-xs font-bold"
                                                />
                                                <button
                                                    onClick={() => {
                                                        const newProb = formData.group_diagnosis.problem_situations.filter((_, i) => i !== idx)
                                                        setFormData({ ...formData, group_diagnosis: { ...formData.group_diagnosis, problem_situations: newProb } })
                                                    }}
                                                    className="ml-2 text-rose-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            onClick={() => setFormData({
                                                ...formData,
                                                group_diagnosis: {
                                                    ...formData.group_diagnosis,
                                                    problem_situations: [...formData.group_diagnosis.problem_situations, '']
                                                }
                                            })}
                                            className="w-full py-3 border-2 border-dashed border-gray-100 rounded-xl text-[10px] font-black uppercase text-gray-400 hover:border-rose-200 hover:text-rose-500 transition-all"
                                        >
                                            + Agregar Situación
                                        </button>
                                        <div className="flex flex-wrap gap-2 mt-4">
                                            {PROBLEM_SITUATIONS_CATALOG.slice(0, 8).map(opt => (
                                                <button
                                                    key={opt}
                                                    onClick={() => {
                                                        const current = formData.group_diagnosis.problem_situations
                                                        if (!current.includes(opt)) {
                                                            setFormData({
                                                                ...formData,
                                                                group_diagnosis: {
                                                                    ...formData.group_diagnosis,
                                                                    problem_situations: [...current, opt]
                                                                }
                                                            })
                                                        }
                                                    }}
                                                    className="text-[9px] font-black uppercase tracking-tighter bg-rose-50 text-rose-700 px-3 py-1.5 rounded-lg border border-rose-100 hover:bg-rose-100 transition-all"
                                                >
                                                    + {opt.split(' ').slice(0, 3).join(' ')}...
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-xs font-black uppercase text-gray-400 mb-6 flex items-center">
                                        <Sparkles className="w-4 h-4 mr-2 text-indigo-500" />
                                        2.2 Temas de interés
                                    </h3>
                                    <div className="space-y-3">
                                        {formData.group_diagnosis.interest_topics.map((topic, idx) => (
                                            <div key={idx} className="flex items-center group">
                                                <input
                                                    value={topic}
                                                    onChange={e => {
                                                        const newT = [...formData.group_diagnosis.interest_topics]
                                                        newT[idx] = e.target.value
                                                        setFormData({ ...formData, group_diagnosis: { ...formData.group_diagnosis, interest_topics: newT } })
                                                    }}
                                                    disabled={isReadOnly}
                                                    className="flex-1 bg-gray-50 border-gray-100 rounded-xl px-4 py-3 text-xs font-bold disabled:bg-gray-100"
                                                />
                                                {!isReadOnly && (
                                                    <button
                                                        onClick={() => {
                                                            const newT = formData.group_diagnosis.interest_topics.filter((_, i) => i !== idx)
                                                            setFormData({ ...formData, group_diagnosis: { ...formData.group_diagnosis, interest_topics: newT } })
                                                        }}
                                                        className="ml-2 text-indigo-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        {!isReadOnly && (
                                            <button
                                                onClick={() => setFormData({
                                                    ...formData,
                                                    group_diagnosis: {
                                                        ...formData.group_diagnosis,
                                                        interest_topics: [...formData.group_diagnosis.interest_topics, '']
                                                    }
                                                })}
                                                className="w-full py-3 border-2 border-dashed border-gray-100 rounded-xl text-[10px] font-black uppercase text-gray-400 hover:border-indigo-200 hover:text-indigo-500 transition-all"
                                            >
                                                + Agregar Tema
                                            </button>
                                        )}
                                        {!isReadOnly && (
                                            <div className="flex flex-wrap gap-2 mt-4">
                                                {INTEREST_TOPICS_CATALOG.slice(0, 8).map(opt => (
                                                    <button
                                                        key={opt}
                                                        onClick={() => {
                                                            const current = formData.group_diagnosis.interest_topics
                                                            if (!current.includes(opt)) {
                                                                setFormData({
                                                                    ...formData,
                                                                    group_diagnosis: {
                                                                        ...formData.group_diagnosis,
                                                                        interest_topics: [...current, opt]
                                                                    }
                                                                })
                                                            }
                                                        }}
                                                        className="text-[9px] font-black uppercase tracking-tighter bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-all"
                                                    >
                                                        + {opt.split(' ').slice(0, 3).join(' ')}...
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-between items-center bg-gray-50 p-6 rounded-2xl border border-gray-100 mt-12">
                                <button onClick={() => setStep(1)} className="text-gray-500 font-bold text-sm flex items-center px-6 py-3 rounded-xl hover:bg-white transition-all">
                                    <ChevronLeft className="w-5 h-5 mr-2" />
                                    Anterior
                                </button>
                                <div className="text-xs font-black text-gray-300 uppercase tracking-widest">
                                    Paso 2 de 5
                                </div>
                                <button
                                    onClick={() => {
                                        if (validateStep(2)) setStep(3)
                                    }}
                                    className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black text-sm flex items-center shadow-indigo-100 shadow-xl hover:bg-indigo-700 hover:scale-105 transition-all"
                                >
                                    Siguiente: Contextualización
                                    <ChevronRight className="w-5 h-5 ml-2" />
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }


            {/* Stage 3: Contextualización (Reuse existing optimized UI) */}
            {
                step === 3 && (
                    <div className="animate-in fade-in slide-in-from-bottom-6 duration-500">
                        <div className="bg-white rounded-[2.5rem] p-12 shadow-xl border border-gray-50 mb-10">

                            <div className="flex items-center mb-8">
                                <div className="p-3 bg-blue-50 rounded-2xl text-blue-600 mr-5">
                                    <BookOpen className="w-7 h-7" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-gray-900">3. Contextualización y Codiseño</h2>
                                    <p className="text-sm text-gray-400 font-bold uppercase tracking-tight">Vinculación de contenidos con la realidad</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {formData.contents.map((item, idx) => (
                                    <div key={idx} className="bg-gray-50/50 rounded-3xl p-8 border border-gray-100 relative group animate-in fade-in slide-in-from-bottom-2">
                                        {!isReadOnly && (
                                            <div className="absolute top-6 right-6 flex items-center space-x-2">
                                                <button
                                                    onClick={() => {
                                                        setEditingContentIdx(idx)
                                                        setIsSyntheticModalOpen(true)
                                                    }}
                                                    className="text-[10px] font-black uppercase text-indigo-500 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-all flex items-center"
                                                >
                                                    <Search className="w-3 h-3 mr-1.5" />
                                                    Programa Sintético
                                                </button>
                                                <button
                                                    onClick={() => setFormData({ ...formData, contents: formData.contents.filter((_, i) => i !== idx) })}
                                                    className="p-2 text-gray-300 hover:text-rose-500 transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Asignatura</label>
                                                <select
                                                    value={item.subject_id}
                                                    onChange={e => {
                                                        const newC = [...formData.contents]
                                                        newC[idx].subject_id = e.target.value
                                                        setFormData({ ...formData, contents: newC })
                                                    }}
                                                    disabled={isReadOnly}
                                                    className="w-full bg-white border-gray-200 rounded-2xl px-4 py-3 font-bold text-sm shadow-sm focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {subjectsCatalog.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Campo Formativo</label>
                                                <select
                                                    value={item.campo_formativo}
                                                    onChange={e => {
                                                        const newC = [...formData.contents]
                                                        newC[idx].campo_formativo = e.target.value
                                                        setFormData({ ...formData, contents: newC })
                                                    }}
                                                    disabled={isReadOnly}
                                                    className="w-full bg-white border-gray-200 rounded-2xl px-4 py-3 font-bold text-sm shadow-sm disabled:bg-gray-100"
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {CAMPOS.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Temporalidad</label>
                                                <input
                                                    value={item.temporality}
                                                    onChange={e => {
                                                        const newC = [...formData.contents]
                                                        newC[idx].temporality = e.target.value
                                                        setFormData({ ...formData, contents: newC })
                                                    }}
                                                    disabled={isReadOnly}
                                                    placeholder="Ej: Sept - Oct"
                                                    className="w-full bg-white border-gray-200 rounded-2xl px-4 py-3 font-bold text-sm shadow-sm disabled:bg-gray-100"
                                                />
                                            </div>
                                            <div className="md:col-span-2 lg:col-span-3">
                                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Contenido / Codiseño</label>
                                                <textarea
                                                    value={item.custom_content}
                                                    onChange={e => {
                                                        const newC = [...formData.contents]
                                                        newC[idx].custom_content = e.target.value
                                                        setFormData({ ...formData, contents: newC })
                                                    }}
                                                    disabled={isReadOnly}
                                                    rows={2}
                                                    className="w-full bg-white border-gray-200 rounded-2xl px-6 py-4 font-bold text-sm disabled:bg-gray-100"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {syntheticCatalog.length === 0 && (
                                    <div className="bg-amber-50 border border-amber-200 p-6 rounded-[2rem] mb-10 text-center animate-pulse">
                                        <p className="text-xs font-bold text-amber-700 uppercase tracking-widest">
                                            ⚠️ Advertencia: El catálogo de la Fase {currentPhase} está vacío en la base de datos.
                                        </p>
                                        <p className="text-[10px] text-amber-600 mt-1 uppercase font-black italic">
                                            Asegúrate de ejecutar las migraciones SQL en Supabase para cargar los contenidos.
                                        </p>
                                    </div>
                                )}
                                {!isReadOnly && (
                                    <button
                                        onClick={() => setFormData({ ...formData, contents: [...formData.contents, { subject_id: '', campo_formativo: '', custom_content: '', temporality: '' }] })}
                                        className="w-full py-10 border-2 border-dashed border-gray-100 rounded-[2rem] text-[11px] font-black uppercase text-gray-400 hover:border-indigo-200 hover:text-indigo-600 hover:bg-slate-50/50 transition-all flex flex-col items-center justify-center group"
                                    >
                                        <Plus className="w-6 h-6 mb-2 text-gray-200 group-hover:text-indigo-500" />
                                    </button>
                                )}
                            </div>


                            <div className="flex justify-between items-center bg-gray-50 p-6 rounded-2xl border border-gray-100 mt-12">
                                <button onClick={() => setStep(2)} className="text-gray-500 font-bold text-sm flex items-center px-6 py-3 rounded-xl hover:bg-white transition-all">
                                    <ChevronLeft className="w-5 h-5 mr-2" />
                                    Anterior
                                </button>
                                <div className="text-xs font-black text-gray-300 uppercase tracking-widest">
                                    Paso 3 de 5
                                </div>
                                <button
                                    onClick={() => {
                                        if (validateStep(3)) setStep(4)
                                    }}
                                    className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black text-sm flex items-center shadow-indigo-100 shadow-xl hover:bg-indigo-700 hover:scale-105 transition-all"
                                >
                                    Siguiente: Estrategias
                                    <ChevronRight className="w-5 h-5 ml-2" />
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }


            {/* Stage 4: Estrategias */}
            {
                step === 4 && (
                    <div className="animate-in fade-in slide-in-from-bottom-6 duration-500">
                        <div className="bg-white rounded-[2.5rem] p-12 shadow-xl border border-gray-50 mb-10">
                            <h2 className="text-2xl font-black text-gray-900 mb-10 flex items-center">
                                <div className="p-3 bg-amber-50 rounded-2xl text-amber-600 mr-5">
                                    <Sparkles className="w-7 h-7" />
                                </div>
                                4 y 5. Estrategias Metodológicas y de Evaluación
                            </h2>

                            <div className="grid grid-cols-2 gap-12">
                                <div>
                                    <h3 className="text-xs font-black uppercase text-gray-400 mb-6 underline decoration-amber-200 decoration-4 underline-offset-8">Metodologías Sociocríticas</h3>
                                    <div className="space-y-4">
                                        {STRATEGIES_MET.map(met => (
                                            <label key={met} className={`flex items-center p-4 rounded-2xl border-2 transition-all cursor-pointer ${formData.pedagogical_strategies.includes(met) ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white border-gray-50 hover:border-gray-200'}`}>
                                                <input
                                                    type="checkbox"
                                                    disabled={isReadOnly}
                                                    checked={formData.pedagogical_strategies.includes(met)}
                                                    onChange={() => {
                                                        const exists = formData.pedagogical_strategies.includes(met)
                                                        const newS = exists
                                                            ? formData.pedagogical_strategies.filter(s => s !== met)
                                                            : [...formData.pedagogical_strategies, met]
                                                        setFormData({ ...formData, pedagogical_strategies: newS })
                                                    }}
                                                    className="w-5 h-5 rounded-lg border-2 border-indigo-100 text-indigo-600 focus:ring-0 mr-4 disabled:opacity-50"
                                                />
                                                <span className="text-xs font-black text-gray-700">{met}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-xs font-black uppercase text-gray-400 mb-6 underline decoration-emerald-200 decoration-4 underline-offset-8">Evaluación Formativa</h3>
                                    <div className="mb-8 p-6 bg-emerald-50/20 rounded-3xl border border-emerald-50">
                                        <label className="text-[10px] font-black text-emerald-600 uppercase mb-3 block">Instrumentos de Evaluación</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {EVALUATION_INSTRUMENTS.map(ins => (
                                                <label key={ins} className="flex items-center text-[10px] font-bold text-gray-600">
                                                    <input
                                                        type="checkbox"
                                                        disabled={isReadOnly}
                                                        checked={formData.evaluation_strategies.instruments.includes(ins)}
                                                        onChange={() => {
                                                            const current = formData.evaluation_strategies.instruments
                                                            const newI = current.includes(ins) ? current.filter(i => i !== ins) : [...current, ins]
                                                            setFormData({ ...formData, evaluation_strategies: { ...formData.evaluation_strategies, instruments: newI } })
                                                        }}
                                                        className="w-3.5 h-3.5 rounded bg-white border-gray-200 text-emerald-600 mr-2 disabled:opacity-50"
                                                    />
                                                    {ins}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-black text-gray-400 uppercase block ml-1">Pautas para retroalimentación</h4>
                                        <textarea
                                            value={formData.evaluation_strategies.description}
                                            onChange={e => setFormData({
                                                ...formData,
                                                evaluation_strategies: { ...formData.evaluation_strategies, description: e.target.value }
                                            })}
                                            disabled={isReadOnly}
                                            rows={4}
                                            className="w-full bg-gray-50 border-gray-50 rounded-2xl px-6 py-4 text-xs font-bold text-gray-700 shadow-inner disabled:opacity-75"
                                            placeholder="Define cómo se brindará la retroalimentación a los alumnos..."
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-16 pt-10 border-t border-gray-50">
                                <h3 className="text-xs font-black uppercase text-gray-400 mb-8 flex items-center">
                                    <CheckCircle2 className="w-5 h-5 mr-3 text-emerald-500" />
                                    6. Estrategias Nacionales
                                </h3>
                                <div className="grid grid-cols-2 gap-6">
                                    {NATIONAL_STRATEGIES.map(nat => (
                                        <div key={nat.id} className={`p-6 rounded-3xl border-2 transition-all ${formData.national_strategies.find(s => s.name === nat.name) ? 'bg-indigo-50 border-indigo-100' : 'bg-gray-50/50 border-transparent'}`}>
                                            <label className="flex items-center cursor-pointer mb-3">
                                                <input
                                                    type="checkbox"
                                                    disabled={isReadOnly}
                                                    checked={!!formData.national_strategies.find(s => s.name === nat.name)}
                                                    onChange={() => {
                                                        const exists = formData.national_strategies.find(s => s.name === nat.name)
                                                        const newN = exists
                                                            ? formData.national_strategies.filter(s => s.name !== nat.name)
                                                            : [...formData.national_strategies, { name: nat.name, description: '' }]
                                                        setFormData({ ...formData, national_strategies: newN })
                                                    }}
                                                    className="w-5 h-5 rounded-lg border-2 border-indigo-200 text-indigo-600 focus:ring-0 mr-4 disabled:opacity-50"
                                                />
                                                <span className="text-xs font-black text-indigo-900">{nat.name}</span>
                                            </label>
                                            {formData.national_strategies.find(s => s.name === nat.name) && (
                                                <textarea
                                                    value={formData.national_strategies.find(s => s.name === nat.name)?.description}
                                                    onChange={e => {
                                                        const newN = formData.national_strategies.map(s => s.name === nat.name ? { ...s, description: e.target.value } : s)
                                                        setFormData({ ...formData, national_strategies: newN })
                                                    }}
                                                    disabled={isReadOnly}
                                                    placeholder="¿Cómo se incorpora esta estrategia en el plano didáctico?"
                                                    rows={2}
                                                    className="w-full bg-white border-indigo-50 rounded-xl px-4 py-3 text-[10px] font-bold text-indigo-700 shadow-sm disabled:bg-gray-50"
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-between items-center bg-gray-50 p-6 rounded-2xl border border-gray-100 mt-12">
                                <button onClick={() => setStep(3)} className="text-gray-500 font-bold text-sm flex items-center px-6 py-3 rounded-xl hover:bg-white transition-all">
                                    <ChevronLeft className="w-5 h-5 mr-2" />
                                    Anterior
                                </button>
                                <div className="text-xs font-black text-gray-300 uppercase tracking-widest">
                                    Paso 4 de 5
                                </div>
                                <button
                                    onClick={() => {
                                        if (validateStep(4)) setStep(5)
                                    }}
                                    className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black text-sm flex items-center shadow-indigo-100 shadow-xl hover:bg-indigo-700 hover:scale-105 transition-all"
                                >
                                    Finalizar: Resumen y Formato
                                    <ChevronRight className="w-5 h-5 ml-2" />
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Stage 5: Final Summary & Print Preview */}
            {
                step === 5 && (
                    <div className="animate-in fade-in slide-in-from-bottom-6 duration-500">
                        <div className="bg-white rounded-[2.5rem] p-12 shadow-xl border border-gray-50 mb-10 text-center">
                            <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center text-green-500 mx-auto mb-8 shadow-inner">
                                <CheckCircle2 className="w-12 h-12" />
                            </div>
                            <h2 className="text-3xl font-black text-gray-900 mb-4">Programa Analítico Consolidado</h2>
                            <p className="max-w-xl mx-auto text-gray-500 text-sm font-bold mb-12">
                                Has completado todas las etapas según la NEM. Ahora puedes generar el formato oficial de impresión para tu centro escolar.
                            </p>

                            <div className="grid grid-cols-2 gap-6 max-w-2xl mx-auto">
                                <div className="p-8 bg-gray-50 rounded-3xl border border-gray-100 text-left">
                                    <h3 className="text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest">Estado del Documento</h3>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center text-xs font-bold">
                                            <span className="text-gray-600">Contexto y Diagnóstico</span>
                                            <span className="text-green-500">Completado</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs font-bold">
                                            <span className="text-gray-600">Codiseño / Disciplinas</span>
                                            <span className="text-green-500">{formData.contents.length} Registradas</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs font-bold">
                                            <span className="text-gray-600">Estrategias</span>
                                            <span className="text-green-500">Definidas</span>
                                        </div>
                                    </div>
                                </div>
                                {isDirectorOrAdmin && (
                                    <>
                                        <div className="p-8 bg-indigo-50/30 rounded-3xl border border-indigo-100 text-left flex flex-col justify-center">
                                            <h4 className="font-bold text-gray-700 mb-2">Resumen de Propuesta</h4>
                                            <div className="space-y-3 mt-4">
                                                <div className="flex justify-between items-center text-xs font-bold">
                                                    <span className="text-gray-600">Sesiones</span>
                                                    <span className="text-green-500">{formData.contents.length} Registradas</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs font-bold">
                                                    <span className="text-gray-600">Estrategias</span>
                                                    <span className="text-green-500">Definidas</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setIsAIProposalManagerOpen(true)}
                                                className="w-full mt-6 flex items-center justify-center px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-800 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:shadow-lg hover:scale-105 transition-all shadow-indigo-100 shadow-xl"
                                            >
                                                <Sparkles className="w-4 h-4 mr-2" />
                                                Gestionar Propuesta Didáctica (IA)
                                            </button>
                                        </div>
                                        <div className="p-8 bg-indigo-50/30 rounded-3xl border border-indigo-100 text-left flex flex-col justify-center">
                                            <h4 className="font-bold text-gray-700 mb-2">Editor de Propuesta</h4>
                                            <p className="text-xs text-gray-500 mb-6">Utiliza el gestor para redactar los PDAs, problemáticas y orientaciones de forma asistida.</p>
                                            <button
                                                onClick={() => {
                                                    if (profile?.is_demo) {
                                                        alert('Modo Demo: El gestor de propuestas IA está deshabilitado.')
                                                        return
                                                    }
                                                    setIsAIProposalManagerOpen(true)
                                                }}
                                                className={`w-full flex items-center justify-center px-4 py-3 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-indigo-100 shadow-xl ${profile?.is_demo ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-indigo-800 hover:shadow-lg hover:scale-105'
                                                    }`}
                                            >
                                                <Sparkles className="w-4 h-4 mr-2" />
                                                Abrir Gestor de Propuesta
                                            </button>
                                        </div>
                                    </>
                                )}
                                <div className="p-8 bg-indigo-50/30 rounded-3xl border border-indigo-100 text-left flex flex-col justify-center mt-6">
                                    <button
                                        onClick={async () => {
                                            const savedId = await handleSave(false)
                                            if (savedId) navigate(`/analytical-program/${savedId}?print=true`)
                                        }}
                                        className="w-full bg-white hover:bg-gray-50 text-gray-800 py-6 rounded-2xl font-black text-sm shadow-sm border border-gray-100 transition-all flex items-center justify-center"
                                    >
                                        <span className="mr-3 text-xl">🖨️</span>
                                        Vista Previa Formato NEM
                                    </button>
                                </div>
                            </div>

                            <div className="flex justify-between items-center bg-gray-50 p-6 rounded-2xl border border-gray-100 mt-12">
                                <button onClick={() => setStep(4)} className="text-gray-500 font-bold text-sm flex items-center px-6 py-3 rounded-xl hover:bg-white transition-all">
                                    <ChevronLeft className="w-5 h-5 mr-2" />
                                    Anterior
                                </button>
                                <div className="text-xs font-black text-gray-300 uppercase tracking-widest">
                                    Paso 5 de 5
                                </div>
                                {isDirectorOrAdmin && (
                                    <button
                                        onClick={() => {
                                            if (profile?.is_demo) {
                                                alert('Modo Demo: El guardado final está deshabilitado.')
                                                return
                                            }
                                            handleSave(true)
                                        }}
                                        className={`px-8 py-3 rounded-xl font-black text-sm flex items-center shadow-indigo-100 shadow-xl transition-all ${profile?.is_demo ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105'
                                            }`}
                                    >
                                        <Save className="w-4 h-4 mr-2" />
                                        Finalizar y Cerrar Sesión CTE
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Synthetic Program Modal (Reusable) */}
            {
                isSyntheticModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-indigo-100 overflow-hidden anime-in fade-in zoom-in duration-300">
                            {/* Modal Header */}
                            <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-indigo-50/30">
                                <div>
                                    <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter flex items-center">
                                        <BookMarked className="w-5 h-5 mr-3 text-indigo-600" />
                                        Programa Sintético - Fase {currentPhase}
                                    </h3>
                                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-1">
                                        Referencia oficial de contenidos nacionales
                                    </p>
                                </div>
                                <button onClick={() => setIsSyntheticModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                    <Plus className="w-6 h-6 rotate-45" />
                                </button>
                            </div>

                            {/* Search Bar */}
                            <div className="p-8 bg-indigo-50/10 border-b border-indigo-50">
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                                    <input
                                        type="text"
                                        placeholder="Buscar por contenido, materia o campo..."
                                        value={syntheticSearch}
                                        onChange={(e) => setSyntheticSearch(e.target.value)}
                                        className="w-full bg-white border-2 border-indigo-50/50 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
                                    />
                                </div>
                            </div>

                            {/* List */}
                            <div className="p-8 max-h-[50vh] overflow-y-auto space-y-4">
                                {syntheticCatalog
                                    .filter(s =>
                                        s.content.toLowerCase().includes(syntheticSearch.toLowerCase()) ||
                                        (s.subject_name?.toLowerCase().includes(syntheticSearch.toLowerCase()) || '') ||
                                        s.field_of_study.toLowerCase().includes(syntheticSearch.toLowerCase())
                                    )
                                    .map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => {
                                                if (editingContentIdx !== null) {
                                                    const newContents = [...formData.contents]
                                                    const subjectInCatalog = subjectsCatalog.find(s => s.name === item.subject_name)
                                                    newContents[editingContentIdx] = {
                                                        ...newContents[editingContentIdx],
                                                        subject_id: subjectInCatalog?.id || newContents[editingContentIdx].subject_id,
                                                        campo_formativo: item.field_of_study,
                                                        custom_content: item.content
                                                    }
                                                    setFormData({ ...formData, contents: newContents })
                                                }
                                                setIsSyntheticModalOpen(false)
                                            }}
                                            className="w-full text-left p-5 rounded-2xl border border-gray-100 hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-[9px] font-black uppercase text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">{item.field_of_study}</span>
                                                <span className="text-[9px] font-black uppercase text-gray-400">{item.subject_name || ''}</span>
                                            </div>
                                            <p className="text-sm font-bold text-gray-800 leading-relaxed">{item.content}</p>
                                        </button>
                                    ))}
                            </div>
                        </div>
                    </div>
                )
            }

            <AIProposalManager
                isOpen={isAIProposalManagerOpen}
                onClose={() => setIsAIProposalManagerOpen(false)}
                formData={{ ...formData, syntheticCatalog }}
                setFormData={setFormData}
                groqService={groqService}
                phase={currentPhase}
            />

            <ErrorModal
                isOpen={errorModal.isOpen}
                onClose={() => setErrorModal({ ...errorModal, isOpen: false })}
                title={errorModal.title}
                message={errorModal.message}
                details={errorModal.details}
            />
        </div >
    );
};



