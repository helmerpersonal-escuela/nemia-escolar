import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
// Force rebuild to fix intermittent 500 errors in some environments
import { useTenant } from '../../../hooks/useTenant'
import { geminiService } from '../../../lib/gemini'
import { useProfile } from '../../../hooks/useProfile'
import {
    ArrowLeft,
    Sparkles,
    CheckCircle2,
    Briefcase,
    School,
    BookOpen,
    Target,
    Users,
    Loader2,
    Check,
    RotateCcw,
    Trash2,
    ShieldCheck,
    Layers,
    GraduationCap,
    Save
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { WizardFooter, WizardProgress, WizardStepHeader } from '../../../components/wizard/Wizard'
import { useToast } from '../../../components/ui/Toast'
import {
    useTeacherScope, restrictScope, loadScopedCatalog, findOutOfScopeMentions, sameDiscipline, toCampo,
    FIELD_KEY, FIELD_LABEL, FIELD_METHODOLOGY, type Campo, type ScopedContent,
} from '../lib/teacherScope'
import { askConfirm } from '../../../components/ui/ConfirmDialog'

// Wizard Steps Configuration
const STEPS = [
    { id: 1, title: 'Datos de la Escuela', icon: School, description: 'Información básica del centro escolar' },
    { id: 2, title: 'Lectura de la Realidad', icon: BookOpen, description: 'Diagnóstico socioeducativo (Primer Plano)' },
    { id: 3, title: 'Problemática', icon: Target, description: 'Selección y vinculación con ejes' },
    { id: 4, title: 'Contextualización', icon: Users, description: 'Selección de contenidos (Segundo Plano)' },
    { id: 5, title: 'Proceso de Codiseño', icon: Briefcase, description: 'Construcción colectiva y problematización' },
    { id: 6, title: 'Codiseño de Contenidos', icon: Briefcase, description: 'Planeación didáctica (Tercer Plano)' },
    { id: 7, title: 'Revisión Final', icon: CheckCircle2, description: 'Ajustes y validación' }
]

// Default Initial States
const DEFAULT_SCHOOL_DATA = {
    name: '',
    cct: '',
    zone: '',
    sector: '',
    state: '',
    municipality: '',
    level: 'Secundaria',
    turn: 'Matutino',
    students_total: '',
    teachers_count: '',
    logo_url: '',
    grade: '' // New property to determine phase for primary
}

const DEFAULT_FIELDS = {
    lenguajes: [],
    saberes: [],
    etica: [],
    humano: []
}

const DEFAULT_CODESIGN = {
    dialogue_notes: '',
    dialogue: [] as { role: string, name: string, content: string }[],
    problematization_table: [] as any[],
    prioritization_criteria: {
        interrupts_pda: false,
        school_intervention: false,
        docent_resource: false,
        requires_change: false
    },
    reflexive_questions: [] as string[],
    collective_notes: [] as string[]
}

export const AnalyticalProgramEditorPage = () => {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { profile } = useProfile()
    const { data: tenant } = useTenant()

    // Service Instance
    const aiService = geminiService
    const { showToast } = useToast()

    // Alcance curricular del docente: disciplinas, campo(s) formativo(s) y grados que atiende.
    // Toda la generación con IA se limita a este alcance.
    const { data: scopeAll, isLoading: scopeLoading } = useTeacherScope()
    // Cada campo formativo tiene su propio programa analítico: el programa queda ligado a UN campo
    const [searchParams] = useSearchParams()
    const [programField, setProgramField] = useState<Campo | null>(() => toCampo(searchParams.get('campo')))
    useEffect(() => {
        // Si el docente solo tiene un campo, se asigna solo
        if (!programField && scopeAll && scopeAll.fields.length === 1) setProgramField(scopeAll.fields[0])
    }, [scopeAll, programField])
    const scope = useMemo(() => restrictScope(scopeAll, programField), [scopeAll, programField])
    const needsField = !!scopeAll && scopeAll.fields.length > 1 && !programField
    // Programas que ya existen por campo (para no duplicar)
    const { data: existingByField = {} } = useQuery({
        queryKey: ['analytical-programs-by-field', tenant?.id],
        enabled: !!tenant?.id,
        queryFn: async () => {
            const { data } = await supabase.from('analytical_programs').select('id, field_of_study').eq('tenant_id', tenant!.id)
            const map: Record<string, string> = {}
            for (const r of (data ?? []) as any[]) if (r.field_of_study && r.id !== id) map[r.field_of_study] = r.id
            return map
        },
    })

    // Al terminar una generación con IA, la vista se lleva al resultado (antes quedaba fuera de pantalla
    // y parecía que la IA no había respondido).
    const resultRef = useRef<HTMLDivElement>(null)
    const [genLabel, setGenLabel] = useState('')
    const revealResult = (message?: string) => {
        window.setTimeout(() => {
            const el = resultRef.current
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                el.focus({ preventScroll: true })
            }
        }, 120)
        if (message) showToast(message, 'success')
    }

    // State
    const [currentStep, setCurrentStep] = useState(1)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const [syntheticCatalog, setSyntheticCatalog] = useState<any[]>([])
    const [suggestedContents, setSuggestedContents] = useState<any[]>([])
    // PDAs propios del docente/escuela (Mis PDAs): se pueden sumar a los contenidos del programa.
    const { data: customPdas = [] } = useQuery({
        queryKey: ['custom-pdas', tenant?.id],
        enabled: !!tenant?.id,
        queryFn: async () => {
            const { data } = await supabase.from('custom_pdas').select('*').eq('tenant_id', tenant!.id).order('field_of_study')
            return (data ?? []) as any[]
        },
    })
    const addCustomPda = (p: any) => {
        const key = `custom:${p.id}`
        setSuggestedContents(prev => prev.some(c => c.id === key) ? prev : [...prev, {
            id: key, custom_pda_id: p.id, is_custom: true, selected: true,
            content: p.content, pda: p.pda, field_of_study: p.field_of_study, subject_name: p.subject_name,
        }])
    }
    const [syntheticContext, setSyntheticContext] = useState<string>('') // Raw text from uploaded PDF
    const [customInputs, setCustomInputs] = useState({
        geo: '', social: '', cultural: '', infra: '', academic: ''
    })

    // Helpers
    const getPhaseFromLevel = (level: string, gradeStr?: string): number => {
        const lower = level.toLowerCase()
        if (lower.includes('inicial')) return 1
        if (lower.includes('preescolar')) return 2

        if (lower.includes('primaria') || lower.includes('primary')) {
            if (!gradeStr) return 4 // Default intermediate phase for primary
            const numericGrade = parseInt(gradeStr.replace(/\D/g, ''))
            if (numericGrade === 1 || numericGrade === 2) return 3
            if (numericGrade === 3 || numericGrade === 4) return 4
            if (numericGrade === 5 || numericGrade === 6) return 5
            return 4
        }

        if (lower.includes('secundaria') || lower.includes('secondary') || lower.includes('telesecundaria')) return 6
        return 6 // Default
    }

    // Steps Data Enums (Extended)
    const CONTEXT_OPTIONS = {
        geo: [
            'Urbana', 'Rural', 'Semi-urbana', 'Indígena', 'Marginal',
            'Céntrica', 'Periférica', 'Industrial', 'Agrícola', 'Turística',
            'Fronteriza', 'Costera', 'Montañosa', 'De difícil acceso', 'Residencial', 'Comercial'
        ],
        social: [
            'Migración alta', 'Violencia', 'Desempleo', 'Comercio informal', 'Participación comunitaria alta',
            'Familias disfuncionales', 'Pobreza extrema', 'Alto nivel educativo', 'Padres trabajadores', 'Inseguridad',
            'Pandillerismo', 'Adicciones', 'Cohesión social fuerte', 'Apoyo municipal', 'Desnutrición', 'Vandalismo'
        ],
        cultural: [
            'Diversidad lingüística', 'Tradiciones arraigadas', 'Población flotante', 'Identidad local fuerte', 'Festividades religiosas',
            'Gastronomía típica', 'Artesanías', 'Música regional', 'Danza folklórica', 'Multiculturalidad',
            'Cosmovisión indígena', 'Machismo arraigado', 'Valoración de la educación', 'Uso de tecnologías', 'Prácticas solidarias'
        ]
    }

    const INTERNAL_OPTIONS = {
        infra: [
            'Aulas insuficientes', 'Buen equipamiento', 'Sin internet', 'Espacios deportivos', 'Biblioteca funcional',
            'Techumbre en patio', 'Comedor escolar', 'Sanitarios dignos', 'Barda perimetral', 'Áreas verdes',
            'Accesibilidad (rampas)', 'Laboratorio de cómputo', 'Taller de usos múltiples', 'Drenaje deficiente', 'Falta de agua', 'Iluminación adecuada'
        ],
        academic: [
            'Rezago en lectura', 'Ausentismo', 'Interés en tecnología', 'Ritmos de aprendizaje diversos', 'Participativos',
            'Kinestésicos', 'Visuales', 'Auditivos', 'Discapacidad motriz', 'Aptitudes sobresalientes',
            'Problemas de conducta', 'Trabajo colaborativo', 'Falta de motivación', 'Apoyo familiar bajo', 'Dominio de lengua indígena'
        ]
    }

    // Helpers
    const toggleOption = (category: string, sub: string, value: string) => {
        setFormData(prev => {
            const current = (prev.diagnosis as any)[category][sub] || ''
            const currentArr = current ? current.split(', ') : []
            const newArr = currentArr.includes(value)
                ? currentArr.filter((i: string) => i !== value)
                : [...currentArr, value]

            return {
                ...prev,
                diagnosis: {
                    ...prev.diagnosis,
                    [category]: {
                        ...(prev.diagnosis as any)[category],
                        [sub]: newArr.join(', ')
                    }
                }
            }
        })
    }

    // Main Form Data
    const [formData, setFormData] = useState({
        school_data: DEFAULT_SCHOOL_DATA,
        diagnosis: {
            external_context: { geo: '', social: '', cultural: '' },
            internal_context: { infrastructure: '', resources: '', environment: '' },
            students: { characteristics: '', needs: '', interests: '' },
            teachers: { strengths: '', areas_opportunity: '' },
            narrative_final: ''
        },
        problems: [] as any[],
        program_by_fields: DEFAULT_FIELDS,
        codesign_process: DEFAULT_CODESIGN
    })

    // Initialization & Persistence
    useEffect(() => {
        const init = async () => {
            setLoading(true)

            // 1. Fetch Synthetic Catalog
            const { data: catalog } = await supabase
                .from('synthetic_program_contents')
                .select('*')
                .eq('phase', 6)
            if (catalog) setSyntheticCatalog(catalog)

            // 2. Try to fetch from DB if we have an ID
            let dbProgram = null
            if (id && id !== 'new') {
                const { data: program, error: fetchError } = await supabase
                    .from('analytical_programs')
                    .select('*')
                    .eq('id', id)
                    .maybeSingle()

                if (fetchError) console.error('Error loading existing program:', fetchError)
                if (program) dbProgram = program
                if (program?.field_of_study) setProgramField(toCampo(program.field_of_study))
            }

            // 3. Load from LocalStorage (Draft) as potential override or for "new"
            const savedDraft = localStorage.getItem(`analytical_program_draft_${id || 'new'}`)

            if (dbProgram) {
                // DB found - Prioritize DB data and handle standardizing mapping
                const groupDiag = dbProgram.group_diagnosis || {}
                const baseData = {
                    school_data: {
                        ...DEFAULT_SCHOOL_DATA,
                        ...(dbProgram.school_data || {}),
                        // Fallback to top-level if legacy data used them
                        name: dbProgram.school_data?.name || dbProgram.school_data?.official_name || DEFAULT_SCHOOL_DATA.name
                    },
                    diagnosis: {
                        external_context: groupDiag.external_context || { geo: '', social: '', cultural: '' },
                        internal_context: groupDiag.internal_context || { infrastructure: '', resources: '', environment: '' },
                        students: groupDiag.students || { characteristics: '', needs: '', interests: '' },
                        teachers: groupDiag.teachers || { strengths: '', areas_opportunity: '' },
                        narrative_final: groupDiag.narrative_final || groupDiag.narrative || dbProgram.diagnosis_context || ''
                    },
                    problems: groupDiag.problem_situations || dbProgram.problem_statements || [],
                    program_by_fields: dbProgram.program_by_fields || DEFAULT_FIELDS,
                    codesign_process: groupDiag.codesign_process || dbProgram.codesign_process || DEFAULT_CODESIGN
                }

                setFormData(baseData)
                if (groupDiag.suggested_contents) {
                    setSuggestedContents(groupDiag.suggested_contents)
                }

                // If draft exists, use it ONLY for UI state like currentStep to avoid overriding DB data with stale/empty draft
                if (savedDraft) {
                    try {
                        const parsed = JSON.parse(savedDraft)
                        setCurrentStep(parsed.currentStep || 1)
                    } catch { /* borrador corrupto: se ignora */ }
                }
            } else if (savedDraft) {
                // No DB data (or it's "new"), but draft exists
                try {
                    const parsed = JSON.parse(savedDraft)
                    setFormData(prev => ({
                        ...prev,
                        ...parsed.formData,
                        diagnosis: { ...prev.diagnosis, ...parsed.formData?.diagnosis },
                        school_data: { ...prev.school_data, ...parsed.formData?.school_data },
                        codesign_process: { ...prev.codesign_process, ...(parsed.formData?.codesign_process || {}) }
                    }))
                    setCurrentStep(parsed.currentStep || 1)
                    if (parsed.suggestedContents) setSuggestedContents(parsed.suggestedContents)
                } catch (e) {
                    console.error('Error restoring draft', e)
                }
            } else if (id === 'new' || !id) {
                setFormData(prev => {
                    const rawLevel = (tenant?.educationalLevel as string) || prev.school_data.level;
                    let mappedLevel = rawLevel;
                    if (rawLevel === 'PRIMARY') mappedLevel = 'Primaria';
                    else if (rawLevel === 'SECONDARY') mappedLevel = 'Secundaria';
                    else if (rawLevel === 'TELESECUNDARIA') mappedLevel = 'Telesecundaria';
                    else if (rawLevel === 'HIGH_SCHOOL') mappedLevel = 'Preparatoria';

                    return {
                        ...prev,
                        school_data: {
                            ...prev.school_data,
                            name: tenant?.name || '',
                            cct: tenant?.cct || '',
                            level: mappedLevel,
                            grade: tenant?.grade?.toString() || prev.school_data.grade,
                        }
                    }
                })
                // Datos del plantel ya registrados en Ajustes de la escuela
                if (tenant?.id) {
                    const { data: sd } = await supabase
                        .from('school_details')
                        .select('official_name, cct, zone, sector, address_municipality, address_state, shift')
                        .eq('tenant_id', tenant.id)
                        .maybeSingle()
                    if (sd) {
                        const shift = String(sd.shift || '').toLowerCase()
                        setFormData(prev => ({
                            ...prev,
                            school_data: {
                                ...prev.school_data,
                                name: sd.official_name || prev.school_data.name,
                                cct: sd.cct || prev.school_data.cct,
                                zone: sd.zone || prev.school_data.zone,
                                sector: sd.sector || prev.school_data.sector,
                                municipality: sd.address_municipality || prev.school_data.municipality,
                                state: sd.address_state || prev.school_data.state,
                                turn: shift ? shift.charAt(0).toUpperCase() + shift.slice(1) : prev.school_data.turn,
                            },
                        }))
                    }
                }
            }
            setLoading(false)
        }
        init()
    }, [id, tenant])

    // Save Draft on Change
    useEffect(() => {
        if (!loading) {
            const draftState = {
                formData,
                currentStep,
                suggestedContents
            }
            localStorage.setItem(`analytical_program_draft_${id || 'new'}`, JSON.stringify(draftState))
        }
    }, [formData, currentStep, suggestedContents, loading, id])

    // Fetch Official Synthetic Program Context
    useEffect(() => {
        const fetchContext = async () => {
            if (!formData.school_data.level) return
            // Try to extract grade from problems or other data if needed.
            // Currently, AnalyticalProgram applies to the whole school/cycle, but often is focused by teachers on a specific grade.
            // If the user's tenant has a specific grade linked, or if they are a teacher, we might deduce it.
            // For now, if no grade is provided, it defaults to Phase 4 for primary. We'll need a grade selector in Step 1.
            const phase = getPhaseFromLevel(formData.school_data.level, formData.school_data.grade)

            try {
                const { data, error } = await supabase
                    .from('synthetic_programs_pdfs')
                    .select('extracted_text')
                    .eq('phase', phase)
                    .maybeSingle()

                if (data && data.extracted_text) {
                    setSyntheticContext(data.extracted_text)
                    console.log(`[AnalyticalProgram] Cargado contexto oficial de Fase ${phase} (${data.extracted_text.length} caracteres)`)
                } else {
                    setSyntheticContext('')
                }
            } catch (error) {
                console.error('Error fetching synthetic context:', error)
            }
        }

        fetchContext()
    }, [formData.school_data.level])

    // --- Actions ---

    const handleNext = () => {
        if (currentStep === 1 && needsField) {
            showToast('Elige el campo formativo de este programa analítico.', 'error')
            return
        }
        if (currentStep < STEPS.length) setCurrentStep(c => c + 1)
    }

    const handleBack = () => {
        if (currentStep > 1) setCurrentStep(c => c - 1)
    }

    const generateDiagnosisNarrative = async () => {
        if (isGenerating) return
        setIsGenerating(true)
        setGenLabel('Redactando el diagnóstico socioeducativo…')
        try {
            const level = formData.school_data.level || 'Secundaria'
            const isPrimary = level.toLowerCase().includes('primaria')
            const primaryContext = isPrimary ? 'ENFOQUE PRIMARIA: Resalta la importancia del desarrollo integral, habilidades fundamentales (lectura, escritura, aritmética), y un entorno lúdico y de evaluación formativa. Usa lenguaje apropiado para primaria.' : ''

            const prompt = `
                Actúa como un director experto de la NEM.
                Redacta un diagnóstico socioeducativo narrativo y profesional integrando los siguientes elementos de la escuela.
                
                Nivel Educativo: ${level}
                
                Contexto Externo:
                - Entorno Geográfico: ${formData.diagnosis.external_context.geo}
                - Factores Sociales: ${formData.diagnosis.external_context.social}
                - Factores Culturales: ${formData.diagnosis.external_context.cultural}

                Contexto Interno:
                - Infraestructura: ${formData.diagnosis.internal_context.infrastructure}
                - Entorno Académico: ${formData.diagnosis.internal_context.environment}

                ${primaryContext}

                Instrucciones Adicionales:
                1. Muestra cómo estos factores (positivos o negativos) impactan el aprendizaje de los alumnos.
                2. Usa un tono analítico, propositivo y humanista.
                3. Organiza en 3 párrafos fluidos y bien conectados, sin usar viñetas.
                ${syntheticContext ? `\nINSPIRACIÓN OFICIAL (PROGRAMA SINTÉTICO FASE CORRESPONDIENTE):\nAlinea este diagnóstico con las especificidades de este documento oficial:\n${syntheticContext.substring(0, 5000)}...\n` : ''}
                
                Responde ÚNICAMENTE con el texto de la narrativa, no agregues saludos ni comentarios extra.
            `
            const narrative = await aiService.generateContent(prompt)

            setFormData(prev => ({
                ...prev,
                diagnosis: {
                    ...prev.diagnosis,
                    narrative_final: narrative || 'Error generando narrativa. Intenta de nuevo.'
                }
            }))
            if (narrative) revealResult('Diagnóstico generado.')
        } catch (e) {
            console.error(e)
            showToast('No se pudo generar el diagnóstico. Intenta de nuevo.', 'error')
        } finally {
            setIsGenerating(false)
            setGenLabel('')
        }
    }


    // --- Render Steps ---

    const renderFieldPicker = () => {
        if (!scopeAll) return null
        return (
            <div className="rounded-3xl border border-indigo-100 bg-indigo-50/60 p-5 sm:p-6">
                <h3 className="text-sm font-black text-indigo-900">Campo formativo de este programa</h3>
                <p className="text-xs text-indigo-800 mt-1 mb-4">Cada campo formativo tiene su propio programa analítico. {scopeAll.fields.length > 1 ? 'Elige para cuál es este.' : 'Se tomó de tus materias.'}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {scopeAll.fields.map(f => {
                        const subs = scopeAll.subjects.filter(sub => sub.field === f).map(sub => sub.name)
                        const other = existingByField[f]
                        const active = programField === f
                        return (
                            <div key={f} className={`rounded-2xl border-2 p-4 bg-white ${active ? 'border-indigo-600' : 'border-slate-200'}`}>
                                <button type="button" disabled={!!other && !active} onClick={() => setProgramField(f)} className="w-full text-left disabled:cursor-not-allowed">
                                    <span className="flex items-center gap-2 text-sm font-black text-slate-900">
                                        <span className={`w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center ${active ? 'border-indigo-600' : 'border-slate-300'}`}>{active && <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />}</span>
                                        {f}
                                    </span>
                                    {subs.length > 0 && <span className="block text-xs text-slate-500 mt-1 ml-7">{subs.join(', ')}</span>}
                                </button>
                                {other && !active && (
                                    <button type="button" onClick={() => navigate(`/analytical-program/${other}`)} className="mt-2 ml-7 text-xs font-black text-indigo-700 underline">Ya tienes este programa · abrirlo</button>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    const renderStep1 = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            {renderFieldPicker()}
            <p className="text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
                Estos datos se llenan con lo que registraste en <button type="button" onClick={() => navigate('/settings?tab=school')} className="font-black text-indigo-700 underline">Configuración → Datos de la escuela</button>. Si algo está mal, corrígelo allá para que se actualice en todo el sistema.
            </p>
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                <h3 className="text-lg font-black text-gray-800 mb-6 uppercase tracking-wide">Datos de Identificación</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Nombre de la Escuela</label>
                        <input aria-label="Nombre de la Escuela"
                            value={formData.school_data.name}
                            onChange={e => setFormData({ ...formData, school_data: { ...formData.school_data, name: e.target.value } })}
                            className="w-full bg-gray-50 border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-700"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">CCT</label>
                        <input aria-label="CCT"
                            value={formData.school_data.cct}
                            onChange={e => setFormData({ ...formData, school_data: { ...formData.school_data, cct: e.target.value } })}
                            className="w-full bg-gray-50 border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-700"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Zona Escolar</label>
                        <input aria-label="Zona Escolar"
                            value={formData.school_data.zone}
                            onChange={e => setFormData({ ...formData, school_data: { ...formData.school_data, zone: e.target.value } })}
                            className="w-full bg-gray-50 border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-700"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Sector</label>
                        <input aria-label="Sector"
                            value={formData.school_data.sector}
                            onChange={e => setFormData({ ...formData, school_data: { ...formData.school_data, sector: e.target.value } })}
                            className="w-full bg-gray-50 border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-700"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Municipio</label>
                        <input aria-label="Municipio"
                            value={formData.school_data.municipality}
                            onChange={e => setFormData({ ...formData, school_data: { ...formData.school_data, municipality: e.target.value } })}
                            className="w-full bg-gray-50 border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-700"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Matrícula Total</label>
                        <input aria-label="Matrícula Total"
                            value={formData.school_data.students_total}
                            onChange={e => setFormData({ ...formData, school_data: { ...formData.school_data, students_total: e.target.value } })}
                            className="w-full bg-gray-50 border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-700"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Nivel Educativo</label>
                        <select aria-label="Nivel Educativo"
                            value={formData.school_data.level}
                            onChange={e => setFormData({ ...formData, school_data: { ...formData.school_data, level: e.target.value } })}
                            className="w-full bg-gray-50 border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-700"
                        >
                            <option value="Primaria">Primaria</option>
                            <option value="Secundaria">Secundaria</option>
                            <option value="Telesecundaria">Telesecundaria</option>
                            <option value="Preparatoria">Preparatoria / Bachillerato</option>
                        </select>
                    </div>
                </div>

                {/* Additional Info Section (Grade and Phase) */}
                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="squishy-card p-6 bg-indigo-50 border-2 border-indigo-100 flex items-center gap-4">
                        <div className="p-4 bg-indigo-100 text-indigo-600 rounded-2xl">
                            <GraduationCap className="h-8 w-8" />
                        </div>
                        <div>
                            <p className="text-xs font-black text-indigo-400 uppercase tracking-widest">Grado Asignado</p>
                            {formData.school_data.level.toLowerCase().includes('primaria') ? (
                                <select
                                    value={formData.school_data.grade}
                                    onChange={e => setFormData({ ...formData, school_data: { ...formData.school_data, grade: e.target.value } })}
                                    className="mt-1 block w-full bg-white border-indigo-200 rounded-xl px-3 py-2 text-sm font-bold text-indigo-700"
                                >
                                    <option value="">Seleccione Grado...</option>
                                    <option value="1">1° Año (Fase 3)</option>
                                    <option value="2">2° Año (Fase 3)</option>
                                    <option value="3">3° Año (Fase 4)</option>
                                    <option value="4">4° Año (Fase 4)</option>
                                    <option value="5">5° Año (Fase 5)</option>
                                    <option value="6">6° Año (Fase 5)</option>
                                </select>
                            ) : (
                                <h4 className="text-2xl font-black text-indigo-900 mt-1">
                                    {formData.school_data.grade ? `${formData.school_data.grade}° Grado` : 'No aplicable / No asignado'}
                                </h4>
                            )}
                        </div>
                    </div>
                    <div className="squishy-card p-6 bg-purple-50 border-2 border-purple-100 flex items-center gap-4">
                        <div className="p-4 bg-purple-100 text-purple-600 rounded-2xl">
                            <Layers className="h-8 w-8" />
                        </div>
                        <div>
                            <p className="text-xs font-black text-purple-400 uppercase tracking-widest">Fase NEM</p>
                            <h4 className="text-2xl font-black text-purple-900 mt-1">
                                {(() => {
                                    // Local minimal logic to get phase for display in the UI based on current form state
                                    const lvl = formData.school_data.level?.toLowerCase() || ''
                                    let ph = '2' // preschool default
                                    if (lvl.includes('secundaria')) ph = '6'
                                    else if (lvl.includes('primaria')) {
                                        const g = parseInt(formData.school_data.grade || '0')
                                        if (g === 1 || g === 2) ph = '3'
                                        else if (g === 3 || g === 4) ph = '4'
                                        else if (g === 5 || g === 6) ph = '5'
                                        else ph = 'Pendiente'
                                    }
                                    return ph !== 'Pendiente' ? `Fase ${ph}` : 'Pendiente'
                                })()}
                            </h4>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )

    const handleAddCustom = (category: string, sub: string, inputKey: string) => {
        // @ts-expect-error -- pendiente de tipar
        const val = customInputs[inputKey].trim()
        if (!val) return
        toggleOption(category, sub, val)
        setCustomInputs(prev => ({ ...prev, [inputKey]: '' }))
    }

    const renderOptionGroup = (title: string, options: string[], category: string, sub: string, inputKey: string) => {
        // @ts-expect-error -- pendiente de tipar
        const currentSelection = formData.diagnosis[category][sub].split(', ').filter(Boolean)
        // Find selected items that are NOT in the default options (custom ones)
        const customSelected = currentSelection.filter((s: string) => !options.includes(s))

        return (
            <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-3 block">{title}</label>
                <div className="flex flex-wrap gap-2 mb-3">
                    {/* Default Options */}
                    {options.map(opt => (
                        <button
                            key={opt}
                            onClick={() => toggleOption(category, sub, opt)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${currentSelection.includes(opt)
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                                }`}
                        >
                            {opt}
                        </button>
                    ))}
                    {/* Render Custom Selected items as Chips */}
                    {customSelected.map((opt: string) => (
                        <button
                            key={opt}
                            onClick={() => toggleOption(category, sub, opt)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all border bg-indigo-600 border-indigo-600 text-white shadow-md flex items-center gap-1"
                        >
                            {opt} <span className="opacity-50">×</span>
                        </button>
                    ))}
                </div>
                {/* Custom Input */}
                <div className="flex items-center gap-2 max-w-sm">
                    <input
                        type="text"
                        placeholder="Agregar otro..."
                        className="flex-1 bg-gray-50 border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                        // @ts-expect-error -- pendiente de tipar
                        value={customInputs[inputKey]}
                        onChange={(e) => setCustomInputs(prev => ({ ...prev, [inputKey]: e.target.value }))}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault()
                                handleAddCustom(category, sub, inputKey)
                            }
                        }}
                    />
                    <button aria-label="Confirmar"
                        onClick={() => handleAddCustom(category, sub, inputKey)}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-lg p-1.5 transition-colors"
                    >
                        <Check className="w-4 h-4" />
                    </button>
                </div>
            </div>
        )
    }

    const renderStep2 = () => (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
            <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-3xl flex items-start gap-4">
                <div className="p-3 bg-white rounded-xl shadow-sm">
                    <Sparkles className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                    <h3 className="text-sm font-black text-indigo-900 uppercase tracking-wide">Asistente de Diagnóstico IA</h3>
                    <p className="text-sm text-indigo-700 mt-1">
                        Selecciona o agrega las características de tu escuela. La IA usará estos datos para redactar el diagnóstico.
                    </p>
                </div>
            </div>

            {/* Contexto Externo */}
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                <h3 className="text-lg font-black text-gray-800 mb-6 uppercase tracking-wide flex items-center">
                    <BookOpen className="w-5 h-5 mr-2" /> 1. Contexto Externo
                </h3>
                <div className="space-y-8">
                    {renderOptionGroup('Entorno Geográfico', CONTEXT_OPTIONS.geo, 'external_context', 'geo', 'geo')}
                    {renderOptionGroup('Factores Sociales', CONTEXT_OPTIONS.social, 'external_context', 'social', 'social')}
                    {renderOptionGroup('Factores Culturales', CONTEXT_OPTIONS.cultural, 'external_context', 'cultural', 'cultural')}
                </div>
            </div>

            {/* Contexto Interno */}
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                <h3 className="text-lg font-black text-gray-800 mb-6 uppercase tracking-wide flex items-center">
                    <School className="w-5 h-5 mr-2" /> 2. Contexto Interno
                </h3>
                <div className="space-y-8">
                    {renderOptionGroup('Infraestructura', INTERNAL_OPTIONS.infra, 'internal_context', 'infrastructure', 'infra')}
                    {renderOptionGroup('Características Alumnos', INTERNAL_OPTIONS.academic, 'internal_context', 'environment', 'academic')}
                </div>
            </div>

            {/* Generar Narrativa */}
            <div className="flex justify-center pt-8">
                <button
                    onClick={generateDiagnosisNarrative}
                    disabled={isGenerating}
                    className="bg-gray-900 text-white px-10 py-5 rounded-3xl font-black uppercase tracking-widest shadow-2xl hover:scale-105 transition-all flex items-center gap-4 disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                    {isGenerating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6 text-yellow-400 group-hover:rotate-12 transition-transform" />}
                    <span className="text-lg">Generar Diagnóstico IA</span>
                </button>
            </div>

            {/* Resultado Narrativa - Editable */}
            {formData.diagnosis.narrative_final && (
                <div ref={resultRef} tabIndex={-1} className="bg-white p-5 sm:p-8 rounded-3xl border border-gray-200 shadow-xl animate-in zoom-in duration-300 ring-4 ring-yellow-50/50 scroll-mt-24 outline-none">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-sm font-black text-gray-800 uppercase tracking-wide flex items-center">
                            <CheckCircle2 className="w-5 h-5 mr-2 text-green-500" /> Diagnóstico Generado
                        </h3>
                        <span className="text-[11px] font-bold text-gray-500 uppercase bg-gray-100 px-3 py-1 rounded-full">Editable</span>
                    </div>
                    <textarea
                        className="w-full bg-gray-50 border-gray-100 rounded-xl p-6 text-sm leading-relaxed font-medium text-gray-700 focus:ring-2 focus:ring-indigo-500 min-h-[300px]"
                        value={formData.diagnosis.narrative_final}
                        onChange={e => setFormData({ ...formData, diagnosis: { ...formData.diagnosis, narrative_final: e.target.value } })}
                    />
                </div>
            )}
        </div>
    )

    // --- Step 3: Problemática ---
    const PROBLEMS_CATALOG = [
        'Bajo nivel de comprensión lectora y escritura',
        'Dificultades en el pensamiento lógico-matemático',
        'Violencia escolar y acoso (bullying)',
        'Contaminación ambiental y falta de conciencia ecológica',
        'Malos hábitos alimenticios y sedentarismo',
        'Falta de identidad cultural y sentido de pertenencia',
        'Uso irresponsable de redes sociales y tecnología'
    ]

    const handleGenerateLinkage = async (specificProblems?: any[]) => {
        if (isGenerating) return // Prevent multiple concurrent calls
        setIsGenerating(true)
        try {
            const problems = specificProblems || formData.problems
            if (problems.length === 0) return

            const prompt = `
            Actúa como un experto de la NEM.
            Para las siguientes problemáticas, identifica para CADA UNA el Rasgo del Perfil de Egreso más relevante y los Ejes Articuladores que se vinculan directamente.

            Problemáticas:
            ${problems.map((p, i) => `${i + 1}. ${p.description}`).join('\n')}

            Responde ÚNICAMENTE un objeto JSON con este formato:
            {
                "linkages": [
            {
                "description": "Texto exacto de la problemática",
            "trait_id": "Descripción corta del rasgo del perfil de egreso",
            "axes_ids": ["Eje 1", "Eje 2"]
                        }
            ]
                }

            Ejes Articuladores válidos: Inclusión, Pensamiento Crítico, Interculturalidad crítica, Igualdad de género, Vida saludable, Apropiación de las culturas a través de la lectura y la escritura, Artes y experiencias estéticas.

            Rasgos del Perfil de Egreso (Resumen):
            1. Ciudadanía y derecho a una vida digna.
            2. Valoración de la diversidad (etnia, cultura, lengua).
            3. Igualdad de derechos entre mujeres y hombres.
            4. Valoración de potencialidades (cognitivas, físicas, afectivas).
            5. Pensamiento propio y juicio autónomo.
            6. Sentido de pertenencia a la naturaleza y medio ambiente.
            7. Interpretación de hechos históricos y sociales.
            8. Diálogo respetuoso y aprecio a la diversidad.
            9. Comunicación mediante diversos lenguajes.
            10. Pensamiento crítico y valoración de saberes científicos/humanísticos.

            ${syntheticContext ? `\nDOCUMENTO OFICIAL DE REFERENCIA (RESUMEN):\n${syntheticContext.substring(0, 2500)}...\n` : ''}
            `

            const response = await aiService.generateContent(prompt, true)
            const data = JSON.parse(response)

            const updatedProblems = problems.map(prob => {
                const match = (data.linkages || []).find((l: any) => l.description === prob.description)
                return {
                    ...prob,
                    trait_id: match?.trait_id || prob.trait_id || 'Rasgo no identificado',
                    axes_ids: match?.axes_ids || prob.axes_ids || []
                }
            })

            setFormData(prev => ({ ...prev, problems: updatedProblems }))
        } catch (e: any) {
            console.error(e)
            if (e.message?.includes('429') || e.message?.includes('limit')) {
                alert('Estamos procesando muchas peticiones. Por favor, espera unos segundos y vuelve a intentar vincular con el botón "Vincular con NEM".')
            } else {
                alert('Error vinculando problemáticas con NEM. Por favor intenta de nuevo.')
            }
        } finally {
            setIsGenerating(false)
        }
    }

    const toggleProblem = (prob: string) => {
        setFormData(prev => {
            const exists = prev.problems.some(p => p.description === prob)
            if (exists) {
                return { ...prev, problems: prev.problems.filter(p => p.description !== prob) }
            } else {
                const newProblems = [...prev.problems, { id: Date.now(), description: prob }]
                // Auto-trigger linkage with the new list immediately if not already busy
                if (!isGenerating) {
                    handleGenerateLinkage(newProblems)
                }
                return { ...prev, problems: newProblems }
            }
        })
    }

    const renderStep3 = () => (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
            <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-lg text-center">
                <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Target className="w-8 h-8 text-rose-500" />
                </div>
                <h2 className="text-2xl font-black text-gray-900 mb-2">Selecciona las Problemáticas</h2>
                <p className="text-gray-500 max-w-lg mx-auto mb-8">Elige una o más situaciones prioritarias (se recomiendan 2 o 3). La IA las vinculará con el Perfil de Egreso y los Ejes Articuladores.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left max-w-4xl mx-auto">
                    {/* Default Catalog */}
                    {PROBLEMS_CATALOG.map((prob, idx) => {
                        const isSelected = formData.problems.some(p => p.description === prob)
                        return (
                            <button
                                key={`cat-${idx}`}
                                onClick={() => toggleProblem(prob)}
                                className={`p-6 rounded-2xl border-2 transition-all flex items-center ${isSelected
                                    ? 'bg-rose-50 border-rose-500 shadow-xl shadow-rose-100 scale-105'
                                    : 'bg-white border-gray-100 hover:border-gray-200 text-gray-600'
                                    }`}
                            >
                                <div className={`w-6 h-6 rounded-full border-2 mr-4 flex items-center justify-center ${isSelected ? 'border-rose-500 bg-rose-500' : 'border-gray-300'
                                    }`}>
                                    {isSelected && <Check className="w-4 h-4 text-white" />}
                                </div>
                                <span className={`font-bold text-sm ${isSelected ? 'text-rose-900' : 'text-gray-600'
                                    }`}>{prob}</span>
                            </button>
                        )
                    })}

                    {/* Custom Selected Problems */}
                    {formData.problems.filter(p => !PROBLEMS_CATALOG.includes(p.description)).map((p, idx) => (
                        <button
                            key={`custom-${idx}`}
                            onClick={() => toggleProblem(p.description)}
                            className="p-6 rounded-2xl border-2 bg-rose-50 border-rose-500 shadow-xl shadow-rose-100 scale-105 transition-all flex items-center"
                        >
                            <div className="w-6 h-6 rounded-full border-2 mr-4 flex items-center justify-center border-rose-500 bg-rose-500">
                                <Check className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-bold text-sm text-rose-900">{p.description}</span>
                        </button>
                    ))}
                </div>

                {/* Custom Problem */}
                <div className="max-w-4xl mx-auto mt-6 flex gap-2">
                    <input
                        id="custom-problem-input"
                        placeholder="O escribe otra problemática personalizada..."
                        className="flex-1 min-w-0 px-3 text-center bg-gray-50 border-transparent rounded-2xl py-4 font-bold text-gray-600 focus:bg-white focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                toggleProblem((e.target as HTMLInputElement).value)
                                // @ts-expect-error -- pendiente de tipar
                                e.target.value = ''
                            }
                        }}
                    />
                    <button
                        onClick={() => {
                            const input = document.getElementById('custom-problem-input') as HTMLInputElement
                            if (input.value) {
                                toggleProblem(input.value)
                                input.value = ''
                            }
                        }}
                        className="bg-rose-500 text-white px-4 sm:px-6 shrink-0 rounded-2xl font-bold uppercase text-xs"
                    >
                        Agregar
                    </button>
                </div>
            </div>

            {/* Auto-Linkage Section */}
            {formData.problems.length > 0 && formData.problems.some(p => !p.trait_id) && (
                <div className="flex justify-center">
                    <button
                        onClick={() => handleGenerateLinkage()}
                        disabled={isGenerating}
                        className="bg-gray-900 text-white px-8 py-4 rounded-full font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all flex items-center gap-3"
                    >
                        {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5 text-yellow-400" />}
                        Vincular con NEM (IA)
                    </button>
                </div>
            )}

            {/* Linkage Result */}
            {formData.problems.length > 0 && formData.problems.every(p => p.trait_id) && (
                <div className="space-y-6">
                    <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-[2.5rem] p-10 text-white shadow-2xl animate-in fade-in slide-in-from-bottom-8">
                        <div className="flex items-center gap-4 mb-8 border-b border-white/10 pb-6">
                            <Sparkles className="w-8 h-8 text-yellow-400" />
                            <div>
                                <h3 className="text-xl font-black">Vinculación Metodológica Generada</h3>
                                <p className="text-indigo-200 text-sm font-medium">La IA ha conectado tus problemáticas con el currículo oficial.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {formData.problems.map((prob, idx) => (
                                <div key={idx} className="bg-white/10 p-8 rounded-3xl backdrop-blur-sm border border-white/5">
                                    <span className="text-indigo-300 text-[11px] font-black uppercase tracking-widest block mb-3">Problemática {idx + 1}</span>
                                    <p className="font-bold text-lg leading-tight mb-6">{prob.description}</p>

                                    <div className="space-y-4 pt-4 border-t border-white/10">
                                        <div>
                                            <span className="text-indigo-300 text-[11px] font-black uppercase tracking-widest block mb-2">Rasgo Perfil de Egreso</span>
                                            <p className="text-sm font-medium leading-relaxed">{prob.trait_id}</p>
                                        </div>
                                        <div>
                                            <span className="text-indigo-300 text-[11px] font-black uppercase tracking-widest block mb-2">Ejes Articuladores</span>
                                            <div className="flex flex-wrap gap-2">
                                                {prob.axes_ids?.map((axis: string) => (
                                                    <span key={axis} className="bg-indigo-500/50 px-3 py-1 rounded-lg text-xs font-bold border border-indigo-400/30">{axis}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )

    // ---------- Contexto y alcance para la IA ----------

    /** Bloque de alcance curricular: se incluye en TODAS las solicitudes a la IA. */
    const scopeBlock = () => {
        if (!scope) return ''
        const grades = scope.grades.map(g => `${g}°`).join(', ')
        if (scope.generalist) {
            return `ALCANCE CURRICULAR DEL DOCENTE (OBLIGATORIO)
- Nivel: ${scope.levelLabel}. Fase ${scope.phase ?? ''}. Grado(s) que atiende: ${grades}.
- Docente frente a grupo: atiende los cuatro campos formativos (${scope.fields.join('; ')}).
- Organiza SIEMPRE por campo formativo, sin mezclar propósitos, contenidos ni PDA de un campo en otro.`
        }
        return `ALCANCE CURRICULAR DEL DOCENTE (OBLIGATORIO)
- Nivel: ${scope.levelLabel}. Fase ${scope.phase ?? ''}. Grado(s) que atiende: ${grades}.
- Disciplina(s) que imparte: ${scope.subjects.map(s => `${s.label || s.name} (campo formativo: ${s.field}${s.specialty ? `; especialidad o énfasis: ${s.specialty}` : ''})`).join('; ')}.
- Campo(s) formativo(s) permitido(s): ${scope.fields.join('; ')}.
REGLAS ESTRICTAS:
1. Trabaja EXCLUSIVAMENTE con esa(s) disciplina(s). No generes, agregues ni menciones contenidos, PDA, propósitos o actividades de otras asignaturas.
2. No nombres ni vincules otros campos formativos. Si imparte disciplinas de campos distintos, trata cada una dentro de su propio campo.
3. Usa solo los contenidos y PDA oficiales que se te entregan; contextualízalos, no los sustituyas.`
    }

    /** Diagnóstico, datos del plantel y problemática comunitaria ya registrados en los pasos 1–3. */
    const contextBlock = () => {
        const sd = formData.school_data
        const d = formData.diagnosis
        const place = [sd.municipality, sd.state].filter(Boolean).join(', ')
        const ext = [d.external_context.geo, d.external_context.social, d.external_context.cultural].filter(Boolean).join('; ')
        const int = [d.internal_context.infrastructure, d.internal_context.environment].filter(Boolean).join('; ')
        const problems = formData.problems.map((p: any, i: number) =>
            `${i + 1}. ${p.description}${p.trait_id ? ` (rasgo del perfil: ${p.trait_id})` : ''}${p.axes_ids?.length ? ` (ejes: ${p.axes_ids.join(', ')})` : ''}`).join('\n')
        return `DATOS DEL PLANTEL: ${sd.name || 'Escuela'}${sd.cct ? ` (CCT ${sd.cct})` : ''}, ${sd.level}${sd.turn ? `, turno ${sd.turn}` : ''}${place ? `, ${place}` : ''}.
LECTURA DE LA REALIDAD (diagnóstico socioeducativo):
${d.narrative_final || `Contexto externo: ${ext || 'sin datos'}. Contexto interno: ${int || 'sin datos'}.`}
PROBLEMÁTICA(S) COMUNITARIA(S) PRIORIZADA(S):
${problems || 'Sin problemática registrada.'}`
    }

    const parseJson = (text: string) => {
        try { return JSON.parse(text) } catch {
            const m = String(text).match(/\{[\s\S]*\}/)
            return m ? JSON.parse(m[0]) : {}
        }
    }

    const handleSuggestContents = async () => {
        if (isGenerating) return
        if (!scope) { showToast('Todavía estamos cargando tus materias. Intenta de nuevo en un momento.', 'info'); return }
        if (scope.missingSubjects) {
            showToast('Registra en tu perfil la(s) materia(s) que impartes para generar tu programa analítico.', 'error')
            return
        }
        setIsGenerating(true)
        setGenLabel('Revisando el programa sintético de tus disciplinas…')
        try {
            const catalog = await loadScopedCatalog(scope)
            if (catalog.length === 0) {
                showToast('No encontramos contenidos oficiales para tus materias y grados. Revisa tus materias en tu perfil.', 'error')
                return
            }
            // Identificadores cortos para el modelo; el campo y la materia salen del catálogo, no de la IA.
            const byKey = new Map<string, ScopedContent>()
            const listing = catalog.map((c, i) => {
                const key = `C${i + 1}`
                byKey.set(key, c)
                const pdas = scope.grades.filter(g => c.pdas[g]).map(g => `    ${g}°: ${c.pdas[g]}`).join('\n')
                return `[${key}] Campo: ${c.field_of_study}${c.subject_name ? ` | Disciplina: ${c.subject_name}` : ''}\n  Contenido: ${c.content}\n  PDA oficiales:\n${pdas || '    (sin PDA por grado)'}`
            }).join('\n')

            const perUnit = scope.generalist ? 'entre 2 y 4 contenidos por cada campo formativo' : 'entre 3 y 6 contenidos por cada disciplina'
            const prompt = `
Eres asesor técnico pedagógico experto en la Nueva Escuela Mexicana (Plan de Estudio 2022, Programas Sintéticos 2024).
Tarea: SEGUNDO PLANO del Programa Analítico (contextualización). Elige del catálogo oficial los contenidos que mejor atienden la problemática y contextualiza sus PDA para esta escuela.

${scopeBlock()}

${contextBlock()}

CATÁLOGO OFICIAL (ya filtrado a las disciplinas y grados del docente; usa solo estos identificadores):
${listing}

INSTRUCCIONES:
- Selecciona ${perUnit}, priorizando los que tengan relación directa con la problemática y el diagnóstico.
- Para cada contenido, redacta el PDA contextualizado de CADA grado que atiende el docente (${scope.grades.map(g => `${g}°`).join(', ')}), partiendo del PDA oficial de ese grado: conserva su intención y nivel de logro, e incorpora la realidad de la comunidad (lugares, prácticas, necesidades). Tercera persona, redacción formal, sin viñetas.
- En "vinculo" explica en una oración cómo ese contenido atiende la problemática, sin mencionar otras disciplinas.
- No inventes contenidos ni identificadores.

Responde ÚNICAMENTE JSON:
{"selected":[{"id":"C1","pdas":{"1":"PDA contextualizado 1°"},"vinculo":"..."}]}
`
            setGenLabel('Contextualizando PDA con el diagnóstico de tu escuela…')
            const data = parseJson(await aiService.generateContent(prompt, true))

            const chosen: any[] = []
            for (const sel of (data.selected || []) as any[]) {
                const c = byKey.get(String(sel?.id ?? '').trim())
                if (!c || chosen.some(x => x.id === c.id)) continue   // se descarta todo lo que no esté en el catálogo filtrado
                const pdas: Record<number, string> = {}
                for (const g of scope.grades) {
                    const txt = sel?.pdas?.[g] ?? sel?.pdas?.[String(g)]
                    if (typeof txt === 'string' && txt.trim()) pdas[g] = txt.trim()
                    else if (c.pdas[g]) pdas[g] = c.pdas[g]
                }
                chosen.push({ ...c, pdas, official_pdas: c.pdas, pda: Object.values(pdas)[0] || '', reason: sel?.vinculo || '', selected: true })
            }
            // Cada disciplina (o campo, en primaria) debe quedar representada al menos con un contenido oficial
            const units = scope.generalist ? scope.fields.map(f => ({ field: f as Campo, subject: null as string | null })) : scope.subjects.map(s => ({ field: s.field as Campo, subject: s.name }))
            for (const u of units) {
                const has = chosen.some(x => x.field_of_study === u.field && (!u.subject || (x.subject_name && sameDiscipline(u.subject, x.subject_name, u.field, x.field_of_study))))
                if (has) continue
                const fallback = catalog.find(c => c.field_of_study === u.field && (!u.subject || (c.subject_name && sameDiscipline(u.subject, c.subject_name, u.field, c.field_of_study))))
                if (fallback) chosen.push({ ...fallback, pdas: fallback.pdas, official_pdas: fallback.pdas, pda: Object.values(fallback.pdas)[0] || '', reason: '', selected: true })
            }
            if (chosen.length === 0) throw new Error('La IA no devolvió contenidos válidos')

            // Se conservan los PDA propios que el docente ya había agregado
            setSuggestedContents(prev => [...chosen, ...prev.filter(c => c.is_custom)])
            revealResult(`Propuesta lista: ${chosen.length} contenidos de ${scope.generalist ? 'tus campos formativos' : scope.subjects.map(s => s.name).join(', ')}.`)
        } catch (e) {
            console.error(e)
            showToast('No se pudo generar la propuesta de contenidos. Intenta de nuevo.', 'error')
        } finally {
            setIsGenerating(false)
            setGenLabel('')
        }
    }

    // PDA propios del docente que pertenecen a su alcance (no se ofrecen los de otras disciplinas)
    const scopedCustomPdas = customPdas.filter((p: any) => {
        if (!scope || scope.generalist) return true
        const campo = toCampo(p.field_of_study)
        if (!campo || !scope.fields.includes(campo)) return false
        return !p.subject_name || scope.subjects.some(s => sameDiscipline(s.name, p.subject_name, s.field, campo))
    })

    const renderStep4 = () => {
        const grouped = suggestedContents.reduce((acc: any, curr) => {
            const campo = toCampo(curr.field_of_study) || curr.field_of_study || 'Otros'
            const field = curr.subject_name ? `${campo} · ${curr.subject_name}` : campo
            if (!acc[field]) acc[field] = []
            acc[field].push(curr)
            return acc
        }, {})

        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-3xl flex items-start gap-4">
                    <div className="p-3 bg-white rounded-xl shadow-sm">
                        <Users className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-indigo-900 uppercase tracking-wide">Segundo Plano: Contextualización</h3>
                        <p className="text-sm text-indigo-700 mt-1">
                            La IA elige, del programa sintético oficial, los contenidos de <strong>tus disciplinas</strong> que mejor atienden la problemática
                            {formData.problems.length > 0 && <> <strong>"{formData.problems.map(p => p.description).join(', ')}"</strong></>} y contextualiza sus PDA con el diagnóstico de tu escuela.
                        </p>
                    </div>
                </div>

                {/* Alcance curricular: qué entra al programa y qué no */}
                {scopeLoading ? (
                    <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando tus materias…</p>
                ) : scope?.missingSubjects ? (
                    <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        <p className="font-black">Registra tus materias para continuar</p>
                        <p className="mt-1">El programa analítico se construye solo con las disciplinas que impartes. Agrégalas en Configuración → Mis materias y vuelve a este paso.</p>
                        <button type="button" onClick={() => navigate('/settings?tab=subjects')} className="mt-3 px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-black">Registrar mis materias</button>
                    </div>
                ) : scope && (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <p className="text-xs font-black text-slate-500 mb-2">Tu programa incluirá únicamente</p>
                        <div className="flex flex-wrap gap-2">
                            {scope.generalist
                                ? scope.fields.map(f => <span key={f} className="px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700">{f}</span>)
                                : scope.subjects.map(s => <span key={s.name} className="px-3 py-1 rounded-full bg-white border border-indigo-100 text-xs font-bold text-indigo-800">{s.label || s.name} <span className="text-slate-500 font-medium">· {s.field}</span></span>)}
                            <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-600">{scope.grades.map(g => `${g}°`).join(', ')} grado</span>
                        </div>
                    </div>
                )}

                {suggestedContents.filter(c => !c.is_custom).length === 0 ? (
                    <div className="flex justify-center py-10">
                        <button
                            onClick={handleSuggestContents}
                            disabled={isGenerating || !scope || scope.missingSubjects}
                            className="bg-gray-900 text-white px-10 py-5 rounded-3xl font-black uppercase tracking-widest shadow-2xl hover:scale-105 transition-all flex items-center gap-4 group"
                        >
                            {isGenerating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6 text-yellow-400 group-hover:rotate-12 transition-transform" />}
                            <span className="text-lg">Sugerir Contenidos (IA)</span>
                        </button>
                    </div>
                ) : (
                    <div ref={resultRef} tabIndex={-1} className="grid grid-cols-1 gap-6 scroll-mt-24 outline-none">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-black text-slate-800 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-600" /> Propuesta de contenidos lista · revisa y ajusta</p>
                            <button type="button" onClick={handleSuggestContents} disabled={isGenerating}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Generar otra propuesta
                            </button>
                        </div>
                        {Object.entries(grouped).map(([field, contents]: any) => (
                            <div key={field} className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                                <div className="bg-gray-50 px-8 py-4 border-b border-gray-100">
                                    <h4 className="font-black text-gray-700 uppercase tracking-wide text-sm">{field}</h4>
                                </div>
                                <div className="p-4 space-y-2">
                                    {contents.map((content: any) => (
                                        <label key={content.id} className="flex items-start gap-4 p-4 rounded-xl hover:bg-gray-50 transition-all cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={content.selected}
                                                onChange={() => {
                                                    const newSugg = suggestedContents.map(c => c.id === content.id ? { ...c, selected: !c.selected } : c)
                                                    setSuggestedContents(newSugg)
                                                }}
                                                className="mt-1 w-5 h-5 rounded-md border-gray-300 text-indigo-600 focus:ring-indigo-500 transition-all"
                                            />
                                            <div className="flex-1">
                                                <p className="font-bold text-gray-800 text-sm mb-1">{content.content}</p>
                                                {content.pdas && Object.keys(content.pdas).length > 0 ? (
                                                    <div className="space-y-1.5 mt-1">
                                                        {Object.entries(content.pdas).map(([g, txt]: any) => (
                                                            <p key={g} className="text-xs text-gray-600 leading-relaxed"><span className="font-black text-indigo-700">{g}°</span> {txt}</p>
                                                        ))}
                                                        {content.reason && <p className="text-xs text-emerald-800 bg-emerald-50 rounded-lg px-2 py-1 mt-1">Vínculo con la problemática: {content.reason}</p>}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-gray-500 font-medium line-clamp-2">{content.is_custom && <span className="mr-1 text-amber-600 font-black">★ Propio ·</span>}{content.pda || content.pda_grade_1 || content.pda_grade_2 || content.pda_grade_3}</p>
                                                )}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Mis PDAs: contenidos y PDAs propios, contextualizados por el docente */}
                <div className="bg-amber-50/60 rounded-[2rem] border border-amber-100 p-5 sm:p-6 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h4 className="font-black text-amber-900 text-sm uppercase tracking-wide">Mis PDAs propios</h4>
                            <p className="text-xs text-amber-800">Súmalos a tu programa. Puedes crearlos o mejorarlos en cualquier momento (por ejemplo, en el CTE).</p>
                        </div>
                        <button type="button" onClick={() => navigate('/mis-pdas')} className="px-3 py-2 rounded-xl bg-white border border-amber-200 text-xs font-black text-amber-800">Crear o editar PDAs</button>
                    </div>
                    {scopedCustomPdas.length === 0 ? (
                        <p className="text-sm text-amber-800/80">Aún no tienes PDAs propios de tus materias.</p>
                    ) : (
                        <div className="space-y-2">
                            {scopedCustomPdas.map((p: any) => {
                                const added = suggestedContents.some(c => c.id === `custom:${p.id}`)
                                return (
                                    <div key={p.id} className="flex items-start gap-3 bg-white rounded-xl border border-amber-100 p-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">{p.field_of_study}{p.subject_name ? ` · ${p.subject_name}` : ''}</p>
                                            <p className="text-sm font-bold text-gray-800">{p.content}</p>
                                            <p className="text-xs text-gray-500 line-clamp-2">{p.pda}</p>
                                        </div>
                                        <button type="button" disabled={added} onClick={() => addCustomPda(p)} className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-black disabled:bg-emerald-100 disabled:text-emerald-700">
                                            {added ? 'Agregado' : 'Agregar'}
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // --- Paso 6: Codiseño de contenidos (tercer plano) ---
    const handleGenerateDidactic = async () => {
        if (isGenerating || !scope) return
        const selected = suggestedContents.filter(c => c.selected)
        if (selected.length === 0) {
            showToast('Primero selecciona contenidos en el paso "Contextualización".', 'info')
            return
        }
        // Solo entra lo que pertenece al alcance del docente (defensa ante borradores antiguos)
        const inScope = selected.filter(c => {
            const campo = toCampo(c.field_of_study)
            if (!campo || !scope.fields.includes(campo)) return false
            if (scope.generalist || !c.subject_name) return true
            return scope.subjects.some(sub => sameDiscipline(sub.name, c.subject_name, sub.field, campo))
        })
        if (inScope.length === 0) {
            showToast('Los contenidos seleccionados no corresponden a tus materias. Genera de nuevo la contextualización.', 'error')
            return
        }
        setIsGenerating(true)
        setGenLabel('Diseñando la propuesta didáctica de tus contenidos…')
        try {
            const keyOf = new Map<string, any>()
            const listing = inScope.map((c, i) => {
                const k = `C${i + 1}`
                keyOf.set(k, c)
                const campo = toCampo(c.field_of_study) as Campo
                const pdas = c.pdas && Object.keys(c.pdas).length
                    ? Object.entries(c.pdas).map(([g, t]) => `    ${g}°: ${t}`).join('\n')
                    : `    ${c.pda || ''}`
                return `[${k}] Campo: ${campo}${c.subject_name ? ` | Disciplina: ${c.subject_name}` : ''} | Metodología sugerida para el campo: ${FIELD_METHODOLOGY[campo]}\n  Contenido: ${c.content}\n  PDA contextualizados:\n${pdas}`
            }).join('\n')

            const prompt = `
Eres asesor técnico pedagógico experto en la Nueva Escuela Mexicana.
Tarea: TERCER PLANO del Programa Analítico (codiseño y plano didáctico) para los contenidos listados.

${scopeBlock()}

${contextBlock()}

CONTENIDOS A PLANIFICAR (usa solo estos identificadores):
${listing}

Para CADA contenido define:
- "metodologia": la metodología sociocrítica del campo (la sugerida arriba, salvo que otra del Plan 2022 sea claramente mejor) y, en una frase, el proyecto o situación concreta en la comunidad.
- "evaluacion": estrategia de evaluación formativa con instrumento (p. ej., lista de cotejo, rúbrica, diario, portafolio) y producto o evidencia.
- "temporalidad": duración estimada (p. ej., "2 semanas", "10 sesiones").
- "ejes": 1 a 3 ejes articuladores pertinentes (Inclusión; Pensamiento crítico; Interculturalidad crítica; Igualdad de género; Vida saludable; Apropiación de las culturas a través de la lectura y la escritura; Artes y experiencias estéticas).
- "vinculo": cómo se atiende la problemática comunitaria desde esta disciplina.
Redacción profesional, en tercera persona, sin mencionar otras asignaturas ni otros campos formativos.

Responde ÚNICAMENTE JSON:
{"propuestas":[{"id":"C1","metodologia":"...","evaluacion":"...","temporalidad":"...","ejes":["..."],"vinculo":"..."}]}
`
            const data = parseJson(await aiService.generateContent(prompt, true))
            const proposals = new Map<string, any>(((data.propuestas || data.proposals || []) as any[]).map(p => [String(p?.id ?? '').trim(), p]))

            // Se reconstruye el programa desde cero: así no quedan campos o disciplinas ajenos de versiones anteriores
            const next: Record<string, any[]> = { lenguajes: [], saberes: [], etica: [], humano: [] }
            for (const [k, c] of keyOf) {
                const campo = toCampo(c.field_of_study) as Campo
                const pr = proposals.get(k) || {}
                const pdas: Record<string, string> = {}
                const src = c.pdas && Object.keys(c.pdas).length ? c.pdas : { [scope.grades[0]]: c.pda }
                for (const g of scope.grades) if (src[g]) pdas[`pda_grade_${g}`] = src[g]
                next[FIELD_KEY[campo]].push({
                    contentId: c.id,
                    contentName: c.content,
                    subject_name: c.subject_name || null,
                    field_of_study: campo,
                    grades: scope.grades,
                    ...pdas,
                    methodology: pr.metodologia || FIELD_METHODOLOGY[campo],
                    evaluation: pr.evaluacion || 'Evaluación formativa con lista de cotejo y retroalimentación durante el proceso.',
                    timeframe: pr.temporalidad || '2 semanas',
                    axes: Array.isArray(pr.ejes) ? pr.ejes.slice(0, 3) : [],
                    community_link: pr.vinculo || c.reason || '',
                    is_custom: !!c.is_custom,
                })
            }
            setFormData(prev => ({ ...prev, program_by_fields: next as any }))
            const total = Object.values(next).reduce((n, a) => n + a.length, 0)
            revealResult(`Propuesta didáctica lista: ${total} contenidos.`)
        } catch (e: any) {
            console.error(e)
            showToast(e.message?.includes('429') || e.message?.includes('limit')
                ? 'Hay muchas solicitudes en este momento. Espera unos segundos e intenta de nuevo.'
                : 'No se pudo generar la propuesta didáctica. Intenta de nuevo.', 'error')
        } finally {
            setIsGenerating(false)
            setGenLabel('')
        }
    }

    // --- Step 5: Proceso de Codiseño ---
    const handleGenerateCodesign = async () => {
        if (isGenerating) return
        setIsGenerating(true)
        setGenLabel('Redactando el proceso de codiseño del colectivo…')
        try {
            const problems = formData.problems.map(p => p.description).join('; ') || 'Problemática no definida'
            const userNotes = formData.codesign_process?.dialogue_notes || ''

            const prompt = `
            Actúa como un experto pedagogo de la Nueva Escuela Mexicana (NEM).
            Genera el contenido para el "Proceso de Codiseño" del Programa Analítico.

            Problemáticas seleccionadas: "${problems}"
            Notas del colectivo docente: "${userNotes || 'No hay notas previas, propón tú el inicio del diálogo.'}"

            ${scopeBlock()}

            ${contextBlock()}

            IMPORTANTE: el diálogo y la tabla de problematización deben centrarse en la(s) disciplina(s) y el/los campo(s) formativo(s) del docente indicados arriba; no propongas contenidos de otras asignaturas.

            Debes generar:
            1. Un diálogo de 3 turnos (Director y 2 docentes) que refleje la discusión colectiva. SI HAY NOTAS DEL USUARIO, ÚSALAS COMO BASE Y MEJORA SU REDACCIÓN PEDAGÓGICA. Si no hay notas, propón un diálogo realista de planeación.
            2. Una fila para la tabla de problematización técnica.
            3. 3 preguntas reflexivas para el colectivo.
            4. 2 notas finales para el colectivo.

            Estructura de respuesta requerida (JSON estricto):
            {
                "dialogue": [
            {"role": "Director", "name": "Director(a)", "content": "..." },
            {"role": "Docente", "name": "Mtra. Ruth", "content": "..." },
            {"role": "Docente", "name": "Mtro. Antonio", "content": "..." }
            ],
            "problematization_table": [
            {
                "synthesis_info": "Descripción técnica del programa sintético",
            "missing_info": "Qué hace falta contextualizar",
            "certainties": "Problemas o certezas identificadas",
            "causes": "Causas y consecuencias",
            "learning_goal": "Objetivo de aprendizaje comunitario"
                        }
            ],
            "reflexive_questions": ["Pregunta 1", "Pregunta 2", "Pregunta 3"],
            "collective_notes": ["Nota 1", "Nota 2"]
                }

            ${syntheticContext ? `\nDOCUMENTO OFICIAL DE REFERENCIA (PROGRAMA SINTÉTICO):\nUtiliza el lenguaje, enfoque y orientaciones de este documento oficial de la SEP para que el diálogo del colectivo docente y la tabla de problematización evidencien un dominio experto de la fase correspondiente:\n${syntheticContext.substring(0, 15000)}...\n` : ''}
            `

            const responseText = await aiService.generateContent(prompt, true)
            const data = JSON.parse(responseText)

            setFormData(prev => ({
                ...prev,
                codesign_process: {
                    ...prev.codesign_process,
                    dialogue: data.dialogue || [],
                    problematization_table: data.problematization_table || [],
                    reflexive_questions: data.reflexive_questions || [],
                    collective_notes: data.collective_notes || []
                }
            }))
            revealResult('Proceso de codiseño listo.')
        } catch (e) {
            console.error(e)
            showToast('No se pudo generar el proceso de codiseño. Intenta de nuevo.', 'error')
        } finally {
            setIsGenerating(false)
            setGenLabel('')
        }
    }

    const renderStep5_Process = () => {
        const hasProcess = formData.codesign_process?.dialogue?.length > 0

        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-3xl flex items-start gap-4">
                    <div className="p-3 bg-white rounded-xl shadow-sm">
                        <Users className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-indigo-900 uppercase tracking-wide">Paso 5: Proceso de Codiseño</h3>
                        <p className="text-sm text-indigo-700 mt-1">
                            Reflejamos el trabajo colectivo del CTE. La IA simulará el diálogo y la problematización basada en tu diagnóstico.
                        </p>
                    </div>
                </div>

                {!hasProcess ? (
                    <div className="space-y-6 max-w-2xl mx-auto">
                        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                            <label className="block text-sm font-black text-gray-500 uppercase tracking-widest mb-4">Notas previas del colectivo (Opcional)</label>
                            <textarea aria-label="Notas previas del colectivo (Opcional)"
                                placeholder="Describe brevemente con tus palabras qué se discutió, qué dudas surgieron o qué acuerdos preliminares tomaron..."
                                className="w-full bg-gray-50 border-transparent rounded-2xl p-4 text-sm font-medium text-gray-700 min-h-[120px] focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
                                value={formData.codesign_process?.dialogue_notes || ''}
                                onChange={e => setFormData({
                                    ...formData,
                                    codesign_process: { ...formData.codesign_process, dialogue_notes: e.target.value }
                                })}
                            />
                            <p className="mt-4 text-xs text-gray-500 italic">
                                La IA usará tus palabras para redactar un diálogo más realista y fiel a tu realidad escolar.
                            </p>
                        </div>
                        <div className="flex justify-center py-4">
                            <button
                                onClick={handleGenerateCodesign}
                                disabled={isGenerating}
                                className="bg-gray-900 text-white px-10 py-5 rounded-3xl font-black uppercase tracking-widest shadow-2xl hover:scale-105 transition-all flex items-center gap-4 group"
                            >
                                {isGenerating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6 text-yellow-400" />}
                                <span className="text-lg">Mejorar Redacción y Generar Diálogo (IA)</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div ref={resultRef} tabIndex={-1} className="space-y-10 scroll-mt-24 outline-none">
                        {/* Diálogo Colectivo */}
                        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm relative group">
                            <button
                                onClick={() => setFormData({ ...formData, codesign_process: { ...formData.codesign_process, dialogue: [] } })}
                                className="absolute top-6 right-8 text-[11px] font-bold text-gray-500 uppercase hover:text-rose-500 transition-colors flex items-center gap-1 opacity-0 group-hover:opacity-100"
                            >
                                <RotateCcw className="w-3 h-3" /> Reiniciar y Editar Notas
                            </button>
                            <h4 className="text-sm font-black text-gray-500 uppercase tracking-widest mb-6 border-b pb-4">Diálogo del Colectivo Docente</h4>
                            <div className="space-y-6">
                                {formData.codesign_process?.dialogue?.map((chat, idx) => (
                                    <div key={idx} className={`flex gap-4 ${chat.role === 'Director' ? 'flex-row' : 'flex-row-reverse'}`}>
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${chat.role === 'Director' ? 'bg-indigo-600 text-white' : 'bg-rose-100 text-rose-600'}`}>
                                            {chat.name[0]}
                                        </div>
                                        <div className={`p-4 rounded-2xl text-sm max-w-[80%] ${chat.role === 'Director' ? 'bg-indigo-50 text-indigo-900' : 'bg-gray-50 text-gray-700'}`}>
                                            <span className="block font-black text-[11px] uppercase opacity-50 mb-1">{chat.name}</span>
                                            {chat.content}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Tabla de Problematización */}
                        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-lg overflow-hidden">
                            <div className="bg-gray-900 px-8 py-5">
                                <h4 className="font-black text-white uppercase tracking-widest text-sm">Tabla de Problematización</h4>
                            </div>
                            <div className="p-6 overflow-x-auto">
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-gray-100">
                                            <th className="pb-4 font-black text-gray-500 uppercase w-1/5 pr-4">¿Qué hay en el P. Sintético?</th>
                                            <th className="pb-4 font-black text-gray-500 uppercase w-1/5 px-4">¿Qué NO hay / Falta?</th>
                                            <th className="pb-4 font-black text-gray-500 uppercase w-1/5 px-4">Certezas / Problemas</th>
                                            <th className="pb-4 font-black text-gray-500 uppercase w-1/5 px-4">Causas / Consecuencias</th>
                                            <th className="pb-4 font-black text-gray-500 uppercase w-1/5 pl-4">¿Qué queremos logar?</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {formData.codesign_process?.problematization_table?.map((row, idx) => (
                                            <tr key={idx}>
                                                <td className="py-4 pr-4 align-top"><textarea className="w-full bg-gray-50 border-transparent rounded-lg p-2 focus:bg-white transition-all min-h-[100px]" value={row.synthesis_info} readOnly /></td>
                                                <td className="py-4 px-4 align-top"><textarea className="w-full bg-gray-50 border-transparent rounded-lg p-2 focus:bg-white transition-all min-h-[100px]" value={row.missing_info} readOnly /></td>
                                                <td className="py-4 px-4 align-top"><textarea className="w-full bg-gray-50 border-transparent rounded-lg p-2 focus:bg-white transition-all min-h-[100px]" value={row.certainties} readOnly /></td>
                                                <td className="py-4 px-4 align-top"><textarea className="w-full bg-gray-50 border-transparent rounded-lg p-2 focus:bg-white transition-all min-h-[100px]" value={row.causes} readOnly /></td>
                                                <td className="py-4 pl-4 align-top"><textarea className="w-full bg-gray-50 border-transparent rounded-lg p-2 focus:bg-white transition-all min-h-[100px]" value={row.learning_goal} readOnly /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Reflexión e Interiorización */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-green-50/50 p-8 rounded-[2rem] border border-green-100">
                                <h4 className="font-black text-green-700 uppercase tracking-widest text-xs mb-6 flex items-center">
                                    <div className="w-3 h-3 bg-green-500 rounded-full mr-2" /> Para Interiorizar
                                </h4>
                                <ul className="space-y-4">
                                    {formData.codesign_process?.reflexive_questions?.map((q, idx) => (
                                        <li key={idx} className="flex items-start gap-4">
                                            <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center shrink-0 border border-green-200 text-[11px] font-black text-green-600">{idx + 1}</div>
                                            <p className="text-sm font-medium text-green-800">{q}</p>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="bg-rose-50/50 p-8 rounded-[2rem] border border-rose-100">
                                <h4 className="font-black text-rose-700 uppercase tracking-widest text-xs mb-6 px-4 py-1 bg-rose-100 rounded-full inline-block">
                                    Notas para el colectivo
                                </h4>
                                <div className="space-y-4">
                                    {formData.codesign_process?.collective_notes?.map((note, idx) => (
                                        <div key={idx} className="bg-white p-4 rounded-xl border border-rose-100 text-sm font-bold text-rose-900 shadow-sm leading-relaxed italic">
                                            "{note}"
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // --- Paso 6: Codiseño de contenidos ---
    const updateProgramItem = (fieldKey: string, idx: number, key: string, value: any) => {
        setFormData(prev => {
            const items = [...((prev.program_by_fields as any)[fieldKey] || [])]
            items[idx] = { ...items[idx], [key]: value }
            return { ...prev, program_by_fields: { ...prev.program_by_fields, [fieldKey]: items } }
        })
    }
    const removeProgramItem = (fieldKey: string, idx: number) => {
        setFormData(prev => ({
            ...prev,
            program_by_fields: { ...prev.program_by_fields, [fieldKey]: ((prev.program_by_fields as any)[fieldKey] || []).filter((_: any, i: number) => i !== idx) },
        }))
    }
    const itemText = (it: any) => [it.contentName, it.methodology, it.evaluation, it.community_link, ...Object.keys(it).filter(k => k.startsWith('pda_grade_')).map(k => it[k])].filter(Boolean).join(' \n ')
    const itemGrades = (it: any) => (Array.isArray(it.grades) && it.grades.length ? it.grades : (scope?.grades ?? [1]))
        .filter((g: number) => it[`pda_grade_${g}`] !== undefined || g === (scope?.grades?.[0] ?? 1))

    const renderStep6_Didactic = () => {
        const entries = Object.entries(formData.program_by_fields as Record<string, any[]>).filter(([, items]) => items?.length > 0)
        const hasContents = entries.length > 0
        const fieldInput = 'w-full bg-slate-50 border border-slate-200 rounded-xl text-sm p-3 focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition'

        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                <div className="bg-indigo-50 border border-indigo-100 p-5 sm:p-6 rounded-3xl flex items-start gap-4">
                    <div className="p-3 bg-white rounded-xl shadow-sm shrink-0">
                        <Briefcase className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-indigo-900 uppercase tracking-wide">Tercer Plano: Codiseño de contenidos</h3>
                        <p className="text-sm text-indigo-700 mt-1">
                            Para cada contenido de tus disciplinas: PDA por grado, metodología, evaluación formativa, temporalidad y su vínculo con la problemática.
                        </p>
                    </div>
                </div>

                {!hasContents ? (
                    <div className="flex justify-center py-10">
                        <button
                            onClick={handleGenerateDidactic}
                            disabled={isGenerating || !scope}
                            className="bg-gray-900 text-white px-8 sm:px-10 py-5 rounded-3xl font-black uppercase tracking-widest shadow-2xl hover:scale-105 transition-all flex items-center gap-4 group disabled:opacity-50"
                        >
                            {isGenerating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6 text-yellow-400 group-hover:rotate-12 transition-transform" />}
                            <span className="text-base sm:text-lg">Generar propuesta didáctica (IA)</span>
                        </button>
                    </div>
                ) : (
                    <div ref={resultRef} tabIndex={-1} className="space-y-8 scroll-mt-24 outline-none">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-black text-slate-800 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-600" /> Propuesta didáctica lista · todo es editable</p>
                            <button type="button" onClick={handleGenerateDidactic} disabled={isGenerating}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Generar de nuevo
                            </button>
                        </div>

                        {entries.map(([fieldKey, items]) => {
                            const label = FIELD_LABEL[fieldKey] || toCampo(fieldKey) || fieldKey
                            const outOfScope = !!scope && !scope.fields.includes(label as Campo)
                            return (
                                <section key={fieldKey} className={`rounded-[2rem] border overflow-hidden ${outOfScope ? 'border-rose-200' : 'border-slate-100'} bg-white shadow-sm`}>
                                    <header className={`px-5 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-2 ${outOfScope ? 'bg-rose-600' : 'bg-indigo-600'}`}>
                                        <h4 className="font-black text-white text-sm flex items-center gap-2"><Briefcase className="w-5 h-5 text-white/70" /> Campo formativo: {label}</h4>
                                        {outOfScope && <span className="text-xs font-black bg-white text-rose-700 px-3 py-1 rounded-full">No corresponde a tus materias</span>}
                                    </header>
                                    <div className="divide-y divide-slate-100">
                                        {items.map((item: any, idx: number) => {
                                            const flags = scope ? findOutOfScopeMentions(itemText(item), scope) : []
                                            return (
                                                <article key={item.contentId || idx} className="p-5 sm:p-8 space-y-4">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap gap-2 mb-2">
                                                                {item.subject_name && <span className="text-xs font-black bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full">{item.subject_name}</span>}
                                                                {item.is_custom && <span className="text-xs font-black bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full">PDA propio</span>}
                                                                {(item.axes || []).map((ax: string) => <span key={ax} className="text-xs font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">{ax}</span>)}
                                                            </div>
                                                            <p className="font-black text-slate-900 leading-snug">{item.contentName}</p>
                                                        </div>
                                                        <button type="button" aria-label="Quitar contenido" onClick={() => removeProgramItem(fieldKey, idx)} className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>

                                                    {flags.length > 0 && (
                                                        <p role="alert" className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                                                            Revisa la redacción: menciona {flags.join(', ')}, que no corresponde(n) a tus materias.
                                                        </p>
                                                    )}

                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                        <div className="space-y-3">
                                                            {itemGrades(item).map((g: number) => (
                                                                <label key={g} className="block">
                                                                    <span className="block text-xs font-black text-slate-600 mb-1.5">PDA contextualizado · {g}° grado</span>
                                                                    <textarea rows={4} className={fieldInput} value={item[`pda_grade_${g}`] || ''}
                                                                        onChange={e => updateProgramItem(fieldKey, idx, `pda_grade_${g}`, e.target.value)} />
                                                                </label>
                                                            ))}
                                                        </div>
                                                        <div className="space-y-3">
                                                            <label className="block">
                                                                <span className="block text-xs font-black text-slate-600 mb-1.5">Metodología / proyecto</span>
                                                                <textarea rows={3} className={fieldInput} value={item.methodology || ''} onChange={e => updateProgramItem(fieldKey, idx, 'methodology', e.target.value)} />
                                                            </label>
                                                            <label className="block">
                                                                <span className="block text-xs font-black text-slate-600 mb-1.5">Evaluación formativa</span>
                                                                <textarea rows={3} className={fieldInput} value={item.evaluation || ''} onChange={e => updateProgramItem(fieldKey, idx, 'evaluation', e.target.value)} />
                                                            </label>
                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                                <label className="block">
                                                                    <span className="block text-xs font-black text-slate-600 mb-1.5">Temporalidad</span>
                                                                    <input className={fieldInput} value={item.timeframe || ''} onChange={e => updateProgramItem(fieldKey, idx, 'timeframe', e.target.value)} />
                                                                </label>
                                                                <label className="block sm:col-span-2">
                                                                    <span className="block text-xs font-black text-slate-600 mb-1.5">Vínculo con la problemática</span>
                                                                    <textarea rows={2} className={fieldInput} value={item.community_link || ''} onChange={e => updateProgramItem(fieldKey, idx, 'community_link', e.target.value)} />
                                                                </label>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </article>
                                            )
                                        })}
                                    </div>
                                </section>
                            )
                        })}
                    </div>
                )}
            </div>
        )
    }

    // --- Step 7: Revisión ---
    const renderStep7_Review = () => {
        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-3xl flex items-start gap-4">
                    <div className="p-3 bg-white rounded-xl shadow-sm">
                        <CheckCircle2 className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-indigo-900 uppercase tracking-wide">Revisión Final</h3>
                        <p className="text-sm text-indigo-700 mt-1">
                            Verifica que toda la información sea correcta antes de generar el documento final.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-8">
                    {/* 1. School Data */}
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative group hover:border-indigo-200 transition-all">
                        <button onClick={() => setCurrentStep(1)} className="absolute top-6 right-6 text-xs font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity uppercase">Editar</button>
                        <h4 className="font-black text-gray-800 uppercase tracking-wide text-sm mb-4 flex items-center"><School className="w-4 h-4 mr-2" /> Datos Generales</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                            <div><span className="block text-xs font-bold text-gray-500 uppercase">Escuela</span>{formData.school_data.name}</div>
                            <div><span className="block text-xs font-bold text-gray-500 uppercase">CCT</span>{formData.school_data.cct}</div>
                            <div><span className="block text-xs font-bold text-gray-500 uppercase">Zona</span>{formData.school_data.zone}</div>
                            <div><span className="block text-xs font-bold text-gray-500 uppercase">Nivel</span>{formData.school_data.level}</div>
                        </div>
                    </div>

                    {/* 2. Diagnosis */}
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative group hover:border-indigo-200 transition-all">
                        <button onClick={() => setCurrentStep(2)} className="absolute top-6 right-6 text-xs font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity uppercase">Editar</button>
                        <h4 className="font-black text-gray-800 uppercase tracking-wide text-sm mb-4 flex items-center"><BookOpen className="w-4 h-4 mr-2" /> Diagnóstico</h4>
                        <div className="text-sm text-gray-600 italic leading-relaxed whitespace-pre-line">
                            {formData.diagnosis.narrative_final || (
                                <span className="text-gray-500">Sin diagnóstico generado aún. Regresa al paso 2 para generarlo con IA.</span>
                            )}
                        </div>
                    </div>

                    {/* 3. Problem */}
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative group hover:border-indigo-200 transition-all">
                        <button onClick={() => setCurrentStep(3)} className="absolute top-6 right-6 text-xs font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity uppercase">Editar</button>
                        <h4 className="font-black text-gray-800 uppercase tracking-wide text-sm mb-4 flex items-center"><Target className="w-4 h-4 mr-2" /> Problemática</h4>
                        {formData.problems.map((p, idx) => (
                            <div key={idx} className="mb-2">
                                <p className="font-bold text-gray-800">{p.description}</p>
                                <div className="flex gap-2 mt-1">
                                    <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded">Rasgo: {p.trait_id}</span>
                                    {p.axes_ids?.map((a: string) => <span key={a} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded">{a}</span>)}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Verificación de alcance: nada fuera de las disciplinas y campos del docente */}
                    {scope && (() => {
                        const all = Object.entries(formData.program_by_fields as Record<string, any[]>).flatMap(([k, items]) => (items || []).map((it: any) => ({ k, it })))
                        const foreignFields = Object.entries(formData.program_by_fields as Record<string, any[]>)
                            .filter(([k, items]) => items?.length && !scope.fields.includes((FIELD_LABEL[k] || toCampo(k)) as Campo))
                        const foreignSubjects = scope.generalist ? [] : all.filter(({ it }) => it.subject_name && !scope.subjects.some(sub => sameDiscipline(sub.name, it.subject_name)))
                        const flagged = all.map(({ k, it }) => ({ k, it, hits: findOutOfScopeMentions(itemText(it), scope) })).filter(x => x.hits.length)
                        const ok = all.length > 0 && !foreignFields.length && !foreignSubjects.length && !flagged.length
                        const prune = () => setFormData(prev => {
                            const next: any = { lenguajes: [], saberes: [], etica: [], humano: [] }
                            for (const [k, items] of Object.entries(prev.program_by_fields as Record<string, any[]>)) {
                                const campo = (FIELD_LABEL[k] || toCampo(k)) as Campo
                                if (!campo || !scope.fields.includes(campo)) continue
                                next[FIELD_KEY[campo]] = [...next[FIELD_KEY[campo]], ...(items || []).filter((it: any) =>
                                    scope.generalist || !it.subject_name || scope.subjects.some(sub => sameDiscipline(sub.name, it.subject_name)))]
                            }
                            return { ...prev, program_by_fields: next }
                        })
                        return (
                            <div className={`p-6 rounded-3xl border ${ok ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-200'}`}>
                                <h4 className={`font-black uppercase tracking-wide text-sm mb-3 flex items-center ${ok ? 'text-emerald-800' : 'text-amber-900'}`}>
                                    <ShieldCheck className="w-4 h-4 mr-2" /> Verificación de alcance curricular
                                </h4>
                                <ul className="space-y-1.5 text-sm">
                                    <li className="text-slate-700"><strong>Disciplina(s):</strong> {scope.generalist ? 'Docente frente a grupo (todos los campos)' : scope.subjects.map(sub => sub.label || sub.name).join(', ')}</li>
                                    <li className="text-slate-700"><strong>Campo(s) formativo(s):</strong> {scope.fields.join(' · ')}</li>
                                    <li className="text-slate-700"><strong>Grado(s):</strong> {scope.grades.map(g => `${g}°`).join(', ')}</li>
                                    <li className={all.length ? 'text-emerald-800' : 'text-amber-900'}>{all.length ? `✓ ${all.length} contenidos del programa sintético oficial` : '• Aún no hay contenidos en el plano didáctico (paso 6).'}</li>
                                    {!foreignFields.length && all.length > 0 && <li className="text-emerald-800">✓ Sin campos formativos ajenos</li>}
                                    {!foreignSubjects.length && all.length > 0 && <li className="text-emerald-800">✓ Sin contenidos de otras asignaturas</li>}
                                    {!flagged.length && all.length > 0 && <li className="text-emerald-800">✓ La redacción no menciona otras disciplinas ni campos</li>}
                                    {foreignFields.map(([k, items]) => <li key={k} className="text-rose-700">✗ {items.length} contenido(s) del campo {FIELD_LABEL[k] || k}, que no te corresponde</li>)}
                                    {foreignSubjects.map(({ it }, i) => <li key={i} className="text-rose-700">✗ "{it.contentName}" es de {it.subject_name}</li>)}
                                    {flagged.map(({ it, hits }, i) => <li key={`f${i}`} className="text-amber-900">⚠ "{it.contentName}" menciona {hits.join(', ')}: revisa la redacción en el paso 6</li>)}
                                </ul>
                                {(foreignFields.length > 0 || foreignSubjects.length > 0) && (
                                    <button type="button" onClick={prune} className="mt-4 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-black">Quitar lo que no corresponde</button>
                                )}
                            </div>
                        )
                    })()}

                    {/* 5. Codesign Summary */}
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative group hover:border-indigo-200 transition-all">
                        <button onClick={() => setCurrentStep(6)} className="absolute top-6 right-6 text-xs font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity uppercase">Editar</button>
                        <h4 className="font-black text-gray-800 uppercase tracking-wide text-sm mb-4 flex items-center"><Briefcase className="w-4 h-4 mr-2" /> Plano Didáctico</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            {Object.entries(formData.program_by_fields).filter(([, items]: any) => items?.length > 0).map(([field, items]: any) => (
                                <div key={field} className="bg-gray-50 rounded-xl p-3 text-center">
                                    <span className="block text-xs font-bold text-gray-500 mb-1">{FIELD_LABEL[field] || field}</span>
                                    <span className="text-2xl font-black text-indigo-600">{items.length}</span>
                                    <span className="block text-[11px] text-gray-500">Contenidos</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // --- Actions ---

    const handleSaveProgram = async () => {
        if (!tenant) return
        setSaving(true)

        try {
            // 0. Fetch Active Academic Year
            const { data: activeYear } = await supabase
                .from('academic_years')
                .select('id')
                .eq('tenant_id', tenant.id)
                .eq('is_active', true)
                .maybeSingle()

            if (!activeYear) {
                alert('Advertencia: No se encontró un ciclo escolar activo. El programa se guardará sin ciclo asociado.')
            }

            // 1. Prepare Data for DB
            // MAP PROBLEMS INTO group_diagnosis since schema doesn't have 'problems' column
            const updatedDiagnosis = {
                ...formData.diagnosis,
                problem_situations: formData.problems, // Store problems here
                codesign_process: formData.codesign_process, // Store codiseño here
                suggested_contents: suggestedContents // Store selection context here
            }

            if (!programField) {
                showToast('Elige el campo formativo de este programa (paso 1).', 'error')
                setCurrentStep(1)
                return
            }
            const programData: Record<string, any> = {
                tenant_id: tenant.id,
                field_of_study: programField,
                school_data: formData.school_data,
                group_diagnosis: updatedDiagnosis,
                program_by_fields: formData.program_by_fields,
                status: 'DRAFT',
                updated_at: new Date().toISOString(),
                academic_year_id: activeYear?.id || null
            }

            let error
            let data

            if (id && id !== 'new') {
                // Update
                const res = await supabase
                    .from('analytical_programs')
                    .update(programData)
                    .eq('id', id)
                    .select()
                error = res.error
                data = res.data
            } else {
                // Insert
                const res = await supabase
                    .from('analytical_programs')
                    .insert([{ ...programData, created_by: (profile as any)?.id ?? null }])
                    .select()
                error = res.error
                data = res.data
            }

            if (error) {
                console.error('Buscando error de esquema:', error)
                throw error
            }

            // 2. Update URL if valid
            if (data && data[0] && (!id || id === 'new')) {
                navigate(`/analytical-program/${data[0].id}`, { replace: true })
            }

            // 3. Clear Draft
            localStorage.removeItem(`analytical_program_draft_${id || 'new'}`)

            alert('Programa Analítico guardado correctamente en la base de datos.')

        } catch (err: any) {
            console.error('Error saving program:', err)
            alert('Error al guardar: ' + err.message + ' (Ver consola para más detalles)')
        } finally {
            setSaving(false)
        }
    }

    const stepInfo = STEPS[currentStep - 1]
    return (
        <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6 sm:py-10 pb-32 sm:pb-10">
            <header className="mb-6 flex items-start gap-3">
                <button aria-label="Regresar" onClick={() => navigate('/analytical-program')} className="p-2 -ml-2 rounded-xl hover:bg-slate-100 text-slate-500 shrink-0">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-widest text-indigo-600 mb-1">Nueva Escuela Mexicana{scope?.phase ? ` · Fase ${scope.phase}` : ''}{programField ? ` · ${programField}` : ''}{scope && !scope.generalist && scope.subjects.length ? ` · ${scope.subjects.map(sub => sub.name).join(', ')}` : ''}</p>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Programa analítico</h1>
                </div>
            </header>

            <WizardProgress steps={STEPS.map(s => ({ label: s.title }))} current={currentStep - 1} onStepClick={i => setCurrentStep(i + 1)} />

            <section className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-4 sm:p-8">
                <WizardStepHeader icon={stepInfo?.icon ?? School} title={stepInfo?.title || 'Paso'} description={stepInfo?.description} />
                {isGenerating && (
                    <div role="status" aria-live="polite" className="sticky top-2 z-20 mb-6 flex items-center gap-3 rounded-2xl bg-indigo-600 text-white px-4 py-3 shadow-lg shadow-indigo-600/20">
                        <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                        <p className="text-sm font-bold">{genLabel || 'La IA está trabajando…'} <span className="font-medium text-indigo-100">Esto puede tardar hasta un minuto.</span></p>
                    </div>
                )}
                {currentStep === 1 && renderStep1()}
                {currentStep === 2 && renderStep2()}
                {currentStep === 3 && renderStep3()}
                {currentStep === 4 && renderStep4()}
                {currentStep === 5 && renderStep5_Process()}
                {currentStep === 6 && renderStep6_Didactic()}
                {currentStep === 7 && renderStep7_Review()}
            </section>

            <WizardFooter
                onBack={currentStep > 1 ? handleBack : undefined}
                onNext={currentStep === STEPS.length ? handleSaveProgram : handleNext}
                nextLabel={currentStep === STEPS.length ? 'Guardar programa' : 'Siguiente'}
                nextIcon={currentStep === STEPS.length ? Save : undefined}
                tone={currentStep === STEPS.length ? 'success' : 'primary'}
                loading={saving}
                extra={
                    <button
                        type="button"
                        onClick={async () => {
                            if ((await askConfirm('¿Estás seguro de que deseas reiniciar la construcción? Se borrará todo el progreso actual de esta sesión.'))) {
                                localStorage.removeItem(`analytical_program_draft_${id || 'new'}`)
                                window.location.reload()
                            }
                        }}
                        className="p-3 sm:px-4 rounded-2xl text-sm font-black text-slate-500 hover:text-rose-600 hover:bg-rose-50 inline-flex items-center gap-2"
                        aria-label="Reiniciar"
                    >
                        <RotateCcw className="w-4 h-4" /><span className="hidden sm:inline">Reiniciar</span>
                    </button>
                }
            />
        </div>
    )
}
