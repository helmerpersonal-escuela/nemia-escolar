import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { UserPlus, FileText, FileSearch, CalendarClock, ClipboardList, Loader2, GraduationCap, School, AlertTriangle } from 'lucide-react'
import { supabase } from '../../../../lib/supabase'
import { useTenant } from '../../../../hooks/useTenant'
import { useMyAssignment } from '../../../../hooks/useMyAssignment'

/** Inicio de control escolar / secretaría: su encargo y datos reales de sus grados. */
export const ControlEscolarDashboard = () => {
    const { data: tenant } = useTenant()
    const { data: me, isLoading: loadingMe } = useMyAssignment()
    const grades = me?.assigned_grades || []

    const { data: stats, isLoading } = useQuery({
        queryKey: ['control-escolar-stats', tenant?.id, grades.join(',')],
        enabled: !!tenant?.id && !loadingMe,
        queryFn: async () => {
            let gq = supabase.from('groups').select('id, grade, section').eq('tenant_id', tenant!.id).is('archived_at', null)
            if (grades.length) gq = gq.in('grade', grades)
            const { data: groups } = await gq
            const ids = (groups || []).map(g => g.id)
            if (!ids.length) return { groups: 0, students: 0, noCurp: 0 }
            const { data: studs } = await supabase.from('students').select('id, curp, status').in('group_id', ids)
            const active = (studs || []).filter((s: any) => !['GRADUATED', 'INACTIVE'].includes(String(s.status || '').toUpperCase()))
            return { groups: ids.length, students: active.length, noCurp: active.filter((s: any) => !s.curp || String(s.curp).trim().length < 18).length }
        },
    })

    const scope = grades.length ? `Grados a tu cargo: ${grades.map(g => `${g}°`).join(', ')}` : 'Atiendes todos los grados'

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-12">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className="bg-indigo-50 text-indigo-600 p-3 rounded-2xl"><FileText className="w-6 h-6" /></div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{me?.job_title || 'Control escolar'}</h1>
                        <p className="text-slate-600">{tenant?.name} · {scope}</p>
                    </div>
                </div>
                <Link to="/groups" className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-700">
                    <UserPlus className="w-5 h-5" /> Inscribir alumnos
                </Link>
            </div>

            <section className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100">
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2"><ClipboardList className="w-5 h-5 text-indigo-600" /> Actividades que te asignó la dirección</h2>
                {loadingMe ? <p className="text-sm text-slate-500 mt-2">Cargando…</p> : me?.duties ? (
                    <p className="mt-2 text-slate-700 whitespace-pre-line">{me.duties}</p>
                ) : (
                    <p className="mt-2 text-sm text-slate-500">La dirección todavía no te asigna actividades. Las verás aquí cuando lo haga (Configuración → Personal: altas y bajas → Encargo).</p>
                )}
            </section>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                <Stat icon={School} title="Grupos" value={isLoading ? '…' : stats?.groups ?? 0} hint={grades.length ? 'De tus grados' : 'De la escuela'} />
                <Stat icon={GraduationCap} title="Alumnos" value={isLoading ? '…' : stats?.students ?? 0} hint="Activos" />
                <Stat icon={AlertTriangle} title="Sin CURP completa" value={isLoading ? '…' : stats?.noCurp ?? 0} hint={stats?.noCurp ? 'Revisa sus expedientes' : 'Todo en orden'} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
                <Action to="/groups" icon={UserPlus} title="Inscripciones" text="Grupos y alta de alumnos" />
                <Action to="/students" icon={FileSearch} title="Expedientes" text="Datos, CURP y seguimiento" />
                <Action to="/reports/evaluation" icon={FileText} title="Boletas" text="Documentos de evaluación" />
                <Action to="/schedule" icon={CalendarClock} title="Horarios" text="Horarios de docentes" />
            </div>
        </div>
    )
}

const Stat = ({ icon: Icon, title, value, hint }: any) => (
    <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-100">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3 bg-indigo-50 text-indigo-600"><Icon className="w-5 h-5" /></div>
        <p className="text-sm font-bold text-slate-500">{title}</p>
        <p className="text-2xl sm:text-3xl font-black text-slate-900">{value}</p>
        <p className="text-xs text-slate-500 mt-1">{hint}</p>
    </div>
)

const Action = ({ to, icon: Icon, title, text }: any) => (
    <Link to={to} className="p-5 bg-white rounded-3xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition-colors">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3 bg-indigo-50 text-indigo-600"><Icon className="w-5 h-5" /></div>
        <p className="font-bold text-slate-900">{title}</p>
        <p className="text-sm text-slate-500">{text}</p>
    </Link>
)
