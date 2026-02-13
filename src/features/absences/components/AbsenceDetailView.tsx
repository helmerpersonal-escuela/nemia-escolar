
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Printer, Edit3, Save, CheckCircle2, User, BookOpen, Clock, FileText, Sparkles } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

interface AbsenceDetailViewProps {
    isOpen: boolean
    absence: any
    onClose: () => void
    onUpdate: () => void
}

export const AbsenceDetailView = ({ isOpen, absence, onClose, onUpdate }: AbsenceDetailViewProps) => {
    const [isEditing, setIsEditing] = useState(false)
    const [editableActivities, setEditableActivities] = useState<any[]>([])
    const [profile, setProfile] = useState<any>(null)

    useEffect(() => {
        if (absence?.activities) {
            setEditableActivities(JSON.parse(JSON.stringify(absence.activities)))
        }

        // Fetch profile for print footer
        const fetchProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single()
                setProfile(data)
            }
        }
        fetchProfile()
    }, [absence])

    if (!isOpen || !absence) return null

    const handleSave = async () => {
        const { error } = await supabase
            .from('absence_plans')
            .update({ activities: editableActivities })
            .eq('id', absence.id)

        if (error) {
            alert('Error al guardar los cambios')
        } else {
            setIsEditing(false)
            onUpdate()
        }
    }

    const handlePrint = () => {
        window.print()
    }

    const safeRenderText = (text: any): string => {
        if (!text) return ''
        if (typeof text === 'string') return text
        if (typeof text === 'object') {
            return Object.entries(text)
                .map(([key, value]) => `${key.toUpperCase()}:\n${safeRenderText(value)}`)
                .join('\n\n')
        }
        return String(text)
    }

    const printStyles = `
        @media print {
            #root {
                display: none !important;
            }

            html, body {
                margin: 0 !important;
                padding: 0 !important;
                height: auto !important;
                overflow: visible !important;
                background: white !important;
            }
            
            #absence-print-root {
                visibility: visible !important;
                display: block !important;
                position: relative !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
            }

            .no-print {
                display: none !important;
            }

            .activity-card {
                break-inside: avoid;
                border-bottom: 2px solid #000 !important;
                margin-bottom: 2rem !important;
                padding: 2rem 0 !important;
                width: 100% !important;
            }

            .card-header {
                border-bottom: 1px solid #000 !important;
                padding-bottom: 1rem !important;
                margin-bottom: 1.5rem !important;
                display: block !important;
            }

            .header-info-row {
                display: flex !important;
                justify-content: space-between !important;
                align-items: baseline !important;
                margin-bottom: 0.5rem !important;
            }

            .header-label {
                font-size: 9px !important;
                font-weight: bold !important;
                text-transform: uppercase !important;
                color: #666 !important;
            }

            .header-value {
                font-size: 14px !important;
                font-weight: bold !important;
                color: #000 !important;
            }

            .section-box {
                margin-bottom: 1.5rem !important;
            }

            .section-label {
                font-size: 10px !important;
                font-weight: bold !important;
                text-transform: uppercase !important;
                text-decoration: underline !important;
                display: block !important;
                margin-bottom: 0.5rem !important;
            }

            .section-content {
                font-size: 12px !important;
                line-height: 1.6 !important;
                color: #000 !important;
                white-space: pre-line !important;
            }

            .printable-box {
                border: 1px solid #000 !important;
                padding: 2rem !important;
                margin-top: 2rem !important;
                page-break-before: always;
            }

            .resource-header {
                text-align: center !important;
                font-size: 18px !important;
                font-weight: bold !important;
                text-transform: uppercase !important;
                border-bottom: 1px solid #000 !important;
                padding-bottom: 1rem !important;
                margin-bottom: 2rem !important;
            }

            .product-tag {
                font-weight: bold !important;
                border-top: 1px solid #000 !important;
                padding-top: 0.5rem !important;
                display: inline-block !important;
                margin-top: 1rem !important;
            }
        }
    `

    return createPortal(
        <div id="absence-print-root" className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300 print:bg-white print:p-0 print:static print:block print:inset-auto">
            <style>{printStyles}</style>
            <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:shadow-none print:max-h-none print:w-full print:rounded-none print-scroll-none">

                {/* Modal Header */}
                <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 no-print">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-600 text-white rounded-2xl">
                            <Clock className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900">Actividades de Guardia</h2>
                            <p className="text-sm font-medium text-slate-500">
                                {absence.reason || 'Sin motivo'} • {absence.start_date} al {absence.end_date}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {isEditing ? (
                            <button onClick={handleSave} className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-700 transition-all">
                                <Save className="w-5 h-5" /> Guardar
                            </button>
                        ) : (
                            <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 bg-slate-100 text-slate-600 px-6 py-3 rounded-xl font-bold hover:bg-slate-200 transition-all">
                                <Edit3 className="w-5 h-5" /> Editar
                            </button>
                        )}
                        <button onClick={handlePrint} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all">
                            <Printer className="w-5 h-5" /> Imprimir
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-white rounded-xl text-slate-400">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="p-8 overflow-y-auto flex-1 bg-slate-50 print:bg-white print:p-0 print:overflow-visible">
                    <div className="space-y-8 max-w-3xl mx-auto print:max-w-none">
                        {editableActivities.map((act, idx) => (
                            <div key={idx} className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden flex flex-col activity-card">
                                {/* Print Header */}
                                <div className="card-header print:border-none print:shadow-none">
                                    <div className="header-info-item">
                                        <div className="flex items-center gap-2 no-print mb-1">
                                            <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full">{act.group}</span>
                                        </div>
                                        <div className="hidden print:block header-info-row">
                                            <div>
                                                <span className="header-label">Materia / Grupo:</span><br />
                                                <span className="header-value">{act.subject} • {act.group}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="header-label">Fecha / Hora:</span><br />
                                                <span className="header-value">{act.date} • {act.time}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="header-label">Duración:</span><br />
                                                <span className="header-value">{act.duration} min</span>
                                            </div>
                                        </div>
                                        <span className="print:hidden text-xl font-black text-slate-800">{act.subject}</span>
                                        <p className="text-xs font-bold text-slate-400 no-print">{act.date} • {act.time}</p>
                                    </div>
                                    <div className="flex flex-col items-end header-info-item no-print">
                                        <span className="header-label">Duración</span>
                                        <span className="header-value text-slate-700">{act.duration || '--'} min</span>
                                    </div>
                                </div>

                                <div className="p-6 space-y-4 print:p-0 print:space-y-0">
                                    {/* Title Section */}
                                    <div className="section-box">
                                        <div className="flex items-center gap-2 text-slate-400 mb-2 section-title">
                                            <Sparkles className="w-4 h-4 no-print" />
                                            <label className="text-[10px] font-black uppercase tracking-widest section-label">Actividad Principal</label>
                                        </div>
                                        {isEditing ? (
                                            <input
                                                value={act.title}
                                                onChange={(e) => {
                                                    const newActs = [...editableActivities]
                                                    newActs[idx].title = e.target.value
                                                    setEditableActivities(newActs)
                                                }}
                                                className="w-full text-lg font-black text-slate-800 border-b-2 border-slate-100 focus:border-indigo-600 outline-none pb-2"
                                            />
                                        ) : (
                                            <h4 className="text-xl font-black text-slate-900 leading-tight">
                                                {act.title}
                                            </h4>
                                        )}
                                    </div>

                                    {/* Instructions Section */}
                                    <div className="section-box">
                                        <div className="flex items-center gap-2 text-amber-500 mb-2 section-title">
                                            <User className="w-4 h-4 no-print" />
                                            <label className="text-[10px] font-black uppercase tracking-widest section-label">Instrucciones Suplente</label>
                                        </div>
                                        {isEditing ? (
                                            <textarea
                                                value={safeRenderText(act.instructions_for_substitute)}
                                                onChange={(e) => {
                                                    const newActs = [...editableActivities]
                                                    newActs[idx].instructions_for_substitute = e.target.value
                                                    setEditableActivities(newActs)
                                                }}
                                                className="w-full h-32 p-4 bg-slate-50 rounded-xl font-medium text-slate-700 outline-none resize-none"
                                            />
                                        ) : (
                                            <p className="text-sm text-slate-600 leading-relaxed font-medium whitespace-pre-line section-content">
                                                {safeRenderText(act.instructions_for_substitute)}
                                            </p>
                                        )}
                                    </div>

                                    {/* Student Work Section */}
                                    <div className="section-box">
                                        <div className="flex items-center gap-2 text-indigo-600 mb-2 section-title">
                                            <BookOpen className="w-4 h-4 no-print" />
                                            <label className="text-[10px] font-black uppercase tracking-widest section-label">Trabajo Estudiante</label>
                                        </div>
                                        {isEditing ? (
                                            <textarea
                                                value={safeRenderText(act.student_work)}
                                                onChange={(e) => {
                                                    const newActs = [...editableActivities]
                                                    newActs[idx].student_work = e.target.value
                                                    setEditableActivities(newActs)
                                                }}
                                                className="w-full h-32 p-4 bg-slate-50 rounded-xl font-medium text-slate-700 outline-none resize-none"
                                            />
                                        ) : (
                                            <p className="text-sm text-slate-600 leading-relaxed font-medium whitespace-pre-line section-content">
                                                {safeRenderText(act.student_work)}
                                            </p>
                                        )}
                                    </div>

                                    {/* Printable Resource Section */}
                                    {act.printable_resource && (
                                        <div className="section-box print:p-0 print:border-none printable-box">
                                            <div className="flex items-center gap-2 text-amber-700 mb-4 no-print">
                                                <FileText className="w-4 h-4" />
                                                <label className="text-[10px] font-black uppercase tracking-widest">Material Anexo ({act.printable_resource.type})</label>
                                            </div>
                                            {isEditing ? (
                                                <div className="space-y-3">
                                                    <input
                                                        value={act.printable_resource.title}
                                                        onChange={(e) => {
                                                            const newActs = [...editableActivities]
                                                            newActs[idx].printable_resource.title = e.target.value
                                                            setEditableActivities(newActs)
                                                        }}
                                                        className="w-full text-lg font-black text-slate-800 border-b-2 border-amber-100 outline-none pb-1"
                                                    />
                                                    <textarea
                                                        value={safeRenderText(act.printable_resource.content)}
                                                        onChange={(e) => {
                                                            const newActs = [...editableActivities]
                                                            newActs[idx].printable_resource.content = e.target.value
                                                            setEditableActivities(newActs)
                                                        }}
                                                        className="w-full h-40 p-4 bg-amber-50/20 rounded-xl font-medium text-slate-700 outline-none resize-none"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="bg-amber-50/10 border-2 border-dashed border-amber-100 rounded-2xl p-6 print:border-solid print:border-black print:rounded-none">
                                                    <h5 className="text-lg font-black text-slate-900 mb-4 text-center underline resource-header">
                                                        {act.printable_resource.title}
                                                    </h5>
                                                    <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line font-medium italic section-content">
                                                        {safeRenderText(act.printable_resource.content)}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Card Footer */}
                                    <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between print:border-t-2 print:border-black print:p-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center no-print">
                                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest no-print">Producto</p>
                                                <p className="font-black text-slate-800 text-xs product-tag">{act.final_product}</p>
                                            </div>
                                        </div>
                                        <div className="hidden print:block mt-8">
                                            <span className="header-label">PRODUCTO ESPERADO:</span>
                                            <span className="block text-sm font-bold product-tag">{act.final_product}</span>
                                            <p className="mt-8 text-[8px] italic opacity-50">Generado con IA • Sistema de Gestión Escolar • Docente: {profile?.full_name}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="p-6 border-t border-slate-100 bg-white no-print text-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Vista de Detalle de Ausencia • Sistema de Gestión Escolar
                    </span>
                </div>
            </div>
        </div>,
        document.body
    )
}
