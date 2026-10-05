// Envía avisos push (Web Push; FCM si está configurado) cuando la base de datos lo pide.
// - La base de datos llama con el encabezado x-push-secret (secreto generado en la propia base).
// - El navegador llama con { kind: 'init' } y su sesión para obtener la llave pública (se genera sola la primera vez).
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

async function vapid(): Promise<{ publicKey: string; privateKey: string }> {
  const { data } = await admin.rpc('push_vapid')
  if (data?.publicKey && data?.privateKey) return data
  const k = webpush.generateVAPIDKeys()
  const { data: stored, error } = await admin.rpc('push_store_vapid', { p_public: k.publicKey, p_private: k.privateKey })
  if (error || !stored) throw new Error('No se pudieron crear las llaves de avisos')
  return stored
}

// --- FCM (app de Android): solo si existe el secreto FCM_SERVICE_ACCOUNT (JSON de la cuenta de servicio de Firebase)
let fcmToken: { value: string; exp: number } | null = null
const b64url = (b: ArrayBuffer | string) => btoa(typeof b === 'string' ? b : String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
async function fcmAccess(sa: { client_email: string; private_key: string }) {
  const now = Math.floor(Date.now() / 1000)
  if (fcmToken && fcmToken.exp > now + 60) return fcmToken.value
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = b64url(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }))
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), c => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const sig = b64url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${claim}`)))
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${head}.${claim}.${sig}` })
  const j = await r.json()
  if (!j.access_token) throw new Error('FCM: sin acceso')
  fcmToken = { value: j.access_token, exp: now + (j.expires_in ?? 3600) }
  return fcmToken.value
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const body = await req.json().catch(() => ({}))

    if (body?.kind === 'init') {
      const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
      const { data: { user } } = await admin.auth.getUser(token)
      if (!user) return json({ error: 'Sesión requerida' }, 401)
      return json({ publicKey: (await vapid()).publicKey })
    }

    const { data: ok } = await admin.rpc('push_secret_ok', { p: req.headers.get('x-push-secret') ?? '' })
    if (!ok) return json({ error: 'No autorizado' }, 401)
    if (!body?.kind || !body?.id) return json({ error: 'Faltan datos' }, 400)
    // Prueba pedida por la persona: espera unos segundos para que alcance a cerrar la app
    if (body.kind === 'test' && body.delay) await new Promise((r) => setTimeout(r, Math.min(20, Number(body.delay) || 0) * 1000))

    const { data: targets, error } = await admin.rpc('push_targets', { p_kind: body.kind, p_id: body.id })
    if (error) return json({ error: error.message }, 500)
    if (!targets?.length) return json({ sent: 0 })

    const keys = await vapid()
    const saRaw = Deno.env.get('FCM_SERVICE_ACCOUNT')
    const sa = saRaw ? JSON.parse(saRaw) : null
    let sent = 0
    const dead: string[] = []
    await Promise.all(targets.map(async (t: any) => {
      const payload = { title: t.title, body: t.body, url: t.url, tag: t.tag }
      try {
        if (t.kind === 'fcm') {
          if (!sa) return
          const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${await fcmAccess(sa)}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: { token: t.endpoint, notification: { title: t.title, body: t.body }, data: { url: t.url, tag: t.tag },
              android: { priority: 'HIGH', notification: { channel_id: 'mensajes', sound: 'vunlek_notificacion', tag: t.tag } },
              apns: { payload: { aps: { sound: 'vunlek_notificacion.wav' } } } } }),
          })
          if (r.status === 404 || r.status === 410) dead.push(t.sub_id)
          else if (r.ok) sent++
          return
        }
        await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, JSON.stringify(payload), {
          vapidDetails: { subject: 'mailto:soporte@vunlek.com', publicKey: keys.publicKey, privateKey: keys.privateKey },
          TTL: 60 * 60 * 12, urgency: 'high', topic: String(t.tag).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || undefined,
        })
        sent++
      } catch (e: any) {
        // 404/410: el dispositivo ya no existe (desinstaló o quitó el permiso)
        if (e?.statusCode === 404 || e?.statusCode === 410) dead.push(t.sub_id)
        else console.error('push', e?.statusCode, e?.body ?? e?.message)
      }
    }))
    if (dead.length) await admin.from('push_subscriptions').delete().in('id', dead)
    return json({ sent, removed: dead.length })
  } catch (e: any) {
    console.error(e)
    return json({ error: e?.message ?? 'Error' }, 500)
  }
})
