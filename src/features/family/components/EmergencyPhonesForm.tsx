import { useEffect, useState } from 'react'
import { Phone, Loader2, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { formatPhone, normalizePhone, phonesProblem } from '../../../lib/phones'

interface Props {
    /** Texto del botón; por defecto "Guardar teléfonos". */
    submitLabel?: string
    onSaved?: () => void
    /** Sin marco (para ponerlo dentro de otra tarjeta). */
    bare?: boolean
}

const input = 'w-full border-2 border-slate-200 rounded-xl pl-10 pr-3 py-3 text-base font-bold tracking-wide focus:border-rose-400 focus:outline-none'

/**
 * La madre/padre confirma o corrige sus teléfonos de emergencia:
 * uno principal (obligatorio) y dos de respaldo.
 */
export const EmergencyPhonesForm = ({ submitLabel = 'Guardar teléfonos', onSaved, bare }: Props) => {
    const [phones, setPhones] = useState({ main: '', alt1: '', alt2: '' })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [saved, setSaved] = useState(false)

    useEffect(() => {
        let alive = true
        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setLoading(false); return }
            const { data } = await supabase
                .from('guardians')
                .select('phone, phone_alt1, phone_alt2')
                .or(`user_id.eq.${user.id},profile_id.eq.${user.id}`)
                .limit(1)
                .maybeSingle()
            if (!alive) return
            if (data) setPhones({ main: formatPhone(data.phone), alt1: formatPhone(data.phone_alt1), alt2: formatPhone(data.phone_alt2) })
            setLoading(false)
        }
        load()
        return () => { alive = false }
    }, [])

    const save = async (e: React.FormEvent) => {
        e.preventDefault()
        const problem = phonesProblem(phones.main, phones.alt1, phones.alt2)
        if (problem) { setError(problem); return }
        setSaving(true)
        setError(null)
        const { error: rpcError } = await supabase.rpc('update_my_contact_phones', {
            p_phone: normalizePhone(phones.main),
            p_alt1: normalizePhone(phones.alt1) || null,
            p_alt2: normalizePhone(phones.alt2) || null,
        })
        setSaving(false)
        if (rpcError) { setError(rpcError.message); return }
        setSaved(true)
        onSaved?.()
    }

    const field = (key: 'main' | 'alt1' | 'alt2', label: string, hint: string) => (
        <label className="block">
            <span className="text-sm font-black text-slate-800">{label}</span>
            <span className="relative block mt-1">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                    type="tel"
                    inputMode="tel"
                    autoComplete={key === 'main' ? 'tel' : 'off'}
                    value={phones[key]}
                    onChange={e => { setPhones(p => ({ ...p, [key]: e.target.value })); setSaved(false); setError(null) }}
                    placeholder="961 123 4567"
                    className={input}
                    aria-label={label}
                />
            </span>
            <span className="block text-xs text-slate-500 mt-1">{hint}</span>
        </label>
    )

    if (loading) return <div className="py-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-rose-500" /></div>

    return (
        <form onSubmit={save} className={bare ? 'space-y-4' : 'space-y-4 bg-white rounded-3xl border border-slate-200 p-5'}>
            <div>
                <p className="text-base font-black text-slate-900">Teléfonos para emergencias</p>
                <p className="text-sm text-slate-600">La escuela los usará para localizarte si le pasa algo a tu hijo(a). Deja al menos uno; mejor si son tres.</p>
            </div>
            {field('main', 'Teléfono principal *', 'El que casi siempre contestas.')}
            {field('alt1', 'Teléfono de respaldo 1', 'Otro número tuyo o de un familiar cercano.')}
            {field('alt2', 'Teléfono de respaldo 2', 'Por ejemplo, del trabajo o de otro familiar.')}
            {error && <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>}
            {saved && <p role="status" className="text-sm text-emerald-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Teléfonos guardados.</p>}
            <button type="submit" disabled={saving}
                className="w-full py-3.5 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-black text-base disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} {submitLabel}
            </button>
        </form>
    )
}
