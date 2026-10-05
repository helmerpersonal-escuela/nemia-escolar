import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toast'
import { onNotificationTap, playChatSound, showSystemNotification, unlockAudioOnFirstGesture } from '../lib/notify'

type Unread = { room_id: string; sender_label: string | null; preview: string | null; unread: number }

/**
 * Escucha los mensajes nuevos del chat en toda la app (no solo con la conversación abierta):
 * - si la persona está viendo esa conversación: solo suena;
 * - si está en otra pantalla: suena y aparece un aviso dentro de la app;
 * - si la app está en segundo plano o minimizada: suena y aparece el aviso del sistema.
 */
export function useChatNotifications(enabled: boolean) {
    const location = useLocation()
    const navigate = useNavigate()
    const { showToast } = useToast()
    const path = useRef(location.pathname)
    path.current = location.pathname

    useEffect(() => { unlockAudioOnFirstGesture() }, [])
    useEffect(() => onNotificationTap(url => navigate(url)), [navigate])

    // Avisos del servidor que llegan con VUNLEK abierta y a la vista (reportes, citatorios, alertas):
    // el service worker los pasa a la página para mostrarlos aquí. Los de chat ya los maneja el aviso de abajo.
    useEffect(() => {
        const onMsg = (e: MessageEvent) => {
            const d = e.data
            if (d?.type !== 'vunlek:push' || String(d.tag ?? '').startsWith('chat-')) return
            playChatSound()
            showToast(`${d.title ?? 'VUNLEK'}: ${d.body ?? ''}`, 'info')
            window.dispatchEvent(new Event('edu:chat-message'))
        }
        navigator.serviceWorker?.addEventListener('message', onMsg)
        return () => navigator.serviceWorker?.removeEventListener('message', onMsg)
    }, [showToast])

    useEffect(() => {
        if (!enabled) return
        let channel: ReturnType<typeof supabase.channel> | null = null
        let alive = true
        // Se usa la cuenta con la que se inició sesión (los mensajes que ve por sus permisos)
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!alive || !user) return
            const userId = user.id
            channel = supabase
            .channel(`avisos-chat-${userId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, async (payload: any) => {
                const m = payload.new as { room_id: string; sender_id: string | null }
                if (!m?.room_id || m.sender_id === userId) return
                const url = `/messages/${m.room_id}`
                const visible = document.visibilityState === 'visible'
                playChatSound()
                if (visible && path.current === url) return
                // Quién escribe ("Mamá de …", "Profra. …") y una vista previa, con la función que ya usa la campana
                const { data } = await supabase.rpc('my_unread_chats')
                const row = ((data as Unread[]) ?? []).find(r => r.room_id === m.room_id)
                const title = row?.sender_label ? `Mensaje de ${row.sender_label}` : 'Mensaje nuevo en VUNLEK'
                const body = row ? (row.unread > 1 ? `${row.unread} mensajes sin leer · ${row.preview ?? ''}` : (row.preview || 'Mensaje nuevo')) : 'Toca para verlo'
                window.dispatchEvent(new Event('edu:chat-message'))
                if (visible) showToast(`${title}: ${body}`, 'info')
                else showSystemNotification({ title, body, url, tag: `chat-${m.room_id}` })
            })
            .subscribe()
        })
        return () => { alive = false; if (channel) supabase.removeChannel(channel).catch(() => {}) }
    }, [enabled, showToast])
}
