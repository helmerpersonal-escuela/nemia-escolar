// send-license-key: envía por correo, a quien pidió el presupuesto, la clave de licencia de su escuela.
// Solo lo puede llamar un super administrador. La clave se genera antes con admin_issue_key_for_lead.
// Correo con Resend (secreto RESEND_API_KEY). Sin esa llave responde NO_EMAIL y la app ofrece
// enviar la clave desde el correo del administrador.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const SUPER_ADMIN_EMAILS = ['helmerferras@gmail.com', 'helmerpersonal@gmail.com']
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { headers: { ...cors, 'Content-Type': 'application/json' }, status })
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
    try {
        const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
        const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
        const { data: auth } = await admin.auth.getUser(jwt)
        const user = auth?.user
        if (!user) return json({ error: 'Sesión inválida o expirada', code: 'NO_SESSION' }, 401)
        let isGod = !!user.email && SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase()) && !!user.email_confirmed_at
        if (!isGod) {
            const { data: p } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
            isGod = p?.role === 'SUPER_ADMIN'
        }
        if (!isGod) return json({ error: 'No autorizado', code: 'FORBIDDEN' }, 403)

        const body = await req.json().catch(() => ({}))
        const leadId = Number(body.leadId)
        if (!Number.isInteger(leadId) || leadId <= 0) return json({ error: 'Falta la solicitud', code: 'INVALID' }, 400)

        const { data: lead } = await admin.from('sales_leads').select('id, email, contact_name, school_name, license_key_id').eq('id', leadId).maybeSingle()
        if (!lead) return json({ error: 'La solicitud ya no existe', code: 'NOT_FOUND' }, 404)
        if (!lead.license_key_id) return json({ error: 'Primero genera la clave de esta solicitud', code: 'NO_KEY' }, 409)
        const { data: key } = await admin.from('license_keys').select('key, months, status').eq('id', lead.license_key_id).maybeSingle()
        if (!key) return json({ error: 'La clave ya no existe', code: 'NO_KEY' }, 409)
        if (key.status !== 'AVAILABLE') return json({ error: 'Esa clave ya fue utilizada; genera una nueva', code: 'USED' }, 409)

        const apiKey = Deno.env.get('RESEND_API_KEY')
        if (!apiKey) return json({ error: 'El envío automático de correos aún no está configurado', code: 'NO_EMAIL' }, 503)
        const from = Deno.env.get('BILLING_FROM_EMAIL') || 'VUNLEK <avisos@vunlek.com>'
        const site = (Deno.env.get('FRONTEND_URL') || 'https://vunlek.com').replace(/\/$/, '')
        const pretty = String(key.key).replace(/(.{4})(?=.)/g, '$1-')
        const school = esc(String(lead.school_name ?? 'tu escuela'))
        const html = `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;padding:28px">
<tr><td style="font-size:20px;font-weight:bold;color:#4f46e5;padding-bottom:12px">VUNLEK</td></tr>
<tr><td style="font-size:15px;line-height:1.6">
<p style="margin:0 0 12px">Hola, ${esc(String(lead.contact_name ?? ''))}:</p>
<p style="margin:0 0 12px">Esta es la clave de licencia de <b>${school}</b>. Es válida por <b>${key.months} meses</b> a partir de que se active.</p>
<p style="margin:16px 0;font-size:24px;font-weight:bold;letter-spacing:3px;background:#eef2ff;border-radius:12px;padding:14px;text-align:center">${pretty}</p>
<p style="margin:0 0 6px"><b>Cómo activarla</b></p>
<ol style="margin:0 0 12px;padding-left:20px">
<li>Entra a VUNLEK con la cuenta de la dirección de la escuela.</li>
<li>Abre <a href="${site}/presupuesto">${site.replace(/^https?:\/\//, '')}/presupuesto</a>.</li>
<li>Escribe la clave en “¿Tienes una clave de licencia?” y pulsa Activar.</li>
</ol>
<p style="margin:0 0 12px">La clave sirve una sola vez. Guárdala y no la compartas fuera de la escuela.</p>
</td></tr>
<tr><td style="font-size:12px;color:#64748b">Recibes este correo porque solicitaste un presupuesto de VUNLEK para tu escuela. Dudas: soporte@vunlek.com</td></tr>
</table></td></tr></table></body></html>`

        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from, to: [lead.email], subject: `Clave de licencia de VUNLEK para ${String(lead.school_name ?? 'tu escuela')}`, html }),
        })
        if (!res.ok) {
            const detail = (await res.text().catch(() => '')).slice(0, 200)
            console.error('Resend', res.status, detail)
            return json({ error: 'El servicio de correo rechazó el envío', code: 'EMAIL_FAILED' }, 502)
        }
        await admin.from('sales_leads').update({ key_sent_at: new Date().toISOString(), key_sent_to: lead.email }).eq('id', leadId)
        return json({ sent: true, to: lead.email })
    } catch (e) {
        console.error('send-license-key', e)
        return json({ error: 'Error interno', code: 'ERROR' }, 500)
    }
})
