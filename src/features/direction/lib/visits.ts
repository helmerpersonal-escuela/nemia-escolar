/**
 * Visita áulica de acompañamiento (Nueva Escuela Mexicana): indicadores de base, registro de hechos
 * y cálculo de alumnos en riesgo. En la visita se anota lo que se vio y se oyó, no opiniones.
 */
export type Observed = 'OBSERVADO' | 'PARCIAL' | 'NO_OBSERVADO' | 'NO_APLICA'
export interface Indicator { id: string; area: string; text: string; source: 'BASE' | 'ESCUELA' | 'AUTORIDAD' }
export interface IndicatorRecord extends Indicator { observed: Observed | null; fact: string }

export const OBSERVED_LABEL: Record<Observed, string> = { OBSERVADO: 'Se observó', PARCIAL: 'Se observó en parte', NO_OBSERVADO: 'No se observó', NO_APLICA: 'No correspondía a esta sesión' }
export const VISIT_STATUS: Record<string, string> = { PROGRAMADA: 'Programada', REALIZADA: 'Realizada, falta retroalimentar', RETROALIMENTADA: 'Con acuerdos en seguimiento', CERRADA: 'Cerrada' }
export const LOG_KIND: Record<string, string> = { REUNION_FAMILIA: 'Reunión con familia', ATENCION: 'Atención en la oficina', SEGUIMIENTO_DOCENTE: 'Seguimiento a docente', SEGUIMIENTO_ALUMNO: 'Seguimiento a alumno' }
export const AREAS: Record<string, string> = { DIRECCION: 'Dirección', SUBDIRECCION: 'Subdirección', COORDINACION: 'Coordinación' }

const base = (area: string, texts: string[]): Indicator[] => texts.map((text, i) => ({ id: `${area.slice(0, 3).toLowerCase()}${i + 1}`, area, text, source: 'BASE' }))

export const BASE_INDICATORS: Indicator[] = [
    ...base('Planeación y programa analítico', [
        'La sesión corresponde a la planeación didáctica entregada.',
        'El contenido y el proceso de desarrollo de aprendizaje (PDA) trabajados son los del programa analítico de la escuela.',
        'Se comunica al grupo qué se va a aprender y para qué.',
    ]),
    ...base('Metodología y actividades', [
        'El trabajo parte de una situación o problema del contexto de las y los alumnos.',
        'Se trabaja con una metodología sociocrítica (proyectos comunitarios, indagación STEAM, aprendizaje basado en problemas o aprendizaje servicio).',
        'Las actividades piden a las y los alumnos investigar, producir o resolver, no solo copiar o escuchar.',
        'Se relaciona lo trabajado con otros campos formativos o con algún eje articulador.',
    ]),
    ...base('Participación de las y los estudiantes', [
        'Las y los alumnos hacen preguntas o dan su opinión durante la sesión.',
        'Hay momentos de trabajo en equipo o entre pares.',
        'Participan alumnos distintos, no siempre los mismos.',
    ]),
    ...base('Inclusión y ambiente del aula', [
        'Hay ajustes o apoyos para alumnos que enfrentan barreras para el aprendizaje y la participación.',
        'El trato entre docente y alumnos, y entre alumnos, es respetuoso.',
        'El acomodo del salón permite que todas y todos vean, escuchen y participen.',
    ]),
    ...base('Evaluación formativa', [
        'Se revisa lo que el grupo ya sabe antes de avanzar.',
        'Las y los alumnos reciben comentarios sobre su trabajo durante la sesión.',
        'Se usa algún instrumento o registro (rúbrica, lista de cotejo, observación) para dar seguimiento.',
    ]),
    ...base('Recursos y tiempo', [
        'Se usan los libros de texto gratuitos u otros materiales al alcance del grupo.',
        'La sesión inicia y termina en el horario, con inicio, desarrollo y cierre.',
    ]),
]

/** Indicadores de una visita nueva: los de base más los que agregó la escuela, aún sin llenar. */
export const blankRecords = (own: Indicator[]): IndicatorRecord[] => [...BASE_INDICATORS, ...own].map(i => ({ ...i, observed: null, fact: '' }))

