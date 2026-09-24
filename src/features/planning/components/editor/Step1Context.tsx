import React from 'react'
import {
    BookOpen,
    Target,
    Sparkles,
    Loader2,
    ClipboardCheck
} from 'lucide-react'
import type { LessonPlanFormData } from '../../types/planning.types'

interface Group {
    id: string
    grade: string
    section: string
}

interface Subject {
    id: string
    name: string
}

interface EvaluationPeriod {
    id: string
    name: string
}

interface Step1ContextProps {
    formData: LessonPlanFormData & { period_id: string; project_duration: number; objectives: string[]; evaluation_plan: { instruments: string[] }; source_document_url: string; extracted_text: string }
    setFormData: React.Dispatch<React.SetStateAction<any>>
    groups: Group[]
    subjects: Subject[]
    periods: EvaluationPeriod[]
    CAMPOS: string[]
    isPreviewMode: boolean
    fetchTemplates: () => void
    generateAiSuggestions: () => void
    generating: boolean
    analyticalProgram: any
}

export const Step1Context: React.FC<Step1ContextProps> = ({
    formData,
    setFormData,
    groups,
    subjects,
    periods,
    CAMPOS,
    isPreviewMode,
    fetchTemplates,
    generateAiSuggestions,
    generating,
    analyticalProgram
}) => {
    if (isPreviewMode) {
        return (
            <section className="grid grid-cols-2 gap-8">
                <div className="col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-6 rounded-2xl border border-gray-100">
                    <div>
                        <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-1">Proyecto</p>
                        <p className="font-bold text-gray-900">{formData.title || 'Sin Título'}</p>
                    </div>
                    <div>
                        <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-1">Grupo</p>
                        <p className="font-bold text-gray-900">
                            {groups.find(g => g.id === formData.group_id)?.grade}° "{groups.find(g => g.id === formData.group_id)?.section}"
                        </p>
                    </div>
                    <div>
                        <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-1">Asignatura</p>
                        <p className="font-bold text-gray-900">{subjects.find(s => s.id === formData.subject_id)?.name}</p>
                    </div>
                    <div>
                        <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-1">Temporalidad</p>
                        <p className="font-bold text-indigo-600">
                            {formData.temporality === 'WEEKLY' ? 'Semanal' :
                                formData.temporality === 'MONTHLY' ? 'Mensual' : 'Proyecto'}
                        </p>
                    </div>
                    <div>
                        <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-1">Campo Formativo</p>
                        <p className="font-bold text-gray-900">{formData.campo_formativo || 'No seleccionado'}</p>
                    </div>
                </div>
            </section>
        )
    }

    return (
        <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center space-x-3 mb-8">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                    <Target className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h2 className="text-xl font-black text-gray-900 tracking-tight">Paso 01. Identificación y Formación</h2>
                    <p className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest mt-1">Configura el destino de tu planeación NEM</p>
                </div>
            </div>

            <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border-2 border-slate-50 shadow-sm relative overflow-hidden group">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div className="col-span-1 md:col-span-2 lg:col-span-3">
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Título del Proyecto / Unidad</label>
                        <div className="relative group">
                            <input aria-label="Título del Proyecto / Unidad"
                                type="text"
                                className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-100 rounded-2xl px-6 py-4 text-sm font-bold text-indigo-950 outline-none transition-all placeholder:text-slate-300"
                                placeholder="Ej: Explorando la Biotecnología en mi comunidad..."
                                value={formData.title}
                                onChange={e => setFormData((prev: any) => ({ ...prev, title: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1 ml-1">Campo Formativo</label>
                        <select aria-label="Campo Formativo"
                            className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-100 rounded-2xl px-6 py-4 text-sm font-bold text-indigo-950 outline-none transition-all appearance-none cursor-pointer"
                            value={formData.campo_formativo}
                            onChange={e => setFormData((prev: any) => ({ ...prev, campo_formativo: e.target.value }))}
                        >
                            {CAMPOS.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-3">
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1 ml-1">Grupo Escolar</label>
                        <select aria-label="Grupo Escolar"
                            className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-100 rounded-2xl px-6 py-4 text-sm font-bold text-indigo-950 outline-none transition-all appearance-none cursor-pointer"
                            value={formData.group_id}
                            onChange={e => setFormData((prev: any) => ({ ...prev, group_id: e.target.value, subject_id: '' }))}
                        >
                            <option value="">Seleccionar Grupo</option>
                            {groups.map(g => (
                                <option key={g.id} value={g.id}>{g.grade}° "{g.section}"</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-3">
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1 ml-1">Asignatura / Disciplina</label>
                        <select aria-label="Asignatura / Disciplina"
                            className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-100 rounded-2xl px-6 py-4 text-sm font-bold text-indigo-950 outline-none transition-all appearance-none cursor-pointer disabled:opacity-50"
                            value={formData.subject_id}
                            onChange={e => setFormData((prev: any) => ({ ...prev, subject_id: e.target.value }))}
                            disabled={!formData.group_id}
                        >
                            <option value="">{formData.group_id ? 'Seleccionar Asignatura' : 'Primero elige un grupo'}</option>
                            {subjects.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-3">
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1 ml-1">Periodo de Evaluación</label>
                        <select aria-label="Periodo de Evaluación"
                            className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-100 rounded-2xl px-6 py-4 text-sm font-bold text-indigo-950 outline-none transition-all appearance-none cursor-pointer"
                            value={formData.period_id}
                            onChange={e => setFormData((prev: any) => ({ ...prev, period_id: e.target.value }))}
                        >
                            <option value="">Seleccionar Periodo</option>
                            {periods.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-3">
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1 ml-1">Esquema de Planeación</label>
                        <select aria-label="Esquema de Planeación"
                            className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-100 rounded-2xl px-6 py-4 text-sm font-bold text-indigo-950 outline-none transition-all appearance-none cursor-pointer"
                            value={formData.temporality}
                            onChange={e => setFormData((prev: any) => ({ ...prev, temporality: e.target.value as any }))}
                        >
                            <option value="WEEKLY">Semanal (Normal)</option>
                            <option value="MONTHLY">Mensual (Unidad)</option>
                            <option value="PROJECT">Por Proyecto (NEM)</option>
                            <option value="TRIMESTER">Trimestral (12 semanas)</option>
                        </select>
                    </div>

                    <div className="col-span-1 md:col-span-2 lg:col-span-3 flex flex-wrap gap-4 pt-4 border-t border-slate-50 mt-4">
                        <button
                            onClick={fetchTemplates}
                            className="flex-1 bg-white border-2 border-indigo-600 text-indigo-600 px-6 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-50 transition-all flex items-center justify-center gap-3 shadow-tactile shadow-indigo-100/50"
                        >
                            <BookOpen className="w-5 h-5" />
                            Cargar desde Plantilla NEM
                        </button>
                        <button
                            onClick={generateAiSuggestions}
                            disabled={generating}
                            className="flex-1 bg-gray-950 text-white px-8 py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4 shadow-xl shadow-slate-200 disabled:opacity-50 group"
                        >
                            {generating ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Sparkles className="w-5 h-5 text-yellow-400 group-hover:rotate-12 transition-transform" />
                            )}
                            Generar Sugerencias IA
                        </button>
                    </div>
                </div>

                {analyticalProgram && formData.group_id && (
                    <div className="mt-8 p-6 bg-emerald-50 rounded-3xl border-2 border-emerald-100 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="flex items-center space-x-4">
                            <div className="p-3 bg-emerald-700 text-white rounded-2xl shadow-lg">
                                <ClipboardCheck className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">Programa Analítico Detectado</p>
                                <h4 className="text-sm font-black text-emerald-950 uppercase italic">
                                    Contenidos y Problemáticas cargados automáticamente
                                </h4>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </section>
    )
}

