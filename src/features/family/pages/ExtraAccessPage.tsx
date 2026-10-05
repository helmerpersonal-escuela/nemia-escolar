import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { UserCheck, Loader2, CheckCircle2, LogOut } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabase'
import { queryClient } from '../../../lib/queryClient'
import { GoogleButton } from '../../auth/components/GoogleButton'
import { savePendingSignup, readPendingSignup, clearPendingSignup } from '../../auth/lib/googleAuth'
import { authMessage } from '../../../lib/authMessages'
import { normalizeFamilyCode, isCompleteFamilyCode } from '../lib/familyCode'
import { isValidPhone, normalizePhone } from '../../../lib/phones'
import { RELATIONSHIPS } from '../lib/familyAccess'

const input = 'w-full border-2 border-slate-200 rounded-xl px-3 py-3 text-base font-bold focus:border-indigo-400 focus:outline-none'

/**
 * Cuenta adicional: la persona que el tutor titular autorizó (abuela, tío, etc.) entra con SU propia cuenta,
 * escribe el código de un solo uso y registra sus datos básicos. Así la escuela sabe siempre quién está conectado.
 */
export const ExtraAccessPage = () => {
    const pending = readPendingSignup()
    const [session, setSession] = useState<Session | null | undefined>(undefined)
    const [code, setCode] = useState(normalizeFamilyCode(pending?.extraCode ?? ''))
    const [f, setF] = useState({ first: '', pat: '', mat: '', rel: '', phone: '' })
    const [mail, setMail] = useState({ on: false, email: '', password: '', sent: false })
    const [busy, setBusy] = useState(false)
    const [terms, setTerms] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [done, setDone] = useState<{ student?: string; school?: string } | null>(null)

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => setSession(data.session))
        const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
        return () => sub.subscription.unsubscribe()
    }, [])

    const codeProblem = () => (isCompleteFamilyCode(code) ? null : 'Escribe primero el código de 8 letras y números que te dio el tutor.')
    const remember = () => savePendingSignup({ mode: 'FAMILY', extraCode: normalizeFamilyCode(code) })

    const redeem = async (e: React.FormEvent) => {
        e.preventDefault()
        const p = codeProblem()
        if (p) { setError(p); return }
        if (!f.first.trim() || !f.pat.trim()) { setError('Escribe tu nombre y tu primer apellido.'); return }
        if (!f.rel) { setError('Elige tu parentesco con el alumno.'); return }
        if (!isValidPhone(f.phone)) { setError('Escribe tu teléfono a 10 dígitos.'); return }
        setBusy(true); setError(null)
        const { data, error: err } = await supabase.rpc('redeem_extra_access', {
            p_code: code, p_first_name: f.first, p_last_name_paternal: f.pat, p_last_name_maternal: f.mat || null, p_relationship: f.rel, p_phone: normalizePhone(f.phone),
        })
        setBusy(false)
        const res = (data ?? {}) as { error?: string; student?: string; school?: string }
        if (err || res.error) { setError(res.error || err?.message || 'No se pudo usar el código.'); return }
        clearPendingSignup(); queryClient.clear()
        setDone({ student: res.student, school: res.school })
    }

    const signUp = async (e: React.FormEvent) => {
        e.preventDefault()
        const p = codeProblem()
        if (p) { setError(p); return }
        if (!/^\S+@\S+\.\S+$/.test(mail.email.trim())) { setError('Revisa tu correo electrónico.'); return }
        if (mail.password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
        if (!terms) { setError('Debes aceptar los Términos y la Política de Privacidad.'); return }
        setBusy(true); setError(null)
        remember()
        const { data, error: err } = await supabase.auth.signUp({
            email: mail.email.trim().toLowerCase(), password: mail.password,
            options: { data: { mode: 'FAMILY' }, emailRedirectTo: `${window.location.origin}/familia/adicional` },
        })
        setBusy(false)
        if (err) { setError(authMessage(err)); return }
        if (data.session) setSession(data.session); else setMail(m => ({ ...m, sent: true }))
    }

    if (session === undefined) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>

    return (
        <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-[2rem] shadow-xl border border-slate-100 p-6 sm:p-8 space-y-5">
                <div className="text-center">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto mb-4"><UserCheck className="w-7 h-7" /></div>
                    <h1 className="text-2xl font-black text-slate-900">Cuenta adicional</h1>
                    <p className="text-sm text-slate-600 mt-1">Para la persona que el tutor autorizó a ver la información del alumno. Entra con <b>tu propia cuenta</b> y tus datos.</p>
                </div>

                {done ? (
                    <div className="space-y-4 text-center">
                        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                        <p className="text-slate-700">Listo. Ya puedes ver a <b>{done.student ?? 'el alumno'}</b>{done.school ? <> en <b>{done.school}</b></> : null} con tu cuenta adicional.</p>
                        <button type="button" onClick={() => { window.location.href = '/' }} className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black">Entrar</button>
                    </div>
                ) : mail.sent ? (
                    <p className="text-center text-slate-700">Te enviamos un correo a <b>{mail.email}</b>. Ábrelo, confirma tu cuenta y volverás aquí para terminar.</p>
                ) : (
                    <>
                        <div>
                            <label htmlFor="extra-code" className="block text-sm font-black text-slate-800 mb-1.5">1. Código que te dio el tutor</label>
                            <input id="extra-code" value={code} onChange={e => { setCode(normalizeFamilyCode(e.target.value)); setError(null) }} placeholder="ABCD-2345" autoComplete="off" autoCapitalize="characters"
                                className={`${input} tracking-[0.25em] text-center text-xl`} />
                            <p className="text-xs text-slate-500 mt-1.5">Sirve una sola vez y vence a los 7 días.</p>
                        </div>

                        {!session ? (
                            <div className="space-y-3">
                                <p className="text-sm font-black text-slate-800">2. Entra con tu cuenta (no la del tutor)</p>
                                <GoogleButton label="Continuar con Google" intent={{ mode: 'FAMILY', extraCode: normalizeFamilyCode(code) }} beforeStart={codeProblem} />
                                {!mail.on ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        <button type="button" onClick={() => setMail(m => ({ ...m, on: true }))} className="py-3 rounded-2xl border-2 border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50">Crear cuenta con correo</button>
                                        <Link to="/login" onClick={remember} className="py-3 rounded-2xl border-2 border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 text-center">Ya tengo cuenta</Link>
                                    </div>
                                ) : (
                                    <form onSubmit={signUp} className="space-y-2">
                                        <input type="email" className={input} aria-label="Tu correo" placeholder="Tu correo" autoComplete="email" value={mail.email} onChange={e => setMail({ ...mail, email: e.target.value })} />
                                        <input type="password" className={input} aria-label="Contraseña" placeholder="Crea una contraseña (8 o más)" autoComplete="new-password" value={mail.password} onChange={e => setMail({ ...mail, password: e.target.value })} />
                                        <label className="flex items-start gap-2 text-xs text-slate-600"><input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} className="mt-0.5" />
                                            <span>Acepto los <Link to="/terminos" className="underline">Términos</Link> y la <Link to="/privacidad" className="underline">Política de Privacidad</Link>.</span></label>
                                        <button type="submit" disabled={busy} className="w-full py-3.5 rounded-2xl bg-indigo-600 text-white font-black disabled:opacity-50">Crear mi cuenta</button>
                                    </form>
                                )}
                                <p className="text-xs text-slate-500">Si ya iniciaste sesión, vuelve a abrir <b>vunlek.com/familia/adicional</b>.</p>
                            </div>
                        ) : (
                            <form onSubmit={redeem} className="space-y-3">
                                <p className="text-sm font-black text-slate-800">2. Tus datos</p>
                                <p className="text-sm text-slate-600">Entraste como <b className="break-all">{session.user.email}</b>.</p>
                                <input className={input} aria-label="Tu nombre" placeholder="Nombre(s)" value={f.first} onChange={e => setF({ ...f, first: e.target.value })} />
                                <div className="grid grid-cols-2 gap-2">
                                    <input className={input} aria-label="Primer apellido" placeholder="Primer apellido" value={f.pat} onChange={e => setF({ ...f, pat: e.target.value })} />
                                    <input className={input} aria-label="Segundo apellido" placeholder="Segundo apellido" value={f.mat} onChange={e => setF({ ...f, mat: e.target.value })} />
                                </div>
                                <select className={input} aria-label="Parentesco con el alumno" value={f.rel} onChange={e => setF({ ...f, rel: e.target.value })}>
                                    <option value="">Parentesco con el alumno…</option>
                                    {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                                <input className={input} aria-label="Tu teléfono" inputMode="tel" placeholder="Tu teléfono (10 dígitos)" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} />
                                <button type="submit" disabled={busy} className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black disabled:opacity-50 flex items-center justify-center gap-2">
                                    {busy && <Loader2 className="w-4 h-4 animate-spin" />} Activar mi cuenta adicional
                                </button>
                                <button type="button" onClick={async () => { await supabase.auth.signOut(); setSession(null) }} className="w-full flex items-center justify-center gap-2 text-sm font-bold text-slate-500"><LogOut className="w-4 h-4" /> Usar otra cuenta</button>
                            </form>
                        )}
                    </>
                )}
                {error && <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-center">{error}</p>}
                <p className="text-center text-xs text-slate-500">¿Eres el tutor titular? <Link to="/familia" className="font-bold underline">Usa el código y la CURP de tu hijo(a)</Link></p>
            </div>
        </div>
    )
}
