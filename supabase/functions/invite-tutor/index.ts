import { corsHeaders } from "../_shared/cors.ts"
import { errorResponse, getAdminClient, getRoleInTenant, HttpError, isSuperAdmin, requireUser } from "../_shared/auth.ts"

// Cualquier miembro del personal de la escuela puede dar acceso a un tutor
const STAFF_ROLES = ['DIRECTOR', 'ADMIN', 'ACADEMIC_COORD', 'TECH_COORD', 'SCHOOL_CONTROL', 'TEACHER', 'INDEPENDENT_TEACHER', 'PREFECT', 'SUPPORT']

function generateTempPassword(length = 10): string {
    // Sin caracteres ambiguos (0/O, 1/l/I) para que sea fácil de dictar
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    const bytes = new Uint32Array(length)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, b => alphabet[b % alphabet.length]).join('')
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders, status: 204 })
    }

    try {
        const admin = getAdminClient()
        const caller = await requireUser(req, admin)

        const { email, firstName, lastNamePaternal, guardianId, tenantId } = await req.json()
        const cleanEmail = String(email ?? '').toLowerCase().trim()

        if (!cleanEmail || !tenantId) {
            throw new HttpError(400, 'Correo y escuela son obligatorios')
        }

        // --- Autorización: el que llama debe ser personal de ESA escuela ---
        if (!(await isSuperAdmin(admin, caller))) {
            const callerRole = await getRoleInTenant(admin, caller.id, tenantId)
            if (!callerRole || !STAFF_ROLES.includes(callerRole)) {
                throw new HttpError(403, 'No tienes permiso para dar acceso a tutores en esta escuela')
            }
        }

        // --- El tutor (guardian) debe pertenecer a la misma escuela ---
        if (guardianId) {
            const { data: guardian, error: gErr } = await admin
                .from('guardians')
                .select('id, tenant_id, profile_id')
                .eq('id', guardianId)
                .maybeSingle()
            if (gErr) throw gErr
            if (!guardian || guardian.tenant_id !== tenantId) {
                throw new HttpError(403, 'El tutor no pertenece a esta escuela')
            }
        }

        // 1. ¿Ya existe una cuenta con ese correo? (búsqueda directa, no solo la primera página)
        const { data: existingProfile } = await admin
            .from('profiles')
            .select('id')
            .ilike('email', cleanEmail)
            .limit(1)
            .maybeSingle()

        let userId: string
        let tempPassword: string | undefined

        if (!existingProfile) {
            tempPassword = generateTempPassword()
            const { data: newUser, error: createError } = await admin.auth.admin.createUser({
                email: cleanEmail,
                password: tempPassword,
                email_confirm: true,
                user_metadata: { firstName, lastNamePaternal },
                // app_metadata solo lo escribe el servidor: handle_new_user lo usa para
                // dejar al tutor ligado a ESTA escuela con rol TUTOR.
                app_metadata: { invited_role: 'TUTOR', invited_tenant: tenantId },
            })
            if (createError) throw createError
            userId = newUser.user.id
        } else {
            userId = existingProfile.id
            // Cuenta existente: darle acceso como tutor en esta escuela (si no lo tenía).
            const { error: linkError } = await admin
                .from('profile_tenants')
                .upsert({ profile_id: userId, tenant_id: tenantId, role: 'TUTOR', is_default: false },
                    { onConflict: 'profile_id,tenant_id,role', ignoreDuplicates: true })
            if (linkError) throw linkError
        }

        // 2. Vincular el registro del tutor con su cuenta
        if (guardianId) {
            const { error: updateError } = await admin
                .from('guardians')
                .update({ profile_id: userId })
                .eq('id', guardianId)
                .eq('tenant_id', tenantId)
            if (updateError) throw updateError
        }

        return new Response(JSON.stringify({
            success: true,
            userId,
            tempPassword,
            message: existingProfile ? 'Usuario vinculado' : 'Usuario creado y credenciales generadas',
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (error) {
        console.error('invite-tutor error:', error instanceof Error ? error.message : error)
        return errorResponse(error, corsHeaders)
    }
})
