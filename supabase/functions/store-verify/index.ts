// store-verify: confirma con la tienda (App Store / Google Play) una compra hecha en la app
// y, solo si la tienda la reconoce, actualiza la suscripción del espacio.
// Nunca se confía en lo que diga el teléfono: el estado se consulta directo a Apple o Google.
//
// Secretos (Supabase → Edge Functions → Secrets):
//   APPLE_IAP_ISSUER_ID, APPLE_IAP_KEY_ID, APPLE_IAP_PRIVATE_KEY (contenido del .p8), APPLE_BUNDLE_ID
//   GOOGLE_PLAY_SERVICE_ACCOUNT (JSON completo de la cuenta de servicio), ANDROID_PACKAGE
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
class HttpError extends Error { constructor(public status: number, message: string, public code = 'ERROR') { super(message) } }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { headers: { ...cors, 'Content-Type': 'application/json' }, status })

const b64url = (data: ArrayBuffer | Uint8Array | string) => {
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data)
    let s = ''
    for (const b of bytes) s += String.fromCharCode(b)
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const pemToDer = (pem: string) => {
    const body = pem.replace(/\\n/g, '\n').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
    return Uint8Array.from(atob(body), c => c.charCodeAt(0))
}
const jwsPayload = (jws: string) => {
    const part = jws.split('.')[1] ?? ''
    const pad = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=')
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(pad), c => c.charCodeAt(0))))
}
async function signJwt(header: Record<string, unknown>, payload: Record<string, unknown>, pem: string, alg: 'ES256' | 'RS256') {
    const params = alg === 'ES256' ? { name: 'ECDSA', namedCurve: 'P-256' } : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }
    const key = await crypto.subtle.importKey('pkcs8', pemToDer(pem), params, false, ['sign'])
    const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
    const sig = await crypto.subtle.sign(alg === 'ES256' ? { name: 'ECDSA', hash: 'SHA-256' } : { name: 'RSASSA-PKCS1-v1_5' }, key, new TextEncoder().encode(input))
    return `${input}.${b64url(sig)}`
}

interface Verified {
    store: 'APPLE' | 'GOOGLE'; productId: string; originalId: string; transactionId: string
    expires: string | null; autoRenew: boolean; state: 'ACTIVE' | 'GRACE' | 'EXPIRED' | 'REVOKED'
    environment: string; account: string | null; raw: unknown
}

