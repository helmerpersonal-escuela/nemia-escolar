import { createClient, SupabaseClient, User } from "https://esm.sh/@supabase/supabase-js@2"

export const SUPER_ADMIN_EMAILS = ['helmerferras@gmail.com', 'helmerpersonal@gmail.com']

export class HttpError extends Error {
    status: number
    constructor(status: number, message: string) {
        super(message)
        this.status = status
    }
}

export function getAdminClient(): SupabaseClient {
    const url = Deno.env.get('SUPABASE_URL')
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !key) throw new HttpError(500, 'Configuración del servidor incompleta')
    return createClient(url, key, { auth: { persistSession: false } })
}

/** Valida el JWT del usuario que llama. Lanza 401 si no hay sesión válida. */
export async function requireUser(req: Request, admin: SupabaseClient): Promise<User> {
    const header = req.headers.get('Authorization') ?? ''
    const jwt = header.replace(/^Bearer\s+/i, '').trim()
    if (!jwt) throw new HttpError(401, 'Sesión requerida')

    const { data, error } = await admin.auth.getUser(jwt)
    if (error || !data?.user) throw new HttpError(401, 'Sesión inválida o expirada')
    return data.user
}

export async function isSuperAdmin(admin: SupabaseClient, user: User): Promise<boolean> {
    if (user.email && SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase()) && user.email_confirmed_at) {
        return true
    }
    const { data } = await admin
        .from('profile_roles')
        .select('role')
        .eq('profile_id', user.id)
        .eq('role', 'SUPER_ADMIN')
        .limit(1)
    return !!data?.length
}

/** Rol del usuario dentro de una escuela (tenant), o null si no pertenece. */
export async function getRoleInTenant(admin: SupabaseClient, userId: string, tenantId: string): Promise<string | null> {
    if (!tenantId) return null
    const { data } = await admin
        .from('profile_tenants')
        .select('role')
        .eq('profile_id', userId)
        .eq('tenant_id', tenantId)
        .limit(1)
    return data?.[0]?.role?.toUpperCase() ?? null
}

export function errorResponse(error: unknown, headers: Record<string, string>): Response {
    const status = error instanceof HttpError ? error.status : 400
    const message = error instanceof Error ? error.message : 'Error interno'
    return new Response(JSON.stringify({ error: message }), {
        headers: { ...headers, 'Content-Type': 'application/json' },
        status,
    })
}
