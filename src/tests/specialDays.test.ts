import { describe, it, expect } from 'vitest'
import { buildSlots, adjustClasses, proposeDuration, type SpecialDay } from '../lib/specialDays'

const standard = { start_time: '07:00', end_time: '14:10', module_duration: 50, breaks: [{ name: 'Receso', start_time: '09:30', end_time: '10:00' }] }
const classes = [
    { id: 'a', start_time: '07:00:00', end_time: '07:50:00' },
    { id: 'b', start_time: '07:50', end_time: '08:40' },
    { id: 'c', start_time: '10:00', end_time: '10:50' },
    { id: 'd', start_time: '13:20', end_time: '14:10' },
]

describe('días con horario especial', () => {
    it('arma los módulos saltando el receso', () => {
        const s = buildSlots('07:00', '14:10', 50, standard.breaks)
        expect(s[0]).toEqual({ start: '07:00', end: '07:50' })
        expect(s[2]).toEqual({ start: '08:40', end: '09:30' })
        expect(s[3]).toEqual({ start: '10:00', end: '10:50' })
        expect(s).toHaveLength(8)
    })
    it('propone la duración para que quepan todas las clases', () => {
        expect(proposeDuration(standard, '07:00', '12:00', [])).toBe(37) // 300 min / 8 clases
        // Con el receso de siempre (09:30–10:00) deben seguir cabiendo las 8
        const d = proposeDuration(standard, '07:00', '12:00', standard.breaks)!
        expect(buildSlots('07:00', '12:00', d, standard.breaks).length).toBeGreaterThanOrEqual(8)
        expect(buildSlots('07:00', '12:00', d + 1, standard.breaks).length).toBeLessThan(8)
    })
    it('acorta: cada clase pasa a su módulo corto', () => {
        const sp: SpecialDay = { id: '1', name: 'Festival', target_date: '2026-10-01', end_date: '2026-10-01', mode: 'SHORTENED', start_time: '07:00', end_time: '12:00', module_duration: 35, breaks: [] }
        const r = adjustClasses(classes, sp, standard)
        expect(r.map(c => [c.id, c.start_time, c.end_time, c.status])).toEqual([
            ['a', '07:00', '07:35', 'shortened'],
            ['b', '07:35', '08:10', 'shortened'],
            ['c', '08:45', '09:20', 'shortened'],   // era el 4º módulo
            ['d', '11:05', '11:40', 'shortened'],   // era el 8º módulo
        ])
    })
    it('si no alcanza el tiempo, la clase se suspende', () => {
        const sp: SpecialDay = { id: '1', name: 'Junta', target_date: '2026-10-01', end_date: '2026-10-01', mode: 'SHORTENED', start_time: '07:00', end_time: '09:00', module_duration: 40 }
        const r = adjustClasses(classes, sp, standard)
        expect(r.find(c => c.id === 'd')?.status).toBe('cancelled')
    })
    it('bloquea solo las horas indicadas', () => {
        const sp: SpecialDay = { id: '1', name: 'Honores', target_date: '2026-10-01', end_date: '2026-10-03', mode: 'BLOCKED', blocked_ranges: [{ start: '07:00', end: '08:00', label: 'Acto cívico' }] }
        const r = adjustClasses(classes, sp, standard)
        expect(r.map(c => c.status)).toEqual(['cancelled', 'shortened', 'normal', 'normal'])
        expect(r[0].reason).toBe('Acto cívico')
        expect([r[1].start_time, r[1].end_time]).toEqual(['08:00', '08:40'])
    })
    it('sin clases suspende todo', () => {
        const sp: SpecialDay = { id: '1', name: 'CTE', target_date: '2026-10-01', end_date: '2026-10-01', mode: 'NO_CLASSES' }
        expect(adjustClasses(classes, sp, standard).every(c => c.status === 'cancelled')).toBe(true)
    })
})
