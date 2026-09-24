/**
 * Fechas "de calendario" en la zona horaria del dispositivo.
 *
 * `new Date().toISOString().split('T')[0]` usa UTC: en México, después de las
 * 18:00 (o 17:00 en horario de verano) devolvía la fecha del DÍA SIGUIENTE, y la
 * asistencia, incidencias o citatorios quedaban registrados con fecha equivocada.
 */
export function toLocalISODate(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

export function todayISO(): string {
    return toLocalISODate(new Date())
}
