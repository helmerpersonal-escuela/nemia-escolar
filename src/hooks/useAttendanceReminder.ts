import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useTenant } from './useTenant'
import { useProfile } from './useProfile'

export const useAttendanceReminder = () => {
    const { data: tenant } = useTenant()
    const { profile } = useProfile()

    useEffect(() => {
        // Skip if basic data missing OR if Onboarding is not completed
        if (!tenant || !profile || tenant.onboardingCompleted === false) return

        // Skip for TUTOR and STUDENT roles - they don't need attendance tracking
        const skipRoles = ['TUTOR', 'STUDENT', 'SUPER_ADMIN']
        if (skipRoles.includes(profile.role || '') || skipRoles.includes((tenant as any)?.role || '')) return

        const checkAttendance = async () => {
            const now = new Date()

            // 1. Get Work Start Time (Default 07:00)
            const workStart = profile.work_start_time || '07:00:00'
            const [h, m] = workStart.split(':').map(Number)
            const startTime = new Date()
            startTime.setHours(h, m, 0, 0)

            // 2. Add 15 minutes tolerance
            const limitTime = new Date(startTime.getTime() + 15 * 60000)

            // If current time is before limit, do nothing yet
            if (now < limitTime) return

            // 3. Check if already checked/notified today
            const today = now.toISOString().split('T')[0]
            const storageKey = `attendance_reminder_${profile.id}_${today}`
            if (localStorage.getItem(storageKey)) return

            // 4. Check if Attendance exists
            const { data: attendance } = await supabase
                .from('staff_attendance')
                .select('id')
                .eq('profile_id', profile.id)
                .eq('date', today)
                .maybeSingle()

            if (attendance) {
                // User checked in, mark as done to avoid re-checking
                localStorage.setItem(storageKey, 'done')
                return
            }

            // 5. NO CHECK-IN DETECTED -> NOTIFY

            // FIND OR CREATE SYSTEM ROOM SECURELY via RPC
            const { data: roomId, error: rpcError } = await supabase
                .rpc('get_or_create_system_room', {
                    p_tenant_id: tenant.id,
                    p_user_id: profile.id
                })

            if (rpcError) {
                // If it's a conflict or other system error, we don't want to spam the console
                if (rpcError.message?.includes('already exists') || rpcError.code === '42P05') {
                    return
                }
                console.warn('Attendance Reminder: Could not get system room', rpcError.message)
                return
            }

            if (roomId) {
                console.log('Attendance Reminder: Sending message to room', roomId)
                // Send System Message via RPC
                const { error: sendError } = await supabase.rpc('send_system_message', {
                    p_room_id: roomId,
                    p_content: `⚠️ **Recordatorio de Asistencia**: Hola ${profile.first_name}, hemos detectado que son las ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} y aún no has registrado tu entrada. Por favor, registra tu asistencia para evitar retardos.`,
                    p_metadata: {} // Explicitly pass empty metadata to avoid 400 errors in some client versions
                })

                if (sendError) {
                    console.warn('Attendance Reminder: Error sending message, will not retry today:', sendError)
                    // Mark as attempted to avoid infinite retries
                    localStorage.setItem(storageKey, 'error')
                } else {
                    // Mark as sent
                    localStorage.setItem(storageKey, 'sent')
                }
            }

        }

        // Run check immediately and then every minute
        checkAttendance()
        const timer = setInterval(checkAttendance, 60000)

        return () => clearInterval(timer)
    }, [tenant?.id, profile?.id, profile?.work_start_time])
}
