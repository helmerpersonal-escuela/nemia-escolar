
import { useState, useEffect } from 'react'
import { X, Wand2, Loader2, Save, Sparkles, Printer } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { GeminiService } from '../../../lib/gemini'
import { useTenant } from '../../../hooks/useTenant'

// Initialize service for use
const geminiService = new GeminiService('') // Key is handled inside class or env

type AIInstrumentGeneratorProps = {
    isOpen: boolean
    onClose: () => void
    lessonPlanId?: string
    subjectName?: string
    defaultDate?: string
    onInstrumentCreated: (data: {
        instrumentId: string,
        title: string,
        description?: string,
        type?: string,
        location?: 'HOME' | 'SCHOOL'
    }) => void
}

export const AIInstrumentGenerator = ({
    isOpen,
    onClose,
    lessonPlanId,
    subjectName,
    defaultDate,
    onInstrumentCreated
}: AIInstrumentGeneratorProps) => {
    const { data: tenant } = useTenant()
    // State for new workflow
    // Step 1: Context Selection (Activity OR Topic)
    // Step 2: Proposal Selection (AI suggests 3 options)
    // Step 3: Instrument Generation & Edit (Rubric/Checklist)

    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)

    // Context Data
    const [activities, setActivities] = useState<any[]>([])
    const [topics, setTopics] = useState<string[]>([]) // New: Topics/PDA
    const [selectedContext, setSelectedContext] = useState<{ type: 'ACTIVITY' | 'TOPIC', value: any, label: string } | null>(null)

    // Filtering
    const [availableDates, setAvailableDates] = useState<string[]>([])
    const [selectedDate, setSelectedDate] = useState<string>(defaultDate || 'ALL')

    // AI Results
    const [proposals, setProposals] = useState<any[]>([])
    const [selectedProposal, setSelectedProposal] = useState<any>(null)
    const [editedInstrument, setEditedInstrument] = useState<any>(null)
    const [instrumentTitle, setInstrumentTitle] = useState('')

    // Fetch Planning Data
    useEffect(() => {
        if (isOpen && lessonPlanId) {
            setLoading(true)
            const fetchPlan = async () => {
                const { data } = await supabase
                    .from('lesson_plans')
                    .select('activities_sequence, contents, pda')
                    .eq('id', lessonPlanId)
                    .single()

                if (data) {
                    // Extract Activities
                    const extractedActivities: any[] = []
                    const dates = new Set<string>()

                    if (data.activities_sequence) {
                        data.activities_sequence.forEach((session: any, sIdx: number) => {
                            if (session.date) dates.add(session.date)
                            if (session.phases) {
                                session.phases.forEach((phase: any) => {
                                    phase.activities.forEach((actText: string, aIdx: number) => {
                                        if (actText && actText.trim()) {
                                            extractedActivities.push({
                                                id: `${sIdx}-${phase.name}-${aIdx}`,
                                                description: actText,
                                                session: sIdx + 1,
                                                phase: phase.name,
                                                date: session.date
                                            })
                                        }
                                    })
                                })
                            }
                        })
                    }

                    // Extract Topics (Contents & PDA)
                    const extractedTopics: string[] = []
                    if (data.contents && Array.isArray(data.contents)) {
                        extractedTopics.push(...data.contents)
                    }
                    if (data.pda && Array.isArray(data.pda)) {
                        extractedTopics.push(...data.pda)
                    }

                    setActivities(extractedActivities)
                    setTopics([...new Set(extractedTopics)]) // Dedup
                    const sortedDates = Array.from(dates).sort() as string[]
                    setAvailableDates(sortedDates)

                    // If defaultDate provided but not in availableDates, fallback to ALL
                    if (defaultDate && !dates.has(defaultDate)) {
                        setSelectedDate('ALL')
                    }
                }
                setLoading(false)
            }
            fetchPlan()
        }
    }, [isOpen, lessonPlanId, defaultDate])

    const filteredActivities = selectedDate === 'ALL'
        ? activities
        : activities.filter(a => a.date === selectedDate)

    // Handler: Generate Proposals
    const handleGenerateProposals = async () => {
        if (!selectedContext) return
        setLoading(true)
        try {
            const contextText = selectedContext.label
            console.log('[AIInstrumentGenerator] Generating proposals for:', contextText)
            const result = await geminiService.generateAssignmentProposals({
                topic: contextText,
                subject: subjectName
            })
            console.log(`[AIInstrumentGenerator v1.1] Received ${result.length} proposals. Content:`, result)
            setProposals(result)
            console.log('[AIInstrumentGenerator] Changing step to 2...')
            setStep(2)
        } catch (error) {
            console.error('[AIInstrumentGenerator] Error generating proposals:', error)
            alert('Error al generar propuestas.')
        } finally {
            setLoading(false)
        }
    }

    // Handler: Generate Instrument for Selected Proposal
    const handleGenerateInstrument = async (proposal: any) => {
        setLoading(true)
        setSelectedProposal(proposal)
        try {
            console.log('[AIInstrumentGenerator] Generating instrument for proposal:', proposal.title)
            const result = await geminiService.generateInstrument({
                activity: proposal.description,
                subject: subjectName,
                type: proposal.instrumentType === 'CHECKLIST' ? 'CHECKLIST' : 'ANALYTIC'
            })
            console.log('[AIInstrumentGenerator] Instrument generated. Moving to Step 3.')
            setEditedInstrument(result)
            setInstrumentTitle(proposal.title) // Use proposal title as default
            setStep(3)
        } catch (error) {
            console.error('[AIInstrumentGenerator] Error generating instrument:', error)
            alert('Error al generar el instrumento.')
        } finally {
            setLoading(false)
        }
    }

    const handlePrint = () => {
        const printWindow = window.open('', '_blank')
        if (!printWindow) return

        const isRubric = (selectedProposal?.instrumentType || 'RUBRIC') === 'RUBRIC'

        let tableRows = ''
        if (isRubric) {
            tableRows = editedInstrument.map((c: any) => `
                <tr>
                    <td style="border: 1px solid #ddd; padding: 12px; font-weight: bold;">${c.name}<br/><small style="font-weight: normal; color: #666;">${c.description}</small></td>
                    <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${c.percentage}%</td>
                    ${c.levels?.map((l: any) => `<td style="border: 1px solid #ddd; padding: 12px; font-size: 11px;"><strong>${l.title} (${l.score})</strong><br/>${l.description}</td>`).join('') || ''}
                </tr>
            `).join('')
        } else {
            tableRows = editedInstrument.map((c: any) => `
                <tr>
                    <td style="border: 1px solid #ddd; padding: 12px;">${c.name}</td>
                    <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${c.percentage}%</td>
                    <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">[ ] SI / [ ] NO</td>
                </tr>
            `).join('')
        }

        printWindow.document.write(`
            <html>
                <head>
                    <title>Instrumento: ${instrumentTitle}</title>
                    <style>
                        body { font-family: 'Segoe UI', sans-serif; padding: 30px; color: #333; }
                        h1 { color: #1e40af; margin-bottom: 5px; }
                        .subtitle { color: #666; margin-bottom: 20px; font-size: 14px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th { background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; text-align: left; font-size: 12px; }
                        .footer { margin-top: 50px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
                        @media print { .no-print { display: none; } }
                    </style>
                </head>
                <body>
                    <h1>${instrumentTitle}</h1>
                    <div class="subtitle">
                        <strong>Materia:</strong> ${subjectName} | 
                        <strong>Actividad:</strong> ${selectedProposal?.title}
                    </div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 250px;">Criterio / Indicador</th>
                                <th style="width: 80px;">Valor</th>
                                ${isRubric ? '<th>Excelente</th><th>Bueno</th><th>Regular</th><th>Insuficiente</th>' : '<th>Cumplimiento</th>'}
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>

                    <div class="footer">Generado por Asistente IA NEMIA - ${new Date().toLocaleDateString()}</div>
                    <script>setTimeout(() => { window.print(); window.close(); }, 500);</script>
                </body>
            </html>
        `)
        printWindow.document.close()
    }

    // Handler: Save Final
    const handleSave = async () => {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('No user found')

            // 1. Save Instrument
            const instrumentType = selectedProposal?.instrumentType === 'CHECKLIST' ? 'CHECKLIST' : 'ANALYTIC'

            console.log('[AIInstrumentGenerator] Saving instrument:', {
                title: instrumentTitle,
                type: instrumentType,
                tenant_id: tenant?.id
            })

            const { data: rubricData, error: rubricError } = await supabase.from('rubrics').insert({
                title: instrumentTitle,
                description: `Instrumento para: ${selectedProposal?.title}`,
                type: instrumentType,
                content: editedInstrument,
                tenant_id: tenant?.id,
                is_ai_generated: true
            }).select().single()

            if (!rubricData) throw new Error('No se recibió confirmación del servidor al crear el instrumento');

            console.log('[AIInstrumentGenerator] Instrument saved successfully:', rubricData.id)

            onInstrumentCreated({
                instrumentId: rubricData.id,
                title: instrumentTitle,
                description: selectedProposal?.description,
                type: selectedProposal?.type,
                location: selectedProposal?.location
            })

            onClose()
        } catch (err: any) {
            console.error('Error saving:', err)
            alert('Error al guardar: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-50/50">
                    <div className="flex items-center space-x-3">
                        <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                            <Wand2 className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Asistente IA de Actividades</h2>
                            <div className="flex items-center space-x-2 mt-1">
                                <span className={`h-1.5 w-6 rounded-full ${step >= 1 ? 'bg-indigo-600' : 'bg-gray-200'}`}></span>
                                <span className={`h-1.5 w-6 rounded-full ${step >= 2 ? 'bg-indigo-600' : 'bg-gray-200'}`}></span>
                                <span className={`h-1.5 w-6 rounded-full ${step >= 3 ? 'bg-indigo-600' : 'bg-gray-200'}`}></span>
                                <span className="text-[10px] text-gray-400 font-bold uppercase ml-2">Paso {step} de 3</span>
                                {geminiService.isFallingBack && (
                                    <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full ml-2 animate-pulse">
                                        Modo Alta Disponibilidad (Groq)
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 p-2">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">

                    {/* STEP 1: CONTEXT SELECTION */}
                    {step === 1 && (
                        <div className="space-y-6 max-w-4xl mx-auto">
                            <div className="text-center mb-8">
                                <h3 className="text-xl font-bold text-gray-800">1. ¿Qué quieres evaluar?</h3>
                                <p className="text-gray-500 text-sm">Selecciona un tema global o una actividad específica de tu planeación.</p>
                            </div>

                            {/* Topics Section */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center">
                                    <Sparkles className="w-4 h-4 mr-2 text-purple-500" />
                                    Temas y Contenidos
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {topics.length > 0 ? topics.map((topic, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setSelectedContext({ type: 'TOPIC', value: topic, label: topic })}
                                            className={`px-4 py-2 rounded-lg text-sm transition-all text-left border
                                                ${selectedContext?.value === topic
                                                    ? 'bg-purple-100 text-purple-800 border-purple-300 ring-2 ring-purple-200'
                                                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}
                                            `}
                                        >
                                            {topic}
                                        </button>
                                    )) : (
                                        <p className="text-sm text-gray-400 italic">No se detectaron temas explícitos.</p>
                                    )}
                                </div>
                            </div>

                            {/* Activities Section */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center justify-between">
                                    <span>Actividades Diarias</span>
                                    {/* Date Filters */}
                                    <div className="flex space-x-1">
                                        <button
                                            onClick={() => setSelectedDate('ALL')}
                                            className={`px-2 py-1 text-xs rounded ${selectedDate === 'ALL' ? 'bg-indigo-100 text-indigo-700 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}
                                        >
                                            Todas
                                        </button>
                                        {availableDates.map(d => (
                                            <button
                                                key={d}
                                                onClick={() => setSelectedDate(d)}
                                                className={`px-2 py-1 text-xs rounded ${selectedDate === d ? 'bg-indigo-100 text-indigo-700 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}
                                            >
                                                {formatDate(d)}
                                            </button>
                                        ))}
                                    </div>
                                </h4>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2">
                                    {filteredActivities.map(act => (
                                        <button
                                            key={act.id}
                                            onClick={() => setSelectedContext({ type: 'ACTIVITY', value: act, label: act.description })}
                                            className={`p-3 rounded-lg border text-left transition-all text-sm
                                                ${selectedContext?.value === act
                                                    ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-100'
                                                    : 'bg-white border-gray-200 hover:border-indigo-200'}
                                            `}
                                        >
                                            <div className="font-medium text-gray-800 mb-1 line-clamp-2">{act.description}</div>
                                            <div className="flex justify-between text-xs text-gray-400">
                                                <span>Sesión {act.session}</span>
                                                <span>{act.date ? formatDate(act.date) : ''}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: PROPOSALS */}
                    {step === 2 && (
                        <div className="space-y-6">
                            <div className="text-center mb-6">
                                <h3 className="text-xl font-bold text-gray-800">2. Elige una Propuesta</h3>
                                <p className="text-gray-500 text-sm">La IA ha diseñado estas actividades basándose en: <span className="font-bold text-indigo-600">"{selectedContext?.label}"</span></p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {proposals.length === 0 && !loading && (
                                    <div className="col-span-full py-12 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                                        <div className="text-gray-400 font-medium mb-2">No se pudieron generar propuestas.</div>
                                        <button
                                            onClick={handleGenerateProposals}
                                            className="text-indigo-600 font-bold hover:underline"
                                        >
                                            Intentar de nuevo
                                        </button>
                                    </div>
                                )}
                                {proposals.map((prop, idx) => (
                                    <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all flex flex-col overflow-hidden group">
                                        <div className={`h-2 w-full ${prop.type === 'HOMEWORK' ? 'bg-blue-500' : prop.type === 'PROJECT' ? 'bg-purple-500' : 'bg-green-500'}`}></div>
                                        <div className="p-6 flex-1 flex flex-col">
                                            <div className="flex justify-between items-start mb-3">
                                                <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide
                                                    ${prop.type === 'HOMEWORK' ? 'bg-blue-50 text-blue-600' : prop.type === 'PROJECT' ? 'bg-purple-50 text-purple-600' : 'bg-green-50 text-green-600'}
                                                 `}>
                                                    {prop.type === 'HOMEWORK' ? 'Tarea' : prop.type === 'PROJECT' ? 'Proyecto' : 'Clase'}
                                                </span>
                                                <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded flex items-center">
                                                    {prop.location === 'HOME' ? '🏠 Casa' : '🏫 Aula'}
                                                </span>
                                            </div>
                                            <h4 className="font-bold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">{prop.title}</h4>
                                            <p className="text-sm text-gray-600 mb-4 flex-1">{prop.description}</p>

                                            <div className="pt-4 border-t border-gray-100 mt-auto">
                                                <div className="text-xs text-gray-500 mb-3">
                                                    Instrumento: <span className="font-semibold text-gray-700">{prop.instrumentType === 'CHECKLIST' ? 'Lista de Cotejo' : 'Rúbrica'}</span>
                                                </div>
                                                <button
                                                    onClick={() => handleGenerateInstrument(prop)}
                                                    className="w-full py-2 bg-gray-50 hover:bg-indigo-50 text-gray-600 hover:text-indigo-600 font-bold rounded-lg border border-gray-200 hover:border-indigo-200 transition-colors text-sm"
                                                >
                                                    Seleccionar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* STEP 3: REVIEW & SAVE */}
                    {step === 3 && editedInstrument && (
                        <div className="space-y-6 max-w-4xl mx-auto">
                            <div className="text-center mb-6">
                                <h3 className="text-xl font-bold text-gray-800">3. Revisa y Confirma</h3>
                                <p className="text-gray-500 text-sm">Hemos generado el instrumento de evaluación. Puedes editar el título e imprimirlo.</p>
                            </div>

                            <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
                                <div className="mb-4 flex justify-between items-end">
                                    <div className="flex-1 mr-4">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Título de la Actividad</label>
                                        <input
                                            type="text"
                                            value={instrumentTitle}
                                            onChange={e => setInstrumentTitle(e.target.value)}
                                            className="w-full text-lg font-bold border-b border-gray-300 focus:border-indigo-500 focus:outline-none py-1"
                                        />
                                    </div>
                                    <button
                                        onClick={handlePrint}
                                        className="mb-1 p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors flex items-center text-xs font-bold"
                                    >
                                        <Printer className="w-4 h-4 mr-2" />
                                        Imprimir
                                    </button>
                                </div>
                                <div className="h-[350px] overflow-y-auto pr-2">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50 text-left border-y border-gray-200">
                                                <th className="p-3 text-[10px] font-bold text-gray-500 uppercase">Criterio</th>
                                                <th className="p-3 text-[10px] font-bold text-gray-500 uppercase w-20 text-center">Valor %</th>
                                                <th className="p-3 text-[10px] font-bold text-gray-500 uppercase">Descripción Niveles</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {editedInstrument.map((criterion: any, cIdx: number) => (
                                                <tr key={cIdx} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="p-3 align-top">
                                                        <input
                                                            className="w-full font-bold text-gray-800 bg-transparent mb-1 focus:ring-1 focus:ring-indigo-100 rounded"
                                                            value={criterion.name}
                                                            onChange={e => {
                                                                const next = [...editedInstrument]
                                                                next[cIdx].name = e.target.value
                                                                setEditedInstrument(next)
                                                            }}
                                                        />
                                                        <textarea
                                                            className="w-full text-[11px] text-gray-500 bg-transparent resize-none h-12 border-none p-0 focus:ring-0"
                                                            value={criterion.description}
                                                            onChange={e => {
                                                                const next = [...editedInstrument]
                                                                next[cIdx].description = e.target.value
                                                                setEditedInstrument(next)
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="p-3 align-top text-center">
                                                        <input
                                                            type="number"
                                                            className="w-14 text-center font-bold text-indigo-600 bg-gray-50 rounded p-1"
                                                            value={criterion.percentage}
                                                            onChange={e => {
                                                                const next = [...editedInstrument]
                                                                next[cIdx].percentage = parseInt(e.target.value) || 0
                                                                setEditedInstrument(next)
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="p-3 align-top">
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {(criterion.levels || []).map((lvl: any, lIdx: number) => (
                                                                <div key={lIdx} className="bg-white border border-gray-100 p-2 rounded text-[10px]">
                                                                    <div className="font-bold flex justify-between mb-1">
                                                                        <span>{lvl.title}</span>
                                                                        <span className="text-gray-400">Pts: {lvl.score}</span>
                                                                    </div>
                                                                    <p className="text-gray-500 line-clamp-3">{lvl.description}</p>
                                                                </div>
                                                            ))}
                                                            {!criterion.levels && (
                                                                <div className="col-span-2 text-[10px] text-gray-400 italic">
                                                                    Lista de cotejo (Si/No)
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="p-3 bg-indigo-50/50 rounded-b-xl border-t border-gray-100 flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-indigo-700">Total: {editedInstrument.reduce((acc: number, cur: any) => acc + (cur.percentage || 0), 0)}%</span>
                                    <span className="text-[10px] text-gray-400 italic">Puedes editar los nombres y porcentajes directamente</span>
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-white flex justify-end space-x-3">
                    {step === 1 && (
                        <button
                            onClick={handleGenerateProposals}
                            disabled={!selectedContext || loading}
                            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center shadow-lg shadow-indigo-200"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Wand2 className="w-5 h-5 mr-2" />}
                            Generar Propuestas
                        </button>
                    )}
                    {step === 2 && (
                        <button onClick={() => setStep(1)} className="px-5 py-3 rounded-lg text-gray-600 font-bold hover:bg-gray-100">Atrás</button>
                    )}
                    {step === 3 && (
                        <>
                            <button onClick={() => setStep(2)} className="px-5 py-3 rounded-lg text-gray-600 font-bold hover:bg-gray-100">Atrás</button>
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-green-700 shadow-lg shadow-green-200 flex items-center"
                            >
                                {loading ? 'Guardando...' : (
                                    <>
                                        <Save className="w-5 h-5 mr-2" />
                                        Crear Tarea
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

// Helper
const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    try {
        const [year, month, day] = dateStr.split('-')
        return `${day}/${month}/${year}`
    } catch { return dateStr }
}
