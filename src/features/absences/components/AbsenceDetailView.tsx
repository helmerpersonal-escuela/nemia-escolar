
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
        let hasError = false
        // Update each modified activity
        for (const act of editableActivities) {
            const { error } = await supabase
                .from('substitution_activities')
                .update({
                    activity_title: act.activity_title,
                    activity_description: act.activity_description,
                    ai_generated_hints: act.ai_generated_hints
                })
                .eq('id', act.id)

            if (error) {
                console.error('Error updating activity', act.id, error)
                hasError = true
            }
        }

        if (hasError) {
            alert('Hubo errores al guardar algunos cambios. Por favor revisa.')
        } else {
            setIsEditing(false)
            onUpdate()
        }
    }

    const handlePrint = () => {
        window.print()
    }

    const handlePrintSingle = (e: React.MouseEvent, index: number) => {
        e.stopPropagation()
        const style = document.createElement('style')
        style.id = 'temp-print-style'
        style.innerHTML = `
            @media print {
                body * { visibility: hidden; }
                #activity-card-${index}, #activity-card-${index} * { visibility: visible; }
                #activity-card-${index} { 
                    position: absolute; 
                    left: 0; 
                    top: 0; 
                    width: 100% !important; 
                    margin: 0 !important; 
                    padding: 0 !important; 
                    border: none !important; 
                    box-shadow: none !important;
                }
                .no-print { display: none !important; }
            }
        `
        document.head.appendChild(style)
        window.print()
        document.head.removeChild(style)
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
                        <button onClick={handlePrint} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all" title="Imprimir todas">
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
                            <div
                                key={idx}
                                id={`activity-card-${idx}`}
                                className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden flex flex-col activity-card relative"
                            >
                                <div className="absolute top-6 right-6 no-print z-10">
                                    <button
                                        onClick={(e) => handlePrintSingle(e, idx)}
                                        className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-full transition-colors"
                                        title="Imprimir solo esta actividad"
                                    >
                                        <Printer className="w-5 h-5" />
                                    </button>
                                </div>
                                {/* Print Header */}
                                <div className="card-header print:border-none print:shadow-none">
                                    <div className="header-info-item">
                                        <div className="flex items-center gap-2 no-print mb-1">
                                            <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full">
                                                {act.group?.grade}° {act.group?.section}
                                            </span>
                                        </div>
                                        <div className="hidden print:block header-info-row">
                                            <div>
                                                <span className="header-label">Materia / Grupo:</span><br />
                                                <span className="header-value">{act.subject?.name} • {act.group?.grade}° {act.group?.section}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="header-label">Título:</span><br />
                                                <span className="header-value">{act.activity_title}</span>
                                            </div>
                                        </div>
                                        <span className="print:hidden text-xl font-black text-slate-800">{act.subject?.name}</span>
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
                                                value={act.activity_title}
                                                onChange={(e) => {
                                                    const value = e.target.value
                                                    setEditableActivities(prev => {
                                                        const next = [...prev]
                                                        next[idx] = { ...next[idx], activity_title: value }
                                                        return next
                                                    })
                                                }}
                                                className="w-full text-lg font-black text-slate-800 border-b-2 border-slate-100 focus:border-indigo-600 outline-none pb-2"
                                            />
                                        ) : (
                                            <h4 className="text-xl font-black text-slate-900 leading-tight">
                                                {act.activity_title}
                                            </h4>
                                        )}
                                    </div>

                                    {/* Instructions Section */}
                                    <div className="section-box">
                                        <div className="flex items-center gap-2 text-amber-500 mb-2 section-title">
                                            <User className="w-4 h-4 no-print" />
                                            <label className="text-[10px] font-black uppercase tracking-widest section-label">Instrucciones Suplente (IA)</label>
                                        </div>
                                        {isEditing ? (
                                            <textarea
                                                value={act.ai_generated_hints || ''}
                                                onChange={(e) => {
                                                    const value = e.target.value
                                                    setEditableActivities(prev => {
                                                        const next = [...prev]
                                                        next[idx] = { ...next[idx], ai_generated_hints: value }
                                                        return next
                                                    })
                                                }}
                                                className="w-full h-32 p-4 bg-slate-50 rounded-xl font-medium text-slate-700 outline-none resize-none"
                                            />
                                        ) : (
                                            <p className="text-sm text-slate-600 leading-relaxed font-medium whitespace-pre-line section-content">
                                                {act.ai_generated_hints || 'Sin instrucciones adicionales'}
                                            </p>
                                        )}
                                    </div>

                                    {/* Description Section */}
                                    <div className="section-box">
                                        <div className="flex items-center gap-2 text-indigo-600 mb-2 section-title">
                                            <BookOpen className="w-4 h-4 no-print" />
                                            <label className="text-[10px] font-black uppercase tracking-widest section-label">Detalle Actividad</label>
                                        </div>
                                        {isEditing ? (
                                            <textarea
                                                value={act.activity_description || ''}
                                                onChange={(e) => {
                                                    const value = e.target.value
                                                    setEditableActivities(prev => {
                                                        const next = [...prev]
                                                        next[idx] = { ...next[idx], activity_description: value }
                                                        return next
                                                    })
                                                }}
                                                className="w-full h-64 p-4 bg-slate-50 rounded-xl font-medium text-slate-700 outline-none resize-none"
                                            />
                                        ) : (
                                            <p className="text-sm text-slate-600 leading-relaxed font-medium whitespace-pre-line section-content">
                                                {act.activity_description || 'Sin descripción'}
                                            </p>
                                        )}
                                    </div>

                                    {/* Footer */}
                                    <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between print:border-t-2 print:border-black print:p-4">
                                        <div className="hidden print:block mt-8">
                                            <p className="mt-8 text-[8px] italic opacity-50">Generado con IA • Vunlek • Docente: {profile?.full_name}</p>
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
                        Vista de Detalle de Ausencia • Vunlek
                    </span>
                </div>
            </div>
        </div>,
        document.body
    )
}
