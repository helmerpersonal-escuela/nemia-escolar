import { corsHeaders } from "../_shared/cors.ts"
import { getAdminClient } from "../_shared/auth.ts"
import { getSettings, mp, parseSubRef, quote } from "../_shared/billing.ts"

// Webhook de Mercado Pago para las suscripciones por espacio.
// 1) Verifica la firma x-signature (si hay secreto configurado).
// 2) Nunca confía en el cuerpo: consulta el recurso directo a la API de MP.
// 3) Solo extiende el acceso si el monto cubre el precio vigente (con su código promocional).
// Temas:
//   payment                          → pago único (Checkout Pro) de un periodo
//   subscription_preapproval         → alta, pausa o cancelación del cobro automático
//   subscription_authorized_payment  → cada cobro del cobro automático (aprobado o rechazado)

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status })

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
    return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
    return diff === 0
}

async function verifySignature(req: Request, dataId: string, secret: string): Promise<boolean> {
    const header = req.headers.get('x-signature') ?? ''
    const requestId = req.headers.get('x-request-id') ?? ''
    const parts = Object.fromEntries(header.split(',').map(p => p.trim().split('=').map(s => s.trim())))
    const ts = parts['ts']
    const v1 = parts['v1']
    if (!ts || !v1) return false
    const tsMs = ts.length > 10 ? Number(ts) : Number(ts) * 1000
    if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > 10 * 60 * 1000) return false
    const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId
    let manifest = ''
    if (id) manifest += `id:${id};`
    if (requestId) manifest += `request-id:${requestId};`
    manifest += `ts:${ts};`
    return timingSafeEqual(await hmacSha256Hex(secret, manifest), v1)
}

