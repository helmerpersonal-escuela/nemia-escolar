/** Criterios con los que cada escuela detecta riesgo e interpreta el diagnóstico y la encuesta socioemocional. */
export interface Criteria {
    /** Promedio por materia debajo del cual se cuenta como reprobatorio. */
    risk_min_average: number
    /** Incidencias de conducta, dentro de `risk_conduct_days`, que encienden la señal. */
    risk_conduct_count: number
    risk_conduct_days: number
    /** Faltas, dentro de `risk_absence_days`, que encienden la señal. */
    risk_absences: number
    risk_absence_days: number
    /** Diagnóstico (% de aciertos): desde aquí es «esperado»; debajo de `diag_support`, «requiere apoyo». */
    diag_expected: number
    diag_support: number
    /** Encuesta (promedio de 1 a 4): desde aquí es «esperado»; debajo de `socio_support`, «requiere apoyo». */
    socio_expected: number
    socio_support: number
}

export const DEFAULT_CRITERIA: Criteria = {
    risk_min_average: 6, risk_conduct_count: 3, risk_conduct_days: 60, risk_absences: 4, risk_absence_days: 30,
    diag_expected: 80, diag_support: 60, socio_expected: 3, socio_support: 2.2,
}

/** Lo guardado por la escuela sobre los valores de fábrica (si falta algo o viene mal, queda el de fábrica). */
export function asCriteria(row: unknown): Criteria {
    const out = { ...DEFAULT_CRITERIA }
    if (row && typeof row === 'object') {
        for (const k of Object.keys(out) as (keyof Criteria)[]) {
            const v = Number((row as Record<string, unknown>)[k])
            if (Number.isFinite(v) && (row as Record<string, unknown>)[k] != null) out[k] = v
        }
    }
    return out
}

/** Por qué no se pueden guardar unos criterios (vacío = están bien). */
export function criteriaProblems(c: Criteria): string[] {
    const p: string[] = []
    const between = (v: number, min: number, max: number, what: string) => { if (!Number.isFinite(v) || v < min || v > max) p.push(`${what} debe estar entre ${min} y ${max}.`) }
    between(c.risk_min_average, 1, 10, 'El promedio mínimo')
    between(c.risk_conduct_count, 1, 20, 'El número de incidencias')
    between(c.risk_conduct_days, 7, 365, 'Los días para contar incidencias')
    between(c.risk_absences, 1, 60, 'El número de faltas')
    between(c.risk_absence_days, 7, 365, 'Los días para contar faltas')
    between(c.diag_expected, 1, 100, 'El porcentaje esperado del diagnóstico')
    between(c.diag_support, 0, 99, 'El porcentaje de apoyo del diagnóstico')
    between(c.socio_expected, 1, 4, 'El promedio esperado de la encuesta')
    between(c.socio_support, 1, 4, 'El promedio de apoyo de la encuesta')
    if (c.diag_support >= c.diag_expected) p.push('En el diagnóstico, «requiere apoyo» debe quedar por debajo de «esperado».')
    if (c.socio_support >= c.socio_expected) p.push('En la encuesta, «requiere apoyo» debe quedar por debajo de «esperado».')
    return p
}

export const sameCriteria = (a: Criteria, b: Criteria) => (Object.keys(a) as (keyof Criteria)[]).every(k => a[k] === b[k])
