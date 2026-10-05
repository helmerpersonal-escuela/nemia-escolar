import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { IdCard, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { BrandLogo } from '../../../components/brand/BrandLogo'
import { beep } from '../../../lib/cards'

type State = { kind: 'loading' } | { kind: 'public'; school: string | null } | { kind: 'ok' | 'warn'; title: string; detail: string }

/**
 * Lo que se abre al acercar una credencial NFC a un celular (dirección …/c/CODIGO).
 * - Personal de la escuela con sesión: registra la entrada del alumno (así un iPhone también pasa lista con NFC).
 * - Cualquier otra persona: solo ve de qué escuela es la credencial, sin datos del alumno.
 */
export const CardLandingPage = () => {
    const { token = '' } = useParams()
    const [state, setState] = useState<State>({ kind: 'loading' })

    useEffect(() => {
        let alive = true
        ;(async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (session) {
                const { data, error } = await supabase.rpc('card_check_in', { p_code: token, p_status: 'PRESENT' })
                const r = data as any
                if (!alive) return
                if (!error && r?.found && !r.error) {
                    beep(!r.already)
                    setState({ kind: r.already ? 'warn' : 'ok', title: r.name, detail: r.already ? `${r.group} · ya tenía registro de hoy` : `${r.group} · entrada registrada` })
                    return
                }
            }
            const { data: school } = await supabase.rpc('card_public', { p_code: token })
            if (alive) setState({ kind: 'public', school: (school as string) ?? null })
        })()
        return () => { alive = false }
    }, [token])

    return (
        <div className="min-h-dvh flex items-center justify-center p-4 bg-gradient-to-b from-indigo-50 to-white">
            <div className="w-full max-w-md bg-white rounded-3xl border border-slate-100 shadow-xl p-6 sm:p-8 text-center space-y-4">
                <BrandLogo className="h-12 w-auto mx-auto" alt="VUNLEK" />
                {state.kind === 'loading' ? (
                    <p className="flex items-center justify-center gap-2 text-slate-600 py-6"><Loader2 className="w-5 h-5 animate-spin" /> Leyendo la credencial…</p>
                ) : state.kind === 'public' ? (
                    <>
                        <IdCard className="w-12 h-12 mx-auto text-indigo-600" />
                        <h1 className="text-xl font-black text-slate-900">Credencial escolar</h1>
                        <p className="text-slate-600 text-sm">{state.school ? <>Esta credencial es de un alumno de <b>{state.school}</b>. Si la encontraste, por favor entrégala en la escuela.</> : 'No reconocemos esta credencial.'}</p>
                        <Link to="/login" className="inline-block text-sm font-bold text-indigo-700 underline">Soy personal de la escuela: iniciar sesión</Link>
                    </>
                ) : (
                    <div className={`rounded-3xl p-6 text-white ${state.kind === 'ok' ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                        {state.kind === 'ok' ? <CheckCircle2 className="w-12 h-12 mx-auto mb-2" /> : <AlertTriangle className="w-12 h-12 mx-auto mb-2" />}
                        <p className="text-2xl font-black">{state.title}</p>
                        <p className="font-bold opacity-90">{state.detail}</p>
                    </div>
                )}
                {state.kind !== 'loading' && state.kind !== 'public' && <p className="text-xs text-slate-500">Acerca la siguiente credencial para registrar otra entrada.</p>}
            </div>
        </div>
    )
}
