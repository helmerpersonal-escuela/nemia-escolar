import { useState, useEffect } from 'react'
import {
    FileText,
    Search,
    Calendar,
    CheckCircle2,
    XCircle,
    Clock,
    MoreVertical,
    Filter,
    Loader2
} from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { useProfile } from '../../../hooks/useProfile'

interface StaffRecord {
    id: string
    full_name: string
    role: string
    attendance?: {
        id: string
        status: string
        notes: string
        check_in: string | null
        check_out: string | null
    }
}

export const JustificationManager = () => {
    const { data: tenant } = useTenant()
    const [loading, setLoading] = useState(true)
    const [staff, setStaff] = useState<StaffRecord[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
    const [editingRecord, setEditingRecord] = useState<StaffRecord | null>(null)
    const [justification, setJustification] = useState('')
    const [newStatus, setNewStatus] = useState('')
    const [checkInTime, setCheckInTime] = useState('')
    const [checkOutTime, setCheckOutTime] = useState('')

    const { profile } = useProfile()
    const isManager = ['DIRECTOR', 'ADMIN', 'SUPER_ADMIN'].includes(profile?.role || '')

    useEffect(() => {
        if (tenant?.id) {
            fetchData()
        }
    }, [tenant?.id, selectedDate])

    const fetchData = async () => {
        if (!tenant) return
        setLoading(true)

        // 1. Fetch all staff for this tenant
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, role')
            .eq('tenant_id', tenant.id)
            .in('role', ['TEACHER', 'ADMIN', 'DIRECTOR', 'ACADEMIC_COORD', 'SCHOOL_CONTROL', 'PREFECT', 'SUPPORT'])
            .order('full_name')

        // 2. Fetch attendance for the selected date
        const { data: attendance } = await supabase
            .from('staff_attendance')
            .select('*')
            .eq('tenant_id', tenant.id)
            .eq('date', selectedDate)

        const merged = (profiles || []).map(p => ({
            ...p,
            attendance: attendance?.find(a => a.profile_id === p.id)
        }))

        setStaff(merged)
        setLoading(false)
    }

    const handleSaveJustification = async () => {
        if (!editingRecord || !tenant) return

        const payload: any = {
            profile_id: editingRecord.id,
            tenant_id: tenant.id,
            date: selectedDate,
            status: newStatus,
            notes: justification
        }

        // Add times if present and user is manager
        if (isManager) {
            payload.check_in = checkInTime ? `${selectedDate}T${checkInTime}:00` : null
            payload.check_out = checkOutTime ? `${selectedDate}T${checkOutTime}:00` : null
        }

        try {
            const { error } = await supabase
                .from('staff_attendance')
                .upsert(payload, { onConflict: 'profile_id, date' })

            if (error) throw error

            setEditingRecord(null)
            fetchData()
        } catch (err: any) {
            alert('Error al guardar: ' + err.message)
        }
    }

    const filteredStaff = staff.filter(s =>
        s.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Justificaciones de Personal</h1>
                    <p className="text-slate-500 font-medium">Gestión de inasistencias, retardos y permisos del personal del plantel.</p>
                </div>
                <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
                    <Calendar className="w-5 h-5 text-slate-400 ml-2" />
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="border-none focus:ring-0 text-sm font-bold text-slate-700 outline-none pr-4"
                    />
                </div>
            </div>

            <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-100 border border-slate-50 overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-4 top-3 w-4 h-4 text-slate-400" />
                        <input
                            placeholder="Buscar personal..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 ring-blue-100 outline-none"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-500 uppercase">Filtrar por estatus</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Nombre</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Rol</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Estatus</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Entrada/Salida</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Notas / Justificación</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center">
                                        <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cargando plantilla...</p>
                                    </td>
                                </tr>
                            ) : filteredStaff.length > 0 ? (
                                filteredStaff.map(s => (
                                    <tr key={s.id} className="group hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-900">{s.full_name}</td>
                                        <td className="px-6 py-4 text-xs font-medium text-slate-500">{s.role}</td>
                                        <td className="px-6 py-4">
                                            <StatusBadge status={s.attendance?.status || 'EMPTY'} />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-[10px] font-bold text-slate-400">
                                                {s.attendance?.check_in ? new Date(s.attendance.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                                {' / '}
                                                {s.attendance?.check_out ? new Date(s.attendance.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 max-w-xs truncate text-xs text-slate-600 font-medium">
                                            {s.attendance?.notes || <span className="text-slate-300 italic">Sin observaciones</span>}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => {
                                                    setEditingRecord(s)
                                                    setNewStatus(s.attendance?.status || 'ABSENT')
                                                    setJustification(s.attendance?.notes || '')
                                                    setCheckInTime(s.attendance?.check_in ? new Date(s.attendance.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '')
                                                    setCheckOutTime(s.attendance?.check_out ? new Date(s.attendance.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '')
                                                }}
                                                className="p-2 hover:bg-white hover:shadow-md rounded-xl transition-all"
                                            >
                                                <FileText className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center text-slate-400 font-bold uppercase text-xs tracking-widest">
                                        No se encontró personal
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Justification Modal */}
            {editingRecord && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl animate-in zoom-in duration-300">
                        <div className="p-8">
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Justificar Asistencia</h3>
                            <p className="text-slate-500 font-medium mt-1">{editingRecord.full_name}</p>

                            <div className="mt-8 space-y-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nuevo Estatus</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { id: 'PRESENT', label: 'Presente', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
                                            { id: 'ABSENT', label: 'Falta', icon: XCircle, color: 'text-red-600 bg-red-50' },
                                            { id: 'LATE', label: 'Retardo', icon: Clock, color: 'text-amber-600 bg-amber-50' },
                                            { id: 'PERMIT', label: 'Permiso', icon: FileText, color: 'text-indigo-600 bg-indigo-50' },
                                        ].map(item => (
                                            <button
                                                key={item.id}
                                                onClick={() => setNewStatus(item.id)}
                                                className={`flex items-center gap-2 p-3 rounded-2xl border-2 transition-all ${newStatus === item.id ? 'border-blue-600 bg-blue-50 ring-4 ring-blue-50' : 'border-slate-50 hover:border-slate-100'}`}
                                            >
                                                <item.icon className="w-4 h-4" />
                                                <span className="text-xs font-bold">{item.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Motivo / Justificación</label>
                                    <textarea
                                        rows={4}
                                        value={justification}
                                        onChange={(e) => setJustification(e.target.value)}
                                        placeholder="Ingrese el motivo de la falta o retardo..."
                                        className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-medium outline-none focus:ring-2 ring-blue-100"
                                    />
                                </div>

                                {isManager && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Entrada Manual</label>
                                            <input
                                                type="time"
                                                value={checkInTime}
                                                onChange={(e) => setCheckInTime(e.target.value)}
                                                className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 ring-blue-100"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Salida Manual</label>
                                            <input
                                                type="time"
                                                value={checkOutTime}
                                                onChange={(e) => setCheckOutTime(e.target.value)}
                                                className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 ring-blue-100"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="mt-8 flex gap-3">
                                <button
                                    onClick={() => setEditingRecord(null)}
                                    className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveJustification}
                                    className="flex-1 py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-black transition-all"
                                >
                                    Guardar Cambios
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

const StatusBadge = ({ status }: { status: string }) => {
    const configs: any = {
        PRESENT: { label: 'Presente', color: 'text-emerald-600 bg-emerald-50' },
        ABSENT: { label: 'Falta', color: 'text-red-600 bg-red-50' },
        LATE: { label: 'Retardo', color: 'text-amber-600 bg-amber-50' },
        PERMIT: { label: 'Permiso', color: 'text-indigo-600 bg-indigo-50' },
        EMPTY: { label: 'Sin Registro', color: 'text-slate-300 bg-slate-50' }
    }
    const config = configs[status] || configs.EMPTY
    return (
        <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${config.color}`}>
            {config.label}
        </span>
    )
}
