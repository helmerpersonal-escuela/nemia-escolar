import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

/**
 * Avisos de VUNLEK en todas las plataformas:
 * - Web y escritorio (Chrome, Edge, Firefox, Safari, app de Windows): Notification API vía service worker.
 * - PWA instalada en Android: igual que web (Chrome en Android exige el service worker).
 * - iPhone/iPad en navegador: Apple solo permite avisos si VUNLEK está instalada en la pantalla de inicio (iOS 16.4+).
 * - App Android/iOS (Capacitor): notificaciones locales con el sonido de VUNLEK.
 */

export const CHAT_SOUND = '/sounds/vunlek-notificacion.mp3'
const ANDROID_SOUND = 'vunlek_notificacion.mp3' // android/app/src/main/res/raw
const IOS_SOUND = 'vunlek_notificacion.wav' // ios/App/App (agregado al proyecto de Xcode)
const CHANNEL = 'mensajes'
const MUTE_KEY = 'edu_manager_mute'

export type Permission = 'granted' | 'denied' | 'default' | 'unsupported'
export type Platform = 'android-app' | 'ios-app' | 'ios-web' | 'android-web' | 'desktop-app' | 'web'

const safeGet = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
export const isMuted = () => safeGet(MUTE_KEY) === 'true'

export function currentPlatform(): Platform {
    const p = Capacitor.getPlatform()
    if (p === 'android') return 'android-app'
    if (p === 'ios') return 'ios-app'
    const ua = navigator.userAgent
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios-web'
    if (/Android/.test(ua)) return 'android-web'
    if (/Electron|VUNLEK/i.test(ua) || (window as any).vunlekDesktop) return 'desktop-app'
    return 'web'
}

const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true

/** Si en esta plataforma se pueden activar avisos y, si no, qué hacer. */
export function notificationSupport(): { supported: boolean; hint?: string } {
    if (Capacitor.isNativePlatform()) return { supported: true }
    const plat = currentPlatform()
    if (plat === 'ios-web' && !isStandalone())
        return { supported: false, hint: 'En iPhone o iPad, Apple solo permite avisos si instalas VUNLEK: toca Compartir → "Agregar a pantalla de inicio" y ábrela desde el ícono.' }
    if (!('Notification' in window)) return { supported: false, hint: 'Este navegador no permite avisos. Usa Chrome, Edge, Firefox o Safari actualizados.' }
    return { supported: true }
}

export async function getPermission(): Promise<Permission> {
    try {
        if (Capacitor.isNativePlatform()) {
            const s = await LocalNotifications.checkPermissions()
            return s.display === 'granted' ? 'granted' : s.display === 'denied' ? 'denied' : 'default'
        }
        if (!notificationSupport().supported) return 'unsupported'
        return Notification.permission as Permission
    } catch { return 'unsupported' }
}

/** Crea el canal de Android con el sonido de VUNLEK (Android 8+ toma el sonido del canal). */
async function ensureAndroidChannel() {
    if (Capacitor.getPlatform() !== 'android') return
    try {
        await LocalNotifications.createChannel({
            id: CHANNEL, name: 'Mensajes del chat', description: 'Mensajes nuevos de docentes, dirección y familias',
            importance: 5, visibility: 1, sound: ANDROID_SOUND, vibration: true, lights: true, lightColor: '#42428F',
        })
    } catch { /* versiones sin canales */ }
}

export async function requestPermission(): Promise<Permission> {
    try {
        if (Capacitor.isNativePlatform()) {
            const r = await LocalNotifications.requestPermissions()
            await ensureAndroidChannel()
            return r.display === 'granted' ? 'granted' : r.display === 'denied' ? 'denied' : 'default'
        }
        if (!notificationSupport().supported) return 'unsupported'
        return (await Notification.requestPermission()) as Permission
    } catch { return 'unsupported' }
}

// ---------- Sonido ----------
let audio: HTMLAudioElement | null = null
let soundUrl = CHAT_SOUND
let unlocked = false

