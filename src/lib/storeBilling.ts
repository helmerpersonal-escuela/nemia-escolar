/**
 * Suscripciones dentro de la app móvil.
 *  - iPhone/iPad: StoreKit 2 (ios/App/App/VunlekBillingPlugin.swift)
 *  - Android: Google Play Billing Library (android/.../billing/VunlekBillingPlugin.kt)
 * El teléfono solo compra; el acceso lo da el servidor (función store-verify) después de
 * confirmar la compra directamente con Apple o Google.
 */
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { supabase } from './supabase'

export type StoreName = 'APPLE' | 'GOOGLE'

export interface StoreProduct {
    id: string
    title: string
    description: string
    /** Precio ya formateado por la tienda, con la moneda del usuario (ej. "$75.00"). */
    price: string
    priceAmount: number
    currency: string
    /** Duración ISO 8601 del periodo: P1M, P1Y… */
    period?: string
}

export interface StorePurchase {
    store: StoreName
    status?: 'purchased' | 'pending' | 'unknown'
    productId: string
    transactionId?: string
    originalTransactionId?: string
    purchaseToken?: string
    expiresAt?: string
    accountToken?: string
    revoked?: boolean
}

interface VunlekBillingPlugin {
    isAvailable(): Promise<{ available: boolean; store: StoreName }>
    getProducts(options: { productIds: string[] }): Promise<{ products: StoreProduct[]; missing: string[] }>
    purchase(options: { productId: string; accountToken?: string }): Promise<StorePurchase>
    getEntitlements(): Promise<{ purchases: StorePurchase[] }>
    restore(): Promise<{ purchases: StorePurchase[] }>
    finishTransaction(options: { transactionId: string }): Promise<void>
    manageSubscriptions(options?: { productId?: string }): Promise<void>
    addListener(event: 'purchaseUpdated', handler: (data: { purchases: StorePurchase[] }) => void): Promise<PluginListenerHandle>
}

const Billing = registerPlugin<VunlekBillingPlugin>('VunlekBilling')

// ---------------------------------------------------------------- Errores

export type StoreErrorCode =
    | 'USER_CANCELLED' | 'NETWORK' | 'BILLING_UNAVAILABLE' | 'PRODUCT_NOT_FOUND' | 'ALREADY_OWNED'
    | 'NOT_ALLOWED' | 'VERIFICATION_FAILED' | 'IN_PROGRESS'
    // respuestas del servidor al verificar
    | 'NOT_CONFIGURED' | 'NOT_FOUND' | 'PENDING' | 'OTHER_SPACE' | 'FORBIDDEN' | 'STORE_DOWN' | 'REJECTED' | 'NO_SESSION'
    // la tienda cobró pero el servidor aún no pudo confirmarlo
    | 'VERIFY_PENDING'
    | 'UNKNOWN'

const KNOWN: StoreErrorCode[] = ['USER_CANCELLED', 'NETWORK', 'BILLING_UNAVAILABLE', 'PRODUCT_NOT_FOUND', 'ALREADY_OWNED', 'NOT_ALLOWED',
    'VERIFICATION_FAILED', 'IN_PROGRESS', 'NOT_CONFIGURED', 'NOT_FOUND', 'PENDING', 'OTHER_SPACE', 'FORBIDDEN', 'STORE_DOWN', 'REJECTED', 'NO_SESSION', 'VERIFY_PENDING']

export class StoreError extends Error {
    code: StoreErrorCode
    constructor(code: StoreErrorCode, message?: string) {
        super(message ?? code)
        this.name = 'StoreError'
        this.code = code
    }
}

/** Convierte cualquier error (del complemento nativo o del servidor) en un StoreError. */
export function toStoreError(e: unknown): StoreError {
    if (e instanceof StoreError) return e
    const raw = String((e as any)?.code ?? '').toUpperCase()
    if (raw === 'UNIMPLEMENTED' || raw === 'UNAVAILABLE') return new StoreError('BILLING_UNAVAILABLE')
    const code = (KNOWN as string[]).includes(raw) ? raw as StoreErrorCode : 'UNKNOWN'
    return new StoreError(code, (e as any)?.message)
}

const storeLabel = (store: StoreName | null) => store === 'APPLE' ? 'App Store' : store === 'GOOGLE' ? 'Google Play' : 'la tienda'

