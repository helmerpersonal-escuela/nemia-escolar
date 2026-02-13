import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CriteriaManager } from '../components/CriteriaManager'
import { Settings, Info, ArrowLeft } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'

export const EvaluationSetupPage = () => {
    const { data: tenant } = useTenant()
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const [selectedPeriod, setSelectedPeriod] = useState<{ id: string, name: string } | null>(null)

    const urlGroupId = searchParams.get('groupId')
    const urlSubjectId = searchParams.get('subjectId')
    const urlPeriodId = searchParams.get('periodId')

    // Fetch periods to auto-select the first one or the one from URL
    const { data: periods } = useQuery({
        queryKey: ['periods', tenant?.id],
        enabled: !!tenant?.id,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('evaluation_periods')
                .select('*')
                .eq('tenant_id', tenant?.id)
                .order('start_date', { ascending: true })
            if (error) throw error

            if (data && data.length > 0 && !selectedPeriod) {
                const preselected = urlPeriodId ? data.find(p => p.id === urlPeriodId) : data[0]
                const finalToSelect = preselected || data[0]
                setSelectedPeriod({ id: finalToSelect.id, name: finalToSelect.name })
            }
            return data
        }
    })

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
            {urlGroupId && (
                <div className="mb-6">
                    <button
                        onClick={() => navigate(`/gradebook?groupId=${urlGroupId}${urlSubjectId ? `&subjectId=${urlSubjectId}` : ''}${selectedPeriod?.id ? `&periodId=${selectedPeriod.id}` : ''}`)}
                        className="text-gray-500 hover:text-gray-700 flex items-center font-medium transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Volver a la Libreta
                    </button>
                </div>
            )}
            <header className="mb-12 text-center text-gray-900">
                <div className="inline-flex p-3 bg-blue-100 rounded-2xl mb-4 shadow-sm shadow-blue-50">
                    <Settings className="h-10 w-10 text-blue-600" />
                </div>
                <h1 className="text-4xl font-black text-gray-900 tracking-tight">
                    Configuración de Evaluaciones
                </h1>
                <p className="mt-3 text-gray-500 text-lg max-w-2xl mx-auto font-medium">
                    Personaliza tus periodos académicos y define los criterios de calificación con total libertad.
                </p>
            </header>

            <div className="bg-gradient-to-r from-indigo-600 to-blue-700 rounded-3xl p-6 mb-12 text-white shadow-xl shadow-blue-100 flex items-center justify-between">
                <div className="flex items-start gap-5">
                    <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                        <Info className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <p className="font-black text-xl mb-1">Criterios de Evaluación</p>
                        <p className="text-blue-50 text-sm font-medium italic opacity-90">
                            Define el peso de tus actividades (Examen, Tareas, etc.) para cada periodo escolar.
                        </p>
                    </div>
                </div>
                <div className="hidden md:block">
                    <span className="bg-white/10 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest backdrop-blur-md border border-white/20">
                        Configuración Contextual
                    </span>
                </div>
            </div>

            <div className="space-y-8">
                {/* Right Column: Criteria - Now Full Width */}
                <div className="w-full">
                    {selectedPeriod ? (
                        <div className="h-full">
                            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <h2 className="text-2xl font-black text-gray-800 tracking-tight">
                                    Configurando Criterios: <span className="text-indigo-600 uppercase">{selectedPeriod.name}</span>
                                </h2>

                                {periods && periods.length > 1 && (
                                    <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
                                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest ml-2">Cambiar Periodo:</span>
                                        <select
                                            value={selectedPeriod.id}
                                            onChange={(e) => {
                                                const p = periods.find(p => p.id === e.target.value)
                                                if (p) setSelectedPeriod({ id: p.id, name: p.name })
                                            }}
                                            className="bg-gray-50 border-none text-indigo-600 text-sm font-bold rounded-xl focus:ring-0 p-2"
                                        >
                                            {periods.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                            <CriteriaManager periodId={selectedPeriod.id} groupId={urlGroupId || undefined} />
                        </div>
                    ) : (
                        <div className="h-full min-h-[400px] bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 p-8 text-center animate-pulse">
                            <Settings className="w-16 h-16 mb-4 opacity-20" />
                            <h3 className="text-lg font-bold text-gray-500 mb-2 uppercase tracking-tight">
                                {periods === undefined ? 'Cargando periodos...' : periods?.length === 0 ? 'No hay periodos escolares definidos' : 'Selecciona un periodo'}
                            </h3>
                            <p className="max-w-md font-medium">
                                {periods?.length === 0
                                    ? 'Debes configurar los periodos escolares en Ajustes Generales para poder definir criterios de evaluación.'
                                    : 'Espera un momento mientras cargamos la información de tus periodos.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
