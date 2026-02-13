import { useState, useEffect } from 'react'
import { X, Search, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'

interface StudentSelectorModalProps {
    isOpen: boolean
    onClose: () => void
}

export const StudentSelectorModal = ({ isOpen, onClose }: StudentSelectorModalProps) => {
    const navigate = useNavigate()
    const { data: tenant } = useTenant()

    const [step, setStep] = useState<'GROUP' | 'STUDENT'>('GROUP')
    const [groups, setGroups] = useState<any[]>([])
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
    const [students, setStudents] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            setStep('GROUP')
            setSelectedGroupId(null)
            setStudents([])
            setSearchQuery('')
            fetchGroups()
        }
    }, [isOpen])

    const fetchGroups = async () => {
        if (!tenant) return
        setLoading(true)
        // Fetch groups assigned to teacher (or all for now if RLS handles it)
        const { data } = await supabase
            .from('groups')
            .select('*')
            .eq('tenant_id', tenant.id)
            .order('grade')
            .order('section')

        if (data) setGroups(data)
        setLoading(false)
    }

    const handleGroupSelect = async (groupId: string) => {
        setSelectedGroupId(groupId)
        setLoading(true)
        const { data } = await supabase
            .from('students')
            .select('*')
            .eq('group_id', groupId)
            .order('last_name_paternal', { ascending: true })

        if (data) {
            setStudents(data)
            setStep('STUDENT')
        }
        setLoading(false)
    }

    const handleStudentSelect = (studentId: string) => {
        onClose()
        navigate(`/reports/student/${studentId}`)
    }

    const filteredStudents = students.filter(s =>
        `${s.first_name} ${s.last_name_paternal} ${s.last_name_maternal}`
            .toLowerCase()
            .includes(searchQuery.toLowerCase())
    )

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-indigo-600 p-6 flex justify-between items-center text-white">
                    <div>
                        <h3 className="text-xl font-black uppercase tracking-tight">Generar Reporte</h3>
                        <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest mt-1">
                            {step === 'GROUP' ? 'Selecciona un Grupo' : 'Selecciona un Alumno'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 h-[400px] flex flex-col">
                    {step === 'GROUP' ? (
                        <div className="grid grid-cols-2 gap-3 overflow-y-auto content-start">
                            {groups.map(group => (
                                <button
                                    key={group.id}
                                    onClick={() => handleGroupSelect(group.id)}
                                    className="p-4 bg-gray-50 hover:bg-indigo-50 border-2 border-transparent hover:border-indigo-100 rounded-2xl text-left transition-all group"
                                >
                                    <span className="block text-2xl font-black text-gray-800 group-hover:text-indigo-700">
                                        {group.grade}° "{group.section}"
                                    </span>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider group-hover:text-indigo-400">
                                        Seleccionar
                                    </span>
                                </button>
                            ))}
                            {loading && <div className="col-span-2 text-center py-10 text-gray-400">Cargando grupos...</div>}
                        </div>
                    ) : (
                        <>
                            <div className="mb-4 relative shrink-0">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Buscar alumno..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full bg-gray-100 rounded-xl pl-10 pr-4 py-3 font-bold text-sm text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500"
                                    autoFocus
                                />
                            </div>

                            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
                                <button
                                    onClick={() => setStep('GROUP')}
                                    className="w-full text-left px-2 py-2 text-xs font-bold text-indigo-600 hover:underline mb-2"
                                >
                                    ← Volver a grupos
                                </button>

                                {filteredStudents.map(student => (
                                    <button
                                        key={student.id}
                                        onClick={() => handleStudentSelect(student.id)}
                                        className="w-full flex items-center p-3 hover:bg-indigo-50 rounded-xl transition-colors group text-left"
                                    >
                                        <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-black mr-3 shrink-0">
                                            {student.first_name[0]}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold text-gray-800 text-sm group-hover:text-indigo-800">
                                                {student.first_name} {student.last_name_paternal} {student.last_name_maternal}
                                            </p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400" />
                                    </button>
                                ))}
                                {filteredStudents.length === 0 && !loading && (
                                    <p className="text-center text-gray-400 text-sm py-10">No se encontraron alumnos</p>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
