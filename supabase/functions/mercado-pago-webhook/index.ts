import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log("Mercado Pago Webhook Initialized")

serve(async (req) => {
    // 1. Handle CORS preflight request
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const url = new URL(req.url)
        const topic = url.searchParams.get('topic') || url.searchParams.get('type') // payment or merchant_order
        const id = url.searchParams.get('id') || url.searchParams.get('data.id')

        if (!id) {
            return new Response(JSON.stringify({ message: "No ID provided" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        // 2. Initialize Supabase Admin Client
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false
                }
            }
        )

        // 3. Get MP Access Token from DB
        const { data: settings } = await supabaseClient
            .from('system_settings')
            .select('value')
            .eq('key', 'mercadopago_access_token')
            .single()

        const accessToken = settings?.value

        if (!accessToken) {
            console.error("Missing MP Access Token")
            // Return 200 anyway to stop MP from retrying if we are broken
            return new Response(JSON.stringify({ error: "Configuration Error" }), { status: 200 })
        }

        // 4. Fetch Payment Details from Mercado Pago
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        })

        if (!mpRes.ok) {
            console.error("MP API Error", await mpRes.text())
            return new Response(JSON.stringify({ error: "MP API Error" }), { status: 200 })
        }

        const payment = await mpRes.json()

        // 5. Store Transaction in Supabase
        // Extract metadata
        const metadata = payment.metadata || {}
        const externalRef = payment.external_reference || ""

        let userId = null
        let tenantId = null
        let planType = 'basic'
        let isTrial = false
        let trialDays = 0

        // Try to parse as JSON (new format)
        try {
            const refData = JSON.parse(externalRef)
            userId = refData.userId
            tenantId = refData.tenantId
            planType = refData.planType || 'basic'
            isTrial = refData.isTrial || false
            trialDays = refData.trialDays || 0
        } catch (e) {
            // Fallback to old format: USER_ID|TENANT_ID
            if (externalRef.includes('|')) {
                const parts = externalRef.split('|')
                userId = parts[0]
                tenantId = parts[1]
            }
        }

        if (!userId) {
            console.error("No User ID in external reference")
            return new Response(JSON.stringify({ message: "No User ID" }), { status: 200 })
        }

        // 6. Handle Subscription & Transaction
        if (payment.status === 'approved') {
            const now = new Date();
            const oneYearLater = new Date(new Date().setFullYear(now.getFullYear() + 1));

            // Determine subscription status based on trial
            const subscriptionStatus = isTrial ? 'trialing' : 'active'
            const periodEnd = isTrial
                ? new Date(new Date().setDate(now.getDate() + trialDays))
                : oneYearLater

            // Upsert Subscription with plan_type
            const { data: sub, error: subError } = await supabaseClient.from('subscriptions').upsert({
                user_id: userId,
                status: subscriptionStatus,
                plan_type: planType, // 'basic' or 'pro'
                current_period_start: now.toISOString(),
                current_period_end: periodEnd.toISOString(),
                mercadopago_customer_id: payment.payer?.id?.toString(),
                updated_at: now.toISOString()
            }, { onConflict: 'user_id' }).select().single();

            if (subError) {
                console.error("Subscription Error:", subError);
            }

            // Record Transaction
            const { error: txError } = await supabaseClient.from('payment_transactions').upsert({
                subscription_id: sub?.id,
                user_id: userId,
                tenant_id: tenantId,
                amount: payment.transaction_amount,
                currency: payment.currency_id,
                status: 'approved',
                provider: 'MERCADO_PAGO',
                provider_payment_id: String(payment.id),
                meta: payment
            }, { onConflict: 'provider_payment_id' });

            if (txError) console.error("Transaction Error:", txError);
        } else {
            // Log failed/pending transaction
            await supabaseClient.from('payment_transactions').upsert({
                user_id: userId,
                tenant_id: tenantId,
                amount: payment.transaction_amount,
                currency: payment.currency_id,
                status: payment.status, // rejected, pending, etc
                provider: 'MERCADO_PAGO',
                provider_payment_id: String(payment.id),
                meta: payment
            }, { onConflict: 'provider_payment_id' });
        }

        return new Response(JSON.stringify({ message: "Processed" }), {
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
