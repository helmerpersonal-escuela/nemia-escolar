import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import {
    Activity,
    Plus,
    Search,
    History,
    Award,
    User,
    ChevronRight,
    Brain,
    X
} from 'lucide-react'

interface Student {
    id: string
    first_name: string
    last_name_paternal: string
    last_name_maternal: string
    condition?: string
    condition_details?: string
    group_id: string
    group?: {
        grade: string
        section: string
    }
}

interface Incident {
    id: string
    type: string
    severity: string
    description: string
    action_taken?: string
    created_at: string
}

export const StudentTrackingPage = () => {
    const { studentId } = useParams()
    const { data: tenant } = useTenant()
    const [loading, setLoading] = useState(true)
    const [groups, setGroups] = useState<any[]>([])
    const [selectedGroupId, setSelectedGroupId] = useState<string>('')
    const [students, setStudents] = useState<Student[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
    const [incidents, setIncidents] = useState<Incident[]>([])

    useEffect(() => {
        if (studentId && students.length > 0) {
            const student = students.find(s => s.id === studentId)
            if (student) {
                setSelectedStudent(student)
                fetchStudentIncidents(student.id)
            }
        }
    }, [studentId, students])

    // Modal state
    const [showIncidentModal, setShowIncidentModal] = useState(false)
    const [newIncident, setNewIncident] = useState({
        type: 'CONDUCTA',
        severity: 'BAJA',
        description: '',
        action_taken: ''
    })

    useEffect(() => {
        if (!tenant) return
        const fetchGroups = async () => {
            const { data } = await supabase.from('groups').select('*').eq('tenant_id', tenant.id)
            if (data) {
                setGroups(data)
                if (data.length > 0 && !selectedGroupId) setSelectedGroupId(data[0].id)
            }
        }
        fetchGroups()
    }, [tenant])

    useEffect(() => {
        if (!selectedGroupId) return
        const fetchStudents = async () => {
            setLoading(true)
            const { data } = await supabase
                .from('students')
                .select('*, group:groups(grade, section)')
                .eq('group_id', selectedGroupId)
            if (data) setStudents(data)
            setLoading(false)
        }
        fetchStudents()
    }, [selectedGroupId])

    const fetchStudentIncidents = async (sid: string) => {
        const { data } = await supabase
            .from('student_incidents')
            .select('*')
            .eq('student_id', sid)
            .order('created_at', { ascending: false })
        if (data) setIncidents(data)
    }

    const [saving, setSaving] = useState(false)

    // Predefined common phrases for quick selection
    const QUICK_PHRASES: any = {
        'CONDUCTA': ['Plática constante en clase', 'Interrumpe la sesión', 'No trajo material', 'Salió del aula sin permiso', 'Uso inadecuado de celular', 'Actitud irrespetuosa'],
        'ACADEMICO': ['No entregó tarea', 'No trabajó en clase', 'Bajo desempeño en actividad', 'Dificultad para comprender el tema', 'Trabajó con excelencia', 'Cumplió con todo lo solicitado'],
        'EMOCIONAL': ['Se nota desmotivado/a', 'Llegó llorando al aula', 'Conflicto con compañeros', 'Se nota muy distraído/a', 'Expresa problemas personales'],
        'SALUD': ['Refiere dolor de cabeza', 'Se siente mal (náuseas)', 'Presenta mucha tos', 'Se quedó dormido/a'],
        'POSITIVO': ['Excelente participación', 'Liderazgo en equipo', 'Ayudó a un compañero', 'Mejoría notable en conducta', 'Creatividad destacada en proyecto']
    }

    const logIncident = async () => {
        if (!selectedStudent || !tenant) return
        setSaving(true)
        const { error } = await supabase.from('student_incidents').insert([{
            ...newIncident,
            student_id: selectedStudent.id,
            tenant_id: tenant.id
        }])

        if (!error) {
            setShowIncidentModal(false)
            setNewIncident({ type: 'CONDUCTA', severity: 'BAJA', description: '', action_taken: '' })
            fetchStudentIncidents(selectedStudent.id)
        }
        setSaving(false)
    }

    const filteredStudents = students.filter(s =>
        `${s.first_name} ${s.last_name_paternal} ${s.last_name_maternal}`.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 pb-24">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tighter uppercase">Bitácora Escolar</h1>
                    <p className="text-gray-400 font-bold text-xs sm:text-sm uppercase tracking-widest mt-1">
                        Seguimiento Rápido {selectedStudent ? `• ${selectedStudent.first_name} ${selectedStudent.last_name_paternal}` : ''}
                    </p>
                </div>
                <div className="flex space-x-4">
                    {/* Role-based restriction: Only staff can register incidents */}
                    {tenant?.role !== 'STUDENT' && tenant?.role !== 'TUTOR' && selectedStudent && (
                        <button
                            onClick={() => setShowIncidentModal(true)}
                            className="bg-indigo-600 text-white px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all btn-tactile flex items-center lg:hidden"
                        >
                            <Plus className="w-4 h-4 mr-2" /> Nueva Acción
                        </button>
                    )}
                    <select
                        value={selectedGroupId}
                        onChange={(e) => setSelectedGroupId(e.target.value)}
                        className="input-squishy px-4 py-2 font-bold text-gray-700 cursor-pointer"
                    >
                        {groups.map(g => (
                            <option key={g.id} value={g.id}>{g.grade}° "{g.section}"</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-4">
                    <div className="squishy-card overflow-hidden">
                        <div className="p-6 border-b border-gray-50 flex flex-col space-y-4">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="input-squishy w-full pl-12 pr-4 py-3 font-bold text-gray-700 text-sm"
                                />
                            </div>
                        </div>
                        <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
                            {loading ? (
                                <div className="p-12 text-center animate-pulse text-gray-300 font-bold uppercase text-[10px]">Actualizando lista...</div>
                            ) : filteredStudents.map(student => (
                                <button
                                    key={student.id}
                                    onClick={() => {
                                        setSelectedStudent(student)
                                        fetchStudentIncidents(student.id)
                                    }}
                                    className={`w-full p-4 flex items-center justify-between hover:bg-indigo-50/50 transition-all group
                                        ${selectedStudent?.id === student.id ? 'bg-indigo-50/50' : ''}`}
                                >
                                    <div className="flex items-center space-x-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm
                                            ${selectedStudent?.id === student.id ? 'bg-indigo-600 text-white scale-110' : 'bg-gray-50 text-gray-300'}`}>
                                            {student.first_name[0]}
                                        </div>
                                        <div className="text-left">
                                            <p className={`font-black tracking-tight text-sm
                                                ${selectedStudent?.id === student.id ? 'text-indigo-900' : 'text-gray-700'}`}>
                                                {student.first_name} {student.last_name_paternal}
                                            </p>
                                            <div className="flex items-center space-x-2 mt-0.5">
                                                {student.condition && (
                                                    <span className="bg-rose-100 text-rose-600 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase">BAP</span>
                                                )}
                                                {student.first_name.length % 7 === 0 && (
                                                    <span className="bg-amber-100 text-amber-600 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase">Alerta</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronRight className={`w-4 h-4 transition-transform ${selectedStudent?.id === student.id ? 'text-indigo-600 translate-x-1' : 'text-gray-200'}`} />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Tracking Detail - Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {selectedStudent ? (
                        <>
                            {/* Student Hub Card */}
                            <div className="bg-indigo-600 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl p-6 sm:p-8 text-white relative overflow-hidden group">
                                <Activity className="absolute right-[-20px] top-[-20px] w-64 h-64 text-white/5 rotate-12 group-hover:scale-110 transition-transform duration-700" />
                                <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start gap-4">
                                    <div className="flex space-x-4 sm:space-x-6 items-center">
                                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center border border-white/30 shadow-2xl shrink-0">
                                            <User className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                                        </div>
                                        <div>
                                            <h2 className="text-2xl sm:text-3xl font-black tracking-tighter leading-tight">
                                                {selectedStudent.first_name} <br className="sm:hidden" /> {selectedStudent.last_name_paternal}
                                            </h2>
                                            <p className="text-indigo-100 font-bold uppercase text-[9px] sm:text-[10px] tracking-widest mt-1 bg-white/10 px-3 py-1 rounded-full inline-block">
                                                {selectedStudent.group?.grade}° "{selectedStudent.group?.section}" • Expediente Activo
                                            </p>
                                        </div>
                                    </div>
                                    {tenant?.role !== 'STUDENT' && tenant?.role !== 'TUTOR' && (
                                        <button
                                            onClick={() => setShowIncidentModal(true)}
                                            className="bg-white text-indigo-600 px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-2xl hover:bg-gray-100 transition-all btn-tactile flex items-center"
                                        >
                                            <Plus className="w-4 h-4 mr-2" /> Nueva Acción
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Key Indicators Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Inclusivity Quick Info */}
                                <div className="squishy-card p-6 flex items-center space-x-6">
                                    <div className="p-4 bg-rose-50 text-rose-500 rounded-2xl">
                                        <Brain className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Inclusividad</h3>
                                        <p className="text-sm font-black text-rose-600 uppercase mt-1">
                                            {selectedStudent.condition ? `Diagnóstico: ${selectedStudent.condition}` : 'Sin barreras detectadas'}
                                        </p>
                                    </div>
                                </div>

                                {/* Last Movement */}
                                <div className="squishy-card p-6 flex items-center space-x-6">
                                    <div className="p-4 bg-amber-50 text-amber-500 rounded-2xl">
                                        <History className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Última Nota</h3>
                                        <p className="text-sm font-black text-gray-800 uppercase mt-1">
                                            {incidents.length > 0 ? new Date(incidents[0].created_at).toLocaleDateString() : 'Ninguno registrado'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Full Timeline List */}
                            <div className="squishy-card overflow-hidden">
                                <div className="p-5 sm:p-8 border-b border-gray-50 flex justify-between items-center">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                                        <h3 className="font-black text-gray-900 uppercase text-xs sm:text-sm tracking-widest">Historial de Bitácora</h3>
                                    </div>
                                    <span className="text-[9px] sm:text-[10px] font-black text-gray-300 uppercase">{incidents.length} Registros Totales</span>
                                </div>
                                <div className="divide-y divide-gray-50 bg-gray-50/30">
                                    {incidents.map(incident => (
                                        <div key={incident.id} className="p-5 sm:p-8 hover:bg-white transition-all group">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex items-center space-x-4">
                                                    <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider shadow-sm
                                                        ${incident.type === 'POSITIVO' ? 'bg-green-600 text-white' :
                                                            incident.type === 'CONDUCTA' ? 'bg-amber-500 text-white' :
                                                                incident.type === 'SALUD' ? 'bg-rose-500 text-white' : 'bg-indigo-600 text-white'}`}>
                                                        {incident.type}
                                                    </div>
                                                    <span className="text-[10px] font-black text-gray-400 uppercase">{new Date(incident.created_at).toLocaleDateString(['es-MX'], { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                                                </div>
                                                <div className={`px-3 py-1 rounded-lg border-2 text-[8px] font-black uppercase
                                                    ${incident.severity === 'ALTA' ? 'border-red-100 text-red-500 bg-red-50' :
                                                        incident.severity === 'MEDIA' ? 'border-amber-100 text-amber-500 bg-amber-50' : 'border-green-100 text-green-500 bg-green-50'}`}>
                                                    Prioridad {incident.severity}
                                                </div>
                                            </div>
                                            <p className="text-lg font-bold text-gray-800 tracking-tight leading-snug">{incident.description}</p>
                                            {incident.action_taken && (
                                                <div className="mt-4 flex items-start bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                                                    <Award className="w-5 h-5 text-indigo-600 mr-3 shrink-0 mt-0.5" />
                                                    <div>
                                                        <p className="text-[9px] font-black text-indigo-400 uppercase mb-1">Acuerdo o Acción</p>
                                                        <p className="text-sm font-medium text-gray-600">{incident.action_taken}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {incidents.length === 0 && (
                                        <div className="p-20 text-center">
                                            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                                <History className="w-12 h-12 text-gray-100" />
                                            </div>
                                            <h4 className="text-xl font-black text-gray-300 uppercase tracking-widest">Sin registros</h4>
                                            <p className="text-gray-200 font-bold text-xs uppercase mt-2">Usa el botón "Nueva Acción" para registrar eventos</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex items-center justify-center bg-gray-50/50 border-4 border-dashed border-gray-100 rounded-[3rem] min-h-[600px]">
                            <div className="text-center">
                                <div className="relative inline-block mb-8">
                                    <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full" />
                                    <Activity className="w-32 h-32 text-gray-200 relative z-10 animate-pulse" />
                                </div>
                                <h3 className="text-3xl font-black text-gray-300 uppercase tracking-widest">¿A quién evaluamos hoy?</h3>
                                <p className="text-gray-300 font-bold text-sm uppercase mt-4 tracking-tighter">Selecciona un alumno de la lista para ver su bitácora</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Practical Click-to-Fill Modal */}
            {showIncidentModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-md">
                    <div className="squishy-card w-full max-w-2xl border-white/20 animate-in fade-in slide-in-from-bottom-8 duration-500 max-h-[90vh] flex flex-col p-0 overflow-hidden">
                        {/* Modal Header */}
                        <div className="p-8 bg-indigo-600 text-white flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-2xl font-black tracking-tighter uppercase leading-none">Nueva Nota</h3>
                                <p className="text-indigo-200 font-bold text-[10px] uppercase tracking-widest mt-1">Alumno: {selectedStudent?.first_name} {selectedStudent?.last_name_paternal}</p>
                            </div>
                            <button
                                onClick={() => setShowIncidentModal(false)}
                                className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-all"
                            >
                                <X className="w-5 h-5 text-white" />
                            </button>
                        </div>

                        <div className="p-8 space-y-8 overflow-y-auto">
                            {/* Step 1: Category Selection */}
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-3 tracking-widest ml-1">1. ¿Qué tipo de evento es?</label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {Object.keys(QUICK_PHRASES).map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setNewIncident(prev => ({ ...prev, type: cat, description: '' }))}
                                            className={`px-3 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-tight border-2 transition-all
                                                ${newIncident.type === cat
                                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg scale-105'
                                                    : 'bg-white border-gray-100 text-gray-400 hover:border-indigo-200'}`}
                                        >
                                            {cat === 'CONDUCTA' && 'Disciplina'}
                                            {cat === 'ACADEMICO' && 'Académico'}
                                            {cat === 'EMOCIONAL' && 'Emocional'}
                                            {cat === 'SALUD' && 'Salud'}
                                            {cat === 'POSITIVO' && 'Logro ✨'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Step 2: Quick Phrases (THE "NO TYPING" PART) */}
                            <div className="animate-in fade-in duration-500" key={newIncident.type}>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-3 tracking-widest ml-1">2. Selecciona lo sucedido:</label>
                                <div className="flex flex-wrap gap-2">
                                    {QUICK_PHRASES[newIncident.type].map((phrase: string) => (
                                        <button
                                            key={phrase}
                                            onClick={() => setNewIncident(prev => ({ ...prev, description: phrase }))}
                                            className={`px-3 py-2.5 rounded-lg text-[10px] font-bold text-left transition-all border
                                                ${newIncident.description === phrase
                                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-black'
                                                    : 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-white'}`}
                                        >
                                            {phrase}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => setNewIncident(prev => ({ ...prev, description: '' }))}
                                        className="px-3 py-2.5 rounded-lg text-[10px] font-black border-2 border-dashed border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-400 transition-all"
                                    >
                                        + Otro
                                    </button>
                                </div>
                            </div>

                            {/* Optional: Manual Description & Action */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-50">
                                <div>
                                    <label className="block text-[9px] font-black text-gray-400 uppercase mb-2 tracking-widest ml-1">Detalle (Opcional)</label>
                                    <textarea
                                        rows={2}
                                        value={newIncident.description}
                                        onChange={e => setNewIncident(prev => ({ ...prev, description: e.target.value }))}
                                        className="w-full bg-gray-50 border-2 border-transparent focus:border-indigo-500 rounded-xl px-4 py-3 font-medium text-gray-700 outline-none transition-all placeholder:text-[10px] text-xs"
                                        placeholder="Escribe aquí..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black text-gray-400 uppercase mb-2 tracking-widest ml-1">Gravedad</label>
                                    <div className="flex space-x-2">
                                        {['BAJA', 'MEDIA', 'ALTA'].map(sev => (
                                            <button
                                                key={sev}
                                                onClick={() => setNewIncident(prev => ({ ...prev, severity: sev }))}
                                                className={`flex-1 py-3 rounded-xl text-[9px] font-black transition-all border-2
                                                    ${newIncident.severity === sev
                                                        ? (sev === 'ALTA' ? 'bg-red-600 border-red-600 text-white' :
                                                            sev === 'MEDIA' ? 'bg-amber-500 border-amber-500 text-white' :
                                                                'bg-green-600 border-green-600 text-white')
                                                        : 'bg-white border-gray-100 text-gray-400'}`}
                                            >
                                                {sev}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Actions */}
                        <div className="p-8 pt-0 flex space-x-3 shrink-0">
                            <button
                                onClick={() => setShowIncidentModal(false)}
                                className="px-6 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:bg-gray-50 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={logIncident}
                                disabled={saving || !newIncident.description}
                                className="flex-1 bg-indigo-600 text-white px-8 py-4 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all transform hover:-translate-y-1 active:translate-y-0 disabled:opacity-30 flex items-center justify-center"
                            >
                                {saving ? 'Guardando...' : 'Registrar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
