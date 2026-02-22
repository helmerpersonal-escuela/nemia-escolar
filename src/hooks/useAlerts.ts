import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { checkAssignmentCompliance } from '../utils/ComplianceChecker'

export const useAlerts = (tutorId?: string, children?: any[]) => {
    const [alerts, setAlerts] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)

    const fetchAlerts = useCallback(async () => {
        if (!tutorId) return
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('student_alerts')
                .select('*')
                .eq('tutor_id', tutorId)
                .order('created_at', { ascending: false })
                .limit(20)

            if (error) throw error
            setAlerts(data || [])
            setUnreadCount(data?.filter(a => !a.read_at).length || 0)
        } catch (error) {
            console.error('Error fetching alerts:', error)
        } finally {
            setLoading(false)
        }
    }, [tutorId])

    const runComplianceChecks = useCallback(async (tenantId: string) => {
        if (!tutorId || !children || children.length === 0 || !tenantId) return

        // Run compliance check for each child
        for (const child of children) {
            await checkAssignmentCompliance(child.id, tenantId, tutorId)
        }

        // Refresh alerts after check
        fetchAlerts()
    }, [tutorId, children, fetchAlerts])

    const markAsRead = async (alertId: string) => {
        try {
            const { error } = await supabase
                .from('student_alerts')
                .update({ read_at: new Date().toISOString() })
                .eq('id', alertId)

            if (error) throw error
            setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, read_at: new Date().toISOString() } : a))
            setUnreadCount(prev => Math.max(0, prev - 1))
        } catch (error) {
            console.error('Error marking alert as read:', error)
        }
    }

    useEffect(() => {
        if (tutorId) {
            fetchAlerts()
        }
    }, [tutorId, fetchAlerts])

    return { alerts, loading, unreadCount, markAsRead, runComplianceChecks, refreshAlerts: fetchAlerts }
}
