import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ChevronDown, Eye, KeyRound, Loader2, MailCheck, RotateCcw, Search, ShieldCheck, Trash2, UserMinus, X } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { roleLabel } from '../../../lib/roleLabels'
import { askConfirm } from '../../../components/ui/ConfirmDialog'

export interface AdminPerson {
    id: string
    email: string | null
    first_name: string | null
    last_name_paternal: string | null
    last_name_maternal: string | null
    role: string | null
    tenant_id: string | null
    created_at: string | null
    deleted_at: string | null
    email_confirmed: boolean
    last_sign_in_at: string | null
    is_god: boolean
    spaces: { tenant_id: string; name: string; type: string; role: string }[]
    home_space: string | null
}

interface Footprint {
    email: string | null
    blocked: string | null
    spaces: { tenant_id: string; name: string; type: string; role: string; other_members: number; students: number }[]
    references: { table: string; column: string; rows: number; effect: 'DELETE' | 'KEEP' }[]
}

export type Notify = (tone: 'success' | 'error' | 'info', text: string) => void
export const ADMIN_PEOPLE_KEY = ['admin-people']
export const ADMIN_SPACES_KEY = ['admin-spaces']

export const fetchAdminPeople = async (): Promise<AdminPerson[]> => {
    const { data, error } = await supabase.rpc('admin_people' as any)
    if (error) throw error
    return (data ?? []) as AdminPerson[]
}

const TABLE_LABEL: Record<string, string> = {
    chat_messages: 'mensajes de chat', chat_participants: 'conversaciones de chat', audit_logs: 'registros de bitácora',
    profile_tenants: 'puestos en espacios', teacher_events: 'eventos de su agenda', push_subscriptions: 'dispositivos con avisos',
    subscriptions: 'suscripción anterior', guardians: 'vínculos como tutor', students: 'vínculos como alumno',
    staff_invitations: 'invitaciones enviadas', school_announcements: 'avisos enviados', student_citations: 'citatorios solicitados',
    evidence_portfolio: 'evidencias del portafolio', lesson_plans: 'planeaciones', client_errors: 'reportes de error',
}
const tableLabel = (t: string) => TABLE_LABEL[t.replace(/^public\./, '')] ?? t.replace(/^public\./, '').replace(/_/g, ' ')

const fullName = (p: AdminPerson) => [p.first_name, p.last_name_paternal, p.last_name_maternal].filter(Boolean).join(' ') || 'Sin nombre'
const shortDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : null
/** Día en que la tarea automática borra definitivamente una cuenta dada de baja (25 días después). */
const PURGE_START = Date.parse('2026-10-06T00:00:00Z')
export const purgeDate = (deletedAt: string) => new Date(Math.max(Date.parse(deletedAt), PURGE_START) + 25 * 86_400_000).toISOString()
const missingFunction = (e: any) => e?.code === 'PGRST202' || /could not find the function|does not exist/i.test(String(e?.message ?? ''))

type Filter = 'active' | 'admins' | 'deleted'

