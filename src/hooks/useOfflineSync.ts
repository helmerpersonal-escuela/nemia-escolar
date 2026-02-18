import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

interface OfflineMutation {
    id: string
    table: string
    action: 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT'
    data: any
    timestamp: number
    filters?: Record<string, any>
}

const OFFLINE_QUEUE_KEY = 'vunlek_offline_outbox'

export const useOfflineSync = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine)
    const [pendingCount, setPendingCount] = useState(0)
    const [isSyncing, setIsSyncing] = useState(false)

    // Update online status
    useEffect(() => {
        const handleOnline = () => setIsOnline(true)
        const handleOffline = () => setIsOnline(false)

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [])

    // Load initial pending count
    useEffect(() => {
        const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]')
        setPendingCount(queue.length)
    }, [])

    const addToQueue = useCallback(async (mutation: Omit<OfflineMutation, 'id' | 'timestamp'>) => {
        const newMutation: OfflineMutation = {
            ...mutation,
            id: crypto.randomUUID(),
            timestamp: Date.now()
        }

        const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]')
        queue.push(newMutation)
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
        setPendingCount(queue.length)

        // Try to sync immediately if online
        if (navigator.onLine) {
            syncQueue()
        }
    }, [])

    const syncQueue = useCallback(async () => {
        if (isSyncing || !navigator.onLine) return

        const queue: OfflineMutation[] = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]')
        if (queue.length === 0) return

        setIsSyncing(true)
        const remainingQueue: OfflineMutation[] = []

        for (const item of queue) {
            try {
                let query: any = supabase.from(item.table)

                if (item.action === 'INSERT') {
                    const { error } = await query.insert(item.data)
                    if (error) throw error
                } else if (item.action === 'UPDATE') {
                    let updateQuery = query.update(item.data)
                    if (item.filters) {
                        Object.entries(item.filters).forEach(([key, value]) => {
                            updateQuery = updateQuery.eq(key, value)
                        })
                    }
                    const { error } = await updateQuery
                    if (error) throw error
                } else if (item.action === 'UPSERT') {
                    const { error } = await query.upsert(item.data)
                    if (error) throw error
                } else if (item.action === 'DELETE') {
                    let deleteQuery = query.delete()
                    if (item.filters) {
                        Object.entries(item.filters).forEach(([key, value]) => {
                            deleteQuery = deleteQuery.eq(key, value)
                        })
                    }
                    const { error } = await deleteQuery
                    if (error) throw error
                }
                // Success: item is processed and not added to remainingQueue
            } catch (error) {
                console.error(`Offline Sync Error (${item.table}):`, error)
                remainingQueue.push(item) // Keep in queue for next retry
            }
        }

        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remainingQueue))
        setPendingCount(remainingQueue.length)
        setIsSyncing(false)
    }, [isSyncing])

    // Auto-sync when coming back online
    useEffect(() => {
        if (isOnline) {
            syncQueue()
        }
    }, [isOnline, syncQueue])

    return {
        isOnline,
        pendingCount,
        isSyncing,
        addToQueue,
        syncQueue
    }
}
