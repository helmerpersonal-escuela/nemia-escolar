import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, UserPlus, Loader2, Copy, Clock, XCircle, UserMinus, KeyRound } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useToast } from '../../../components/ui/Toast'
import { askConfirm } from '../../../components/ui/ConfirmDialog'
import { formatDateEs } from '../../../components/ui/DateInput'
import { formatPhone, isValidPhone } from '../../../lib/phones'
import { accessOverview, MAX_EXTRA, RELATIONSHIPS, ROLE_TEXT, usedSlots, type StudentAccess } from '../lib/familyAccess'

const input = 'w-full min-h-[44px] rounded-2xl border border-slate-200 px-3 text-sm font-bold bg-white'

/**
 * "Mi acceso": dice con qué tipo de cuenta entró la persona (tutor titular o cuenta adicional).
 * El titular ve quién más puede ver a su hijo(a), pide a la escuela hasta 2 cuentas adicionales y puede retirarlas.
 */
export function FamilyAccessCard() {
    const { showToast } = useToast()
    const [rows, setRows] = useState<StudentAccess[] | null>(null)
    const [openFor, setOpenFor] = useState<string | null>(null)
    const [form, setForm] = useState({ name: '', relationship: '', phone: '', reason: '' })
    const [busy, setBusy] = useState(false)

    const load = useCallback(() => { accessOverview().then(setRows).catch(() => setRows([])) }, [])
    useEffect(() => { load() }, [load])

    if (!rows) return <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Revisando tu acceso…</p>
    if (!rows.length) return null

    const request = async (studentId: string) => {
        if (form.name.trim().length < 5 || !form.relationship) { showToast('Escribe el nombre completo y elige el parentesco.', 'error'); return }
        if (form.phone && !isValidPhone(form.phone)) { showToast('El teléfono debe tener 10 dígitos.', 'error'); return }
        setBusy(true)
        const { error } = await supabase.rpc('request_extra_access', { p_student: studentId, p_full_name: form.name, p_relationship: form.relationship, p_phone: form.phone || null, p_reason: form.reason || null })
        setBusy(false)
        if (error) { showToast(error.message, 'error'); return }
        showToast('Solicitud enviada a la escuela. Aquí verás el código cuando la autoricen.', 'success')
        setForm({ name: '', relationship: '', phone: '', reason: '' }); setOpenFor(null); load()
    }
    const cancel = async (id: string) => {
        if (!(await askConfirm('¿Cancelar esta solicitud? Si ya tenía código, dejará de servir.', { title: 'Cancelar solicitud', confirmLabel: 'Sí, cancelar', danger: true }))) return
        const { error } = await supabase.rpc('cancel_extra_access', { p_request: id })
        if (error) showToast(error.message, 'error'); else load()
    }
    const revoke = async (id: string, name: string) => {
        if (!(await askConfirm(`${name} dejará de ver la información de tu hijo(a) de inmediato.`, { title: 'Retirar acceso', confirmLabel: 'Sí, retirar', danger: true }))) return
        const { error } = await supabase.rpc('revoke_family_access', { p_guardian: id })
        if (error) showToast(error.message, 'error'); else { showToast('Acceso retirado.', 'success'); load() }
    }
    const copy = (code: string) => navigator.clipboard?.writeText(code).then(() => showToast('Código copiado', 'success')).catch(() => {})

    return (
        <section className="bg-white rounded-3xl border border-slate-100 p-4 sm:p-6 space-y-4" aria-label="Mi acceso">
            <h2 className="font-black text-slate-900 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-600" /> Mi acceso</h2>
            {rows.map(s => {
                const titular = s.my_role === 'TITULAR'
                const extras = s.accounts.filter(a => a.role === 'EXTRA')
                const free = MAX_EXTRA - usedSlots(s)
                return (
                    <div key={s.student_id} className="rounded-2xl border border-slate-100 p-3 sm:p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-black text-slate-900">{s.student}</p>
                            <span className={`text-xs font-black px-3 py-1 rounded-full ${titular ? 'bg-emerald-50 text-emerald-800' : 'bg-indigo-50 text-indigo-800'}`}>
                                Entras como: {ROLE_TEXT[s.my_role ?? 'EXTRA']}
                            </span>
                        </div>
                        {!titular ? (
                            <p className="text-sm text-slate-600">El tutor titular pidió a la escuela esta cuenta para ti. Puedes ver la información del alumno; solo el titular administra quién más tiene acceso.</p>
                        ) : (
                            <>
                                <p className="text-sm text-slate-600">Eres responsable de esta cuenta: no compartas tu contraseña. Si alguien más debe ver a tu hijo(a), pide una <b>cuenta adicional</b> (máximo {MAX_EXTRA}); la escuela la autoriza y esa persona entra con sus propios datos.</p>
                                {extras.length > 0 && (
                                    <ul className="space-y-2">
                                        {extras.map(a => (
                                            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50 p-3 text-sm">
                                                <span><b className="text-slate-900">{a.name}</b><span className="text-slate-600"> · {a.relationship}{a.phone ? ` · ${formatPhone(a.phone)}` : ''}{a.since ? ` · desde ${formatDateEs(a.since.slice(0, 10))}` : ''}</span></span>
                                                <button type="button" onClick={() => revoke(a.id, a.name)} className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-xl text-xs font-black text-rose-700 border border-rose-200 hover:bg-rose-50"><UserMinus className="w-4 h-4" /> Retirar acceso</button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {s.requests.map(r => (
                                    <div key={r.id} className={`rounded-2xl p-3 text-sm border ${r.status === 'APPROVED' ? 'border-emerald-200 bg-emerald-50' : r.status === 'REJECTED' ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'}`}>
                                        <p className="font-bold text-slate-900">{r.full_name} · {r.relationship}</p>
                                        {r.status === 'PENDING' && <p className="text-amber-900 flex items-center gap-1"><Clock className="w-4 h-4" /> En espera de que la escuela la autorice.</p>}
                                        {r.status === 'REJECTED' && <p className="text-rose-900 flex items-center gap-1"><XCircle className="w-4 h-4" /> La escuela no la autorizó{r.response ? `: ${r.response}` : '.'}</p>}
                                        {r.status === 'APPROVED' && (r.code ? (
                                            <div className="space-y-1">
                                                <p className="text-emerald-900">Autorizada. Dale este código <b>solo a esa persona</b>; sirve una vez{r.expires ? ` y vence el ${formatDateEs(r.expires.slice(0, 10))}` : ''}:</p>
                                                <p className="flex items-center gap-2"><KeyRound className="w-4 h-4 text-emerald-700" /><span className="font-mono font-black text-xl tracking-[0.2em] text-slate-900">{r.code}</span>
                                                    <button type="button" onClick={() => copy(r.code!)} aria-label="Copiar código" className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-white"><Copy className="w-4 h-4" /></button></p>
                                                <p className="text-xs text-emerald-900">Debe entrar a <b>vunlek.com/familia/adicional</b>, escribir el código y sus datos.</p>
                                            </div>
                                        ) : <p className="text-slate-600">El código venció sin usarse. Cancélala y pide otra.</p>)}
                                        {r.status !== 'REJECTED' && <button type="button" onClick={() => cancel(r.id)} className="mt-1 text-xs font-bold text-slate-600 underline">Cancelar solicitud</button>}
                                    </div>
                                ))}
                                {openFor === s.student_id ? (
                                    <div className="rounded-2xl border-2 border-indigo-100 p-3 space-y-2">
                                        <p className="font-bold text-slate-900 text-sm">¿Para quién es la cuenta adicional?</p>
                                        <input className={input} aria-label="Nombre completo de la persona" placeholder="Nombre completo" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                                        <div className="grid sm:grid-cols-2 gap-2">
                                            <select className={input} aria-label="Parentesco con el alumno" value={form.relationship} onChange={e => setForm({ ...form, relationship: e.target.value })}>
                                                <option value="">Parentesco con el alumno…</option>
                                                {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                                            </select>
                                            <input className={input} aria-label="Teléfono de la persona" inputMode="tel" placeholder="Su teléfono (10 dígitos)" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                                        </div>
                                        <input className={input} aria-label="Motivo" placeholder="Motivo (opcional): p. ej. lo recoge por las tardes" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
                                        <div className="flex justify-end gap-2">
                                            <button type="button" onClick={() => setOpenFor(null)} className="min-h-[44px] px-4 rounded-2xl text-sm font-bold text-slate-600">Cancelar</button>
                                            <button type="button" disabled={busy} onClick={() => request(s.student_id)} className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-2xl bg-indigo-600 text-white text-sm font-black disabled:opacity-60">
                                                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Enviar a la escuela
                                            </button>
                                        </div>
                                    </div>
                                ) : free > 0 ? (
                                    <button type="button" onClick={() => setOpenFor(s.student_id)} className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-2xl border border-indigo-200 text-indigo-800 text-sm font-black hover:bg-indigo-50">
                                        <UserPlus className="w-4 h-4" /> Solicitar cuenta adicional ({free} disponible{free === 1 ? '' : 's'})
                                    </button>
                                ) : <p className="text-xs text-slate-500">Ya usaste las {MAX_EXTRA} cuentas adicionales de este alumno. Retira una para pedir otra.</p>}
                            </>
                        )}
                    </div>
                )
            })}
        </section>
    )
}