export function visitSummary(records: IndicatorRecord[]) {
    const filled = records.filter(r => r.observed)
    const applicable = filled.filter(r => r.observed !== 'NO_APLICA')
    const count = (o: Observed) => filled.filter(r => r.observed === o).length
    const areas = [...new Set(records.map(r => r.area))].map(area => {
        const list = applicable.filter(r => r.area === area)
        return { area, total: list.length, observed: list.filter(r => r.observed === 'OBSERVADO').length, partial: list.filter(r => r.observed === 'PARCIAL').length }
    }).filter(a => a.total > 0)
    return {
        total: records.length, filled: filled.length,
        observed: count('OBSERVADO'), partial: count('PARCIAL'), notObserved: count('NO_OBSERVADO'), notApplicable: count('NO_APLICA'),
        withFact: filled.filter(r => r.fact.trim()).length,
        areas,
    }
}

// Palabras que califican en vez de describir. Solo se avisa; el directivo decide.
const JUDGMENTS = ['excelente', 'excelentes', 'pesimo', 'pesima', 'deficiente', 'deficientes', 'mediocre', 'flojo', 'floja', 'mal', 'mala', 'malo', 'bien', 'buena', 'bueno', 'buen', 'aburrido', 'aburrida', 'desordenado', 'desordenada', 'irresponsable', 'incapaz', 'no sabe', 'no domina', 'no le interesa', 'descuidado', 'descuidada', 'pobre', 'inadecuado', 'inadecuada', 'adecuado', 'adecuada', 'perfecto', 'perfecta']
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Palabras del texto que suenan a juicio y no a hecho observado. */
export function judgmentWords(text: string): string[] {
    const t = ` ${plain(text).replace(/[^a-zñ ]/g, ' ').replace(/\s+/g, ' ')} `
    return JUDGMENTS.filter(w => t.includes(` ${w} `))
}

// ── Alumnos en riesgo
export interface RiskRow { student_id: string; failing: number; failing_subjects: string[]; conduct: number; severe: number; absences: number }
export interface RiskCase { studentId: string; reasons: { kind: 'ACADEMICO' | 'CONDUCTA' | 'ASISTENCIA' | 'SOCIOEMOCIONAL' | 'DIAGNOSTICO'; text: string }[]; score: number }

/** Junta las señales de riesgo de un alumno y las ordena de mayor a menor urgencia. */
export function buildRiskCases(rows: RiskRow[], socioSupport: Record<string, string[]>, diagSupport: Record<string, string[]>): RiskCase[] {
    const ids = new Set([...rows.map(r => r.student_id), ...Object.keys(socioSupport), ...Object.keys(diagSupport)])
    const out: RiskCase[] = []
    for (const id of ids) {
        const r = rows.find(x => x.student_id === id)
        const reasons: RiskCase['reasons'] = []
        let score = 0
        if (r?.failing) { reasons.push({ kind: 'ACADEMICO', text: `Promedio reprobatorio en ${r.failing} materia${r.failing === 1 ? '' : 's'}: ${r.failing_subjects.join(', ')}` }); score += 2 + r.failing }
        if (r && (r.conduct >= 3 || r.severe > 0)) { reasons.push({ kind: 'CONDUCTA', text: [r.severe ? `${r.severe} incidencia${r.severe === 1 ? '' : 's'} grave${r.severe === 1 ? '' : 's'} en seguimiento` : '', r.conduct >= 3 ? `${r.conduct} incidencias de conducta en 60 días` : ''].filter(Boolean).join(' · ') }); score += 2 + r.severe * 2 }
        if (r && r.absences >= 4) { reasons.push({ kind: 'ASISTENCIA', text: `${r.absences} faltas en los últimos 30 días` }); score += r.absences >= 8 ? 3 : 2 }
        const socio = socioSupport[id]
        if (socio?.length) { reasons.push({ kind: 'SOCIOEMOCIONAL', text: `Encuesta socioemocional: requiere apoyo en ${socio.join(', ')}` }); score += 2 + (socio.length > 2 ? 1 : 0) }
        const diag = diagSupport[id]
        if (diag?.length) { reasons.push({ kind: 'DIAGNOSTICO', text: `Diagnóstico: requiere apoyo en ${diag.join(', ')}` }); score += 1 }
        if (reasons.length) out.push({ studentId: id, reasons, score: score + (reasons.length > 1 ? reasons.length : 0) })
    }
    return out.sort((a, b) => b.score - a.score)
}
