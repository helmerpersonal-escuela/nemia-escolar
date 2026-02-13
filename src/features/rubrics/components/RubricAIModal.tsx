
import { useState } from 'react'
import { Wand2, Sparkles, Loader2, X } from 'lucide-react'

interface GeneratedRubricData {
    title: string
    description: string
    rubric_levels: { title: string; score: number }[]
    rubric_criteria: { title: string }[]
    descriptors: Record<string, string> // key: "cIndex-lIndex"
}

interface RubricAIModalProps {
    isOpen: boolean
    onClose: () => void
    onGenerate: (data: GeneratedRubricData) => void
}

export const RubricAIModal = ({ isOpen, onClose, onGenerate }: RubricAIModalProps) => {
    const [topic, setTopic] = useState('')
    const [grade, setGrade] = useState('')
    const [loading, setLoading] = useState(false)

    if (!isOpen) return null

    // Mock AI Service
    const simulateAIGeneration = async () => {
        setLoading(true)

        // Simulating network delay
        await new Promise(resolve => setTimeout(resolve, 2500))

        // Mock Response
        const mockData: GeneratedRubricData = {
            title: `Rúbrica de ${topic} (${grade || 'General'})`,
            description: `Evaluación detallada para ${topic} enfocada en competencias clave.`,
            rubric_levels: [
                { title: 'Principiante', score: 1 },
                { title: 'En Desarrollo', score: 2 },
                { title: 'Competente', score: 3 },
                { title: 'Avanzado', score: 4 }
            ],
            rubric_criteria: [
                { title: 'Contenido y Precisión' },
                { title: 'Organización y Estructura' },
                { title: 'Uso del Lenguaje' },
                { title: 'Pensamiento Crítico' }
            ],
            descriptors: {
                // Row 0: Contenido
                "0-0": "El contenido es irrelevante o contiene múltiples errores factuales.",
                "0-1": "El contenido es parcialmente preciso pero superficial.",
                "0-2": "El contenido es preciso y cubre los puntos principales.",
                "0-3": "El contenido es profundo, preciso y muestra dominio del tema.",

                // Row 1: Organización
                "1-0": "Las ideas están desordenadas y es difícil seguir el hilo.",
                "1-1": "Hay cierta estructura, pero las transiciones son bruscas.",
                "1-2": "La estructura es clara con introducción, desarrollo y conclusión.",
                "1-3": "La organización es lógica, fluida y engancha al lector.",

                // Row 2: Lenguaje
                "2-0": "Vocabulario limitado y múltiples errores gramaticales.",
                "2-1": "Vocabulario básico con algunos errores que distraen.",
                "2-2": "Lenguaje claro y adecuado al contexto.",
                "2-3": "Vocabulario rico, variado y uso preciso de la terminología.",

                // Row 3: Pensamiento Crítico
                "3-0": "Solo repite información sin análisis.",
                "3-1": "Intenta analizar pero se queda en lo obvio.",
                "3-2": "Muestra capacidad de análisis y conexión de ideas.",
                "3-3": "Propone perspectivas originales y argumentos sólidos."
            }
        }

        onGenerate(mockData)
        setLoading(false)
        onClose()
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-purple-100">

                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="flex items-center space-x-3 mb-2">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                            <Sparkles className="w-6 h-6 text-yellow-300" />
                        </div>
                        <h2 className="text-xl font-bold">Generador Mágico IA</h2>
                    </div>
                    <p className="text-purple-100 text-sm">
                        Describe qué quieres evaluar y la IA creará la rúbrica por ti.
                    </p>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Tema o Actividad a Evaluar
                        </label>
                        <input
                            type="text"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="Ej. Ensayo sobre la Revolución Mexicana, Exposición Oral..."
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all font-medium"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Grado Escolar (Opcional)
                        </label>
                        <select
                            value={grade}
                            onChange={(e) => setGrade(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 bg-white"
                        >
                            <option value="">Seleccionar grado...</option>
                            <option value="1° Secundaria">1° Secundaria</option>
                            <option value="2° Secundaria">2° Secundaria</option>
                            <option value="3° Secundaria">3° Secundaria</option>
                        </select>
                    </div>

                    <div className="bg-purple-50 p-3 rounded-lg flex items-start text-xs text-purple-800">
                        <Wand2 className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                        <p>La IA analizará el tema y propondrá criterios, niveles y descriptores alineados curricularmente.</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 pt-2 bg-gray-50 border-t border-gray-100 flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={simulateAIGeneration}
                        disabled={!topic || loading}
                        className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-medium shadow-lg shadow-purple-200 hover:shadow-xl hover:translate-y-[-1px] transition-all disabled:opacity-50 disabled:hover:translate-y-0 flex items-center"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Generando...
                            </>
                        ) : (
                            <>
                                <Wand2 className="w-4 h-4 mr-2" />
                                Generar Rúbrica
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
