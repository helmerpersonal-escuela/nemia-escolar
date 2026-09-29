// send-staff-invite: envía por correo el enlace de una invitación de personal.
// Solo la dirección de la escuela de la invitación puede pedirlo.
// Correo con Resend (misma configuración que billing-notify: RESEND_API_KEY y, opcional, INVITE_FROM_EMAIL).
// Si no hay llave, responde { sent: false, reason: 'no_provider' } y la app pide copiar el enlace.
import { corsHeaders } from "../_shared/cors.ts"
import { errorResponse, getAdminClient, getRoleInTenant, HttpError, isSuperAdmin, requireUser } from "../_shared/auth.ts"

const esc = (s: string) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const ROLE_ES: Record<string, string> = {
    TEACHER: 'Docente', DIRECTOR: 'Directivo', ACADEMIC_COORD: 'Coordinación académica', TECH_COORD: 'Coordinación de tecnologías',
    SCHOOL_CONTROL: 'Control escolar / Secretaría', PREFECT: 'Prefectura', SUPPORT: 'Apoyo educativo', ADMIN: 'Administración',
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    try {
        const admin = getAdminClient()
        const user = await requireUser(req, admin)
        const { invitation_id } = await req.json().catch(() => ({}))
        if (!invitation_id) throw new HttpError(400, 'Falta la invitación')

        const { data: inv } = await admin.from('staff_invitations').select('id, tenant_id, email, role, token, status, expires_at, job_title').eq('id', invitation_id).maybeSingle()
        if (!inv) throw new HttpError(404, 'La invitación no existe')
        const role = await getRoleInTenant(admin, user.id, inv.tenant_id)
        if (!['DIRECTOR', 'ADMIN', 'SUPER_ADMIN'].includes(role ?? '') && !(await isSuperAdmin(admin, user))) throw new HttpError(403, 'Solo la dirección puede enviar invitaciones')
        if (inv.status !== 'PENDING') throw new HttpError(400, 'Esta invitación ya se usó o se canceló')

        const apiKey = Deno.env.get('RESEND_API_KEY')
        if (!apiKey) return json({ sent: false, reason: 'no_provider' })

        const { data: tenant } = await admin.from('tenants').select('name').eq('id', inv.tenant_id).maybeSingle()
        const { data: sender } = await admin.from('profile_tenants').select('first_name, last_name_paternal').eq('profile_id', user.id).eq('tenant_id', inv.tenant_id).maybeSingle()
        const site = (Deno.env.get('FRONTEND_URL') || 'https://vunlek.com').replace(/\/$/, '')
        const link = `${site}/invitacion?token=${inv.token}`
        const school = esc(tenant?.name ?? 'tu escuela')
        const who = [sender?.first_name, sender?.last_name_paternal].filter(Boolean).join(' ')
        const puesto = esc(inv.job_title || ROLE_ES[String(inv.role).toUpperCase()] || inv.role)
        const vence = new Date(inv.expires_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', timeZone: 'America/Mexico_City' })

        const html = `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;padding:28px">
<tr><td style="font-size:20px;font-weight:bold;color:#4f46e5;padding-bottom:12px">VUNLEK</td></tr>
<tr><td style="font-size:15px;line-height:1.6">
<p style="margin:0 0 12px">${who ? `${esc(who)} te invitó` : 'Te invitaron'} a unirte a <b>${school}</b> en VUNLEK como <b>${puesto}</b>.</p>
<p style="margin:0 0 12px">Toca el botón y entra con este correo (<b>${esc(inv.email)}</b>), o con tu cuenta de Google del mismo correo.</p>
</td></tr>
<tr><td style="padding:12px 0 20px"><a href="${link}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:12px">Aceptar invitación</a></td></tr>
<tr><td style="font-size:12px;color:#64748b">La invitación vence el ${vence}. Si el botón no abre, copia este enlace: ${link}<br>Si no esperabas este correo, ignóralo.</td></tr>
</table></td></tr></table></body></html>`

        const from = Deno.env.get('INVITE_FROM_EMAIL') || Deno.env.get('BILLING_FROM_EMAIL') || 'VUNLEK <avisos@vunlek.com>'
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from, to: [inv.email], subject: `Invitación a ${tenant?.name ?? 'tu escuela'} en VUNLEK`, html }),
        })
        if (!res.ok) {
            const err = await res.text().catch(() => String(res.status))
            console.error('send-staff-invite resend', res.status, err.slice(0, 300))
            return json({ sent: false, reason: 'provider_error', detail: `${res.status}: ${err.slice(0, 200)}` })
        }
        return json({ sent: true })
    } catch (error) {
        console.error('send-staff-invite error:', error instanceof Error ? error.message : error)
        return errorResponse(error, corsHeaders)
    }
})
