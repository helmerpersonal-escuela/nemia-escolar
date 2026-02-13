import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import {
    Users,
    Shield,
    Calendar,
    Clock,
    ClipboardCheck,
    Stethoscope,
    MoreVertical,
    Plus,
    ArrowUpRight,
    Search,
    Filter,
    CheckCircle2,
    XCircle,
    MapPin,
    BookOpen,
    GraduationCap,
    X,
    Save,
    Trash2
} from 'lucide-react'

export const StaffControlCenter = () => {
    const [loading, setLoading] = useState(true)
    const [staff, setStaff] = useState<any[]>([])
    const [attendance, setAttendance] = useState<any[]>([])
    const [activeTab, setActiveTab] = useState<'roster' | 'attendance' | 'permits'>('roster')
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedStaff, setSelectedStaff] = useState<any>(null)
    const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false)
    const [groups, setGroups] = useState<any[]>([])
    const [subjects, setSubjects] = useState<any[]>([])
    const [assignments, setAssignments] = useState<any[]>([])
    const [schedules, setSchedules] = useState<any[]>([])
    const [newAssignmentData, setNewAssignmentData] = useState({ groupId: '', subjectId: '' })

    useEffect(() => {
        loadStaffData()
    }, [])

    const loadStaffData = async () => {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user?.id).single()
            if (!profile) return

            // Load all staff
            const { data: staffData } = await supabase
                .from('profiles')
                .select('*, staff_commissions(*)')
                .eq('tenant_id', profile.tenant_id)
                .order('first_name')
            setStaff(staffData || [])

            // Load today's attendance
            const { data: attData } = await supabase
                .from('staff_attendance')
                .select('*')
                .eq('tenant_id', profile.tenant_id)
                .eq('date', new Date().toISOString().split('T')[0])
            setAttendance(attData || [])

            // Load groups and subjects for assignments
            const { data: groupsData } = await supabase.from('groups').select('*').eq('tenant_id', profile.tenant_id)
            const { data: subjectsData } = await supabase.from('subject_catalog').select('*')
            setGroups(groupsData || [])
            setSubjects(subjectsData || [])

        } catch (error) {
            console.error('Error loading staff data:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadStaffAssignments = async (staffId: string) => {
        const { data: gsData } = await supabase
            .from('group_subjects')
            .select('*, groups(grade, section), subject_catalog(name)')
            .eq('teacher_id', staffId)
        setAssignments(gsData || [])

        const { data: schData } = await supabase
            .from('schedules')
            .select('*, groups(grade, section), subject_catalog(name)')
            .in('group_id', gsData?.map(a => a.group_id) || [])
        setSchedules(schData || [])
    }

    const handleAssignGroup = async (groupId: string, subjectId: string) => {
        if (!selectedStaff) return
        const { error } = await supabase.from('group_subjects').insert({
            tenant_id: selectedStaff.tenant_id,
            group_id: groupId,
            subject_id: subjectId,
            teacher_id: selectedStaff.id
        })
        if (!error) loadStaffAssignments(selectedStaff.id)
    }

    const handleDeleteAssignment = async (id: string) => {
        const { error } = await supabase.from('group_subjects').delete().eq('id', id)
        if (!error && selectedStaff) loadStaffAssignments(selectedStaff.id)
    }

    const handleUpdateAdvisory = async (groupId: string | null) => {
        if (!selectedStaff) return
        const { error } = await supabase
            .from('profiles')
            .update({ advisory_group_id: groupId })
            .eq('id', selectedStaff.id)
        if (!error) {
            setSelectedStaff({ ...selectedStaff, advisory_group_id: groupId })
            loadStaffData()
        }
    }

    const handleAddCommission = async (name: string) => {
        if (!selectedStaff || !name) return
        const { error } = await supabase.from('staff_commissions').insert({
            profile_id: selectedStaff.id,
            tenant_id: selectedStaff.tenant_id,
            name
        })
        if (!error) loadStaffData()
    }

    const filteredStaff = staff.filter(s =>
        `${s.first_name} ${s.last_name_paternal}`.toLowerCase().includes(searchQuery.toLowerCase())
    )

    if (loading) return <div className="p-8 animate-pulse">Cargando gestión de personal...</div>

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight">Centro de Control de Personal</h1>
                    <p className="text-gray-500 font-medium">Supervisión, asistencia y asignación de responsabilidades.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center">
                        <Plus className="w-4 h-4 mr-2" />
                        Nueva Comisión
                    </button>
                </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Presentes Hoy</p>
                    <div className="flex items-end justify-between">
                        <h3 className="text-3xl font-black text-emerald-600">{attendance.filter(a => a.status === 'PRESENT').length}</h3>
                        <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Inasistencias</p>
                    <div className="flex items-end justify-between">
                        <h3 className="text-3xl font-black text-rose-600">{attendance.filter(a => a.status === 'ABSENT').length}</h3>
                        <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600">
                            <XCircle className="w-5 h-5" />
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Permisos Activos</p>
                    <div className="flex items-end justify-between">
                        <h3 className="text-3xl font-black text-blue-600">1</h3>
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                            <Stethoscope className="w-5 h-5" />
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Sin Registro</p>
                    <div className="flex items-end justify-between">
                        <h3 className="text-3xl font-black text-gray-400">{staff.length - attendance.length}</h3>
                        <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
                            <Clock className="w-5 h-5" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Tabs and Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-1 bg-gray-50 p-1 rounded-2xl w-fit">
                    {[
                        { id: 'roster', label: 'Personal y Comisiones', icon: Users },
                        { id: 'attendance', label: 'Bitácora de Asistencia', icon: ClipboardCheck },
                        { id: 'permits', label: 'Gestión de Permisos', icon: Stethoscope }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-white text-blue-600 shadow-sm border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <tab.icon className="w-4 h-4 mr-2" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-600" />
                    <input
                        type="text"
                        placeholder="Buscar personal..."
                        className="pl-12 pr-6 py-3 bg-white border border-gray-100 rounded-2xl text-sm font-bold shadow-sm focus:ring-4 focus:ring-blue-100 transition-all outline-none md:w-64"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* List Content */}
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                {activeTab === 'roster' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Personal</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Rol</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Estado</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Comisiones Activas</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredStaff.map(member => {
                                    const studentAttendance = attendance.find(a => a.profile_id === member.id)
                                    return (
                                        <tr key={member.id} className="hover:bg-blue-50/30 transition-colors group">
                                            <td className="px-8 py-4">
                                                <div className="flex items-center gap-4">
                                                    <img
                                                        src={member.avatar_url || `https://ui-avatars.com/api/?name=${member.first_name}+${member.last_name_paternal}&background=random`}
                                                        className="w-10 h-10 rounded-xl shadow-sm border border-gray-100"
                                                        alt="avatar"
                                                    />
                                                    <div>
                                                        <p className="text-sm font-black text-gray-900 leading-tight uppercase">
                                                            {member.first_name} {member.last_name_paternal}
                                                        </p>
                                                        <p className="text-[10px] text-gray-400 font-bold uppercase">{member.last_name_maternal || ''}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-4">
                                                <div className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-[9px] font-black uppercase tracking-widest">
                                                    {member.role === 'TEACHER' ? 'Docente' : member.role === 'DIRECTOR' ? 'Dirección' : member.role}
                                                </div>
                                            </td>
                                            <td className="px-8 py-4">
                                                <div className="flex items-center justify-center">
                                                    <div className={`w-2.5 h-2.5 rounded-full ${studentAttendance ? (studentAttendance.status === 'PRESENT' ? 'bg-emerald-500' : 'bg-rose-500') : 'bg-gray-300'} shadow-sm`} />
                                                </div>
                                            </td>
                                            <td className="px-8 py-4">
                                                <div className="flex flex-wrap gap-1.5 max-w-sm">
                                                    {member.staff_commissions?.length > 0 ? (
                                                        member.staff_commissions.slice(0, 2).map((c: any) => (
                                                            <div key={c.id} className="px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-md text-[9px] font-bold flex items-center">
                                                                {c.name}
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <span className="text-[10px] text-gray-300 italic">Sin comisiones</span>
                                                    )}
                                                    {member.staff_commissions?.length > 2 && (
                                                        <span className="text-[9px] font-black text-blue-400">+{member.staff_commissions.length - 2}</span>
                                                    )}
                                                    <button
                                                        onClick={() => {
                                                            const name = window.prompt('Nombre de la nueva comisión:')
                                                            if (name) {
                                                                setSelectedStaff(member)
                                                                handleAddCommission(name)
                                                            }
                                                        }}
                                                        className="w-5 h-5 flex items-center justify-center bg-gray-100 text-gray-400 rounded-md hover:bg-blue-600 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-8 py-4 text-right">
                                                <button
                                                    onClick={() => {
                                                        setSelectedStaff(member)
                                                        loadStaffAssignments(member.id)
                                                        setIsAssignmentModalOpen(true)
                                                    }}
                                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 rounded-xl text-[10px] font-black uppercase text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm"
                                                >
                                                    Gestionar <ArrowUpRight className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Assignment Management Modal */}
            {isAssignmentModalOpen && selectedStaff && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="p-8 bg-blue-600 text-white flex items-center justify-between border-b border-blue-500 shrink-0">
                            <div className="flex items-center gap-4">
                                <img
                                    src={selectedStaff.avatar_url || `https://ui-avatars.com/api/?name=${selectedStaff.first_name}+${selectedStaff.last_name_paternal}&background=random`}
                                    className="w-14 h-14 rounded-2xl border-2 border-white/50"
                                    alt="avatar"
                                />
                                <div>
                                    <h3 className="text-xl font-black">{selectedStaff.first_name} {selectedStaff.last_name_paternal}</h3>
                                    <p className="text-xs font-bold text-blue-100 uppercase tracking-widest">{selectedStaff.role} • Gestión de Asignaciones</p>
                                </div>
                            </div>
                            <button onClick={() => setIsAssignmentModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                            {/* Advisor Section */}
                            <section>
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <GraduationCap className="w-3 h-3" /> Asesoría de Grupo (Tutoría)
                                </h4>
                                <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-white rounded-2xl shadow-sm text-blue-600">
                                            <Users className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-gray-900">Grupo Asignado para Asesoría</p>
                                            <p className="text-xs text-gray-500 font-medium">El docente será el tutor principal de este grupo.</p>
                                        </div>
                                    </div>
                                    <select
                                        className="bg-white border-2 border-blue-100 rounded-xl px-4 py-2 text-sm font-bold text-blue-900 focus:ring-4 focus:ring-blue-100 outline-none"
                                        value={selectedStaff.advisory_group_id || ''}
                                        onChange={(e) => handleUpdateAdvisory(e.target.value || null)}
                                    >
                                        <option value="">Sin Asignar</option>
                                        {groups.map(g => (
                                            <option key={g.id} value={g.id}>{g.grade}° {g.section}</option>
                                        ))}
                                    </select>
                                </div>
                            </section>

                            {/* Subjects & Groups Assignment */}
                            <section>
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <BookOpen className="w-3 h-3" /> Grupos y Materias Asignadas
                                </h4>

                                {/* Inline Add Form */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100 mb-6">
                                    <select
                                        className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs font-bold"
                                        value={newAssignmentData.groupId}
                                        onChange={(e) => setNewAssignmentData({ ...newAssignmentData, groupId: e.target.value })}
                                    >
                                        <option value="">Seleccionar Grupo</option>
                                        {groups.map(g => (
                                            <option key={g.id} value={g.id}>{g.grade}° {g.section}</option>
                                        ))}
                                    </select>
                                    <select
                                        className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs font-bold"
                                        value={newAssignmentData.subjectId}
                                        onChange={(e) => setNewAssignmentData({ ...newAssignmentData, subjectId: e.target.value })}
                                    >
                                        <option value="">Seleccionar Materia</option>
                                        {subjects.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => {
                                            if (newAssignmentData.groupId && newAssignmentData.subjectId) {
                                                handleAssignGroup(newAssignmentData.groupId, newAssignmentData.subjectId)
                                                setNewAssignmentData({ groupId: '', subjectId: '' })
                                            }
                                        }}
                                        className="bg-blue-600 text-white rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all font-black"
                                    >
                                        Asignar Materia
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {assignments.map(a => (
                                        <div key={a.id} className="p-5 bg-white border border-gray-100 rounded-3xl shadow-sm hover:shadow-md transition-shadow group">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-900 font-black text-sm">
                                                        {a.groups?.grade}°
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-gray-900 leading-tight">{a.subject_catalog?.name}</p>
                                                        <p className="text-[10px] text-gray-400 font-bold uppercase">Sección {a.groups?.section}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteAssignment(a.id)}
                                                    className="p-2 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-rose-500 transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {assignments.length === 0 && (
                                        <div className="col-span-full py-12 border-4 border-dotted border-gray-50 rounded-[2.5rem] flex flex-col items-center justify-center text-gray-300">
                                            <BookOpen className="w-12 h-12 mb-3" />
                                            <p className="text-xs font-black uppercase tracking-widest">No hay materias asignadas</p>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* Schedule Overview */}
                            <section>
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Calendar className="w-3 h-3" /> Horario de Clases
                                </h4>
                                <div className="bg-gray-50 rounded-[2rem] p-6 border border-gray-100">
                                    <div className="grid grid-cols-5 gap-4">
                                        {['LUN', 'MAR', 'MIE', 'JUE', 'VIE'].map(day => (
                                            <div key={day} className="space-y-4">
                                                <p className="text-center text-[9px] font-black text-gray-400 uppercase tracking-widest">{day}</p>
                                                <div className="space-y-2">
                                                    {schedules.filter(s => s.day_of_week === (day === 'LUN' ? 'MONDAY' : day === 'MAR' ? 'TUESDAY' : day === 'MIE' ? 'WEDNESDAY' : day === 'JUE' ? 'THURSDAY' : 'FRIDAY')).map(s => (
                                                        <div key={s.id} className="p-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                                            <p className="text-[8px] font-black text-gray-400">{s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}</p>
                                                            <p className="text-[9px] font-bold text-gray-900 truncate">{s.subject_catalog?.name}</p>
                                                            <p className="text-[8px] text-blue-600 font-black">{s.groups?.grade}°{s.groups?.section}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-8 bg-gray-50 border-t border-gray-100 flex justify-end shrink-0">
                            <button onClick={() => setIsAssignmentModalOpen(false)} className="px-8 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600">
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
