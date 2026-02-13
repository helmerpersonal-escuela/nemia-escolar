import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export const useTenant = () => {
    return useQuery({
        queryKey: ['tenant'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return null

            // Fetch active profile to get the current tenant_id
            const { data: profile, error: pError } = await supabase
                .from('profiles')
                .select('tenant_id, role, full_name, first_name, last_name_paternal, last_name_maternal, avatar_url')
                .eq('id', user.id)
                .maybeSingle()

            if (!profile || pError) return null

            // If user is SUPER_ADMIN and has NO tenant_id, return a special system tenant
            if (profile.role === 'SUPER_ADMIN' && !profile.tenant_id) {
                return {
                    id: '00000000-0000-0000-0000-000000000000',
                    name: 'SISTEMA CONTROL (GOD MODE)',
                    educationalLevel: 'N/A',
                    type: 'SCHOOL',
                    role: 'SUPER_ADMIN',
                    fullName: profile.full_name || 'SUPER ADMIN',
                    firstName: profile.first_name,
                    lastNamePaternal: profile.last_name_paternal,
                    lastNameMaternal: profile.last_name_maternal,
                    avatarUrl: profile.avatar_url,
                    onboardingCompleted: true
                }
            }

            if (!profile.tenant_id) return null

            // Get tenant details AND the specific role for THIS workspace
            const { data: ptData, error: ptError } = await supabase
                .from('profile_tenants')
                .select(`
                    role,
                    first_name,
                    last_name_paternal,
                    last_name_maternal,
                    avatar_url,
                    tenants (*)
                `)
                .eq('profile_id', user.id)
                .eq('tenant_id', profile.tenant_id)
                .maybeSingle()

            if (!ptData || ptError) {
                // Fallback for cases where profile_tenants might not be populated yet (emergency)
                const { data: tenant } = await supabase.from('tenants').select('*').eq('id', profile.tenant_id).maybeSingle()
                if (!tenant) return null
                return {
                    id: tenant.id,
                    name: tenant.name,
                    educationalLevel: tenant.educational_level,
                    type: tenant.type as 'SCHOOL' | 'INDEPENDENT',
                    role: 'TEACHER', // Safe default
                    fullName: profile.full_name,
                    firstName: profile.first_name,
                    lastNamePaternal: profile.last_name_paternal,
                    lastNameMaternal: profile.last_name_maternal,
                    avatarUrl: profile.avatar_url,
                    cct: tenant.cct,
                    logoUrl: tenant.logo_url,
                    logoLeftUrl: tenant.logo_left_url,
                    logoRightUrl: tenant.logo_right_url,
                    onboardingCompleted: tenant.onboarding_completed
                }
            }

            const tenant = ptData.tenants as any
            let finalRole = ptData.role

            // ROBUST INDEPENDENT CHECK: 
            // If the workspace is independent, the user MUST be treated as INDEPENDENT_TEACHER
            // regardless of what the old profiles table says.
            if (tenant.type === 'INDEPENDENT') {
                finalRole = 'INDEPENDENT_TEACHER'
            }

            // Construct Name
            const fullName = ptData.first_name
                ? `${ptData.first_name} ${ptData.last_name_paternal || ''} ${ptData.last_name_maternal || ''}`.trim()
                : profile.full_name

            return {
                id: tenant.id,
                name: tenant.name,
                educationalLevel: tenant.educational_level,
                type: tenant.type as 'SCHOOL' | 'INDEPENDENT',
                role: finalRole,
                fullName: fullName.toUpperCase(),
                firstName: ptData.first_name || profile.first_name,
                lastNamePaternal: ptData.last_name_paternal || profile.last_name_paternal,
                lastNameMaternal: ptData.last_name_maternal || profile.last_name_maternal,
                avatarUrl: ptData.avatar_url || profile.avatar_url,
                cct: tenant.cct,
                logoUrl: tenant.logo_url,
                logoLeftUrl: tenant.logo_left_url,
                logoRightUrl: tenant.logo_right_url,
                onboardingCompleted: tenant.onboarding_completed,
                aiConfig: tenant.ai_config
            }
        },
        staleTime: 1000 * 60 * 5,
    })
}

export const useWorkspaces = () => {
    return useQuery({
        queryKey: ['workspaces'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return []

            const { data, error } = await supabase
                .from('profile_tenants')
                .select(`
                    tenant_id,
                    role,
                    tenants (
                        id,
                        name,
                        type
                    )
                `)
                .eq('profile_id', user.id)

            if (error) throw error

            return data.map((pt: any) => ({
                id: pt.tenants.id,
                name: pt.tenants.name,
                type: pt.tenants.type,
                role: pt.role
            }))
        }
    })
}
