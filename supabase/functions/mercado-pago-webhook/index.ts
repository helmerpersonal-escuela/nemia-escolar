import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

console.log("Mercado Pago Webhook Initialized v3 (Shared CORS)")

Deno.serve(async (req) => {
    // 1. Handle CORS preflight request
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders, status: 200 })
    }

    try {
        const url = new URL(req.url)
        console.log("Full Webhook URL received:", req.url)

        const topic = url.searchParams.get('topic') || url.searchParams.get('type')
        const id = url.searchParams.get('id') || url.searchParams.get('data.id')

        console.log(`Webhook Triggered - Topic: ${topic}, ID: ${id}`)

        if (!id) {
            console.log("No ID provided in webhook params. Skipping.")
            return new Response(JSON.stringify({ message: "No ID provided" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        // 2. Initialize Supabase Admin Client
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!supabaseUrl || !supabaseKey) {
            console.error("Missing DB Env Vars")
            return new Response(JSON.stringify({ error: "DB Config Error" }), { status: 200 })
        }

        const supabaseClient = createClient(supabaseUrl, supabaseKey, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
        })

        // 3. Get MP Access Token from DB
        console.log("Fetching MP Token for webhook processing...")
        const { data: settings, error: settingsErr } = await supabaseClient
            .from('system_settings')
            .select('value')
            .eq('key', 'mercadopago_access_token')
            .single()

        if (settingsErr || !settings?.value) {
            console.error("Missing MP Access Token in DB for Webhook:", settingsErr)
            return new Response(JSON.stringify({ error: "Token not found" }), { status: 200 })
        }

        const accessToken = settings.value

        // 4. Fetch Payment Details from Mercado Pago
        console.log(`Fetching details for payment ${id}...`)
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        })

        if (!mpRes.ok) {
            const errBody = await mpRes.text()
            console.error(`MP API Error fetching payment ${id}:`, errBody)
            return new Response(JSON.stringify({ error: "MP API Error" }), { status: 200 })
        }

        const payment = await mpRes.json()
        console.log(`Payment status for ${id}: ${payment.status}`)

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

            // 6.1 Check current subscription status to avoid redundant updates
            const { data: currentSub } = await supabaseClient
                .from('subscriptions')
                .select('status, current_period_end')
                .eq('user_id', userId)
                .maybeSingle();

            // Determine new subscription status
            const subscriptionStatus = isTrial ? 'trialing' : 'active';
            const periodEnd = isTrial
                ? new Date(new Date().setDate(now.getDate() + trialDays))
                : oneYearLater;

            // Only update if status changed or if it's a new subscription
            if (!currentSub || currentSub.status !== subscriptionStatus) {
                console.log(`Updating subscription for user ${userId} to status: ${subscriptionStatus}`);

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
                console.log(`Subscription for user ${userId} is already ${subscriptionStatus}. Skipping update.`);
            }
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

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