// ---------------------------------------------------------------- Apple
async function verifyApple(transactionId: string): Promise<Verified> {
    const issuer = Deno.env.get('APPLE_IAP_ISSUER_ID'), kid = Deno.env.get('APPLE_IAP_KEY_ID'), pem = Deno.env.get('APPLE_IAP_PRIVATE_KEY')
    const bundle = Deno.env.get('APPLE_BUNDLE_ID') || 'com.nemia.app'
    if (!issuer || !kid || !pem) throw new HttpError(503, 'La verificación con App Store aún no está configurada', 'NOT_CONFIGURED')
    if (!/^\d{1,30}$/.test(transactionId)) throw new HttpError(400, 'Transacción inválida', 'INVALID')
    const now = Math.floor(Date.now() / 1000)
    const token = await signJwt({ alg: 'ES256', kid, typ: 'JWT' }, { iss: issuer, iat: now, exp: now + 300, aud: 'appstoreconnect-v1', bid: bundle }, pem, 'ES256')

    let body: any = null, environment = 'Production'
    for (const [env, host] of [['Production', 'api.storekit.itunes.apple.com'], ['Sandbox', 'api.storekit-sandbox.itunes.apple.com']]) {
        const res = await fetch(`https://${host}/inApps/v1/subscriptions/${transactionId}`, { headers: { Authorization: `Bearer ${token}` } })
        if (res.ok) { body = await res.json(); environment = env; break }
        if (res.status === 401) throw new HttpError(503, 'App Store rechazó las credenciales del servidor', 'NOT_CONFIGURED')
        if (res.status !== 404) console.error('App Store', env, res.status, (await res.text()).slice(0, 300))
    }
    if (!body) throw new HttpError(404, 'App Store no reconoce esta compra', 'NOT_FOUND')

    // Se toma la transacción más reciente de entre los grupos de suscripción
    let best: any = null
    for (const group of body.data ?? []) for (const item of group.lastTransactions ?? []) {
        const tx = jwsPayload(item.signedTransactionInfo)
        const renewal = item.signedRenewalInfo ? jwsPayload(item.signedRenewalInfo) : {}
        if (!best || (tx.expiresDate ?? 0) > (best.tx.expiresDate ?? 0)) best = { tx, renewal, status: item.status }
    }
    if (!best) throw new HttpError(404, 'La compra no tiene una suscripción asociada', 'NOT_FOUND')
    if (best.tx.bundleId !== bundle) throw new HttpError(400, 'La compra pertenece a otra aplicación', 'INVALID')
    // 1 activa · 2 vencida · 3 reintento de cobro · 4 periodo de gracia · 5 revocada
    const state = best.status === 1 ? 'ACTIVE' : best.status === 4 ? 'GRACE' : best.status === 5 ? 'REVOKED' : 'EXPIRED'
    return {
        store: 'APPLE', productId: best.tx.productId, originalId: String(best.tx.originalTransactionId), transactionId: String(best.tx.transactionId),
        expires: best.tx.expiresDate ? new Date(best.tx.expiresDate).toISOString() : null,
        autoRenew: best.renewal.autoRenewStatus === 1, state, environment,
        account: best.tx.appAccountToken ? String(best.tx.appAccountToken).toLowerCase() : null,
        raw: { status: best.status, tx: best.tx, renewal: best.renewal },
    }
}

// ---------------------------------------------------------------- Google
async function googleToken(): Promise<string> {
    const raw = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT')
    if (!raw) throw new HttpError(503, 'La verificación con Google Play aún no está configurada', 'NOT_CONFIGURED')
    let sa: any
    try { sa = JSON.parse(raw) } catch { throw new HttpError(503, 'La cuenta de servicio de Google Play no es un JSON válido', 'NOT_CONFIGURED') }
    const now = Math.floor(Date.now() / 1000)
    const assertion = await signJwt({ alg: 'RS256', typ: 'JWT' },
        { iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 600 }, sa.private_key, 'RS256')
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || !body.access_token) throw new HttpError(503, 'Google rechazó las credenciales del servidor', 'NOT_CONFIGURED')
    return body.access_token
}

