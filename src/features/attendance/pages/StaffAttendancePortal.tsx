import { useState, useEffect } from 'react'
import { QrCode, UserCheck, Clock, ShieldCheck, Search, CheckCircle2, XCircle } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'

export const StaffAttendancePortal = () => {
    const { data: tenant } = useTenant()
    const [view, setView] = useState<'MONITOR' | 'CHECKIN'>('MONITOR')
    const [staff, setStaff] = useState<any[]>([])
    const [attendanceToday, setAttendanceToday] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        if (tenant?.id) {
            fetchData()
        }
    }, [tenant?.id])

    const fetchData = async () => {
        if (!tenant) return
        setLoading(true)

        // Fetch all profiles in tenant except students
        const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .eq('tenant_id', tenant.id)
            .neq('role', 'STUDENT')
            .order('full_name')

        // Fetch today's attendance
        const today = new Date().toISOString().split('T')[0]
        const { data: attendance } = await supabase
            .from('staff_attendance')
            .select('*')
            .eq('tenant_id', tenant.id)
            .eq('date', today)

        setStaff(profiles || [])
        setAttendanceToday(attendance || [])
        setLoading(false)
    }

    const handleCheckIn = async (profileId: string) => {
        if (!tenant) return
        setSubmitting(true)
        const today = new Date().toISOString().split('T')[0]
        const now = new Date().toISOString()

        try {
            const { error } = await supabase
                .from('staff_attendance')
                .upsert({
                    profile_id: profileId,
                    tenant_id: tenant.id,
                    date: today,
                    status: 'PRESENT',
                    check_in: now
                }, { onConflict: 'profile_id, date' })

            if (error) throw error
            fetchData()
        } catch (error: any) {
            alert('Error: ' + error.message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleCheckOut = async (profileId: string) => {
        if (!tenant) return
        setSubmitting(true)
        const today = new Date().toISOString().split('T')[0]
        const now = new Date().toISOString()

        try {
            const { error } = await supabase
                .from('staff_attendance')
                .update({ check_out: now })
                .eq('profile_id', profileId)
                .eq('date', today)

            if (error) throw error
            fetchData()
        } catch (error: any) {
            alert('Error: ' + error.message)
        } finally {
            setSubmitting(false)
        }
    }

    const getStatus = (profileId: string) => {
        return attendanceToday.find(a => a.profile_id === profileId)
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Portal de Asistencia de Personal</h1>
                    <p className="text-slate-500 font-medium">Control de entradas y salidas para seguridad institucional.</p>
                </div>
                <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-slate-100">
                    <button
                        onClick={() => setView('MONITOR')}
                        className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${view === 'MONITOR' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Monitoreo
                    </button>
                    <button
                        onClick={() => setView('CHECKIN')}
                        className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${view === 'CHECKIN' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Registrar Entrada
                    </button>
                </div>
            </div>

            {view === 'MONITOR' ? (
                <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-100 border border-slate-50 overflow-hidden">
                    <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                        <div className="relative w-72">
                            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                            <input
                                placeholder="Buscar personal..."
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 ring-blue-100 font-bold text-sm"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-4">
                            <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Personal Presente</p>
                                <p className="text-2xl font-black text-blue-600">{attendanceToday.length} / {staff.length}</p>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50/50">
                                    <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Colaborador</th>
                                    <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Rol</th>
                                    <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Entrada</th>
                                    <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Salida</th>
                                    <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                                    <th className="px-8 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {staff
                                    .filter(s => (s.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()))
                                    .map(p => {
                                        const att = getStatus(p.id)
                                        return (
                                            <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-8 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-sm">
                                                            {(p.full_name || 'U')[0]}
                                                        </div>
                                                        <span className="font-bold text-slate-900">{p.full_name || 'Sin Nombre'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-4">
                                                    <span className="text-[10px] font-black px-2 py-1 bg-slate-100 text-slate-600 rounded-md uppercase tracking-wider">{p.role}</span>
                                                </td>
                                                <td className="px-8 py-4 font-bold text-slate-600">
                                                    {att?.check_in ? new Date(att.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                                </td>
                                                <td className="px-8 py-4 font-bold text-slate-600">
                                                    {att?.check_out ? new Date(att.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                                </td>
                                                <td className="px-8 py-4">
                                                    {att ? (
                                                        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center w-fit gap-1">
                                                            <CheckCircle2 className="w-3 h-3" /> Presente
                                                        </span>
                                                    ) : (
                                                        <span className="px-3 py-1 bg-slate-50 text-slate-400 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center w-fit gap-1">
                                                            <Clock className="w-3 h-3" /> Pendiente
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-8 py-4 text-right">
                                                    {!att ? (
                                                        <button
                                                            disabled={submitting}
                                                            onClick={() => handleCheckIn(p.id)}
                                                            className="text-xs font-black text-blue-600 hover:text-blue-800 uppercase tracking-widest"
                                                        >
                                                            Marcar Entrada
                                                        </button>
                                                    ) : !att.check_out ? (
                                                        <button
                                                            disabled={submitting}
                                                            onClick={() => handleCheckOut(p.id)}
                                                            className="text-xs font-black text-red-600 hover:text-red-800 uppercase tracking-widest"
                                                        >
                                                            Marcar Salida
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Completado</span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-[500px]">
                    <div className="bg-slate-900 rounded-[2rem] p-12 text-white flex flex-col items-center justify-center text-center shadow-2xl shadow-slate-200">
                        <div className="w-64 h-64 bg-white rounded-3xl p-8 mb-8 relative overflow-hidden group">
                            <div className="absolute inset-0 bg-slate-50 flex items-center justify-center">
                                <QrCode className="w-48 h-48 text-slate-900 animate-pulse" />
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/20 to-transparent pointer-events-none" />
                        </div>
                        <h3 className="text-2xl font-black mb-4">Escanear Código QR</h3>
                        <p className="text-slate-400 font-medium mb-8">El personal puede usar su identificación digital para registrar su asistencia al instante.</p>
                        <div className="flex gap-4">
                            <span className="px-4 py-2 bg-white/10 rounded-xl text-xs font-bold flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Sistema Seguro
                            </span>
                        </div>
                    </div>

                    <div className="bg-white rounded-[2rem] p-12 border border-slate-100 flex flex-col items-center justify-center text-center">
                        <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-[2rem] flex items-center justify-center mb-8">
                            <UserCheck className="w-12 h-12" />
                        </div>
                        <h3 className="text-2xl font-black mb-4 text-slate-900">Registro Manual</h3>
                        <p className="text-slate-500 font-medium mb-8">Si el colaborador no tiene su código, puede registrar su entrada buscando su nombre en el monitor.</p>
                        <button
                            onClick={() => setView('MONITOR')}
                            className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all hover:scale-105"
                        >
                            Abrir Monitor de Personal
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
