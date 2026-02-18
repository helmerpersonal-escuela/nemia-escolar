import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

console.log("Invite Tutor Function Initialized (Deno.serve)")

Deno.serve(async (req) => {
    // 0. Handle CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            headers: corsHeaders,
            status: 204
        })
    }

    try {
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const body = await req.json()
        const { email, firstName, lastNamePaternal, guardianId, tenantId } = body

        console.log(`Processing invitation for ${email} in tenant ${tenantId}`)

        // 1. Check if user already exists
        const { data: existingUser, error: listError } = await supabaseAdmin.auth.admin.listUsers()
        if (listError) throw listError

        const user = existingUser.users.find(u => u.email === email)

        let userId;
        let tempPassword;

        if (!user) {
            // 2. Create User with random 6-digit password
            tempPassword = Math.floor(100000 + Math.random() * 900000).toString()
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password: tempPassword,
                email_confirm: true,
                user_metadata: {
                    firstName,
                    lastNamePaternal,
                    role: 'TUTOR',
                    tenantId
                }
            })

            if (createError) throw createError
            userId = newUser.user.id
            console.log(`User created for ${email} with password ${tempPassword}`)
        } else {
            userId = user.id
            console.log(`User already exists for ${email}, linking...`)
        }

        // 4. Update Guardian record with profile_id (IF guardianId is provided)
        if (guardianId) {
            const { error: updateError } = await supabaseAdmin
                .from('guardians')
                .update({ profile_id: userId })
                .eq('id', guardianId)

            if (updateError) throw updateError
            console.log(`Guardian ${guardianId} linked to user ${userId}`)
        }

        return new Response(JSON.stringify({
            success: true,
            userId,
            tempPassword,
            message: user ? 'Usuario vinculado' : 'Usuario creado y credenciales generadas'
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error('Edge Function Error:', error)
        return new Response(JSON.stringify({
            error: error?.message || 'Internal Server Error',
            details: String(error)
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
