import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

console.log("Create Preference Function Initialized v6.0 (CORS Debug)")

Deno.serve(async (req) => {
    // 1. Handle CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders, status: 200 })
    }

    try {
        const body = await req.json()
        console.log("Incoming Request Body:", JSON.stringify(body))

        const { title, price, quantity, tenantId, userId, planType, isTrial, trialDays, email, platform } = body

        // 2. Initialize Supabase
        console.log("Initializing Supabase Client...")
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!supabaseUrl || !supabaseKey) {
            console.error("Missing Environment Variables: URL or SERVICE_ROLE_KEY")
            throw new Error("Missing Internal Configuration (Env Vars)")
        }

        const supabaseClient = createClient(supabaseUrl, supabaseKey)

        // 3. Get MP Access Token
        console.log("Fetching MP Token from system_settings...")
        const { data: settings, error: settingsError } = await supabaseClient
            .from('system_settings')
            .select('value')
            .eq('key', 'mercadopago_access_token')
            .single()

        if (settingsError) {
            console.error("Settings Fetch Error:", JSON.stringify(settingsError))
            throw new Error(`Failed to fetch MP Token from DB: ${settingsError.message}`)
        }

        const accessToken = settings?.value

        if (!accessToken) {
            console.error("Token is empty in DB")
            throw new Error("Missing Mercado Pago Access Token in system_settings. Please save it in God Mode.")
        }

        console.log("Token fetched successfully (length):", accessToken.length)
        console.log("Token prefix:", accessToken.substring(0, 10))

        // 4. Create Preference in Mercado Pago
        const externalRef = JSON.stringify({
            userId: userId || 'unknown',
            tenantId: tenantId || 'unknown',
            planType: planType || 'pro',
            isTrial: isTrial || false,
            trialDays: trialDays || 0
        })

        const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:5173'

        // The Webhook URL that Mercado Pago will call
        const notificationUrl = `${supabaseUrl}/functions/v1/mercado-pago-webhook`

        // Mercado Pago sometimes rejects localhost URLs for auto_return in production tokens.
        // Even for TEST tokens, they must be well-formatted.
        let successUrl = `${frontendUrl}/?status=approved`
        let failureUrl = `${frontendUrl}/?status=failure`
        let pendingUrl = `${frontendUrl}/?status=pending`

        if (platform === 'android' || platform === 'ios') {
            successUrl = `nemia://onboarding?status=approved`
            failureUrl = `nemia://onboarding?status=failure`
            pendingUrl = `nemia://onboarding?status=pending`
        }

        // CRITICAL: To avoid "Self-payment" errors (vendedor pagándose a sí mismo)
        // we use a generic test email for the payer in Sandbox mode.
        const payerEmail = `payer_test_${Math.floor(Math.random() * 100000)}@test.com`
        console.log("Using payer email:", payerEmail)

        const payload = {
            binary_mode: true,
            payer: {
                email: payerEmail,
            },
            items: [
                {
                    id: planType || 'pro',
                    title: title || 'Upgrade Plan PRO',
                    quantity: Number(quantity) || 1,
                    unit_price: Number(price) || 599,
                    currency_id: 'MXN'
                }
            ],
            external_reference: externalRef,
            notification_url: notificationUrl,
            back_urls: {
                success: successUrl,
                failure: failureUrl,
                pending: pendingUrl
            },
            // Note: auto_return ONLY works if successUrl is HTTPS or a valid public URL.
            // In Dev (localhost), it might cause the 400 error we are seeing.
            auto_return: frontendUrl.includes('localhost') ? undefined : "approved"
        }

        console.log("Final payload to MP (v10.0 - Webhook Support):", JSON.stringify(payload))

        const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })

        if (!mpResponse.ok) {
            const errorData = await mpResponse.json()
            console.error("MP API Detailed Error:", JSON.stringify(errorData))

            // Extract meaningful error message
            const errorMsg = errorData.message || (errorData.cause && errorData.cause[0] && errorData.cause[0].description) || JSON.stringify(errorData)
            throw new Error(`Mercado Pago API Error (${mpResponse.status}): ${errorMsg}`)
        }

        const preferenceData = await mpResponse.json()
        console.log("Preference Created Successfully:", preferenceData.id)

        return new Response(JSON.stringify({
            preferenceId: preferenceData.id,
            init_point: preferenceData.init_point
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Critical Function Error:", errorMessage);

        return new Response(JSON.stringify({
            error: errorMessage,
            timestamp: new Date().toISOString(),
            hint: "Check Supabase Edge Function logs for details"
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
