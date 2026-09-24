import React, { useState, useEffect } from 'react'
import {
    X, Sparkles, Calendar, Clock, Save, Printer, Edit3, ChevronRight, ChevronLeft,
    CheckCircle2, AlertCircle, FileText, MessageSquare
} from 'lucide-react'
import { geminiService } from '../../../lib/gemini'
import { supabase } from '../../../lib/supabase'
import { todayISO } from '../../../lib/dates'

interface ClassPlanGeneratorModalProps {
    isOpen: boolean
    onClose: () => void
    tenantId: string
    groupId: string
    subjectId?: string
    isSecondary?: boolean
    onPlanSaved?: () => void
    editingPlan?: any
}

export const ClassPlanGeneratorModal: React.FC<ClassPlanGeneratorModalProps> = ({
    isOpen,
    onClose,
    tenantId,
    groupId,
    subjectId,
    isSecondary = false,
    onPlanSaved,
    editingPlan
}) => {
    const [step, setStep] = useState(1) // 1: Config, 2: Generation/Editor, 3: Reflection
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [lessonPlan, setLessonPlan] = useState<any>(null)

    // Form State
    const [classDate, setClassDate] = useState(todayISO())
    const [duration, setDuration] = useState(isSecondary ? '1' : '50')
    const [planData, setPlanData] = useState<any>({
        script: '',
        activities: '',
        questions: '',
        axes_integration: '',
        evaluation_instrument: '',
        resources: '',
        significant_homework: ''
    })
    const [reflection, setReflection] = useState('')

    // Multi-subject support
    const [groupSubjects, setGroupSubjects] = useState<any[]>([])
    const [selectedSubjId, setSelectedSubjId] = useState(subjectId || '')
    const [isMultiSubject, setIsMultiSubject] = useState(false)

    useEffect(() => {
        if (isOpen) {
            fetchTenantAndSubjects()
            if (editingPlan) {
                setClassDate(editingPlan.class_date)
                setDuration(editingPlan.duration_or_module)
                setPlanData(editingPlan.ai_generated_content)
                setReflection(editingPlan.teacher_reflection || '')
                setSelectedSubjId(editingPlan.subject_id)
                setStep(2) // Jump to editor
            } else {
                setStep(1)
            }
        }
    }, [isOpen, editingPlan])

    const fetchTenantAndSubjects = async () => {
        if (!isOpen || !tenantId) return

        const { data: tenant } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', tenantId)
            .single()

        if (tenant) {
            const multi = tenant.educationalLevel === 'PRIMARY' || tenant.educationalLevel === 'TELESECUNDARIA'
            setIsMultiSubject(multi)

            // 1. Fetch Group specific subjects
            const { data: gsData } = await supabase
                .from('group_subjects')
                .select(`
                    id, 
                    subject_catalog_id, 
                    custom_name,
                    subject_catalog(name)
                `)
                .eq('group_id', groupId)

            // 2. Fetch Profile subjects (for independent teachers or specific settings)
            const { data: { user } } = await supabase.auth.getUser()
            let profileSubjects: any[] = []
            if (user) {
                const { data: psData } = await supabase
                    .from('profile_subjects')
                    .select(`
                        id,
                        subject_catalog_id,
                        custom_detail,
                        subject_catalog(name)
                    `)
                    .eq('profile_id', user.id)
                if (psData) profileSubjects = psData
            }

            // 3. Merge and Deduplicate
            const subjectsMap = new Map()

            gsData?.forEach((gs: any) => {
                subjectsMap.set(gs.id, {
                    id: gs.id,
                    name: gs.subject_catalog?.name || gs.custom_name || 'Sin Nombre'
                })
            })

            profileSubjects.forEach((ps: any) => {
                // If the profile subject isn't already in the list (matching by ID or catalog ID? Usually ID is enough if linked)
                if (!subjectsMap.has(ps.id)) {
                    subjectsMap.set(ps.id, {
                        id: ps.id,
                        name: ps.subject_catalog?.name || ps.custom_detail || 'Materia Personalizada'
                    })
                }
            })

            const finalSubjects = Array.from(subjectsMap.values())
            setGroupSubjects(finalSubjects)

            if (!selectedSubjId && finalSubjects.length > 0 && multi) {
                setSelectedSubjId(finalSubjects[0].id)
            }
        }
    }

    useEffect(() => {
        if (isOpen && !editingPlan && selectedSubjId) {
            fetchLatestLessonPlan()
        }
    }, [isOpen, editingPlan, selectedSubjId])

    const fetchLatestLessonPlan = async () => {
        try {
            const { data, error } = await supabase
                .from('lesson_plans')
                .select('*')
                .eq('group_id', groupId)
                .eq('subject_id', selectedSubjId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

            if (error) throw error
            setLessonPlan(data)
        } catch (err) {
            console.error('Error fetching lesson plan:', err)
        }
    }

    const handleGenerate = async () => {
        if (!lessonPlan) {
            alert('No se encontró una planeación previa para basar este plan de clase.')
            return
        }

        setLoading(true)
        try {
            const result = await geminiService.generateDailyClassPlan({
                lessonPlan,
                classDate,
                duration,
                isSecondary
            })
            setPlanData(result)
            setStep(2)
        } catch (err: any) {
            alert(err.message || 'Error al generar el plan con IA')
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const dataToSave = {
                tenant_id: tenantId,
                group_id: groupId,
                subject_id: selectedSubjId,
                lesson_plan_id: lessonPlan?.id || editingPlan?.lesson_plan_id,
                class_date: classDate,
                duration_or_module: duration,
                ai_generated_content: planData,
                teacher_reflection: reflection,
                updated_at: new Date().toISOString()
            }

            if (editingPlan?.id) {
                const { error } = await supabase
                    .from('class_plans')
                    .update(dataToSave)
                    .eq('id', editingPlan.id)
                if (error) throw error
            } else {
                const { error } = await supabase
                    .from('class_plans')
                    .insert([dataToSave])
                if (error) throw error
            }

            onPlanSaved?.()
            onClose()
        } catch (err: any) {
            alert('Error al guardar el plan: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    const handlePrint = () => {
        const printWindow = window.open('', '_blank')
        if (!printWindow) return

        const content = `
            <html>
            <head>
                <title>Ficha de Clase - ${classDate}</title>
                <style>
                    body { font-family: sans-serif; padding: 40px; line-height: 1.6; color: #333; }
                    .header { border-bottom: 2px solid #4f46e5; margin-bottom: 20px; padding-bottom: 10px; }
                    h1 { color: #4f46e5; margin: 0; font-size: 24px; }
                    .meta { display: grid; grid-template-cols: 1fr 1fr; gap: 10px; margin-bottom: 30px; background: #f8fafc; padding: 15px; border-radius: 8px; }
                    h2 { font-size: 18px; color: #1e293b; border-left: 4px solid #4f46e5; padding-left: 10px; margin-top: 25px; }
                    .section { margin-bottom: 20px; white-space: pre-wrap; }
                    .footer { margin-top: 50px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Plan de Clase Diario - Mi Plan de Clases</h1>
                    <p>${lessonPlan?.title || 'Planeación General'}</p>
                </div>
                <div class="meta">
                    <div><strong>Fecha:</strong> ${classDate}</div>
                    <div><strong>Duración/Módulo:</strong> ${duration} ${isSecondary ? 'Modulo(s)' : 'Minutos'}</div>
                    <div><strong>Materia:</strong> ${lessonPlan?.subject || 'N/A'}</div>
                    <div><strong>Campo Formativo:</strong> ${lessonPlan?.field || 'N/A'}</div>
                </div>

                <h2>Guion Minuto a Minuto</h2>
                <div class="section">${planData.script}</div>

                <h2>Actividades Paso a Paso</h2>
                <div class="section">${planData.activities}</div>

                <h2>Preguntas Motivadoras</h2>
                <div class="section">${planData.questions}</div>

                <h2>Integración de Ejes Articuladores</h2>
                <div class="section">${planData.axes_integration}</div>

                <h2>Instrumento de Evaluación</h2>
                <div class="section">${planData.evaluation_instrument}</div>

                <h2>Recursos Necesarios</h2>
                <div class="section">${planData.resources}</div>

                ${planData.significant_homework ? `<h2>Tarea Significativa</h2><div class="section">${planData.significant_homework}</div>` : ''}

                ${reflection ? `<h2>Reflexión del Docente</h2><div class="section">${reflection}</div>` : ''}

                <div class="footer">Generado por Sistema de Gestión Escolar NEM - ${new Date().toLocaleString()}</div>
            </body>
            </html>
        `
        printWindow.document.write(content)
        printWindow.document.close()
        printWindow.print()
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100">

                {/* Header */}
                <div className="p-6 md:p-8 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-indigo-700 text-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-2xl">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black tracking-tight">{editingPlan ? 'Editar Plan de Clase' : '✨ Construir Mi Plan de Clase'}</h2>
                            <p className="text-xs text-indigo-100 font-medium">Nueva Escuela Mexicana • Asistente Didáctico</p>
                        </div>
                    </div>
                    <button aria-label="Cerrar" onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Progress Bar (Only for new plans) */}
                {!editingPlan && (
                    <div className="flex bg-slate-100 h-1.5">
                        <div className={`transition-all duration-500 bg-indigo-500 h-full ${step === 1 ? 'w-1/3' : step === 2 ? 'w-2/3' : 'w-full'}`} />
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-slate-50/30">

                    {step === 1 && (
                        <div className="max-w-xl mx-auto space-y-6 animate-in slide-in-from-bottom-4">
                            <div className="text-center space-y-2">
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Configura tu sesión</h3>
                                <p className="text-slate-500 text-sm">Define los parámetros de tiempo para que la IA organice tu guion adecuadamente.</p>
                            </div>

                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-700">
                                {(isMultiSubject || !subjectId) && (
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Materia Correspondiente</label>
                                        <select aria-label="Materia Correspondiente"
                                            className="input-squishy w-full py-4 px-6 text-sm font-black bg-white border-2 border-indigo-50 focus:border-indigo-200"
                                            value={selectedSubjId}
                                            onChange={(e) => setSelectedSubjId(e.target.value)}
                                        >
                                            <option value="">Selecciona una Materia...</option>
                                            {groupSubjects.map(s => (
                                                <option key={s.id} value={s.id}>{(s.name || 'Sin Nombre').toUpperCase()}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Fecha de la Clase</label>
                                        <div className="relative">
                                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                            <input aria-label="Fecha de la Clase"
                                                type="date"
                                                value={classDate}
                                                onChange={(e) => setClassDate(e.target.value)}
                                                className="input-squishy pl-12 py-4 w-full"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">
                                            {isSecondary ? 'Número de Módulos' : 'Duración (Minutos)'}
                                        </label>
                                        <div className="relative">
                                            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                            <input
                                                type="number"
                                                value={duration}
                                                onChange={(e) => setDuration(e.target.value)}
                                                className="input-squishy pl-12 py-4 w-full"
                                                placeholder={isSecondary ? "Ej. 2" : "Ej. 50"}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {!lessonPlan && !loading && (
                                <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-center gap-3">
                                    <AlertCircle className="w-5 h-5 text-amber-700 shrink-0" />
                                    <p className="text-xs text-amber-700 font-medium">Si no tienes una planeación general creada, la IA generará una estructura estándar.</p>
                                </div>
                            )}

                            <button
                                onClick={handleGenerate}
                                disabled={loading}
                                className="w-full py-4 bg-indigo-600 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all btn-tactile disabled:opacity-50 flex items-center justify-center gap-3"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Generando Magia...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" />
                                        Construir Plan de Clase
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 animate-in fade-in duration-500">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <div>
                                    <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">Editor de Plan Diario</h3>
                                    <span className="text-[11px] text-slate-500 font-bold uppercase tracking-tighter">{classDate} • {duration} {isSecondary ? 'Modulo(s)' : 'min'}</span>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={handlePrint} className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all border border-slate-200" title="Imprimir Ficha">
                                        <Printer className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Left Column: Script & Activities */}
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                                            <Clock className="w-3 h-3" /> Guion Minuto a Minuto
                                        </label>
                                        <textarea
                                            value={planData.script}
                                            onChange={(e) => setPlanData({ ...planData, script: e.target.value })}
                                            className="input-squishy w-full h-48 py-4 text-sm leading-relaxed"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                                            <ChevronRight className="w-3 h-3" /> Actividades Paso a Paso
                                        </label>
                                        <textarea
                                            value={planData.activities}
                                            onChange={(e) => setPlanData({ ...planData, activities: e.target.value })}
                                            className="input-squishy w-full h-48 py-4 text-sm leading-relaxed"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                                            <MessageSquare className="w-3 h-3" /> Preguntas Motivadoras
                                        </label>
                                        <textarea
                                            value={planData.questions}
                                            onChange={(e) => setPlanData({ ...planData, questions: e.target.value })}
                                            className="input-squishy w-full h-32 py-4 text-sm leading-relaxed"
                                        />
                                    </div>
                                </div>

                                {/* Right Column: Evaluation, Resources, reflection */}
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                                            <CheckCircle2 className="w-3 h-3" /> Instrumento de Evaluación
                                        </label>
                                        <textarea
                                            value={planData.evaluation_instrument}
                                            onChange={(e) => setPlanData({ ...planData, evaluation_instrument: e.target.value })}
                                            className="input-squishy w-full h-40 py-4 text-sm leading-relaxed"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                                            <FileText className="w-3 h-3" /> Recursos y Materiales
                                        </label>
                                        <textarea
                                            value={planData.resources}
                                            onChange={(e) => setPlanData({ ...planData, resources: e.target.value })}
                                            className="input-squishy w-full h-32 py-4 text-sm leading-relaxed"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-amber-700 uppercase tracking-widest flex items-center gap-2">
                                            <Edit3 className="w-3 h-3" /> Reflexión al Final del Día
                                        </label>
                                        <textarea
                                            placeholder="¿Qué funcionó? ¿Qué podrías mejorar mañana?..."
                                            value={reflection}
                                            onChange={(e) => setReflection(e.target.value)}
                                            className="input-squishy w-full h-40 py-4 text-sm leading-relaxed bg-amber-50/30 border-amber-100"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-6 md:px-8 md:py-6 bg-white border-t border-slate-100 flex items-center justify-between gap-4">
                    {step === 2 && !editingPlan ? (
                        <button
                            onClick={() => setStep(1)}
                            className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-slate-200 transition-all flex items-center"
                        >
                            <ChevronLeft className="w-4 h-4 mr-2" /> Volver
                        </button>
                    ) : (
                        <div />
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-3 bg-white text-slate-500 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:text-slate-600 transition-all"
                        >
                            Cancelar
                        </button>
                        {step === 2 && (
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-8 py-3 bg-emerald-700 text-white rounded-[2rem] font-black uppercase text-[11px] tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-800 transition-all btn-tactile flex items-center gap-2"
                            >
                                {saving ? (
                                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                {editingPlan ? 'Guardar Cambios' : 'Finalizar y Guardar'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
