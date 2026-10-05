import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Loader2, School, MailWarning, CheckCircle2, LogOut, UserPlus, LogIn } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { queryClient, queryPersister } from '../../../lib/queryClient'
import { savePendingSignup } from '../lib/googleAuth'

export const PENDING_INVITE_KEY = 'vunlek.pendingInvite'

export const ROLE_LABEL_ES: Record<string, string> = {
    DIRECTOR: 'Directivo', ADMIN: 'Administración', ACADEMIC_COORD: 'Coordinación académica', TECH_COORD: 'Coordinación de tecnologías',
    SCHOOL_CONTROL: 'Control escolar', TEACHER: 'Docente', PREFECT: 'Prefectura', SUPPORT: 'Apoyo / USAER', SYSTEM_ADMIN: 'Administrador técnico', TUTOR: 'Madre, padre o tutor', STUDENT: 'Alumno',
}

type Preview = { tenant_name: string; role: string; email: string; status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | string; replacement_token?: string | null; still_member?: boolean }

/**
 * Enlace de invitación (/invitacion?token=…). Funciona con o sin sesión:
 * - sin sesión: crear cuenta o entrar con una cuenta existente;
 * - con la cuenta invitada: "Aceptar" agrega la escuela con el rol asignado;
 * - con otra cuenta (p. ej. el director probando su propio enlace): lo explica y ofrece cambiar de cuenta.
 */
