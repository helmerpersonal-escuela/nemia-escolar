import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { email, firstName, lastNamePaternal, guardianId, studentName, tenantId } = await req.json()

        // 0. Fetch SMTP Settings
        const { data: smtpSettings } = await supabaseAdmin
            .from('system_settings')
            .select('key, value')

        const smtpConfig = smtpSettings?.reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.value
            return acc
        }, {})

        console.log('Using SMTP Config:', { ...smtpConfig, smtp_pass: '***' })

        // 1. Check if user already exists
        const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers()
        const user = existingUser.users.find(u => u.email === email)

        let userId;

        if (!user) {
            // 2. Create User with random 6-digit password
            const tempPassword = Math.floor(100000 + Math.random() * 900000).toString()
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

            // 3. TODO: Send Email with tempPassword using your preferred provider (Resend, SendGrid, etc.)
            // For now, we return it so the UI can log it/show it if needed for testing
            console.log(`User created for ${email} with password ${tempPassword}`)

            return new Response(JSON.stringify({
                success: true,
                userId,
                tempPassword,
                message: 'Usuario creado y credenciales generadas'
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        } else {
            userId = user.id
        }

        // 4. Update Guardian record with profile_id
        const { error: updateError } = await supabaseAdmin
            .from('guardians')
            .update({ profile_id: userId })
            .eq('id', guardianId)

        if (updateError) throw updateError

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