export const PeoplePanel = ({ search, notify, spaceFilter, onClearSpace, initialFilter }: {
    search: string
    notify: Notify
    spaceFilter?: { id: string; name: string } | null
    onClearSpace?: () => void
    initialFilter?: Filter
}) => {
    const qc = useQueryClient()
    const { data: people = [], isLoading, error } = useQuery({ queryKey: ADMIN_PEOPLE_KEY, queryFn: fetchAdminPeople, staleTime: 30_000 })
    const { data: purges } = useQuery({ queryKey: ['admin-purges'], staleTime: 5 * 60_000, queryFn: async () => ((await supabase.rpc('admin_account_purges' as any)).data ?? null) as { failed: { error: string }[] } | null })
    const [filter, setFilter] = useState<Filter>(initialFilter ?? 'active')
    const [open, setOpen] = useState<string | null>(null)
    const [busy, setBusy] = useState<string | null>(null)
    const [toDelete, setToDelete] = useState<AdminPerson | null>(null)
    const [temp, setTemp] = useState<{ email: string; password: string } | null>(null)

    useEffect(() => { if (initialFilter) setFilter(initialFilter) }, [initialFilter])

    const counts = useMemo(() => ({
        active: people.filter(p => !p.deleted_at && !p.is_god).length,
        admins: people.filter(p => !p.deleted_at && p.is_god).length,
        deleted: people.filter(p => p.deleted_at).length,
    }), [people])

    const shown = useMemo(() => {
        const q = search.trim().toLowerCase()
        return people.filter(p => {
            if (filter === 'deleted' ? !p.deleted_at : !!p.deleted_at) return false
            if (filter === 'admins' && !p.is_god) return false
            if (filter === 'active' && p.is_god) return false
            if (spaceFilter && filter !== 'deleted' && !p.spaces.some(s => s.tenant_id === spaceFilter.id)) return false
            if (spaceFilter && filter === 'deleted' && p.tenant_id !== spaceFilter.id) return false
            if (!q) return true
            return [p.email, fullName(p), roleLabel(p.role), ...p.spaces.map(s => s.name)].some(v => String(v ?? '').toLowerCase().includes(q))
        })
    }, [people, filter, search, spaceFilter])

    const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ADMIN_PEOPLE_KEY }), qc.invalidateQueries({ queryKey: ADMIN_SPACES_KEY })])

    /** Ejecuta una acción con aviso de resultado; nunca recarga la página. */
    const run = async (id: string, action: () => PromiseLike<{ error: any }>, ok: string) => {
        setBusy(id)
        try {
            const { error: e } = await action()
            if (e) throw e
            notify('success', ok)
            await refresh()
        } catch (e: any) {
            notify('error', e?.message ?? 'No se pudo completar la acción')
        } finally {
            setBusy(null)
        }
    }

    const viewAs = (p: AdminPerson) => window.open(`${window.location.origin}/?impersonate=${p.id}`, '_blank')

    const softDelete = async (p: AdminPerson) => {
        if (!(await askConfirm(`¿Dar de baja a ${fullName(p)}? Ya no podrá entrar. Su información se conserva y puedes restaurar la cuenta desde "Dadas de baja".`))) return
        await run(p.id, () => supabase.rpc('soft_delete_account' as any, { target_user_id: p.id }), 'Cuenta dada de baja. Está en "Dadas de baja" por si necesitas restaurarla.')
    }
    const restore = async (p: AdminPerson) => {
        if (!(await askConfirm(`¿Restaurar la cuenta de ${p.email ?? fullName(p)}? Recupera su correo y su acceso.`))) return
        await run(p.id, () => supabase.rpc('admin_restore_account' as any, { p_user: p.id }), 'Cuenta restaurada. Si entraba con contraseña, envíale un enlace para crear una nueva.')
    }
    const verify = async (p: AdminPerson) => {
        if (!(await askConfirm(`¿Marcar el correo ${p.email} como verificado?`))) return
        await run(p.id, () => supabase.rpc('admin_verify_email' as any, { target_user_id: p.id }), 'Correo marcado como verificado.')
    }
    const sendReset = async (p: AdminPerson) => {
        if (!p.email) return
        await run(p.id, () => supabase.auth.resetPasswordForEmail(p.email!), `Se envió a ${p.email} el enlace para crear una contraseña nueva.`)
    }
    const provisional = async (p: AdminPerson) => {
        if (!p.email || !(await askConfirm(`¿Poner una contraseña provisional a ${p.email}? La anterior dejará de funcionar.`))) return
        const password = String(Math.floor(100000 + Math.random() * 900000))
        setBusy(p.id)
        const { error: e } = await supabase.rpc('admin_set_any_password' as any, { target_user_id: p.id, new_password: password })
        setBusy(null)
        if (e) return notify('error', e.message)
        setTemp({ email: p.email, password })
    }

    const chips: [Filter, string, number][] = [['active', 'Activas', counts.active], ['admins', 'Super administradores', counts.admins], ['deleted', 'Dadas de baja', counts.deleted]]

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Tipo de cuenta">
                {chips.map(([id, label, n]) => (
                    <button key={id} role="tab" aria-selected={filter === id} onClick={() => { setFilter(id); setOpen(null) }}
                        className={`min-h-11 px-4 rounded-2xl text-sm font-black border-2 transition ${filter === id ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300'}`}>
                        {label} <span className={`ml-1 text-xs ${filter === id ? 'text-indigo-100' : 'text-slate-400'}`}>{n}</span>
                    </button>
                ))}
                {spaceFilter && (
                    <span className="inline-flex items-center gap-2 min-h-11 pl-4 pr-2 rounded-2xl bg-amber-50 border-2 border-amber-200 text-sm font-bold text-amber-900">
                        Solo de: {spaceFilter.name}
                        <button onClick={onClearSpace} aria-label="Quitar filtro de espacio" className="p-1.5 rounded-xl hover:bg-amber-100"><X className="w-4 h-4" /></button>
                    </span>
                )}
            </div>

            {filter === 'deleted' && (
                <p className="text-sm text-slate-600 bg-white border border-slate-200 rounded-2xl p-4">
                    Estas cuentas ya no pueden entrar. <b>Se eliminan solas, de forma definitiva, 25 días después de la baja</b> (para cumplir el plazo de 30 días de la Política de Privacidad). Antes de esa fecha puedes <b>Restaurar</b> la cuenta o <b>Eliminarla definitivamente</b> de una vez.
                </p>
            )}

            {temp && (
                <div role="status" className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-emerald-900">Contraseña provisional de <b>{temp.email}</b>: <code className="text-lg font-black tracking-widest ml-1">{temp.password}</code><br /><span className="text-xs">Compártela por un medio seguro y pídele que la cambie al entrar. No se volverá a mostrar.</span></p>
                    <button onClick={() => setTemp(null)} className="min-h-11 px-4 rounded-xl bg-emerald-600 text-white text-sm font-black">Ya la copié</button>
                </div>
            )}

            {filter === 'deleted' && purges?.failed?.length ? <p role="alert" className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-sm font-bold">{purges.failed.length} cuenta(s) no se pudieron eliminar automáticamente ({purges.failed[0].error}). Elimínalas a mano o avisa a soporte técnico.</p> : null}
            {isLoading && <div className="py-16 flex justify-center"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>}
            {error && <p role="alert" className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 text-sm font-bold">No se pudo cargar la lista: {(error as any).message}</p>}

            {!isLoading && !error && shown.length === 0 && (
                <div className="bg-white border border-slate-200 rounded-3xl py-14 text-center">
                    <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-600 font-bold">{search.trim() || spaceFilter ? 'Nadie coincide con la búsqueda.' : filter === 'deleted' ? 'No hay cuentas dadas de baja.' : 'No hay cuentas en esta lista.'}</p>
                </div>
            )}

            <ul className="space-y-2">
                {shown.map(p => {
                    const isOpen = open === p.id
                    const working = busy === p.id
                    return (
                        <li key={p.id} className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
                            <div className="flex flex-wrap items-center gap-3 p-4">
                                <div className="w-11 h-11 shrink-0 rounded-2xl bg-indigo-50 text-indigo-700 font-black text-sm flex items-center justify-center uppercase">
                                    {(p.first_name?.[0] ?? p.email?.[0] ?? '?')}{p.last_name_paternal?.[0] ?? ''}
                                </div>
                                <div className="min-w-0 flex-1 basis-56">
                                    <p className="font-black text-slate-900 truncate">{fullName(p)}</p>
                                    <p className="text-sm text-slate-600 break-all">{p.email ?? 'Sin correo'}</p>
                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-black">{p.is_god ? 'Super administrador' : roleLabel(p.role) || 'Sin puesto'}</span>
                                        {(p.spaces.length ? p.spaces.map(s => s.name) : p.home_space ? [p.home_space] : []).slice(0, 2).map(n => (
                                            <span key={n} className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-[11px] font-bold max-w-[16rem] truncate">{n}</span>
                                        ))}
                                        {!p.deleted_at && !p.email_confirmed && <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 text-[11px] font-black">Correo sin verificar</span>}
                                        {p.deleted_at && <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 text-[11px] font-black">Baja: {shortDate(p.deleted_at)}</span>}
                                        {p.deleted_at && <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-bold">Se elimina el {shortDate(purgeDate(p.deleted_at))}</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 ml-auto">
                                    {working && <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />}
                                    {p.deleted_at
                                        ? <button onClick={() => restore(p)} disabled={working} className="inline-flex items-center gap-1.5 min-h-11 px-4 rounded-2xl bg-emerald-600 text-white text-sm font-black disabled:opacity-50"><RotateCcw className="w-4 h-4" /> Restaurar</button>
                                        : !p.is_god && <button onClick={() => viewAs(p)} className="inline-flex items-center gap-1.5 min-h-11 px-4 rounded-2xl bg-indigo-50 text-indigo-700 text-sm font-black hover:bg-indigo-100"><Eye className="w-4 h-4" /> Ver como</button>}
                                    <button onClick={() => setOpen(isOpen ? null : p.id)} aria-expanded={isOpen} aria-label={`Más acciones para ${fullName(p)}`}
                                        className="inline-flex items-center gap-1 min-h-11 px-3 rounded-2xl border border-slate-200 text-sm font-bold text-slate-700">
                                        Más <ChevronDown className={`w-4 h-4 transition ${isOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                </div>
                            </div>
                            {isOpen && (
                                <div className="border-t border-slate-100 bg-slate-50 p-4 space-y-3">
                                    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                                        <div><dt className="text-[11px] font-black uppercase tracking-wider text-slate-400">Registro</dt><dd className="font-bold text-slate-800">{shortDate(p.created_at) ?? '—'}</dd></div>
                                        <div><dt className="text-[11px] font-black uppercase tracking-wider text-slate-400">Último ingreso</dt><dd className="font-bold text-slate-800">{shortDate(p.last_sign_in_at) ?? 'Nunca'}</dd></div>
                                        <div className="col-span-2 sm:col-span-1"><dt className="text-[11px] font-black uppercase tracking-wider text-slate-400">Espacios</dt>
                                            <dd className="font-bold text-slate-800">{p.spaces.length ? p.spaces.map(s => `${s.name} (${roleLabel(s.role)})`).join(' · ') : p.home_space ?? 'Ninguno'}</dd></div>
                                    </dl>
                                    <div className="flex flex-wrap gap-2">
                                        {!p.deleted_at && !p.email_confirmed && <ActionButton icon={MailCheck} onClick={() => verify(p)} disabled={working}>Marcar correo verificado</ActionButton>}
                                        {!p.deleted_at && p.email && <ActionButton icon={KeyRound} onClick={() => sendReset(p)} disabled={working}>Enviar enlace de contraseña</ActionButton>}
                                        {!p.deleted_at && p.email && !p.is_god && <ActionButton icon={ShieldCheck} onClick={() => provisional(p)} disabled={working}>Contraseña provisional</ActionButton>}
                                        {!p.deleted_at && !p.is_god && <ActionButton icon={UserMinus} tone="warn" onClick={() => softDelete(p)} disabled={working}>Dar de baja</ActionButton>}
                                        {!p.is_god && <ActionButton icon={Trash2} tone="danger" onClick={() => setToDelete(p)} disabled={working}>Eliminar definitivamente</ActionButton>}
                                        {p.is_god && <p className="text-sm text-slate-500">Las cuentas de super administrador no se pueden dar de baja ni eliminar desde aquí.</p>}
                                    </div>
                                </div>
                            )}
                        </li>
                    )
                })}
            </ul>

            {toDelete && <DeleteDialog person={toDelete} onClose={() => setToDelete(null)} onDone={async email => { setToDelete(null); setOpen(null); notify('success', `Se eliminó la cuenta ${email ?? ''}. El correo ya puede registrarse de nuevo.`); await refresh() }} />}
        </div>
    )
}

const ActionButton = ({ icon: Icon, children, tone, ...rest }: { icon: any; children: React.ReactNode; tone?: 'warn' | 'danger' } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...rest}
        className={`inline-flex items-center gap-2 min-h-11 px-4 rounded-2xl text-sm font-bold border disabled:opacity-50 ${tone === 'danger' ? 'bg-white border-rose-200 text-rose-700 hover:bg-rose-50' : tone === 'warn' ? 'bg-white border-amber-200 text-amber-800 hover:bg-amber-50' : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300'}`}>
        <Icon className="w-4 h-4" /> {children}
    </button>
)

/** Borrado definitivo: muestra qué se pierde y pide escribir el correo para confirmar. */
const DeleteDialog = ({ person, onClose, onDone }: { person: AdminPerson; onClose: () => void; onDone: (email: string | null) => void }) => {
    const { data: fp, isLoading, error } = useQuery({
        queryKey: ['admin-footprint', person.id],
        queryFn: async () => {
            const { data, error: e } = await supabase.rpc('admin_user_footprint' as any, { p_user: person.id })
            if (e) throw e
            return data as Footprint
        },
        staleTime: 0, gcTime: 0,
    })
    const [typed, setTyped] = useState('')
    const [busy, setBusy] = useState(false)
    const [err, setErr] = useState<string | null>(null)
    const email = fp?.email ?? person.email ?? ''
    const expected = (email || 'ELIMINAR').toLowerCase()
    const matches = typed.trim().toLowerCase() === expected

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [busy, onClose])

    const remove = async () => {
        setBusy(true); setErr(null)
        const { error: e } = await supabase.rpc('admin_delete_user' as any, { p_user: person.id })
        setBusy(false)
        if (e) {
            setErr(missingFunction(e)
                ? 'Falta activar el borrado definitivo en la base de datos: ejecuta en Supabase (SQL Editor) el archivo supabase/migrations/20261016110000_modo_dios_borrar_persona.sql y vuelve a intentarlo.'
                : e.message)
            return
        }
        onDone(email || null)
    }

    const lost = fp?.references.filter(r => r.effect === 'DELETE') ?? []
    const kept = fp?.references.filter(r => r.effect === 'KEEP') ?? []
    const alone = fp?.spaces.filter(s => Number(s.other_members) === 0) ?? []

    return (
        <div className="fixed inset-0 z-[120] bg-slate-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => !busy && onClose()}>
            <div role="dialog" aria-modal="true" aria-labelledby="del-title" onClick={e => e.stopPropagation()}
                className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] overflow-y-auto">
                <div className="p-5 sm:p-6 space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="w-11 h-11 shrink-0 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center"><Trash2 className="w-5 h-5" /></div>
                        <div className="min-w-0">
                            <h3 id="del-title" className="text-lg font-black text-slate-900">Eliminar definitivamente</h3>
                            <p className="text-sm text-slate-600 break-all">{fullName(person)} · {email || 'sin correo'}</p>
                        </div>
                    </div>

                    {isLoading && <div className="py-8 flex justify-center"><Loader2 className="w-7 h-7 text-indigo-500 animate-spin" /></div>}
                    {error && <p role="alert" className="text-sm font-bold text-rose-700 bg-rose-50 rounded-2xl p-3">No se pudo revisar la cuenta: {(error as any).message}</p>}

                    {fp?.blocked && <p role="alert" className="text-sm font-bold text-rose-800 bg-rose-50 border border-rose-200 rounded-2xl p-3">{fp.blocked}</p>}

                    {fp && !fp.blocked && (
                        <>
                            <div className="text-sm text-slate-700 space-y-2">
                                <p>Se borra <b>la cuenta de esta persona</b> y su perfil. <b>No se puede deshacer.</b> La escuela, sus grupos, alumnos y calificaciones <b>no se tocan</b>.</p>
                                {lost.length > 0 && <p><b>Se borra con la cuenta:</b> {lost.map(r => `${tableLabel(r.table)} (${r.rows})`).join(', ')}.</p>}
                                {kept.length > 0 && <p><b>Se conserva, sin autor:</b> {kept.map(r => `${tableLabel(r.table)} (${r.rows})`).join(', ')}.</p>}
                            </div>
                            {alone.map(s => (
                                <p key={s.tenant_id} className="flex items-start gap-2 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-2xl p-3">
                                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                    <span><b>{s.name}</b> se quedará sin ningún miembro{Number(s.students) > 0 ? ` (sus alumnos registrados, ${s.students}, se conservan)` : ''}. Nadie podrá entrar a ese espacio hasta que invites a alguien.</span>
                                </p>
                            ))}
                            <label className="block">
                                <span className="block text-sm font-bold text-slate-800 mb-1.5">Para confirmar, escribe <code className="bg-slate-100 px-1.5 py-0.5 rounded break-all">{email || 'ELIMINAR'}</code></span>
                                <input value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false}
                                    className="w-full min-h-12 px-4 rounded-2xl border-2 border-slate-200 focus:border-rose-400 outline-none text-sm font-bold" />
                            </label>
                        </>
                    )}
                    {err && <p role="alert" className="text-sm font-bold text-rose-800 bg-rose-50 border border-rose-200 rounded-2xl p-3">{err}</p>}

                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                        <button onClick={onClose} disabled={busy} className="min-h-12 px-5 rounded-2xl border border-slate-200 text-sm font-black text-slate-700">Cancelar</button>
                        <button onClick={remove} disabled={busy || !fp || !!fp.blocked || !matches}
                            className="inline-flex items-center justify-center gap-2 min-h-12 px-5 rounded-2xl bg-rose-600 text-white text-sm font-black disabled:opacity-40">
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Eliminar definitivamente
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
