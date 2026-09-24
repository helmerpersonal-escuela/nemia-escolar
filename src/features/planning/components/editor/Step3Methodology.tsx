import React from 'react'
import {
    Target,
    Sparkles,
} from 'lucide-react'

interface Step3MethodologyProps {
    formData: any
    setFormData: React.Dispatch<React.SetStateAction<any>>
    isPreviewMode: boolean
    METODOLOGIAS: string[]
    EJES: string[]
    toggleEje: (eje: string) => void
}

export const Step3Methodology: React.FC<Step3MethodologyProps> = ({
    formData,
    setFormData,
    isPreviewMode,
    METODOLOGIAS,
    EJES,
    toggleEje
}) => {
    if (isPreviewMode) {
        return (
            <section className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                        <p className="text-[11px] font-black text-indigo-600 uppercase tracking-widest mb-1">Metodología</p>
                        <p className="font-bold text-indigo-950">{formData.metodologia}</p>
                    </div>
                    <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                        <p className="text-[11px] font-black text-indigo-600 uppercase tracking-widest mb-1">Ejes Articuladores</p>
                        <p className="font-bold text-indigo-950">{formData.ejes_articuladores.join(', ')}</p>
                    </div>
                </div>
            </section>
        )
    }

    return (
        <section className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-8">
            <div className="flex items-center space-x-3 mb-8">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                    <Target className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h2 className="text-xl font-black text-gray-900 tracking-tight">Paso 03. Metodología y Ejes Articuladores</h2>
                    <p className="text-[11px] font-bold text-indigo-500 uppercase tracking-widest mt-1">Define el enfoque pedagógico de tu planeación</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-50 shadow-sm space-y-6">
                    <div>
                        <label className="block text-[11px] font-black text-gray-500 uppercase mb-3 ml-1 tracking-widest">Metodología NEM Sugerida</label>
                        <div className="grid grid-cols-1 gap-3">
                            {METODOLOGIAS.map(m => (
                                <button
                                    key={m}
                                    onClick={() => setFormData((prev: any) => ({ ...prev, metodologia: m }))}
                                    className={`text-left px-6 py-4 rounded-2xl border-2 font-bold text-sm transition-all duration-300 ${formData.metodologia === m
                                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm'
                                        : 'bg-slate-50 border-transparent text-gray-500 hover:border-indigo-100'
                                        } btn-tactile`}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-[11px] font-black text-gray-500 uppercase mb-3 ml-1 tracking-widest">Ejes Articuladores (Mínimo 2-3 sugeridos)</label>
                        <div className="flex flex-wrap gap-2">
                            {EJES.map(eje => {
                                const isSelected = formData.ejes_articuladores.includes(eje)
                                return (
                                    <button
                                        key={eje}
                                        onClick={() => toggleEje(eje)}
                                        className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider border-2 transition-all duration-300
                                            ${isSelected
                                                ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-sm'
                                                : 'bg-slate-50 border-transparent text-gray-500 hover:bg-gray-100'
                                            }`}
                                    >
                                        {eje}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-50 shadow-sm space-y-6">
                    <div>
                        <label className="block text-[11px] font-black text-gray-500 uppercase mb-3 ml-1 tracking-widest">Propósito del Proyecto / Justificación</label>
                        <textarea aria-label="Propósito del Proyecto / Justificación"
                            rows={6}
                            value={formData.problem_context}
                            onChange={e => setFormData((prev: any) => ({ ...prev, problem_context: e.target.value }))}
                            placeholder="Extraído del Programa Analítico. Puedes ajustarlo aquí..."
                            className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-100 rounded-2xl px-6 py-4 text-sm font-medium text-slate-700 outline-none transition-all resize-none"
                        />
                    </div>

                    <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100">
                        <div className="flex items-center space-x-3 mb-4">
                            <Sparkles className="w-4 h-4 text-indigo-600" />
                            <p className="text-[11px] font-black text-indigo-600 uppercase tracking-widest">Resumen de Contenidos cargados</p>
                        </div>
                        <div className="space-y-2">
                            {formData.pda.slice(0, 3).map((p: string, i: number) => (
                                <div key={i} className="flex items-start space-x-2">
                                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full mt-1.5 shrink-0" />
                                    <p className="text-[11px] font-bold text-indigo-900 line-clamp-1">{p}</p>
                                </div>
                            ))}
                            {formData.pda.length > 3 && (
                                <p className="text-[11px] font-black text-indigo-400 uppercase italic mt-2">+ {formData.pda.length - 3} PDAs adicionales</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
