
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { Plus, FileText, Trash2, Edit } from 'lucide-react'
import { useTenant } from '../../../hooks/useTenant'

interface Rubric {
    id: string
    title: string
    description: string
    type: 'ANALYTIC' | 'HOLISTIC' | 'CHECKLIST' | 'QUIZ' | 'OBSERVATION' | 'JOURNAL' | 'TEST' | 'INTERVIEW' | 'PORTFOLIO' | 'MAP' | 'SELF_ASSESSMENT'
    updated_at: string
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
        if (!confirm('¿Estás seguro de eliminar esta rúbrica?')) return

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
                    <h1 className="text-3xl font-bold text-gray-900">Banco de Instrumentos</h1>
                    <p className="mt-2 text-gray-700">
                        Gestiona tus instrumentos de evaluación.
                    </p>
                </div>
                <Link
                    to="/rubrics/new"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center shadow-sm font-medium"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    Nueva Instrumento
                </Link>
            </div>

            {loading ? (
                <div className="text-center py-12">Cargando rúbricas...</div>
            ) : rubrics.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-gray-200">
                    <FileText className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No tienes instrumentos aún</h3>
                    <p className="mt-1 text-sm text-gray-500">
                        Crea tu primer instrumento de evaluación (rúbrica, lista de cotejo, etc).
                    </p>
                    <Link
                        to="/rubrics/new"
                        className="text-blue-600 font-medium hover:text-blue-800"
                    >
                        Crear ahora &rarr;
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {rubrics.map((rubric) => (
                        <div key={rubric.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col">
                            <div className="flex justify-between items-start mb-4">
                                <div className={`px-2 py-1 rounded text-xs font-semibold
                                    ${rubric.type === 'ANALYTIC' ? 'bg-purple-100 text-purple-700' :
                                        rubric.type === 'HOLISTIC' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}
                                `}>
                                    {rubric.type}
                                </div>
                                <div className="flex space-x-2">
                                    <Link to={`/rubrics/${rubric.id}`} className="text-gray-400 hover:text-blue-600 p-1">
                                        <Edit className="w-4 h-4" />
                                    </Link>
                                    <button
                                        onClick={() => handleDelete(rubric.id)}
                                        className="text-gray-400 hover:text-red-600 p-1"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">{rubric.title}</h3>
                            <p className="text-sm text-gray-500 line-clamp-3 mb-4 flex-1">
                                {rubric.description || 'Sin descripción'}
                            </p>
                            <div className="text-xs text-gray-400 pt-4 border-t border-gray-100 mt-auto">
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
