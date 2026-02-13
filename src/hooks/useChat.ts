import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js'

export type Message = {
    id: string
    room_id: string
    sender_id: string
    content: string
    type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'REPORT' | 'STICKER' | 'SYSTEM'
    metadata: any
    created_at: string
    profiles?: {
        first_name: string
        last_name_paternal: string
        avatar_url?: string
    }
}

export type ChatRoom = {
    id: string
    name: string
    type: 'DIRECT' | 'GROUP' | 'CHANNEL' | 'SYSTEM'
    last_message?: Message
    unread_count: number
}

export const useChat = (roomId?: string) => {
    const [messages, setMessages] = useState<Message[]>([])
    const [rooms, setRooms] = useState<ChatRoom[]>([])
    const [loading, setLoading] = useState(true)

    // Sound notification
    const playNotificationSound = useCallback(() => {
        const audio = new Audio('/sounds/notification.mp3')
        audio.play().catch(e => console.log('Sound play blocked by browser:', e))
    }, [])

    // Load rooms
    const loadRooms = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                console.log('No user found, skipping room load')
                return
            }

            console.log('Loading rooms for user:', user.id)

            const { data, error } = await supabase
                .from('chat_rooms')
                .select(`
                *,
                chat_participants!inner(profile_id, profiles(id, first_name, last_name_paternal)),
                chat_messages(id, content, type, created_at, sender_id)
            `)
                .order('created_at', { foreignTable: 'chat_messages', ascending: false })
                .limit(1, { foreignTable: 'chat_messages' })

            if (error) {
                console.error('Error loading rooms:', error)
                setRooms([])
                return
            }

            console.log('Loaded rooms:', data?.length || 0)

            // Transform and set rooms
            const transformedRooms = data.map(r => {
                let roomName = r.name || 'Chat'

                // For DIRECT chats, use the other participant's name
                if (r.type === 'DIRECT' && r.chat_participants) {
                    const otherParticipant = r.chat_participants.find(
                        (p: any) => p.profile_id !== user.id
                    )
                    if (otherParticipant?.profiles) {
                        roomName = `${otherParticipant.profiles.first_name} ${otherParticipant.profiles.last_name_paternal}`
                    }
                }

                return {
                    id: r.id,
                    name: roomName,
                    type: r.type,
                    last_message: r.chat_messages?.[0],
                    unread_count: 0
                }
            })

            setRooms(transformedRooms)
        } catch (e) {
            console.error('Chat system error:', e)
            setRooms([])
        }
    }, [])

    // Load messages for current room
    const loadMessages = useCallback(async (rid: string) => {
        setLoading(true)
        const { data, error } = await supabase
            .from('chat_messages')
            .select('*, profiles(first_name, last_name_paternal)')
            .eq('room_id', rid)
            .order('created_at', { ascending: true })

        if (error) console.error('Error loading messages:', error)
        else setMessages(data || [])
        setLoading(false)
    }, [])

    // Send message
    const sendMessage = async (content: string, type: Message['type'] = 'TEXT', metadata: any = {}) => {
        if (!roomId) return
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase
            .from('chat_messages')
            .insert({
                room_id: roomId,
                sender_id: user.id,
                content,
                type,
                metadata
            })

        if (error) console.error('Error sending message:', error)
    }

    // Load rooms on mount
    useEffect(() => {
        loadRooms()
    }, [loadRooms])

    // Handle room messages and realtime subscription
    useEffect(() => {
        if (!roomId) {
            setLoading(false)
            return
        }

        loadMessages(roomId)

        const channel = supabase
            .channel(`room:${roomId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_messages',
                    filter: `room_id=eq.${roomId}`
                },
                async (payload: RealtimePostgresInsertPayload<Message>) => {
                    const { data: sender } = await supabase
                        .from('profiles')
                        .select('first_name, last_name_paternal')
                        .eq('id', payload.new.sender_id)
                        .single()

                    const newMessage = { ...payload.new, profiles: sender } as Message
                    setMessages(prev => [...prev, newMessage])

                    const { data: { user } } = await supabase.auth.getUser()
                    if (user && payload.new.sender_id !== user.id) {
                        playNotificationSound()
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [roomId, loadMessages, playNotificationSound])

    // Start or get Direct Chat
    const startDirectChat = async (targetProfileId: string) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return null

        // Get user's tenant_id
        const { data: profile } = await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('id', user.id)
            .single()

        if (!profile) return null

        // 1. Check if direct room already exists between these two users
        const { data: allDirectRooms, error: queryError } = await supabase
            .from('chat_rooms')
            .select(`
                id,
                type,
                tenant_id,
                chat_participants!inner(profile_id)
            `)
            .eq('type', 'DIRECT')
            .eq('tenant_id', profile.tenant_id)

        if (queryError) {
            console.error('Error querying rooms:', queryError)
            return null
        }

        console.log('All direct rooms:', allDirectRooms?.length || 0)

        // Check if this is a self-chat (user chatting with themselves)
        const isSelfChat = user.id === targetProfileId

        // Find room where both user and target are participants
        const existingRoom = allDirectRooms?.find(room => {
            const participantIds = room.chat_participants.map((p: any) => p.profile_id)
            const hasUser = participantIds.includes(user.id)
            const hasTarget = participantIds.includes(targetProfileId)
            console.log(`Room ${room.id}: hasUser=${hasUser}, hasTarget=${hasTarget}, participants=`, participantIds)

            // For self-chat, check if there's only 1 participant (the user)
            if (isSelfChat) {
                return participantIds.length === 1 && hasUser
            }

            // For normal chat, check for exactly 2 participants
            return hasUser && hasTarget && participantIds.length === 2
        })

        if (existingRoom) {
            console.log('✅ Found existing room:', existingRoom.id)
            return existingRoom.id
        }

        console.log('❌ No existing room found, creating new one')

        // 2. Create new room if not found
        const { data: newRoom, error: roomError } = await supabase
            .from('chat_rooms')
            .insert({
                type: 'DIRECT',
                tenant_id: profile.tenant_id
            })
            .select()
            .single()

        if (roomError) {
            console.error('Error creating room:', roomError)
            throw roomError
        }

        // 3. Add participants
        // For self-chat, only add the user once
        const participants = isSelfChat
            ? [{ room_id: newRoom.id, profile_id: user.id }]
            : [
                { room_id: newRoom.id, profile_id: user.id },
                { room_id: newRoom.id, profile_id: targetProfileId }
            ]

        const { error: participantsError } = await supabase.from('chat_participants').insert(participants)

        if (participantsError) {
            console.error('Error adding participants:', participantsError)
        }

        await loadRooms()
        return newRoom.id
    }

    // Delete Room
    const deleteRoom = async (roomIdToDelete: string) => {
        try {
            const { error } = await supabase
                .from('chat_rooms')
                .delete()
                .eq('id', roomIdToDelete)

            if (error) {
                console.error('Error deleting room:', error)
                return false
            }

            // Reload rooms after deletion
            await loadRooms()
            return true
        } catch (e) {
            console.error('Error deleting room:', e)
            return false
        }
    }

    // Create Group Chat
    const createGroupChat = async (name: string, profileIds: string[]) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return null

        const { data: newRoom, error: roomError } = await supabase
            .from('chat_rooms')
            .insert({
                name,
                type: 'GROUP',
                tenant_id: (await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()).data?.tenant_id
            })
            .select()
            .single()

        if (roomError) throw roomError

        // Add all participants including current user
        const participants = [user.id, ...profileIds].map(id => ({
            room_id: newRoom.id,
            profile_id: id
        }))

        await supabase.from('chat_participants').insert(participants)
        await loadRooms()
        return newRoom.id
    }

    return {
        messages,
        rooms,
        loading,
        sendMessage,
        startDirectChat,
        createGroupChat,
        deleteRoom
    }
}
