import { corsHeaders } from "../_shared/cors.ts"
import { getAdminClient } from "../_shared/auth.ts"

// Webhook de Mercado Pago.
// 1) Verifica la firma x-signature (si hay secreto configurado).
// 2) Nunca confía en el cuerpo: consulta el pago directo a la API de MP.
// 3) Solo activa el plan si el monto pagado cubre el precio oficial.

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

    // Rechazar notificaciones viejas (repetición), tolerancia 10 min
    const tsMs = ts.length > 10 ? Number(ts) : Number(ts) * 1000
    if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > 10 * 60 * 1000) return false

    const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId
    let manifest = ''
    if (id) manifest += `id:${id};`
    if (requestId) manifest += `request-id:${requestId};`
    manifest += `ts:${ts};`
    const expected = await hmacSha256Hex(secret, manifest)
    return timingSafeEqual(expected, v1)
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders, status: 200 })

    try {
        const url = new URL(req.url)
        const body = await req.clone().json().catch(() => ({}))
        const topic = url.searchParams.get('type') || url.searchParams.get('topic') || body.type || body.topic
        const id = url.searchParams.get('data.id') || url.searchParams.get('id') || body?.data?.id

        if (!id) return json({ message: 'Sin id' })
        if (topic && !['payment', 'payment.created', 'payment.updated'].includes(String(topic))) {
            return json({ message: `Tema ignorado: ${topic}` })
        }

        const admin = getAdminClient()
        const { data: rows } = await admin
            .from('system_settings')
            .select('key, value')
            .in('key', ['mercadopago_access_token', 'mercadopago_webhook_secret'])
        const settings: Record<string, string> = {}
        for (const r of rows ?? []) settings[r.key] = r.value

        const accessToken = Deno.env.get('MP_ACCESS_TOKEN') || settings.mercadopago_access_token
        const webhookSecret = Deno.env.get('MP_WEBHOOK_SECRET') || settings.mercadopago_webhook_secret

        if (webhookSecret) {
            const ok = await verifySignature(req, String(url.searchParams.get('data.id') || id), webhookSecret)
            if (!ok) {
                console.warn('Firma de webhook inválida para id', id)
                return json({ error: 'Firma inválida' }, 401)
            }
        } else {
            console.warn('MP_WEBHOOK_SECRET no configurado: webhook sin verificación de firma')
        }

        if (!accessToken) {
            console.error('Falta el Access Token de Mercado Pago')
            return json({ error: 'Configuración incompleta' }, 500)
        }

        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(String(id))}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        })
        if (!mpRes.ok) {
            console.error(`MP API error al consultar pago ${id}: ${mpRes.status}`)
            return json({ error: 'No se pudo consultar el pago' }, 502) // MP reintentará
        }
        const payment = await mpRes.json()

        let ref: { userId?: string, tenantId?: string | null, planType?: string } = {}
        try { ref = JSON.parse(payment.external_reference || '{}') } catch { /* formato viejo */ }
        const userId = ref.userId
        const tenantId = ref.tenantId && ref.tenantId !== 'unknown' ? ref.tenantId : null
        const planType = ['basic', 'pro'].includes(String(ref.planType)) ? String(ref.planType) : 'pro'
        if (!userId) return json({ message: 'Sin usuario en la referencia' })

        const txBase = {
            user_id: userId,
            tenant_id: tenantId,
            amount: payment.transaction_amount,
            currency: payment.currency_id,
            provider: 'MERCADO_PAGO',
            provider_payment_id: String(payment.id),
            meta: payment,
        }

        if (payment.status !== 'approved') {
            await admin.from('payment_transactions').upsert({ ...txBase, status: payment.status }, { onConflict: 'provider_payment_id' })
            return json({ message: 'Registrado', status: payment.status })
        }

        // Validar monto contra el precio oficial
        const { data: plan } = await admin.from('license_limits').select('price_annual').eq('plan_type', planType).maybeSingle()
        const expected = Number(plan?.price_annual ?? NaN)
        if (payment.currency_id !== 'MXN' || !Number.isFinite(expected) || Number(payment.transaction_amount) + 0.01 < expected) {
            console.error(`Monto inválido para ${payment.id}: ${payment.transaction_amount} ${payment.currency_id}, esperado ${expected} MXN`)
            await admin.from('payment_transactions').upsert({ ...txBase, status: 'amount_mismatch' }, { onConflict: 'provider_payment_id' })
            return json({ message: 'Monto no coincide con el plan' })
        }

        // Idempotencia: si este pago ya se procesó, no volver a extender
        const { data: existingTx } = await admin
            .from('payment_transactions')
            .select('status')
            .eq('provider_payment_id', String(payment.id))
            .maybeSingle()
        if (existingTx?.status === 'approved') return json({ message: 'Ya procesado' })

        const now = new Date()
        const periodEnd = new Date(now)
        periodEnd.setFullYear(now.getFullYear() + 1)

        const { data: sub, error: subError } = await admin.from('subscriptions').upsert({
            user_id: userId,
            status: 'active',
            plan_type: planType,
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            mercadopago_customer_id: payment.payer?.id?.toString(),
            updated_at: now.toISOString(),
        }, { onConflict: 'user_id' }).select().single()
        if (subError) console.error('Error de suscripción:', subError.message)

        const { error: txError } = await admin.from('payment_transactions').upsert(
            { ...txBase, subscription_id: sub?.id, status: 'approved' },
            { onConflict: 'provider_payment_id' })
        if (txError) console.error('Error de transacción:', txError.message)

        return json({ message: 'Procesado' })
    } catch (error) {
        console.error('Webhook error:', error instanceof Error ? error.message : error)
        return json({ error: 'Error interno' }, 500)
    }
})
