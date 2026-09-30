import { Link } from 'react-router-dom'
import { Wrench, Loader2, LifeBuoy, Phone, IdCard, UserX, BookX, History, HeartHandshake, FileUp, ShieldCheck } from 'lucide-react'
import { useTenant } from '../../../../hooks/useTenant'
import { useSchoolOverview } from '../../lib/useSchoolOverview'
import { SetupChecklist } from '../SchoolSetupChecklist'

/**
 * Inicio del administrador técnico: arranque, calidad de los datos y solicitudes.
 * No muestra información para decisiones pedagógicas (asistencia, calificaciones, incidencias):
 * la base de datos tampoco se la entrega a este puesto.
 */
export const TechAdminDashboard = () => {
    const { data: tenant } = useTenant()
    const { data: o, isLoading } = useSchoolOverview()

    const quality = o ? [
        { icon: Phone, label: 'Tutores sin teléfono', value: o.guardiansNoPhone, to: '/groups' },
        { icon: IdCard, label: 'Alumnos sin CURP', value: o.studentsNoCurp, to: '/groups' },
        { icon: BookX, label: 'Materias sin docente', value: o.subjectsWithoutTeacher, to: '/groups' },
        { icon: UserX, label: 'Personal sin cuenta', value: o.staffWithoutAccount, to: '/settings?tab=personal' },
    ] : []

    return (
        <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500">
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className="bg-indigo-50 text-indigo-600 p-3 rounded-2xl"><Wrench className="w-6 h-6" /></div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Administración técnica</h1>
                        <p className="text-slate-600">{tenant?.name || 'Tu escuela'}</p>
                    </div>
                </div>
                <Link to="/solicitudes" className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-700">
                    <LifeBuoy className="w-5 h-5" /> Solicitudes{o && o.openRequests > 0 ? ` (${o.openRequests})` : ''}
                </Link>
            </div>

            <p className="flex items-start gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Tu puesto prepara y mantiene los datos de la escuela. Por privacidad, no ves calificaciones, asistencia, incidencias ni expedientes pedagógicos: eso es de la dirección y los docentes.</span>
            </p>

            {isLoading || !o ? (
                <p className="flex items-center gap-2 text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /> Cargando datos de la escuela…</p>
            ) : (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
                        {quality.map(q => (
                            <Link key={q.label} to={q.to} className={`block p-4 sm:p-5 rounded-3xl border ${q.value > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'} hover:border-indigo-300`}>
                                <q.icon className={`w-5 h-5 mb-2 ${q.value > 0 ? 'text-amber-700' : 'text-emerald-600'}`} />
                                <p className="text-sm font-bold text-slate-600">{q.label}</p>
                                <p className="text-2xl font-black text-slate-900">{q.value}</p>
                            </Link>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2"><SetupChecklist o={o} /></div>
                        <section className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 space-y-2">
                            <h3 className="text-lg font-black text-slate-900 mb-2">Accesos rápidos</h3>
                            <Quick to="/importar-datos" icon={FileUp} label="Importar datos de la escuela" />
                            <Quick to="/familias/codigos" icon={HeartHandshake} label="Códigos para familias" />
                            <Quick to="/settings?tab=personal" icon={UserX} label="Personal y accesos" />
                            <Quick to="/bitacora" icon={History} label="Bitácora de cambios" />
                            <dl className="grid grid-cols-3 gap-2 pt-3 text-center">
                                <div className="rounded-2xl bg-slate-50 p-2"><dt className="text-xs text-slate-500">Alumnos</dt><dd className="font-black text-slate-900">{o.students}</dd></div>
                                <div className="rounded-2xl bg-slate-50 p-2"><dt className="text-xs text-slate-500">Grupos</dt><dd className="font-black text-slate-900">{o.groups}</dd></div>
                                <div className="rounded-2xl bg-slate-50 p-2"><dt className="text-xs text-slate-500">Personal</dt><dd className="font-black text-slate-900">{o.staff}</dd></div>
                            </dl>
                        </section>
                    </div>
                </>
            )}
        </div>
    )
}

const Quick = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => (
    <Link to={to} className="flex items-center gap-3 min-h-[44px] px-3 rounded-2xl border border-slate-100 hover:border-indigo-300 text-sm font-bold text-slate-800">
        <Icon className="w-4 h-4 text-indigo-600" /> {label}
    </Link>
)
