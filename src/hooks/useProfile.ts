import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface Profile {
    id: string
    tenant_id: string
    full_name: string | null
    first_name: string | null
    last_name_paternal: string | null
    last_name_maternal: string | null
    role: string
    nationality: string | null
    birth_date: string | null
    sex: 'HOMBRE' | 'MUJER' | 'OTRO' | null
    marital_status: string | null
    curp: string | null
    rfc: string | null
    address_particular: string | null
    phone_contact: string | null
    profile_setup_completed: boolean
    is_demo: boolean // NEW: for read-only test accounts
    avatar_url: string | null
    created_at: string
    work_start_time: string | null // e.g. "07:00:00"
}

export const useProfile = () => {
    const queryClient = useQueryClient()

    const { data: profile, isLoading, error } = useQuery<Profile | null>({
        queryKey: ['profile'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return null

            // Check for impersonation param
            const searchParams = new URLSearchParams(window.location.search)
            const impersonateId = searchParams.get('impersonate')

            let targetUserId = user.id

            // Security Check: Only allow impersonation if the REAL user is a Super Admin
            if (impersonateId) {
                const { data: realUserProfile } = await supabase
                    .from('profiles')
                    .select('role, email') // We might need to select email if it's in profile, or rely on auth email
                    .eq('id', user.id)
                    .single()

                // Using auth email is safer as it can't be spoofed in DB as easily
                const isSuperAdmin = user.email === 'helmerferras@gmail.com' || user.email === 'helmerpersonal@gmail.com' || realUserProfile?.role === 'SUPER_ADMIN'

                if (isSuperAdmin) {
                    console.warn('GOD MODE: Impersonating User', impersonateId)
                    targetUserId = impersonateId
                }
            }

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', targetUserId)
                .single()

            if (error) throw error
            return data
        },
        staleTime: 1000 * 30, // 30 seconds
    })

    const updateProfile = useMutation({
        mutationFn: async (updatedData: Partial<Profile>) => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('No authenticated user')

            const { data, error } = await supabase
                .from('profiles')
                .update(updatedData)
                .eq('id', user.id)
                .select()
                .single()

            if (error) throw error
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profile'] })
            queryClient.invalidateQueries({ queryKey: ['tenant'] })
        }
    })

    return {
        profile,
        isLoading,
        error,
        updateProfile: updateProfile.mutateAsync,
        isUpdating: updateProfile.isPending
    }
}
