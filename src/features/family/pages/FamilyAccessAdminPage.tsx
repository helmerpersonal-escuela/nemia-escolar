import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, Loader2, Check, X, UserMinus, Search, KeyRound } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { useToast } from '../../../components/ui/Toast'
import { askConfirm } from '../../../components/ui/ConfirmDialog'
import { formatDateEs } from '../../../components/ui/DateInput'
import { formatPhone } from '../../../lib/phones'
import { accessOverview, MAX_EXTRA, ROLE_TEXT, type PendingRequest, type StudentAccess } from '../lib/familyAccess'

type Group = { id: string; grade: string; section: string }
type Student = { id: string; first_name: string; last_name_paternal: string; last_name_maternal: string | null }

/**
 * Escuela: quién tiene acceso a la información de cada alumno.
 * - Autoriza o rechaza las cuentas adicionales que piden los tutores titulares (máximo 2 por alumno).
 * - Consulta las cuentas ligadas a un alumno y retira la que ya no deba entrar (custodia, código compartido…).
 */
export const FamilyAccessAdminPage = () => {
    const { data: tenant } = useTenant()
    const tenantId = (tenant as any)?.id as string | undefined
    const { showToast } = useToast()
    const [pending, setPending] = useState<PendingRequest[] | null>(null)
    const [response, setResponse] = useState<Record<string, string>>({})
    const [approved, setApproved] = useState<Record<string, string>>({})
    const [busy, setBusy] = useState<string | null>(null)
    const [groups, setGroups] = useState<Group[]>([])
    const [groupId, setGroupId] = useState('')
    const [students, setStudents] = useState<Student[]>([])
    const [q, setQ] = useState('')
    const [detail, setDetail] = useState<StudentAccess | null>(null)
    const [loadingDetail, setLoadingDetail] = useState(false)

    const loadPending = useCallback(async () => {
        const { data, error } = await supabase.rpc('family_access_pending')
        if (error) { showToast(error.message, 'error'); setPending([]); return }
        setPending((data as PendingRequest[]) ?? [])
    }, [showToast])
    useEffect(() => { loadPending() }, [loadPending])
    useEffect(() => {
        if (!tenantId) return
        supabase.from('groups').select('id, grade, section').eq('tenant_id', tenantId).is('archived_at', null).order('grade').order('section').then(({ data }) => setGroups((data as Group[]) ?? []))
    }, [tenantId])
    useEffect(() => {
        setStudents([]); setDetail(null)
        if (!groupId) return
        supabase.from('students').select('id, first_name, last_name_paternal, last_name_maternal').eq('group_id', groupId).order('last_name_paternal').order('first_name').then(({ data }) => setStudents((data as Student[]) ?? []))
    }, [groupId])

    const decide = async (r: PendingRequest, approve: boolean) => {
        if (!approve && !(response[r.id] ?? '').trim()) { showToast('Escribe el motivo para que el tutor lo vea.', 'error'); return }
        setBusy(r.id)
        const { data, error } = await supabase.rpc('decide_extra_access', { p_request: r.id, p_approve: approve, p_response: response[r.id] ?? null })
        setBusy(null)
        if (error) { showToast(error.message, 'error'); return }
        if (approve) setApproved(a => ({ ...a, [r.id]: (data as any)?.code ?? '' }))
        showToast(approve ? 'Autorizada: el tutor ya ve el código en su app.' : 'Solicitud rechazada.', approve ? 'success' : 'info')
        if (!approve) loadPending()
    }

    const open = async (s: Student) => {
        setLoadingDetail(true)
        try { setDetail((await accessOverview(s.id))[0] ?? { student_id: s.id, student: `${s.first_name} ${s.last_name_paternal}`, my_role: null, accounts: [], requests: [] }) }
        catch (e: any) { showToast(e.message, 'error') }
        setLoadingDetail(false)
    }
    const revoke = async (id: string, name: string, role: string) => {
        const msg = role === 'TITULAR'
            ? `${name} es el tutor TITULAR. Al retirarlo dejará de ver al alumno; después cambia el código del alumno y entrégalo al tutor correcto.`
            : `${name} dejará de ver la información del alumno de inmediato.`
        if (!(await askConfirm(msg, { title: 'Retirar acceso', confirmLabel: 'Sí, retirar', danger: true }))) return
        const { error } = await supabase.rpc('revoke_family_access', { p_guardian: id })
        if (error) { showToast(error.message, 'error'); return }
        showToast('Acceso retirado.', 'success')
        if (detail) setDetail((await accessOverview(detail.student_id))[0] ?? { ...detail, accounts: [] })
    }

    const shown = students.filter(s => !q || `${s.last_name_paternal} ${s.last_name_maternal ?? ''} ${s.first_name}`.toLowerCase().includes(q.toLowerCase()))

    return (
        <div className="max-w-4xl mx-auto space-y-5 animate-in fade-in duration-500">
            <div className="bg-white rounded-3xl p-6 border border-slate-100 flex items-start gap-3">
                <div className="bg-emerald-50 text-emerald-600 p-3 rounded-2xl"><ShieldCheck className="w-6 h-6" /></div>
                <div>
                    <h1 className="text-2xl font-black text-slate-900">Cuentas con acceso de las familias</h1>
                    <p className="text-slate-600 text-sm">Cada alumno tiene un <b>tutor titular</b> (entra con el código y la CURP) y hasta <b>{MAX_EXTRA} cuentas adicionales</b> que el titular solicita y la escuela autoriza.</p>
                </div>
            </div>

            <section className="bg-white rounded-3xl p-5 border border-slate-100 space-y-3">
                <h2 className="font-black text-slate-900">Solicitudes por autorizar {pending ? `(${pending.filter(p => !approved[p.id]).length})` : ''}</h2>
                {!pending ? <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</p>
                    : !pending.length ? <p className="text-sm text-slate-500">No hay solicitudes pendientes.</p>
                    : pending.map(r => (
                        <div key={r.id} className="rounded-2xl border border-slate-100 p-4 space-y-2">
                            <p className="font-black text-slate-900">{r.student}{r.group ? ` · ${r.group}` : ''}</p>
                            <p className="text-sm text-slate-700">El tutor titular <b>{r.titular ?? '—'}</b> pide acceso para <b>{r.full_name}</b> ({r.relationship}){r.phone ? ` · tel. ${formatPhone(r.phone)}` : ''}.</p>
                            {r.reason && <p className="text-sm text-slate-600">Motivo: {r.reason}</p>}
                            <p className="text-xs text-slate-500">Solicitada el {formatDateEs(r.created_at.slice(0, 10))}. Antes de autorizar, confirma con el titular (en persona o por teléfono) que él la pidió.</p>
                            {approved[r.id] ? (
                                <p className="text-sm bg-emerald-50 text-emerald-900 rounded-2xl p-3 flex items-center gap-2"><KeyRound className="w-4 h-4" /> Autorizada. Código de un solo uso: <b className="font-mono tracking-widest">{approved[r.id]}</b> (el tutor lo ve en su app).</p>
                            ) : (
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <input aria-label="Respuesta para el tutor" placeholder="Respuesta para el tutor (obligatoria si rechazas)" value={response[r.id] ?? ''} onChange={e => setResponse(x => ({ ...x, [r.id]: e.target.value }))}
                                        className="flex-1 min-h-[44px] rounded-2xl border border-slate-200 px-3 text-sm" />
                                    <button type="button" disabled={busy === r.id} onClick={() => decide(r, true)} className="inline-flex items-center justify-center gap-1 min-h-[44px] px-4 rounded-2xl bg-emerald-600 text-white text-sm font-black disabled:opacity-60"><Check className="w-4 h-4" /> Autorizar</button>
                                    <button type="button" disabled={busy === r.id} onClick={() => decide(r, false)} className="inline-flex items-center justify-center gap-1 min-h-[44px] px-4 rounded-2xl border border-rose-200 text-rose-700 text-sm font-black disabled:opacity-60"><X className="w-4 h-4" /> Rechazar</button>
                                </div>
                            )}
                        </div>
                    ))}
            </section>

            <section className="bg-white rounded-3xl p-5 border border-slate-100 space-y-3">
                <h2 className="font-black text-slate-900">Quién puede ver a un alumno</h2>
                <div className="flex flex-col sm:flex-row gap-2">
                    <select aria-label="Grupo" value={groupId} onChange={e => setGroupId(e.target.value)} className="min-h-[44px] rounded-2xl border border-slate-200 px-3 font-bold bg-white">
                        <option value="">Elige un grupo…</option>
                        {groups.map(g => <option key={g.id} value={g.id}>{g.grade}° {g.section}</option>)}
                    </select>
                    {groupId && (
                        <label className="relative flex-1"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input aria-label="Buscar alumno" placeholder="Buscar alumno" value={q} onChange={e => setQ(e.target.value)} className="w-full min-h-[44px] rounded-2xl border border-slate-200 pl-9 pr-3 text-sm" /></label>
                    )}
                </div>
                {groupId && (
                    <div className="grid md:grid-cols-2 gap-3">
                        <ul className="max-h-80 overflow-y-auto rounded-2xl border border-slate-100 divide-y divide-slate-100">
                            {shown.map(s => (
                                <li key={s.id}><button type="button" onClick={() => open(s)} aria-pressed={detail?.student_id === s.id}
                                    className={`w-full text-left px-3 py-2.5 text-sm font-bold ${detail?.student_id === s.id ? 'bg-indigo-50 text-indigo-900' : 'text-slate-800 hover:bg-slate-50'}`}>
                                    {[s.last_name_paternal, s.last_name_maternal, s.first_name].filter(Boolean).join(' ')}</button></li>
                            ))}
                            {!shown.length && <li className="p-3 text-sm text-slate-500">Sin alumnos.</li>}
                        </ul>
                        <div className="rounded-2xl border border-slate-100 p-3 space-y-2 min-h-[8rem]">
                            {loadingDetail ? <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</p>
                                : !detail ? <p className="text-sm text-slate-500">Elige un alumno para ver sus cuentas.</p>
                                : (
                                    <>
                                        <p className="font-black text-slate-900">{detail.student}</p>
                                        {!detail.accounts.length && <p className="text-sm text-slate-500">Nadie de su familia ha ligado una cuenta todavía.</p>}
                                        {detail.accounts.map(a => (
                                            <div key={a.id} className="rounded-2xl bg-slate-50 p-3 text-sm space-y-1">
                                                <p><span className={`text-xs font-black px-2 py-0.5 rounded-full mr-2 ${a.role === 'TITULAR' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'}`}>{ROLE_TEXT[a.role]}</span><b className="text-slate-900">{a.name}</b></p>
                                                <p className="text-slate-600">{[a.relationship, a.phone && formatPhone(a.phone), a.email, a.since && `desde ${formatDateEs(a.since.slice(0, 10))}`].filter(Boolean).join(' · ')}</p>
                                                <button type="button" onClick={() => revoke(a.id, a.name, a.role)} className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-xl text-xs font-black text-rose-700 border border-rose-200 hover:bg-white"><UserMinus className="w-4 h-4" /> Retirar acceso</button>
                                            </div>
                                        ))}
                                        {detail.requests.filter(r => r.status === 'APPROVED').map(r => (
                                            <p key={r.id} className="text-xs text-slate-600">Código autorizado sin usar para {r.full_name} ({r.relationship}){r.expires ? `, vence el ${formatDateEs(r.expires.slice(0, 10))}` : ''}.</p>
                                        ))}
                                    </>
                                )}
                        </div>
                    </div>
                )}
            </section>
        </div>
    )
}
