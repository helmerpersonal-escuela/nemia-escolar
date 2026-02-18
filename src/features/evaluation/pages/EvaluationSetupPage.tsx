import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { CriteriaManager } from '../components/CriteriaManager'
import { Settings, Info, ArrowLeft, Calendar } from 'lucide-react'
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
            return data
        }
    })

    // Handle auto-selection in useEffect to ensure it works with cache
    useEffect(() => {
        if (periods && periods.length > 0 && !selectedPeriod) {
            const preselected = urlPeriodId ? periods.find(p => p.id === urlPeriodId) : periods[0]
            const finalToSelect = preselected || periods[0]
            setSelectedPeriod({ id: finalToSelect.id, name: finalToSelect.name })
        }
    }, [periods, selectedPeriod, urlPeriodId])

    return (
        <div className="space-y-6 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
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
            <header className="mb-8 text-center text-gray-900">
                <div className="inline-flex p-3 bg-indigo-100 rounded-2xl mb-4 shadow-sm shadow-indigo-50">
                    <Settings className="h-10 w-10 text-indigo-600" />
                </div>
                <h1 className="text-4xl font-black text-gray-900 tracking-tight">
                    Arquitectura de Evaluación <span className="text-indigo-600">Vunlek</span>
                </h1>
                <p className="mt-3 text-gray-500 text-lg max-w-2xl mx-auto font-medium">
                    Diseña tus criterios de calificación con la flexibilidad que tu práctica docente requiere.
                </p>
            </header>

            <div className="bg-gradient-to-r from-slate-900 to-indigo-900 rounded-[2rem] p-8 mb-8 text-white shadow-2xl shadow-indigo-100 flex items-center justify-between overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <div className="flex items-start gap-6 relative z-10">
                    <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-xl border border-white/20">
                        <Info className="w-6 h-6 text-indigo-200" />
                    </div>
                    <div>
                        <p className="font-black text-2xl mb-1 tracking-tight">Criterios e Indicadores</p>
                        <p className="text-indigo-100 text-sm font-medium opacity-80 max-w-lg leading-relaxed">
                            Define el peso de tus actividades (Exámenes, Proyectos, Tareas) para cada periodo. Vunlek calculará automáticamente los progresos.
                        </p>
                    </div>
                </div>
                <div className="hidden lg:block relative z-10">
                    <span className="bg-indigo-500/30 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] backdrop-blur-md border border-white/10 text-indigo-100">
                        Vunlek Intelligent Eval
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
                        <div className="h-full min-h-[400px] bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                            <div className="bg-white p-6 rounded-full shadow-lg shadow-gray-200/50 mb-6 group-hover:scale-110 transition-transform duration-500">
                                <Calendar className="w-12 h-12 text-amber-500" />
                            </div>
                            <h3 className="text-2xl font-black text-gray-800 mb-3 uppercase tracking-tight">
                                {periods === undefined ? 'Cargando periodos...' : periods?.length === 0 ? 'No hay periodos escolares definidos' : 'Selecciona un periodo'}
                            </h3>
                            <p className="max-w-md font-medium text-gray-500 mb-8 leading-relaxed">
                                {periods?.length === 0
                                    ? 'Debes configurar los periodos escolares (ej. Trimestre 1, 2) en los Ajustes Generales de tu institución para poder definir criterios de evaluación.'
                                    : 'Espera un momento mientras cargamos la información de tus periodos.'}
                            </p>
                            {periods?.length === 0 && (
                                <Link
                                    to="/settings?tab=periods"
                                    className="inline-flex items-center px-8 py-4 bg-amber-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-amber-600 transition-all shadow-xl shadow-amber-100 hover:scale-105 active:scale-95 group"
                                >
                                    <Calendar className="w-4 h-4 mr-2 group-hover:rotate-12 transition-transform" />
                                    Configurar Periodos Ahora
                                </Link>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