/** Mensaje para el usuario. Devuelve null cuando no hay nada que avisar (canceló él mismo). */
export function storeErrorMessage(code: StoreErrorCode, store: StoreName | null = currentStore()): string | null {
    const s = storeLabel(store)
    switch (code) {
        case 'USER_CANCELLED': return null
        case 'NETWORK': return `No hay conexión con ${s}. Revisa tu internet e inténtalo de nuevo.`
        case 'STORE_DOWN': return `${s} no respondió. Inténtalo de nuevo en unos minutos.`
        case 'BILLING_UNAVAILABLE': return `Las compras no están disponibles en este dispositivo. Revisa que tengas sesión iniciada en ${s}.`
        case 'PRODUCT_NOT_FOUND': return `Este plan no está disponible en ${s} por ahora.`
        case 'ALREADY_OWNED': return 'Ya tienes esta suscripción. Toca "Restaurar compras" para activarla en este espacio.'
        case 'NOT_ALLOWED': return 'Las compras están desactivadas en este dispositivo (por ejemplo, por restricciones o control parental).'
        case 'IN_PROGRESS': return 'Ya hay una compra en curso. Termínala antes de iniciar otra.'
        case 'VERIFICATION_FAILED': return `${s} no pudo verificar la compra. No se hizo ningún cargo; inténtalo de nuevo.`
        case 'PENDING': return 'Tu pago está pendiente de aprobación. El acceso se activa solo en cuanto se confirme.'
        case 'VERIFY_PENDING': return 'Tu compra se realizó, pero no pudimos confirmarla con el servidor. No se te cobrará dos veces: toca "Restaurar compras" cuando tengas conexión.'
        case 'NOT_CONFIGURED': return 'Las suscripciones todavía no están habilitadas. Inténtalo más tarde.'
        case 'NOT_FOUND': return `${s} no reconoce esta compra. Si se te hizo un cargo, toca "Restaurar compras".`
        case 'OTHER_SPACE': return 'Esta suscripción ya está ligada a otro espacio de trabajo.'
        case 'FORBIDDEN': return 'Solo el titular del espacio puede contratar la suscripción.'
        case 'NO_SESSION': return 'Tu sesión terminó. Vuelve a iniciar sesión e inténtalo de nuevo.'
        default: return 'No se pudo completar la compra. Inténtalo de nuevo.'
    }
}

// ---------------------------------------------------------------- Datos

/** Tienda del dispositivo, o null en la web y en la app de escritorio. */
export function currentStore(): StoreName | null {
    const platform = Capacitor.getPlatform()
    return platform === 'ios' ? 'APPLE' : platform === 'android' ? 'GOOGLE' : null
}

/** "P1M" → "mes", "P1Y" → "año", "P3M" → "3 meses". */
export function periodLabel(period: string | undefined, months?: number): string {
    const m = /^P(\d+)([DWMY])$/.exec(period ?? '')
    if (!m) return months === 12 ? 'año' : months && months > 1 ? `${months} meses` : 'mes'
    const n = Number(m[1])
    const [one, many] = ({ D: ['día', 'días'], W: ['semana', 'semanas'], M: ['mes', 'meses'], Y: ['año', 'años'] } as Record<string, [string, string]>)[m[2]]
    return n === 1 ? one : `${n} ${many}`
}

/** Cuánto se ahorra al año con el plan anual frente a 12 mensualidades (0 si no conviene o no se sabe). */
export function annualSaving(monthly?: StoreProduct | null, annual?: StoreProduct | null): number {
    if (!monthly || !annual || monthly.currency !== annual.currency) return 0
    const saving = monthly.priceAmount * 12 - annual.priceAmount
    return saving > 0 ? Math.round(saving * 100) / 100 : 0
}

export interface StorePlan {
    plan: 'MONTHLY' | 'ANNUAL'
    name: string
    months: number
    productId: string
    /** null si la tienda no devolvió el producto (aún no publicado o no disponible en el país). */
    product: StoreProduct | null
}

/** Une los planes de VUNLEK con lo que la tienda devuelve (precio y moneda locales). */
export function mergePlans(rows: { plan: string; name: string; months: number; apple?: string | null; google?: string | null }[], store: StoreName, products: StoreProduct[]): StorePlan[] {
    return rows
        .map(r => ({ plan: r.plan as StorePlan['plan'], name: r.name, months: r.months, productId: (store === 'APPLE' ? r.apple : r.google) ?? '' }))
        .filter(r => r.productId)
        .map(r => ({ ...r, product: products.find(p => p.id === r.productId) ?? null }))
}

export async function loadStorePlans(): Promise<StorePlan[]> {
    const store = currentStore()
    if (!store) throw new StoreError('BILLING_UNAVAILABLE')
    const { data, error } = await supabase.rpc('store_products' as any)
    if (error) throw new StoreError('NETWORK', error.message)
    const rows = (data ?? []) as any[]
    const ids = rows.map(r => store === 'APPLE' ? r.apple : r.google).filter(Boolean) as string[]
    if (!ids.length) return []
    try {
        const { available } = await Billing.isAvailable()
        if (!available) throw new StoreError('BILLING_UNAVAILABLE')
        const { products } = await Billing.getProducts({ productIds: ids })
        return mergePlans(rows, store, products)
    } catch (e) {
        throw toStoreError(e)
    }
}

