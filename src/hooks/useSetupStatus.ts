import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useTenant } from './useTenant'
import type { SetupStatus } from '../lib/prerequisites'

/** Conteos mínimos para saber qué pasos de arranque están completos (se vuelve a leer al entrar a cada pantalla). */
export function useSetupStatus() {
    const { data: tenant } = useTenant()
    const t = (tenant as any)?.id as string | undefined
    const workspace = ((tenant as any)?.type || 'SCHOOL') === 'INDEPENDENT' ? 'INDEPENDENT' : 'SCHOOL'
    const role = String((tenant as any)?.role || '').toUpperCase()
    return useQuery({
        queryKey: ['setup-status', t, role],
        enabled: !!t,
        staleTime: 0,
        refetchOnMount: 'always',
        queryFn: async (): Promise<SetupStatus> => {
            const head = { count: 'exact' as const, head: true }
            const { data: { user } } = await supabase.auth.getUser()
            const [year, periods, sched, staff, groups, gs, mine, students, guardians] = await Promise.all([
                supabase.from('academic_years').select('id', head).eq('tenant_id', t!).eq('is_active', true),
                supabase.from('evaluation_periods').select('id', head).eq('tenant_id', t!),
                supabase.from('schedule_settings').select('tenant_id').eq('tenant_id', t!).maybeSingle(),
                workspace === 'SCHOOL' ? supabase.rpc('school_staff') : Promise.resolve({ data: [] as any[] }),
                supabase.from('groups').select('id', head).eq('tenant_id', t!).is('archived_at', null),
                supabase.from('group_subjects').select('id', head).eq('tenant_id', t!),
                user ? supabase.from('group_subjects').select('id', head).eq('tenant_id', t!).eq('teacher_id', user.id) : Promise.resolve({ count: 0 }),
                supabase.from('students').select('id', head).eq('tenant_id', t!),
                supabase.from('guardians').select('id', head).eq('tenant_id', t!),
            ])
            const n = (r: any) => r?.count ?? 0
            return {
                workspace, role,
                activeYear: n(year) > 0,
                periods: n(periods),
                hasSchedule: !!(sched as any).data,
                teachers: (((staff as any).data as any[]) || []).filter(s => ['TEACHER', 'INDEPENDENT_TEACHER'].includes(String(s.role).toUpperCase())).length,
                groups: n(groups),
                groupSubjects: n(gs),
                myAssignments: n(mine),
                students: n(students),
                guardians: n(guardians),
            }
        },
    })
}
