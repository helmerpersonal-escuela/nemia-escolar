import { describe, expect, it } from 'vitest'
import { dayKey, nowAndNext, slotsOfTeacher, type Assignment, type Slot } from './teacherSchedule'

const slot = (id: string, group: string, subject: string | null, day: string, start: string, end: string, custom: string | null = null): Slot =>
    ({ id, group_id: group, subject_id: subject, custom_subject: custom, day_of_week: day, start_time: start, end_time: end })
const assignments: Assignment[] = [
    { group_id: 'g1', subject_catalog_id: 'mat', custom_name: null, teacher_id: 'ana' },
    { group_id: 'g2', subject_catalog_id: 'mat', custom_name: null, teacher_id: 'luis' },
    { group_id: 'g2', subject_catalog_id: null, custom_name: 'Taller de Robótica', teacher_id: 'ana' },
]
const slots = [
    slot('3', 'g2', null, 'MONDAY', '09:50:00', '10:40:00', 'taller de robótica'),
    slot('1', 'g1', 'mat', 'MONDAY', '07:00:00', '07:50:00'),
    slot('2', 'g2', 'mat', 'MONDAY', '07:00:00', '07:50:00'),
    slot('4', 'g1', 'mat', 'TUESDAY', '07:00:00', '07:50:00'),
]
// 5 de octubre de 2026 es lunes
const at = (h: number, m: number, day = 5) => new Date(2026, 9, day, h, m)

describe('horario del docente', () => {
    it('toma solo sus clases, también las de materia con nombre propio, en orden', () => {
        expect(slotsOfTeacher(slots, assignments, 'ana').map(x => x.slot.id)).toEqual(['1', '4', '3'])
        expect(slotsOfTeacher(slots, assignments, 'luis').map(x => x.slot.id)).toEqual(['2'])
    })
    it('dice qué clase da en este momento y cuál sigue', () => {
        const mine = slotsOfTeacher(slots, assignments, 'ana')
        expect(dayKey(at(7, 10))).toBe('MONDAY')
        const a = nowAndNext(mine, at(7, 10))
        expect(a.current?.slot.id).toBe('1'); expect(a.next?.slot.id).toBe('3')
        const b = nowAndNext(mine, at(8, 0))
        expect(b.current).toBeNull(); expect(b.next?.slot.id).toBe('3')
    })
    it('la clase termina justo a su hora de salida y no hay nada después de la última', () => {
        const mine = slotsOfTeacher(slots, assignments, 'ana')
        expect(nowAndNext(mine, at(7, 50)).current).toBeNull()
        expect(nowAndNext(mine, at(11, 0))).toEqual({ current: null, next: null })
        expect(nowAndNext(mine, at(7, 10, 7))).toEqual({ current: null, next: null })
    })
})
