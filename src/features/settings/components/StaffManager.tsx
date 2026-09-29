import { useState, useEffect } from 'react'
import { InitialsAvatar } from '../../../components/ui/InitialsAvatar'
import { supabase } from '../../../lib/supabase'
import { useProfile } from '../../../hooks/useProfile'
import { UserPlus, Mail, Copy, Trash2, Clock, Users, UserMinus, Loader2, KeyRound } from 'lucide-react'
import { askConfirm } from '../../../components/ui/ConfirmDialog'
import { useToast } from '../../../components/ui/Toast'
import { SettingsCard, SettingsActionButton } from './SettingsUI'
import { StaffAssignmentFields, emptyAssignment, gradesLabel, type Assignment } from './StaffAssignment'
import { useTenant } from '../../../hooks/useTenant'
import { Pencil, Save } from 'lucide-react'
import { WizardField, wizardInput, wizardChoice, Radio } from '../../../components/wizard/Wizard'

const ROLES = [
    { id: 'TEACHER', name: 'Docente' },
    { id: 'DIRECTOR', name: 'Directivo' },
    { id: 'ACADEMIC_COORD', name: 'Coordinación académica' },
    { id: 'TECH_COORD', name: 'Coordinación de tecnologías' },
    { id: 'SCHOOL_CONTROL', name: 'Control escolar / Secretaría' },
    { id: 'PREFECT', name: 'Prefectura' },
    { id: 'SUPPORT', name: 'Apoyo educativo / USAER' },
]

