// billing-notify: envía por correo los avisos de la suscripción que prepara billing_daily().
// Correo con Resend (plan gratuito: 100 correos/día). Si no hay llave, los avisos quedan en cola
// y la app los muestra dentro del sistema de todos modos.
// Autorización: encabezado x-cron-secret (pg_cron) o JWT de super admin.
import { corsHeaders } from "../_shared/cors.ts"
import { errorResponse, getAdminClient, HttpError, isSuperAdmin, requireUser } from "../_shared/auth.ts"
import { frontendUrl } from "../_shared/billing.ts"

const DAILY_CAP = 90   // deja margen dentro de los 100 diarios del plan gratuito

const fmt = (iso?: string) => iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Mexico_City' }) : ''
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

function content(kind: string, p: Record<string, any>, link: string): { subject: string, lines: string[], cta: string } {
    const space = esc(String(p.space ?? 'tu espacio'))
    const end = fmt(p.ends_at)
    switch (kind) {
        case 'TRIAL_7D':
            return { subject: 'Tu mes de prueba de VUNLEK está por terminar', cta: 'Elegir mi plan',
                lines: [`Tu mes de prueba en <b>${space}</b> termina el <b>${end}</b> (en ${p.days} días).`, 'Para seguir usando VUNLEK sin interrupciones elige el plan mensual o anual. También puedes activar una clave de licencia si tu escuela o distribuidor te dio una.'] }
        case 'TRIAL_1D':
            return { subject: 'Mañana termina tu prueba de VUNLEK', cta: 'Elegir mi plan',
                lines: [`La prueba gratuita de <b>${space}</b> termina el <b>${end}</b>.`, 'Tu información se conserva; solo necesitas activar tu suscripción para seguir trabajando.'] }
        case 'TRIAL_ENDED':
            return { subject: 'Terminó tu mes de prueba de VUNLEK', cta: 'Reactivar mi espacio',
                lines: [`La prueba gratuita de <b>${space}</b> terminó el ${end}.`, 'Tus grupos, planeaciones y registros siguen guardados. Activa tu suscripción para recuperar el acceso.'] }
        case 'RENEW_7D':
            return { subject: 'Tu suscripción de VUNLEK vence pronto', cta: 'Renovar',
                lines: [`La suscripción de <b>${space}</b> vence el <b>${end}</b> y no tiene cobro automático.`, 'Renueva antes de esa fecha para no perder el acceso. Si prefieres, activa el cobro automático y olvídate de las fechas.'] }
        case 'RENEW_1D':
            return { subject: 'Mañana vence tu suscripción de VUNLEK', cta: 'Renovar',
                lines: [`La suscripción de <b>${space}</b> vence el <b>${end}</b>.`] }
        case 'EXPIRED':
            return { subject: 'Tu suscripción de VUNLEK venció', cta: 'Renovar',
                lines: [`La suscripción de <b>${space}</b> venció el ${end}.`, 'Tu información sigue guardada. Renueva para recuperar el acceso.'] }
        case 'PAYMENT_FAILED':
            return { subject: 'No pudimos cobrar tu suscripción de VUNLEK', cta: 'Actualizar forma de pago',
                lines: [`Mercado Pago no pudo realizar el cobro de <b>${space}</b>.`, 'Tienes 3 días de gracia. Revisa tu tarjeta o paga el periodo con otro método.'] }
    }
    return { subject: 'Aviso de tu suscripción de VUNLEK', cta: 'Ver mi suscripción', lines: ['Hay una novedad en tu suscripción.'] }
}

function html(name: string | null, c: { lines: string[], cta: string }, link: string) {
    return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;padding:28px">
<tr><td style="font-size:20px;font-weight:bold;color:#4f46e5;padding-bottom:12px">VUNLEK</td></tr>
<tr><td style="font-size:15px;line-height:1.6">${name ? `Hola, ${esc(name)}:<br><br>` : ''}${c.lines.map(l => `<p style="margin:0 0 12px">${l}</p>`).join('')}</td></tr>
<tr><td style="padding:12px 0 20px"><a href="${link}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:12px">${c.cta}</a></td></tr>
<tr><td style="font-size:12px;color:#64748b">Mensual $75 MXN · Anual $700 MXN. El pago se hace de forma segura en Mercado Pago desde el sitio web.<br>Si ya pagaste, ignora este mensaje.</td></tr>
</table></td></tr></table></body></html>`
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    try {
        const admin = getAdminClient()
        const secret = req.headers.get('x-cron-secret')
        let authorized = false
        if (secret) {
            const { data } = await admin.rpc('verify_cron_secret', { p_secret: secret })
            authorized = data === true
        }
        if (!authorized) {
            const user = await requireUser(req, admin)
            authorized = await isSuperAdmin(admin, user)
        }
        if (!authorized) throw new HttpError(403, 'No autorizado')

        const apiKey = Deno.env.get('RESEND_API_KEY')
        const from = Deno.env.get('BILLING_FROM_EMAIL') || 'VUNLEK <avisos@vunlek.com>'
        if (!apiKey) return new Response(JSON.stringify({ sent: 0, message: 'RESEND_API_KEY no configurada: los avisos quedan en cola' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

        const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
        const { count: sentToday } = await admin.from('billing_notices').select('id', { count: 'exact', head: true }).gte('sent_at', since)
        const budget = Math.max(0, DAILY_CAP - (sentToday ?? 0))
        const { data: pending } = await admin.from('billing_notices').select('*').is('sent_at', null).is('error', null).order('created_at').limit(budget)

        const link = `${frontendUrl()}/suscripcion`
        let sent = 0
        for (const n of pending ?? []) {
            const c = content(n.kind, n.payload ?? {}, link)
            const res = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ from, to: [n.email], subject: c.subject, html: html(n.name, c, link) }),
            })
            if (res.ok) {
                sent++
                await admin.from('billing_notices').update({ sent_at: new Date().toISOString() }).eq('id', n.id)
            } else {
                const err = await res.text().catch(() => String(res.status))
                await admin.from('billing_notices').update({ error: `${res.status}: ${err.slice(0, 300)}` }).eq('id', n.id)
            }
        }
        return new Response(JSON.stringify({ sent, pending: (pending?.length ?? 0) - sent }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } catch (error) {
        console.error('billing-notify error:', error instanceof Error ? error.message : error)
        return errorResponse(error, corsHeaders)
    }
})
