import { useState, useEffect } from 'react'
import {
    Sparkles,
    Save,
    X,
    ChevronRight,
    Trash2,
    AlertCircle,
    Loader2,
    RefreshCw,
    Edit3,
    Check
} from 'lucide-react'
import { GroqService } from '../../../lib/groq'

interface AIProposalManagerProps {
    isOpen: boolean
    onClose: () => void
    formData: any
    setFormData: (data: any) => void
    groqService: GroqService
    phase: number
}

const FIELDS = [
    { id: 'lenguajes', name: 'Lenguajes', color: 'orange' },
    { id: 'saberes', name: 'Saberes y Pensamiento Científico', color: 'blue' },
    { id: 'etica', name: 'Ética, Naturaleza y Sociedades', color: 'green' },
    { id: 'humano', name: 'De lo Humano y lo Comunitario', color: 'rose' }
]

export const AIProposalManager = ({ isOpen, onClose, formData, setFormData, groqService, phase }: AIProposalManagerProps) => {
    const [activeField, setActiveField] = useState('lenguajes')
    const [isGenerating, setIsGenerating] = useState(false)
    const [localProgram, setLocalProgram] = useState(formData.program_by_fields || {
        lenguajes: [],
        saberes: [],
        etica: [],
        humano: []
    })

    // Ensure state is synced when opened
    useEffect(() => {
        if (isOpen && formData.program_by_fields) {
            setLocalProgram(formData.program_by_fields)
        }
    }, [isOpen, formData.program_by_fields])

    if (!isOpen) return null

    const handleGenerateField = async (fieldId: string) => {
        setIsGenerating(true)
        try {
            const context = {
                grade: formData.school_data.grades || 'General',
                problem: formData.problems[0]?.description || formData.group_diagnosis.problem_situations[0] || 'Problema general',
                diagnosis: formData.group_diagnosis.narrative,
                phase: phase
            }

            // Normalize strings to ignore accents (e.g., Ética -> etica)
            const normalize = (str: string) =>
                str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            // Get field contents from the database-backed catalog
            const fieldContents = formData.syntheticCatalog
                ?.filter((s: any) => normalize(s.field_of_study).includes(normalize(fieldId)))
                .map((s: any) => s.content) || []

            console.log(`[AIProposal] Field: ${fieldId}, Found: ${fieldContents.length} items`);

            if (fieldContents.length === 0) {
                alert('No hay contenidos precargados para este campo formativo en la fase actual.')
                setIsGenerating(false)
                return
            }

            const result = await groqService.generateFieldProposal(context, fieldContents)

            if (result) {
                setLocalProgram((prev: any) => ({
                    ...prev,
                    [fieldId]: result
                }))
            }
        } catch (error) {
            console.error('Error generating field:', error)
            alert('Error al generar este campo. Por favor intenta de nuevo.')
        } finally {
            setIsGenerating(false)
        }
    }

    const handleUpdateItem = (fieldId: string, index: number, key: string, value: any) => {
        setLocalProgram((prev: any) => {
            const newFieldData = [...prev[fieldId]]
            newFieldData[index] = { ...newFieldData[index], [key]: value }
            return { ...prev, [fieldId]: newFieldData }
        })
    }

    const handleRemoveItem = (fieldId: string, index: number) => {
        setLocalProgram((prev: any) => ({
            ...prev,
            [fieldId]: prev[fieldId].filter((_: any, i: number) => i !== index)
        }))
    }

    const handleSaveAndClose = () => {
        setFormData((prev: any) => ({
            ...prev,
            program_by_fields: localProgram
        }))
        onClose()
    }

    const currentItems = localProgram[activeField] || []

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[150] flex items-center justify-center p-4">
            <div className="bg-white rounded-[3rem] w-full max-w-6xl h-[90vh] shadow-2xl border border-white/20 overflow-hidden flex flex-col anime-in fade-in zoom-in duration-300">
                {/* Header */}
                <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-indigo-50/50 to-white">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                            <Sparkles className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 tracking-tighter uppercase">Gestor de Propuesta IA</h2>
                            <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Revisa, edita y complementa tu programa analítico</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-gray-100 rounded-2xl transition-all">
                        <X className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar Tabs */}
                    <div className="w-80 border-r border-gray-100 bg-gray-50/50 p-6 overflow-y-auto">
                        <div className="space-y-3">
                            {FIELDS.map((field) => (
                                <button
                                    key={field.id}
                                    onClick={() => setActiveField(field.id)}
                                    className={`w-full p-5 rounded-3xl text-left transition-all flex items-center justify-between group ${activeField === field.id
                                        ? 'bg-white shadow-xl shadow-gray-200/50 scale-105 border-2 border-indigo-500'
                                        : 'hover:bg-white/60 text-gray-400'
                                        }`}
                                >
                                    <div className="flex flex-col">
                                        <span className={`text-[10px] font-black uppercase tracking-widest mb-1 ${activeField === field.id ? `text-${field.color}-500` : 'text-gray-400'
                                            }`}>
                                            Campo Formativo
                                        </span>
                                        <span className={`text-sm font-black tracking-tight leading-tight ${activeField === field.id ? 'text-gray-900' : 'text-gray-500'
                                            }`}>
                                            {field.name}
                                        </span>
                                    </div>
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${localProgram[field.id]?.length > 0
                                        ? 'bg-green-100 text-green-600'
                                        : 'bg-gray-100 text-gray-400'
                                        }`}>
                                        {localProgram[field.id]?.length > 0 ? <Check className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    </div>
                                </button>
                            ))}
                        </div>

                        <div className="mt-8 p-6 rounded-3xl bg-indigo-600 shadow-xl shadow-indigo-200 text-white">
                            <h4 className="text-sm font-black uppercase tracking-tighter mb-2 italic">¿Cómo funciona?</h4>
                            <p className="text-[11px] font-bold text-white/80 leading-relaxed">
                                Selecciona un campo y genera la propuesta. Puedes editar el texto directamente en las tarjetas de la derecha para personalizar los PDA o la problemática.
                            </p>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 flex flex-col bg-slate-50/50 overflow-hidden">
                        {/* Top Action Bar */}
                        <div className="p-6 bg-white border-b border-gray-100 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${currentItems.length > 0 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                    }`}>
                                    {currentItems.length} Contenidos Generados
                                </span>
                            </div>
                            <button
                                onClick={() => handleGenerateField(activeField)}
                                disabled={isGenerating}
                                className="flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white px-8 py-3 rounded-2xl font-black text-sm transition-all shadow-lg shadow-indigo-100"
                            >
                                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                                {currentItems.length > 0 ? 'Regenerar Todo el Campo' : 'Generar Propuesta IA'}
                            </button>
                        </div>

                        {/* Editable List */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-6">
                            {currentItems.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto opacity-40">
                                    <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center mb-6">
                                        <Sparkles className="w-10 h-10 text-indigo-200" />
                                    </div>
                                    <h3 className="text-xl font-black text-gray-900 uppercase">Sin Contenidos</h3>
                                    <p className="text-sm font-bold text-gray-500 mt-2 tracking-tight">
                                        Haz clic en el botón superior para que la IA sugiera una propuesta basada en tu diagnóstico y problemática.
                                    </p>
                                </div>
                            ) : (
                                currentItems.map((item: any, idx: number) => (
                                    <div key={idx} className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all overflow-hidden group">
                                        <div className="p-6 border-b border-gray-50 flex justify-between items-start bg-gray-50/20">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-indigo-50 shadow-sm">
                                                        Contenido {idx + 1}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-black text-gray-900 leading-tight pr-8 italic">
                                                    {typeof item.content === 'object' ? JSON.stringify(item.content) : (item.content || 'Sin contenido')}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveItem(activeField, idx)}
                                                className="p-2 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                        <div className="p-8 grid grid-cols-2 gap-8">
                                            {/* PDA Edit */}
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                                    <Edit3 className="w-3 h-3" /> Proceso de Desarrollo (PDA)
                                                </label>
                                                <textarea
                                                    value={typeof item.pda === 'object' ? JSON.stringify(item.pda) : (item.pda || '')}
                                                    onChange={(e) => handleUpdateItem(activeField, idx, 'pda', e.target.value)}
                                                    className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl p-4 text-sm font-bold text-gray-700 min-h-[100px] transition-all resize-none"
                                                />
                                            </div>
                                            {/* Problem/Interest Edit */}
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                                    <AlertCircle className="w-3 h-3" /> Problemática / Interés
                                                </label>
                                                <textarea
                                                    value={typeof item.problem === 'object' ? JSON.stringify(item.problem) : (item.problem || '')}
                                                    onChange={(e) => handleUpdateItem(activeField, idx, 'problem', e.target.value)}
                                                    className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl p-4 text-sm font-bold text-gray-700 min-h-[100px] transition-all resize-none"
                                                />
                                            </div>
                                            {/* Guidelines Edit */}
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                                    <Edit3 className="w-3 h-3" /> Orientaciones Didácticas
                                                </label>
                                                <textarea
                                                    value={typeof item.guidelines === 'object' ? JSON.stringify(item.guidelines) : (item.guidelines || '')}
                                                    onChange={(e) => handleUpdateItem(activeField, idx, 'guidelines', e.target.value)}
                                                    className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl p-4 text-sm font-bold text-gray-700 min-h-[100px] transition-all resize-none"
                                                />
                                            </div>
                                            {/* Axes and Duration */}
                                            <div className="grid grid-cols-2 gap-4 items-end">
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Temporalidad (Días)</label>
                                                    <input
                                                        type="number"
                                                        value={item.duration || 10}
                                                        onChange={(e) => handleUpdateItem(activeField, idx, 'duration', e.target.value)}
                                                        className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 text-sm font-black text-gray-900 transition-all"
                                                    />
                                                </div>
                                                <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                                                    <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Ejes sugeridos</span>
                                                    <div className="flex flex-wrap gap-1">
                                                        {Array.isArray(item.axes) ? item.axes.map((axis: any, i: number) => (
                                                            <span key={i} className="text-[9px] font-bold bg-white text-indigo-600 px-2 py-0.5 rounded-md shadow-sm border border-indigo-50">
                                                                {typeof axis === 'object' ? JSON.stringify(axis) : axis}
                                                            </span>
                                                        )) : (
                                                            <span className="text-[9px] font-bold text-gray-400 italic">No asignados</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-8 border-t border-gray-100 bg-white flex justify-end items-center gap-4">
                    <button
                        onClick={onClose}
                        className="px-8 py-4 rounded-2xl text-gray-500 font-black text-sm hover:bg-gray-50 transition-all"
                    >
                        Cancelar cambios
                    </button>
                    <button
                        onClick={handleSaveAndClose}
                        className="flex items-center gap-3 bg-slate-900 hover:bg-black text-white px-10 py-4 rounded-2xl font-black text-sm transition-all shadow-2xl shadow-slate-200"
                    >
                        <Save className="w-5 h-5" />
                        Guardar Propuesta y Finalizar
                    </button>
                </div>
            </div>
        </div>
    )
}
