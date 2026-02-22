import { useState, useEffect } from 'react'
import { Plus, FileText, Users, ArrowRight, Sparkles, LayoutGrid, Clock, ChevronRight, Trash2, Eye } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'

interface Plan {
    id: string
    title: string
    temporality: string
    start_date: string
    campo_formativo: string
    metodologia: string
    groups: { grade: string, section: string }
}

export const PlanningListPage = () => {
    const { data: tenant, isLoading: isTenantLoading, isError: isTenantError } = useTenant()
    const [plans, setPlans] = useState<Plan[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (isTenantLoading) return

        if (isTenantError || !tenant) {
            setLoading(false)
            return
        }

        const fetchPlans = async () => {
            try {
                const { data, error } = await supabase
                    .from('lesson_plans')
                    .select(`
                        id, title, temporality, start_date, campo_formativo, metodologia,
                        groups ( grade, section )
                    `)
                    .eq('tenant_id', tenant.id)
                    .order('created_at', { ascending: false })

                if (error) throw error
                if (data) setPlans(data as any)
            } catch (err: any) {
                console.error('Error fetching plans:', err)
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }
        fetchPlans()
    }, [tenant, isTenantLoading, isTenantError])

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.preventDefault() // Evitar navegación del Link
        e.stopPropagation()

        if (!window.confirm('¿Estás seguro de que deseas eliminar esta planeación? Esta acción no se puede deshacer.')) {
            return
        }

        try {
            const { error } = await supabase
                .from('lesson_plans')
                .delete()
                .eq('id', id)

            if (error) throw error

            setPlans(prev => prev.filter(p => p.id !== id))
        } catch (err: any) {
            console.error('Error deleting plan:', err)
            alert('Error al eliminar la planeación')
        }
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] pb-20">
            {/* Header Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-12">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 md:gap-8 mb-8 md:mb-16">
                    <div>
                        <div className="flex items-center space-x-2 text-indigo-600 font-black uppercase text-[10px] tracking-[0.3em] mb-2 md:mb-4">
                            <Sparkles className="w-4 h-4" />
                            <span>Gobernanza Pedagógica</span>
                        </div>
                        <h1 className="text-3xl sm:text-6xl font-black text-gray-900 tracking-tight leading-none">
                            Planeación <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Didáctica</span>
                        </h1>
                        <p className="mt-2 md:mt-4 text-gray-400 font-medium max-w-xl text-sm md:text-lg">
                            Diseña proyectos y secuencias alineadas a la NEM con asistencia inteligente.
                        </p>
                    </div>
                    <Link
                        to="/planning/new"
                        className="bg-indigo-600 text-white px-6 py-4 md:px-10 md:py-5 rounded-[1.5rem] md:rounded-[2rem] hover:bg-indigo-700 transition-all font-black text-[10px] md:text-xs uppercase tracking-[0.2em] shadow-2xl shadow-indigo-100 flex items-center justify-center group btn-tactile w-full md:w-auto"
                    >
                        <Plus className="w-5 h-5 mr-3 group-hover:rotate-90 transition-transform duration-500" />
                        Nueva Planeación
                    </Link>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 animate-pulse">
                        <div className="w-16 h-16 bg-indigo-50 rounded-3xl mb-6"></div>
                        <span className="text-xs font-black text-indigo-400 uppercase tracking-widest tracking-[0.3em]">Sincronizando Archivos...</span>
                    </div>
                ) : error ? (
                    <div className="bg-red-50 rounded-[2rem] p-12 text-center max-w-2xl mx-auto">
                        <h3 className="text-xl font-black text-red-900 mb-2">Error de Sincronización</h3>
                        <p className="text-red-600 mb-6">{error}</p>
                        <button onClick={() => window.location.reload()} className="px-6 py-2 bg-red-100 text-red-700 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-red-200 btn-tactile">
                            Reintentar Conexión
                        </button>
                    </div>
                ) : plans.length === 0 ? (
                    <div className="squishy-card border-2 border-dashed border-gray-100 p-8 md:p-24 text-center shadow-sm max-w-4xl mx-auto animate-in fade-in duration-700">
                        <div className="w-16 h-16 md:w-24 md:h-24 bg-gray-50 rounded-[1.5rem] md:rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 md:mb-8">
                            <FileText className="w-8 h-8 md:w-12 md:h-12 text-gray-200" />
                        </div>
                        <h3 className="text-xl md:text-2xl font-black text-gray-900 uppercase tracking-tighter">No hay documentos aún</h3>
                        <p className="text-gray-400 max-w-sm mx-auto mt-2 font-medium text-sm md:text-base">
                            Toda gran enseñanza comienza con un plan. Crea hoy tu primer proyecto o secuencia didáctica.
                        </p>
                        <Link
                            to="/planning/new"
                            className="mt-6 md:mt-10 inline-flex items-center bg-indigo-50 text-indigo-600 px-6 py-3 md:px-8 md:py-4 rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all btn-tactile"
                        >
                            Comenzar ahora <ArrowRight className="w-4 h-4 ml-2" />
                        </Link>
                    </div>
                ) : (
                    <div className="columns-1 md:columns-2 lg:columns-3 gap-8 space-y-8 animate-in slide-in-from-bottom-12 duration-700">
                        {plans.map(plan => (
                            <Link
                                key={plan.id}
                                to={`/planning/${plan.id}`}
                                className="group block squishy-card p-6 md:p-10 hover:border-indigo-200 shadow-xl shadow-indigo-50/30 hover:shadow-2xl hover:shadow-indigo-100 relative overflow-hidden break-inside-avoid"
                            >
                                <div className="absolute top-0 right-0 p-8 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity flex items-center space-x-2 z-10">
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            // Usar window.open para abrir en nueva pestaña o navigate para la misma
                                            // navigate(`/planning/${plan.id}?mode=preview`) but keeps context
                                            window.location.href = `/planning/${plan.id}?mode=preview`
                                        }}
                                        className="p-2 bg-indigo-50 text-indigo-500 rounded-xl hover:bg-indigo-100 hover:text-indigo-600 transition-colors"
                                        title="Vista Previa / Imprimir"
                                    >
                                        <Eye className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={(e) => handleDelete(e, plan.id)}
                                        className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 hover:text-red-600 transition-colors"
                                        title="Eliminar Planeación"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                    <ChevronRight className="w-6 h-6 text-indigo-600" />
                                </div>

                                <div className="mb-8 flex items-center justify-between w-full">
                                    <div className="p-4 bg-indigo-50 rounded-2xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 transform group-hover:rotate-6">
                                        <FileText className="w-6 h-6" />
                                    </div>
                                    <span className="text-[9px] font-black uppercase bg-gray-50 text-gray-400 px-4 py-1.5 rounded-full tracking-widest">
                                        {plan.temporality === 'WEEKLY' ? 'Semanal' : plan.temporality === 'MONTHLY' ? 'Mensual' : 'Proyecto'}
                                    </span>
                                </div>

                                <h3 className="font-black text-gray-900 text-xl leading-tight mb-4 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">
                                    {plan.title || 'Proyecto sin Título'}
                                </h3>

                                <div className="space-y-4 w-full pt-6 border-t border-gray-50">
                                    <div className="flex items-center text-gray-500">
                                        <Users className="w-4 h-4 mr-3 text-indigo-300" />
                                        <span className="text-xs font-bold uppercase tracking-wider">
                                            {plan.groups ? `${plan.groups.grade}° "${plan.groups.section}"` : 'Sin Grupo'}
                                        </span>
                                    </div>
                                    <div className="flex items-center text-gray-500">
                                        <LayoutGrid className="w-4 h-4 mr-3 text-purple-300" />
                                        <span className="text-xs font-bold uppercase tracking-wider line-clamp-1">
                                            {plan.campo_formativo || 'Campo no definido'}
                                        </span>
                                    </div>
                                    <div className="flex items-center text-gray-500">
                                        <Clock className="w-4 h-4 mr-3 text-rose-300" />
                                        <span className="text-xs font-bold uppercase tracking-wider">
                                            {plan.start_date ? new Date(plan.start_date).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }) : 'Pendiente'}
                                        </span>
                                    </div>
                                </div>

                                {plan.metodologia && (
                                    <div className="mt-8 pt-6 border-t border-gray-50">
                                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-2 text-right">Metodología</p>
                                        <p className="text-[11px] font-bold text-gray-400 text-right leading-relaxed italic line-clamp-2">
                                            {plan.metodologia}
                                        </p>
                                    </div>
                                )}
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
