import React from 'react'
import { Printer } from 'lucide-react'

interface PreviewModalProps {
    isOpen: boolean
    onClose: () => void
    formData: any
    tenant: any
    profile: any
    groups: any[]
    subjects: any[]
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
    isOpen,
    onClose,
    formData,
    tenant,
    profile,
    groups,
    subjects
}) => {
    if (!isOpen) return null

    const handlePrint = () => {
        if (profile?.is_demo) {
            alert('Modo Demo: La impresión está deshabilitada.')
        } else {
            window.print()
        }
    }

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4 overflow-y-auto no-print">
            <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-tighter flex items-center">
                            <Printer className="w-4 h-4 mr-2 text-indigo-600" />
                            Vista Previa de Impresión
                        </h3>
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Formato Oficial de Planeación Didáctica</p>
                    </div>
                    <div className="flex space-x-3">
                        <button
                            onClick={handlePrint}
                            className={`px-6 py-2 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg transition-all flex items-center ${profile?.is_demo ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'
                                }`}
                        >
                            <Printer className="w-4 h-4 mr-2" /> Imprimir
                        </button>
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-white border border-gray-200 text-gray-500 rounded-xl font-bold text-[11px] uppercase tracking-widest hover:bg-gray-50 transition-all"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-12 bg-gray-100/30">
                    <div className="bg-white shadow-xl mx-auto p-12 border border-gray-200 print:shadow-none print:border-none print:p-0" style={{ width: '210mm', minHeight: '297mm' }}>
                        <div className="mb-8 border-b-2 border-gray-900 pb-4">
                            <div className="flex justify-between items-center mb-4">
                                <div className="w-24 h-24 flex items-center justify-center">
                                    {tenant?.logoLeftUrl && <img src={tenant.logoLeftUrl} alt="Logo Izquierdo" className="max-w-full max-h-full object-contain" />}
                                </div>
                                <div className="text-center flex-1 px-4">
                                    <h1 className="text-lg font-black uppercase tracking-widest">Planeación Didáctica</h1>
                                    <p className="text-sm font-bold uppercase">Ciclo Escolar 2024-2025</p>
                                </div>
                                <div className="w-24 h-24 flex items-center justify-center">
                                    {tenant?.logoRightUrl && <img src={tenant.logoRightUrl} alt="Logo Derecho" className="max-w-full max-h-full object-contain" />}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-0 border-2 border-gray-900 mb-6 text-[11px] uppercase">
                            <div className="p-2 border-r border-b border-gray-900 font-black bg-gray-50">Fase:</div>
                            <div className="p-2 border-b border-gray-900 font-bold">Fase 6 (Secundaria)</div>

                            <div className="p-2 border-r border-b border-gray-900 font-black bg-gray-50">Escuela:</div>
                            <div className="p-2 border-b border-gray-900 font-bold">{tenant?.name || 'Nombre de la Escuela'}</div>

                            <div className="p-2 border-r border-b border-gray-900 font-black bg-gray-50">Disciplina:</div>
                            <div className="p-2 border-b border-gray-900 font-bold">{subjects.find(s => s.id === formData.subject_id)?.name || 'Materia'}</div>

                            <div className="p-2 border-r border-b border-gray-900 font-black bg-gray-50">CCT:</div>
                            <div className="p-2 border-b border-gray-900 font-bold">{tenant?.cct?.toUpperCase() || '00DST0000X'}</div>

                            <div className="p-2 border-r border-b border-gray-900 font-black bg-gray-50">Docente:</div>
                            <div className="p-2 border-b border-gray-900 font-bold">PROF. {profile?.full_name?.toUpperCase() || 'DOCENTE'}</div>

                            <div className="p-2 border-r border-b border-gray-900 font-black bg-gray-50">Grado / Grupo:</div>
                            <div className="p-2 border-b border-gray-900 font-bold">
                                {groups.find(g => g.id === formData.group_id)?.grade}° {groups.find(g => g.id === formData.group_id)?.section}
                            </div>

                            <div className="p-2 border-r border-gray-900 font-black bg-gray-50">Temporalidad:</div>
                            <div className="p-2 font-bold">
                                {formData.temporality === 'WEEKLY' ? 'Semanal' : formData.temporality === 'MONTHLY' ? 'Mensual' : 'Proyecto'}
                            </div>
                        </div>

                        <div className="border-2 border-gray-900 mb-6 bg-gray-50">
                            <div className="grid grid-cols-4 gap-0 border-b border-gray-900 text-[11px] font-black italic">
                                <div className="p-1 border-r border-gray-900 text-center">Campo: {formData.campo_formativo}</div>
                                <div className="p-1 border-r border-gray-900 text-center">Metodología: {formData.metodologia}</div>
                                <div className="p-1 border-r border-gray-900 text-center">Sesiones: {formData.activities_sequence.length}</div>
                                <div className="p-1 text-center truncate px-2">
                                    {((formData.selected_themes || []).length > 0 || (formData.textbook_pages_from && formData.textbook_pages_to)) ? (
                                        <span className="text-[11px]">
                                            {(formData.selected_themes || []).length > 0 && `Temas: ${formData.selected_themes.join(', ')} `}
                                            {formData.textbook_pages_from && formData.textbook_pages_to && `| Págs: ${formData.textbook_pages_from}-${formData.textbook_pages_to}`}
                                        </span>
                                    ) : 'Sin Recurso'}
                                </div>
                            </div>
                            <div className="p-4">
                                <h4 className="text-[12px] font-black uppercase mb-2 underline decoration-2">{formData.title || 'SIN TÍTULO'}</h4>
                                <div className="space-y-4 text-xs text-justify">
                                    <div className="whitespace-pre-wrap">
                                        <span className="font-black">Problemática:</span> {formData.problem_context || 'No especificada'}
                                    </div>
                                    <div>
                                        <span className="font-black">PDA:</span>
                                        <ul className="list-disc pl-5 mt-1 space-y-1">
                                            {formData.pda.map((p: string, i: number) => <li key={i}>{p}</li>)}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="text-center font-black uppercase text-sm border-2 border-gray-900 bg-gray-100 p-2 mb-6">
                            Secuencia Didáctica
                        </div>

                        {formData.activities_sequence.map((session: any, sIdx: number) => (
                            <div key={sIdx} className="mb-8 break-inside-avoid border border-gray-200">
                                <div className="flex justify-between items-center bg-gray-900 text-white p-2 text-[11px] font-black uppercase tracking-widest">
                                    <span>Sesión {sIdx + 1}: {new Date(session.date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                                    <span className="flex items-center space-x-4">
                                        {(formData.selected_themes || []).length > 0 && (
                                            <span className="text-indigo-300">Temas: {formData.selected_themes.join(', ')}</span>
                                        )}
                                        {formData.textbook_pages_from && formData.textbook_pages_to && (
                                            <span className="text-gray-300">Págs: {formData.textbook_pages_from} - {formData.textbook_pages_to}</span>
                                        )}
                                        <span>{session.duration}m</span>
                                    </span>
                                </div>

                                <div className="grid grid-cols-3 gap-0">
                                    {session.phases.map((phase: any, pIdx: number) => (
                                        <div key={pIdx} className={`p-3 ${pIdx < 2 ? 'border-r border-gray-200' : ''}`}>
                                            <div className="font-black text-[11px] uppercase border-b border-gray-100 pb-1 flex justify-between mb-2">
                                                <span>{phase.name}</span>
                                                <span className="italic">({phase.duration || 0}m)</span>
                                            </div>
                                            <div className="text-[11px] leading-relaxed text-justify text-gray-700">
                                                {phase.activities.map((act: string, aIdx: number) => (
                                                    <div key={aIdx} className="mb-1">
                                                        • {act}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}

                        <div className="mt-16 grid grid-cols-2 gap-20">
                            <div className="text-center border-t border-gray-900 pt-2">
                                <p className="text-[11px] font-black uppercase">{profile?.full_name}</p>
                                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-tighter">Firma del Docente</p>
                            </div>
                            <div className="text-center border-t border-gray-900 pt-2">
                                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-tighter">Visto Bueno Dirección</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
