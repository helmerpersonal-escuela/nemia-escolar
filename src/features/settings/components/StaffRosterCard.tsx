import { useEffect, useMemo, useState } from 'react'
import { ClipboardList, Link2, Loader2, Mail, Search, Users } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useToast } from '../../../components/ui/Toast'
import { SettingsCard } from './SettingsUI'
import { wizardInput } from '../../../components/wizard/Wizard'
import { bestMatch } from '../../school-import/lib/names'

type RosterRow = {
    id: string; full_name: string; role_hint: string; job_title: string | null; subjects: string[]; groups: string[]
    duties: string | null; email: string | null; profile_id: string | null; invitation_id: string | null
}
type Member = { profile_id: string; first_name: string | null; last_name_paternal: string | null; last_name_maternal: string | null; email: string | null }
type Commission = { id: string; school_year: string; name: string; members: { role: string; name: string }[] }

const ROLES: Record<string, string> = {
    TEACHER: 'Docente', DIRECTOR: 'Directivo', ACADEMIC_COORD: 'Coordinación académica', TECH_COORD: 'Coordinación de tecnologías',
    SCHOOL_CONTROL: 'Control escolar / Secretaría', PREFECT: 'Prefectura', SUPPORT: 'Apoyo educativo / USAER', ADMIN: 'Administración', SYSTEM_ADMIN: 'Administrador técnico',
}
const BASE_INVITABLE = ['TEACHER', 'ACADEMIC_COORD', 'TECH_COORD', 'SCHOOL_CONTROL', 'PREFECT', 'SUPPORT']
const fullOf = (m: Member) => [m.first_name, m.last_name_paternal, m.last_name_maternal].filter(Boolean).join(' ')

/**
 * Plantilla de la escuela: personas que llegaron desde los archivos de la escuela y aún no tienen
 * cuenta. Desde aquí se les invita con su correo o se ligan con una cuenta que ya existe; al ligarlas,
 * reciben automáticamente las materias y grupos que el horario les asigna.
 */