/** Permite cambiar el sonido desde la configuración del sistema (God Mode). */
export function setSoundUrl(url?: string | null) {
    soundUrl = url && url.startsWith('http') ? url : CHAT_SOUND
    if (audio) audio.src = soundUrl
}

function getAudio() {
    if (!audio) { audio = new Audio(soundUrl); audio.preload = 'auto' }
    return audio
}

/**
 * Los navegadores de celular (sobre todo Safari) no dejan sonar audio hasta que la persona toca la pantalla.
 * Con el primer toque se "desbloquea" el sonido para que después suene al llegar un mensaje.
 */
export function unlockAudioOnFirstGesture() {
    if (unlocked) return
    const unlock = () => {
        const a = getAudio()
        a.muted = true
        a.play().then(() => { a.pause(); a.currentTime = 0; a.muted = false; unlocked = true }).catch(() => { a.muted = false })
        window.removeEventListener('pointerdown', unlock)
        window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
}

export async function playChatSound(force = false) {
    if (!force && isMuted()) return
    try {
        const a = getAudio()
        a.muted = false
        a.currentTime = 0
        await a.play()
    } catch { /* bloqueado por el navegador hasta el primer toque */ }
}

// ---------- Aviso del sistema ----------
const idFrom = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) % 2_000_000_000 }

/**
 * Muestra un aviso del sistema. En web el sonido lo toca la página (el aviso va en silencio para no sonar dos veces);
 * en la app de celular suena el del canal/archivo de VUNLEK.
 */
export async function showSystemNotification({ title, body, url, tag }: { title: string; body: string; url: string; tag: string }) {
    if ((await getPermission()) !== 'granted') return false
    try {
        if (Capacitor.isNativePlatform()) {
            await ensureAndroidChannel()
            const ios = Capacitor.getPlatform() === 'ios'
            await LocalNotifications.schedule({ notifications: [{
                id: idFrom(tag + Date.now()), title, body, channelId: CHANNEL, group: tag,
                sound: isMuted() ? undefined : (ios ? IOS_SOUND : ANDROID_SOUND), extra: { url }, smallIcon: 'ic_stat_vunlek', iconColor: '#42428F',
            }] })
            return true
        }
        const opts: NotificationOptions & { renotify?: boolean } = { body, tag, icon: '/pwa-192.png', badge: '/pwa-192.png', data: { url }, silent: true, renotify: true }
        const desktop = (window as any).vunlekDesktop
        // La app de Windows (Electron) no muestra avisos desde el service worker: se usan directos
        const reg = !desktop && 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined
        if (reg) { await reg.showNotification(title, opts); return true }
        const n = new Notification(title, opts)
        n.onclick = () => { desktop?.focus?.(); window.focus(); window.dispatchEvent(new CustomEvent('vunlek:navigate', { detail: url })); n.close() }
        desktop?.attention?.()
        return true
    } catch (e) {
        console.warn('[avisos] no se pudo mostrar', e)
        return false
    }
}

/** Al tocar un aviso, abre la conversación. */
export function onNotificationTap(go: (url: string) => void) {
    const offs: (() => void)[] = []
    if (Capacitor.isNativePlatform()) {
        const h = LocalNotifications.addListener('localNotificationActionPerformed', e => { const u = e.notification.extra?.url; if (u) go(u) })
        offs.push(() => { h.then(x => x.remove()).catch(() => {}) })
    } else {
        const onMsg = (e: MessageEvent) => { if (e.data?.type === 'vunlek:navigate' && e.data.url) go(e.data.url) }
        navigator.serviceWorker?.addEventListener('message', onMsg)
        offs.push(() => navigator.serviceWorker?.removeEventListener('message', onMsg))
    }
    const onWin = (e: Event) => go((e as CustomEvent).detail)
    window.addEventListener('vunlek:navigate', onWin)
    offs.push(() => window.removeEventListener('vunlek:navigate', onWin))
    return () => offs.forEach(f => f())
}