export const InvitationPage = () => {
    const [params] = useSearchParams()
    const token = params.get('token') || ''
    const [loading, setLoading] = useState(true)
    const [info, setInfo] = useState<Preview | null>(null)
    const [sessionEmail, setSessionEmail] = useState<string | null>(null)
    const [hasWorkspace, setHasWorkspace] = useState<boolean>(true)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let alive = true
        ;(async () => {
            try { localStorage.removeItem(PENDING_INVITE_KEY) } catch { /* nada */ }
            const [{ data: prev }, { data: { session } }] = await Promise.all([
                supabase.rpc('invitation_status', { p_token: token }),
                supabase.auth.getSession(),
            ])
            if (!alive) return
            const row = (((prev as any[]) || [])[0] ?? null) as Preview | null
            // Enlace viejo (ya usado o vencido) y la escuela envió una invitación nueva: se abre la nueva
            if (row && row.status !== 'PENDING' && row.replacement_token) {
                window.location.replace(`/invitacion?token=${encodeURIComponent(row.replacement_token)}`)
                return
            }
            setInfo(row)
            setSessionEmail(session?.user.email ?? null)
            if (session) {
                const { data: st } = await supabase.rpc('my_signup_status')
                if (alive) setHasWorkspace(!!(st as any)?.has_workspace || !!(st as any)?.is_super_admin)
            }
            if (alive) setLoading(false)
        })()
        return () => { alive = false }
    }, [token])

    const same = !!info && !!sessionEmail && info.email.toLowerCase() === sessionEmail.toLowerCase()
    const roleLabel = info ? (ROLE_LABEL_ES[info.role] ?? info.role) : ''

    const rememberAndGo = (path: string) => {
        try { localStorage.setItem(PENDING_INVITE_KEY, token) } catch { /* nada */ }
        window.location.href = path
    }

    const accept = async () => {
        setBusy(true); setError(null)
        // Cuenta nueva (entró con Google y aún no tiene espacio): completa su registro con la invitación
        if (!hasWorkspace) {
            savePendingSignup({ mode: 'JOIN', invitationToken: token })
            window.location.href = '/complete-signup'
            return
        }
        const { error } = await supabase.rpc('accept_invitation', { p_token: token })
        if (error) { setError(error.message); setBusy(false); return }
        try { queryClient.clear(); await queryPersister.removeClient() } catch { /* nada */ }
        window.location.href = '/'
    }

    const switchAccount = async () => {
        setBusy(true)
        try { queryClient.clear(); await queryPersister.removeClient() } catch { /* nada */ }
        await supabase.auth.signOut().catch(() => {})
        window.location.reload()
    }

    return (
        <div className="min-h-dvh flex items-center justify-center p-4 bg-gradient-to-b from-indigo-50 to-white">
            <div className="w-full max-w-md bg-white rounded-3xl border border-slate-100 shadow-xl p-6 sm:p-8">
                {loading ? (
                    <p className="flex items-center justify-center gap-2 text-slate-600 py-10"><Loader2 className="w-5 h-5 animate-spin" /> Revisando la invitación…</p>
                ) : !info ? (
                    <Message icon={MailWarning} title="Enlace no válido" text="Este enlace de invitación no existe o está incompleto. Pide a tu escuela que te lo envíe de nuevo." />
                ) : info.status === 'ACCEPTED' ? (
                    info.still_member === false ? (
                        <Message icon={MailWarning} title="Este enlace ya se usó" text={`Esta invitación a ${info.tenant_name} ya se había aceptado, pero esa cuenta ya no pertenece a la escuela. Pide a la dirección que te envíe una invitación nueva al correo ${info.email}: llegará con otro enlace.`} />
                    ) :
                    <Message icon={CheckCircle2} title="Invitación ya aceptada" text={`La invitación a ${info.tenant_name} ya se usó. Si eres tú, solo inicia sesión.`}
                        action={<Link to={sessionEmail ? '/' : '/login'} className="inline-flex items-center justify-center min-h-[48px] px-6 rounded-2xl bg-indigo-600 text-white font-black">{sessionEmail ? 'Ir a mi inicio' : 'Iniciar sesión'}</Link>} />
                ) : info.status === 'EXPIRED' ? (
                    <Message icon={MailWarning} title="La invitación venció" text={`Pide a ${info.tenant_name} que te envíe una nueva invitación.`} />
                ) : (
                    <>
                        <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4"><School className="w-7 h-7" /></div>
                        <p className="text-sm font-bold text-indigo-600">Te invitaron a unirte</p>
                        <h1 className="text-2xl font-black text-slate-900 mt-1">{info.tenant_name}</h1>
                        <dl className="mt-4 space-y-1 text-sm">
                            <div className="flex gap-2"><dt className="text-slate-500 w-16">Rol:</dt><dd className="font-bold text-slate-900">{roleLabel}</dd></div>
                            <div className="flex gap-2"><dt className="text-slate-500 w-16">Correo:</dt><dd className="font-bold text-slate-900 break-all">{info.email}</dd></div>
                        </dl>

                        {error && <p role="alert" className="mt-4 text-sm text-red-800 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">{error}</p>}

                        {!sessionEmail ? (
                            <div className="mt-6 space-y-3">
                                <button type="button" onClick={() => { window.location.href = `/register?token=${encodeURIComponent(token)}` }}
                                    className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-700">
                                    <UserPlus className="w-5 h-5" /> Crear mi cuenta
                                </button>
                                <button type="button" onClick={() => rememberAndGo('/login')}
                                    className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] rounded-2xl border border-slate-200 text-slate-800 font-bold hover:bg-slate-50">
                                    <LogIn className="w-5 h-5" /> Ya tengo cuenta: iniciar sesión
                                </button>
                                <p className="text-xs text-slate-500 text-center">Usa el correo <strong>{info.email}</strong>.</p>
                            </div>
                        ) : same ? (
                            <div className="mt-6 space-y-3">
                                <button type="button" onClick={accept} disabled={busy}
                                    className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] rounded-2xl bg-emerald-500 text-white font-black hover:bg-emerald-600 disabled:opacity-60">
                                    {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />} Aceptar y entrar
                                </button>
                                <p className="text-xs text-slate-500 text-center">Si ya tienes otro espacio u otro puesto en esta escuela, no pierdes nada: podrás cambiar entre ellos desde el menú «Espacio de trabajo».</p>
                            </div>
                        ) : (
                            <div className="mt-6 space-y-3">
                                <p className="text-sm text-amber-900 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
                                    Ahora tienes abierta la sesión de <strong className="break-all">{sessionEmail}</strong>, pero esta invitación es para <strong className="break-all">{info.email}</strong>.
                                    Si eres quien envió la invitación, comparte este enlace con la persona invitada: ella debe abrirlo en su propio celular o computadora.
                                </p>
                                <button type="button" onClick={switchAccount} disabled={busy}
                                    className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] rounded-2xl border border-slate-200 text-slate-800 font-bold hover:bg-slate-50 disabled:opacity-60">
                                    <LogOut className="w-5 h-5" /> Cerrar esta sesión y continuar como {info.email}
                                </button>
                                <Link to="/" className="block text-center text-sm font-bold text-indigo-700 underline">Volver a mi inicio</Link>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

function Message({ icon: Icon, title, text, action }: { icon: any; title: string; text: string; action?: React.ReactNode }) {
    return (
        <div className="text-center py-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center mb-4"><Icon className="w-7 h-7" /></div>
            <h1 className="text-xl font-black text-slate-900">{title}</h1>
            <p className="text-sm text-slate-600 mt-2">{text}</p>
            {action && <div className="mt-6">{action}</div>}
        </div>
    )
}
