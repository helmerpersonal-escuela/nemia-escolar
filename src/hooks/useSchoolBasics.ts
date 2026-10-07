import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useTenant } from './useTenant'
import { useProfile } from './useProfile'

export interface BasicGroup { id: string; grade: string; section: string }
export interface BasicStudent { id: string; first_name: string; last_name_paternal: string | null; last_name_maternal: string | null; group_id: string | null; status: string | null }
export interface BasicStaff { id: string; name: string; roles: string[] }

export const LEAD_ROLES = ['DIRECTOR', 'ADMIN', 'ACADEMIC_COORD', 'TECH_COORD', 'SUPER_ADMIN']
export const groupName = (g?: { grade: string; section: string } | null) => g ? `${g.grade}° ${g.section}` : 'Sin grupo'
export const studentName = (s?: Pick<BasicStudent, 'first_name' | 'last_name_paternal' | 'last_name_maternal'> | null) =>
    s ? [s.last_name_paternal, s.last_name_maternal, s.first_name].filter(Boolean).join(' ') : 'Alumno'

/** Grupos, alumnos, personal y ciclo escolar de la escuela: lo que casi toda pantalla directiva necesita. */
export function useSchoolBasics() {
    const { data: tenant } = useTenant()
    const { profile } = useProfile()
    const tenantId = (tenant as { id?: string } | null | undefined)?.id
    const query = useQuery({
        queryKey: ['school-basics', tenantId],
        enabled: !!tenantId,
        staleTime: 60_000,
        queryFn: async () => {
            const [groups, year, staff] = await Promise.all([
                supabase.from('groups').select('id, grade, section').eq('tenant_id', tenantId!).is('archived_at', null).order('grade').order('section'),
                supabase.from('academic_years').select('name').eq('tenant_id', tenantId!).eq('is_active', true).maybeSingle(),
                supabase.rpc('school_staff'),
            ])
            const students: BasicStudent[] = []
            for (let from = 0; from < 10_000; from += 1000) {
                const { data: page, error } = await supabase.from('students').select('id, first_name, last_name_paternal, last_name_maternal, group_id, status')
                    .eq('tenant_id', tenantId!).order('last_name_paternal').order('first_name').range(from, from + 999)
                if (error) throw error
                students.push(...((page ?? []) as BasicStudent[]))
                if (!page || page.length < 1000) break
            }
            const people: Record<string, BasicStaff> = {}
            for (const s of (staff.data ?? []) as { profile_id: string; first_name: string | null; last_name_paternal: string | null; last_name_maternal: string | null; email: string | null; role: string }[]) {
                const p = people[s.profile_id] ?? { id: s.profile_id, name: [s.first_name, s.last_name_paternal, s.last_name_maternal].filter(Boolean).join(' ') || s.email || 'Sin nombre', roles: [] }
                if (!p.roles.includes(s.role)) p.roles.push(s.role)
                people[s.profile_id] = p
            }
            return {
                groups: (groups.data ?? []) as BasicGroup[],
                students,
                staff: Object.values(people).sort((a, b) => a.name.localeCompare(b.name, 'es')),
                schoolYear: (year.data?.name as string | undefined) ?? String(new Date().getFullYear()),
            }
        },
    })
    const role = String(profile?.role ?? '').toUpperCase()
    const myName = [profile?.first_name, profile?.last_name_paternal, profile?.last_name_maternal].filter(Boolean).join(' ') || profile?.full_name || ''
    return {
        ...query, tenantId, role, myName, myId: profile?.id as string | undefined,
        isLead: LEAD_ROLES.includes(role) || !!profile?.isSuperAdmin,
        schoolName: String((tenant as { name?: string } | null | undefined)?.name ?? 'Escuela'),
    }
}
