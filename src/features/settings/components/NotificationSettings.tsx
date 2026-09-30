import { useEffect, useState } from 'react'
import { Bell, BellOff, BellRing, Volume2, VolumeX, Loader2 } from 'lucide-react'
import { SettingsCard, SettingsActionButton } from './SettingsUI'
import { currentPlatform, getPermission, isMuted, notificationSupport, playChatSound, requestPermission, showSystemNotification, type Permission, type Platform } from '../../../lib/notify'

const PLATFORM: Record<Platform, string> = {
    'android-app': 'App de Android', 'ios-app': 'App de iPhone / iPad', 'ios-web': 'iPhone / iPad (navegador)',
    'android-web': 'Android (navegador)', 'desktop-app': 'App de escritorio (Windows)', web: 'Navegador de computadora',
}
/** Cómo desbloquear los avisos si se negaron, según dónde se usa VUNLEK. */
const UNBLOCK: Record<Platform, string> = {
    'android-app': 'Abre Ajustes del celular → Apps → VUNLEK → Notificaciones y actívalas (también "Mensajes del chat").',
    'ios-app': 'Abre Ajustes → VUNLEK → Notificaciones y activa "Permitir notificaciones" y "Sonidos".',
    'ios-web': 'Abre Ajustes → Notificaciones → VUNLEK y activa "Permitir notificaciones".',
    'android-web': 'En Chrome: menú ⋮ → Configuración → Configuración de sitios → Notificaciones → permite vunlek.com.',
    'desktop-app': 'En Windows: Configuración → Sistema → Notificaciones y activa VUNLEK.',
    web: 'Haz clic en el candado junto a la dirección (vunlek.com) → Notificaciones → Permitir, y recarga la página.',
}

/** Configuración → Avisos y sonido: estado real en este dispositivo, activar, probar y silenciar. */
export function NotificationSettings() {
    const [perm, setPerm] = useState<Permission | null>(null)
    const [muted, setMuted] = useState(isMuted())
    const [busy, setBusy] = useState(false)
    const [tested, setTested] = useState<string | null>(null)
    const platform = currentPlatform()
    const support = notificationSupport()

    useEffect(() => { getPermission().then(setPerm) }, [])

    const activate = async () => {
        setBusy(true)
        const r = await requestPermission()
        setPerm(r); setBusy(false)
        window.dispatchEvent(new Event('edu:permission-changed'))
        if (r === 'granted') test()
    }
    const test = async () => {
        await playChatSound(true)
        const ok = await showSystemNotification({ title: 'Prueba de VUNLEK', body: 'Así se verán los mensajes nuevos del chat.', url: '/messages', tag: 'vunlek-prueba' })
        setTested(ok ? '¿Escuchaste el sonido y viste el aviso? Si no, revisa el volumen y el modo "No molestar".' : 'Sonó en la app, pero el sistema no mostró el aviso: revisa los permisos.')
    }
    const toggleMute = () => {
        const v = !muted
        try { localStorage.setItem('edu_manager_mute', String(v)) } catch { /* modo privado */ }
        setMuted(v)
        window.dispatchEvent(new Event('edu:mute-changed'))
    }

    return (
        <div className="space-y-6">
            <SettingsCard icon={Bell} title="Avisos de mensajes" hint={`Este dispositivo: ${PLATFORM[platform]}. Los avisos se activan en cada celular o computadora donde uses VUNLEK.`}>
                {perm === null ? <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Revisando…</p>
                    : !support.supported || perm === 'unsupported' ? (
                        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-100 rounded-2xl p-3">{support.hint ?? 'Aquí no se pueden activar avisos.'}</p>
                    ) : perm === 'granted' ? (
                        <div className="space-y-3">
                            <p className="flex items-center gap-2 text-sm font-bold text-emerald-800"><BellRing className="w-4 h-4" /> Avisos activados en este dispositivo.</p>
                            <SettingsActionButton icon={BellRing} onClick={test}>Probar aviso y sonido</SettingsActionButton>
                        </div>
                    ) : perm === 'denied' ? (
                        <div className="space-y-2">
                            <p className="flex items-center gap-2 text-sm font-bold text-rose-800"><BellOff className="w-4 h-4" /> Los avisos están bloqueados.</p>
                            <p className="text-sm text-slate-600">{UNBLOCK[platform]}</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <p className="text-sm text-slate-600">Te avisamos cuando te escriban aunque estés en otra pantalla o con la app en segundo plano.</p>
                            <SettingsActionButton icon={busy ? Loader2 : Bell} disabled={busy} onClick={activate}>Activar avisos</SettingsActionButton>
                        </div>
                    )}
                {tested && <p className="text-sm text-slate-600">{tested}</p>}
                <p className="text-xs text-slate-500">Con la app o el navegador completamente cerrados, los avisos aún no llegan; mantenla abierta o minimizada.</p>
            </SettingsCard>
            <SettingsCard icon={muted ? VolumeX : Volume2} title="Sonido" hint="El sonido de VUNLEK suena al llegar un mensaje.">
                <div className="flex flex-wrap gap-2">
                    <SettingsActionButton icon={Volume2} onClick={() => playChatSound(true)}>Escuchar el sonido</SettingsActionButton>
                    <SettingsActionButton icon={muted ? Volume2 : VolumeX} onClick={toggleMute}>{muted ? 'Activar sonido' : 'Silenciar'}</SettingsActionButton>
                </div>
            </SettingsCard>
        </div>
    )
}