const MONTHS: Record<string, number> = { MONTHLY: 1, ANNUAL: 12 }

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders, status: 200 })

    try {
        const url = new URL(req.url)
        const body = await req.clone().json().catch(() => ({}))
        const topic = String(url.searchParams.get('type') || url.searchParams.get('topic') || body.type || body.topic || '')
        const id = String(url.searchParams.get('data.id') || url.searchParams.get('id') || body?.data?.id || '')
        if (!id) return json({ message: 'Sin id' })

        const admin = getAdminClient()
        const settings = await getSettings(admin, ['mercadopago_access_token', 'mercadopago_webhook_secret'])
        const token = Deno.env.get('MP_ACCESS_TOKEN') || settings.mercadopago_access_token
        const webhookSecret = Deno.env.get('MP_WEBHOOK_SECRET') || settings.mercadopago_webhook_secret

        if (webhookSecret) {
            if (!(await verifySignature(req, id, webhookSecret))) {
                console.warn('Firma de webhook inválida para id', id)
                return json({ error: 'Firma inválida' }, 401)
            }
        } else {
            console.warn('MP_WEBHOOK_SECRET no configurado: webhook sin verificación de firma')
        }
        if (!token) return json({ error: 'Configuración incompleta' }, 500)

        // ---------------------------------------------------------------- cobro automático
        if (topic.startsWith('subscription_preapproval') || topic === 'preapproval') {
            const pre = await mp<any>(token, `/preapproval/${encodeURIComponent(id)}`)
            const ref = parseSubRef(pre.external_reference)
            if (!ref) return json({ message: 'Referencia desconocida' })
            const status = String(pre.status)
            if (status === 'authorized') {
                const { data: before } = await admin.from('space_subscriptions').select('mp_preapproval_id').eq('tenant_id', ref.tenantId).maybeSingle()
                // El código cuenta una sola vez por suscripción
                if (ref.code && before?.mp_preapproval_id !== pre.id) await admin.rpc('billing_count_promo_use', { p_code: ref.code }).then(() => {}, () => {})
                await admin.from('space_subscriptions').update({
                    mp_preapproval_id: pre.id, auto_renew: true, payer_email: pre.payer_email ?? undefined,
                    promo_code: ref.code, price: pre.auto_recurring?.transaction_amount ?? null,
                    updated_at: new Date().toISOString(),
                }).eq('tenant_id', ref.tenantId)
            } else if (status === 'cancelled' || status === 'paused') {
                const { data: sub } = await admin.from('space_subscriptions').select('status, mp_preapproval_id').eq('tenant_id', ref.tenantId).maybeSingle()
                if (!sub?.mp_preapproval_id || sub.mp_preapproval_id === pre.id) {
                    await admin.from('space_subscriptions').update({
                        auto_renew: false, status: sub?.status === 'ACTIVE' ? 'CANCELED' : sub?.status, notices: {},
                        updated_at: new Date().toISOString(),
                    }).eq('tenant_id', ref.tenantId)
                }
            }
            await admin.from('billing_events').insert({ tenant_id: ref.tenantId, kind: 'PREAPPROVAL', detail: { id: pre.id, status } })
            return json({ message: 'Suscripción actualizada', status })
        }

        if (topic.startsWith('subscription_authorized_payment') || topic === 'authorized_payment') {
            const ap = await mp<any>(token, `/authorized_payments/${encodeURIComponent(id)}`)
            const pre = await mp<any>(token, `/preapproval/${encodeURIComponent(ap.preapproval_id)}`)
            const ref = parseSubRef(pre.external_reference)
            if (!ref) return json({ message: 'Referencia desconocida' })
            const payStatus = String(ap.payment?.status ?? ap.status ?? '')
            const providerId = `ap_${ap.id}`
            const amount = Number(ap.transaction_amount ?? pre.auto_recurring?.transaction_amount ?? 0)
            const txBase = { tenant_id: ref.tenantId, amount, currency: ap.currency_id ?? 'MXN', provider: 'MERCADO_PAGO', provider_payment_id: providerId, meta: ap }

            if (payStatus !== 'approved') {
                await admin.from('payment_transactions').upsert({ ...txBase, status: payStatus || 'unknown' }, { onConflict: 'provider_payment_id' })
                if (['rejected', 'cancelled'].includes(payStatus)) {
                    await admin.from('space_subscriptions').update({ status: 'PAST_DUE', updated_at: new Date().toISOString() }).eq('tenant_id', ref.tenantId).in('status', ['ACTIVE', 'CANCELED'])
                    await admin.rpc('billing_queue_notice', { p_tenant: ref.tenantId, p_kind: 'PAYMENT_FAILED', p_payload: { amount } })
                }
                return json({ message: 'Registrado', status: payStatus })
            }

            const { data: prev } = await admin.from('payment_transactions').select('status').eq('provider_payment_id', providerId).maybeSingle()
            if (prev?.status === 'approved') return json({ message: 'Ya procesado' })

            // El monto esperado es el que nuestro servidor fijó al crear la suscripción en MP
            const expected = Number(pre.auto_recurring?.transaction_amount ?? NaN)
            if (!Number.isFinite(expected) || amount + 0.01 < expected) {
                console.error(`Monto insuficiente ${amount} < ${expected} (${ref.plan} ${ref.code ?? ''})`)
                await admin.from('payment_transactions').upsert({ ...txBase, status: 'amount_mismatch' }, { onConflict: 'provider_payment_id' })
                return json({ message: 'Monto no coincide' })
            }
            await admin.from('payment_transactions').upsert({ ...txBase, status: 'approved' }, { onConflict: 'provider_payment_id' })
            await admin.rpc('billing_extend', {
                p_tenant: ref.tenantId, p_months: MONTHS[ref.plan], p_plan: ref.plan, p_kind: 'RENEWAL',
                p_amount: amount, p_detail: { preapproval_id: pre.id, authorized_payment_id: ap.id }, p_auto_renew: true,
            })
            await admin.from('space_subscriptions').update({ mp_preapproval_id: pre.id, price: amount, promo_code: ref.code }).eq('tenant_id', ref.tenantId)
            return json({ message: 'Cobro aplicado' })
        }

        // ---------------------------------------------------------------- pago único
        if (topic && !topic.startsWith('payment')) return json({ message: `Tema ignorado: ${topic}` })

        const payment = await mp<any>(token, `/v1/payments/${encodeURIComponent(id)}`)
        let ref: { kind?: string, t?: string, p?: string, c?: string | null, u?: string, a?: number } = {}
        try { ref = JSON.parse(payment.external_reference || '{}') } catch { /* cobros del cobro automático u otros */ }
        if (ref.kind !== 'once' || !ref.t || !MONTHS[String(ref.p)]) {
            // Los cobros del cobro automático llegan por subscription_authorized_payment
            return json({ message: 'Pago sin referencia de pago único' })
        }

        const txBase = {
            user_id: ref.u ?? null, tenant_id: ref.t, amount: payment.transaction_amount, currency: payment.currency_id,
            provider: 'MERCADO_PAGO', provider_payment_id: String(payment.id), meta: payment,
        }
        if (payment.status !== 'approved') {
            await admin.from('payment_transactions').upsert({ ...txBase, status: payment.status }, { onConflict: 'provider_payment_id' })
            return json({ message: 'Registrado', status: payment.status })
        }
        const { data: prev } = await admin.from('payment_transactions').select('status').eq('provider_payment_id', String(payment.id)).maybeSingle()
        if (prev?.status === 'approved') return json({ message: 'Ya procesado' })

        // Monto esperado: el que el servidor puso en la preferencia (referencia firmada por nosotros);
        // si no viene, el precio vigente del plan.
        const expected = Number.isFinite(Number(ref.a)) && ref.a != null ? Number(ref.a) : Number((await quote(admin, String(ref.p), null)).final)
        if (payment.currency_id !== 'MXN' || Number(payment.transaction_amount) + 0.01 < expected) {
            console.error(`Monto inválido ${payment.transaction_amount} ${payment.currency_id}, esperado ${expected}`)
            await admin.from('payment_transactions').upsert({ ...txBase, status: 'amount_mismatch' }, { onConflict: 'provider_payment_id' })
            return json({ message: 'Monto no coincide con el plan' })
        }

        await admin.from('payment_transactions').upsert({ ...txBase, status: 'approved' }, { onConflict: 'provider_payment_id' })
        await admin.rpc('billing_extend', {
            p_tenant: ref.t, p_months: MONTHS[String(ref.p)], p_plan: ref.p, p_kind: 'PAYMENT',
            p_amount: payment.transaction_amount, p_detail: { payment_id: payment.id }, p_auto_renew: false,
        })
        await admin.from('space_subscriptions').update({ price: payment.transaction_amount, promo_code: ref.c ?? null }).eq('tenant_id', ref.t)
        if (ref.c) await admin.rpc('billing_count_promo_use', { p_code: ref.c }).then(() => {}, () => {})
        return json({ message: 'Procesado' })
    } catch (error) {
        console.error('Webhook error:', error instanceof Error ? error.message : error)
        return json({ error: 'Error interno' }, 500)
    }
})
