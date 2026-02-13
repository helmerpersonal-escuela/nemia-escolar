import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import {
    FileText,
    Plus,
    CheckCircle2,
    Clock,
    Upload,
    ChevronRight,
    Target,
    Users,
    AlertCircle,
    Save,
    Trash2,
    Search
} from 'lucide-react'

const NEM_FIELDS = [
    "Aprovechamiento académico y asistencia de los alumnos",
    "Prácticas docentes y formación continua",
    "Infraestructura y equipamiento",
    "Carga administrativa",
    "Participación de la comunidad y padres de familia",
    "Contexto socioeducativo (Lectura de la Realidad)"
]

export const PEMCPage = () => {
    const [loading, setLoading] = useState(true)
    const [cycle, setCycle] = useState<any>(null)
    const [diagnosis, setDiagnosis] = useState<any[]>([])
    const [objectives, setObjectives] = useState<any[]>([])
    const [activeTab, setActiveTab] = useState<'diagnosis' | 'objectives' | 'monitoring'>('diagnosis')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        loadPEMCData()
    }, [])

    const loadPEMCData = async () => {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
            if (!profile) return

            // Load active cycle
            const { data: cycleData } = await supabase
                .from('pemc_cycles')
                .select('*')
                .eq('tenant_id', profile.tenant_id)
                .eq('is_active', true)
                .single()

            if (cycleData) {
                setCycle(cycleData)
                // Load diagnosis
                const { data: diagData } = await supabase
                    .from('pemc_diagnosis')
                    .select('*')
                    .eq('cycle_id', cycleData.id)
                setDiagnosis(diagData || [])

                // Load objectives with actions
                const { data: objData } = await supabase
                    .from('pemc_objectives')
                    .select('*, pemc_actions(*)')
                    .eq('cycle_id', cycleData.id)
                setObjectives(objData || [])
            }
        } catch (error) {
            console.error('Error loading PEMC:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSaveDiagnosis = async (fieldName: string, content: string, fileUrls: string[] = []) => {
        if (!cycle) return
        setSaving(true)
        try {
            const existing = diagnosis.find(d => d.field_name === fieldName)
            if (existing) {
                await supabase.from('pemc_diagnosis').update({
                    content,
                    file_urls: fileUrls.length > 0 ? fileUrls : existing.file_urls
                }).eq('id', existing.id)
            } else {
                await supabase.from('pemc_diagnosis').insert({
                    cycle_id: cycle.id,
                    field_name: fieldName,
                    content,
                    file_urls: fileUrls
                })
            }
            loadPEMCData()
        } catch (error) {
            console.error('Error saving diagnosis:', error)
        } finally {
            setSaving(false)
        }
    }

    const handleFileUpload = async (fieldName: string, file: File) => {
        if (!cycle) return
        setSaving(true)
        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `${cycle.tenant_id}/${cycle.id}/${fieldName}/${Math.random()}.${fileExt}`
            const { error: uploadError } = await supabase.storage
                .from('pemc_evidence')
                .upload(fileName, file)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage.from('pemc_evidence').getPublicUrl(fileName)

            const existing = diagnosis.find(d => d.field_name === fieldName)
            const currentUrls = existing?.file_urls || []
            await handleSaveDiagnosis(fieldName, existing?.content || '', [...currentUrls, publicUrl])

        } catch (error) {
            console.error('Error uploading file:', error)
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="p-8 animate-pulse space-y-4">
        <div className="h-20 bg-gray-100 rounded-3xl w-1/3" />
        <div className="h-64 bg-gray-100 rounded-[2.5rem]" />
    </div>

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight">Programa de Mejora Continua</h1>
                    <p className="text-gray-500 font-medium">Instrumento de planeación estratégica y participativa (PEMC).</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-black uppercase tracking-widest border border-blue-100">
                        {cycle?.name || 'Nuevo Ciclo Plurianual'}
                    </span>
                    <button className="p-3 bg-gray-900 text-white rounded-xl hover:bg-black transition-all shadow-xl shadow-gray-200">
                        <Plus className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center space-x-1 bg-gray-100 p-1.5 rounded-2xl w-fit">
                {[
                    { id: 'diagnosis', label: 'Diagnóstico', icon: Search },
                    { id: 'objectives', label: 'Objetivos y Metas', icon: Target },
                    { id: 'monitoring', label: 'Seguimiento', icon: ClipboardCheck }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <tab.icon className="w-4 h-4 mr-2" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm min-h-[600px] p-10">
                {activeTab === 'diagnosis' && (
                    <div className="space-y-10">
                        <div className="max-w-2xl">
                            <h2 className="text-2xl font-black text-gray-900 mb-2">Lectura de la Realidad</h2>
                            <p className="text-sm text-gray-500 leading-relaxed font-medium">
                                Analiza el contexto socioeducativo de la escuela para identificar problemáticas y áreas de oportunidad.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                            {NEM_FIELDS.map(field => {
                                const data = diagnosis.find(d => d.field_name === field)
                                return (
                                    <div key={field} className="group bg-gray-50 rounded-[2rem] p-8 hover:bg-white hover:shadow-xl hover:shadow-gray-100 border border-transparent hover:border-gray-100 transition-all">
                                        <div className="flex items-start justify-between mb-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                                    <FileText className="w-5 h-5" />
                                                </div>
                                                <h3 className="text-lg font-black text-gray-900 tracking-tight">{field}</h3>
                                            </div>
                                            <button
                                                onClick={() => handleSaveDiagnosis(field, data?.content || '')}
                                                className="p-3 text-gray-300 hover:text-blue-600 transition-colors"
                                            >
                                                <Save className="w-5 h-5" />
                                            </button>
                                        </div>
                                        <textarea
                                            placeholder="Describe la situación actual en este ámbito..."
                                            className="w-full bg-white/50 border-none rounded-2xl p-6 text-sm font-medium text-gray-700 min-h-[120px] focus:ring-4 focus:ring-blue-100 focus:bg-white transition-all resize-none shadow-inner"
                                            defaultValue={data?.content || ''}
                                            onBlur={(e) => handleSaveDiagnosis(field, e.target.value)}
                                        />
                                        <div className="mt-6 flex items-center justify-between">
                                            <div className="flex -space-x-2">
                                                {data?.file_urls?.map((url: string, i: number) => (
                                                    <a key={i} href={url} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center text-[8px] font-black text-white hover:z-10 transition-transform hover:scale-110">
                                                        DOC
                                                    </a>
                                                ))}
                                                {(!data?.file_urls || data.file_urls.length === 0) && (
                                                    <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center text-[8px] font-black text-gray-400">0</div>
                                                )}
                                            </div>
                                            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 px-4 py-2 rounded-xl cursor-pointer">
                                                <Upload className="w-3 h-3" />
                                                Subir Evidencia
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0]
                                                        if (file) handleFileUpload(field, file)
                                                    }}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {activeTab === 'objectives' && (
                    <div className="space-y-10 animate-in slide-in-from-bottom-4">
                        <div className="flex items-center justify-between">
                            <div className="max-w-2xl">
                                <h2 className="text-2xl font-black text-gray-900 mb-2">Objetivos y Metas</h2>
                                <p className="text-sm text-gray-500 leading-relaxed font-medium">
                                    Define qué quieres lograr y cómo medirás el éxito en el ciclo plurianual.
                                </p>
                            </div>
                            <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-100">
                                <Plus className="w-4 h-4" />
                                Nuevo Objetivo
                            </button>
                        </div>

                        {objectives.length === 0 ? (
                            <div className="p-20 border-4 border-dashed border-gray-50 rounded-[3rem] flex flex-col items-center text-center">
                                <Target className="w-16 h-16 text-gray-200 mb-6" />
                                <h3 className="text-xl font-bold text-gray-400 uppercase tracking-widest">No hay objetivos definidos</h3>
                                <p className="text-sm text-gray-300 mt-2 max-w-xs font-medium">Comienza por definir los desafíos principales de la lectura de la realidad.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {objectives.map(obj => (
                                    <div key={obj.id} className="bg-white border-2 border-gray-50 rounded-[2.5rem] overflow-hidden group hover:border-blue-100 hover:shadow-2xl hover:shadow-gray-100 transition-all">
                                        <div className="p-8 border-b border-gray-50 flex items-start gap-6">
                                            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-[1.25rem] flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                                <Target className="w-6 h-6" />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-xl font-black text-gray-900 mb-2">{obj.description}</h3>
                                                <div className="inline-flex items-center px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                                                    Meta: {obj.goal}
                                                </div>
                                            </div>
                                            <button className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 className="w-5 h-5" /></button>
                                        </div>
                                        <div className="bg-gray-50/50 p-8 space-y-4">
                                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Acciones Vinculadas</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {obj.pemc_actions?.map((action: any) => (
                                                    <div key={action.id} className="bg-white p-5 rounded-3xl border border-gray-100 flex items-center justify-between group/action">
                                                        <div className="flex items-center gap-4">
                                                            {action.status === 'COMPLETED' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Clock className="w-5 h-5 text-amber-500" />}
                                                            <div>
                                                                <p className="text-xs font-bold text-gray-900 line-clamp-1">{action.description}</p>
                                                                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tight">Fin: {new Date(action.deadline).toLocaleDateString()}</p>
                                                            </div>
                                                        </div>
                                                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover/action:text-blue-600 group-hover/action:translate-x-1 transition-all" />
                                                    </div>
                                                ))}
                                                <button className="p-5 rounded-3xl border-2 border-dashed border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 transition-all flex items-center justify-center gap-2 text-xs font-bold">
                                                    <Plus className="w-4 h-4" />
                                                    Añadir Acción
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

const ClipboardCheck = ({ className }: { className: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
)
