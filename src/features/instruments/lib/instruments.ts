/**
 * Examen diagnóstico y encuesta socioemocional de la escuela: reactivos, captura e interpretación.
 * La interpretación sigue reglas fijas y visibles (no usa inteligencia artificial).
 */
import { DEFAULT_CRITERIA, type Criteria } from '../../../lib/criteria'

export type InstrumentKind = 'DIAGNOSTICO' | 'SOCIOEMOCIONAL'
export interface Item {
    id: string
    text: string
    /** Tema (diagnóstico) o dimensión (socioemocional): con esto se agrupa la interpretación. */
    topic: string
    /** Respuesta correcta, solo para imprimir la clave del diagnóstico. */
    answer?: string
    /** Reactivo en negativo de la encuesta: «Siempre» cuenta como lo menos favorable. */
    reverse?: boolean
}
/** Diagnóstico: 1 acierto, 0 error. Encuesta: 1 a 4. Sin dato: el reactivo no se contestó. */
export type Answers = Record<string, number>
export type Level = 'APOYO' | 'DESARROLLO' | 'ESPERADO'

export const LEVEL_LABEL: Record<Level, string> = { APOYO: 'Requiere apoyo', DESARROLLO: 'En desarrollo', ESPERADO: 'Esperado' }
export const SCALE = ['Nunca', 'A veces', 'Casi siempre', 'Siempre']
export const newItemId = () => Math.random().toString(36).slice(2, 9)

export const SOCIO_DIMENSIONS = ['Autoconocimiento', 'Autorregulación', 'Autonomía', 'Empatía', 'Colaboración']

/** Encuesta base, por las cinco dimensiones de la educación socioemocional. La escuela la puede editar. */
export const SOCIO_TEMPLATE: Omit<Item, 'id'>[] = [
    { topic: 'Autoconocimiento', text: 'Puedo decir con palabras cómo me siento.' },
    { topic: 'Autoconocimiento', text: 'Sé en qué cosas soy bueno o buena.' },
    { topic: 'Autoconocimiento', text: 'Me siento a gusto con mi forma de ser.' },
    { topic: 'Autoconocimiento', text: 'Me cuesta trabajo saber qué me pasa cuando estoy mal.', reverse: true },
    { topic: 'Autorregulación', text: 'Cuando me enojo, logro calmarme antes de actuar.' },
    { topic: 'Autorregulación', text: 'Termino mis tareas aunque me cuesten trabajo.' },
    { topic: 'Autorregulación', text: 'Puedo esperar mi turno sin desesperarme.' },
    { topic: 'Autorregulación', text: 'Hago o digo cosas de las que después me arrepiento.', reverse: true },
    { topic: 'Autonomía', text: 'Tomo decisiones pensando en lo que puede pasar después.' },
    { topic: 'Autonomía', text: 'Pido ayuda cuando la necesito.' },
    { topic: 'Autonomía', text: 'Me organizo para cumplir con mis responsabilidades.' },
    { topic: 'Autonomía', text: 'Siento que puedo lograr lo que me propongo.' },
    { topic: 'Empatía', text: 'Me doy cuenta cuando un compañero o compañera está triste.' },
    { topic: 'Empatía', text: 'Respeto a las personas aunque piensen distinto que yo.' },
    { topic: 'Empatía', text: 'Ayudo a quien lo necesita sin que me lo pidan.' },
    { topic: 'Empatía', text: 'Me siento parte de mi grupo.' },
    { topic: 'Colaboración', text: 'Trabajo bien en equipo.' },
    { topic: 'Colaboración', text: 'Escucho las ideas de los demás antes de dar la mía.' },
    { topic: 'Colaboración', text: 'Resuelvo los problemas con mis compañeros platicando.' },
    { topic: 'Colaboración', text: 'En mi casa hay alguien con quien puedo hablar de lo que me pasa.' },
]

const round1 = (n: number) => Math.round(n * 10) / 10

/** Valor del reactivo ya orientado: en la encuesta, 4 siempre es lo más favorable. */
const oriented = (item: Item, v: number) => item.reverse ? 5 - v : v

export const answeredCount = (items: Item[], answers: Answers) => items.filter(i => typeof answers[i.id] === 'number').length

export const diagnosticLevel = (pct: number, c: Criteria = DEFAULT_CRITERIA): Level => pct >= c.diag_expected ? 'ESPERADO' : pct >= c.diag_support ? 'DESARROLLO' : 'APOYO'
/** Promedio de 1 a 4. */
export const socioLevel = (avg: number, c: Criteria = DEFAULT_CRITERIA): Level => avg >= c.socio_expected ? 'ESPERADO' : avg >= c.socio_support ? 'DESARROLLO' : 'APOYO'

