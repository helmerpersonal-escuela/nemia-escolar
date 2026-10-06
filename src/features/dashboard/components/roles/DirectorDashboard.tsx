import { Link } from 'react-router-dom'
import { LayoutDashboard, Users, GraduationCap, School, CalendarCheck, Bell, CheckCircle2, AlertTriangle, Loader2, Megaphone } from 'lucide-react'
import { useTenant } from '../../../../hooks/useTenant'
import { formatDateEs } from '../../../../components/ui/DateInput'
import { useSchoolOverview, pct } from '../../lib/useSchoolOverview'
import { SetupStatusLine } from '../SchoolSetupChecklist'
import { SchoolTrialCard } from '../../../sales/SchoolTrialCard'

/** Inicio de la dirección: solo datos reales de la escuela; si aún no hay, dice qué hacer. */
export const DirectorDashboard = () => {
    const { data: tenant } = useTenant()
    const { data: o, isLoading } = useSchoolOverview()

    const todayPct = o ? pct(o.today.present, o.today.recorded) : null
    const alerts: { tone: 'warn' | 'bad'; title: string; text: string; to?: string }[] = []
    if (o) {
        if (o.subjectsWithoutTeacher > 0) alerts.push({ tone: 'warn', title: 'Materias sin docente', text: `${o.subjectsWithoutTeacher} materia(s) de grupos no tienen docente asignado.`, to: '/groups' })
        for (const g of o.lowAttendance.slice(0, 3)) alerts.push({ tone: 'bad', title: `Asistencia baja en ${g.group}`, text: `${g.pct}% en los últimos 30 días.`, to: '/groups' })
        if (o.groups > 0 && o.today.recorded === 0 && new Date().getDay() % 6 !== 0 && new Date().getHours() >= 10)
            alerts.push({ tone: 'warn', title: 'Hoy no se ha pasado lista', text: 'Ningún grupo tiene asistencia registrada hoy.' })
        if (o.openRequests > 0) alerts.push({ tone: 'warn', title: 'Solicitudes al técnico', text: `${o.openRequests} solicitud(es) sin terminar.`, to: '/solicitudes' })
    }

    return (
        <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500">
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className="bg-indigo-50 text-indigo-600 p-3 rounded-2xl"><LayoutDashboard className="w-6 h-6" /></div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Inicio de la dirección</h1>
                        <p className="text-slate-600">{tenant?.name || 'Tu escuela'}</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link to="/messages" className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-700">
                        <Bell className="w-5 h-5" /> Enviar comunicado
                    </Link>
                </div>
            </div>

            <SchoolTrialCard />

            {isLoading || !o ? (
                <p className="flex items-center gap-2 text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /> Cargando datos de la escuela…</p>
            ) : (
                <>
                    <SetupStatusLine o={o} />

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
                        <Stat icon={GraduationCap} title="Alumnos" value={o.students} hint={o.students ? 'Inscritos y activos' : 'Aún sin alumnos'} to="/alumnos/consulta" />
                        <Stat icon={Users} title="Personal" value={o.staff} hint={`${o.teachers} docente${o.teachers === 1 ? '' : 's'}`} to="/admin/staff" />
                        <Stat icon={School} title="Grupos" value={o.groups} hint={o.groups ? 'Del ciclo actual' : 'Aún sin grupos'} to="/groups" />
                        <Stat icon={CalendarCheck} title="Asistencia de hoy" value={todayPct === null ? '—' : `${todayPct}%`}
                            hint={o.today.recorded ? `${o.today.groupsTaken} de ${o.groups} grupos pasaron lista` : 'Sin registro hoy'} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <section className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-100">
                            <h3 className="text-lg font-black text-slate-900 mb-4">Requiere tu atención</h3>
                            {alerts.length === 0 ? (
                                <p className="text-sm text-slate-500 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Nada pendiente por ahora.</p>
                            ) : (
                                <ul className="space-y-3">
                                    {alerts.map((a, i) => (
                                        <li key={i}>
                                            <Link to={a.to || '#'} className={`block p-4 rounded-2xl border-l-4 ${a.tone === 'bad' ? 'bg-red-50 border-red-400' : 'bg-amber-50 border-amber-400'}`}>
                                                <p className="font-bold text-slate-900 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {a.title}</p>
                                                <p className="text-sm text-slate-600">{a.text}</p>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                                <div className="rounded-2xl bg-slate-50 p-3"><dt className="text-slate-500">Planeaciones este mes</dt><dd className="text-xl font-black text-slate-900">{o.plansThisMonth}</dd></div>
                                <div className="rounded-2xl bg-slate-50 p-3"><dt className="text-slate-500">Incidencias (30 días)</dt><dd className="text-xl font-black text-slate-900">{o.incidents30}</dd></div>
                            </dl>
                        </section>
                        <section className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-100">
                            <h3 className="text-lg font-black text-slate-900 mb-4">Últimos comunicados</h3>
                            {o.announcements.length === 0 ? (
                                <div className="text-center py-6">
                                    <Megaphone className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                    <p className="text-sm text-slate-500">Aún no envías comunicados.</p>
                                    <Link to="/messages" className="mt-3 inline-block text-sm font-bold text-indigo-700 underline">Enviar el primero</Link>
                                </div>
                            ) : (
                                <ul className="space-y-2">
                                    {o.announcements.map(a => (
                                        <li key={a.id} className="p-3 rounded-2xl bg-slate-50">
                                            <p className="font-bold text-slate-900">{a.title}</p>
                                            <p className="text-xs text-slate-500">{formatDateEs(a.created_at.slice(0, 10))}</p>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </div>
                </>
            )}
        </div>
    )
}

const Stat = ({ icon: Icon, title, value, hint, to }: { icon: any; title: string; value: number | string; hint: string; to?: string }) => {
    const body = (
        <div className="h-full bg-white p-4 sm:p-6 rounded-3xl border border-slate-100 hover:border-indigo-200 transition-colors">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3 bg-indigo-50 text-indigo-600"><Icon className="w-5 h-5" /></div>
            <p className="text-sm font-bold text-slate-500">{title}</p>
            <p className="text-2xl sm:text-3xl font-black text-slate-900">{value}</p>
            <p className="text-xs text-slate-500 mt-1">{hint}</p>
        </div>
    )
    return to ? <Link to={to} className="block">{body}</Link> : body
}
