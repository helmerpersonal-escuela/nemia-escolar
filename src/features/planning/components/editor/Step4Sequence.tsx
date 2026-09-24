import React from 'react'
import { Sparkles, Clock, Target } from 'lucide-react'
import type { LessonPlanFormData } from '../../types/planning.types'

interface Step4SequenceProps {
    formData: LessonPlanFormData
    setFormData: React.Dispatch<React.SetStateAction<LessonPlanFormData>>
    isPreviewMode: boolean
    generating: boolean
    hasDecidedStrategy: boolean
    setHasDecidedStrategy: (val: boolean) => void
    generateSequenceFromSchedule: () => void
    generateAiSuggestions: () => void
    setStep: (step: number) => void
}

export const Step4Sequence: React.FC<Step4SequenceProps> = ({
    formData,
    setFormData,
    isPreviewMode,
    generating,
    hasDecidedStrategy,
    setHasDecidedStrategy,
    generateSequenceFromSchedule,
    generateAiSuggestions,
    setStep
}) => {
    return (
        <section className="animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="flex items-center space-x-4 mb-8">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-100 rotate-3 group-hover:rotate-6 transition-transform">
                    <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Paso 04</h2>
                    <p className="text-indigo-600 text-xs font-bold uppercase tracking-widest">Secuencia y Evaluación</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left: Schedule & IA */}
                <div className="space-y-8">
                    <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                            <Sparkles className="w-32 h-32" />
                        </div>
                        <h3 className="text-lg font-black mb-2 uppercase tracking-tight">Estrategia Didáctica</h3>
                        <p className="text-indigo-100 text-xs font-medium mb-8 leading-relaxed">¿Cómo quieres construir tu secuencia de actividades?</p>

                        <div className="grid grid-cols-1 gap-4 relative z-10">
                            <button
                                onClick={generateSequenceFromSchedule}
                                className="w-full flex items-center p-4 bg-white/10 hover:bg-white/20 rounded-2xl border border-white/10 transition-all text-left group"
                            >
                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mr-4">
                                    <Clock className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest">Cargar desde Horario</p>
                                    <p className="text-[11px] text-indigo-200 font-medium">Usa tus sesiones programadas</p>
                                </div>
                            </button>

                            <button
                                onClick={generateAiSuggestions}
                                disabled={generating}
                                className="w-full flex items-center p-4 bg-white text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all text-left shadow-xl"
                            >
                                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mr-4">
                                    <Sparkles className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest">Asistente IA Magic</p>
                                    <p className="text-[11px] text-indigo-400 font-bold">Generar propuesta pedagógica</p>
                                </div>
                            </button>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-50 shadow-sm">
                        <div className="flex items-center space-x-3 mb-6">
                            <div className="w-8 h-8 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center">
                                <Target className="w-4 h-4" />
                            </div>
                            <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">Evaluación Informativa</h3>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Instrumentos de Evaluación</label>
                                <div className="flex flex-wrap gap-2">
                                    {['Rúbrica', 'Lista de Cotejo', 'Diario de Clase', 'Escala Estimativa', 'Portafolio'].map(inst => {
                                        const isSelected = formData.evaluation_instruments.includes(inst)
                                        return (
                                            <button
                                                key={inst}
                                                onClick={() => {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        evaluation_instruments: isSelected
                                                            ? prev.evaluation_instruments.filter(i => i !== inst)
                                                            : [...prev.evaluation_instruments, inst]
                                                    }))
                                                }}
                                                className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase transition-all border-2
                                                    ${isSelected ? 'bg-emerald-700 border-emerald-600 text-white' : 'bg-white border-slate-100 text-slate-500 hover:border-emerald-200'} `}
                                            >
                                                {inst}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                            <textarea
                                placeholder="Especifica otros instrumentos o criterios..."
                                value={formData.evaluation_criteria}
                                onChange={e => setFormData(prev => ({ ...prev, evaluation_criteria: e.target.value }))}
                                className="w-full bg-slate-50 border-transparent rounded-2xl p-4 text-xs font-bold text-gray-700 focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all min-h-[100px]"
                            />
                        </div>
                    </div>
                </div>

                {/* Right: Sequence View */}
                <div className="h-full">
                    {!hasDecidedStrategy && formData.activities_sequence.length > 0 ? (
                        <div className="h-full bg-slate-900 rounded-[2.5rem] p-10 flex flex-col items-center justify-center text-center relative overflow-hidden group">
                            <div className="absolute inset-0 bg-indigo-600/20 group-hover:bg-indigo-600/30 transition-colors"></div>
                            <div className="relative z-10">
                                <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center mb-6 shadow-2xl mx-auto border-4 border-slate-800 animate-bounce">
                                    <Sparkles className="w-10 h-10 text-white" />
                                </div>
                                <h3 className="text-xl font-black text-white mb-2 tracking-tight">¡Secuencia Cargada!</h3>
                                <p className="text-slate-500 text-xs font-medium mb-8 max-w-[200px] mx-auto">Tus sesiones están listas para ser detalladas o mejoradas con IA.</p>
                                <button
                                    onClick={() => setHasDecidedStrategy(true)}
                                    className="px-8 py-4 bg-white text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl"
                                >
                                    Ver y Editar Sesiones
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-50 shadow-sm relative h-full flex flex-col">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">Secuencia de Actividades</h3>
                                {formData.activities_sequence.length > 0 && !isPreviewMode && (
                                    <button
                                        onClick={() => setHasDecidedStrategy(false)}
                                        className="text-[11px] font-black text-indigo-600 uppercase hover:underline"
                                    >
                                        Re-Generar con IA
                                    </button>
                                )}
                            </div>

                            <div className="space-y-6 flex-1">
                                {formData.activities_sequence.length === 0 ? (
                                    <div className="py-20 text-center flex flex-col items-center justify-center h-full">
                                        <Clock className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                        <p className="text-slate-500 font-bold text-sm">Carga el horario para comenzar.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {formData.activities_sequence.slice(0, 3).map((session, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border-2 border-transparent">
                                                <div className="flex items-center space-x-4">
                                                    <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center font-black text-xs">
                                                        {idx + 1}
                                                    </div>
                                                    <div>
                                                        <p className="text-[11px] font-black text-gray-900 uppercase mb-0.5">Sesión {idx + 1}</p>
                                                        <p className="text-[11px] font-bold text-gray-500 uppercase">{new Date(session.date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    {session.phases.some((p: any) => p.activities.length > 0) ? (
                                                        <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md uppercase">Listas</span>
                                                    ) : (
                                                        <span className="text-[11px] font-black text-amber-700 bg-amber-50 px-2 py-1 rounded-md uppercase">Pendientes</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {formData.activities_sequence.length > 3 && (
                                            <div className="text-center">
                                                <p className="text-[11px] font-black text-indigo-400 uppercase tracking-widest">+ {formData.activities_sequence.length - 3} sesiones más</p>
                                            </div>
                                        )}
                                        {!isPreviewMode && (
                                            <button
                                                onClick={() => setStep(5)}
                                                className="w-full py-4 border-2 border-dashed border-slate-100 rounded-2xl text-[11px] font-black text-slate-500 uppercase tracking-widest hover:border-indigo-100 hover:text-indigo-400 transition-all"
                                            >
                                                Ver todas las sesiones / Editar Detallado
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </section>
    )
}
