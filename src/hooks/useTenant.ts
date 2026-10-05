import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export const useTenant = () => {
    const query = useQuery({
        queryKey: ['tenant'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return null

            // Check for impersonation
            const impersonateId = sessionStorage.getItem('vunlek_impersonate_id')
            let targetUserId = user.id

            if (impersonateId) {
                targetUserId = impersonateId
            }

            // Fetch active profile to get the current tenant_id
            const { data: profile, error: pError } = await supabase
                .from('profiles')
                .select('tenant_id, role, full_name, first_name, last_name_paternal, last_name_maternal, avatar_url')
                .eq('id', targetUserId)
                .maybeSingle()


            if (!profile || pError) return null

            // If user is SUPER_ADMIN and has NO tenant_id, return a special system tenant
            if (profile.role === 'SUPER_ADMIN' && user.email === 'helmerpersonal@gmail.com' && !profile.tenant_id) {

                const { data: systemSettings } = await supabase.from('system_settings').select('key, value')
                const settings: any = {}
                systemSettings?.forEach(s => settings[s.key] = s.value)

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
                    onboardingCompleted: true,
                    aiConfig: {
                        apiKey: settings.groq_key || '',
                        groqKey: settings.groq_key || '',
                        geminiKey: settings.gemini_key || '',
                        openaiKey: settings.openai_key || ''
                    },
                    groqApiKey: settings.groq_key || ''
                }
            }

            // GET SYSTEM SETTINGS as fallback for all users
            const { data: systemSettings } = await supabase.from('system_settings').select('key, value')
            const globalSettings: any = {}
            systemSettings?.forEach(s => globalSettings[s.key] = s.value)

            // SPECIFIC USER OVERRIDE REMOVED

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
                .eq('profile_id', targetUserId)
                .eq('tenant_id', profile.tenant_id)
            // Una persona puede tener varios puestos en la misma escuela (p. ej. control escolar y técnico):
            // se usa el puesto activo (profiles.role); si no coincide, el primero.
            .then(r => ({ error: r.error, data: (r.data ?? []).find((x: any) => String(x.role).toUpperCase() === String(profile.role).toUpperCase()) ?? (r.data ?? [])[0] ?? null }))


            if (!ptData || ptError) {
                // Fallback for cases where profile_tenants might not be populated yet (emergency)
                const { data: tenant } = await supabase.from('tenants').select('*').eq('id', profile.tenant_id).maybeSingle()
                if (!tenant) return null

                // Use the profile's actual role if it's a special role (TUTOR, ADMIN, etc.)
                // Only default to TEACHER/INDEPENDENT_TEACHER for school/independent workspaces
                // DEFAULT INDEPENDENT OVERRIDE: 
                // Any non-special role in an INDEPENDENT workspace becomes INDEPENDENT_TEACHER
                const PROTECTED_ROLES = ['TUTOR', 'SCHOOL_CONTROL', 'PREFECT', 'SUPPORT', 'STUDENT', 'SUPER_ADMIN', 'SYSTEM_ADMIN']
                const fallbackRole = (tenant.type === 'INDEPENDENT' && !PROTECTED_ROLES.includes(profile.role))
                    ? 'INDEPENDENT_TEACHER'
                    : profile.role

                return {
                    id: tenant.id,
                    name: tenant.name,
                    educationalLevel: tenant.educational_level,
                    secondaryType: (tenant as any).secondary_type ?? null,
                    type: (tenant.type || 'SCHOOL').toUpperCase() as 'SCHOOL' | 'INDEPENDENT',
                    role: fallbackRole,
                    fullName: profile.full_name,
                    firstName: profile.first_name,
                    lastNamePaternal: profile.last_name_paternal,
                    lastNameMaternal: profile.last_name_maternal,
                    avatarUrl: profile.avatar_url,
                    cct: tenant.cct,
                    logoUrl: tenant.logo_url,
                    logoLeftUrl: tenant.logo_left_url,
                    logoRightUrl: tenant.logo_right_url,
                    onboardingCompleted: tenant.onboarding_completed,
                    grade: tenant.grade,
                    phase: tenant.phase,
                    aiConfig: {
                        apiKey: tenant.ai_config?.apiKey || tenant.ai_config?.groq_key || globalSettings.groq_key || '',
                        groqKey: tenant.ai_config?.groq_key || tenant.ai_config?.apiKey || globalSettings.groq_key || '',
                        geminiKey: tenant.ai_config?.geminiKey || tenant.ai_config?.gemini_key || globalSettings.gemini_key || '',
                        openaiKey: tenant.ai_config?.openaiKey || tenant.ai_config?.openai_key || globalSettings.openai_key || ''
                    },
                    groqApiKey: tenant.ai_config?.apiKey || tenant.ai_config?.groq_key || globalSettings.groq_key || ''
                }
            }

            const tenant = ptData.tenants as any
            let finalRole = ptData.role

            // If the workspace is independent, the user MUST be treated as INDEPENDENT_TEACHER
            // UNLESS they have a special role that should be preserved (TUTOR, STUDENT, etc.)
            const SPECIAL_ROLES = ['TUTOR', 'SCHOOL_CONTROL', 'PREFECT', 'SUPPORT', 'STUDENT', 'SUPER_ADMIN', 'SYSTEM_ADMIN']
            if (tenant.type?.toUpperCase() === 'INDEPENDENT' && !SPECIAL_ROLES.includes(finalRole)) {
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
                    secondaryType: (tenant as any).secondary_type ?? null,
                type: (tenant.type || 'SCHOOL').toUpperCase() as 'SCHOOL' | 'INDEPENDENT',
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
                address: tenant.address,
                onboardingCompleted: tenant.onboarding_completed,
                grade: tenant.grade,
                phase: tenant.phase,
                aiConfig: {
                    apiKey: tenant.ai_config?.apiKey || tenant.ai_config?.groq_key || globalSettings.groq_key || '',
                    groqKey: tenant.ai_config?.groq_key || tenant.ai_config?.apiKey || globalSettings.groq_key || '',
                    geminiKey: tenant.ai_config?.geminiKey || tenant.ai_config?.gemini_key || globalSettings.gemini_key || '',
                    openaiKey: tenant.ai_config?.openaiKey || tenant.ai_config?.openai_key || globalSettings.openai_key || ''
                },
                groqApiKey: tenant.ai_config?.apiKey || tenant.ai_config?.groq_key || globalSettings.groq_key || ''
            }
        },
        staleTime: 1000 * 30, // 30 seconds
    })
    // isPending: mientras se restaura la copia guardada tampoco hay datos todavía.
    return { ...query, isLoading: query.isPending }
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

            // Una entrada por puesto: la misma escuela aparece dos veces si la persona tiene dos puestos ahí
            return data.filter((pt: any) => pt.tenants).map((pt: any) => ({
                id: pt.tenants.id as string,
                name: pt.tenants.name as string,
                type: pt.tenants.type as string,
                role: String(pt.role).toUpperCase(),
                key: `${pt.tenants.id}:${String(pt.role).toUpperCase()}`,
            }))
        }
    })
}
