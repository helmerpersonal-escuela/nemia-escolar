import { describe, expect, it } from 'vitest'
import { toLocalISODate } from '../lib/dates'

describe('fechas locales', () => {
    it('usa el día del dispositivo, no UTC (caso 20:30 en México)', () => {
        // 20:30 local del 24 de septiembre: en UTC ya sería 25.
        const d = new Date(2026, 8, 24, 20, 30)
        expect(toLocalISODate(d)).toBe('2026-09-24')
    })
    it('rellena mes y día con cero', () => {
        expect(toLocalISODate(new Date(2027, 0, 5))).toBe('2027-01-05')
    })
})
