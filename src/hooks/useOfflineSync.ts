import { useEffect, useState, useCallback } from 'react'
import { enqueue, flush, getState, startOutbox, subscribe, type OutboxState } from '../lib/offline/outbox'

type LegacyMutation = {
    table: string
    action: 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT'
    data: Record<string, unknown>
    filters?: Record<string, unknown>
}

const CONFLICT_KEYS: Record<string, string> = {
    attendance: 'student_id,date,group_id,subject_id',
    grades: 'assignment_id,student_id',
}

/**
 * Estado de la sincronización sin conexión (una sola bandeja para toda la app).
 * Mantiene la misma API que la versión anterior (isOnline, pendingCount, isSyncing,
 * addToQueue, syncQueue) y agrega failedCount / lastSyncAt.
 */
export const useOfflineSync = () => {
    const [state, setState] = useState<OutboxState>(getState())

    useEffect(() => {
        startOutbox()
        return subscribe(setState)
    }, [])

    const addToQueue = useCallback(async (m: LegacyMutation) => {
        if (m.action === 'UPSERT') {
            await enqueue({ table: m.table, op: 'upsert', rows: [m.data], onConflict: CONFLICT_KEYS[m.table] ?? 'id' })
        } else if (m.action === 'INSERT') {
            await enqueue({ table: m.table, op: 'insert', rows: [m.data] })
        } else if (m.action === 'UPDATE') {
            await enqueue({ table: m.table, op: 'update', values: m.data, match: m.filters ?? {} })
        } else {
            await enqueue({ table: m.table, op: 'delete', match: m.filters ?? {} })
        }
    }, [])

    return {
        isOnline: state.online,
        pendingCount: state.pending,
        failedCount: state.failed,
        isSyncing: state.syncing,
        lastSyncAt: state.lastSyncAt,
        addToQueue,
        syncQueue: flush,
    }
}
