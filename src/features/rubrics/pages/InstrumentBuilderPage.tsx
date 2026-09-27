import { useState } from 'react'
import { WizardField, WizardFooter, WizardLayout, WizardStepHeader, wizardInput } from '../../../components/wizard/Wizard'
import { useNavigate } from 'react-router-dom'
import {
    CheckSquare, List, FileText, HelpCircle,
    Search, MessageSquare, Clock, Users, Database,
    Brain, Wand2, ArrowLeft
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'

const INSTRUMENT_TYPES = [
    { id: 'ANALYTIC', title: 'Rúbrica Analítica', icon: Database, description: 'Matriz detallada con criterios y niveles de desempeño.' },
    { id: 'CHECKLIST', title: 'Lista de Cotejo', icon: CheckSquare, description: 'Lista de verificación de sí/no para requisitos.' },
    { id: 'QUIZ', title: 'Cuestionario', icon: HelpCircle, description: 'Preguntas abiertas o cerradas para evaluar conocimientos.' },
    { id: 'OBSERVATION', title: 'Hoja de Observación', icon: Search, description: 'Registro de comportamientos o habilidades en tiempo real.' },
    { id: 'JOURNAL', title: 'Diario Reflexivo', icon: FileText, description: 'Prompts para que el alumno reflexione sobre su aprendizaje.' },
    { id: 'TEST', title: 'Prueba Corta', icon: Clock, description: 'Evaluación rápida con preguntas de opción múltiple.' },
    { id: 'INTERVIEW', title: 'Guía de Entrevista', icon: MessageSquare, description: 'Preguntas estructuradas para diálogo 1 a 1.' },
    { id: 'PORTFOLIO', title: 'Portafolio', icon: List, description: 'Colección organizada de evidencias de aprendizaje.' },
    { id: 'MAP', title: 'Mapa Conceptual', icon: Database, description: 'Estructura para organizar conceptos visualmente.' },
    { id: 'SELF_ASSESSMENT', title: 'Autoevaluación', icon: Users, description: 'Escala para que el alumno juzgue su propio trabajo.' },
]

export const InstrumentBuilderPage = () => {
    const navigate = useNavigate()
    const { data: tenant } = useTenant()

    const [step, setStep] = useState(1) // 1: Type Selection, 2: Mode Selection, 3: Editor
    const [selectedType, setSelectedType] = useState<any>(null)
    const [topic, setTopic] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)

    const handleTypeSelect = (type: any) => {
        setSelectedType(type)
        setStep(2)
    }

    const generateInstrument = async () => {
        if (!topic.trim()) return
        setIsGenerating(true)

        // SIMULATED AI GENERATION (WIZARD OF OZ)
        await new Promise(resolve => setTimeout(resolve, 2000))

        const generatedContent = mockAIGeneration(selectedType.id, topic)

        // Save to DB Draft
        const { data: { user } } = await supabase.auth.getUser()
        if (user && tenant) {
            const { data } = await supabase.from('rubrics').insert({
                tenant_id: tenant.id,
                title: `${selectedType.title}: ${topic}`,
                description: `Instrumento generado por IA sobre: ${topic}`,
                type: selectedType.id,
                content: generatedContent,
                is_ai_generated: true,
                original_prompt: topic
            }).select().single()

            if (data) {
                // Navigate to Editor (To be implemented, reusing RubricEditor for now or generic)
                // For now, go back to list to see it created
                navigate('/rubrics')
            }
        }
        setIsGenerating(false)
    }

    // Mock Generator Logic
    const mockAIGeneration = (type: string, topic: string) => {
        // Return structured JSON based on type
        switch (type) {
            case 'CHECKLIST':
                return {
                    items: [
                        { text: `Define correctamente los conceptos clave de ${topic}`, checked: false },
                        { text: `Utiliza fuentes confiables para investigar ${topic}`, checked: false },
                        { text: `Presenta conclusiones claras sobre ${topic}`, checked: false }
                    ]
                }
            case 'QUIZ':
                return {
                    questions: [
                        { text: `¿Cuál es la importancia principal de ${topic}?`, type: 'OPEN' },
                        { text: `Describe dos características de ${topic}`, type: 'OPEN' }
                    ]
                }
            default:
                // Default rubric structure
                return {
                    criteria: [
                        { title: 'Conocimiento', weight: 40, levels: [{ title: 'Experto', score: 4 }, { title: 'Novato', score: 1 }] },
                        { title: 'Análisis', weight: 30, levels: [{ title: 'Profundo', score: 4 }, { title: 'Superficial', score: 1 }] }
                    ]
                }
        }
    }

    return (
        <WizardLayout
            eyebrow="Banco de instrumentos"
            title={step === 1 ? 'Nuevo instrumento de evaluación' : `Crear ${selectedType.title.toLowerCase()}`}
            subtitle={step === 1 ? 'Rúbricas, listas de cotejo, exámenes y más.' : 'La IA genera una estructura base que podrás editar.'}
            steps={[{ label: 'Tipo de instrumento' }, { label: 'Tema' }]}
            current={step - 1}
            onStepClick={i => setStep(i + 1)}
            width="lg"
            headerAction={<button onClick={() => navigate('/rubrics')} className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100"><ArrowLeft className="w-4 h-4" /> Volver</button>}
            footer={step === 2 ? (
                <WizardFooter onBack={() => setStep(1)} onNext={generateInstrument} nextDisabled={!topic.trim()} loading={isGenerating}
                    nextLabel={isGenerating ? 'Generando estructura…' : 'Generar con IA'} nextIcon={isGenerating ? Brain : Wand2} />
            ) : undefined}
        >
            {step === 1 && (
                <>
                    <WizardStepHeader title="¿Qué quieres crear?" description="Elige el tipo de instrumento." />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {INSTRUMENT_TYPES.map(type => (
                            <button
                                key={type.id}
                                onClick={() => handleTypeSelect(type)}
                                className="p-4 sm:p-5 rounded-2xl border-2 border-slate-200 bg-white hover:border-indigo-300 transition text-left flex flex-col group h-full"
                            >
                                <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                                    <type.icon className="w-5 h-5" />
                                </div>
                                <h3 className="font-black text-slate-900 mb-1">{type.title}</h3>
                                <p className="text-sm text-slate-500">{type.description}</p>
                            </button>
                        ))}
                    </div>
                </>
            )}

            {step === 2 && (
                <>
                    <WizardStepHeader icon={selectedType.icon} title="Tema o actividad" description="¿Sobre qué tema es la actividad?" />
                    <WizardField label="Tema o actividad" required>
                        <input aria-label="Tema o Actividad" type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && topic.trim() && !isGenerating) generateInstrument() }}
                            placeholder="Ej. La Revolución Mexicana, ecuaciones de segundo grado…" className={wizardInput} autoFocus />
                    </WizardField>
                </>
            )}
        </WizardLayout>
    )
}
