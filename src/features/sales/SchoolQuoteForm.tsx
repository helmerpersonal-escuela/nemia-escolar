import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Loader2, Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { WizardAlert, WizardField, wizardInput } from '../../components/wizard/Wizard'

export interface QuoteDefaults {
    name?: string
    email?: string
    school?: string
    cct?: string
    teachers?: number | null
    students?: number | null
}

const LEVELS = ['Preescolar', 'Primaria', 'Secundaria', 'Telesecundaria', 'Bachillerato', 'Otro']
const empty = { name: '', role: '', email: '', phone: '', school: '', cct: '', level: 'Secundaria', locality: '', teachers: '', students: '', message: '', consent: false }
const onlyDigits = (v: string) => v.replace(/\D/g, '')

/** Revisa el formulario y devuelve el primer problema (o null si está completo). */
export function quoteProblem(f: typeof empty): string | null {
    if (f.name.trim().length < 3) return 'Escribe tu nombre completo.'
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) return 'Escribe un correo válido para enviarte el presupuesto.'
    if (onlyDigits(f.phone).length < 10) return 'Escribe un teléfono o WhatsApp de 10 dígitos.'
    if (f.school.trim().length < 3) return 'Escribe el nombre de la escuela.'
    if (!(Number(f.teachers) >= 1)) return 'Indica cuántos docentes tiene la escuela.'
    if (!(Number(f.students) >= 1)) return 'Indica cuántos alumnos tiene la escuela.'
    if (!f.consent) return 'Marca la casilla para autorizar que te contactemos.'
    return null
}

/**
 * Solicitud de presupuesto para una escuela. El precio depende del número de docentes y alumnos,
 * por eso no hay precio fijo: ventas contacta a la escuela con una propuesta a su medida.
 * Sirve igual sin sesión (página pública) que dentro de la app (dirección).
 */
