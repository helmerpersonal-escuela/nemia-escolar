import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type UserPresence = {
    user_id: string
    online_at: string
}

export const usePresence = () => {
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
    const [channel, setChannel] = useState<RealtimeChannel | null>(null)

    useEffect(() => {
        let isMounted = true
        let activeChannel: RealtimeChannel | null = null;

        const setupPresence = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user || !isMounted) return

            // Create a presence channel
            const presenceChannel = supabase.channel('online-users', {
                config: {
                    presence: {
                        key: user.id,
                    },
                },
            })

            // Subscribe to presence events
            presenceChannel
                .on('presence', { event: 'sync' }, () => {
                    if (!isMounted) return
                    const state = presenceChannel.presenceState()
                    const users = new Set<string>()

                    Object.keys(state).forEach((key) => {
                        users.add(key)
                    })

                    setOnlineUsers(users)
                })
                .on('presence', { event: 'join' }, ({ key }) => {
                    if (!isMounted) return
                    setOnlineUsers(prev => new Set(prev).add(key))
                })
                .on('presence', { event: 'leave' }, ({ key }) => {
                    if (!isMounted) return
                    setOnlineUsers(prev => {
                        const next = new Set(prev)
                        next.delete(key)
                        return next
                    })
                })
                .subscribe(async (status) => {
                    if (status === 'SUBSCRIBED') {
                        if (!isMounted) return
                        // Track this user as online
                        await presenceChannel.track({
                            user_id: user.id,
                            online_at: new Date().toISOString(),
                        })
                    }
                })

            activeChannel = presenceChannel
            setChannel(presenceChannel)
        }

        setupPresence()

        return () => {
            isMounted = false
            if (activeChannel) {
                activeChannel.unsubscribe()
            }
        }
    }, [])

    const isUserOnline = (userId: string) => onlineUsers.has(userId)

    return { onlineUsers, isUserOnline }
}