async function verifyGoogle(purchaseToken: string): Promise<Verified> {
    if (!purchaseToken || purchaseToken.length > 2000) throw new HttpError(400, 'Compra inválida', 'INVALID')
    const pkg = Deno.env.get('ANDROID_PACKAGE') || 'com.nemia.app'
    const token = await googleToken()
    const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}/purchases`
    const res = await fetch(`${base}/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`, { headers: { Authorization: `Bearer ${token}` } })
    const sub = await res.json().catch(() => ({}))
    if (res.status === 404 || res.status === 410) throw new HttpError(404, 'Google Play no reconoce esta compra', 'NOT_FOUND')
    if (!res.ok) { console.error('Google Play', res.status, JSON.stringify(sub).slice(0, 300)); throw new HttpError(502, 'Google Play no respondió', 'STORE_DOWN') }

    const line = (sub.lineItems ?? []).slice().sort((a: any, b: any) => String(b.expiryTime ?? '').localeCompare(String(a.expiryTime ?? '')))[0]
    if (!line) throw new HttpError(404, 'La compra no tiene una suscripción asociada', 'NOT_FOUND')
    const st = String(sub.subscriptionState ?? '')
    if (st === 'SUBSCRIPTION_STATE_PENDING') throw new HttpError(409, 'El pago sigue pendiente de confirmación', 'PENDING')
    // CANCELED: el usuario apagó la renovación pero conserva el periodo pagado
    const state = st === 'SUBSCRIPTION_STATE_ACTIVE' || st === 'SUBSCRIPTION_STATE_CANCELED' ? 'ACTIVE'
        : st === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD' ? 'GRACE' : 'EXPIRED'

    if (state !== 'EXPIRED' && sub.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING') {
        // Sin este acuse Google reembolsa la compra a los 3 días
        const ack = await fetch(`${base}/subscriptions/${encodeURIComponent(line.productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`,
            { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}' })
        if (!ack.ok) console.error('Google ack', ack.status, (await ack.text()).slice(0, 300))
    }
    return {
        store: 'GOOGLE', productId: line.productId, originalId: purchaseToken, transactionId: String(sub.latestOrderId ?? ''),
        expires: line.expiryTime ?? null, autoRenew: !!line.autoRenewingPlan?.autoRenewEnabled, state,
        environment: sub.testPurchase ? 'Test' : 'Production',
        account: sub.externalAccountIdentifiers?.obfuscatedExternalAccountId ? String(sub.externalAccountIdentifiers.obfuscatedExternalAccountId).toLowerCase() : null,
        raw: sub,
    }
}

// ---------------------------------------------------------------- Entrada
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
    try {
        const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
        const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
        const { data: auth } = await admin.auth.getUser(jwt)
        const user = auth?.user
        if (!user) throw new HttpError(401, 'Sesión inválida o expirada', 'NO_SESSION')

        const body = await req.json().catch(() => ({}))
        const tenantId = String(body.tenantId ?? '').toLowerCase()
        const purchases: any[] = Array.isArray(body.purchases) ? body.purchases.slice(0, 5) : []
        if (!/^[0-9a-f-]{36}$/.test(tenantId)) throw new HttpError(400, 'Falta el espacio', 'INVALID')
        if (!purchases.length) return json({ results: [] })

        const { data: link } = await admin.from('profile_tenants').select('role, tenants(type)').eq('profile_id', user.id).eq('tenant_id', tenantId).limit(5)
        const canManage = (link ?? []).some((l: any) => l.tenants?.type === 'INDEPENDENT' || ['DIRECTOR', 'ADMIN'].includes(String(l.role).toUpperCase()))
        if (!canManage) throw new HttpError(403, 'Solo el titular del espacio puede gestionar la suscripción', 'FORBIDDEN')

        const results = []
        for (const p of purchases) {
            try {
                const v = p.store === 'APPLE' ? await verifyApple(String(p.transactionId ?? ''))
                    : p.store === 'GOOGLE' ? await verifyGoogle(String(p.purchaseToken ?? ''))
                        : (() => { throw new HttpError(400, 'Tienda desconocida', 'INVALID') })()
                // La compra se hizo para un espacio concreto (lo fija la app al comprar)
                if (v.account && v.account !== tenantId) throw new HttpError(409, 'Esta compra pertenece a otro espacio de trabajo', 'OTHER_SPACE')
                const { data, error } = await admin.rpc('store_apply_purchase', {
                    p_tenant: tenantId, p_user: user.id, p_store: v.store, p_product: v.productId, p_original_id: v.originalId,
                    p_transaction_id: v.transactionId, p_expires: v.expires, p_auto_renew: v.autoRenew, p_state: v.state,
                    p_environment: v.environment, p_raw: v.raw,
                })
                if (error) throw new HttpError(409, error.message, /otro espacio/.test(error.message) ? 'OTHER_SPACE' : 'REJECTED')
                results.push({ ok: true, store: v.store, productId: v.productId, transactionId: p.transactionId ?? null, ...(data as object) })
            } catch (e) {
                const err = e instanceof HttpError ? e : new HttpError(500, e instanceof Error ? e.message : 'Error interno')
                if (!(e instanceof HttpError)) console.error('store-verify', e)
                results.push({ ok: false, store: p.store ?? null, code: err.code, error: err.message })
            }
        }
        return json({ results })
    } catch (e) {
        const err = e instanceof HttpError ? e : new HttpError(500, 'Error interno')
        if (!(e instanceof HttpError)) console.error('store-verify', e)
        return json({ error: err.message, code: err.code }, err.status)
    }
})
