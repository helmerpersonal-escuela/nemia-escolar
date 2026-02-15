import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

console.log("Create Preference Function Initialized v4 (Debug Mode)")

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // 1. Handle CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { title, price, quantity, tenantId, userId, planType, isTrial, trialDays, email, platform } = await req.json()

        // 2. Initialize Supabase
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 3. Get MP Access Token
        const { data: settings, error: settingsError } = await supabaseClient
            .from('system_settings')
            .select('value')
            .eq('key', 'mercadopago_access_token')
            .single()

        if (settingsError) {
            console.error("Settings Fetch Error:", settingsError)
            throw new Error(`Failed to fetch MP Token from DB: ${settingsError.message}`)
        }

        const accessToken = settings?.value

        if (!accessToken) {
            throw new Error("Missing Mercado Pago Access Token in system_settings. Configuration required.")
        }

        // 4. Create Preference in Mercado Pago
        const externalRef = JSON.stringify({
            userId,
            tenantId,
            planType: planType || 'basic',
            isTrial: isTrial || false,
            trialDays: trialDays || 0
        })

        const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:5173'

        let successUrl = `${frontendUrl}/?status=approved`
        let failureUrl = `${frontendUrl}/?status=failure`
        let pendingUrl = `${frontendUrl}/?status=pending`

        if (platform === 'android' || platform === 'ios') {
            successUrl = `nemia://onboarding?status=approved`
            failureUrl = `nemia://onboarding?status=failure`
            pendingUrl = `nemia://onboarding?status=pending`
        }

        const payload = {
            binary_mode: true,
            payer: {
                // Random email to avoid "Self-payment" errors
                email: `test_user_${Math.floor(Math.random() * 99999)}@test.com`,
                name: 'Test',
                surname: 'User',
                identification: {
                    type: 'INE',
                    number: '12345678'
                }
            },
            items: [
                {
                    id: planType || 'basic',
                    title: title || 'Licencia PRO - Sistema Escolar',
                    quantity: Number(quantity) || 1,
                    unit_price: Number(price) || 1000,
                    currency_id: 'MXN'
                }
            ],
            external_reference: externalRef,
            back_urls: {
                success: successUrl,
                failure: failureUrl,
                pending: pendingUrl
            },
            auto_return: "approved"
        }
        console.log("Sending payload to MP:", JSON.stringify(payload))

        const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })

        if (!mpResponse.ok) {
            const errorText = await mpResponse.text()
            console.error("MP API Error Body:", errorText)

            let errorDetails = errorText
            try {
                const errObj = JSON.parse(errorText)
                if (errObj.message) {
                    // Combine message and cause if available
                    errorDetails = `${errObj.message} ${errObj.cause ? JSON.stringify(errObj.cause) : ''}`
                }
            } catch (e) { /* ignore parse error */ }

            throw new Error(`Mercado Pago API Error (${mpResponse.status}): ${errorDetails}`)
        }

        const preferenceData = await mpResponse.json()
        console.log("Preference Created:", preferenceData.id)

        return new Response(JSON.stringify({
            preferenceId: preferenceData.id,
            init_point: preferenceData.init_point
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error("Function Error:", error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
