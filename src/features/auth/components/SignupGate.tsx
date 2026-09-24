import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { PageLoader } from '../../../components/common/PageLoader'

/**
 * Si la cuenta entró con Google y todavía no eligió "Docente" o "Escuela",
 * la manda a completar su registro. Sin conexión deja pasar (la app trabaja
 * con la copia local).
 */
export const SignupGate = ({ userId, children }: { userId: string; children: ReactNode }) => {
    const { data, isLoading } = useQuery({
        queryKey: ['signup-status', userId],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('my_signup_status')
            if (error) throw error
            return data as { has_workspace: boolean; is_super_admin: boolean }
        },
        staleTime: 5 * 60 * 1000,
        retry: false,
    })

    if (isLoading) return <PageLoader />
    if (data && !data.has_workspace && !data.is_super_admin) return <Navigate to="/complete-signup" replace />
    return <>{children}</>
}
