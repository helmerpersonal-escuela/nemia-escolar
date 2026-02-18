
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Plus, Trash2, Save, AlertCircle, PieChart, Copy, Sparkles } from 'lucide-react'
import { useTenant } from '../../../hooks/useTenant'

interface Criteria {
    id: string
    name: string
    percentage: number
    description?: string
}

interface CriteriaManagerProps {
    periodId: string
    groupId?: string // Optional: if provided, fixes the component to this group
}

export const CriteriaManager = ({ periodId, groupId }: CriteriaManagerProps) => {
    const { data: tenant } = useTenant()
    const [loading, setLoading] = useState(false)
    const [groups, setGroups] = useState<any[]>([])
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
    const [criteriaList, setCriteriaList] = useState<Criteria[]>([])
    const [allPeriods, setAllPeriods] = useState<any[]>([])
    const [showCopyMenu, setShowCopyMenu] = useState(false)
    const [catalog, setCatalog] = useState<any[]>([])
    const [showCatalog, setShowCatalog] = useState(false)

    // Load Groups on Mount
    useEffect(() => {
        const loadGroups = async () => {
            if (!tenant?.id) return
            const { data } = await supabase
                .from('groups')
                .select('id, grade, section')
                .eq('tenant_id', tenant.id)
                .order('grade')

            setGroups(data || [])
            if (groupId) {
                setSelectedGroupId(groupId)
            } else if (data && data.length > 0 && !selectedGroupId) {
                setSelectedGroupId(data[0].id)
            }
        }
        loadGroups()

        // Also load periods for cloning
        const loadPeriods = async () => {
            if (!tenant?.id) return
            const { data } = await supabase
                .from('evaluation_periods')
                .select('*')
                .eq('tenant_id', tenant.id)
                .order('start_date')
            setAllPeriods(data || [])
        }
        loadPeriods()

        // Load Catalog
        const loadCatalog = async () => {
            const { data } = await supabase
                .from('evaluation_criteria_catalog')
                .select('*')
                .or(`tenant_id.eq.${tenant?.id},is_default.eq.true`)
                .order('name')

            if (data) {
                // Deduplicate by name, prioritizing institutional items
                const unique = data.reduce((acc: any[], current) => {
                    const existing = acc.find(item => item.name === current.name)
                    if (!existing) {
                        acc.push(current)
                    } else if (current.tenant_id && !existing.tenant_id) {
                        // Replace default with institutional version
                        const index = acc.indexOf(existing)
                        acc[index] = current
                    }
                    return acc
                }, [])
                setCatalog(unique)
            } else {
                setCatalog([])
            }
        }
        loadCatalog()
    }, [tenant])

    // Load Criteria when Period or Group changes
    useEffect(() => {
        const loadCriteria = async () => {
            if (!selectedGroupId || !periodId) return
            setLoading(true)

            // NOTE: Ideally we would have a 'subject_id' too, but for MVP we configure by Group.
            // This means "In 1A, evaluating criteria apply to the MAIN subject".
            const { data } = await supabase
                .from('evaluation_criteria')
                .select('*')
                .eq('group_id', selectedGroupId)
                .eq('period_id', periodId)

            if (data && data.length > 0) {
                setCriteriaList(data)
            } else {
                // Initialize empty so the teacher builds from scratch or catalog
                setCriteriaList([])
            }
            setLoading(false)
        }
        loadCriteria()
    }, [selectedGroupId, periodId])

    const totalPercentage = criteriaList.reduce((sum, item) => sum + item.percentage, 0)
    const isValid = totalPercentage === 100

    const updatePercentage = (id: string, newPercentage: number) => {
        setCriteriaList(prev => {
            const otherTotal = prev.reduce((sum, item) => item.id === id ? sum : sum + item.percentage, 0)
            const maxAllowed = 100 - otherTotal
            const clamped = Math.min(newPercentage, maxAllowed)
            return prev.map(c => c.id === id ? { ...c, percentage: clamped } : c)
        })
    }

    const updateDescription = (id: string, newDesc: string) => {
        setCriteriaList(prev => prev.map(c => c.id === id ? { ...c, description: newDesc } : c))
    }

    const updateName = (id: string, newName: string) => {
        setCriteriaList(prev => prev.map(c => c.id === id ? { ...c, name: newName } : c))
    }

    const addCriteria = () => {
        const remaining = Math.max(0, 100 - totalPercentage)
        setCriteriaList([...criteriaList, { id: `temp-${Date.now()}`, name: 'Nuevo Criterio', percentage: remaining }])
    }

    const removeCriteria = (id: string) => {
        setCriteriaList(prev => prev.filter(c => c.id !== id))
    }

    const handleCopyToOtherPeriods = async (targetPeriodId: string) => {
        if (!tenant?.id || !selectedGroupId || !criteriaList.length) return
        if (!confirm('¿Copiar estos criterios al periodo seleccionado? Se sobrescribirán los criterios existentes en ese periodo para este grupo.')) return

        setLoading(true)
        try {
            // 1. Delete existing for target scope
            await supabase
                .from('evaluation_criteria')
                .delete()
                .eq('group_id', selectedGroupId)
                .eq('period_id', targetPeriodId)

            // 2. Insert new
            const toInsert = criteriaList.map(c => ({
                tenant_id: tenant.id,
                group_id: selectedGroupId,
                period_id: targetPeriodId,
                name: c.name,
                percentage: c.percentage,
                description: c.description
            }))

            const { error } = await supabase.from('evaluation_criteria').insert(toInsert)
            if (error) throw error

            alert('Criterios copiados correctamente')
            setShowCopyMenu(false)
        } catch (err: any) {
            alert('Error al copiar: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        if (!tenant?.id || !selectedGroupId) return

        setLoading(true)
        try {
            // 1. Delete existing for this scope
            await supabase
                .from('evaluation_criteria')
                .delete()
                .eq('group_id', selectedGroupId)
                .eq('period_id', periodId)

            // 2. Insert new
            const toInsert = criteriaList.map(c => ({
                tenant_id: tenant.id,
                group_id: selectedGroupId,
                period_id: periodId,
                name: c.name,
                percentage: c.percentage,
                description: c.description
            }))

            const { error } = await supabase.from('evaluation_criteria').insert(toInsert)
            if (error) throw error

            alert('Criterios guardados correctamente')
        } catch (err: any) {
            alert('Error al guardar: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="squishy-card h-full flex flex-col">
            {/* Toolbar */}
            <div className="p-4 border-b border-indigo-50 flex justify-between items-center bg-indigo-50/30 rounded-t-[2rem]">
                {!groupId && (
                    <div className="flex items-center space-x-4">
                        <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Grupo:</span>
                        <select
                            value={selectedGroupId || ''}
                            onChange={e => setSelectedGroupId(e.target.value)}
                            className="bg-white border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 font-bold"
                        >
                            {groups.map(g => (
                                <option key={g.id} value={g.id}>{g.grade}° {g.section}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div className={`flex items-center px-3 py-1 rounded-full text-xs font-bold ${isValid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                    <PieChart className="w-3 h-3 mr-2" />
                    Total: {totalPercentage}%
                </div>

                {/* Copy Menu */}
                <div className="relative">
                    <button
                        onClick={() => setShowCopyMenu(!showCopyMenu)}
                        className="flex items-center text-xs bg-white border border-gray-200 px-3 py-1.5 rounded-lg font-bold text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-all"
                    >
                        <Copy className="w-3 h-3 mr-2" />
                        Copiar a...
                    </button>

                    {showCopyMenu && (
                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 z-20 py-2 animate-in fade-in zoom-in-95 duration-100">
                            <div className="px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 mb-1">
                                Seleccionar Trimestre:
                            </div>
                            {allPeriods.filter(p => p.id !== periodId).map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => handleCopyToOtherPeriods(p.id)}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 font-medium transition-colors"
                                >
                                    {p.name}
                                </button>
                            ))}
                            {allPeriods.filter(p => p.id !== periodId).length === 0 && (
                                <div className="px-4 py-2 text-xs text-gray-400 italic">No hay otros periodos</div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center space-x-2 border-l border-gray-200 pl-4">
                    <button
                        onClick={addCriteria}
                        className="flex items-center text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100 transition-all border border-indigo-100"
                    >
                        <Plus className="w-3 h-3 mr-2" />
                        Agregar Criterio
                    </button>
                </div>
            </div>

            {/* Catalog Modal Overlay */}
            {showCatalog && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Catálogo de Criterios</h3>
                                <p className="text-xs text-gray-500">Selecciona los aspectos que deseas evaluar en este periodo.</p>
                            </div>
                            <button
                                onClick={() => setShowCatalog(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-all"
                            >
                                <AlertCircle className="w-5 h-5 rotate-45" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {catalog.map(item => {
                                const isAdded = criteriaList.some(c => c.name === item.name);
                                return (
                                    <button
                                        key={item.id}
                                        disabled={isAdded}
                                        onClick={() => {
                                            const remaining = Math.max(0, 100 - totalPercentage);
                                            setCriteriaList([...criteriaList, {
                                                id: `cat-${Date.now()}`,
                                                name: item.name,
                                                percentage: Math.min(10, remaining),
                                                description: item.description
                                            }]);
                                            setShowCatalog(false);
                                        }}
                                        className={`w-full text-left p-4 rounded-xl border transition-all flex justify-between items-start group ${isAdded
                                            ? 'bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed'
                                            : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-md'
                                            }`}
                                    >
                                        <div className="flex-1 mr-4">
                                            <div className="font-bold text-gray-800 mb-0.5">{item.name}</div>
                                            <div className="text-xs text-gray-500">{item.description}</div>
                                        </div>
                                        {isAdded ? (
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-100 px-2 py-1 rounded">Ya añadido</span>
                                        ) : (
                                            <Plus className="w-4 h-4 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Criteria List */}
            <div className="p-4 flex-1 overflow-y-auto space-y-4">
                {criteriaList.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center py-12 px-4 text-center bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-100">
                        <div className="bg-white p-4 rounded-2xl shadow-sm mb-4">
                            <PieChart className="w-10 h-10 text-gray-300" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-700 uppercase tracking-tight mb-2">Sin Criterios Definidos</h3>
                        <p className="text-sm text-gray-500 max-w-xs mb-6 font-medium">
                            Es necesario definir cómo evaluarás este trimestre (ej. Examen 50%, Tareas 50%).
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={() => setShowCatalog(true)}
                                className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                            >
                                <Sparkles className="w-5 h-5 mr-2 text-white" />
                                Usar Catálogo
                            </button>
                            <button
                                onClick={addCriteria}
                                className="flex items-center px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                            >
                                <Plus className="w-5 h-5 mr-2 text-indigo-500" />
                                Crear Manualmente
                            </button>
                        </div>
                    </div>
                ) : (
                    criteriaList.map((criteria) => (
                        <div key={criteria.id} className="squishy-card p-3 hover:scale-[1.01] transition-transform relative group">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex-1 mr-4">
                                    <input
                                        type="text"
                                        value={criteria.name}
                                        onChange={e => updateName(criteria.id, e.target.value.toUpperCase())}
                                        className="font-bold text-gray-800 border-none focus:ring-0 p-0 text-lg w-full bg-transparent placeholder-gray-300 uppercase mb-1"
                                        placeholder="NOMBRE (EJ. EXAMEN)"
                                    />
                                    <textarea
                                        value={criteria.description || ''}
                                        onChange={e => updateDescription(criteria.id, e.target.value)}
                                        placeholder="Añade una descripción o método de cálculo..."
                                        className="w-full text-xs text-gray-500 border-none focus:ring-0 p-0 bg-transparent resize-none overflow-hidden h-8"
                                        onInput={(e) => {
                                            const target = e.target as HTMLTextAreaElement;
                                            target.style.height = 'auto';
                                            target.style.height = `${target.scrollHeight}px`;
                                        }}
                                    />
                                </div>
                                <button
                                    onClick={() => removeCriteria(criteria.id)}
                                    className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity self-start mt-1"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="flex items-center space-x-4">
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="5"
                                    value={criteria.percentage}
                                    onChange={e => updatePercentage(criteria.id, parseInt(e.target.value))}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                                <div className="flex flex-col items-center min-w-[3rem]">
                                    <span className="text-2xl font-black text-blue-600">{criteria.percentage}%</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}

                {criteriaList.length > 0 && (
                    <button
                        onClick={() => setShowCatalog(true)}
                        className="w-full py-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 font-bold hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center"
                    >
                        <Sparkles className="w-5 h-5 mr-2" />
                        Catálogo de Criterios
                    </button>
                )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-between items-center">
                {!isValid ? (
                    <div className="flex items-center text-amber-600 text-sm">
                        <AlertCircle className="w-4 h-4 mr-2" />
                        La suma debe ser exactamente 100%
                    </div>
                ) : (
                    <div className="text-xs text-gray-400">
                        Listo para guardar
                    </div>
                )}

                <button
                    disabled={!isValid || loading}
                    onClick={handleSave}
                    className={`
                        flex items-center px-6 py-2 rounded-xl font-black shadow-lg shadow-indigo-100 transition-all btn-tactile
                        ${isValid
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'}
                    `}
                >
                    {loading ? 'Guardando...' : (
                        <>
                            <Save className="w-4 h-4 mr-2" />
                            Guardar Configuración
                        </>
                    )}
                </button>
            </div>
        </div>
    )
}
