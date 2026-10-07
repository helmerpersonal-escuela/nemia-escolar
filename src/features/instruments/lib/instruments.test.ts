import { describe, expect, it } from 'vitest'
import { scoreStudent, summarizeGroup, SOCIO_TEMPLATE, type Item } from './instruments'

const diag: Item[] = [
    { id: 'a', text: 'Suma de fracciones', topic: 'Fracciones' },
    { id: 'b', text: 'Resta de fracciones', topic: 'Fracciones' },
    { id: 'c', text: 'Perímetro', topic: 'Geometría' },
    { id: 'd', text: 'Área', topic: 'Geometría' },
    { id: 'e', text: 'Ángulos', topic: 'Geometría' },
]
const socio: Item[] = [
    { id: 'p', text: 'Me calmo', topic: 'Autorregulación' },
    { id: 'q', text: 'Me arrepiento', topic: 'Autorregulación', reverse: true },
    { id: 'r', text: 'Trabajo en equipo', topic: 'Colaboración' },
]

describe('diagnóstico', () => {
    it('saca el porcentaje de aciertos y el nivel por tema', () => {
        const s = scoreStudent('DIAGNOSTICO', diag, { a: 1, b: 1, c: 0, d: 0, e: 1 })!
        expect(s.value).toBe(60); expect(s.level).toBe('DESARROLLO')
        expect(s.byTopic).toEqual([
            { topic: 'Fracciones', value: 100, level: 'ESPERADO', answered: 2 },
            { topic: 'Geometría', value: 33, level: 'APOYO', answered: 3 },
        ])
    })
    it('no inventa resultado si no se capturó nada, y calcula sobre lo contestado', () => {
        expect(scoreStudent('DIAGNOSTICO', diag, {})).toBeNull()
        expect(scoreStudent('DIAGNOSTICO', diag, { a: 1, b: 0 })!.value).toBe(50)
    })
    it('resume al grupo: niveles, tema más bajo primero y reactivos más difíciles', () => {
        const g = summarizeGroup('DIAGNOSTICO', diag, [{ a: 1, b: 1, c: 1, d: 1, e: 1 }, { a: 1, b: 1, c: 0, d: 0, e: 0 }, {}])
        expect(g.captured).toBe(2)
        expect(g.levels).toEqual({ APOYO: 1, DESARROLLO: 0, ESPERADO: 1 })
        expect(g.average).toBe(70)
        expect(g.topics[0]).toMatchObject({ topic: 'Geometría', value: 50, support: 1 })
        expect(g.hardest[0].pct).toBe(50)
    })
})

describe('encuesta socioemocional', () => {
    it('invierte los reactivos en negativo', () => {
        // «Siempre me arrepiento» (4) cuenta como 1
        const s = scoreStudent('SOCIOEMOCIONAL', socio, { p: 4, q: 4, r: 4 })!
        expect(s.byTopic[0]).toMatchObject({ topic: 'Autorregulación', value: 2.5, level: 'DESARROLLO' })
        expect(s.value).toBe(3); expect(s.level).toBe('ESPERADO')
    })
    it('marca «requiere apoyo» con promedios bajos', () => {
        expect(scoreStudent('SOCIOEMOCIONAL', socio, { p: 1, q: 4, r: 2 })!.level).toBe('APOYO')
    })
    it('la encuesta base cubre las cinco dimensiones con cuatro reactivos cada una', () => {
        const count = new Map<string, number>()
        for (const i of SOCIO_TEMPLATE) count.set(i.topic, (count.get(i.topic) ?? 0) + 1)
        expect([...count.values()]).toEqual([4, 4, 4, 4, 4])
    })
})
