import { useState, useEffect } from 'react'
import { Bell, VolumeX, X, Smartphone } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getPermission, isMuted as readMuted, notificationSupport, playChatSound, requestPermission, setSoundUrl, showSystemNotification, type Permission } from '../../lib/notify'

const DISMISS_KEY = 'edu_notifications_dismissed'
const safeGet = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const safeSet = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* modo privado */ } }

/** Invitación discreta a activar avisos + botón para quitar el silencio. El sonido es el de VUNLEK. */
export const NotificationManager = () => {
    const [permission, setPermission] = useState<Permission>('default')
    const [isMuted, setIsMuted] = useState(readMuted())
    const [isDismissed, setIsDismissed] = useState(() => safeGet(DISMISS_KEY) === 'true')
    const support = notificationSupport()

    useEffect(() => {
        getPermission().then(setPermission)
        // Sonido personalizado desde God Mode (system_settings.chat_sound_url); si no hay, el de VUNLEK
        supabase.from('system_settings').select('value').eq('key', 'chat_sound_url').maybeSingle()
            .then(({ data }) => { if (data?.value && !String(data.value).includes('aveqziaewxcglhteufft')) setSoundUrl(String(data.value)) }, () => {})
        const readMute = () => setIsMuted(readMuted())
        const onSound = () => playChatSound()
        const onPerm = () => getPermission().then(setPermission)
        window.addEventListener('edu:mute-changed', readMute)
        window.addEventListener('edu:playsound', onSound)
        window.addEventListener('edu:permission-changed', onPerm)
        return () => {
            window.removeEventListener('edu:mute-changed', readMute)
            window.removeEventListener('edu:playsound', onSound)
            window.removeEventListener('edu:permission-changed', onPerm)
        }
    }, [])

    const activate = async () => {
        const result = await requestPermission()
        setPermission(result)
        safeSet(DISMISS_KEY, 'true')
        setIsDismissed(true)
        if (result === 'granted') {
            playChatSound(true)
            showSystemNotification({ title: 'Avisos activados', body: 'Te avisaremos con este sonido cuando llegue un mensaje.', url: '/messages', tag: 'vunlek-prueba' })
        }
    }

    const unmute = () => {
        safeSet('edu_manager_mute', 'false')
        setIsMuted(false)
        window.dispatchEvent(new Event('edu:mute-changed'))
    }

    const dismiss = () => { safeSet(DISMISS_KEY, 'true'); setIsDismissed(true) }

    const showPrompt = !isDismissed && permission === 'default' && support.supported
    const showHint = !isDismissed && !support.supported && !!support.hint
    if (!showPrompt && !showHint && !isMuted) return null

    return (
        <div className="fixed z-40 right-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-6 lg:right-6 flex flex-col items-end gap-2">
            {showPrompt && (
                <div role="dialog" aria-label="Activar avisos" className="flex items-center gap-1 bg-white border border-indigo-100 rounded-2xl shadow-lg p-1.5 pl-3 max-w-[calc(100vw-1.5rem)]">
                    <Bell className="w-4 h-4 text-indigo-600 shrink-0" aria-hidden="true" />
                    <button type="button" onClick={activate} className="min-h-11 px-2 text-sm font-bold text-indigo-700 hover:underline">Activar avisos de mensajes</button>
                    <button type="button" onClick={dismiss} aria-label="Ahora no" className="min-h-11 min-w-11 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"><X className="w-4 h-4" /></button>
                </div>
            )}
            {showHint && (
                <div role="dialog" aria-label="Avisos en iPhone" className="flex items-start gap-2 bg-white border border-indigo-100 rounded-2xl shadow-lg p-3 max-w-[min(22rem,calc(100vw-1.5rem))]">
                    <Smartphone className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <p className="text-xs text-slate-700">{support.hint}</p>
                    <button type="button" onClick={dismiss} aria-label="Cerrar" className="min-h-9 min-w-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"><X className="w-4 h-4" /></button>
                </div>
            )}
            {isMuted && (
                <button type="button" onClick={unmute} aria-label="Sonido silenciado: activar sonido" title="Activar sonido"
                    className="min-h-11 min-w-11 flex items-center justify-center rounded-full shadow-lg bg-rose-600 text-white">
                    <VolumeX className="w-5 h-5" />
                </button>
            )}
        </div>
    )
}
