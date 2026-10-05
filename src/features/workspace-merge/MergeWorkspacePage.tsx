import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Combine, Loader2, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useTenant, useWorkspaces } from '../../hooks/useTenant'
import { useToast } from '../../components/ui/Toast'
import { askConfirm } from '../../components/ui/ConfirmDialog'

type GroupRow = { id: string; name: string; school_group_id: string | null; students: number; matched: number; school_students: number; plans: number; attendance: number }
type Preview = { groups: GroupRow[]; programs: number; rubrics: number; previous: number }
type Summary = Record<'students_added' | 'students_completed' | 'guardians_added' | 'subjects' | 'subject_conflicts' | 'plans' | 'programs' | 'rubrics' | 'attendance' | 'groups_unmatched', number>

const OPTIONS: { id: string; label: string; hint: string }[] = [
    { id: 'students', label: 'Alumnos y tutores que le faltan a la escuela', hint: 'Agrega a los alumnos que tú tienes y la escuela no, con sus tutores y teléfonos. A los que ya están solo les completa datos vacíos (CURP, sexo, fecha de nacimiento).' },
    { id: 'subjects', label: 'Mis materias en esos grupos', hint: 'Te asigna las materias que están sin docente o las crea. No toca las que ya tiene otro docente.' },
    { id: 'plans', label: 'Mis planeaciones', hint: 'Llegan como borrador a los mismos grupos.' },
    { id: 'programs', label: 'Mi programa analítico', hint: 'Como borrador, en el ciclo activo de la escuela.' },
    { id: 'rubrics', label: 'Mis instrumentos de evaluación', hint: 'Rúbricas, listas de cotejo y demás.' },
    { id: 'attendance', label: 'La asistencia que ya registré', hint: 'Si ese día la escuela ya tiene registro de un alumno, se respeta el de la escuela.' },
]

/**
 * Para el docente que ya usaba VUNLEK por su cuenta y ahora su escuela lo invitó:
 * suma lo de su espacio personal al de la escuela. Solo agrega; no borra ni sobrescribe.
 */
