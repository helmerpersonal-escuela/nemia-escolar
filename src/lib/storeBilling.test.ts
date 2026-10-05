import { describe, expect, it } from 'vitest'
import { annualSaving, mergePlans, periodLabel, StoreError, storeErrorMessage, toStoreError, type StoreProduct } from './storeBilling'

const product = (id: string, priceAmount: number, currency = 'MXN'): StoreProduct =>
    ({ id, title: id, description: '', price: `$${priceAmount}`, priceAmount, currency, period: 'P1M' })

describe('suscripciones de las tiendas', () => {
    it('describe el periodo', () => {
        expect(periodLabel('P1M')).toBe('mes')
        expect(periodLabel('P1Y')).toBe('año')
        expect(periodLabel('P3M')).toBe('3 meses')
        expect(periodLabel(undefined, 12)).toBe('año')
        expect(periodLabel('raro', 1)).toBe('mes')
    })

    it('calcula el ahorro anual solo con la misma moneda', () => {
        expect(annualSaving(product('m', 75), product('a', 700))).toBe(200)
        expect(annualSaving(product('m', 75), product('a', 950))).toBe(0)
        expect(annualSaving(product('m', 75), product('a', 40, 'USD'))).toBe(0)
        expect(annualSaving(null, product('a', 700))).toBe(0)
    })

    it('une los planes con los productos de cada tienda', () => {
        const rows = [
            { plan: 'MONTHLY', name: 'Mensual', months: 1, apple: 'ios_m', google: 'and_m' },
            { plan: 'ANNUAL', name: 'Anual', months: 12, apple: 'ios_a', google: null },
        ]
        const apple = mergePlans(rows, 'APPLE', [product('ios_m', 75)])
        expect(apple.map(p => p.productId)).toEqual(['ios_m', 'ios_a'])
        expect(apple[0].product?.priceAmount).toBe(75)
        expect(apple[1].product).toBeNull()
        // Un plan sin producto en esa tienda no se ofrece
        expect(mergePlans(rows, 'GOOGLE', []).map(p => p.plan)).toEqual(['MONTHLY'])
    })

    it('traduce los errores del complemento nativo', () => {
        expect(toStoreError({ code: 'USER_CANCELLED', message: 'x' }).code).toBe('USER_CANCELLED')
        expect(toStoreError({ code: 'UNIMPLEMENTED' }).code).toBe('BILLING_UNAVAILABLE')
        expect(toStoreError(new Error('boom')).code).toBe('UNKNOWN')
        const same = new StoreError('PENDING')
        expect(toStoreError(same)).toBe(same)
    })

    it('no muestra aviso cuando el usuario cancela y nombra la tienda correcta', () => {
        expect(storeErrorMessage('USER_CANCELLED', 'APPLE')).toBeNull()
        expect(storeErrorMessage('NETWORK', 'APPLE')).toContain('App Store')
        expect(storeErrorMessage('NETWORK', 'GOOGLE')).toContain('Google Play')
        expect(storeErrorMessage('VERIFY_PENDING', 'GOOGLE')).toContain('Restaurar compras')
        expect(storeErrorMessage('UNKNOWN', null)).toBeTruthy()
    })
})
