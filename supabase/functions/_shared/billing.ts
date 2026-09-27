// Utilidades de cobro (Mercado Pago) compartidas por billing y mercado-pago-webhook.
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import { HttpError } from "./auth.ts"

export type PlanCode = 'MONTHLY' | 'ANNUAL'

export interface Quote {
    plan: PlanCode
    name: string
    months: number
    base: number
    discount: number
    final: number
    code: string | null
    code_valid: boolean
    code_message: string | null
}

export async function getSettings(admin: SupabaseClient, keys: string[]): Promise<Record<string, string>> {
    const { data } = await admin.from('system_settings').select('key, value').in('key', keys)
    const out: Record<string, string> = {}
    for (const r of data ?? []) out[r.key] = String(r.value ?? '').trim()
    return out
}

export async function mpToken(admin: SupabaseClient): Promise<string> {
    const s = await getSettings(admin, ['mercadopago_access_token'])
    const token = Deno.env.get('MP_ACCESS_TOKEN') || s.mercadopago_access_token
    if (!token) throw new HttpError(500, 'Mercado Pago no está configurado (Access Token)')
    return token
}

export async function quote(admin: SupabaseClient, plan: string, code?: string | null): Promise<Quote> {
    const { data, error } = await admin.rpc('billing_quote', { p_plan: plan, p_code: code ?? null })
    if (error) throw new HttpError(400, error.message)
    return data as Quote
}

export async function mp<T = any>(token: string, path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`https://api.mercadopago.com${path}`, {
        ...init,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
        console.error(`MP ${init.method ?? 'GET'} ${path} → ${res.status}`, JSON.stringify(body).slice(0, 500))
        throw new HttpError(502, body?.message ? `Mercado Pago: ${body.message}` : `Mercado Pago respondió ${res.status}`)
    }
    return body as T
}

/** Referencia de una suscripción con cobro automático: "tenantId|PLAN|CODIGO". */
export const subRef = (tenantId: string, plan: string, code?: string | null) => `${tenantId}|${plan}|${code ?? ''}`
export function parseSubRef(ref: string | null | undefined) {
    const [tenantId, plan, code] = String(ref ?? '').split('|')
    if (!tenantId || !['MONTHLY', 'ANNUAL'].includes(plan)) return null
    return { tenantId, plan: plan as PlanCode, code: code || null }
}

export const frontendUrl = () => (Deno.env.get('FRONTEND_URL') || 'https://vunlek.com').replace(/\/$/, '')
