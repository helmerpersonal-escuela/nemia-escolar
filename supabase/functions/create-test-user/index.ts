import { corsHeaders } from "../_shared/cors.ts"
import { errorResponse, getAdminClient, getRoleInTenant, HttpError, isSuperAdmin, requireUser } from "../_shared/auth.ts"

// Roles que pueden dar de alta personal directamente
const STAFF_MANAGERS = ['DIRECTOR', 'ADMIN', 'ACADEMIC_COORD', 'TECH_COORD']
// Roles que solo DIRECTOR/ADMIN (o Super Admin) pueden asignar
const PRIVILEGED_ROLES = ['DIRECTOR', 'ADMIN']
const ASSIGNABLE_ROLES = ['DIRECTOR', 'ADMIN', 'ACADEMIC_COORD', 'TECH_COORD', 'SCHOOL_CONTROL', 'TEACHER', 'PREFECT', 'SUPPORT']

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders, status: 200 })
    }

    try {
        const admin = getAdminClient()
        const caller = await requireUser(req, admin)

        const { email, password, firstName, lastNamePaternal, lastNameMaternal, role, tenantId } = await req.json()

        if (!email || !password || !tenantId || !role) {
            throw new HttpError(400, 'Faltan datos: correo, contraseña, rol y escuela son obligatorios')
        }
        if (String(password).length < 8) {
            throw new HttpError(400, 'La contraseña debe tener al menos 8 caracteres')
        }

        const requestedRole = String(role).toUpperCase()
        if (!ASSIGNABLE_ROLES.includes(requestedRole)) {
            throw new HttpError(403, `No se puede asignar el rol ${requestedRole}`)
        }

        // --- Autorización: el que llama debe administrar ESA escuela ---
        const superAdmin = await isSuperAdmin(admin, caller)
        if (!superAdmin) {
            const callerRole = await getRoleInTenant(admin, caller.id, tenantId)
            if (!callerRole || !STAFF_MANAGERS.includes(callerRole)) {
                throw new HttpError(403, 'No tienes permiso para dar de alta personal en esta escuela')
            }
            if (PRIVILEGED_ROLES.includes(requestedRole) && !PRIVILEGED_ROLES.includes(callerRole)) {
                throw new HttpError(403, 'Solo Dirección puede crear usuarios de Dirección o Administración')
            }
        }

        // 1. Invitación (el trigger la usa para vincular al usuario con la escuela)
        const { data: invite, error: inviteError } = await admin
            .from('staff_invitations')
            .insert({
                tenant_id: tenantId,
                email: String(email).toLowerCase().trim(),
                role: requestedRole,
                status: 'PENDING',
                created_by: caller.id,
            })
            .select()
            .single()

        if (inviteError) throw inviteError

        // 2. Crear usuario
        const { data: newUser, error: createError } = await admin.auth.admin.createUser({
            email: String(email).toLowerCase().trim(),
            password,
            email_confirm: true,
            user_metadata: {
                firstName,
                lastNamePaternal,
                lastNameMaternal: lastNameMaternal || '',
                invitationToken: invite.token,
                mode: 'JOIN',
                role: requestedRole,
            },
        })

        if (createError) throw createError

        return new Response(JSON.stringify({ success: true, user: { id: newUser.user.id, email: newUser.user.email } }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (error) {
        console.error('create-test-user error:', error instanceof Error ? error.message : error)
        return errorResponse(error, corsHeaders)
    }
})