export const SchoolQuoteForm = ({ defaults, onSent }: { defaults?: QuoteDefaults; onSent?: () => void }) => {
    const [f, setF] = useState(empty)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [done, setDone] = useState(false)
    const set = (patch: Partial<typeof empty>) => { setF(prev => ({ ...prev, ...patch })); setError(null) }

    // Datos que ya conocemos (dentro de la app): se proponen, y la persona puede corregirlos
    useEffect(() => {
        if (!defaults) return
        setF(prev => ({
            ...prev,
            name: prev.name || defaults.name || '',
            email: prev.email || defaults.email || '',
            school: prev.school || defaults.school || '',
            cct: prev.cct || defaults.cct || '',
            teachers: prev.teachers || (defaults.teachers ? String(defaults.teachers) : ''),
            students: prev.students || (defaults.students ? String(defaults.students) : ''),
        }))
    }, [defaults?.name, defaults?.email, defaults?.school, defaults?.cct, defaults?.teachers, defaults?.students]) // eslint-disable-line react-hooks/exhaustive-deps

    const send = async (e: React.FormEvent) => {
        e.preventDefault()
        const problem = quoteProblem(f)
        if (problem) return setError(problem)
        setBusy(true); setError(null)
        const { error: err } = await supabase.rpc('submit_school_lead' as any, {
            p: { ...f, teachers: onlyDigits(f.teachers), students: onlyDigits(f.students) },
        })
        setBusy(false)
        if (err) return setError(/fetch|network/i.test(err.message) ? 'No hay conexión. Revisa tu internet e inténtalo de nuevo.' : err.message)
        setDone(true)
        onSent?.()
    }

    if (done) {
        return (
            <div role="status" className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <h3 className="text-lg font-black text-emerald-900 mt-2">Recibimos tu solicitud</h3>
                <p className="text-sm text-emerald-900 mt-1">El equipo de ventas te contactará al correo o teléfono que dejaste con un presupuesto para <b>{f.school}</b>.</p>
            </div>
        )
    }

    return (
        <form onSubmit={send} noValidate className="space-y-6">
            <fieldset className="space-y-4">
                <legend className="text-sm font-black uppercase tracking-wider text-indigo-700 mb-1">Tus datos</legend>
                <div className="grid sm:grid-cols-2 gap-4">
                    <WizardField label="Nombre completo" required><input className={wizardInput} value={f.name} onChange={e => set({ name: e.target.value })} autoComplete="name" placeholder="Ej. Ana López Ruiz" /></WizardField>
                    <WizardField label="Cargo en la escuela"><input className={wizardInput} value={f.role} onChange={e => set({ role: e.target.value })} autoComplete="organization-title" placeholder="Ej. Directora, subdirector, coordinación" /></WizardField>
                    <WizardField label="Correo" required><input className={wizardInput} type="email" inputMode="email" value={f.email} onChange={e => set({ email: e.target.value })} autoComplete="email" placeholder="nombre@correo.com" /></WizardField>
                    <WizardField label="Teléfono o WhatsApp" required><input className={wizardInput} type="tel" inputMode="tel" value={f.phone} onChange={e => set({ phone: e.target.value })} autoComplete="tel" placeholder="961 000 0000" /></WizardField>
                </div>
            </fieldset>

            <fieldset className="space-y-4">
                <legend className="text-sm font-black uppercase tracking-wider text-indigo-700 mb-1">Tu escuela</legend>
                <div className="grid sm:grid-cols-2 gap-4">
                    <WizardField label="Nombre de la escuela" required className="sm:col-span-2"><input className={wizardInput} value={f.school} onChange={e => set({ school: e.target.value })} autoComplete="organization" placeholder="Ej. Escuela Secundaria Técnica No. 37" /></WizardField>
                    <WizardField label="CCT" hint="Clave del centro de trabajo, si la tienes a la mano."><input className={`${wizardInput} uppercase`} value={f.cct} onChange={e => set({ cct: e.target.value.toUpperCase() })} maxLength={12} placeholder="07DST0000X" /></WizardField>
                    <WizardField label="Nivel">
                        <select className={wizardInput} value={f.level} onChange={e => set({ level: e.target.value })}>{LEVELS.map(l => <option key={l}>{l}</option>)}</select>
                    </WizardField>
                    <WizardField label="Municipio y estado" className="sm:col-span-2"><input className={wizardInput} value={f.locality} onChange={e => set({ locality: e.target.value })} placeholder="Ej. Tuxtla Gutiérrez, Chiapas" /></WizardField>
                    <WizardField label="Número de docentes" required hint="Incluye directivos y personal que usará el sistema."><input className={wizardInput} inputMode="numeric" value={f.teachers} onChange={e => set({ teachers: onlyDigits(e.target.value).slice(0, 4) })} placeholder="Ej. 24" /></WizardField>
                    <WizardField label="Número de alumnos" required hint="Un aproximado es suficiente."><input className={wizardInput} inputMode="numeric" value={f.students} onChange={e => set({ students: onlyDigits(e.target.value).slice(0, 6) })} placeholder="Ej. 420" /></WizardField>
                    <WizardField label="Comentarios" className="sm:col-span-2" hint="Turnos, número de grupos, fecha en que quieren empezar…"><textarea className={`${wizardInput} min-h-24`} value={f.message} onChange={e => set({ message: e.target.value })} maxLength={1000} /></WizardField>
                </div>
            </fieldset>

            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 cursor-pointer">
                <input type="checkbox" checked={f.consent} onChange={e => set({ consent: e.target.checked })} className="mt-0.5 w-5 h-5 accent-indigo-600 shrink-0" />
                <span className="text-sm text-slate-700">Autorizo que VUNLEK use estos datos para contactarme y preparar el presupuesto de mi escuela, conforme al <Link to="/privacidad" target="_blank" className="font-bold text-indigo-700 underline">Aviso de privacidad</Link>.</span>
            </label>

            {error && <WizardAlert>{error}</WizardAlert>}

            <button type="submit" disabled={busy}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 min-h-12 px-7 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm shadow-lg shadow-indigo-600/20 disabled:opacity-50">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {busy ? 'Enviando…' : 'Solicitar presupuesto'}
            </button>
        </form>
    )
}
