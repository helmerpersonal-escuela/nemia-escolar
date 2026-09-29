import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { isoDate } from '../../../lib/specialDays'

const PRESENT = new Set(['PRESENT', 'LATE', 'PRESENTE', 'RETARDO'])

export interface SchoolOverview {
    students: number
    staff: number
    teachers: number
    groups: number
    subjectsWithoutTeacher: number
    today: { recorded: number; present: number; groupsTaken: number }
    last30: { recorded: number; present: number }
    lowAttendance: { group: string; pct: number }[]
    plansThisMonth: number
    incidents30: number
    bapStudents: number
    staffCheckedInToday: number
    hasSchedule: boolean
    hasPeriods: boolean
    announcements: { id: string; title: string; created_at: string }[]
}

export const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null)

/** Números reales de la escuela para los tableros (nada inventado: si no hay datos, se dice). */
export function useSchoolOverview() {
    const { data: tenant } = useTenant()
    const tenantId = tenant?.id
    return useQuery({
        queryKey: ['school-overview', tenantId],
        enabled: !!tenantId,
        staleTime: 60_000,
        queryFn: async (): Promise<SchoolOverview> => {
            const t = tenantId!
            const today = isoDate(new Date())
            const d30 = new Date(); d30.setDate(d30.getDate() - 30)
            const monthStart = new Date(); monthStart.setDate(1)
            const count = (r: { count: number | null }) => r.count ?? 0

            const [students, staff, groups, gsNoTeacher, attToday, att30, plans, incidents, bap, staffAtt, sched, periods, ann] = await Promise.all([
                supabase.from('students').select('id', { count: 'exact', head: true }).eq('tenant_id', t).or('status.is.null,status.not.in.(GRADUATED,INACTIVE)'),
                supabase.rpc('school_staff'),
                supabase.from('groups').select('id, grade, section').eq('tenant_id', t).is('archived_at', null),
                supabase.from('group_subjects').select('id', { count: 'exact', head: true }).eq('tenant_id', t).is('teacher_id', null),
                supabase.from('attendance').select('group_id, status').eq('tenant_id', t).eq('date', today),
                supabase.from('attendance').select('group_id, status').eq('tenant_id', t).gte('date', isoDate(d30)).limit(20000),
                supabase.from('lesson_plans').select('id', { count: 'exact', head: true }).eq('tenant_id', t).gte('created_at', monthStart.toISOString()),
                supabase.from('student_incidents').select('id', { count: 'exact', head: true }).eq('tenant_id', t).gte('created_at', d30.toISOString()),
                supabase.from('student_bap_records').select('student_id').eq('tenant_id', t),
                supabase.from('staff_attendance').select('id', { count: 'exact', head: true }).eq('tenant_id', t).eq('date', today),
                supabase.from('schedule_settings').select('tenant_id').eq('tenant_id', t).maybeSingle(),
                supabase.from('evaluation_periods').select('id', { count: 'exact', head: true }).eq('tenant_id', t),
                supabase.from('school_announcements').select('id, title, created_at').eq('tenant_id', t).order('created_at', { ascending: false }).limit(3),
            ])

            const staffRows = ((staff.data as any[]) || [])
            const groupRows = (groups.data as any[]) || []
            const groupName = new Map(groupRows.map(g => [g.id, `${g.grade}° ${g.section}`]))
            const todayRows = (attToday.data as any[]) || []
            const rows30 = (att30.data as any[]) || []

            const byGroup = new Map<string, { p: number; n: number }>()
            for (const r of rows30) {
                const g = byGroup.get(r.group_id) ?? { p: 0, n: 0 }
                g.n++; if (PRESENT.has(String(r.status).toUpperCase())) g.p++
                byGroup.set(r.group_id, g)
            }
            const lowAttendance = [...byGroup.entries()]
                .filter(([id, v]) => v.n >= 20 && groupName.has(id) && v.p / v.n < 0.8)
                .map(([id, v]) => ({ group: groupName.get(id)!, pct: Math.round((v.p / v.n) * 100) }))
                .sort((a, b) => a.pct - b.pct)

            return {
                students: count(students as any),
                staff: staffRows.length,
                teachers: staffRows.filter(s => String(s.role).toUpperCase() === 'TEACHER').length,
                groups: groupRows.length,
                subjectsWithoutTeacher: count(gsNoTeacher as any),
                today: {
                    recorded: todayRows.length,
                    present: todayRows.filter(r => PRESENT.has(String(r.status).toUpperCase())).length,
                    groupsTaken: new Set(todayRows.map(r => r.group_id)).size,
                },
                last30: { recorded: rows30.length, present: rows30.filter(r => PRESENT.has(String(r.status).toUpperCase())).length },
                lowAttendance,
                plansThisMonth: count(plans as any),
                incidents30: count(incidents as any),
                bapStudents: new Set(((bap.data as any[]) || []).map(r => r.student_id)).size,
                staffCheckedInToday: count(staffAtt as any),
                hasSchedule: !!sched.data,
                hasPeriods: count(periods as any) > 0,
                announcements: (ann.data as any[]) || [],
            }
        },
    })
}
