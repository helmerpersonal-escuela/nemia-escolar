
import { useState, useEffect } from 'react'
import { X, Calendar, Sparkles, Loader2, AlertCircle, CheckCircle2, FileText, Printer, User, BookOpen } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { useProfile } from '../../../hooks/useProfile'
import { geminiService } from '../../../lib/gemini'
import { eachDayOfInterval, format, parseISO, getDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { createPortal } from 'react-dom'

interface AbsenceRequestModalProps {
    isOpen: boolean
    onClose: () => void
}

const DAY_MAP: Record<number, string> = {
    1: 'MONDAY',
    2: 'TUESDAY',
    3: 'WEDNESDAY',
    4: 'THURSDAY',
    5: 'FRIDAY',
    6: 'SATURDAY',
    0: 'SUNDAY'
}

const REASON_OPTIONS = [
    'Enfermedad',
    'Cita Médica',
    'Permiso Económico',
    'Comisión Escolar',
    'Otros'
]

export const AbsenceRequestModal = ({ isOpen, onClose }: AbsenceRequestModalProps) => {
    const { data: tenant } = useTenant()
    const { profile } = useProfile()
    const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [reason, setReason] = useState('')
    const [isCustomReason, setIsCustomReason] = useState(false)
    const [loading, setLoading] = useState(false)
    const [affectedClasses, setAffectedClasses] = useState<any[]>([])
    const [generatedActivities, setGeneratedActivities] = useState<any[]>([])
    const [step, setStep] = useState(1) // 1: Config, 2: Preview, 3: Review & Edit

    if (!isOpen) return null

    const handlePreviewClasses = async () => {
        setLoading(true)
        try {
            const start = parseISO(startDate)
            const end = parseISO(endDate)
            const days = eachDayOfInterval({ start, end })

            // 1. Get teacher's schedule entries
            // First get what groups/subjects they teach
            const { data: assignments } = await supabase
                .from('group_subjects')
                .select('group_id, subject_catalog_id, custom_name')
                .eq('teacher_id', profile?.id)

            const teacherAssignments = assignments || []

            const { data: schedule } = await supabase
                .from('schedules')
                .select(`
                    *,
                    subject:subject_catalog (name),
                    group:groups (grade, section)
                `)
                .eq('tenant_id', tenant?.id)

            const relevantSchedule = (schedule || []).filter(item =>
                teacherAssignments.some(a =>
                    a.group_id === item.group_id &&
                    (a.subject_catalog_id === item.subject_id || a.custom_name === item.custom_subject)
                )
            )

            const classesToGenerate: any[] = []

            for (const day of days) {
                const dayName = DAY_MAP[getDay(day)]
                const todaysClasses = relevantSchedule.filter(s => s.day_of_week === dayName)

                for (const cls of todaysClasses) {
                    // Try to get context from latest lesson plan
                    let latestPlan = null
                    if (cls.group_id && cls.subject_id) {
                        const { data } = await supabase
                            .from('lesson_plans')
                            .select('title, contents, pda, activities_sequence')
                            .eq('group_id', cls.group_id)
                            .eq('subject_id', cls.subject_id)
                            .order('created_at', { ascending: false })
                            .limit(1)
                            .maybeSingle()
                        latestPlan = data
                    }

                    // Calcular duración en minutos
                    const [startH, startM] = cls.start_time.split(':').map(Number)
                    const [endH, endM] = cls.end_time.split(':').map(Number)
                    const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM)

                    classesToGenerate.push({
                        date: format(day, 'yyyy-MM-dd'),
                        time: cls.start_time,
                        duration: durationMinutes,
                        group: `${cls.group.grade}° "${cls.group.section}"`,
                        subject: cls.subject?.name || cls.custom_subject,
                        topicContext: latestPlan?.title || 'Continuación de programa',
                        pda: Array.isArray(latestPlan?.pda) ? latestPlan.pda[0] : 'No especificado',
                        planningDetail: JSON.stringify(latestPlan?.activities_sequence || []),
                        group_id: cls.group_id,
                        subject_id: cls.subject_id
                    })
                }
            }

            setAffectedClasses(classesToGenerate.map(c => ({ ...c, selected: true })))
            setStep(2)
        } catch (error) {
            console.error('Error fetching classes:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleGenerateActivities = async () => {
        setLoading(true)
        try {
            // Group by day for the AI context, ONLY for selected classes
            const selectedClasses = affectedClasses.filter(c => c.selected)

            if (selectedClasses.length === 0) {
                alert('Por favor selecciona al menos una clase.')
                return
            }

            const daysMap: Record<string, any[]> = {}
            selectedClasses.forEach(c => {
                if (!daysMap[c.date]) daysMap[c.date] = []
                daysMap[c.date].push(c)
            })

            const daysContext = Object.entries(daysMap).map(([date, classes]) => ({
                date,
                classes: classes.map(c => ({
                    time: c.time,
                    duration: c.duration,
                    group: c.group,
                    subject: c.subject,
                    topicContext: c.topicContext,
                    pda: c.pda,
                    planningDetail: c.planningDetail
                }))
            }))

            const generated = await geminiService.generateAbsenceActivities({
                reason,
                days: daysContext
            })

            // Mapear con IDs locales para edición fácil si es necesario
            setGeneratedActivities(generated.map((a: any, i: number) => ({ ...a, id: i })))
            setStep(3)
        } catch (error) {
            console.error('Error generating activities:', error)
            alert('Hubo un error al generar las actividades. Inténtalo de nuevo.')
        } finally {
            setLoading(false)
        }
    }

    const handleSaveFinal = async () => {
        if (!tenant?.id || !profile?.id) {
            alert('Error: No se pudo identificar al usuario o el centro educativo. Por favor, recarga la página.')
            return
        }

        setLoading(true)
        try {
            const dataToInsert = {
                tenant_id: tenant.id,
                profile_id: profile.id,
                start_date: startDate,
                end_date: endDate,
                reason,
                activities: generatedActivities,
                status: 'FINAL'
            }

            console.log('Inserting absence plan:', dataToInsert)

            const { error, data } = await supabase
                .from('absence_plans')
                .insert(dataToInsert)
                .select()

            if (error) {
                console.error('Supabase Error details:', error)
                throw error
            }

            console.log('Save successful:', data)
            onClose()
        } catch (error: any) {
            console.error('Error saving:', error)
            alert(`Error al guardar el plan de ausencia: ${error.message || 'Error desconocido'}`)
        } finally {
            setLoading(false)
        }
    }

    const handlePrintReview = () => {
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

    // Estilos de impresión globales inyectados dinámicamente para AISLAMIENTO TOTAL
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
            <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:shadow-none print:max-h-none print:w-full print:rounded-none print-scroll-none">
                {/* Header */}
                <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/50 to-white">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900">Actividades por <span className="text-indigo-600">Ausencia</span></h2>
                            <p className="text-sm font-medium text-slate-500">
                                Paso {step} de 3: {
                                    step === 1 ? 'Periodo y Motivo' :
                                        step === 2 ? 'Confirmar Clases' :
                                            'Revisar Sugerencias'
                                }
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 no-print">
                        {step === 3 && (
                            <button
                                onClick={handlePrintReview}
                                title="Imprimir Sugerencias"
                                className="p-3 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all flex items-center gap-2 font-black text-[10px] uppercase tracking-widest"
                            >
                                <Printer className="w-5 h-5" />
                                <span className="hidden sm:inline">Imprimir</span>
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-8 overflow-y-auto flex-1">
                    {step === 1 ? (
                        <div className="space-y-8">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha de Inicio</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-indigo-600 transition-all cursor-pointer"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha de Fin</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-indigo-600 transition-all cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Motivo de la Ausencia</label>
                                    <select
                                        value={isCustomReason ? 'Otros' : (REASON_OPTIONS.includes(reason) ? reason : '')}
                                        onChange={(e) => {
                                            const val = e.target.value
                                            if (val === 'Otros') {
                                                setIsCustomReason(true)
                                                setReason('')
                                            } else {
                                                setIsCustomReason(false)
                                                setReason(val)
                                            }
                                        }}
                                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-indigo-600 transition-all cursor-pointer"
                                    >
                                        <option value="" disabled>Selecciona un motivo...</option>
                                        {REASON_OPTIONS.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                </div>

                                {(isCustomReason || (!REASON_OPTIONS.includes(reason) && reason !== '')) && (
                                    <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Detalles del Motivo</label>
                                        <textarea
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                            placeholder="Describa el motivo o proporcione detalles adicionales..."
                                            className="w-full p-6 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-indigo-600 transition-all resize-none h-32"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100 flex gap-4">
                                <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
                                <p className="text-sm font-medium text-amber-800 leading-relaxed">
                                    El sistema detectará automáticamente tus clases programadas en este rango y generará
                                    instrucciones fáciles de explicar basadas en tu última planeación.
                                </p>
                            </div>
                        </div>
                    ) : step === 2 ? (
                        <div className="space-y-6">
                            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                                Clases que serán atendidas:
                            </h3>
                            <div className="grid grid-cols-1 gap-3">
                                {affectedClasses.length === 0 ? (
                                    <div className="p-10 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No se encontraron clases en tu horario para estas fechas.</p>
                                    </div>
                                ) : (
                                    affectedClasses.map((cls, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => {
                                                const newClasses = [...affectedClasses]
                                                newClasses[idx].selected = !newClasses[idx].selected
                                                setAffectedClasses(newClasses)
                                            }}
                                            className={`
                                                relative border-2 p-5 rounded-3xl transition-all cursor-pointer group
                                                ${cls.selected
                                                    ? 'bg-white border-indigo-600 shadow-xl shadow-indigo-100/50'
                                                    : 'bg-slate-50 border-transparent opacity-60 hover:opacity-100 hover:border-slate-200'}
                                            `}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${cls.selected ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                                                            {cls.date}
                                                        </span>
                                                        <span className="text-[10px] font-black bg-slate-50 text-slate-500 px-2 py-0.5 rounded-full uppercase">{cls.time}</span>
                                                        <span className="text-[10px] font-black bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full uppercase">{cls.duration} min</span>
                                                    </div>
                                                    <h4 className="font-black text-slate-900">{cls.group} - {cls.subject}</h4>

                                                    {cls.planningDetail === '[]' ? (
                                                        <div className="flex items-center gap-2 mt-2 text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl w-fit">
                                                            <AlertCircle className="w-4 h-4" />
                                                            <span className="text-[10px] font-bold">SIN PLANEACIÓN VINCULADA</span>
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs font-medium text-slate-500 italic mt-1 flex items-center gap-1">
                                                            <Sparkles className="w-3 h-3 text-indigo-400" />
                                                            Ref: {cls.topicContext}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className={`
                                                    w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all
                                                    ${cls.selected
                                                        ? 'bg-indigo-600 border-indigo-600 text-white scale-110'
                                                        : 'bg-white border-slate-200 text-transparent'}
                                                `}>
                                                    <CheckCircle2 className="w-5 h-5" />
                                                </div>
                                            </div>

                                            {cls.selected && cls.planningDetail === '[]' && (
                                                <p className="mt-3 text-[10px] font-medium text-rose-500 leading-tight">
                                                    * La IA generará una actividad genérica al no encontrar una secuencia didáctica para este grupo.
                                                </p>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>

                            {affectedClasses.some(c => c.selected && c.planningDetail === '[]') && (
                                <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex gap-3 items-start animate-in fade-in slide-in-from-bottom-2">
                                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-1">¡Atención!</p>
                                        <p className="text-[11px] font-medium text-rose-700 leading-relaxed">
                                            Has seleccionado grupos sin planeación previa. Las actividades para estos grupos se basarán únicamente en el nombre de la materia y serán de carácter general.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <Sparkles className="w-5 h-5 text-indigo-600" />
                                    <p className="text-sm font-bold text-indigo-900">Propuestas generadas por IA</p>
                                </div>
                                <button
                                    onClick={handleGenerateActivities}
                                    disabled={loading}
                                    className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline disabled:opacity-50"
                                >
                                    {loading ? 'Regenerando...' : 'Regenerar Todo'}
                                </button>
                            </div>

                            <div className="space-y-4">
                                {generatedActivities.map((act, idx) => (
                                    <div key={idx} className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm activity-card print:border-none print:shadow-none">
                                        <div className="flex items-center justify-between mb-4 card-header">
                                            <div className="flex flex-col header-info-item">
                                                <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full w-fit mb-1 no-print">{act.group} • {act.subject}</span>
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
                                                <span className="text-[10px] font-bold text-slate-400 ml-1 no-print">{act.date} • {act.time}</span>
                                            </div>
                                            <div className="text-right no-print">
                                                <div className="text-[10px] font-black text-amber-600 uppercase tracking-tighter">Duración Sugerida</div>
                                                <div className="text-sm font-black text-slate-700">{act.duration || '--'} min</div>
                                            </div>
                                        </div>

                                        <div className="mb-4 section-box print:mb-8">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 no-print">Proyecto / Actividad Central</label>
                                            <div className="hidden print:block">
                                                <span className="section-label">Actividad Principal:</span>
                                                <span className="text-lg font-bold">{act.title}</span>
                                            </div>
                                            <input
                                                value={act.title}
                                                onChange={(e) => {
                                                    const newActs = [...generatedActivities]
                                                    newActs[idx].title = e.target.value
                                                    setGeneratedActivities(newActs)
                                                }}
                                                className="w-full text-lg font-black text-slate-900 border-none bg-slate-50 px-4 py-3 rounded-xl focus:ring-2 focus:ring-indigo-100 no-print"
                                                placeholder="Título de la actividad"
                                            />
                                        </div>

                                        <div className="space-y-4 print:space-y-8">
                                            <div className="section-box">
                                                <div className="flex items-center gap-2 text-amber-600 mb-2 no-print">
                                                    <User className="w-4 h-4" />
                                                    <label className="text-[10px] font-black uppercase tracking-widest">Instrucciones Suplente</label>
                                                </div>
                                                <span className="hidden print:block section-label">Instrucciones para la Guardia:</span>
                                                <p className="hidden print:block section-content">{safeRenderText(act.instructions_for_substitute)}</p>
                                                <textarea
                                                    value={safeRenderText(act.instructions_for_substitute)}
                                                    onChange={(e) => {
                                                        const newActs = [...generatedActivities]
                                                        newActs[idx].instructions_for_substitute = e.target.value
                                                        setGeneratedActivities(newActs)
                                                    }}
                                                    className="w-full h-24 p-4 bg-slate-50 border-none rounded-xl text-sm font-medium text-slate-600 resize-none focus:ring-2 focus:ring-indigo-100 no-print"
                                                />
                                            </div>

                                            <div className="section-box">
                                                <div className="flex items-center gap-2 text-indigo-600 mb-2 no-print">
                                                    <BookOpen className="w-4 h-4" />
                                                    <label className="text-[10px] font-black uppercase tracking-widest">Actividad Alumno</label>
                                                </div>
                                                <span className="hidden print:block section-label">Trabajo del Estudiante:</span>
                                                <p className="hidden print:block section-content">{safeRenderText(act.student_work)}</p>
                                                <textarea
                                                    value={safeRenderText(act.student_work)}
                                                    onChange={(e) => {
                                                        const newActs = [...generatedActivities]
                                                        newActs[idx].student_work = e.target.value
                                                        setGeneratedActivities(newActs)
                                                    }}
                                                    className="w-full h-24 p-4 bg-slate-50 border-none rounded-xl text-sm font-medium text-slate-600 resize-none focus:ring-2 focus:ring-indigo-100 no-print"
                                                />
                                            </div>

                                            {act.printable_resource && (
                                                <div className="bg-amber-50/50 border border-amber-100 p-6 rounded-2xl space-y-4 printable-box">
                                                    <div className="flex items-center justify-between no-print">
                                                        <div className="flex items-center gap-2 text-amber-700">
                                                            <FileText className="w-4 h-4" />
                                                            <span className="text-[10px] font-black uppercase tracking-widest">Recurso Imprimible ({act.printable_resource.type})</span>
                                                        </div>
                                                    </div>
                                                    <h5 className="hidden print:block resource-header">{act.printable_resource.title}</h5>
                                                    <input
                                                        value={act.printable_resource.title}
                                                        onChange={(e) => {
                                                            const newActs = [...generatedActivities]
                                                            newActs[idx].printable_resource.title = e.target.value
                                                            setGeneratedActivities(newActs)
                                                        }}
                                                        className="w-full bg-white/50 border-none rounded-lg px-3 py-1.5 text-sm font-bold text-slate-700 focus:ring-1 focus:ring-amber-200 no-print"
                                                        placeholder="Título del recurso..."
                                                    />
                                                    <p className="hidden print:block section-content italic">{safeRenderText(act.printable_resource.content)}</p>
                                                    <textarea
                                                        value={safeRenderText(act.printable_resource.content)}
                                                        onChange={(e) => {
                                                            const newActs = [...generatedActivities]
                                                            newActs[idx].printable_resource.content = e.target.value
                                                            setGeneratedActivities(newActs)
                                                        }}
                                                        className="w-full h-32 p-4 bg-white/50 border-none rounded-xl text-sm font-medium text-slate-600 resize-none focus:ring-1 focus:ring-amber-200 no-print"
                                                        placeholder="Contenido del recurso para imprimir..."
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between no-print">
                                            <div className="flex items-center gap-2 text-slate-400">
                                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Producto a Entregar</span>
                                            </div>
                                            <input
                                                value={act.final_product}
                                                onChange={(e) => {
                                                    const newActs = [...generatedActivities]
                                                    newActs[idx].final_product = e.target.value
                                                    setGeneratedActivities(newActs)
                                                }}
                                                className="text-right text-xs font-black text-slate-700 border-none bg-slate-50 px-3 py-1 rounded-lg"
                                            />
                                        </div>
                                        <div className="hidden print:block mt-8">
                                            <span className="header-label">PRODUCTO ESPERADO:</span>
                                            <span className="block text-sm font-bold product-tag">{act.final_product}</span>
                                            <p className="mt-8 text-[8px] italic opacity-50">Generado con IA • Sistema de Gestión Escolar • Docente: {profile?.full_name}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-4">
                    <button
                        onClick={step === 1 ? onClose : () => setStep(step - 1)}
                        className="px-8 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition-all font-sans"
                    >
                        {step === 1 ? 'Cancelar' : 'Atrás'}
                    </button>
                    <button
                        onClick={
                            step === 1 ? handlePreviewClasses :
                                step === 2 ? handleGenerateActivities :
                                    handleSaveFinal
                        }
                        disabled={loading || (step === 2 && affectedClasses.length === 0)}
                        className="flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-10 py-4 rounded-2xl font-bold shadow-xl shadow-indigo-100 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                        {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                        {
                            step === 1 ? 'Siguiente' :
                                step === 2 ? 'Generar Sugerencias IA' :
                                    'Guardar y Finalizar'
                        }
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
