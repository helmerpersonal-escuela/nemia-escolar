import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import {
    Save,
    ClipboardList,
    Search,
    Users,
    Sparkles,
    CheckCircle2,
    Clock,
    LayoutGrid,
    MessageSquareQuote
} from 'lucide-react'
import { useTenant } from '../../../hooks/useTenant'

interface Group {
    id: string
    grade: string
    section: string
}

interface Student {
    id: string
    first_name: string
    last_name_paternal: string
}

export const AnecdotalRecordForm = () => {
    const { data: tenant } = useTenant()
    const [groups, setGroups] = useState<Group[]>([])
    const [students, setStudents] = useState<Student[]>([])
    const [selectedGroup, setSelectedGroup] = useState('')
    const [selectedStudent, setSelectedStudent] = useState('')
    const [loadingGroups, setLoadingGroups] = useState(true)
    const [currentClassInfo, setCurrentClassInfo] = useState<any>(null)

    // Form State
    const [context, setContext] = useState('')
    const [description, setDescription] = useState('')
    const [interpretation, setInterpretation] = useState('')
    const [commitment, setCommitment] = useState('')
    const [saving, setSaving] = useState(false)
    const [searchStudent, setSearchStudent] = useState('')

    // Phrase Bank
    const QUICK_PHRASES = {
        context: ['Clase Teórica', 'Trabajo en Equipo', 'Evaluación', 'Receso / Patio', 'Laboratorio', 'Salida', 'Ceremonia'],
        observations: [
            'Participa de manera constante y asertiva.',
            'Muestra dificultad para concentrarse en la actividad.',
            'Apoya a sus compañeros en la resolución de dudas.',
            'No entregó la actividad solicitada en tiempo.',
            'Interrumpe constantemente la explicación del docente.',
            'Muestra un avance significativo en su aprendizaje.',
            'Se nota distraído/a por problemas personales.',
            'Utiliza lenguaje respetuoso con sus pares.',
            'Resuelve conflictos de manera pacífica.'
        ]
    }

    useEffect(() => {
        if (tenant) {
            fetchGroups()
            detectCurrentClass()
        }
    }, [tenant])

    useEffect(() => {
        if (selectedGroup) fetchStudents()
        else {
            setStudents([])
            setSelectedStudent('')
        }
    }, [selectedGroup])

    const fetchGroups = async () => {
        setLoadingGroups(true)
        const { data } = await supabase.from('groups').select('id, grade, section').eq('tenant_id', tenant?.id)
        if (data) {
            setGroups(data)
        }
        setLoadingGroups(false)
    }

    const detectCurrentClass = async () => {
        if (!tenant) return

        const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
        const currentDay = days[new Date().getDay()]
        const now = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })

        const { data: schedule } = await supabase
            .from('schedules')
            .select('group_id, start_time, end_time, custom_subject, subject:subject_catalog(name)')
            .eq('tenant_id', tenant.id)
            .eq('day_of_week', currentDay)

        if (schedule) {
            const active = schedule.find(s => now >= s.start_time && now <= s.end_time)
            if (active) {
                const subjectData = Array.isArray(active.subject) ? active.subject[0] : active.subject
                const subjectName = subjectData?.name || active.custom_subject || ''
                setCurrentClassInfo({
                    groupId: active.group_id,
                    subject: subjectName
                })
                // Auto-select if not manually changed
                setSelectedGroup(active.group_id)
                setContext(subjectName)
            }
        }
    }

    const fetchStudents = async () => {
        const { data } = await supabase
            .from('students')
            .select('id, first_name, last_name_paternal')
            .eq('group_id', selectedGroup)
            .order('first_name')
        setStudents(data || [])
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedGroup || !description.trim()) return alert('El grupo y la descripción son obligatorios')
        if (!tenant) return

        setSaving(true)
        try {
            const { error } = await supabase.from('formative_records').insert([{
                tenant_id: tenant.id,
                group_id: selectedGroup,
                student_id: selectedStudent || null,
                type: 'ANECDOTAL',
                content: {
                    context,
                    description,
                    interpretation,
                    commitment
                }
            }])

            if (error) throw error

            // Success Feedback
            alert('¡Registro guardado con éxito!')

            // Reset only inputs, keep selection for potential multi-student recording
            setDescription('')
            setInterpretation('')
            setCommitment('')
        } catch (err) {
            console.error(err)
            alert('Error al guardar el registro')
        } finally {
            setSaving(false)
        }
    }

    const filteredStudents = students.filter(s =>
        `${s.first_name} ${s.last_name_paternal}`.toLowerCase().includes(searchStudent.toLowerCase())
    )

    return (
        <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 border border-gray-100 overflow-hidden transition-all duration-500 hover:shadow-indigo-200/50">
            {/* Custom Header */}
            <div className="p-10 bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32 animate-pulse" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center space-x-5">
                        <div className="p-4 bg-white/20 backdrop-blur-md rounded-[1.5rem] border border-white/30 shadow-xl">
                            <ClipboardList className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black tracking-tighter uppercase leading-none">Registro Anecdótico</h2>
                            <p className="text-indigo-100/80 font-bold text-xs uppercase tracking-widest mt-2 flex items-center">
                                <Sparkles className="w-3.5 h-3.5 mr-2 text-yellow-300" /> Seguimiento Formativo (NEM)
                            </p>
                        </div>
                    </div>

                    {currentClassInfo && (
                        <div className="bg-white/10 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/20 flex items-center group cursor-default">
                            <Clock className="w-4 h-4 mr-2 text-indigo-200 group-hover:animate-spin" />
                            <div>
                                <p className="text-[9px] font-black uppercase text-indigo-200 tracking-tighter">Clase en Curso</p>
                                <p className="text-xs font-black">{currentClassInfo.subject}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <form onSubmit={handleSave} className="p-10 space-y-12">
                {/* Step 1: Group Selection */}
                <section>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center">
                            <LayoutGrid className="w-4 h-4 mr-2 text-indigo-500" /> 1. Selecciona el Grupo
                        </h3>
                        {selectedGroup && (
                            <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase">Seleccionado</span>
                        )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {loadingGroups ? (
                            <div className="col-span-full py-8 text-center animate-pulse text-gray-300 font-bold uppercase text-xs">Cargando grupos...</div>
                        ) : groups.map(g => (
                            <button
                                key={g.id}
                                type="button"
                                onClick={() => setSelectedGroup(g.id)}
                                className={`px-4 py-4 rounded-2xl text-center transition-all border-2 flex flex-col items-center justify-center gap-1 group
                                    ${selectedGroup === g.id
                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-100 scale-105'
                                        : 'bg-white border-gray-100 text-gray-500 hover:border-indigo-200 hover:bg-gray-50'}`}
                            >
                                <span className={`text-xl font-black ${selectedGroup === g.id ? 'text-white' : 'text-gray-900'}`}>{g.grade}°</span>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${selectedGroup === g.id ? 'text-indigo-100' : 'text-gray-400'}`}>Sección "{g.section}"</span>
                                {selectedGroup === g.id && <CheckCircle2 className="w-3 h-3 mt-1 text-white" />}
                            </button>
                        ))}
                    </div>
                </section>

                {/* Step 2: Student Selection */}
                {selectedGroup && (
                    <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center">
                                <Users className="w-4 h-4 mr-2 text-indigo-500" /> 2. Alumno(s) involucrado(s)
                            </h3>
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 w-3.5 h-3.5" />
                                <input
                                    type="text"
                                    placeholder="Buscar alumno..."
                                    value={searchStudent}
                                    onChange={(e) => setSearchStudent(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 border-2 border-gray-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1 scrollbar-hide">
                            <button
                                type="button"
                                onClick={() => setSelectedStudent('')}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all
                                    ${selectedStudent === ''
                                        ? 'bg-indigo-100 text-indigo-700 font-black ring-2 ring-indigo-200'
                                        : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                            >
                                Todo el grupo
                            </button>
                            {filteredStudents.map(s => (
                                <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => setSelectedStudent(s.id)}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-bold transition-all border
                                        ${selectedStudent === s.id
                                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg'
                                            : 'bg-white border-gray-100 text-gray-600 hover:border-indigo-200'}`}
                                >
                                    {s.first_name} {s.last_name_paternal}
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                {/* Step 3: Record Details */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="space-y-8">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-3 ml-1 tracking-widest flex items-center">
                                <Sparkles className="w-3 h-3 mr-2" /> Contexto del suceso
                            </label>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {QUICK_PHRASES.context.map(p => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setContext(p)}
                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border transition-all
                                            ${context === p ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-gray-50 border-gray-100 text-gray-400 hover:bg-gray-100'}`}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                            <input
                                type="text"
                                value={context}
                                onChange={(e) => setContext(e.target.value)}
                                placeholder="Escribe el contexto..."
                                className="w-full bg-gray-50 border-2 border-transparent focus:border-indigo-500 rounded-2xl px-5 py-4 font-bold text-gray-900 outline-none transition-all text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-3 ml-1 tracking-widest flex items-center">
                                <MessageSquareQuote className="w-3 h-3 mr-2" /> Descripción del hecho
                            </label>
                            <div className="flex flex-wrap gap-2 mb-4">
                                {QUICK_PHRASES.observations.map(p => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setDescription(prev => prev ? prev + ' ' + p : p)}
                                        className="px-3 py-2 rounded-lg text-[9px] font-bold bg-white border border-gray-100 text-gray-500 hover:border-indigo-200 hover:text-indigo-600 transition-all text-left max-w-xs truncate"
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={5}
                                placeholder="Describe con detalle y objetividad..."
                                className="w-full bg-gray-50 border-2 border-transparent focus:border-indigo-500 rounded-3xl px-6 py-5 font-medium text-gray-900 outline-none transition-all text-sm resize-none"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-8 p-8 bg-indigo-50/30 rounded-[2rem] border border-indigo-100/50">
                        <div>
                            <label className="block text-[10px] font-black text-indigo-400 uppercase mb-3 ml-1 tracking-widest">Interpretación / Análisis</label>
                            <textarea
                                value={interpretation}
                                onChange={(e) => setInterpretation(e.target.value)}
                                rows={3}
                                placeholder="¿Cómo afecta pedagógicamente?"
                                className="w-full bg-white border-2 border-transparent focus:border-indigo-500 rounded-2xl px-5 py-4 font-medium text-gray-900 outline-none transition-all text-sm resize-none shadow-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-indigo-400 uppercase mb-3 ml-1 tracking-widest">Compromisos / Acuerdos</label>
                            <textarea
                                value={commitment}
                                onChange={(e) => setCommitment(e.target.value)}
                                rows={3}
                                placeholder="¿Qué se acordó con el alumno?"
                                className="w-full bg-white border-2 border-transparent focus:border-indigo-500 rounded-2xl px-5 py-4 font-medium text-gray-900 outline-none transition-all text-sm resize-none shadow-sm"
                            />
                        </div>

                        <div className="pt-6">
                            <button
                                type="submit"
                                disabled={saving || !selectedGroup}
                                className="w-full bg-gradient-to-r from-indigo-600 to-violet-700 text-white px-8 py-5 rounded-2xl transition-all font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-indigo-200 flex items-center justify-center transform hover:-translate-y-1 active:scale-95 disabled:opacity-30 disabled:translate-y-0"
                            >
                                <Save className="w-5 h-5 mr-3" />
                                {saving ? 'Sincronizando...' : 'Finalizar y Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    )
}
