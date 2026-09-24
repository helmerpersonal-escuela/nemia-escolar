import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { User, School, Loader2, LogOut, Sparkles } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { queryClient } from '../../../lib/queryClient'
import { clearPendingSignup, readPendingSignup } from '../lib/googleAuth'

type Mode = 'INDEPENDENT' | 'SCHOOL'

interface SignupStatus {
    has_workspace: boolean
    is_super_admin: boolean
    email: string | null
    first_name: string | null
    last_name_paternal: string | null
    last_name_maternal: string | null
    full_name: string | null
}

/**
 * Paso final del registro con Google: elegir si la cuenta es de docente
 * (espacio propio) o de escuela (queda como director/a), o aceptar una
 * invitación dirigida a ese correo.
 */
export const CompleteSignupPage = () => {
    const navigate = useNavigate()
    const [status, setStatus] = useState<SignupStatus | null>(null)
    const [noSession, setNoSession] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const pending = readPendingSignup()
    const [mode, setMode] = useState<Mode | null>(pending?.mode === 'INDEPENDENT' || pending?.mode === 'SCHOOL' ? pending.mode : null)
    const [form, setForm] = useState({ firstName: '', lastNamePaternal: '', lastNameMaternal: '', organizationName: pending?.organizationName ?? '' })
    const [termsAccepted, setTermsAccepted] = useState(false)
    const invitation = pending?.invitationToken || null

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { if (!cancelled) setNoSession(true); return }
            const { data, error } = await supabase.rpc('my_signup_status')
            if (cancelled) return
            if (error || !data) { setError('No se pudo verificar tu cuenta. Revisa tu conexión.'); return }
            const st = data as SignupStatus
            setStatus(st)
            // Nombre desde Google (se puede corregir).
            const parts = (st.full_name ?? '').trim().split(/\s+/)
            setForm(f => ({
                ...f,
                firstName: st.first_name ?? parts[0] ?? '',
                lastNamePaternal: st.last_name_paternal ?? parts.slice(1, 2).join(' ') ?? '',
                lastNameMaternal: st.last_name_maternal ?? parts.slice(2).join(' ') ?? '',
            }))
        }
        load()
        return () => { cancelled = true }
    }, [])

    if (noSession) return <Navigate to="/login" replace />

    if (status && (status.has_workspace || status.is_super_admin)) {
        clearPendingSignup()
        return <Navigate to="/" replace />
    }

    const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm(prev => ({ ...prev, [k]: e.target.value.toUpperCase() }))

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!invitation && !mode) { setError('Elige el tipo de cuenta.'); return }
        if (!form.firstName.trim() || !form.lastNamePaternal.trim()) { setError('Escribe tu nombre y primer apellido.'); return }
        if (!invitation && mode === 'SCHOOL' && !form.organizationName.trim()) { setError('Escribe el nombre de la escuela.'); return }
        if (!termsAccepted) { setError('Debes aceptar los Términos y la Política de Privacidad.'); return }
        setSaving(true)
        setError(null)
        const { error: rpcError } = await supabase.rpc('complete_signup', {
            p_mode: invitation ? 'JOIN' : mode,
            p_organization_name: form.organizationName || null,
            p_first_name: form.firstName,
            p_last_name_paternal: form.lastNamePaternal,
            p_last_name_maternal: form.lastNameMaternal || null,
            p_invitation: invitation,
        })
        if (rpcError) {
            setError(rpcError.message)
            setSaving(false)
            return
        }
        clearPendingSignup()
        queryClient.clear()
        navigate('/', { replace: true })
    }

    const signOut = async () => {
        clearPendingSignup()
        await supabase.auth.signOut()
        navigate('/login', { replace: true })
    }

    if (!status) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                {error ? <p className="text-sm text-rose-600">{error}</p> : <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />}
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <form onSubmit={submit} className="bg-white w-full max-w-xl rounded-[2rem] shadow-xl border border-slate-100 p-8 space-y-6">
                <div className="text-center">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto mb-4">
                        <Sparkles className="w-7 h-7" />
                    </div>
                    <h1 className="text-2xl font-black text-slate-900">Completa tu registro</h1>
                    <p className="text-sm text-slate-500 mt-1">Entraste con <b>{status.email}</b></p>
                </div>

                {invitation ? (
                    <p className="text-sm bg-indigo-50 text-indigo-800 rounded-2xl p-4">
                        Vas a unirte a la escuela que te invitó. Confirma tu nombre para continuar.
                    </p>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {([
                            { id: 'INDEPENDENT', icon: User, title: 'Soy docente', text: 'Mi espacio para planear, evaluar y llevar mis grupos.' },
                            { id: 'SCHOOL', icon: School, title: 'Registrar escuela', text: 'Para dirección: personal, grupos, CTE y control escolar.' },
                        ] as const).map(o => (
                            <button
                                type="button"
                                key={o.id}
                                onClick={() => setMode(o.id)}
                                className={`text-left p-4 rounded-2xl border-2 transition-all ${mode === o.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100 hover:border-slate-200'}`}
                            >
                                <o.icon className={`w-6 h-6 mb-2 ${mode === o.id ? 'text-indigo-600' : 'text-slate-500'}`} />
                                <p className="font-black text-slate-900 text-sm">{o.title}</p>
                                <p className="text-xs text-slate-500 mt-1">{o.text}</p>
                            </button>
                        ))}
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input value={form.firstName} onChange={set('firstName')} placeholder="Nombre(s)" className="border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm font-bold" aria-label="Nombre" />
                    <input value={form.lastNamePaternal} onChange={set('lastNamePaternal')} placeholder="Apellido paterno" className="border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm font-bold" aria-label="Apellido paterno" />
                    <input value={form.lastNameMaternal} onChange={set('lastNameMaternal')} placeholder="Apellido materno" className="border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm font-bold" aria-label="Apellido materno" />
                </div>

                {!invitation && mode && (
                    <input
                        value={form.organizationName}
                        onChange={set('organizationName')}
                        placeholder={mode === 'SCHOOL' ? 'Nombre de la escuela (p. ej. ESC. SEC. TÉC. NÚM. 37)' : 'Nombre de tu espacio (opcional)'}
                        className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm font-bold"
                        aria-label="Nombre de la escuela"
                    />
                )}

                <label className="flex items-start gap-2 text-xs text-slate-600">
                    <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="mt-0.5" />
                    <span>Acepto los Términos y Condiciones y la Política de Privacidad.</span>
                </label>

                {error && <p className="text-sm text-rose-600 text-center">{error}</p>}

                <button type="submit" disabled={saving} className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />} Crear mi cuenta
                </button>
                <button type="button" onClick={signOut} className="w-full flex items-center justify-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-600">
                    <LogOut className="w-3.5 h-3.5" /> Usar otra cuenta
                </button>
            </form>
        </div>
    )
}
