import React, { useState, useEffect } from 'react'
import {
    Calendar, Clock, FileText, Trash2, Edit3,
    Printer, ChevronRight, Plus, Search, MessageSquare, AlertCircle
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'

interface ClassPlanListProps {
    tenantId: string
    groupId: string
    subjectId: string
    isSecondary?: boolean
    onEdit: (plan: any) => void
    onOpenGenerator: () => void
    refreshTrigger: number
}

export const ClassPlanList: React.FC<ClassPlanListProps> = ({
    tenantId,
    groupId,
    subjectId,
    isSecondary = false,
    onEdit,
    onOpenGenerator,
    refreshTrigger
}) => {
    const [plans, setPlans] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        loadPlans()
    }, [groupId, subjectId, refreshTrigger])

    const loadPlans = async () => {
        setLoading(true)
        try {
            let query = supabase
                .from('class_plans')
                .select('*')
                .eq('group_id', groupId)

            if (subjectId) {
                query = query.eq('subject_id', subjectId)
            }

            const { data, error } = await query.order('class_date', { ascending: false })

            if (error) throw error
            setPlans(data || [])
        } catch (err) {
            console.error('Error loading class plans:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este plan de clase? Esta acción no se puede deshacer.')) return

        try {
            const { error } = await supabase
                .from('class_plans')
                .delete()
                .eq('id', id)

            if (error) throw error
            setPlans(prev => prev.filter(p => p.id !== id))
        } catch (err) {
            alert('Error al eliminar el plan')
        }
    }

    const handlePrint = (plan: any) => {
        const printWindow = window.open('', '_blank')
        if (!printWindow) return

        const lp = plan.ai_generated_content
        const content = `
            <html>
            <head>
                <title>Ficha de Clase - ${plan.class_date}</title>
                <style>
                    body { font-family: 'Inter', sans-serif; padding: 40px; line-height: 1.6; color: #1e293b; }
                    .header { border-bottom: 3px solid #6366f1; margin-bottom: 30px; padding-bottom: 20px; }
                    h1 { color: #4338ca; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.025em; }
                    .meta { display: grid; grid-template-cols: 1fr 1fr; gap: 15px; margin-bottom: 40px; background: #f8fafc; padding: 25px; border-radius: 12px; border: 1px solid #e2e8f0; }
                    h2 { font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #6366f1; margin-top: 35px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; }
                    .section { margin-bottom: 25px; white-space: pre-wrap; font-size: 14px; color: #334155; }
                    .footer { margin-top: 60px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 20px; font-weight: 600; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Plan de Clase Diario: Mi Plan de Clases</h1>
                    <p style="margin: 5px 0 0 0; color: #64748b; font-weight: 500;">Bitácora de Sesión Individual</p>
                </div>
                <div class="meta">
                    <div><strong>Fecha de Sesión:</strong> ${plan.class_date}</div>
                    <div><strong>Duración/Módulo:</strong> ${plan.duration_or_module} ${isSecondary ? 'Modulo(s)' : 'Minutos'}</div>
                </div>

                <h2>Guion Minuto a Minuto</h2>
                <div class="section">${lp.script}</div>

                <h2>Actividades para Alumnos</h2>
                <div class="section">${lp.activities}</div>

                <h2>Preguntas Motivadoras</h2>
                <div class="section">${lp.questions}</div>

                <h2>Evaluación Sugerida</h2>
                <div class="section">${lp.evaluation_instrument}</div>

                <h2>Recursos</h2>
                <div class="section">${lp.resources}</div>

                ${plan.teacher_reflection ? `<h2>Reflexión Final</h2><div class="section">${plan.teacher_reflection}</div>` : ''}

                <div class="footer">Sistema de Gestión Escolar NEM • Ficha Generada con IA</div>
            </body>
            </html>
        `
        printWindow.document.write(content)
        printWindow.document.close()
        printWindow.print()
    }

    const filteredPlans = plans.filter(p =>
        p.class_date.includes(searchTerm) ||
        p.ai_generated_content.script.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (loading) return <div className="p-12 text-center text-slate-500 font-bold uppercase tracking-widest text-[11px]">Cargando bitácora de clases...</div>

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-amber-500 rounded-full"></div>
                    <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Bitácora de Clases (Fichas)</h3>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[11px] font-bold">{plans.length}</span>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                        <input
                            type="text"
                            placeholder="BUSCAR POR FECHA..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input-squishy pl-9 pr-4 py-2 text-[11px] font-black w-full md:w-48 placeholder:text-slate-300"
                        />
                    </div>
                </div>
            </div>

            {plans.length === 0 ? (
                <div className="p-12 bg-white rounded-[2rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="p-4 bg-slate-50 rounded-2xl text-slate-300">
                        <FileText className="w-10 h-10" />
                    </div>
                    <div>
                        <h4 className="font-black text-slate-800 uppercase tracking-tight">No hay planes de clase guardados</h4>
                        <p className="text-xs text-slate-500 max-w-xs mt-1">Usa el botón "Plan de Clase" para construir tu primera sesión guiada por IA.</p>
                    </div>
                    <button
                        onClick={onOpenGenerator}
                        className="px-6 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl font-black uppercase text-[11px] tracking-widest hover:bg-indigo-100 transition-all flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Comenzar Ahora
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredPlans.map(plan => (
                        <div key={plan.id} className="squishy-card p-6 bg-white border-none shadow-xl shadow-slate-100 group/card hover:scale-[1.02] transition-all">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl group-hover/card:bg-indigo-600 group-hover/card:text-white transition-all">
                                        <Calendar className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Sesión</p>
                                        <h4 className="font-black text-slate-900 tracking-tight">{plan.class_date}</h4>
                                    </div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => onEdit(plan)}
                                        className="p-2 bg-slate-50 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                        title="Editar"
                                    >
                                        <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handlePrint(plan)}
                                        className="p-2 bg-slate-50 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                                        title="Imprimir"
                                    >
                                        <Printer className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(plan.id)}
                                        className="p-2 bg-slate-50 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                        title="Eliminar"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <Clock className="w-3.5 h-3.5 text-slate-300 mt-1 shrink-0" />
                                    <p className="text-xs text-slate-600 font-medium">
                                        <span className="font-black text-slate-500 uppercase mr-1">Duración:</span>
                                        {plan.duration_or_module} {isSecondary ? 'Modulo(s)' : 'Minutos'}
                                    </p>
                                </div>

                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 line-clamp-3">
                                    <p className="text-[11px] text-slate-500 font-medium italic leading-relaxed">
                                        {plan.ai_generated_content.script.substring(0, 150)}...
                                    </p>
                                </div>

                                {plan.teacher_reflection ? (
                                    <div className="flex items-start gap-3 p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                                        <MessageSquare className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                                        <div className="flex-1">
                                            <p className="text-[11px] font-black text-amber-700 uppercase tracking-widest mb-0.5">Reflexión</p>
                                            <p className="text-[11px] text-amber-700 font-medium line-clamp-2">{plan.teacher_reflection}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-gray-50 rounded-xl border border-dashed border-gray-200 flex items-center gap-2">
                                        <AlertCircle className="w-3.5 h-3.5 text-gray-300" />
                                        <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">Sin reflexión post-clase</span>
                                    </div>
                                )}
                            </div>

                            <div className="mt-6 pt-4 border-t border-slate-50">
                                <button
                                    onClick={() => onEdit(plan)}
                                    className="w-full flex items-center justify-center gap-2 py-2 bg-slate-50 text-slate-500 rounded-xl font-black uppercase text-[11px] tracking-[0.1em] group-hover/card:bg-indigo-50 group-hover/card:text-indigo-600 transition-all border border-transparent group-hover/card:border-indigo-100"
                                >
                                    Abrir Detalle <ChevronRight className="w-3 h-3 group-hover/card:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
