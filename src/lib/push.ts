import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'
import { currentPlatform } from './notify'

/**
 * Avisos con VUNLEK cerrada (Web Push). Funciona en:
 * - Android: Chrome o VUNLEK instalada desde el navegador.
 * - iPhone/iPad: VUNLEK instalada en la pantalla de inicio (iOS 16.4+).
 * - Computadora: Chrome, Edge, Firefox y Safari (el navegador puede estar sin ventanas de VUNLEK).
 * La app de Android/iOS de tienda usa Firebase (ver docs); aquí no se registra nada en ese caso.
 */

const b64ToBytes = (b64url: string) => {
    const pad = '='.repeat((4 - (b64url.length % 4)) % 4)
    const raw = atob((b64url + pad).replace(/-/g, '+').replace(/_/g, '/'))
    return Uint8Array.from(raw, c => c.charCodeAt(0))
}
const bytesToB64 = (buf: ArrayBuffer | null) => (buf ? btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : '')

export const pushSupported = () =>
    !Capacitor.isNativePlatform() && !(window as any).vunlekDesktop && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

async function publicKey(): Promise<string | null> {
    const { data } = await supabase.from('push_config').select('value').eq('key', 'vapid_public_key').maybeSingle()
    if (data?.value) return data.value
    // Primera vez en todo el sistema: el servidor crea sus llaves
    const { data: created } = await supabase.functions.invoke('send-push', { body: { kind: 'init' } })
    return (created as any)?.publicKey ?? null
}

export type PushState = 'on' | 'off' | 'unsupported' | 'blocked'

/** ¿Este dispositivo ya recibe avisos con la app cerrada? */
export async function pushState(): Promise<PushState> {
    if (!pushSupported()) return 'unsupported'
    if (Notification.permission === 'denied') return 'blocked'
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

/** Suscribe este dispositivo (requiere que el permiso de avisos ya esté concedido). Seguro de llamar varias veces. */
export async function enablePush(): Promise<PushState> {
    try {
        if (!pushSupported()) return 'unsupported'
        if (Notification.permission !== 'granted') return Notification.permission === 'denied' ? 'blocked' : 'off'
        const reg = await navigator.serviceWorker.ready
        const key = await publicKey()
        if (!key) return 'off'
        let sub = await reg.pushManager.getSubscription()
        // Si las llaves del servidor cambiaron, la suscripción vieja ya no sirve
        const current = sub?.options?.applicationServerKey ? bytesToB64(sub.options.applicationServerKey) : null
        if (sub && current && current !== key) { await sub.unsubscribe(); sub = null }
        if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) })
        const j = sub.toJSON()
        const { error } = await supabase.rpc('push_register', {
            p_endpoint: sub.endpoint, p_p256dh: j.keys?.p256dh ?? bytesToB64(sub.getKey('p256dh')), p_auth: j.keys?.auth ?? bytesToB64(sub.getKey('auth')),
            p_kind: 'web', p_platform: currentPlatform(),
        })
        if (error) { console.warn('[push] registro', error.message); return 'off' }
        return 'on'
    } catch (e) {
        console.warn('[push] no se pudo activar', e)
        return 'off'
    }
}

/** Al cerrar sesión: este dispositivo deja de recibir los avisos de esta cuenta. */
export async function disablePush() {
    try {
        if (!pushSupported()) return
        const reg = await navigator.serviceWorker.getRegistration()
        const sub = await reg?.pushManager.getSubscription()
        if (!sub) return
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        await sub.unsubscribe()
    } catch { /* sin conexión: el servidor lo limpia cuando el envío falle */ }
}
