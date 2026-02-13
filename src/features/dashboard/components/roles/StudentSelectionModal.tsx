
import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useTenant } from '../../../../hooks/useTenant'
import { Search, X, User, ChevronRight, FileText, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface StudentSelectionModalProps {
    isOpen: boolean
    onClose: () => void
}

export const StudentSelectionModal = ({ isOpen, onClose }: StudentSelectionModalProps) => {
    const { data: tenant } = useTenant()
    const navigate = useNavigate()
    const [searchTerm, setSearchTerm] = useState('')
    const [students, setStudents] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (isOpen && tenant?.id) {
            loadStudents()
        }
    }, [isOpen, tenant?.id])

    const loadStudents = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('students')
                .select(`
                    id, first_name, last_name_paternal, last_name_maternal,
                    group:groups(grade, section)
                `)
                .eq('tenant_id', tenant?.id)
                .order('last_name_paternal', { ascending: true })

            if (error) throw error
            setStudents(data || [])
        } catch (err) {
            console.error('Error loading students:', err)
        } finally {
            setLoading(false)
        }
    }

    const filteredStudents = students.filter(student => {
        const fullName = `${student.first_name} ${student.last_name_paternal} ${student.last_name_maternal}`.toLowerCase()
        return fullName.includes(searchTerm.toLowerCase())
    })

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[80vh]">
                {/* Header */}
                <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-indigo-50/50">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Reporte para Padres</h2>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Selecciona un alumno para generar reporte</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400 hover:text-slate-600 shadow-sm"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="p-6 bg-white border-b border-slate-50">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar alumno por nombre..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl text-slate-800 font-bold placeholder:text-slate-400 transition-all outline-none"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Students List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <Loader2 className="w-10 h-10 animate-spin mb-4" />
                            <span className="font-black text-xs uppercase tracking-widest">Cargando Alumnos...</span>
                        </div>
                    ) : filteredStudents.length > 0 ? (
                        filteredStudents.map(student => (
                            <button
                                key={student.id}
                                onClick={() => {
                                    navigate(`/reports/student/${student.id}`)
                                    onClose()
                                }}
                                className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-indigo-50 transition-all group border-2 border-transparent hover:border-indigo-100 text-left"
                            >
                                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-500 text-lg group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                    <User className="w-6 h-6" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-black text-slate-800 group-hover:text-indigo-600 transition-colors leading-tight">
                                        {student.first_name} {student.last_name_paternal} {student.last_name_maternal}
                                    </h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            {student.group?.grade}° "{student.group?.section}"
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                                        <FileText className="w-4 h-4" />
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                                </div>
                            </button>
                        ))
                    ) : (
                        <div className="text-center py-12">
                            <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">No se encontraron alumnos</p>
                            <p className="text-[10px] text-slate-400 mt-2">Intenta con otro nombre o verifica tu conexión</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-colors"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    )
}