/** Explicación de los niveles con los criterios de la escuela, para mostrarla junto a los resultados. */
export const levelRules = (kind: InstrumentKind, c: Criteria = DEFAULT_CRITERIA) => kind === 'DIAGNOSTICO'
    ? `Niveles: esperado ${c.diag_expected}% o más de aciertos, en desarrollo de ${c.diag_support} a ${c.diag_expected - 1}%, requiere apoyo menos de ${c.diag_support}%.`
    : `Niveles sobre el promedio de 1 a 4: esperado ${c.socio_expected.toFixed(1)} o más, en desarrollo desde ${c.socio_support.toFixed(1)}, requiere apoyo menos de ${c.socio_support.toFixed(1)}. Es una señal para acercarse al alumno, no un diagnóstico clínico.`

export interface TopicScore { topic: string; value: number; level: Level; answered: number }
export interface Score { value: number; level: Level; answered: number; total: number; byTopic: TopicScore[] }

/**
 * Resultado de un alumno. Diagnóstico: porcentaje de aciertos sobre lo contestado.
 * Encuesta: promedio de 1 a 4. Devuelve null si no hay ningún reactivo capturado.
 */
export function scoreStudent(kind: InstrumentKind, items: Item[], answers: Answers, c: Criteria = DEFAULT_CRITERIA): Score | null {
    const done = items.filter(i => typeof answers[i.id] === 'number')
    if (!done.length) return null
    const calc = (list: Item[]) => kind === 'DIAGNOSTICO'
        ? Math.round((list.reduce((a, i) => a + (answers[i.id] ? 1 : 0), 0) / list.length) * 100)
        : round1(list.reduce((a, i) => a + oriented(i, answers[i.id]), 0) / list.length)
    const level = (v: number) => kind === 'DIAGNOSTICO' ? diagnosticLevel(v, c) : socioLevel(v, c)
    const topics = [...new Set(items.map(i => i.topic || 'General'))]
    const byTopic = topics.map(topic => {
        const list = done.filter(i => (i.topic || 'General') === topic)
        if (!list.length) return null
        const value = calc(list)
        return { topic, value, level: level(value), answered: list.length }
    }).filter((t): t is TopicScore => !!t)
    const value = calc(done)
    return { value, level: level(value), answered: done.length, total: items.length, byTopic }
}

export interface GroupSummary {
    captured: number
    levels: Record<Level, number>
    average: number | null
    /** Temas o dimensiones del más bajo al más alto: por dónde empezar. */
    topics: { topic: string; value: number; level: Level; support: number }[]
    /** Reactivos con menos aciertos (solo diagnóstico). */
    hardest: { text: string; pct: number }[]
}

export function summarizeGroup(kind: InstrumentKind, items: Item[], results: Answers[], c: Criteria = DEFAULT_CRITERIA): GroupSummary {
    const scores = results.map(a => scoreStudent(kind, items, a, c)).filter((s): s is Score => !!s)
    const levels: Record<Level, number> = { APOYO: 0, DESARROLLO: 0, ESPERADO: 0 }
    for (const s of scores) levels[s.level]++
    const level = (v: number) => kind === 'DIAGNOSTICO' ? diagnosticLevel(v, c) : socioLevel(v, c)
    const topicNames = [...new Set(items.map(i => i.topic || 'General'))]
    const topics = topicNames.map(topic => {
        const vals = scores.map(s => s.byTopic.find(t => t.topic === topic)).filter((t): t is TopicScore => !!t)
        if (!vals.length) return null
        const value = kind === 'DIAGNOSTICO' ? Math.round(vals.reduce((a, t) => a + t.value, 0) / vals.length) : round1(vals.reduce((a, t) => a + t.value, 0) / vals.length)
        return { topic, value, level: level(value), support: vals.filter(t => t.level === 'APOYO').length }
    }).filter((t): t is NonNullable<typeof t> => !!t).sort((a, b) => a.value - b.value)
    const hardest = kind !== 'DIAGNOSTICO' ? [] : items.map(i => {
        const got = results.filter(a => typeof a[i.id] === 'number')
        return got.length ? { text: i.text, pct: Math.round((got.filter(a => a[i.id]).length / got.length) * 100) } : null
    }).filter((h): h is { text: string; pct: number } => !!h).sort((a, b) => a.pct - b.pct).slice(0, 5)
    return {
        captured: scores.length, levels,
        average: scores.length ? (kind === 'DIAGNOSTICO' ? Math.round(scores.reduce((a, s) => a + s.value, 0) / scores.length) : round1(scores.reduce((a, s) => a + s.value, 0) / scores.length)) : null,
        topics, hardest,
    }
}

export const formatScore = (kind: InstrumentKind, value: number) => kind === 'DIAGNOSTICO' ? `${value}%` : `${value.toFixed(1)} de 4`
