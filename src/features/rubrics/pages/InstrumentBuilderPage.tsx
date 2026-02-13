import { useState } from 'react'
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
        <div className="max-w-5xl mx-auto px-4 py-8">
            <button onClick={() => navigate('/rubrics')} className="text-gray-500 hover:text-gray-900 flex items-center mb-6">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver al Banco
            </button>

            {step === 1 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h1 className="text-3xl font-bold text-gray-900">Banco de Instrumentos</h1>
                    <p className="mt-2 text-gray-600">
                        Gestiona tus instrumentos de evaluación (Rúbricas, Listas de Cotejo, Exámenes, etc.).
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {INSTRUMENT_TYPES.map(type => (
                            <button
                                key={type.id}
                                onClick={() => handleTypeSelect(type)}
                                className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all text-left flex flex-col group h-full"
                            >
                                <div className="p-3 bg-gray-50 text-gray-600 rounded-xl w-fit group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors mb-4">
                                    <type.icon className="w-6 h-6" />
                                </div>
                                <h3 className="font-bold text-gray-900 mb-1">{type.title}</h3>
                                <p className="text-sm text-gray-500">{type.description}</p>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="max-w-2xl mx-auto text-center animate-in fade-in zoom-in-95 duration-300">
                    <div className="inline-block p-4 bg-indigo-50 text-indigo-600 rounded-2xl mb-6">
                        <selectedType.icon className="w-12 h-12" />
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 mb-4">Crear {selectedType.title}</h2>
                    <p className="text-gray-500 mb-8 max-w-lg mx-auto">
                        ¿Sobre qué tema es la actividad? Nuestra IA generará una estructura base que podrás editar.
                    </p>

                    <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-xl text-left relative overflow-hidden">
                        {/* Decorative BG */}
                        <div className="absolute top-0 right-0 p-12 -mr-10 -mt-10 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-full blur-3xl opacity-50" />

                        <label className="block text-sm font-bold text-gray-900 mb-2">Tema o Actividad</label>
                        <input
                            type="text"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="Ej. La Revolución Mexicana, Ecuaciones de 2do Grado..."
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 font-medium text-lg focus:ring-2 focus:ring-indigo-500 outline-none mb-6"
                            autoFocus
                        />

                        <button
                            onClick={generateInstrument}
                            disabled={!topic.trim() || isGenerating}
                            className={`w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg flex items-center justify-center transition-all
                                ${!topic.trim() || isGenerating ? 'bg-gray-300 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:scale-[1.02]'}
                            `}
                        >
                            {isGenerating ? (
                                <>
                                    <Brain className="w-6 h-6 mr-3 animate-pulse" />
                                    Generando Estructura...
                                </>
                            ) : (
                                <>
                                    <Wand2 className="w-6 h-6 mr-3" />
                                    Generar con IA Mágica
                                </>
                            )}
                        </button>
                    </div>

                    <button
                        onClick={() => setStep(1)}
                        className="mt-8 text-gray-400 hover:text-gray-600 font-medium text-sm"
                    >
                        Cancelar y volver
                    </button>
                </div>
            )}
        </div>
    )
}
