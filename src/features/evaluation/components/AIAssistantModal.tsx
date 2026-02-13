import { useState, useEffect } from 'react'
import { X, Zap, Sparkles, ArrowRight, Loader2, BookOpen } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

type AIAssistantModalProps = {
    isOpen: boolean
    onClose: () => void
    groupId: string
    subjectId?: string
    criteria: any[]
    onSuggestionSelected: (data: any) => void
}

export const AIAssistantModal = ({
    isOpen,
    onClose,
    groupId,
    subjectId,
    criteria,
    onSuggestionSelected
}: AIAssistantModalProps) => {
    const [loading, setLoading] = useState(false)
    const [lessonPlan, setLessonPlan] = useState<any>(null)
    const [suggestions, setSuggestions] = useState<any[]>([])

    useEffect(() => {
        if (isOpen) {
            fetchLessonPlan()
        }
    }, [isOpen, groupId, subjectId])

    const fetchLessonPlan = async () => {
        setLoading(true)
        try {
            // Buscamos el plan de clase más reciente para este grupo y materia
            const query = supabase
                .from('lesson_plans')
                .select('*')
                .eq('group_id', groupId)

            if (subjectId) {
                query.eq('subject_id', subjectId)
            }

            const { data, error } = await query
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

            if (error) throw error

            setLessonPlan(data)
            if (data) {
                generateSuggestions(data.topic)
            }
        } catch (err) {
            console.error('Error fetching lesson plan:', err)
            setLessonPlan(null)
        } finally {
            setLoading(false)
        }
    }

    const generateSuggestions = (topic: string) => {
        // Simulación de Lógica de IA pedagógica
        const baseSuggestions = [
            {
                title: `Tarea: Ensayo sobre ${topic}`,
                description: `Desarrollar un texto descriptivo que analice los puntos fundamentales de ${topic}, destacando su importancia en el contexto actual.`,
                type: 'HOMEWORK',
                criterion: criteria.find(c => c.name.toLowerCase().includes('tarea') || c.name.toLowerCase().includes('clase'))?.id || criteria[0]?.id,
                due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            },
            {
                title: `Proyecto: Aplicación Práctica de ${topic}`,
                description: `Crear una maqueta, experimento o presentación creativa que demuestre el dominio práctico de los conceptos de ${topic}.`,
                type: 'PROJECT',
                criterion: criteria.find(c => c.name.toLowerCase().includes('proyecto') || c.name.toLowerCase().includes('evaluación'))?.id || criteria[0]?.id,
                start_date: new Date().toISOString().split('T')[0],
                due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            },
            {
                title: `Evaluación Flash: ${topic}`,
                description: `Cuestionario rápido de 5 preguntas sobre la sesión anterior para verificar la retención de conocimientos clave.`,
                type: 'EXAM',
                criterion: criteria.find(c => c.name.toLowerCase().includes('examen') || c.name.toLowerCase().includes('prueba'))?.id || criteria[0]?.id,
                due_date: new Date().toISOString().split('T')[0]
            }
        ]
        setSuggestions(baseSuggestions)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="bg-gray-900 p-6 text-white relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
                    <div className="flex justify-between items-center relative z-10">
                        <div className="flex items-center">
                            <div className="bg-blue-500 p-2 rounded-xl mr-3 shadow-lg shadow-blue-500/20">
                                <Zap className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">Asistente IA de Actividades</h2>
                                <p className="text-blue-200 text-xs">Potenciando tu didáctica con inteligencia artificial</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="p-8">
                    {loading ? (
                        <div className="py-12 flex flex-col items-center">
                            <div className="relative">
                                <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                                <Sparkles className="w-5 h-5 text-amber-500 absolute -top-1 -right-1 animate-pulse" />
                            </div>
                            <p className="mt-6 text-gray-500 font-medium">Consultando planeación didáctica...</p>
                            <p className="text-xs text-gray-400 mt-1">Generando sugerencias pedagógicas personalizadas</p>
                        </div>
                    ) : lessonPlan ? (
                        <div className="space-y-6">
                            <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 flex items-start">
                                <div className="bg-white p-2 rounded-lg mr-4 shadow-sm">
                                    <BookOpen className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Contexto Detectado</p>
                                    <h3 className="text-lg font-bold text-gray-900 leading-tight">Tema: {lessonPlan.topic}</h3>
                                    <p className="text-sm text-blue-800/60 mt-1 line-clamp-1">{lessonPlan.subject}</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <p className="text-sm font-bold text-gray-700 ml-1">Sugerencias Generadas por IA:</p>
                                <div className="grid gap-3">
                                    {suggestions.map((s, i) => (
                                        <button
                                            key={i}
                                            onClick={() => onSuggestionSelected(s)}
                                            className="w-full text-left p-4 rounded-2xl border border-gray-100 hover:border-blue-400 hover:bg-blue-50/30 transition-all group flex items-center justify-between shadow-sm hover:shadow-md"
                                        >
                                            <div className="flex-1">
                                                <div className="flex items-center mb-1">
                                                    <div className={`p-1 rounded-md mr-2 ${s.type === 'PROJECT' ? 'bg-purple-100 text-purple-600' :
                                                        s.type === 'EXAM' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                                                        }`}>
                                                        <Sparkles className="w-3 h-3" />
                                                    </div>
                                                    <h4 className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors">{s.title}</h4>
                                                </div>
                                                <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed pl-7">{s.description}</p>
                                            </div>
                                            <div className="bg-white p-2 rounded-full shadow-sm border border-gray-50 group-hover:bg-blue-600 group-hover:text-white transition-all ml-4">
                                                <ArrowRight className="w-4 h-4" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="py-12 text-center">
                            <div className="h-20 w-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <BookOpen className="w-10 h-10 text-gray-300" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900">Sin Contexto de Planeación</h3>
                            <p className="text-gray-500 text-sm max-w-sm mx-auto mt-3 leading-relaxed">
                                No hemos encontrado una planeación activa para <b>{subjectId || 'esta materia'}</b>.
                                Necesito un plan de clase para poder sugerirte actividades que se alineen con tus objetivos.
                            </p>
                            <div className="mt-8 flex justify-center space-x-3">
                                <button
                                    onClick={onClose}
                                    className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                                >
                                    Cerrar
                                </button>
                                <button
                                    onClick={onClose}
                                    className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                                >
                                    Ir a Planeación
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
