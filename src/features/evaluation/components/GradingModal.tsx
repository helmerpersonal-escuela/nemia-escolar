
import { useState, useEffect } from 'react'
import { X, Save, AlertCircle, CheckCircle2, Pencil, Trash2, ClipboardCheck, LayoutList, Calendar, ChevronDown, ChevronRight, Printer } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { useOfflineSync } from '../../../hooks/useOfflineSync'

type GradingModalProps = {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    student: any
    criterion: any
    assignments: any[]
    currentGrades: any[]
    groupId: string
    onEdit?: (assignment: any) => void
    onDelete?: (assignmentId: string) => void
}

export const GradingModal = ({
    isOpen,
    onClose,
    onSuccess,
    student,
    criterion,
    assignments,
    currentGrades,
    groupId,
    onEdit,
    onDelete
}: GradingModalProps) => {
    const { data: tenant } = useTenant()
    const { isOnline, addToQueue } = useOfflineSync()
    const [isLoading, setIsLoading] = useState(false)
    const [grades, setGrades] = useState<Record<string, { score: string, feedback: string }>>({})
    const [changed, setChanged] = useState<Record<string, boolean>>({})
    const [instruments, setInstruments] = useState<Record<string, any>>({})
    const [loadingInstruments, setLoadingInstruments] = useState(false)
    const [rubricSelections, setRubricSelections] = useState<Record<string, Record<number, number>>>({})
    const [expandedId, setExpandedId] = useState<string | null>(null)

    useEffect(() => {
        if (isOpen && assignments.length > 0) {
            const initialGrades: Record<string, { score: string, feedback: string }> = {}
            assignments.forEach(asm => {
                const existing = currentGrades?.find(g => g.assignment_id === asm.id)
                initialGrades[asm.id] = {
                    score: existing?.score?.toString() || '',
                    feedback: existing?.feedback || ''
                }
            })
            setGrades(initialGrades)
            setChanged({}) // Reset on open
            setRubricSelections({})
            setExpandedId(null) // Ensure nothing is expanded by default
            fetchInstruments(assignments)
        }
    }, [isOpen, student.id, criterion.id]) // Stable dependencies

    const fetchInstruments = async (asms: any[]) => {
        const ids = asms.map(a => a.instrument_id).filter(Boolean)
        if (ids.length === 0) return

        setLoadingInstruments(true)
        try {
            const { data, error } = await supabase
                .from('rubrics')
                .select('*')
                .in('id', ids)

            if (error) throw error

            const map: Record<string, any> = {}
            data.forEach(r => { map[r.id] = r })
            setInstruments(map)
        } catch (err) {
            console.error('Error fetching instruments:', err)
        } finally {
            setLoadingInstruments(false)
        }
    }

    const handleLevelSelect = (assignmentId: string, criterionIdx: number, scoreValue: number, instrument: any) => {
        const nextSelections = {
            ...rubricSelections,
            [assignmentId]: {
                ...(rubricSelections[assignmentId] || {}),
                [criterionIdx]: scoreValue
            }
        }
        setRubricSelections(nextSelections)

        // Calculate weighted average
        const currentAsmSelections = nextSelections[assignmentId]
        const rubContent = Array.isArray(instrument.content) ? instrument.content : []

        let weightedTotal = 0
        let totalWeight = 0

        rubContent.forEach((crit: any, idx: number) => {
            const weight = crit.percentage || 0
            const selScore = currentAsmSelections[idx]

            if (selScore !== undefined) {
                // Find max possible score for this criterion to normalize to 10 scale
                const maxScore = Array.isArray(crit.levels)
                    ? Math.max(...crit.levels.map((l: any) => l.score || 0))
                    : 10

                const normalizedScore = maxScore > 0 ? (selScore / maxScore) * 10 : 0
                weightedTotal += (normalizedScore * weight) / 100
                totalWeight += weight
            }
        })

        // Normalize if weights don't add to 100 (e.g. user selected 2 of 3 criteria)
        const finalScore = totalWeight > 0 ? (weightedTotal * (100 / totalWeight)) : weightedTotal
        handleScoreChange(assignmentId, finalScore.toFixed(1))
    }

    const handlePrintInstrument = (assignment: any) => {
        const instrument = instruments[assignment.instrument_id]
        if (!instrument) return

        const printWindow = window.open('', '_blank')
        if (!printWindow) return

        const isRubric = (instrument.type === 'ANALYTIC' || instrument.type === 'RUBRIC')
        const content = Array.isArray(instrument.content) ? instrument.content : []

        let tableRows = ''
        if (isRubric) {
            tableRows = content.map((c: any) => `
                <tr>
                    <td style="border: 1px solid #ddd; padding: 12px; font-weight: bold;">${c.name}<br/><small style="font-weight: normal; color: #666;">${c.description || ''}</small></td>
                    <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${c.percentage}%</td>
                    ${c.levels?.map((l: any) => `<td style="border: 1px solid #ddd; padding: 12px; font-size: 11px;"><strong>${l.title} (${l.score})</strong><br/>${l.description || ''}</td>`).join('') || ''}
                </tr>
            `).join('')
        } else {
            tableRows = content.map((c: any) => `
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
                    <title>Instrumento: ${instrument.title}</title>
                    <style>
                        body { font-family: 'Segoe UI', sans-serif; padding: 30px; color: #333; line-height: 1.6; }
                        h1 { color: #1e40af; margin-bottom: 5px; font-size: 24px; }
                        .header-info { margin-bottom: 30px; padding: 15px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
                        .info-item { margin-bottom: 5px; font-size: 14px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; table-layout: fixed; }
                        th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; }
                        td { border: 1px solid #cbd5e1; padding: 12px; vertical-align: top; word-wrap: break-word; }
                        .footer { margin-top: 50px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px; }
                        @media print { .no-print { display: none; } }
                    </style>
                </head>
                <body>
                    <h1>${instrument.title}</h1>
                    <div class="header-info">
                        <div class="info-item"><strong>Alumno:</strong> ${student.first_name} ${student.last_name_paternal} ${student.last_name_maternal}</div>
                        <div class="info-item"><strong>Criterio:</strong> ${criterion.name}</div>
                        <div class="info-item"><strong>Actividad:</strong> ${assignment.title}</div>
                        <div class="info-item"><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-MX')}</div>
                    </div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 30%;">Criterio / Indicador</th>
                                <th style="width: 10%; text-align: center;">Valor</th>
                                ${isRubric ? '<th>Excelente</th><th>Bueno</th><th>Regular</th><th>Insuficiente</th>' : '<th>Cumplimiento</th>'}
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>

                    <div style="margin-top: 40px;">
                        <div style="font-weight: bold; margin-bottom: 15px;">Retroalimentación y Observaciones:</div>
                        <div style="height: 100px; border: 1px solid #cbd5e1; border-radius: 4px;"></div>
                    </div>

                    <div class="footer">Generado por Vunlek - ${new Date().toLocaleDateString()}</div>
                    <script>
                        setTimeout(() => { 
                            window.print(); 
                            window.close(); 
                        }, 500);
                    </script>
                </body>
            </html>
        `)
        printWindow.document.close()
    }

    const handleScoreChange = (assignmentId: string, value: string) => {
        // Allow empty string or numbers
        if (value !== '' && (isNaN(Number(value)) || Number(value) < 0 || Number(value) > 10)) {
            return
        }

        setGrades(prev => ({
            ...prev,
            [assignmentId]: { ...prev[assignmentId], score: value }
        }))
        setChanged(prev => ({ ...prev, [assignmentId]: true }))
    }

    const handleFeedbackChange = (assignmentId: string, value: string) => {
        setGrades(prev => ({
            ...prev,
            [assignmentId]: { ...prev[assignmentId], feedback: value }
        }))
        setChanged(prev => ({ ...prev, [assignmentId]: true }))
    }

    const handleSave = async () => {
        const changedIds = Object.keys(changed)
        if (!tenant?.id || !groupId || changedIds.length === 0) return

        setIsLoading(true)
        try {
            const updates = changedIds.map(assignmentId => {
                const gradeData = grades[assignmentId]
                const score = gradeData.score === '' ? null : Number(gradeData.score)

                return {
                    tenant_id: tenant.id,
                    student_id: student.id,
                    assignment_id: assignmentId,
                    score: score,
                    is_graded: score !== null,
                    feedback: gradeData.feedback,
                    graded_at: new Date().toISOString()
                }
            })

            if (!isOnline) {
                // Queue each grade update individually or as one? 
                // useOfflineSync expects individual data.
                for (const update of updates) {
                    addToQueue({
                        table: 'grades',
                        action: 'UPSERT',
                        data: update
                    })
                }
                alert('Modo Offline: Calificaciones guardadas localmente. Se sincronizarán al recuperar internet.')
                onSuccess()
                onClose()
                return
            }

            const { error } = await supabase
                .from('grades')
                .upsert(updates, { onConflict: 'student_id,assignment_id' })

            if (error) throw error

            onSuccess()
            onClose()
        } catch (error: any) {
            console.error('Error saving grades:', error)
            alert('Error al guardar calificaciones: ' + (error.message || 'Error desconocido'))
        } finally {
            setIsLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-hidden">
            <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[95vh] flex flex-col animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-3xl">
                    <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-black text-xl border-4 border-white shadow-lg">
                            {student.first_name?.[0] || ''}{student.last_name_paternal?.[0] || ''}
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 leading-tight tracking-tight uppercase">
                                Calificar: <span className="text-indigo-600">{criterion.name}</span>
                            </h2>
                            <p className="text-sm text-gray-500 font-bold uppercase tracking-wider">
                                {student.first_name} {student.last_name_paternal} {student.last_name_maternal}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-2xl transition-all">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50/30">
                    {assignments.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100">
                            <AlertCircle className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                            <p className="text-gray-400 font-bold uppercase tracking-widest">No hay actividades asignadas</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {assignments.map(assignment => {
                                const instrument = instruments[assignment.instrument_id]
                                const currentScore = parseFloat(grades[assignment.id]?.score || '0')
                                const selections = rubricSelections[assignment.id] || {}
                                const isExpanded = expandedId === assignment.id

                                return (
                                    <div key={assignment.id} className={`bg-white rounded-[2rem] border transition-all overflow-hidden ${isExpanded ? 'p-8 border-indigo-200 shadow-xl' : 'p-4 border-gray-100 shadow-sm hover:border-indigo-100'}`}>
                                        {/* Header / Clickable Area */}
                                        <div
                                            onClick={() => setExpandedId(isExpanded ? null : assignment.id)}
                                            className="flex justify-between items-center cursor-pointer group/header"
                                        >
                                            <div className="flex items-center gap-4 flex-1">
                                                <div className={`p-2 rounded-xl transition-colors ${isExpanded ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-50 text-gray-400 group-hover/header:bg-indigo-50 group-hover/header:text-indigo-400'}`}>
                                                    {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-3">
                                                        <h4 className={`text-lg font-black tracking-tight uppercase leading-tight transition-colors ${isExpanded ? 'text-gray-900' : 'text-gray-500 group-hover/header:text-gray-700'}`}>
                                                            {assignment.title}
                                                        </h4>

                                                        <div className="flex gap-1">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handlePrintInstrument(assignment); }}
                                                                className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-all font-bold"
                                                                title="Imprimir instrumento"
                                                            >
                                                                <Printer className="w-4 h-4" />
                                                            </button>
                                                            {onEdit && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); onEdit(assignment); }}
                                                                    className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-all font-bold"
                                                                    title="Editar actividad"
                                                                >
                                                                    <Pencil className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                            {onDelete && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (confirm('¿Estás seguro de que deseas eliminar esta actividad? Esta acción no se puede deshacer.')) {
                                                                            onDelete(assignment.id)
                                                                        }
                                                                    }}
                                                                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-all"
                                                                    title="Eliminar actividad"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4 mt-1">
                                                        {!isExpanded && (
                                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                                Haga clic para expandir y calificar
                                                            </p>
                                                        )}
                                                        <div className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                                                            <Calendar className="w-3 h-3" />
                                                            <span>Vence: {new Date(assignment.due_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-6">
                                                <div className="text-right">
                                                    <div className={`text-2xl font-black transition-colors ${isExpanded ? 'text-indigo-600' : (currentScore > 0 ? 'text-indigo-400' : 'text-gray-200')}`}>
                                                        {grades[assignment.id]?.score || '-'}
                                                    </div>
                                                    <div className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">CALIFICACIÓN</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expanded Content */}
                                        {isExpanded && (
                                            <div className="mt-8 animate-in fade-in slide-in-from-top-4 duration-300">
                                                <div className="flex justify-between items-start mb-6 pt-6 border-t border-gray-50">
                                                    <div>
                                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                                            <Calendar className="w-3 h-3" />
                                                            Vence: {new Date(assignment.due_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <div className="relative group/score">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max="10"
                                                                step="0.1"
                                                                value={grades[assignment.id]?.score || ''}
                                                                onChange={(e) => handleScoreChange(assignment.id, e.target.value)}
                                                                className="w-24 bg-indigo-50/50 border-none rounded-2xl py-3 px-4 text-center font-black text-2xl text-indigo-700 focus:ring-4 focus:ring-indigo-100 transition-all"
                                                                placeholder="-"
                                                            />
                                                            <span className="absolute -bottom-5 right-0 text-[10px] font-black text-indigo-300 uppercase tracking-widest text-right w-full">PROMEDIO FINAL</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Rubric Section */}
                                                {instrument && (
                                                    <div className="mt-8 space-y-6 pt-6 border-t border-gray-50">
                                                        <div className="flex items-center gap-2 mb-4">
                                                            <LayoutList className="w-4 h-4 text-indigo-400" />
                                                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Instrumento: {instrument.title}</span>
                                                        </div>

                                                        <div className="space-y-4">
                                                            {(Array.isArray(instrument.content) ? instrument.content : []).map((crit: any, idx: number) => (
                                                                <div key={idx} className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100/50">
                                                                    <div className="flex justify-between items-center mb-4">
                                                                        <span className="text-xs font-black text-gray-700 uppercase tracking-tight">{crit.name}</span>
                                                                        <span className="text-[10px] bg-white px-2 py-1 rounded-md text-slate-400 font-bold border border-slate-100">{crit.percentage}%</span>
                                                                    </div>

                                                                    {((instrument.type === 'ANALYTIC' || instrument.type === 'RUBRIC') && crit.levels) ? (
                                                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                                            {crit.levels.map((lvl: any, lIdx: number) => {
                                                                                const isSelected = selections[idx] === lvl.score;
                                                                                return (
                                                                                    <button
                                                                                        key={lIdx}
                                                                                        onClick={() => handleLevelSelect(assignment.id, idx, lvl.score, instrument)}
                                                                                        className={`text-left p-3 rounded-xl border-2 transition-all ${isSelected
                                                                                            ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-100'
                                                                                            : 'bg-white border-transparent hover:border-indigo-200'
                                                                                            }`}
                                                                                    >
                                                                                        <div className={`text-[9px] font-black uppercase mb-1 ${isSelected ? 'text-white' : 'text-slate-400'}`}>{lvl.title}</div>
                                                                                        <div className={`text-[10px] font-bold leading-tight line-clamp-2 ${isSelected ? 'text-indigo-50' : 'text-gray-600'}`}>
                                                                                            {lvl.description || `${lvl.score} pts`}
                                                                                        </div>
                                                                                    </button>
                                                                                )
                                                                            })}
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex gap-2">
                                                                            <button
                                                                                onClick={() => handleLevelSelect(assignment.id, idx, 10, instrument)}
                                                                                className={`flex-1 p-3 rounded-xl border-2 font-black text-xs transition-all ${selections[idx] === 10 ? 'bg-green-600 border-green-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400'}`}
                                                                            >CUMPLE (10)</button>
                                                                            <button
                                                                                onClick={() => handleLevelSelect(assignment.id, idx, 5, instrument)}
                                                                                className={`flex-1 p-3 rounded-xl border-2 font-black text-xs transition-all ${selections[idx] === 5 ? 'bg-rose-600 border-rose-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400'}`}
                                                                            >NO CUMPLE (5)</button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Feedback Section */}
                                                <div className="mt-8 pt-8 border-t border-gray-50">
                                                    <div className="flex items-center gap-2 mb-4">
                                                        <ClipboardCheck className="w-4 h-4 text-indigo-400" />
                                                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Retroalimentación</span>
                                                    </div>
                                                    <textarea
                                                        placeholder="Retroalimentación para el alumno..."
                                                        value={grades[assignment.id]?.feedback || ''}
                                                        onChange={(e) => handleFeedbackChange(assignment.id, e.target.value)}
                                                        rows={2}
                                                        className="w-full text-sm bg-slate-50/50 border-none rounded-2xl py-4 px-6 focus:ring-4 focus:ring-indigo-100 placeholder-slate-300 font-medium transition-all resize-none"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-gray-100 bg-gray-50/50 rounded-b-3xl flex justify-end items-center gap-4">
                    <button
                        onClick={onClose}
                        className="px-8 py-4 bg-white border border-gray-200 rounded-2xl text-sm font-black text-gray-500 hover:bg-gray-100 transition-all shadow-sm"
                    >
                        CERRAR
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isLoading || Object.keys(changed).length === 0}
                        className="px-10 py-4 bg-slate-900 text-white rounded-2xl text-sm font-black hover:bg-black shadow-2xl shadow-slate-200 disabled:opacity-50 disabled:shadow-none transition-all flex items-center group"
                    >
                        {isLoading ? (
                            <>
                                <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin mr-3" />
                                GUARDANDO...
                            </>
                        ) : (
                            <>
                                <Save className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform" />
                                GUARDAR CAMBIOS {Object.keys(changed).length > 0 && `(${Object.keys(changed).length})`}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
