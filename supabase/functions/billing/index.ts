// billing: cotizar, iniciar el pago en Mercado Pago (web) y cancelar el cobro automático.
// El precio y el espacio NUNCA se toman del cliente sin validar.
import { corsHeaders } from "../_shared/cors.ts"
import { errorResponse, getAdminClient, HttpError, requireUser } from "../_shared/auth.ts"
import { frontendUrl, mp, mpToken, quote, subRef } from "../_shared/billing.ts"

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status })

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    try {
        const admin = getAdminClient()
        const user = await requireUser(req, admin)
        const body = await req.json().catch(() => ({}))
        const action = String(body.action ?? 'quote')

        if (action === 'quote') {
            return json(await quote(admin, String(body.plan ?? 'ANNUAL'), body.promoCode))
        }

        // Espacio: el que pida el usuario, siempre que lo administre
        const tenantId = String(body.tenantId ?? '')
        if (!tenantId) throw new HttpError(400, 'Falta el espacio')
        const { data: link } = await admin
            .from('profile_tenants')
            .select('role, tenants(name, type)')
            .eq('profile_id', user.id)
            .eq('tenant_id', tenantId)
            .maybeSingle()
        const tenant = (link as any)?.tenants
        const canManage = !!link && (tenant?.type === 'INDEPENDENT' || ['DIRECTOR', 'ADMIN'].includes(String(link.role).toUpperCase()))
        if (!canManage) throw new HttpError(403, 'Solo la dirección o el titular del espacio puede gestionar la suscripción')

        const token = await mpToken(admin)
        const base = frontendUrl()

        if (action === 'checkout') {
            const q = await quote(admin, String(body.plan ?? ''), body.promoCode)
            if (body.promoCode && !q.code_valid) throw new HttpError(400, q.code_message || 'El código no es válido')
            const autoRenew = body.autoRenew !== false
            const payerEmail = String(body.payerEmail || user.email || '').trim().toLowerCase()
            if (!EMAIL_RE.test(payerEmail)) throw new HttpError(400, 'Escribe un correo válido')
            const title = `VUNLEK ${q.name} · ${String(tenant?.name ?? '').slice(0, 60)}`

            let initPoint: string
            if (autoRenew) {
                // Suscripción con cobro automático (Mercado Pago cobra cada mes o cada año)
                const pre = await mp<{ id: string, init_point: string }>(token, '/preapproval', {
                    method: 'POST',
                    body: JSON.stringify({
                        reason: title,
                        external_reference: subRef(tenantId, q.plan, q.code),
                        payer_email: payerEmail,
                        back_url: `${base}/suscripcion?status=approved`,
                        status: 'pending',
                        auto_recurring: {
                            frequency: q.months,
                            frequency_type: 'months',
                            transaction_amount: Number(q.final),
                            currency_id: 'MXN',
                        },
                    }),
                })
                initPoint = pre.init_point
                await admin.from('billing_events').insert({ tenant_id: tenantId, user_id: user.id, kind: 'CHECKOUT', amount: q.final, detail: { mode: 'auto', plan: q.plan, code: q.code, preapproval_id: pre.id } })
            } else {
                // Pago único por un periodo (sin cobro automático: se envían avisos antes de vencer)
                const pref = await mp<{ id: string, init_point: string }>(token, '/checkout/preferences', {
                    method: 'POST',
                    body: JSON.stringify({
                        binary_mode: true,
                        payer: { email: payerEmail },
                        items: [{ id: q.plan, title, quantity: 1, unit_price: Number(q.final), currency_id: 'MXN' }],
                        external_reference: JSON.stringify({ kind: 'once', t: tenantId, p: q.plan, c: q.code, u: user.id, a: Number(q.final) }),
                        notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercado-pago-webhook`,
                        back_urls: {
                            success: `${base}/suscripcion?status=approved`,
                            failure: `${base}/suscripcion?status=failure`,
                            pending: `${base}/suscripcion?status=pending`,
                        },
                        auto_return: 'approved',
                    }),
                })
                initPoint = pref.init_point
                await admin.from('billing_events').insert({ tenant_id: tenantId, user_id: user.id, kind: 'CHECKOUT', amount: q.final, detail: { mode: 'once', plan: q.plan, code: q.code, preference_id: pref.id } })
            }
            await admin.from('space_subscriptions').update({ payer_email: payerEmail, payer_user_id: user.id, updated_at: new Date().toISOString() }).eq('tenant_id', tenantId)
            return json({ init_point: initPoint, quote: q })
        }

        if (action === 'cancel_auto_renew') {
            const { data: sub } = await admin.from('space_subscriptions').select('mp_preapproval_id, status').eq('tenant_id', tenantId).maybeSingle()
            if (sub?.mp_preapproval_id) {
                await mp(token, `/preapproval/${encodeURIComponent(sub.mp_preapproval_id)}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) })
            }
            await admin.from('space_subscriptions').update({
                auto_renew: false,
                status: sub?.status === 'ACTIVE' ? 'CANCELED' : sub?.status,
                notices: {},
                updated_at: new Date().toISOString(),
            }).eq('tenant_id', tenantId)
            await admin.from('billing_events').insert({ tenant_id: tenantId, user_id: user.id, kind: 'AUTO_RENEW_OFF', detail: { preapproval_id: sub?.mp_preapproval_id } })
            return json({ ok: true })
        }

        throw new HttpError(400, 'Acción no válida')
    } catch (error) {
        console.error('billing error:', error instanceof Error ? error.message : error)
        return errorResponse(error, corsHeaders)
    }
})
