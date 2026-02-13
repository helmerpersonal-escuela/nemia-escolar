
import { useState, useEffect, useCallback, useRef } from 'react'
import { Bell, BellOff, Volume2, VolumeX } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export const NotificationManager = () => {
    const [permission, setPermission] = useState<NotificationPermission>(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            return Notification.permission
        }
        return 'default'
    })
    const [isMuted, setIsMuted] = useState(false)
    const [soundUrl, setSoundUrl] = useState<string>('/sounds/notification.mp3') // Default
    const audioRef = useRef<HTMLAudioElement | null>(null)

    useEffect(() => {
        // Check initial permission
        if ('Notification' in window) {
            setPermission(Notification.permission)
        }

        // Load custom sound from system settings
        loadSystemSound()

        // Load mute preference
        const savedMute = localStorage.getItem('edu_manager_mute')
        if (savedMute) setIsMuted(savedMute === 'true')

        // Initialize Audio
        audioRef.current = new Audio(soundUrl)
    }, [])

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.src = soundUrl
            audioRef.current.load()
        }
    }, [soundUrl])

    const loadSystemSound = async () => {
        try {
            const { data } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'chat_sound_url')
                .single()

            if (data?.value) {
                setSoundUrl(data.value)
            }
        } catch (error) {
            console.error('Error loading system sound:', error)
        }
    }

    const requestPermission = async () => {
        if (!('Notification' in window)) return

        const result = await Notification.requestPermission()
        setPermission(result)

        if (result === 'granted') {
            new Notification('Notificaciones Activadas', {
                body: 'Ahora recibirás alertas y sonidos del sistema.',
                icon: '/pwa-192x192.png'
            })
            playSound()
        }
    }

    const toggleMute = () => {
        const newMuteState = !isMuted
        setIsMuted(newMuteState)
        localStorage.setItem('edu_manager_mute', String(newMuteState))
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
                        // Optional: Play new sound to confirm
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])


    if (permission === 'granted' && !isMuted) return null // Invisible if all good (or maybe show small indicator)

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
            {permission !== 'granted' && permission !== 'denied' && (
                <button
                    onClick={requestPermission}
                    className="bg-indigo-600 text-white px-4 py-3 rounded-full shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-3 animate-bounce"
                >
                    <Bell className="w-5 h-5" />
                    <span className="text-xs font-bold">Activar Notificaciones</span>
                </button>
            )}

            {/* Volume Control / Mute Indicator */}
            <button
                onClick={toggleMute}
                className={`p-3 rounded-full shadow-lg transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-white text-gray-700'}`}
                title={isMuted ? "Activar Sonido" : "Silenciar"}
            >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
        </div>
    )
}