export function StaffRosterCard({ tenantId, canInvite, myRole, onChanged }: { tenantId: string; canInvite: boolean; myRole?: string; onChanged?: () => void }) {
    // El administrador técnico no invita directivos (eso lo hace la dirección)
    const INVITABLE = myRole === 'SYSTEM_ADMIN' ? BASE_INVITABLE : [...BASE_INVITABLE, 'DIRECTOR', 'SYSTEM_ADMIN']
    const { showToast } = useToast()
    const [rows, setRows] = useState<RosterRow[]>([])
    const [members, setMembers] = useState<Member[]>([])
    const [commissions, setCommissions] = useState<Commission[]>([])
    const [loading, setLoading] = useState(true)
    const [q, setQ] = useState('')
    const [draft, setDraft] = useState<Record<string, { email: string; role: string }>>({})
    const [busy, setBusy] = useState<string | null>(null)
    const [showLinked, setShowLinked] = useState(false)

    const load = async () => {
        setLoading(true)
        const [{ data: r }, { data: m }, { data: c }] = await Promise.all([
            supabase.from('staff_roster').select('id, full_name, role_hint, job_title, subjects, groups, duties, email, profile_id, invitation_id').eq('tenant_id', tenantId).order('full_name'),
            supabase.rpc('school_staff'),
            supabase.from('school_commissions').select('id, school_year, name, members').eq('tenant_id', tenantId).order('name'),
        ])
        setRows((r as RosterRow[]) ?? [])
        setMembers(((m as Member[]) ?? []))
        setCommissions((c as Commission[]) ?? [])
        setLoading(false)
    }
    useEffect(() => { load() }, [tenantId])

    const pending = rows.filter(r => !r.profile_id)
    const linked = rows.filter(r => r.profile_id)
    const shown = (showLinked ? rows : pending).filter(r => !q || r.full_name.toLowerCase().includes(q.toLowerCase()))
    const suggestions = useMemo(() => {
        const taken = new Set(rows.map(r => r.profile_id).filter(Boolean))
        const free = members.filter(m => !taken.has(m.profile_id))
        return Object.fromEntries(pending.map(r => [r.id, bestMatch(r.full_name, free, fullOf, 0.8)?.item ?? null]))
    }, [rows, members])

    const invite = async (r: RosterRow) => {
        const d = draft[r.id] ?? { email: r.email ?? '', role: INVITABLE.includes(r.role_hint) ? r.role_hint : 'TEACHER' }
        const email = d.email.trim().toLowerCase()
        if (!/^\S+@\S+\.\S+$/.test(email)) { showToast('Escribe un correo válido.', 'error'); return }
        setBusy(r.id)
        const { data: { user } } = await supabase.auth.getUser()
        const { data: inv, error } = await supabase.from('staff_invitations').insert({
            tenant_id: tenantId, email, role: d.role, created_by: user?.id, job_title: r.job_title, duties: r.duties, roster_id: r.id,
        }).select('id').single()
        if (error || !inv) { setBusy(null); showToast('No se pudo crear la invitación: ' + (error?.message ?? ''), 'error'); return }
        await supabase.from('staff_roster').update({ email, invitation_id: inv.id, updated_at: new Date().toISOString() }).eq('id', r.id)
        const { data: sent } = await supabase.functions.invoke('send-staff-invite', { body: { invitation_id: inv.id } })
        setBusy(null)
        showToast((sent as any)?.sent ? `Invitación enviada a ${email}` : 'Invitación creada. Copia el enlace en "Invitaciones sin aceptar" y compártelo.', (sent as any)?.sent ? 'success' : 'info')
        load(); onChanged?.()
    }

    const link = async (r: RosterRow, profileId: string) => {
        setBusy(r.id)
        const { error } = await supabase.from('staff_roster').update({ profile_id: profileId, updated_at: new Date().toISOString() }).eq('id', r.id)
        setBusy(null)
        if (error) { showToast('No se pudo ligar: ' + error.message, 'error'); return }
        showToast('Listo: se le asignaron sus grupos y materias.', 'success')
        load(); onChanged?.()
    }

    if (loading) return <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando plantilla…</p>
    if (!rows.length && !commissions.length) return null

    return (
        <>
            {rows.length > 0 && (
                <SettingsCard icon={ClipboardList} title="Plantilla de la escuela"
                    hint={`${pending.length} persona(s) sin cuenta y ${linked.length} ya ligada(s). Al invitar o ligar a un docente, recibe automáticamente los grupos y materias de su horario.`}>
                    <div className="flex flex-col gap-2">
                        <label className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nombre" aria-label="Buscar en la plantilla" className={`${wizardInput} pl-9`} />
                        </label>
                        <label className="flex items-center gap-2 text-sm font-bold text-slate-600"><input type="checkbox" className="w-4 h-4 accent-indigo-600" checked={showLinked} onChange={e => setShowLinked(e.target.checked)} /> Mostrar también los que ya tienen cuenta</label>
                    </div>
                    <ul className="divide-y divide-slate-100">
                        {shown.map(r => {
                            const d = draft[r.id] ?? { email: r.email ?? '', role: INVITABLE.includes(r.role_hint) ? r.role_hint : 'TEACHER' }
                            const sug = suggestions[r.id]
                            return (
                                <li key={r.id} className="py-3 space-y-2">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="font-bold text-slate-900">{r.full_name}</p>
                                            <p className="text-xs text-slate-500">{r.job_title ?? ROLES[r.role_hint] ?? r.role_hint}{r.subjects.length ? ` · ${r.subjects.join(', ')}` : ''}{r.groups.length ? ` · ${r.groups.join(', ')}` : ''}</p>
                                            {r.duties && <p className="text-xs text-slate-500">{r.duties}</p>}
                                        </div>
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${r.profile_id ? 'bg-emerald-50 text-emerald-800' : r.invitation_id ? 'bg-indigo-50 text-indigo-800' : 'bg-slate-100 text-slate-600'}`}>
                                            {r.profile_id ? 'Con cuenta' : r.invitation_id ? `Invitado · ${r.email}` : 'Sin correo'}
                                        </span>
                                    </div>
                                    {canInvite && !r.profile_id && (
                                        <div className="space-y-2">
                                            <input type="email" inputMode="email" placeholder="correo@ejemplo.com" aria-label={`Correo de ${r.full_name}`} className={`${wizardInput} !py-2`}
                                                value={d.email} onChange={e => setDraft(x => ({ ...x, [r.id]: { ...d, email: e.target.value } }))} />
                                            <div className="flex gap-2">
                                                <select aria-label={`Puesto de ${r.full_name}`} className={`${wizardInput} !py-2 flex-1 min-w-0`} value={d.role} onChange={e => setDraft(x => ({ ...x, [r.id]: { ...d, role: e.target.value } }))}>
                                                    {INVITABLE.map(k => <option key={k} value={k}>{ROLES[k]}</option>)}
                                                </select>
                                                <button type="button" disabled={busy === r.id} onClick={() => invite(r)} className="shrink-0 inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-2xl bg-indigo-600 text-white text-sm font-black hover:bg-indigo-700 disabled:opacity-60">
                                                    {busy === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} {r.invitation_id ? 'Invitar de nuevo' : 'Invitar'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {canInvite && !r.profile_id && sug && (
                                        <button type="button" disabled={busy === r.id} onClick={() => link(r, sug.profile_id)} className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 underline">
                                            <Link2 className="w-3.5 h-3.5" /> Es la cuenta de {fullOf(sug)}{sug.email ? ` (${sug.email})` : ''}: ligar
                                        </button>
                                    )}
                                </li>
                            )
                        })}
                        {!shown.length && <li className="py-3 text-sm text-slate-500">Nadie pendiente.</li>}
                    </ul>
                </SettingsCard>
            )}
            {commissions.length > 0 && (
                <SettingsCard icon={Users} title={`Comisiones ${commissions[0].school_year}`} hint="Tomadas de los documentos de la escuela.">
                    <div className="grid sm:grid-cols-2 gap-3">
                        {commissions.map(c => (
                            <div key={c.id} className="rounded-2xl border border-slate-100 p-3">
                                <p className="font-black text-slate-900 text-sm">{c.name}</p>
                                <ul className="text-xs text-slate-600 mt-1 space-y-0.5">
                                    {c.members.map((m, i) => <li key={i}><b className="text-slate-700">{m.role.charAt(0) + m.role.slice(1).toLowerCase()}:</b> {m.name}</li>)}
                                </ul>
                            </div>
                        ))}
                    </div>
                </SettingsCard>
            )}
        </>
    )
}
