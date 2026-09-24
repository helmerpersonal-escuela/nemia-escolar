import { corsHeaders } from "../_shared/cors.ts"
import { errorResponse, getAdminClient, HttpError, requireUser } from "../_shared/auth.ts"

// El precio y el usuario ya NO vienen del cliente: antes cualquiera podía
// pagar $1 por el plan Pro o activar el plan de otra persona.
const VALID_PLANS = ['basic', 'pro']

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders, status: 200 })
    }

    try {
        const admin = getAdminClient()
        const user = await requireUser(req, admin)
        const body = await req.json().catch(() => ({}))

        const planType = String(body.planType || 'pro').toLowerCase()
        if (!VALID_PLANS.includes(planType)) throw new HttpError(400, 'Plan no válido')

        // Escuela: solo una a la que el usuario pertenezca
        let tenantId: string | null = body.tenantId || null
        if (tenantId) {
            const { data: link } = await admin
                .from('profile_tenants')
                .select('tenant_id')
                .eq('profile_id', user.id)
                .eq('tenant_id', tenantId)
                .maybeSingle()
            if (!link) throw new HttpError(403, 'No perteneces a esa escuela')
        }

        // Precio oficial desde la base de datos
        const { data: plan, error: planErr } = await admin
            .from('license_limits')
            .select('price_annual')
            .eq('plan_type', planType)
            .maybeSingle()
        if (planErr || !plan?.price_annual) throw new HttpError(500, 'No se encontró el precio del plan')
        const price = Number(plan.price_annual)

        const { data: settings } = await admin
            .from('system_settings')
            .select('value')
            .eq('key', 'mercadopago_access_token')
            .maybeSingle()
        const accessToken = Deno.env.get('MP_ACCESS_TOKEN') || settings?.value
        if (!accessToken) throw new HttpError(500, 'Mercado Pago no está configurado')

        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:5173'
        const isNative = body.platform === 'android' || body.platform === 'ios'
        const back = (status: string) => isNative ? `nemia://onboarding?status=${status}` : `${frontendUrl}/?status=${status}`

        const payload = {
            binary_mode: true,
            payer: user.email ? { email: user.email } : undefined,
            items: [{
                id: planType,
                title: planType === 'pro' ? 'Suscripción anual Plan PRO - Vunlek' : 'Suscripción anual Plan Básico - Vunlek',
                quantity: 1,
                unit_price: price,
                currency_id: 'MXN',
            }],
            external_reference: JSON.stringify({ userId: user.id, tenantId, planType }),
            notification_url: `${supabaseUrl}/functions/v1/mercado-pago-webhook`,
            back_urls: { success: back('approved'), failure: back('failure'), pending: back('pending') },
            auto_return: frontendUrl.includes('localhost') ? undefined : 'approved',
        }

        const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })

        if (!mpResponse.ok) {
            const errorData = await mpResponse.json().catch(() => ({}))
            console.error('MP API error:', mpResponse.status, JSON.stringify(errorData))
            throw new HttpError(502, `Mercado Pago rechazó la solicitud (${mpResponse.status})`)
        }

        const preferenceData = await mpResponse.json()
        return new Response(JSON.stringify({
            preferenceId: preferenceData.id,
            init_point: preferenceData.init_point,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    } catch (error) {
        console.error('create-payment-preference error:', error instanceof Error ? error.message : error)
        return errorResponse(error, corsHeaders)
    }
})
