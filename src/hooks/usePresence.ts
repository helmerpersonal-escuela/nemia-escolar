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
        const setupPresence = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

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
                    const state = presenceChannel.presenceState()
                    const users = new Set<string>()

                    Object.keys(state).forEach((key) => {
                        users.add(key)
                    })

                    setOnlineUsers(users)
                })
                .on('presence', { event: 'join' }, ({ key }) => {
                    setOnlineUsers(prev => new Set(prev).add(key))
                })
                .on('presence', { event: 'leave' }, ({ key }) => {
                    setOnlineUsers(prev => {
                        const next = new Set(prev)
                        next.delete(key)
                        return next
                    })
                })
                .subscribe(async (status) => {
                    if (status === 'SUBSCRIBED') {
                        // Track this user as online
                        await presenceChannel.track({
                            user_id: user.id,
                            online_at: new Date().toISOString(),
                        })
                    }
                })

            setChannel(presenceChannel)
        }

        setupPresence()

        return () => {
            if (channel) {
                channel.unsubscribe()
            }
        }
    }, [])

    const isUserOnline = (userId: string) => onlineUsers.has(userId)

    return { onlineUsers, isUserOnline }
}
