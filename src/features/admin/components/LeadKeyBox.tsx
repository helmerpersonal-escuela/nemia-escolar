import { useState } from 'react'
import { CheckCircle2, Copy, KeyRound, Loader2, Mail, RefreshCw, Send } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { askConfirm } from '../../../components/ui/ConfirmDialog'

const pretty = (k: string) => k.replace(/(.{4})(?=.)/g, '$1-')
const day = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

/** Texto del correo, para cuando se envía desde el correo del administrador. */
export function keyMail(lead: { email: string; contact_name?: string | null; school_name?: string | null }, key: string, months: number) {
    const school = lead.school_name || 'tu escuela'
    const subject = `Clave de licencia de VUNLEK para ${school}`
    const body = [
        `Hola, ${lead.contact_name ?? ''}:`, '',
        `Esta es la clave de licencia de ${school}. Es válida por ${months} meses a partir de que se active.`, '',
        `    ${pretty(key)}`, '',
        'Cómo activarla:',
        '1. Entra a VUNLEK con la cuenta de la dirección de la escuela.',
        '2. Abre https://vunlek.com/presupuesto',
        '3. Escribe la clave en "¿Tienes una clave de licencia?" y pulsa Activar.', '',
        'La clave sirve una sola vez. Guárdala y no la compartas fuera de la escuela.', '',
        'VUNLEK · soporte@vunlek.com',
    ].join('\n')
    return { subject, body, href: `mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` }
}

/**
 * Clave de licencia de una solicitud de presupuesto: generarla, enviarla al correo que dejó la
 * escuela (automático si hay servicio de correo; si no, desde el correo del administrador) y ver su estado.
 */
export const LeadKeyBox = ({ lead, onChanged }: { lead: any; onChanged: () => void }) => {
    const [months, setMonths] = useState(12)
    const [busy, setBusy] = useState(false)
    const [note, setNote] = useState<{ tone: 'ok' | 'warn' | 'bad'; text: string } | null>(null)
    const [fresh, setFresh] = useState<{ key: string; months: number; status: string } | null>(null)
    const [copied, setCopied] = useState(false)
    const key: { key: string; months: number; status: string } | null = fresh ?? lead.key ?? null
    const used = key?.status === 'REDEEMED'

    const send = async (current: { key: string; months: number }) => {
        const { data, error } = await supabase.functions.invoke('send-license-key', { body: { leadId: lead.id } })
        if (!error && (data as any)?.sent) {
            await supabase.rpc('admin_mark_key_sent' as any, { p_lead: lead.id })
            setNote({ tone: 'ok', text: `Clave enviada a ${lead.email}.` })
            return
        }
        let code = ''
        try { code = (await (error as any)?.context?.json?.())?.code ?? '' } catch { /* sin detalle */ }
        setNote({
            tone: 'warn',
            text: code === 'NO_EMAIL'
                ? 'El envío automático de correos todavía no está configurado. Envíala desde tu correo con el botón de abajo.'
                : code === 'USED' ? 'Esa clave ya fue utilizada; genera otra.'
                    : 'No se pudo enviar automáticamente. Envíala desde tu correo con el botón de abajo.',
        })
        void current
    }

    const generate = async (replace = false) => {
        if (replace && !(await askConfirm('¿Generar otra clave para esta solicitud? La anterior seguirá siendo válida hasta que alguien la active; si ya no debe usarse, bórrala en "Claves y códigos".'))) return
        setBusy(true); setNote(null)
        const { data, error } = await supabase.rpc('admin_issue_key_for_lead' as any, { p_lead: lead.id, p_months: months, p_new: replace })
        if (error) { setBusy(false); return setNote({ tone: 'bad', text: error.message }) }
        const k = data as any
        setFresh({ key: k.key, months: k.months, status: k.status })
        await send(k)
        setBusy(false); onChanged()
    }
    const resend = async () => { if (!key) return; setBusy(true); setNote(null); await send(key); setBusy(false); onChanged() }
    const markSent = async () => {
        setBusy(true)
        const { error } = await supabase.rpc('admin_mark_key_sent' as any, { p_lead: lead.id })
        setBusy(false)
        setNote(error ? { tone: 'bad', text: error.message } : { tone: 'ok', text: `Anotado: clave enviada a ${lead.email}.` })
        onChanged()
    }
    const copy = async () => { if (!key) return; try { await navigator.clipboard.writeText(pretty(key.key)); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* sin portapapeles */ } }

    const btn = 'inline-flex items-center gap-1.5 min-h-10 px-3 rounded-xl text-xs font-black disabled:opacity-50'
    return (
        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
                <KeyRound className="w-4 h-4 text-indigo-600 shrink-0" />
                {!key ? (
                    <>
                        <span className="text-xs font-bold text-slate-700">Clave de licencia por</span>
                        <select aria-label="Vigencia de la clave" value={months} onChange={e => setMonths(Number(e.target.value))} className="min-h-10 px-2 rounded-xl border border-slate-200 text-xs font-bold bg-white">
                            <option value={12}>12 meses</option><option value={6}>6 meses</option><option value={3}>3 meses</option>
                        </select>
                        <button onClick={() => generate(false)} disabled={busy} className={`${btn} bg-indigo-600 text-white`}>
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Generar y enviar a {lead.email}
                        </button>
                    </>
                ) : (
                    <>
                        <code className="text-sm font-black tracking-widest text-slate-900 bg-white border border-slate-200 rounded-lg px-2 py-1">{pretty(key.key)}</code>
                        <span className="text-xs text-slate-600">{key.months} meses · {used ? <b className="text-emerald-700">ya activada por la escuela</b> : lead.key_sent_at ? `enviada el ${day(lead.key_sent_at)}` : <b className="text-amber-700">sin enviar</b>}</span>
                    </>
                )}
            </div>
            {key && !used && (
                <div className="flex flex-wrap gap-2">
                    <button onClick={resend} disabled={busy} className={`${btn} bg-indigo-600 text-white`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {lead.key_sent_at ? 'Reenviar' : 'Enviar'} a {lead.email}</button>
                    <a href={keyMail(lead, key.key, key.months).href} className={`${btn} bg-white border border-slate-200 text-slate-700`}><Mail className="w-4 h-4" /> Enviar desde mi correo</a>
                    <button onClick={copy} className={`${btn} bg-white border border-slate-200 text-slate-700`}><Copy className="w-4 h-4" /> {copied ? 'Copiada' : 'Copiar clave'}</button>
                    {!lead.key_sent_at && <button onClick={markSent} disabled={busy} className={`${btn} bg-white border border-slate-200 text-slate-700`}><CheckCircle2 className="w-4 h-4" /> Ya la envié</button>}
                    <button onClick={() => generate(true)} disabled={busy} className={`${btn} bg-white border border-slate-200 text-slate-700`}><RefreshCw className="w-4 h-4" /> Generar otra</button>
                </div>
            )}
            {note && <p role={note.tone === 'bad' ? 'alert' : 'status'} className={`text-xs font-bold rounded-xl px-3 py-2 ${note.tone === 'ok' ? 'bg-emerald-50 text-emerald-800' : note.tone === 'warn' ? 'bg-amber-50 text-amber-900' : 'bg-rose-50 text-rose-800'}`}>{note.text}</p>}
        </div>
    )
}