export const MergeWorkspacePage = () => {
    const { data: tenant } = useTenant()
    const { data: workspaces, isLoading: loadingWs } = useWorkspaces()
    const { showToast } = useToast()
    const personal = useMemo(() => (workspaces ?? []).filter(w => String(w.type).toUpperCase() === 'INDEPENDENT'), [workspaces])
    const [fromId, setFromId] = useState<string>('')
    const [preview, setPreview] = useState<Preview | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [opts, setOpts] = useState<Record<string, boolean>>(() => Object.fromEntries(OPTIONS.map(o => [o.id, true])))
    const [busy, setBusy] = useState(false)
    const [done, setDone] = useState<Summary | null>(null)
    const toId = (tenant as any)?.id as string | undefined
    const isSchool = (tenant as any)?.type === 'SCHOOL'

    useEffect(() => { if (!fromId && personal[0]) setFromId(personal[0].id) }, [personal, fromId])

    useEffect(() => {
        if (!fromId || !toId || !isSchool) return
        let alive = true
        setLoading(true); setError(null)
        supabase.rpc('merge_preview', { p_from: fromId, p_to: toId }).then(({ data, error }) => {
            if (!alive) return
            setLoading(false)
            if (error) { setError(error.message); return }
            setPreview(data as Preview)
        })
        return () => { alive = false }
    }, [fromId, toId, isSchool])

    const matched = preview?.groups.filter(g => g.school_group_id) ?? []
    const unmatched = preview?.groups.filter(g => !g.school_group_id) ?? []
    const toAdd = matched.reduce((n, g) => n + (g.students - g.matched), 0)

    const run = async () => {
        if (!fromId || !toId) return
        if (!(await askConfirm(`Se sumará tu información a ${(tenant as any)?.name}. Solo se agrega: no se borra ni se cambia nada de lo que la escuela ya tiene, y tu espacio personal queda igual.`, { title: 'Sumar mi información', confirmLabel: 'Sí, sumar' }))) return
        setBusy(true)
        const { data, error } = await supabase.rpc('merge_workspace', { p_from: fromId, p_to: toId, p_opts: opts })
        setBusy(false)
        if (error) { showToast('No se pudo sumar: ' + error.message, 'error'); return }
        try { localStorage.setItem(`vunlek_suma_${toId}`, 'hecha') } catch { /* nada */ }
        setDone(data as Summary)
    }

    const Header = (
        <div className="bg-white rounded-3xl p-6 border border-slate-100 flex items-start gap-3">
            <div className="bg-indigo-50 text-indigo-600 p-3 rounded-2xl"><Combine className="w-6 h-6" /></div>
            <div>
                <h1 className="text-2xl font-black text-slate-900">Sumar mi espacio personal a la escuela</h1>
                <p className="text-slate-600 text-sm">Si ya usabas VUNLEK por tu cuenta, trae aquí tus grupos, planeaciones y registros para no capturar dos veces.</p>
            </div>
        </div>
    )

    if (loadingWs || !tenant) return <p className="flex items-center gap-2 text-slate-500 p-6"><Loader2 className="w-5 h-5 animate-spin" /> Cargando…</p>

    if (!isSchool) return (
        <div className="max-w-3xl mx-auto space-y-4">{Header}
            <p className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-sm text-amber-900">Esto se hace estando dentro de la escuela. Cambia a la escuela desde <b>Espacio de trabajo</b> (en el menú) y vuelve a entrar aquí.</p>
        </div>
    )
    if (!personal.length) return (
        <div className="max-w-3xl mx-auto space-y-4">{Header}
            <p className="bg-white border border-slate-100 rounded-2xl p-4 text-sm text-slate-600">Tu cuenta no tiene un espacio personal de docente, así que no hay nada que sumar.</p>
        </div>
    )

    if (done) return (
        <div className="max-w-3xl mx-auto space-y-4">{Header}
            <section className="bg-white rounded-3xl border border-emerald-100 p-6 space-y-3">
                <h2 className="font-black text-slate-900 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-600" /> Listo: tu información ya está en la escuela</h2>
                <ul className="text-sm text-slate-700 grid sm:grid-cols-2 gap-x-6 gap-y-1">
                    <li><b>{done.students_added}</b> alumnos agregados</li>
                    <li><b>{done.students_completed}</b> alumnos con datos completados</li>
                    <li><b>{done.guardians_added}</b> tutores agregados</li>
                    <li><b>{done.subjects}</b> materias asignadas a ti</li>
                    <li><b>{done.plans}</b> planeaciones</li>
                    <li><b>{done.programs}</b> programas analíticos</li>
                    <li><b>{done.rubrics}</b> instrumentos</li>
                    <li><b>{done.attendance}</b> registros de asistencia</li>
                </ul>
                {done.subject_conflicts > 0 && <p className="text-sm text-amber-900 bg-amber-50 rounded-2xl p-3">{done.subject_conflicts} materia(s) ya tienen otro docente en la escuela y no se cambiaron. Si son tuyas, pídelo en Solicitudes.</p>}
                {done.groups_unmatched > 0 && <p className="text-sm text-amber-900 bg-amber-50 rounded-2xl p-3">{done.groups_unmatched} de tus grupos no existen en la escuela. Pide que los creen y vuelve a correr esta suma: lo ya sumado no se duplica.</p>}
                <p className="text-sm text-slate-600">La escuela recibió un aviso para revisar lo que se agregó. Tu espacio personal sigue disponible en <b>Espacio de trabajo</b>.</p>
                <Link to="/groups" className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-2xl bg-indigo-600 text-white font-black text-sm">Ver mis grupos <ArrowRight className="w-4 h-4" /></Link>
            </section>
        </div>
    )

    return (
        <div className="max-w-3xl mx-auto space-y-4 animate-in fade-in duration-500">
            {Header}
            <p className="flex items-start gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Solo se <b>agrega</b>: nada de la escuela se borra ni se cambia, tu espacio personal queda intacto y puedes repetirlo sin que se duplique.</span>
            </p>
            {personal.length > 1 && (
                <label className="block text-sm font-bold text-slate-700">Espacio personal
                    <select value={fromId} onChange={e => setFromId(e.target.value)} className="mt-1 w-full min-h-[44px] rounded-2xl border border-slate-200 px-3 bg-white">
                        {personal.map(w => <option key={w.key} value={w.id}>{w.name}</option>)}
                    </select>
                </label>
            )}
            {loading ? <p className="flex items-center gap-2 text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /> Comparando tu información con la de la escuela…</p>
                : error ? <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-100 rounded-2xl p-4">{error}</p>
                : preview && (
                    <>
                        <section className="bg-white rounded-3xl border border-slate-100 p-5 space-y-3">
                            <h2 className="font-black text-slate-900">Tus grupos</h2>
                            {preview.groups.length === 0 && <p className="text-sm text-slate-500">No tienes grupos en tu espacio personal.</p>}
                            <ul className="space-y-2">
                                {matched.map(g => (
                                    <li key={g.id} className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-3 text-sm">
                                        <p className="font-black text-slate-900 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> {g.name} · existe en la escuela</p>
                                        <p className="text-slate-600">Tú tienes {g.students} alumnos y la escuela {g.school_students}: <b>{g.matched} coinciden</b>{g.students - g.matched > 0 ? <> y <b>{g.students - g.matched} se agregarían</b></> : null}. {g.plans} planeaciones · {g.attendance} registros de asistencia.</p>
                                    </li>
                                ))}
                                {unmatched.map(g => (
                                    <li key={g.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm">
                                        <p className="font-black text-slate-900 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" /> {g.name} · no existe en la escuela</p>
                                        <p className="text-slate-600">No se suma hasta que la escuela cree ese grupo ({g.students} alumnos, {g.plans} planeaciones).{' '}
                                            <Link className="font-bold text-indigo-700 underline" to={`/solicitudes?tipo=GRUPOS&titulo=${encodeURIComponent(`Crear el grupo ${g.name}`)}&detalle=${encodeURIComponent('Lo necesito para sumar la información de mi espacio personal.')}`}>Pedir que lo creen</Link>
                                        </p>
                                    </li>
                                ))}
                            </ul>
                            {(preview.programs > 0 || preview.rubrics > 0) && <p className="text-sm text-slate-600">Además: {preview.programs} programa(s) analítico(s) y {preview.rubrics} instrumento(s) de evaluación.</p>}
                            {preview.previous > 0 && <p className="text-sm text-indigo-900 bg-indigo-50 rounded-2xl p-3">Ya hiciste esta suma antes. Si la repites solo se agrega lo nuevo.</p>}
                        </section>

                        <section className="bg-white rounded-3xl border border-slate-100 p-5 space-y-3">
                            <h2 className="font-black text-slate-900">Qué quieres sumar</h2>
                            {OPTIONS.map(o => (
                                <label key={o.id} className="flex items-start gap-3 rounded-2xl border border-slate-100 p-3 cursor-pointer">
                                    <input type="checkbox" className="mt-1 w-5 h-5 accent-indigo-600" checked={!!opts[o.id]} onChange={e => setOpts(x => ({ ...x, [o.id]: e.target.checked }))} />
                                    <span><span className="block font-bold text-slate-900 text-sm">{o.label}</span><span className="block text-xs text-slate-500">{o.hint}</span></span>
                                </label>
                            ))}
                            <p className="text-xs text-slate-500">Las calificaciones y actividades no se copian todavía (dependen de los criterios de evaluación de cada escuela); siguen en tu espacio personal.</p>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="text-sm text-slate-600">{matched.length} grupo(s) listos{toAdd > 0 && opts.students ? ` · ${toAdd} alumno(s) por agregar` : ''}</p>
                                <button type="button" disabled={busy || matched.length === 0 && !preview.programs && !preview.rubrics || !Object.values(opts).some(Boolean)} onClick={run}
                                    className="inline-flex items-center gap-2 min-h-[48px] px-6 rounded-2xl bg-emerald-600 text-white font-black hover:bg-emerald-700 disabled:opacity-50">
                                    {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Combine className="w-5 h-5" />} Sumar a la escuela
                                </button>
                            </div>
                        </section>
                    </>
                )}
        </div>
    )
}
