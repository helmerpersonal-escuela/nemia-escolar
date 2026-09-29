import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { HeartHandshake, KeyRound, Loader2, LogOut, Mail, CheckCircle2 } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabase'
import { queryClient } from '../../../lib/queryClient'
import { GoogleButton } from '../../auth/components/GoogleButton'
import { savePendingSignup, readPendingSignup, clearPendingSignup } from '../../auth/lib/googleAuth'
import { isCompleteFamilyCode, normalizeFamilyCode, redeemFamilyCode } from '../lib/familyCode'
import { EmergencyPhonesForm } from '../components/EmergencyPhonesForm'

const input = 'w-full border-2 border-slate-200 rounded-xl px-3 py-3 text-base font-bold focus:border-rose-400 focus:outline-none'

/**
 * Entrada para madres, padres y tutores.
 * 1) Escriben el código que les dio la escuela.
 * 2) Entran con Google o crean su cuenta con correo.
 * 3) La cuenta queda ligada a su hijo(a) y solo ve lo de él/ella.
 */
export const FamilyAccessPage = () => {
    const navigate = useNavigate()
    const [params] = useSearchParams()
    const pending = readPendingSignup()
    const [code, setCode] = useState(normalizeFamilyCode(params.get('codigo') || pending?.familyCode || ''))
    const [session, setSession] = useState<Session | null | undefined>(undefined)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [done, setDone] = useState<{ student?: string; school?: string } | null>(null)
    const [emailMode, setEmailMode] = useState(false)
    const [confirmSent, setConfirmSent] = useState(false)
    const [form, setForm] = useState({ firstName: '', lastNamePaternal: '', email: '', password: '' })
    const [terms, setTerms] = useState(false)
    const [phonesDone, setPhonesDone] = useState(false)

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => setSession(data.session))
        const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
        return () => sub.subscription.unsubscribe()
    }, [])

    const codeProblem = () => (isCompleteFamilyCode(code) ? null : 'Escribe primero el código de 8 letras y números que te dio la escuela.')

    const redeem = async () => {
        const problem = codeProblem()
        if (problem) { setError(problem); return }
        setBusy(true)
        setError(null)
        const res = await redeemFamilyCode(code)
        setBusy(false)
        if (!res.ok) { setError(res.error || 'No se pudo usar el código.'); return }
        clearPendingSignup()
        queryClient.clear()
        setDone({ student: res.student, school: res.school })
    }

    const signUpWithEmail = async (e: React.FormEvent) => {
        e.preventDefault()
        const problem = codeProblem()
        if (problem) { setError(problem); return }
        if (!form.firstName.trim() || !form.lastNamePaternal.trim()) { setError('Escribe tu nombre y primer apellido.'); return }
        if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) { setError('Revisa tu correo electrónico.'); return }
        if (form.password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
        if (!terms) { setError('Debes aceptar los Términos y la Política de Privacidad.'); return }
        setBusy(true)
        setError(null)
        const familyCode = normalizeFamilyCode(code)
        savePendingSignup({ mode: 'FAMILY', familyCode })
        const { data, error: signError } = await supabase.auth.signUp({
            email: form.email.trim().toLowerCase(),
            password: form.password,
            options: {
                data: { mode: 'FAMILY', firstName: form.firstName.trim().toUpperCase(), lastNamePaternal: form.lastNamePaternal.trim().toUpperCase() },
                emailRedirectTo: `${window.location.origin}/familia?codigo=${encodeURIComponent(familyCode)}`,
            },
        })
        if (signError) {
            setBusy(false)
            setError(/registered|already/i.test(signError.message)
                ? 'Ese correo ya tiene cuenta. Usa "Ya tengo cuenta" para entrar.'
                : signError.message)
            return
        }
        if (data.session) {
            setSession(data.session)
            const res = await redeemFamilyCode(familyCode, { firstName: form.firstName, lastNamePaternal: form.lastNamePaternal })
            setBusy(false)
            if (!res.ok) { setError(res.error || 'No se pudo usar el código.'); return }
            clearPendingSignup()
            queryClient.clear()
            setDone({ student: res.student, school: res.school })
            return
        }
        setBusy(false)
        setConfirmSent(true)
    }

    const goLogin = () => {
        if (isCompleteFamilyCode(code)) savePendingSignup({ mode: 'FAMILY', familyCode: normalizeFamilyCode(code) })
        navigate('/login')
    }

    const signOut = async () => {
        await supabase.auth.signOut()
        setSession(null)
    }

    if (session === undefined) {
        return <div className="min-h-screen flex items-center justify-center bg-rose-50/40"><Loader2 className="w-8 h-8 animate-spin text-rose-500" /></div>
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-[2rem] shadow-xl border border-slate-100 p-6 sm:p-8 space-y-6">
                <div className="text-center">
                    <div className="w-14 h-14 rounded-2xl bg-rose-500 text-white flex items-center justify-center mx-auto mb-4">
                        <HeartHandshake className="w-7 h-7" />
                    </div>
                    <h1 className="text-2xl font-black text-slate-900">Madres, padres y tutores</h1>
                    <p className="text-sm text-slate-600 mt-1">Consulta asistencia, calificaciones y avisos de tu hijo(a).</p>
                </div>

                {done ? (
                    <div className="space-y-5 text-center">
                        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                        <p className="text-base text-slate-700">
                            Listo. Tu cuenta quedó ligada con <b>{done.student ?? 'tu hijo(a)'}</b>
                            {done.school ? <> en <b>{done.school}</b></> : null}.
                        </p>
                        {!phonesDone ? (
                            <div className="text-left">
                                <EmergencyPhonesForm submitLabel="Guardar y continuar" onSaved={() => setPhonesDone(true)} bare />
                            </div>
                        ) : (
                            <>
                                <p className="text-sm text-slate-500">¿Tienes otro hijo(a) en la escuela? Escribe su código después desde tu panel.</p>
                                <button type="button" onClick={() => { window.location.href = '/' }}
                                    className="w-full py-3.5 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-black text-base">
                                    Ver a mi hijo(a)
                                </button>
                            </>
                        )}
                    </div>
                ) : confirmSent ? (
                    <div className="space-y-4 text-center">
                        <Mail className="w-12 h-12 text-rose-500 mx-auto" />
                        <p className="text-base text-slate-700">Te enviamos un correo a <b>{form.email}</b>.</p>
                        <p className="text-sm text-slate-600">Ábrelo y toca <b>Confirmar mi correo</b>. Tu código quedará guardado y la cuenta se ligará sola. Si no lo ves, revisa la carpeta de spam.</p>
                    </div>
                ) : (
                    <>
                        <div>
                            <label htmlFor="family-code" className="block text-sm font-black text-slate-800 mb-1.5">1. Código de tu hijo(a)</label>
                            <div className="relative">
                                <KeyRound className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    id="family-code"
                                    value={code}
                                    onChange={e => { setCode(normalizeFamilyCode(e.target.value)); setError(null) }}
                                    placeholder="ABCD-2345"
                                    autoComplete="off"
                                    autoCapitalize="characters"
                                    inputMode="text"
                                    className={`${input} pl-10 tracking-[0.25em] text-center text-xl`}
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-1.5">Viene en la hoja que te entregó la escuela. Si no la tienes, pídela a control escolar.</p>
                        </div>

                        {session ? (
                            <div className="space-y-3">
                                <p className="text-sm text-slate-600">Entraste como <b>{session.user.email}</b>.</p>
                                <button type="button" onClick={redeem} disabled={busy}
                                    className="w-full py-3.5 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-black text-base disabled:opacity-50 flex items-center justify-center gap-2">
                                    {busy && <Loader2 className="w-4 h-4 animate-spin" />} Ligar a mi hijo(a)
                                </button>
                                <button type="button" onClick={signOut} className="w-full flex items-center justify-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-700">
                                    <LogOut className="w-4 h-4" /> Usar otra cuenta
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-sm font-black text-slate-800">2. Entra con tu cuenta</p>
                                <GoogleButton
                                    label="Continuar con Google"
                                    intent={{ mode: 'FAMILY', familyCode: normalizeFamilyCode(code) }}
                                    beforeStart={codeProblem}
                                />
                                {!emailMode ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        <button type="button" onClick={() => setEmailMode(true)}
                                            className="py-3 rounded-2xl border-2 border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50">
                                            Crear cuenta con correo
                                        </button>
                                        <button type="button" onClick={goLogin}
                                            className="py-3 rounded-2xl border-2 border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50">
                                            Ya tengo cuenta
                                        </button>
                                    </div>
                                ) : (
                                    <form onSubmit={signUpWithEmail} className="space-y-3 pt-1">
                                        <div className="grid grid-cols-2 gap-2">
                                            <input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="Nombre(s)" aria-label="Nombre" className={input} />
                                            <input value={form.lastNamePaternal} onChange={e => setForm(f => ({ ...f, lastNamePaternal: e.target.value }))} placeholder="Primer apellido" aria-label="Primer apellido" className={input} />
                                        </div>
                                        <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Tu correo" aria-label="Correo" autoComplete="email" className={input} />
                                        <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Crea una contraseña (8 o más)" aria-label="Contraseña" autoComplete="new-password" className={input} />
                                        <label className="flex items-start gap-2 text-xs text-slate-600">
                                            <input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} className="mt-0.5" />
                                            <span>Acepto los <Link to="/terminos" className="underline">Términos</Link> y la <Link to="/privacidad" className="underline">Política de Privacidad</Link>.</span>
                                        </label>
                                        <button type="submit" disabled={busy}
                                            className="w-full py-3.5 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-black text-base disabled:opacity-50 flex items-center justify-center gap-2">
                                            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Crear mi cuenta
                                        </button>
                                        <button type="button" onClick={goLogin} className="w-full text-sm font-bold text-slate-500 hover:text-slate-700">Ya tengo cuenta</button>
                                    </form>
                                )}
                            </div>
                        )}
                    </>
                )}

                {error && <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-center">{error}</p>}
            </div>
        </div>
    )
}
