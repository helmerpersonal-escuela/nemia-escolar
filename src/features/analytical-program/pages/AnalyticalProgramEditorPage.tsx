import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
// Force rebuild to fix intermittent 500 errors in some environments
import { useTenant } from '../../../hooks/useTenant'
import { GroqService } from '../../../lib/groq'
import { useProfile } from '../../../hooks/useProfile'
import {
    Save,
    ArrowLeft,
    Sparkles,
    CheckCircle2,
    Briefcase,
    School,
    BookOpen,
    Target,
    Users,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Check,
    RotateCcw
} from 'lucide-react'

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
    state: 'Guanajuato',
    municipality: '',
    level: 'Secundaria',
    turn: 'Matutino',
    students_total: '',
    teachers_count: '',
    logo_url: ''
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
    const groqService = useMemo(() => new GroqService((tenant as any)?.groqApiKey || ''), [(tenant as any)?.groqApiKey])

    // State
    const [currentStep, setCurrentStep] = useState(1)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const [syntheticCatalog, setSyntheticCatalog] = useState<any[]>([])
    const [suggestedContents, setSuggestedContents] = useState<any[]>([])
    const [customInputs, setCustomInputs] = useState({
        geo: '', social: '', cultural: '', infra: '', academic: ''
    })

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

            // 2. Load from LocalStorage (Draft)
            const savedDraft = localStorage.getItem(`analytical_program_draft_${id || 'new'}`)
            if (savedDraft) {
                try {
                    const parsed = JSON.parse(savedDraft)
                    // Merge with current initial state to avoid missing fields if schema changed
                    setFormData(prev => ({
                        ...prev,
                        ...parsed.formData,
                        diagnosis: { ...prev.diagnosis, ...parsed.formData?.diagnosis },
                        school_data: { ...prev.school_data, ...parsed.formData?.school_data },
                        // Ensure codesign_process exists even in old drafts
                        codesign_process: {
                            ...prev.codesign_process,
                            ...(parsed.formData?.codesign_process || {})
                        }
                    }))
                    setCurrentStep(parsed.currentStep || 1)
                    if (parsed.suggestedContents) setSuggestedContents(parsed.suggestedContents)

                } catch (e) {
                    console.error('Error restoring draft', e)
                }
            } else if (id && id !== 'new') {
                // 3. Fetch from DB if no draft
                const { data: program } = await supabase
                    .from('analytical_programs')
                    .select('*')
                    .eq('id', id)
                    .maybeSingle()

                if (program) {
                    const groupDiag = program.group_diagnosis || {}
                    setFormData({
                        school_data: program.school_data || DEFAULT_SCHOOL_DATA,
                        diagnosis: {
                            ...groupDiag,
                            narrative_final: groupDiag.narrative_final || ''
                        },
                        problems: groupDiag.problem_situations || [],
                        program_by_fields: program.program_by_fields || DEFAULT_FIELDS,
                        codesign_process: groupDiag.codesign_process || DEFAULT_CODESIGN
                    })
                }
            } else {
                // 4. Default Fill for New
                setFormData(prev => ({
                    ...prev,
                    school_data: {
                        ...prev.school_data,
                        name: tenant?.name || '',
                        cct: tenant?.cct || '',
                        level: (tenant?.educationalLevel as string) || prev.school_data.level,
                    }
                }))
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

    // --- Actions ---

    const handleNext = () => {
        if (currentStep < STEPS.length) setCurrentStep(c => c + 1)
    }

    const handleBack = () => {
        if (currentStep > 1) setCurrentStep(c => c - 1)
    }

    const generateDiagnosisNarrative = async () => {
        setIsGenerating(true)
        try {
            const prompt = `
                Actúa como un experto pedagogo de la Nueva Escuela Mexicana (NEM).
                Genera una narrativa diagnóstica socioeducativa (Primer Plano) coherente y profesional para la escuela "${formData.school_data.name}" (CCT: ${formData.school_data.cct}).
                
                Contexto proporcionado:
                - Entorno Geográfico: ${formData.diagnosis.external_context.geo}
                - Factores Sociales: ${formData.diagnosis.external_context.social}
                - Factores Culturales: ${formData.diagnosis.external_context.cultural}
                - Infraestructura: ${formData.diagnosis.internal_context.infrastructure}
                - Características Alumnos: ${formData.diagnosis.internal_context.environment}

                REGLAS DE REDACCIÓN:
                1. Redacta en párrafos fluidos (3-5 párrafos).
                2. Usa un lenguaje pedagógico crítico propio de la NEM.
                3. Identifica cómo el contexto influye en el proceso de enseñanza-aprendizaje.
                4. No uses viñetas ni listas.
                5. Menciona explícitamente el nombre de la escuela si es posible.
            `

            const narrative = await groqService.generateContent(prompt)

            setFormData(prev => ({
                ...prev,
                diagnosis: {
                    ...prev.diagnosis,
                    narrative_final: narrative || 'Error generando narrativa. Intenta de nuevo.'
                }
            }))
        } catch (e) {
            console.error(e)
            alert('Error generando narrativa diagnóstica')
        } finally {
            setIsGenerating(false)
        }
    }


    // --- Render Steps ---

    const renderStep1 = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                <h3 className="text-lg font-black text-gray-800 mb-6 uppercase tracking-wide">Datos de Identificación</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Nombre de la Escuela</label>
                        <input
                            value={formData.school_data.name}
                            onChange={e => setFormData({ ...formData, school_data: { ...formData.school_data, name: e.target.value } })}
                            className="w-full bg-gray-50 border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-700"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">CCT</label>
                        <input
                            value={formData.school_data.cct}
                            onChange={e => setFormData({ ...formData, school_data: { ...formData.school_data, cct: e.target.value } })}
                            className="w-full bg-gray-50 border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-700"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Zona Escolar</label>
                        <input
                            value={formData.school_data.zone}
                            onChange={e => setFormData({ ...formData, school_data: { ...formData.school_data, zone: e.target.value } })}
                            className="w-full bg-gray-50 border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-700"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Sector</label>
                        <input
                            value={formData.school_data.sector}
                            onChange={e => setFormData({ ...formData, school_data: { ...formData.school_data, sector: e.target.value } })}
                            className="w-full bg-gray-50 border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-700"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Municipio</label>
                        <input
                            value={formData.school_data.municipality}
                            onChange={e => setFormData({ ...formData, school_data: { ...formData.school_data, municipality: e.target.value } })}
                            className="w-full bg-gray-50 border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-700"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Matrícula Total</label>
                        <input
                            value={formData.school_data.students_total}
                            onChange={e => setFormData({ ...formData, school_data: { ...formData.school_data, students_total: e.target.value } })}
                            className="w-full bg-gray-50 border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-700"
                        />
                    </div>
                </div>
            </div>
        </div>
    )

    const handleAddCustom = (category: string, sub: string, inputKey: string) => {
        // @ts-ignore
        const val = customInputs[inputKey].trim()
        if (!val) return
        toggleOption(category, sub, val)
        setCustomInputs(prev => ({ ...prev, [inputKey]: '' }))
    }

    const renderOptionGroup = (title: string, options: string[], category: string, sub: string, inputKey: string) => {
        // @ts-ignore
        const currentSelection = formData.diagnosis[category][sub].split(', ').filter(Boolean)
        // Find selected items that are NOT in the default options (custom ones)
        const customSelected = currentSelection.filter((s: string) => !options.includes(s))

        return (
            <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-3 block">{title}</label>
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
                        // @ts-ignore
                        value={customInputs[inputKey]}
                        // @ts-ignore
                        onChange={(e) => setCustomInputs(prev => ({ ...prev, [inputKey]: e.target.value }))}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault()
                                handleAddCustom(category, sub, inputKey)
                            }
                        }}
                    />
                    <button
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
                <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-xl animate-in zoom-in duration-300 ring-4 ring-yellow-50/50">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-sm font-black text-gray-800 uppercase tracking-wide flex items-center">
                            <CheckCircle2 className="w-5 h-5 mr-2 text-green-500" /> Diagnóstico Generado
                        </h3>
                        <span className="text-[10px] font-bold text-gray-400 uppercase bg-gray-100 px-3 py-1 rounded-full">Editable</span>
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

    const handleGenerateLinkage = async () => {
        setIsGenerating(true)
        try {
            const problems = formData.problems
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
            `

            const response = await groqService.generateContent(prompt, true)
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
        } catch (e) {
            console.error(e)
            alert('Error vinculando problemáticas con NEM')
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
                return { ...prev, problems: [...prev.problems, { id: Date.now(), description: prob }] }
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
                    {PROBLEMS_CATALOG.map((prob, idx) => {
                        const isSelected = formData.problems.some(p => p.description === prob)
                        return (
                            <button
                                key={idx}
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
                </div>

                {/* Custom Problem */}
                <div className="max-w-4xl mx-auto mt-6 flex gap-2">
                    <input
                        id="custom-problem-input"
                        placeholder="O escribe otra problemática personalizada..."
                        className="flex-1 text-center bg-gray-50 border-transparent rounded-2xl py-4 font-bold text-gray-600 focus:bg-white focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                toggleProblem((e.target as HTMLInputElement).value)
                                // @ts-ignore
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
                        className="bg-rose-500 text-white px-6 rounded-2xl font-bold uppercase text-xs"
                    >
                        Agregar
                    </button>
                </div>
            </div>

            {/* Auto-Linkage Section */}
            {formData.problems.length > 0 && formData.problems.some(p => !p.trait_id) && (
                <div className="flex justify-center">
                    <button
                        onClick={handleGenerateLinkage}
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
                                    <span className="text-indigo-300 text-[10px] font-black uppercase tracking-widest block mb-3">Problemática {idx + 1}</span>
                                    <p className="font-bold text-lg leading-tight mb-6">{prob.description}</p>

                                    <div className="space-y-4 pt-4 border-t border-white/10">
                                        <div>
                                            <span className="text-indigo-300 text-[10px] font-black uppercase tracking-widest block mb-2">Rasgo Perfil de Egreso</span>
                                            <p className="text-sm font-medium leading-relaxed">{prob.trait_id}</p>
                                        </div>
                                        <div>
                                            <span className="text-indigo-300 text-[10px] font-black uppercase tracking-widest block mb-2">Ejes Articuladores</span>
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

    const handleSuggestContents = async () => {
        setIsGenerating(true)
        try {
            const level = formData.school_data.level || 'Secundaria'
            const problemsString = formData.problems.map(p => p.description).join('; ') || 'General'

            // Limit catalog to avoid token limits, but keep relevant items
            // In a real app we'd filter by keywords, here we take a sample + top matches if possible
            const catalogSample = syntheticCatalog.slice(0, 30).map(c => ({
                id: c.id,
                content: c.content,
                field: c.field_of_study
            }))

            const prompt = `
                Actúa como un experto pedagogo de la NEM.
                Para el nivel ${level} y las problemáticas siguientes: "${problemsString}", selecciona los 6 contenidos del Programa Sintético más pertinentes de la siguiente lista:

                ${JSON.stringify(catalogSample)}

                Para cada contenido seleccionado, propón un PDA (Proceso de Desarrollo de Aprendizaje) breve y contextualizado.

                Responde ÚNICAMENTE un objeto JSON con este formato:
                {
                    "selected": [
                        { "id": "ID_DEL_CONTENIDO", "pda": "Texto del PDA contextualizado" }
                    ]
                }
            `

            const response = await groqService.generateContent(prompt, true)
            const data = JSON.parse(response)

            const suggested = (data.selected || []).map((sel: any) => {
                const original = syntheticCatalog.find(c => c.id === sel.id)
                if (!original) return null
                return {
                    ...original,
                    selected: true,
                    pda: sel.pda || original.pda_grade_1 || 'PDA no generado'
                }
            }).filter(Boolean)

            setSuggestedContents(suggested)
        } catch (e) {
            console.error(e)
            alert('Error sugiriendo contenidos con IA')
        } finally {
            setIsGenerating(false)
        }
    }

    const renderStep4 = () => {
        const grouped = suggestedContents.reduce((acc: any, curr) => {
            const field = curr.field_of_study || 'Otros'
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
                            La IA analizará el Programa Sintético y seleccionará los contenidos que mejor atiendan tus problemáticas: <strong>"{formData.problems.map(p => p.description).join(', ')}"</strong>.
                        </p>
                    </div>
                </div>

                {suggestedContents.length === 0 ? (
                    <div className="flex justify-center py-10">
                        <button
                            onClick={handleSuggestContents}
                            disabled={isGenerating}
                            className="bg-gray-900 text-white px-10 py-5 rounded-3xl font-black uppercase tracking-widest shadow-2xl hover:scale-105 transition-all flex items-center gap-4 group"
                        >
                            {isGenerating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6 text-yellow-400 group-hover:rotate-12 transition-transform" />}
                            <span className="text-lg">Sugerir Contenidos (IA)</span>
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6">
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
                                                <p className="text-xs text-gray-400 font-medium line-clamp-2">{content.pda_grade_1 || content.pda_grade_2 || content.pda_grade_3}</p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )
    }

    // --- Step 5: Codiseño ---
    const handleGenerateDidactic = async () => {
        setIsGenerating(true)
        try {
            const selected = suggestedContents.filter(c => c.selected)
            if (selected.length === 0) return

            const problemsString = formData.problems.map(p => p.description).join('; ')

            const prompt = `
                Actúa como un experto de la NEM.
                Para los siguientes contenidos y las problemáticas: "${problemsString}", genera una propuesta didáctica técnica (Tercer Plano).
                
                Contenidos:
                ${selected.map(c => `- ${c.content} (PDA: ${c.pda})`).join('\n')}

                Para cada contenido, define:
                1. Metodología sugerida (ABP, STEAM, Aprendizaje de Servicio, etc.)
                2. Sugerencia de evaluación formativa.
                3. Temporalidad (ej. 2 semanas).

                Responde ÚNICAMENTE un objeto JSON con este formato:
                {
                    "proposals": [
                        {
                            "contentId": "ID_DEL_CONTENIDO",
                            "methodology": "Nombre de la metodología",
                            "evaluation": "Sugerencia de evaluación",
                            "timeframe": "Temporalidad"
                        }
                    ]
                }
            `

            const response = await groqService.generateContent(prompt, true)
            const data = JSON.parse(response)

            const newProgramByFields = { ...formData.program_by_fields }

            selected.forEach(item => {
                const proposal = (data.proposals || []).find((p: any) => p.contentId === item.id)
                const field = item.field_of_study || 'Otros'

                // @ts-ignore
                if (!newProgramByFields[field]) newProgramByFields[field] = []

                // @ts-ignore
                const existingIndex = newProgramByFields[field].findIndex(x => x.contentId === item.id)

                const fieldData = {
                    contentId: item.id,
                    contentName: item.content,
                    pda_grade_1: item.pda, // Usamos el PDA sugerido en el paso anterior
                    pda_grade_2: item.pda,
                    pda_grade_3: item.pda,
                    methodology: proposal?.methodology || 'Aprendizaje Basado en Proyectos (ABP)',
                    evaluation: proposal?.evaluation || 'Evaluación formativa continua.',
                    timeframe: proposal?.timeframe || '2 semanas'
                }

                if (existingIndex >= 0) {
                    // @ts-ignore
                    newProgramByFields[field][existingIndex] = fieldData
                } else {
                    // @ts-ignore
                    newProgramByFields[field].push(fieldData)
                }
            })

            setFormData(prev => ({ ...prev, program_by_fields: newProgramByFields }))
        } catch (e) {
            console.error(e)
            alert('Error generando diseño didáctico con IA')
        } finally {
            setIsGenerating(false)
        }
    }

    // --- Step 5: Proceso de Codiseño ---
    const handleGenerateCodesign = async () => {
        setIsGenerating(true)
        try {
            const problems = formData.problems.map(p => p.description).join('; ') || 'Problemática no definida'
            const userNotes = formData.codesign_process?.dialogue_notes || ''

            const prompt = `
                Actúa como un experto pedagogo de la Nueva Escuela Mexicana (NEM). 
                Genera el contenido para el "Proceso de Codiseño" del Programa Analítico.
                
                Problemáticas seleccionadas: "${problems}"
                Notas del colectivo docente: "${userNotes || 'No hay notas previas, propón tú el inicio del diálogo.'}"
                
                Debes generar:
                1. Un diálogo de 3 turnos (Director y 2 docentes) que refleje la discusión colectiva. SI HAY NOTAS DEL USUARIO, ÚSALAS COMO BASE Y MEJORA SU REDACCIÓN PEDAGÓGICA. Si no hay notas, propón un diálogo realista de planeación.
                2. Una fila para la tabla de problematización técnica.
                3. 3 preguntas reflexivas para el colectivo.
                4. 2 notas finales para el colectivo.

                Estructura de respuesta requerida (JSON estricto):
                {
                    "dialogue": [
                        { "role": "Director", "name": "Director(a)", "content": "..." },
                        { "role": "Docente", "name": "Mtra. Ruth", "content": "..." },
                        { "role": "Docente", "name": "Mtro. Antonio", "content": "..." }
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
            `

            const responseText = await groqService.generateContent(prompt, true)
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
        } catch (e) {
            console.error(e)
            alert('Error generando proceso de codiseño con IA. Por favor verifica tu conexión o API Key.')
        } finally {
            setIsGenerating(false)
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
                            <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-4">Notas previas del colectivo (Opcional)</label>
                            <textarea
                                placeholder="Describe brevemente con tus palabras qué se discutió, qué dudas surgieron o qué acuerdos preliminares tomaron..."
                                className="w-full bg-gray-50 border-transparent rounded-2xl p-4 text-sm font-medium text-gray-700 min-h-[120px] focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
                                value={formData.codesign_process?.dialogue_notes || ''}
                                onChange={e => setFormData({
                                    ...formData,
                                    codesign_process: { ...formData.codesign_process, dialogue_notes: e.target.value }
                                })}
                            />
                            <p className="mt-4 text-xs text-gray-400 italic">
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
                    <div className="space-y-10">
                        {/* Diálogo Colectivo */}
                        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm relative group">
                            <button
                                onClick={() => setFormData({ ...formData, codesign_process: { ...formData.codesign_process, dialogue: [] } })}
                                className="absolute top-6 right-8 text-[10px] font-bold text-gray-400 uppercase hover:text-rose-500 transition-colors flex items-center gap-1 opacity-0 group-hover:opacity-100"
                            >
                                <RotateCcw className="w-3 h-3" /> Reiniciar y Editar Notas
                            </button>
                            <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 border-b pb-4">Diálogo del Colectivo Docente</h4>
                            <div className="space-y-6">
                                {formData.codesign_process?.dialogue?.map((chat, idx) => (
                                    <div key={idx} className={`flex gap-4 ${chat.role === 'Director' ? 'flex-row' : 'flex-row-reverse'}`}>
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${chat.role === 'Director' ? 'bg-indigo-600 text-white' : 'bg-rose-100 text-rose-600'}`}>
                                            {chat.name[0]}
                                        </div>
                                        <div className={`p-4 rounded-2xl text-sm max-w-[80%] ${chat.role === 'Director' ? 'bg-indigo-50 text-indigo-900' : 'bg-gray-50 text-gray-700'}`}>
                                            <span className="block font-black text-[10px] uppercase opacity-50 mb-1">{chat.name}</span>
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
                                            <th className="pb-4 font-black text-gray-400 uppercase w-1/5 pr-4">¿Qué hay en el P. Sintético?</th>
                                            <th className="pb-4 font-black text-gray-400 uppercase w-1/5 px-4">¿Qué NO hay / Falta?</th>
                                            <th className="pb-4 font-black text-gray-400 uppercase w-1/5 px-4">Certezas / Problemas</th>
                                            <th className="pb-4 font-black text-gray-400 uppercase w-1/5 px-4">Causas / Consecuencias</th>
                                            <th className="pb-4 font-black text-gray-400 uppercase w-1/5 pl-4">¿Qué queremos logar?</th>
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
                                            <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center shrink-0 border border-green-200 text-[10px] font-black text-green-600">{idx + 1}</div>
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

    // --- Step 6: Codiseño de Contenidos ---
    const renderStep6_Didactic = () => {
        const hasContents = Object.values(formData.program_by_fields).some((arr: any) => arr.length > 0)

        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-3xl flex items-start gap-4">
                    <div className="p-3 bg-white rounded-xl shadow-sm">
                        <Briefcase className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-indigo-900 uppercase tracking-wide">Tercer Plano: Codiseño</h3>
                        <p className="text-sm text-indigo-700 mt-1">
                            Define los PDAs contextualizados, la metodología y la evaluación para cada contenido seleccionado. La IA puede generar una propuesta inicial.
                        </p>
                    </div>
                </div>

                {!hasContents ? (
                    <div className="flex justify-center py-10">
                        <button
                            onClick={handleGenerateDidactic}
                            disabled={isGenerating}
                            className="bg-gray-900 text-white px-10 py-5 rounded-3xl font-black uppercase tracking-widest shadow-2xl hover:scale-105 transition-all flex items-center gap-4 group"
                        >
                            {isGenerating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6 text-yellow-400 group-hover:rotate-12 transition-transform" />}
                            <span className="text-lg">Generar Propuesta Didáctica (IA)</span>
                        </button>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {Object.entries(formData.program_by_fields).map(([field, items]: any) => {
                            if (items.length === 0) return null
                            return (
                                <div key={field} className="bg-white rounded-[2.5rem] border border-gray-100 shadow-lg overflow-hidden">
                                    <div className="bg-indigo-600 px-8 py-5 border-b border-indigo-700">
                                        <h4 className="font-black text-white uppercase tracking-widest text-sm flex items-center">
                                            <Briefcase className="w-5 h-5 mr-3 text-indigo-200" /> {field === 'saberes' ? 'Saberes y Pensamiento' : field}
                                        </h4>
                                    </div>
                                    <div className="p-6 overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead>
                                                <tr className="border-b border-gray-100">
                                                    <th className="pb-4 font-black text-gray-400 uppercase text-xs w-1/4">Contenido</th>
                                                    <th className="pb-4 font-black text-gray-400 uppercase text-xs w-1/4">PDA Contextualizado</th>
                                                    <th className="pb-4 font-black text-gray-400 uppercase text-xs w-1/4">Metodología / Proyecto</th>
                                                    <th className="pb-4 font-black text-gray-400 uppercase text-xs w-1/4">Evaluación</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {items.map((item: any, idx: number) => (
                                                    <tr key={idx} className="group hover:bg-gray-50/50 transition-colors">
                                                        <td className="py-6 pr-4 align-top">
                                                            <p className="font-bold text-gray-800 mb-1">{item.contentName}</p>
                                                            <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded-full font-bold uppercase">{item.timeframe}</span>
                                                        </td>
                                                        <td className="py-6 px-4 align-top space-y-4">
                                                            <div>
                                                                <span className="text-[10px] text-indigo-400 font-bold uppercase mb-1 block">1er Grado</span>
                                                                <textarea
                                                                    className="w-full bg-white border-gray-200 rounded-lg text-xs p-2 focus:ring-2 focus:ring-indigo-500"
                                                                    value={item.pda_grade_1}
                                                                    onChange={(e) => {
                                                                        const newItems = [...items]
                                                                        newItems[idx].pda_grade_1 = e.target.value
                                                                        setFormData(prev => ({ ...prev, program_by_fields: { ...prev.program_by_fields, [field]: newItems } }))
                                                                    }}
                                                                />
                                                            </div>
                                                            {/* Add logic/UI for 2nd and 3rd grade if needed or tabbed */}
                                                        </td>
                                                        <td className="py-6 px-4 align-top">
                                                            <textarea
                                                                className="w-full bg-white border-gray-200 rounded-lg text-xs p-2 focus:ring-2 focus:ring-indigo-500 h-24"
                                                                value={item.methodology}
                                                                onChange={(e) => {
                                                                    const newItems = [...items]
                                                                    newItems[idx].methodology = e.target.value
                                                                    setFormData(prev => ({ ...prev, program_by_fields: { ...prev.program_by_fields, [field]: newItems } }))
                                                                }}
                                                            />
                                                        </td>
                                                        <td className="py-6 pl-4 align-top">
                                                            <textarea
                                                                className="w-full bg-white border-gray-200 rounded-lg text-xs p-2 focus:ring-2 focus:ring-indigo-500 h-24"
                                                                value={item.evaluation}
                                                                onChange={(e) => {
                                                                    const newItems = [...items]
                                                                    newItems[idx].evaluation = e.target.value
                                                                    setFormData(prev => ({ ...prev, program_by_fields: { ...prev.program_by_fields, [field]: newItems } }))
                                                                }}
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
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
                            <div><span className="block text-xs font-bold text-gray-400 uppercase">Escuela</span>{formData.school_data.name}</div>
                            <div><span className="block text-xs font-bold text-gray-400 uppercase">CCT</span>{formData.school_data.cct}</div>
                            <div><span className="block text-xs font-bold text-gray-400 uppercase">Zona</span>{formData.school_data.zone}</div>
                            <div><span className="block text-xs font-bold text-gray-400 uppercase">Nivel</span>{formData.school_data.level}</div>
                        </div>
                    </div>

                    {/* 2. Diagnosis */}
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative group hover:border-indigo-200 transition-all">
                        <button onClick={() => setCurrentStep(2)} className="absolute top-6 right-6 text-xs font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity uppercase">Editar</button>
                        <h4 className="font-black text-gray-800 uppercase tracking-wide text-sm mb-4 flex items-center"><BookOpen className="w-4 h-4 mr-2" /> Diagnóstico</h4>
                        <div className="text-sm text-gray-600 italic leading-relaxed whitespace-pre-line">
                            {formData.diagnosis.narrative_final || (
                                <span className="text-gray-400">Sin diagnóstico generado aún. Regresa al paso 2 para generarlo con IA.</span>
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

                    {/* 5. Codesign Summary */}
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative group hover:border-indigo-200 transition-all">
                        <button onClick={() => setCurrentStep(6)} className="absolute top-6 right-6 text-xs font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity uppercase">Editar</button>
                        <h4 className="font-black text-gray-800 uppercase tracking-wide text-sm mb-4 flex items-center"><Briefcase className="w-4 h-4 mr-2" /> Plano Didáctico</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            {Object.entries(formData.program_by_fields).map(([field, items]: any) => (
                                <div key={field} className="bg-gray-50 rounded-xl p-3 text-center">
                                    <span className="block text-xs font-bold text-gray-400 uppercase mb-1">{field}</span>
                                    <span className="text-2xl font-black text-indigo-600">{items.length}</span>
                                    <span className="block text-[10px] text-gray-500">Contenidos</span>
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
                codesign_process: formData.codesign_process // Store codiseño here
            }

            const programData = {
                tenant_id: tenant.id,
                school_data: formData.school_data,
                group_diagnosis: updatedDiagnosis,
                program_by_fields: formData.program_by_fields,
                status: 'COMPLETED',
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
                    .insert([programData])
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

    return (
        <div className="min-h-screen bg-gray-50/50 pb-20">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/analytical-program')} className="p-2 hover:bg-gray-100 rounded-full transition-all">
                            <ArrowLeft className="w-6 h-6 text-gray-500" />
                        </button>
                        <div>
                            <h1 className="text-xl font-black text-gray-900 tracking-tight">Constructor de Programa Analítico</h1>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider hidden sm:block">Nueva Escuela Mexicana • Fase 6</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                            Paso {currentStep} de {STEPS.length}
                        </span>
                    </div>
                </div>
                {/* Progress Bar */}
                <div className="h-1 bg-gray-100 w-full">
                    <div
                        className="h-full bg-indigo-600 transition-all duration-500 ease-out"
                        style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
                    />
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                {/* Step Title */}
                <div className="mb-10 text-center">
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-lg border border-gray-100 flex items-center justify-center mx-auto mb-4">
                        {(() => {
                            const step = STEPS[currentStep - 1]
                            if (!step) return <School className="w-8 h-8 text-indigo-600" />
                            const Icon = step.icon
                            return <Icon className="w-8 h-8 text-indigo-600" />
                        })()}
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 mb-2">{STEPS[currentStep - 1]?.title || 'Paso'}</h2>
                    <p className="text-gray-500 font-medium">{STEPS[currentStep - 1]?.description || ''}</p>
                </div>

                {/* Step Content */}
                <div className="mb-12">
                    {currentStep === 1 && renderStep1()}
                    {currentStep === 2 && renderStep2()}
                    {currentStep === 3 && renderStep3()}
                    {currentStep === 4 && renderStep4()}
                    {currentStep === 5 && renderStep5_Process()}
                    {currentStep === 6 && renderStep6_Didactic()}
                    {currentStep === 7 && renderStep7_Review()}
                </div>

                {/* Footer Navigation */}
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-50">
                    <div className="max-w-5xl mx-auto flex justify-between items-center">
                        <button
                            onClick={handleBack}
                            disabled={currentStep === 1}
                            className="bg-white border border-gray-200 text-gray-600 px-6 py-3 rounded-xl font-bold text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center"
                        >
                            <ChevronLeft className="w-4 h-4 mr-2" />
                            Anterior
                        </button>
                        <button
                            onClick={currentStep === STEPS.length ? handleSaveProgram : handleNext}
                            disabled={saving}
                            className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200 flex items-center min-w-[160px] justify-center"
                        >
                            {saving ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : null}
                            {saving ? 'Guardando...' : currentStep === STEPS.length ? 'Guardar Programa' : 'Siguiente'}
                            {!saving && <ChevronRight className="w-4 h-4 ml-2" />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