export const StaffManager = () => {
    const { profile } = useProfile()
    const [loading, setLoading] = useState(true)

    const isDirectorOrAdmin = ['DIRECTOR', 'ADMIN', 'SUPER_ADMIN'].includes((profile?.role || '').toUpperCase())
    const { showToast } = useToast()
    const [busyId, setBusyId] = useState<string | null>(null)
    const { data: tenantCtx } = useTenant()
    const level = (tenantCtx as any)?.educationalLevel || (tenantCtx as any)?.educational_level
    const [newAssignment, setNewAssignment] = useState<Assignment>(emptyAssignment)
    const [editing, setEditing] = useState<{ id: string; a: Assignment } | null>(null)
    const [emailStatus, setEmailStatus] = useState<{ state: 'sending' | 'sent' | 'manual'; to: string; detail?: string } | null>(null)

    /** Envía el correo de la invitación. Si el servicio de correo no está configurado, pide compartir el enlace. */
    const sendInviteEmail = async (invitationId: string, to: string) => {
        setEmailStatus({ state: 'sending', to })
        const { data, error } = await supabase.functions.invoke('send-staff-invite', { body: { invitation_id: invitationId } })
        if (!error && (data as any)?.sent) {
            setEmailStatus({ state: 'sent', to })
            showToast(`Correo enviado a ${to}`, 'success')
            return
        }
        const reason = (data as any)?.reason
        setEmailStatus({ state: 'manual', to, detail: reason === 'no_provider' ? 'El envío de correos aún no está activado en el servidor.' : ((data as any)?.detail || (error as any)?.message || 'No se pudo enviar el correo.') })
        showToast('No se pudo enviar el correo: comparte el enlace por WhatsApp o correo.', 'info')
    }
    const [staff, setStaff] = useState<any[]>([])
    const [invitations, setInvitations] = useState<any[]>([])
    const [isInviting, setIsInviting] = useState(false)
    const [registrationMethod, setRegistrationMethod] = useState<'invite' | 'direct'>('invite')
    const [inviteData, setInviteData] = useState({
        email: '',
        role: 'TEACHER',
        firstName: '',
        lastNamePaternal: '',
        password: '',
        phone: ''
    })
    const [lastToken, setLastToken] = useState<string | null>(null)
    const [successMsg, setSuccessMsg] = useState('')

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // 1. Get Profile to get tenant_id
            const { data: myProfile } = await supabase
                .from('profiles')
                .select('tenant_id')
                .eq('id', user.id)
                .single()

            if (!myProfile?.tenant_id) return

            // 2. Load Staff
            // Todo el personal que pertenece a la escuela (aunque ahora esté trabajando en otro espacio)
            const { data: staffData, error: staffError } = await supabase.rpc('school_staff')
            if (staffError) console.error('school_staff', staffError)
            setStaff((staffData as any[]) || [])

            // 3. Load Pending Invitations
            const { data: invData } = await supabase
                .from('staff_invitations')
                .select('*')
                .eq('tenant_id', myProfile.tenant_id)
                .eq('status', 'PENDING')
                .order('created_at', { ascending: false })

            setInvitations(invData || [])

        } catch (error) {
            console.error('Error loading staff:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSendInvite = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsInviting(true)
        setLastToken(null)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            const { data: myProfile } = await supabase.from('profiles').select('tenant_id').eq('id', user?.id).single()
            if (!myProfile?.tenant_id) throw new Error('No se encontró el inquilino')

            if (registrationMethod === 'direct') {
                // Direct call to Edge Function (Admin Action)
                const { data, error } = await supabase.functions.invoke('create-test-user', {
                    body: {
                        email: inviteData.email,
                        password: inviteData.password,
                        firstName: inviteData.firstName,
                        lastNamePaternal: inviteData.lastNamePaternal,
                        role: inviteData.role,
                        tenantId: myProfile.tenant_id
                    }
                })

                if (error) throw error
                // Guarda su encargo (cargo, grados y actividades)
                if (newAssignment.job_title.trim() || newAssignment.assigned_grades.length || newAssignment.duties.trim()) {
                    const { data: list } = await supabase.rpc('school_staff')
                    const created = ((list as any[]) || []).find(m => (m.email || '').toLowerCase() === inviteData.email.toLowerCase())
                    if (created) await supabase.rpc('set_staff_assignment', { p_profile_id: created.profile_id, p_job_title: newAssignment.job_title, p_grades: newAssignment.assigned_grades, p_duties: newAssignment.duties })
                }
                showToast('Listo: ya tiene acceso a la escuela.', 'success')
            } else {
                // Traditional Invitation
                const { data, error } = await supabase
                    .from('staff_invitations')
                    .insert({
                        tenant_id: myProfile.tenant_id,
                        email: inviteData.email.toLowerCase(),
                        role: inviteData.role,
                        created_by: user?.id,
                        job_title: newAssignment.job_title.trim() || null,
                        assigned_grades: newAssignment.assigned_grades,
                        duties: newAssignment.duties.trim() || null,
                    })
                    .select()
                    .single()

                if (error) throw error
                setLastToken(data.token)
                sendInviteEmail(data.id, data.email)
                showToast('Invitación creada', 'success')
            }

            setInviteData({ email: '', role: 'TEACHER', firstName: '', lastNamePaternal: '', password: '', phone: '' })
            setNewAssignment(emptyAssignment)
            setTimeout(() => setSuccessMsg(''), 3000)
            loadData()
        } catch (error: any) {
            showToast('No se pudo completar: ' + error.message, 'error')
        } finally {
            setIsInviting(false)
        }
    }

    const copyInviteLink = (token: string) => {
        const link = `${window.location.origin}/invitacion?token=${token}`
        navigator.clipboard?.writeText(link).then(() => showToast('Enlace copiado', 'success')).catch(() => showToast('Copia el enlace manualmente', 'info'))
    }

    const deleteInvitation = async (id: string) => {
        if (!(await askConfirm('¿Cancelar esta invitación? El enlace dejará de funcionar.'))) return
        await supabase.from('staff_invitations').delete().eq('id', id)
        loadData()
    }

    const removeMember = async (m: any) => {
        const name = [m.first_name, m.last_name_paternal].filter(Boolean).join(' ') || m.email
        if (!(await askConfirm(`¿Dar de baja a ${name}? Dejará de tener acceso a esta escuela y se le quitarán sus grupos asignados. Sus registros (calificaciones, asistencia) se conservan.`, { title: 'Dar de baja', confirmLabel: 'Sí, dar de baja', danger: true }))) return
        setBusyId(m.profile_id)
        const { error } = await supabase.rpc('remove_staff_member', { p_profile_id: m.profile_id })
        setBusyId(null)
        if (error) { showToast('No se pudo dar de baja: ' + error.message, 'error'); return }
        showToast(`${name} ya no tiene acceso a la escuela.`, 'success')
        loadData()
    }

    const changeRole = async (m: any, role: string) => {
        setBusyId(m.profile_id)
        const { error } = await supabase.rpc('set_staff_role', { p_profile_id: m.profile_id, p_role: role })
        setBusyId(null)
        if (error) { showToast('No se pudo cambiar el puesto: ' + error.message, 'error'); return }
        showToast('Puesto actualizado', 'success')
        loadData()
    }

    const saveAssignment = async () => {
        if (!editing) return
        setBusyId(editing.id)
        const { error } = await supabase.rpc('set_staff_assignment', { p_profile_id: editing.id, p_job_title: editing.a.job_title, p_grades: editing.a.assigned_grades, p_duties: editing.a.duties })
        setBusyId(null)
        if (error) { showToast('No se pudo guardar el encargo: ' + error.message, 'error'); return }
        showToast('Encargo guardado', 'success')
        setEditing(null)
        loadData()
    }

    const roleName = (id: string) => ROLES.find(r => r.id === (id || '').toUpperCase())?.name || id

    if (loading && staff.length === 0) return <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando personal…</p>

    return (
        <div className="space-y-6">
            {isDirectorOrAdmin ? (
                <SettingsCard icon={UserPlus} title="Dar de alta" hint="Agrega a un docente o a alguien del personal. Lo más fácil es enviarle una invitación.">
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cómo darle acceso">
                        <button type="button" role="radio" aria-checked={registrationMethod === 'invite'} onClick={() => setRegistrationMethod('invite')} className={wizardChoice(registrationMethod === 'invite')}>
                            <Radio checked={registrationMethod === 'invite'} /> Enviarle una invitación
                        </button>
                        <button type="button" role="radio" aria-checked={registrationMethod === 'direct'} onClick={() => setRegistrationMethod('direct')} className={wizardChoice(registrationMethod === 'direct')}>
                            <Radio checked={registrationMethod === 'direct'} /> Crear su acceso yo
                        </button>
                    </div>
                    <p className="text-sm text-slate-500">
                        {registrationMethod === 'invite'
                            ? 'Le enviamos un correo con un enlace; también podrás copiarlo para mandarlo por WhatsApp. La persona lo abre y entra con su correo (o con Google).'
                            : 'Tú escribes su correo y una contraseña inicial y se la compartes. Podrá cambiarla después.'}
                    </p>

                    <form onSubmit={handleSendInvite} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <WizardField label="Correo" required>
                                <input aria-label="Correo" type="email" required inputMode="email" className={wizardInput} placeholder="nombre@correo.com"
                                    value={inviteData.email} onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })} />
                            </WizardField>
                            <WizardField label="Puesto" required>
                                <select aria-label="Puesto" className={wizardInput} value={inviteData.role} onChange={(e) => setInviteData({ ...inviteData, role: e.target.value })}>
                                    {ROLES.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            </WizardField>
                            {registrationMethod === 'direct' && (
                                <>
                                    <WizardField label="Nombre(s)" required>
                                        <input aria-label="Nombre(s)" required className={wizardInput} value={inviteData.firstName} onChange={(e) => setInviteData({ ...inviteData, firstName: e.target.value })} />
                                    </WizardField>
                                    <WizardField label="Apellido paterno" required>
                                        <input aria-label="Apellido paterno" required className={wizardInput} value={inviteData.lastNamePaternal} onChange={(e) => setInviteData({ ...inviteData, lastNamePaternal: e.target.value })} />
                                    </WizardField>
                                    <WizardField label="Contraseña inicial" required hint="Mínimo 8 caracteres. Compártela en privado." className="sm:col-span-2">
                                        <input aria-label="Contraseña inicial" type="text" required minLength={8} autoComplete="off" className={`${wizardInput} font-mono`} value={inviteData.password} onChange={(e) => setInviteData({ ...inviteData, password: e.target.value })} />
                                    </WizardField>
                                </>
                            )}
                        </div>
                        {inviteData.role !== 'TEACHER' && (
                            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2">
                                <p className="text-sm font-bold text-slate-700">Su encargo (opcional; puedes cambiarlo después)</p>
                                <StaffAssignmentFields role={inviteData.role} level={level} value={newAssignment} onChange={setNewAssignment} />
                            </div>
                        )}
                        <div className="flex justify-end">
                            <SettingsActionButton type="submit" icon={registrationMethod === 'direct' ? KeyRound : Mail} disabled={isInviting}>
                                {isInviting ? 'Procesando…' : registrationMethod === 'direct' ? 'Crear acceso' : 'Enviar invitación'}
                            </SettingsActionButton>
                        </div>
                    </form>

                    {lastToken && registrationMethod === 'invite' && (
                        <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl space-y-3">
                            {emailStatus?.state === 'sending' && <p className="text-sm font-bold text-indigo-900 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Enviando el correo a {emailStatus.to}…</p>}
                            {emailStatus?.state === 'sent' && <p className="text-sm font-bold text-emerald-800">Listo: enviamos la invitación a {emailStatus.to}. Si no le llega en unos minutos (revisa también "Spam" o "Promociones"), mándale este enlace:</p>}
                            {(!emailStatus || emailStatus.state === 'manual') && (
                                <p className="text-sm font-bold text-amber-900">
                                    {emailStatus?.detail ? `No se envió el correo automáticamente (${emailStatus.detail}) ` : ''}Mándale este enlace por WhatsApp o correo:
                                </p>
                            )}
                            <div className="flex items-center gap-2">
                                <input readOnly aria-label="Enlace de invitación" className={`${wizardInput} font-mono text-xs`} value={`${window.location.origin}/invitacion?token=${lastToken}`} onFocus={e => e.currentTarget.select()} />
                                <button type="button" aria-label="Copiar enlace" onClick={() => copyInviteLink(lastToken)} className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"><Copy className="w-5 h-5" /></button>
                            </div>
                            <p className="text-sm text-indigo-900">Mándalo por WhatsApp o correo. <strong>Debe abrirlo la persona invitada</strong>, en su celular o computadora, y entrar con el correo al que la invitaste. Si lo abres tú con tu sesión, verás un aviso de que es para otra cuenta.</p>
                        </div>
                    )}
                </SettingsCard>
            ) : (
                <p className="text-sm font-semibold text-amber-900 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">Solo la dirección puede dar de alta o de baja al personal.</p>
            )}

            {invitations.length > 0 && (
                <SettingsCard icon={Clock} title={`Invitaciones sin aceptar (${invitations.length})`} hint="Aún no abren su enlace. Puedes reenviar el correo, copiar el enlace o cancelarla.">
                    <ul className="space-y-2">
                        {invitations.map(inv => (
                            <li key={inv.id} className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-slate-100 bg-white">
                                <div className="min-w-0">
                                    <p className="font-bold text-slate-900 break-all">{inv.email}</p>
                                    <p className="text-sm text-slate-500">{roleName(inv.role)}</p>
                                </div>
                                {isDirectorOrAdmin && (
                                    <div className="flex gap-1 shrink-0">
                                        <button type="button" onClick={() => sendInviteEmail(inv.id, inv.email)} aria-label={`Enviar correo a ${inv.email}`} title="Enviar el correo otra vez" className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-indigo-700 hover:bg-indigo-50"><Mail className="w-4 h-4" /></button>
                                        <button type="button" onClick={() => copyInviteLink(inv.token)} aria-label={`Copiar enlace de ${inv.email}`} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-indigo-700 hover:bg-indigo-50"><Copy className="w-4 h-4" /></button>
                                        <button type="button" onClick={() => deleteInvitation(inv.id)} aria-label={`Cancelar invitación de ${inv.email}`} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                </SettingsCard>
            )}

            <SettingsCard icon={Users} title={`Personal con acceso (${staff.length})`} hint={isDirectorOrAdmin ? 'Cambia su puesto o dale de baja cuando ya no trabaje en la escuela.' : undefined}>
                <ul className="space-y-2">
                    {staff.map(m => {
                        const name = [m.first_name, m.last_name_paternal, m.last_name_maternal].filter(Boolean).join(' ') || m.email
                        const busy = busyId === m.profile_id
                        return (
                            <li key={m.profile_id} className="flex flex-col gap-3 p-3 rounded-2xl border border-slate-100 bg-white">
                                <div className="flex items-center gap-3 min-w-0">
                                    {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-11 h-11 rounded-2xl bg-slate-50 shrink-0 object-cover" /> : <InitialsAvatar name={name} className="w-11 h-11 rounded-2xl text-sm" />}
                                    <div className="min-w-0">
                                        <p className="font-bold text-slate-900">{name}{m.is_me && <span className="ml-2 text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg">Tú</span>}</p>
                                        <p className="text-sm text-slate-500 break-all">{m.email}</p>
                                        {(m.job_title || (m.assigned_grades || []).length > 0 || ['SCHOOL_CONTROL', 'PREFECT', 'SUPPORT'].includes(m.role)) && (
                                            <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
                                                {m.job_title && <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-800 font-bold">{m.job_title}</span>}
                                                {['SCHOOL_CONTROL', 'PREFECT', 'SUPPORT', 'ACADEMIC_COORD'].includes(m.role) && <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-bold">{gradesLabel(m.assigned_grades)}</span>}
                                            </p>
                                        )}
                                        {m.duties && <p className="mt-1 text-sm text-slate-600 line-clamp-2">Actividades: {m.duties}</p>}
                                    </div>
                                </div>
                                {isDirectorOrAdmin && !m.is_me ? (
                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                        <select aria-label={`Puesto de ${name}`} disabled={busy} className={`${wizardInput} !py-2 flex-1 min-w-[11rem] sm:max-w-xs`} value={(m.role || '').toUpperCase()} onChange={e => changeRole(m, e.target.value)}>
                                            {ROLES.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                            {!ROLES.some(r => r.id === (m.role || '').toUpperCase()) && <option value={m.role}>{m.role}</option>}
                                        </select>
                                        <SettingsActionButton icon={Pencil} disabled={busy} onClick={() => setEditing({ id: m.profile_id, a: { job_title: m.job_title || '', assigned_grades: m.assigned_grades || [], duties: m.duties || '' } })}>Encargo</SettingsActionButton>
                                        <SettingsActionButton tone="danger" icon={busy ? Loader2 : UserMinus} disabled={busy} onClick={() => removeMember(m)}>Dar de baja</SettingsActionButton>
                                    </div>
                                ) : (
                                    <span className="text-sm font-bold text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 self-start">{roleName(m.role)}</span>
                                )}
                                {editing?.id === m.profile_id && (
                                    <div className="w-full rounded-2xl border-2 border-indigo-100 bg-indigo-50/30 p-4 space-y-3">
                                        <p className="font-bold text-slate-900">Encargo de {name}</p>
                                        <StaffAssignmentFields role={m.role} level={level} value={editing!.a} onChange={a => setEditing({ id: m.profile_id, a })} />
                                        <div className="flex justify-end gap-2">
                                            <button type="button" onClick={() => setEditing(null)} className="min-h-[44px] px-4 rounded-2xl text-sm font-bold text-slate-600 hover:bg-white">Cancelar</button>
                                            <button type="button" onClick={saveAssignment} disabled={busy} className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-2xl bg-emerald-500 text-white text-sm font-black hover:bg-emerald-600 disabled:opacity-60"><Save className="w-4 h-4" /> Guardar encargo</button>
                                        </div>
                                    </div>
                                )}
                            </li>
                        )
                    })}
                </ul>
            </SettingsCard>
        </div>
    )
}
