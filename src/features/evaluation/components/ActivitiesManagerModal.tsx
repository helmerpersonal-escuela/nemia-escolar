
import { X, Pencil, Trash2, Mic, Calendar, LayoutList, AlertCircle, Search, Sparkles, Loader2 } from 'lucide-react'
import { useState } from 'react'

type ActivitiesManagerModalProps = {
    isOpen: boolean
    onClose: () => void
    assignments: any[]
    onEdit: (assignment: any) => void
    onDelete: (assignmentId: string) => void
    onDictate: (assignment: any) => void
    onEnrich: (assignment: any) => Promise<void>
}

export const ActivitiesManagerModal = ({
    isOpen,
    onClose,
    assignments,
    onEdit,
    onDelete,
    onDictate,
    onEnrich
}: ActivitiesManagerModalProps) => {
    const [searchTerm, setSearchTerm] = useState('')
    const [enrichingId, setEnrichingId] = useState<string | null>(null)

    if (!isOpen) return null

    const filteredAssignments = assignments.filter(a =>
        a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.description?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-hidden animate-in fade-in duration-300">
            <div className="bg-white rounded-[3rem] shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col relative overflow-hidden border-8 border-white animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-8 pb-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-amber-100 rounded-3xl shadow-lg border-2 border-white rotate-[-3deg]">
                            <LayoutList className="w-8 h-8 text-amber-600" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">Gestión de Actividades</h2>
                            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">
                                {assignments.length} misiones encontradas
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 bg-white rounded-2xl shadow-md text-slate-400 hover:text-rose-500 hover:rotate-90 transition-all duration-300 btn-tactile">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="px-8 py-4 bg-white border-b border-slate-50">
                    <div className="relative">
                        <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                        <input
                            type="text"
                            placeholder="BUSCAR ACTIVIDAD..."
                            className="input-squishy w-full pl-12 pr-6 py-3 text-xs font-black uppercase tracking-widest placeholder:text-slate-300"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 pt-4 space-y-4 bg-slate-50/30 custom-scrollbar">
                    {filteredAssignments.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-[2rem] border-4 border-dashed border-slate-100">
                            <AlertCircle className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                            <p className="text-slate-400 font-black uppercase tracking-widest">No se encontraron actividades</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {filteredAssignments.map(assignment => (
                                <div key={assignment.id} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-100">
                                                    {assignment.type || 'ACTIVIDAD'}
                                                </span>
                                                <div className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                    <Calendar className="w-3 h-3" />
                                                    {new Date(assignment.due_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                                                </div>
                                            </div>
                                            <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight leading-tight group-hover:text-indigo-600 transition-colors">
                                                {assignment.title}
                                            </h4>
                                            {assignment.description && (
                                                <p className="text-xs text-slate-400 font-bold mt-2 line-clamp-2 uppercase">
                                                    {assignment.description}
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => onDictate(assignment)}
                                                    className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm flex items-center justify-center group/btn"
                                                    title="Modo Dictado"
                                                >
                                                    <Mic className="w-5 h-5 group-hover/btn:scale-110" />
                                                </button>
                                                <button
                                                    disabled={enrichingId === assignment.id}
                                                    onClick={async () => {
                                                        setEnrichingId(assignment.id)
                                                        try {
                                                            await onEnrich(assignment)
                                                        } finally {
                                                            setEnrichingId(null)
                                                        }
                                                    }}
                                                    className="p-3 bg-amber-50 text-amber-600 rounded-2xl hover:bg-amber-600 hover:text-white transition-all shadow-sm flex items-center justify-center group/btn disabled:opacity-50"
                                                    title="Refuerzo IA (Misión/Entregable/Eval)"
                                                >
                                                    {enrichingId === assignment.id ? (
                                                        <Loader2 className="w-5 h-5 animate-spin" />
                                                    ) : (
                                                        <Sparkles className="w-5 h-5 group-hover/btn:scale-110" />
                                                    )}
                                                </button>
                                            </div>
                                            <div className="h-px bg-slate-50 w-full" />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => onEdit(assignment)}
                                                    className="p-3 bg-slate-50 text-slate-400 hover:bg-amber-50 hover:text-amber-600 rounded-2xl transition-all shadow-sm"
                                                    title="Editar"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (confirm('¿ESTÁS SEGURO? ESTA ACCIÓN NO SE PUEDE DESHACER.')) {
                                                            onDelete(assignment.id)
                                                        }
                                                    }}
                                                    className="p-3 bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-2xl transition-all shadow-sm"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Gestiona tus misiones. Los cambios se sincronizarán inmediatamente.
                    </p>
                </div>
            </div>
        </div>
    )
}
