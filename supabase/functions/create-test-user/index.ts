import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

console.log("Create Test User Function Initialized (Deno.serve)")

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders, status: 200 })
    }

    try {
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { email, password, firstName, lastNamePaternal, lastNameMaternal, role, tenantId } = await req.json()

        // 1. Create a dummy invitation to get a token and link to tenant via trigger
        const { data: invite, error: inviteError } = await supabaseAdmin
            .from('staff_invitations')
            .insert({
                tenant_id: tenantId,
                email: email.toLowerCase(),
                role: role,
                status: 'PENDING'
            })
            .select()
            .single()

        if (inviteError) throw inviteError

        // 2. Create User with Auth Admin API
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                firstName,
                lastNamePaternal,
                lastNameMaternal: lastNameMaternal || '',
                invitationToken: invite.token,
                role
            }
        })

        if (createError) throw createError

        return new Response(JSON.stringify({ success: true, user: newUser.user }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
