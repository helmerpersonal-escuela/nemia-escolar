
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { Plus, Save, ArrowLeft, Trash2, Wand2 } from 'lucide-react'
import { useTenant } from '../../../hooks/useTenant'
import { RubricAIModal } from '../components/RubricAIModal'

// Types
interface Level {
    id?: string
    title: string
    score: number
    order_index: number
}

interface Criterion {
    id?: string
    title: string
    description?: string
    weight?: number
    order_index: number
}

// Cell: Descriptor map key = "criterionIndex-levelIndex"
type DescriptorsMap = Record<string, string>

export const RubricEditorPage = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const { data: tenant } = useTenant()

    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [type, setType] = useState<'ANALYTIC' | 'HOLISTIC'>('ANALYTIC')
    const [isAIModalOpen, setIsAIModalOpen] = useState(false)

    // Grid State
    const [levels, setLevels] = useState<Level[]>([
        { title: 'Necesita Mejora', score: 1, order_index: 0 },
        { title: 'Satisfactorio', score: 2, order_index: 1 },
        { title: 'Bueno', score: 3, order_index: 2 },
        { title: 'Excelente', score: 4, order_index: 3 },
    ])

    const [criteria, setCriteria] = useState<Criterion[]>([
        { title: 'Criterio 1', order_index: 0 },
        { title: 'Criterio 2', order_index: 1 },
    ])

    const [descriptors, setDescriptors] = useState<DescriptorsMap>({})
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    // Load if editing... (Skipped for 'new' for now, focused on creation logic)

    const handleAIGenerated = (data: any) => {
        setTitle(data.title)
        setDescription(data.description)

        // Map levels
        const newLevels = data.rubric_levels.map((l: any, idx: number) => ({
            title: l.title,
            score: l.score,
            order_index: idx
        }))
        setLevels(newLevels)

        // Map Criteria
        const newCriteria = data.rubric_criteria.map((c: any, idx: number) => ({
            title: c.title,
            order_index: idx
        }))
        setCriteria(newCriteria)

        // Map descriptors
        setDescriptors(data.descriptors)
    }

    const handleDescriptorChange = (cIndex: number, lIndex: number, text: string) => {
        setDescriptors(prev => ({
            ...prev,
            [`${cIndex}-${lIndex}`]: text
        }))
    }

    const addLevel = () => {
        setLevels(prev => [...prev, { title: 'Nuevo Nivel', score: 0, order_index: prev.length }])
    }

    const addCriterion = () => {
        setCriteria(prev => [...prev, { title: 'Nuevo Criterio', order_index: prev.length }])
    }

    const removeLevel = (index: number) => {
        setLevels(prev => {
            if (prev.length <= 1) {
                alert('Debe haber al menos un nivel')
                return prev
            }
            return prev.filter((_, i) => i !== index)
        })
    }

    const removeCriterion = (index: number) => {
        setCriteria(prev => {
            if (prev.length <= 1) {
                alert('Debe haber al menos un criterio')
                return prev
            }
            return prev.filter((_, i) => i !== index)
        })
    }

    const handleSave = async () => {
        if (!title.trim()) return alert('El título es obligatorio')
        if (!tenant) return

        setSaving(true)
        try {
            // 1. Create Rubric
            const { data: rubric, error: rError } = await supabase
                .from('rubrics')
                .insert([{
                    tenant_id: tenant.id,
                    title,
                    description,
                    type
                }])
                .select()
                .single()

            if (rError) throw rError

            // 2. Create Levels (Columns)
            const levelsToInsert = levels.map((l, idx) => ({
                rubric_id: rubric.id,
                title: l.title,
                score: l.score,
                order_index: idx
            }))
            const { data: savedLevels, error: lError } = await supabase
                .from('rubric_levels')
                .insert(levelsToInsert)
                .select()

            if (lError) throw lError

            // 3. Create Criteria (Rows)
            const criteriaToInsert = criteria.map((c, idx) => ({
                rubric_id: rubric.id,
                title: c.title,
                weight: 0,
                order_index: idx
            }))
            const { data: savedCriteria, error: cError } = await supabase
                .from('rubric_criteria')
                .insert(criteriaToInsert)
                .select()

            if (cError) throw cError

            // 4. Create Descriptors
            // We need to map back the UI indices to the actual DB IDs
            // savedLevels are returned, but order might verify.
            // Assumption: select() returns in insert order or we verify by order_index.
            // Safest is to map by order_index since we saved it.

            const descriptorsToInsert = []

            // Sort to ensure index matching
            savedLevels.sort((a, b) => a.order_index - b.order_index)
            savedCriteria.sort((a, b) => a.order_index - b.order_index)

            for (let cIdx = 0; cIdx < savedCriteria.length; cIdx++) {
                for (let lIdx = 0; lIdx < savedLevels.length; lIdx++) {
                    const text = descriptors[`${cIdx}-${lIdx}`]
                    if (text) {
                        descriptorsToInsert.push({
                            criterion_id: savedCriteria[cIdx].id,
                            level_id: savedLevels[lIdx].id,
                            description: text
                        })
                    }
                }
            }

            if (descriptorsToInsert.length > 0) {
                const { error: dError } = await supabase
                    .from('rubric_descriptors')
                    .insert(descriptorsToInsert)
                if (dError) throw dError
            }

            alert('Rúbrica guardada correctamente')
            navigate('/rubrics')

        } catch (err: any) {
            console.error(err)
            alert('Error al guardar: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="max-w-full mx-auto px-4 py-6 h-screen flex flex-col">
            <RubricAIModal
                isOpen={isAIModalOpen}
                onClose={() => setIsAIModalOpen(false)}
                onGenerate={handleAIGenerated}
            />
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                    <button onClick={() => navigate('/rubrics')} className="mr-4 text-gray-500 hover:text-gray-700">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <input
                            type="text"
                            placeholder="Título de la Rúbrica (ej. Proyecto Final)"
                            className="text-2xl font-bold bg-transparent border-none focus:ring-0 placeholder-gray-300 w-full"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                        <input
                            type="text"
                            placeholder="Descripción opcional..."
                            className="text-sm text-gray-500 bg-transparent border-none focus:ring-0 placeholder-gray-300 w-full"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex space-x-3">
                    <button
                        onClick={() => setIsAIModalOpen(true)}
                        className="flex items-center px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all font-medium shadow-md"
                    >
                        <Wand2 className="w-4 h-4 mr-2" />
                        IA Mágica
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm disabled:opacity-50"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </div>

            {/* Editor Container - Excel Style */}
            <div className="flex-1 overflow-auto bg-white rounded-xl border border-gray-200 shadow-sm relative">
                <div className="min-w-[1000px] p-6">
                    {/* Header Row (Levels) */}
                    <div className="flex mb-4">
                        <div className="w-64 flex-shrink-0 pt-8 font-bold text-gray-400 text-sm uppercase tracking-wider pl-2">
                            Criterios / Niveles
                        </div>
                        <div className="flex flex-1 space-x-2 overflow-x-auto pb-2">
                            {levels.map((level, idx) => (
                                <div key={idx} className="w-64 flex-shrink-0 bg-gray-50 p-3 rounded-lg border border-gray-100 relative group">
                                    <input
                                        value={level.title}
                                        onChange={(e) => {
                                            const value = e.target.value
                                            setLevels(prev => {
                                                const next = [...prev]
                                                next[idx] = { ...next[idx], title: value }
                                                return next
                                            })
                                        }}
                                        className="w-full bg-transparent font-semibold text-gray-900 border-none focus:ring-0 p-0 mb-1"
                                    />
                                    <div className="flex items-center text-xs text-gray-500">
                                        <span>Puntos:</span>
                                        <input
                                            type="number"
                                            value={level.score}
                                            onChange={(e) => {
                                                const value = Number(e.target.value)
                                                setLevels(prev => {
                                                    const next = [...prev]
                                                    next[idx] = { ...next[idx], score: value }
                                                    return next
                                                })
                                            }}
                                            className="w-12 ml-1 bg-white border border-gray-200 rounded px-1 py-0.5 text-xs text-center"
                                        />
                                    </div>
                                    <button
                                        onClick={() => removeLevel(idx)}
                                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={addLevel}
                                className="w-10 flex-shrink-0 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg text-gray-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Rows (Criteria) */}
                    <div className="space-y-4">
                        {criteria.map((criterion, cIdx) => (
                            <div key={cIdx} className="flex">
                                {/* Row Header */}
                                <div className="w-64 flex-shrink-0 pr-4 pt-2 relative group">
                                    <input
                                        value={criterion.title}
                                        onChange={(e) => {
                                            const value = e.target.value
                                            setCriteria(prev => {
                                                const next = [...prev]
                                                next[cIdx] = { ...next[cIdx], title: value }
                                                return next
                                            })
                                        }}
                                        className="w-full font-bold text-gray-800 border-b border-transparent hover:border-gray-300 focus:border-blue-500 bg-transparent focus:ring-0 px-0 py-1 transition-colors"
                                    />
                                    <button
                                        onClick={() => removeCriterion(cIdx)}
                                        className="absolute left-[-24px] top-3 opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>

                                {/* Cells */}
                                <div className="flex flex-1 space-x-2">
                                    {levels.map((_, lIdx) => (
                                        <div key={lIdx} className="w-64 flex-shrink-0">
                                            <textarea
                                                value={descriptors[`${cIdx}-${lIdx}`] || ''}
                                                onChange={(e) => handleDescriptorChange(cIdx, lIdx, e.target.value)}
                                                placeholder="Describe el desempeño..."
                                                className="w-full h-24 p-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                                            />
                                        </div>
                                    ))}
                                    <div className="w-10 flex-shrink-0" /> {/* Spacer for 'Add Column' button alignment */}
                                </div>
                            </div>
                        ))}

                        <button
                            onClick={addCriterion}
                            className="flex items-center text-sm font-medium text-gray-500 hover:text-blue-600 px-2 py-2 mt-2 transition-colors"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Agregar Criterio (Fila)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