// ---------------------------------------------------------------- Compras

interface VerifyResult { ok: boolean; store: StoreName | null; code?: StoreErrorCode; error?: string; active?: boolean; plan?: string; until?: string; transactionId?: string | null }

/** Pide al servidor que confirme las compras con la tienda y actualice la suscripción del espacio. */
export async function verifyPurchases(tenantId: string, purchases: StorePurchase[]): Promise<VerifyResult[]> {
    const list = purchases.filter(p => p.status !== 'pending' && (p.store === 'APPLE' ? p.transactionId : p.purchaseToken))
    if (!list.length) return []
    const { data, error } = await supabase.functions.invoke('store-verify', {
        body: { tenantId, purchases: list.map(p => ({ store: p.store, productId: p.productId, transactionId: p.transactionId, purchaseToken: p.purchaseToken })) },
    })
    if (error || !(data as any)?.results) {
        let code: StoreErrorCode = 'VERIFY_PENDING'
        try { const ctx = await (error as any)?.context?.json?.(); if (ctx?.code && (KNOWN as string[]).includes(ctx.code)) code = ctx.code } catch { /* sin detalle */ }
        throw new StoreError(code, error?.message)
    }
    const results = (data as any).results as VerifyResult[]
    // iOS: la transacción se cierra hasta que el servidor ya la registró
    for (const r of results) {
        if (r.ok && r.store === 'APPLE' && r.transactionId) {
            try { await Billing.finishTransaction({ transactionId: String(r.transactionId) }) } catch { /* se cierra en la siguiente sincronización */ }
        }
    }
    return results
}

export type BuyOutcome = { status: 'active'; plan?: string; until?: string } | { status: 'pending' }

/** Compra un plan para el espacio y espera la confirmación del servidor. */
export async function buyPlan(tenantId: string, productId: string): Promise<BuyOutcome> {
    let purchase: StorePurchase
    try {
        purchase = await Billing.purchase({ productId, accountToken: tenantId })
    } catch (e) {
        throw toStoreError(e)
    }
    if (purchase.status === 'pending') return { status: 'pending' }

    let results: VerifyResult[]
    try {
        results = await verifyPurchases(tenantId, [purchase])
    } catch (e) {
        const err = toStoreError(e)
        // El cargo ya se hizo: cualquier fallo de red aquí se resuelve restaurando
        throw err.code === 'UNKNOWN' || err.code === 'NETWORK' ? new StoreError('VERIFY_PENDING') : err
    }
    const r = results[0]
    if (!r) throw new StoreError('VERIFY_PENDING')
    if (!r.ok) throw new StoreError(r.code ?? 'UNKNOWN', r.error)
    return { status: 'active', plan: r.plan, until: r.until }
}

/**
 * Envía al servidor las suscripciones que la tienda tiene para esta cuenta.
 * Se usa al abrir la app (renovaciones) y en "Restaurar compras" (`ask: true`, que en iPhone
 * puede pedir la contraseña del Apple ID).
 */
export async function syncStore(tenantId: string, opts: { ask?: boolean } = {}): Promise<{ found: number; active: boolean; errors: StoreErrorCode[] }> {
    if (!currentStore()) return { found: 0, active: false, errors: [] }
    let purchases: StorePurchase[]
    try {
        purchases = (opts.ask ? await Billing.restore() : await Billing.getEntitlements()).purchases ?? []
    } catch (e) {
        throw toStoreError(e)
    }
    if (!purchases.length) return { found: 0, active: false, errors: [] }
    const results = await verifyPurchases(tenantId, purchases)
    return { found: purchases.length, active: results.some(r => r.ok && r.active), errors: results.filter(r => !r.ok).map(r => r.code ?? 'UNKNOWN') }
}

/** Abre la pantalla de la tienda donde el usuario cancela o cambia su suscripción. */
export async function openStoreManagement(productId?: string): Promise<void> {
    try { await Billing.manageSubscriptions({ productId }) } catch (e) { throw toStoreError(e) }
}

/** Avisos de la tienda mientras la app está abierta (renovación, pago pendiente aprobado, reembolso). */
export async function onStorePurchase(handler: (purchases: StorePurchase[]) => void): Promise<() => void> {
    if (!currentStore()) return () => { }
    const handle = await Billing.addListener('purchaseUpdated', data => handler(data?.purchases ?? []))
    return () => { void handle.remove() }
}
