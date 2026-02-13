import { useState, useEffect } from 'react'
import { Clock, CheckCircle2, QrCode, LogIn, LogOut, Loader2, AlertCircle } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { useToast } from '../../../components/ui/Toast'

export const AttendanceWidget = () => {
    const { data: tenant } = useTenant()
    const { showToast } = useToast()
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [dailyAttendance, setDailyAttendance] = useState<any | null>(null)
    const [teacherModules, setTeacherModules] = useState<any[]>([])
    const [currentDate, setCurrentDate] = useState(new Date())

    useEffect(() => {
        if (tenant?.id) {
            fetchAttendance()
        }
        const timer = setInterval(() => setCurrentDate(new Date()), 60000)
        return () => clearInterval(timer)
    }, [tenant?.id])

    const fetchAttendance = async () => {
        if (!tenant) return
        setLoading(true)

        const today = new Date().toISOString().split('T')[0]
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // 1. Fetch Daily Attendance (Staff/Admin)
        const { data: daily } = await supabase
            .from('staff_attendance')
            .select('*')
            .eq('profile_id', user.id)
            .eq('date', today)
            .maybeSingle()

        setDailyAttendance(daily)

        // 2. Fetch Teacher Modules if applicable
        if (tenant.role === 'TEACHER') {
            const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
            const dayOfWeek = days[new Date().getDay()]

            // Fetch schedule for today
            const { data: schedule } = await supabase
                .from('schedules')
                .select(`
                    *,
                    groups (grade, section),
                    subject_catalog (name)
                `)
                .eq('tenant_id', tenant.id)
                .eq('day_of_week', dayOfWeek)
                // Order by start_time to show in sequence
                .order('start_time', { ascending: true })

            // Fetch module attendance already registered today
            const { data: moduleAtt } = await supabase
                .from('teacher_module_attendance')
                .select('*')
                .eq('teacher_id', user.id)
                .eq('date', today)

            if (schedule) {
                const modulesWithStatus = schedule.map(entry => {
                    const att = moduleAtt?.find(a => a.schedule_id === entry.id)
                    return { ...entry, attenuation: att }
                })
                setTeacherModules(modulesWithStatus)
            }
        }
        setLoading(false)
    }

    const handleDailyCheckIn = async () => {
        if (!tenant) return
        setSubmitting(true)
        const today = new Date().toISOString().split('T')[0]
        const now = new Date().toISOString()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        try {
            const { error } = await supabase
                .from('staff_attendance')
                .upsert({
                    profile_id: user.id,
                    tenant_id: tenant.id,
                    date: today,
                    status: 'PRESENT',
                    check_in: now
                }, { onConflict: 'profile_id, date' })

            if (error) throw error
            fetchAttendance()
            showToast('Entrada registrada correctamente', 'success')
        } catch (error: any) {
            console.error(error)
            showToast('Error al registrar entrada', 'error')
        } finally {
            setSubmitting(false)
        }
    }

    const handleDailyCheckOut = async () => {
        if (!tenant || !dailyAttendance) return
        setSubmitting(true)
        const now = new Date().toISOString()

        try {
            const { error } = await supabase
                .from('staff_attendance')
                .update({ check_out: now })
                .eq('id', dailyAttendance.id)

            if (error) throw error
            fetchAttendance()
            showToast('Salida registrada correctamente', 'success')
        } catch (error: any) {
            console.error(error)
            showToast('Error al registrar salida', 'error')
        } finally {
            setSubmitting(false)
        }
    }

    const handleModuleCheckIn = async (scheduleId: string) => {
        if (!tenant) return
        setSubmitting(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        try {
            const { error } = await supabase
                .from('teacher_module_attendance')
                .insert({
                    teacher_id: user.id,
                    tenant_id: tenant.id,
                    schedule_id: scheduleId,
                    status: 'PRESENT',
                    check_in: new Date().toISOString()
                })

            if (error) throw error
            fetchAttendance()
            showToast('Clase iniciada correctamente', 'success')
        } catch (error: any) {
            console.error(error)
            showToast('Error al registrar inicio de clase: ' + (error.message || 'Intente nuevamente'), 'error')
        } finally {
            setSubmitting(false)
        }
    }

    const handleModuleCheckOut = async (attendanceId: string) => {
        if (!tenant) return
        setSubmitting(true)

        try {
            const { error } = await supabase
                .from('teacher_module_attendance')
                .update({ check_out: new Date().toISOString() })
                .eq('id', attendanceId)

            if (error) throw error
            fetchAttendance()
            showToast('Clase finalizada correctamente', 'success')
        } catch (error: any) {
            console.error(error)
            showToast('Error al finalizar clase: ' + (error.message || 'Intente nuevamente'), 'error')
        } finally {
            setSubmitting(false)
        }
    }

    const isCurrentModule = (start: string, end: string) => {
        const now = new Date()
        const [startH, startM] = start.split(':').map(Number)
        const [endH, endM] = end.split(':').map(Number)

        const startTime = new Date()
        startTime.setHours(startH, startM, 0)

        const endTime = new Date()
        endTime.setHours(endH, endM, 0)

        return now >= startTime && now <= endTime
    }

    if (loading) return (
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-50 flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
    )

    const isTeacher = tenant?.role === 'TEACHER'

    // Lockout Check
    const isLockedOut = dailyAttendance?.status === 'ABSENT'

    if (isLockedOut) return (
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-red-50 h-full flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-3">
                <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight mb-1">Registro Bloqueado</h3>
            <p className="text-xs text-slate-500 max-w-[200px]">
                Se ha registrado una inasistencia el día de hoy. Por favor, acuda con dirección para habilitar su registro.
            </p>
        </div>
    )

    return (
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-50 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4 text-blue-600" />
                    </div>
                    <h3 className="font-black text-slate-800 uppercase tracking-tight text-xs sm:text-sm">Asistencia</h3>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Hoy</p>
                    <p className="text-xs font-bold text-slate-600">{currentDate.toLocaleDateString()}</p>
                </div>
            </div>

            {/* Daily Attendance (Staff only needs this one strictly) */}
            {!isTeacher && (
                <div className="mb-6 pb-6 border-b border-slate-50">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Jornada Laboral</span>
                        {dailyAttendance?.check_in && !dailyAttendance?.check_out && (
                            <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-md uppercase">En Plantel</span>
                        )}
                        {dailyAttendance?.check_in && dailyAttendance?.check_out && (
                            <span className="text-[10px] font-black px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md uppercase">Finalizada</span>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {!dailyAttendance?.check_in ? (
                            <button
                                disabled={submitting}
                                onClick={handleDailyCheckIn}
                                className="col-span-2 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs shadow-lg shadow-blue-100 flex items-center justify-center gap-2 hover:bg-blue-700 transition-all hover:scale-[1.02]"
                            >
                                <LogIn className="w-4 h-4" /> Marcar Entrada
                            </button>
                        ) : !dailyAttendance?.check_out ? (
                            <>
                                <div className="p-3 bg-slate-50 rounded-2xl">
                                    <p className="text-[9px] font-black text-slate-400 uppercase">Entrada</p>
                                    <p className="text-sm font-black text-slate-700">
                                        {new Date(dailyAttendance.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                <button
                                    disabled={submitting}
                                    onClick={handleDailyCheckOut}
                                    className="py-3 bg-slate-900 text-white rounded-2xl font-black text-xs shadow-lg shadow-slate-200 flex items-center justify-center gap-2 hover:bg-black transition-all hover:scale-[1.02]"
                                >
                                    <LogOut className="w-4 h-4" /> Salida
                                </button>
                            </>
                        ) : (
                            <div className="col-span-2 p-4 bg-emerald-50 rounded-2xl flex items-center justify-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span className="text-xs font-black text-emerald-700 uppercase">Jornada Completada</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Module Attendance for Teachers */}
            {isTeacher && (
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 -mr-1">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Clases de Hoy (Módulos)</h4>
                    {teacherModules.length > 0 ? (
                        teacherModules.map(module => {
                            const active = isCurrentModule(module.start_time, module.end_time)
                            // A registered module now might be incomplete (entered but not exited)
                            const att = module.attenuation
                            const entered = !!att
                            const exited = !!att?.check_out

                            return (
                                <div key={module.id} className={`p-3 rounded-2xl border transition-all ${active ? 'border-blue-200 bg-blue-50/30' : 'border-slate-50 bg-white'}`}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400">{module.start_time.slice(0, 5)} - {module.end_time.slice(0, 5)}</p>
                                            <p className="text-xs font-black text-slate-700 leading-tight">
                                                {module.subject_catalog?.name || module.custom_subject}
                                            </p>
                                            <p className="text-[10px] font-medium text-slate-400">{module.groups?.grade}° "{module.groups?.section}"</p>
                                        </div>

                                        {/* State Logic: 
                                            1. Not Entered & Active -> Show ENTER button
                                            2. Entered & Not Exited -> Show EXIT button
                                            3. Exited -> Show Check Icon
                                            4. Not Active & Not Entered -> Show WAIT label
                                         */}

                                        {!entered && active ? (
                                            <button
                                                disabled={submitting}
                                                onClick={() => handleModuleCheckIn(module.id)}
                                                className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700"
                                            >
                                                Entrada
                                            </button>
                                        ) : entered && !exited ? (
                                            <button
                                                disabled={submitting}
                                                onClick={() => handleModuleCheckOut(att.id)}
                                                className="px-3 py-1.5 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-600 flex items-center gap-1"
                                            >
                                                Salida
                                            </button>
                                        ) : exited ? (
                                            <span className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                            </span>
                                        ) : (
                                            <span className="text-[9px] font-black text-slate-300 uppercase py-1.5">Espera</span>
                                        )}
                                    </div>
                                </div>
                            )
                        })
                    ) : (
                        <div className="py-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase">Sin módulos hoy</p>
                        </div>
                    )}
                </div>
            )}

            {!isTeacher && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                    <QrCode className="w-12 h-12 text-slate-200 mb-2" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asistencia Administrativa</p>
                    <p className="text-xs font-medium text-slate-500 mt-2">Tu registro se limita a la entrada y salida de la jornada laboral.</p>
                </div>
            )}
        </div>
    )
}
