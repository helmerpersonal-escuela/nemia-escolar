import { EmptyState } from '../../../components/ui/EmptyState'

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { Plus, FileText, Trash2, Edit } from 'lucide-react'
import { useTenant } from '../../../hooks/useTenant'
import { askConfirm } from '../../../components/ui/ConfirmDialog'

interface Rubric {
    id: string
    title: string
    description: string
    type: 'ANALYTIC' | 'HOLISTIC' | 'CHECKLIST' | 'QUIZ' | 'OBSERVATION' | 'JOURNAL' | 'TEST' | 'INTERVIEW' | 'PORTFOLIO' | 'MAP' | 'SELF_ASSESSMENT'
    updated_at: string
    is_ai_generated?: boolean
}

const TYPE_LABEL: Record<string, string> = {
    ANALYTIC: 'Rúbrica', HOLISTIC: 'Rúbrica global', CHECKLIST: 'Lista de cotejo', QUIZ: 'Cuestionario',
    OBSERVATION: 'Hoja de observación', JOURNAL: 'Diario reflexivo', TEST: 'Prueba corta', INTERVIEW: 'Guía de entrevista',
    PORTFOLIO: 'Portafolio', MAP: 'Mapa conceptual', SELF_ASSESSMENT: 'Autoevaluación',
}

export const RubricListPage = () => {
    const { data: tenant } = useTenant()
    const [rubrics, setRubrics] = useState<Rubric[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (tenant) fetchRubrics()
    }, [tenant])

    const fetchRubrics = async () => {
        try {
            const { data, error } = await supabase
                .from('rubrics')
                .select('*')
                .eq('tenant_id', tenant?.id)
                .order('updated_at', { ascending: false })

            if (error) throw error
            setRubrics(data || [])
        } catch (err) {
            console.error('Error fetching rubrics:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!(await askConfirm('¿Estás seguro de eliminar esta rúbrica?'))) return

        try {
            const { error } = await supabase.from('rubrics').delete().eq('id', id)
            if (error) throw error
            setRubrics(rubrics.filter(r => r.id !== id))
        } catch (err) {
            console.error('Error deleting rubric:', err)
        }
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="sm:flex sm:items-center">
                <div className="sm:flex-auto">
                    <h1 className="text-3xl font-bold text-gray-900">Instrumentos de evaluación</h1>
                    <p className="mt-2 text-gray-700">
                        Rúbricas, listas de cotejo y cuestionarios para calificar a tus alumnos.
                    </p>
                </div>
                <Link
                    to="/rubrics/new"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center shadow-sm font-medium"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    Nuevo instrumento
                </Link>
            </div>

            {loading ? (
                <div className="text-center py-12">Cargando tus instrumentos…</div>
            ) : rubrics.length === 0 ? (
                <EmptyState
                    icon={FileText}
                    title="Aún no tienes instrumentos de evaluación"
                    description="Un instrumento te ayuda a calificar de forma justa: una rúbrica, una lista de cotejo o un cuestionario. La IA te ayuda a armarlo a partir de tu planeación."
                    action={{ label: 'Crear mi primer instrumento', to: '/rubrics/new' }}
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {rubrics.map((rubric) => (
                        <div key={rubric.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                                <div className={`px-2 py-1 rounded text-xs font-semibold
                                    ${rubric.type === 'ANALYTIC' ? 'bg-purple-100 text-purple-700' :
                                        rubric.type === 'HOLISTIC' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}
                                `}>
                                    {TYPE_LABEL[rubric.type] ?? rubric.type}
                                </div>
                                <div className="flex space-x-2">
                                    <Link to={rubric.is_ai_generated ? `/rubrics/ver/${rubric.id}` : `/rubrics/${rubric.id}`} className="text-gray-500 hover:text-blue-600 p-1">
                                        <Edit className="w-4 h-4" />
                                    </Link>
                                    <button aria-label="Eliminar"
                                        onClick={() => handleDelete(rubric.id)}
                                        className="text-gray-500 hover:text-red-600 p-1"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">{rubric.title}</h3>
                            <p className="text-sm text-gray-500 line-clamp-3 mb-4 flex-1">
                                {rubric.description || 'Sin descripción'}
                            </p>
                            <div className="text-xs text-gray-500 pt-4 border-t border-gray-100 mt-auto">
                                Actualizado: {new Date(rubric.updated_at).toLocaleDateString()}
                            </div>
                        </div>
                    ))}
                </div>
            )
            }
        </div >
    )
}
