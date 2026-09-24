
import { useState, useEffect, useCallback, useRef } from 'react'
import { Bell, VolumeX, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Capacitor } from '@capacitor/core'

export const NotificationManager = () => {
    const [permission, setPermission] = useState<NotificationPermission>('default')
    const [isNative] = useState(() => Capacitor.isNativePlatform())
    const [isMuted, setIsMuted] = useState(false)
    const [isDismissed, setIsDismissed] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('edu_notifications_dismissed') === 'true'
        }
        return false
    })
    // Sonido configurable desde God Mode (system_settings.chat_sound_url); sin él, no suena.
    const [soundUrl, setSoundUrl] = useState<string>('')
    const audioRef = useRef<HTMLAudioElement | null>(null)

    useEffect(() => {
        // Check initial permission
        const checkPermission = async () => {
            if (isNative) {
                const status = await LocalNotifications.checkPermissions()
                setPermission(status.display as NotificationPermission)
            } else if ('Notification' in window) {
                setPermission(Notification.permission)
            }
        }
        checkPermission()

        // Load custom sound from system settings
        loadSystemSound()

        // Preferencia de silencio (se cambia desde el menú de notificaciones)
        const readMute = () => setIsMuted(localStorage.getItem('edu_manager_mute') === 'true')
        readMute()
        window.addEventListener('edu:mute-changed', readMute)
        return () => window.removeEventListener('edu:mute-changed', readMute)

    }, [])

    useEffect(() => {
        if (!soundUrl) return
        if (!audioRef.current) audioRef.current = new Audio()
        audioRef.current.src = soundUrl
        audioRef.current.preload = 'none'
    }, [soundUrl])

    const loadSystemSound = async () => {
        try {
            const { data, error } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'chat_sound_url')
                .maybeSingle()

            if (error) {
                console.warn('Error fetching system sound, using default.', error.message)
                return
            }

            if (data?.value && !data.value.includes('aveqziaewxcglhteufft') && data.value.startsWith('http')) {
                setSoundUrl(data.value)
            }
        } catch (error) {
            console.error('Error loading system sound:', error)
        }
    }

    const requestPermission = async () => {
        try {
            let result: NotificationPermission = 'default'

            if (isNative) {
                const request = await LocalNotifications.requestPermissions()
                result = request.display as NotificationPermission
            } else if ('Notification' in window) {
                result = await Notification.requestPermission()
            }

            setPermission(result)

            if (result === 'granted') {
                localStorage.setItem('edu_notifications_dismissed', 'true')
                setIsDismissed(true)

                if (isNative) {
                    await LocalNotifications.schedule({
                        notifications: [
                            {
                                title: 'Notificaciones Activadas',
                                body: 'Ahora recibirás alertas y sonidos del sistema.',
                                id: 1,
                                schedule: { at: new Date(Date.now() + 1000) },
                                sound: 'notification.mp3',
                                actionTypeId: '',
                                extra: null
                            }
                        ]
                    })
                } else {
                    new Notification('Notificaciones Activadas', {
                        body: 'Ahora recibirás alertas y sonidos del sistema.',
                        icon: '/pwa-192.png'
                    })
                }
                playSound()
            } else {
                // Mark as dismissed even if denied to stop showing the button
                localStorage.setItem('edu_notifications_dismissed', 'true')
                setIsDismissed(true)
            }
        } catch (error) {
            console.error('Error requesting notification permission:', error)
            // Fallback: dismiss to avoid stuck UI
            localStorage.setItem('edu_notifications_dismissed', 'true')
            setIsDismissed(true)
        }
    }

    const toggleMute = () => {
        const newMuteState = !isMuted
        setIsMuted(newMuteState)
        localStorage.setItem('edu_manager_mute', String(newMuteState))
        window.dispatchEvent(new Event('edu:mute-changed'))
    }

    const playSound = useCallback(() => {
        if (isMuted || !audioRef.current) return

        // Reset and play
        audioRef.current.currentTime = 0
        audioRef.current.play().catch(e => {
            console.warn('Audio playback blocked:', e)
        })
    }, [isMuted])

    // Subscribe to global events (conceptually, or via direct window event for now)
    useEffect(() => {
        const handlePlaySound = () => playSound()
        window.addEventListener('edu:playsound', handlePlaySound)
        return () => window.removeEventListener('edu:playsound', handlePlaySound)
    }, [playSound])

    // Subscribe to System Settings changes (Realtime)
    useEffect(() => {
        let activeChannel: any = null

        const setupSettingsSound = () => {
            const channel = supabase
                .channel('system_settings_sounds')
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'system_settings',
                        filter: 'key=eq.chat_sound_url'
                    },
                    (payload) => {
                        if (payload.new.value) {
                            setSoundUrl(payload.new.value)
                        }
                    }
                )
                .subscribe()

            activeChannel = channel
        }

        setupSettingsSound()

        return () => {
            if (activeChannel) {
                // Supabase removeChannel is async but we don't need to await in cleanup 
                // and we want to avoid "closed before connection established" errors being loud
                supabase.removeChannel(activeChannel).catch(() => { })
            }
        }

    }, [])


    const dismiss = () => {
        localStorage.setItem('edu_notifications_dismissed', 'true')
        setIsDismissed(true)
    }

    const showPrompt = permission !== 'granted' && permission !== 'denied' && !isDismissed

    if (!showPrompt && !isMuted) return null

    // Aviso discreto: arriba de la barra inferior en celular, sin animación infinita
    // y con opción de cerrarlo (antes rebotaba y tapaba contenido en todas las pantallas).
    return (
        <div className="fixed z-40 right-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-6 lg:right-6 flex flex-col items-end gap-2">
            {showPrompt && (
                <div role="dialog" aria-label="Activar avisos" className="flex items-center gap-1 bg-white border border-indigo-100 rounded-2xl shadow-lg p-1.5 pl-3 max-w-[calc(100vw-1.5rem)]">
                    <Bell className="w-4 h-4 text-indigo-600 shrink-0" aria-hidden="true" />
                    <button
                        type="button"
                        onClick={requestPermission}
                        className="min-h-11 px-2 text-sm font-bold text-indigo-700 hover:underline"
                    >
                        Activar avisos
                    </button>
                    <button
                        type="button"
                        onClick={dismiss}
                        aria-label="Ahora no"
                        className="min-h-11 min-w-11 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {isMuted && (
                <button
                    type="button"
                    onClick={toggleMute}
                    aria-label="Sonido silenciado: activar sonido"
                    title="Activar sonido"
                    className="min-h-11 min-w-11 flex items-center justify-center rounded-full shadow-lg bg-rose-600 text-white"
                >
                    <VolumeX className="w-5 h-5" />
                </button>
            )}
        </div>
    )
}
