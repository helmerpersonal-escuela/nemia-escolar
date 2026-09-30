/**
 * Reconoce los formatos que usan las escuelas (listas de asistencia por grupo, directorios de
 * padres, horarios en Word, comisiones, PEMC, concentrados de calificaciones…) y los convierte
 * en datos que VUNLEK entiende. No depende de nombres de archivo: mira el contenido.
 */
import { normalizePhone } from '../../../lib/phones'
import { cleanName, normName, splitSurnamesFirst } from './names'
import type { DocxBlock, Sheet } from './readers'
import type { Day, Extracted, Gender, PClass, PPemcAction, PStaff } from './types'

// ─────────────────────────── utilidades ───────────────────────────

const N = (s: unknown) => normName(s)
const has = (row: string[], word: string) => row.some(c => N(c).includes(word))

/** "1°A", "3A", "2o A", "3° B", "1 ° -A" → "1A" */
export function groupKeyOf(label: string): string | null {
    const m = String(label).toUpperCase().replace(/\s+/g, ' ').match(/([1-6])\s*(?:°|º|O|ER|DO|RO|TO)?\s*[-\s]*"?([A-Z])"?\s*$/)
    return m ? m[1] + m[2] : null
}

export function genderOf(v: string): Gender | null {
    const s = N(v)
    if (['H', 'HOMBRE', 'M ASC', 'MASCULINO', 'MASC', 'NINO', 'V'].includes(s)) return 'HOMBRE'
    if (['M', 'MUJER', 'F', 'FEMENINO', 'FEM', 'NINA'].includes(s)) return 'MUJER'
    return null
}

/** Encuentra teléfonos dentro de un texto libre: "961-931-2741 wasap", "965 115 2380 / 961 123 4567". */
export function extractPhones(text: string): { ok: string[]; bad: string[] } {
    const ok: string[] = [], bad: string[] = []
    const runs = String(text ?? '').match(/\+?\d[\d\s\-.()]{5,}\d/g) ?? []
    for (const run of runs) {
        let d = run.replace(/\D/g, '')
        const pushOne = (x: string) => {
            const n = normalizePhone(x)
            if (n.length === 10) ok.push(n)
            else bad.push(run.trim())
        }
        if (d.length === 20) { pushOne(d.slice(0, 10)); pushOne(d.slice(10)); continue }
        if (d.length === 22 && d.startsWith('52')) d = d.slice(2)
        pushOne(d)
    }
    return { ok: [...new Set(ok)], bad }
}

/** "7:00 - 7:50" → ["07:00","07:50"] */
export function parseTimeRange(s: string): [string, string] | null {
    const m = String(s).match(/(\d{1,2})[:.](\d{2})\s*(?:-|–|a)\s*(\d{1,2})[:.](\d{2})/)
    if (!m) return null
    const f = (h: string, mi: string) => `${h.padStart(2, '0')}:${mi}`
    return [f(m[1], m[2]), f(m[3], m[4])]
}
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

const DAYS: Record<string, Day> = { LU: 'MONDAY', MA: 'TUESDAY', MI: 'WEDNESDAY', JU: 'THURSDAY', VI: 'FRIDAY', SA: 'SATURDAY' }
const dayOf = (s: string): Day | null => DAYS[N(s).slice(0, 2)] ?? null

const MONTHS: Record<string, number> = { ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6, JULIO: 7, AGOSTO: 8, SEPTIEMBRE: 9, SETIEMBRE: 9, OCTUBRE: 10, NOVIEMBRE: 11, DICIEMBRE: 12 }
/** "26 de septiembre de 2026" → "2026-09-26" */
export function parseSpanishDate(s: string): string | null {
    const t = String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ')
    const m = t.match(/(\d{1,2}) DE ([A-Z]+)(?: DE(?:L)?)? (\d{4})/)
    if (!m || !MONTHS[m[2]]) return null
    return `${m[3]}-${String(MONTHS[m[2]]).padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

function headerIndex(rows: string[][], words: string[], maxScan = 15): number {
    for (let i = 0; i < Math.min(rows.length, maxScan); i++) if (words.every(w => has(rows[i] ?? [], w))) return i
    return -1
}
const colOf = (row: string[], word: string, from = 0) => row.findIndex((c, i) => i >= from && N(c).includes(word))

function addStaff(ex: Extracted, s: Omit<PStaff, 'sources' | 'duties' | 'subjects' | 'groups'> & Partial<PStaff>, source: string) {
    const full = cleanName(s.full).replace(/^(PROFRA?|PROF|MTRA?|MTRO|LIC|ING|DRA?|DOC|C)\s+/, '')
    if (normName(full).split(' ').length < 2) return
    ex.staff.push({ full, functionLabel: s.functionLabel, subjects: s.subjects ?? [], groups: s.groups ?? [], hours: s.hours, duties: s.duties ?? [], sources: [source] })
}

const cycleOf = (text: string) => text.match(/(20\d{2})\s*[-–]\s*(20\d{2}|\d{2})/)?.slice(1, 3).map((y, i) => (i === 1 && y.length === 2 ? '20' + y : y)).join('-')

/** CURP válida (18 caracteres) o undefined. */
export function curpOf(v: unknown): string | undefined {
    const c = String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    return /^[A-Z]{4}\d{6}[HMX][A-Z]{5}[A-Z0-9]\d$/.test(c) ? c : undefined
}
export const curpGender = (curp?: string): Gender | null => (curp?.[10] === 'H' ? 'HOMBRE' : curp?.[10] === 'M' ? 'MUJER' : null)

const CODE_WORDS = new Set(['APREN', 'EPS', 'CPS', 'FGS', 'MHR', 'DER', 'DEA', 'BAP', 'USAER', 'TDAH'])
/**
 * Las listas a veces traen claves al final del nombre, separadas con varios espacios
 * ("PEREZ LOPEZ JUAN      AL, RP."). Se separan para no guardarlas como parte del nombre.
 */
export function splitStudentAnnotation(raw: string): { name: string; note?: string } {
    const text = String(raw ?? '').replace(/\u00a0/g, ' ').trim()
    const m = text.match(/^(.*\S)\s{2,}([A-ZÑ.,\s]{1,16})$/)
    if (!m) return { name: text }
    const tokens = m[2].split(/[\s,]+/).filter(Boolean)
    const isCode = (t: string) => { const letters = t.replace(/\./g, ''); return (letters.length <= 3 && /^[A-ZÑ]+$/.test(letters)) || (t.includes('.') && letters.length <= 5) || CODE_WORDS.has(letters) }
    if (tokens.length && tokens.every(isCode)) return { name: m[1].trim(), note: m[2].trim().replace(/\s+/g, ' ') }
    return { name: text }
}

// ─────────────────────────── Excel ───────────────────────────

export function parseWorkbook(sheets: Sheet[], fileName: string, ex: Extracted) {
    const found: string[] = [], ignored: string[] = []
    let listSheets = 0, dirSheets = 0
    for (const sh of sheets) {
        const src = `${fileName} › ${sh.name}`
        const rows = sh.rows
        const nameU = N(sh.name)
        const gk = groupKeyOf(sh.name)
        const alumnoHdr = headerIndex(rows, ['NOMBRE DEL ALUMNO'])

        // Metadatos (CCT, zona, ciclo) en los encabezados
        for (const r of rows.slice(0, 6)) {
            const line = r.join(' ')
            const cct = line.match(/\b(\d{2}[A-Z]{3}\d{4}[A-Z])\b/)?.[1]
            const zone = line.match(/ZONA(?: ESCOLAR)?:?\s*(\d{1,3})/i)?.[1]
            const cycle = /CICLO/i.test(line) ? cycleOf(line) : undefined
            if (cct || zone || cycle) ex.meta.push({ cct, zone, cycle })
        }

        if (gk && alumnoHdr >= 0 && has(rows[alumnoHdr], 'TELEFONO')) {
            // Directorio de padres: alumno + tutor + teléfonos (a veces varios renglones por alumno)
            const hdr = rows[alumnoHdr]
            const cAl = colOf(hdr, 'NOMBRE DEL ALUMNO')
            const cTut = hdr.findIndex(c => /PADRE|MADRE|TUTOR/.test(N(c)) && !/FIRMA/.test(N(c)))
            const cTel = hdr.map((c, i) => (/TELEFONO|CEL/.test(N(c)) ? i : -1)).filter(i => i >= 0)
            const known = new Set([0, cAl, cTut, ...cTel, colOf(hdr, 'SEXO'), colOf(hdr, 'GDO'), ...hdr.map((c, i) => (N(c).includes('FIRMA') ? i : -1))])
            let cur: { studentFull: string; tutorFull: string; tels: string[]; notes: string[] } | null = null
            const flush = () => {
                if (!cur || !cur.studentFull) return
                const all = extractPhones(cur.tels.join(' / '))
                ex.guardians.push({ groupKey: gk, studentFull: cur.studentFull, tutorFull: cur.tutorFull, phones: all.ok, badPhones: all.bad, note: cur.notes.join('; ') || undefined, source: src })
            }
            for (const r of rows.slice(alumnoHdr + 1)) {
                const isNew = /^\d+$/.test(String(r[0] ?? '').trim()) && (r[cAl] ?? '').trim()
                const sameAsCurrent = cur && normName(r[cAl]) === normName(cur.studentFull)
                if (isNew && !sameAsCurrent) { flush(); cur = { studentFull: splitStudentAnnotation(r[cAl]).name, tutorFull: (r[cTut] ?? '').trim(), tels: [], notes: [] } }
                if (!cur) continue
                for (const c of cTel) if (r[c]) cur.tels.push(r[c])
                r.forEach((v, i) => { if (!known.has(i) && v && !/^\d+$/.test(v) && v.length > 3 && !cur!.notes.includes(v)) cur!.notes.push(v) })
            }
            flush()
            dirSheets++
            continue
        }

        if (gk && alumnoHdr >= 0) {
            // Lista del grupo: número, nombre, sexo
            const hdr = rows[alumnoHdr]
            const cAl = colOf(hdr, 'NOMBRE DEL ALUMNO')
            const cSx = colOf(hdr, 'SEXO')
            const cCurp = colOf(hdr, 'CURP')
            let n = 0
            for (const r of rows.slice(alumnoHdr + 1)) {
                if (!/^\d+$/.test(String(r[0] ?? '').trim())) continue
                const { name: full, note } = splitStudentAnnotation(r[cAl] ?? '')
                if (normName(full).split(' ').length < 2) continue
                const parts = splitSurnamesFirst(full)
                const curp = cCurp >= 0 ? curpOf(r[cCurp]) : undefined
                ex.students.push({ groupKey: gk, full: cleanName(full), ...parts, gender: cSx >= 0 ? genderOf(r[cSx]) : curpGender(curp), curp, source: src })
                if (note) ex.history.push({ kind: 'NOTA', studentName: cleanName(full), groupKey: gk, data: { text: note, origin: 'Clave junto al nombre en la lista' }, source: src })
                n++
            }
            if (n) listSheets++
            continue
        }

        const curpHdr = headerIndex(rows, ['CURP'])
        if (!gk && curpHdr >= 0 && (has(rows[curpHdr], 'NOMBRE') || has(rows[curpHdr], 'ALUMNO') || has(rows[curpHdr], 'PATERNO') || has(rows[curpHdr], 'APELLIDO'))) {
            // Exportación del sistema de control escolar: grado, grupo, nombre (o apellidos) y CURP
            const hr = rows[curpHdr]
            const cC = colOf(hr, 'CURP'), cGr = colOf(hr, 'GRADO'), cGp = hr.findIndex(c => /^GRUPO|^GPO/.test(N(c)))
            const pick = (...ws: string[]) => hr.findIndex(c => ws.some(w => N(c).includes(w)))
            const cPat = pick('PATERNO', 'PRIMER APELLIDO'), cMat = pick('MATERNO', 'SEGUNDO APELLIDO'), cNom = hr.findIndex(c => /^NOMBRE/.test(N(c)))
            let n = 0
            for (const r of rows.slice(curpHdr + 1)) {
                const curp = curpOf(r[cC])
                if (!curp) continue
                const key = groupKeyOf(`${cGr >= 0 ? r[cGr] : ''}${cGp >= 0 ? r[cGp] : ''}`.replace(/\s+/g, ''))
                const full = cPat >= 0 ? [r[cPat], r[cMat], r[cNom]].filter(Boolean).join(' ') : (r[cNom] ?? '')
                if (!key || normName(full).split(' ').length < 2) continue
                ex.students.push({ groupKey: key, full: cleanName(full), ...splitSurnamesFirst(full), gender: curpGender(curp), curp, source: src })
                n++
            }
            if (n) { found.push(`CURP de alumnos (${n})`); continue }
        }

        if (nameU === 'PERSONAL') {
            const h = headerIndex(rows, ['NOMBRE'])
            const cN = colOf(rows[h] ?? [], 'NOMBRE'), cF = colOf(rows[h] ?? [], 'FUNCION')
            let n = 0
            for (const r of rows.slice(h + 1)) {
                if (!r[cN] || !/^\d+$/.test(String(r[0] ?? '').trim())) continue
                addStaff(ex, { full: r[cN], functionLabel: (r[cF] ?? '').trim() || undefined }, src); n++
            }
            found.push(`Personal (${n})`); continue
        }

        if (nameU === 'DOCENTES') {
            const h = headerIndex(rows, ['NOMBRE', 'ASIGNATURA'])
            const hr = rows[h] ?? []
            const cN = colOf(hr, 'NOMBRE'), cA = colOf(hr, 'ASIGNATURA'), cG = colOf(hr, 'GRUPOS')
            let last = ''
            for (const r of rows.slice(h + 1)) {
                const name = (r[cN] ?? '').trim() || last
                if (!name || !r[cA]) continue
                last = name
                const groups = r.slice(cG).join(',').split(/[,\s]+/).map(groupKeyOf).filter(Boolean) as string[]
                addStaff(ex, { full: name, subjects: [r[cA].trim()], groups }, src)
            }
            found.push('Asignaturas por docente'); continue
        }

        if (nameU === 'TOTAL') {
            const h = headerIndex(rows, ['GRUPO', 'TECNOLOGIA'])
            const hr = rows[h] ?? []
            const cG = colOf(hr, 'GRUPO'), cT = colOf(hr, 'TECNOLOGIA'), cA = colOf(hr, 'ASESOR')
            for (const r of rows.slice(h + 1)) {
                const k = groupKeyOf(r[cG] ?? '')
                if (!k || !/^\s*[1-6]\s*[A-Z]\s*$/i.test(r[cG] ?? '')) continue
                const advisors = [r[cA], r[cA + 1]].map(x => (x ?? '').trim()).filter(x => normName(x).split(' ').length >= 2)
                ex.groupInfo.push({ groupKey: k, technology: (r[cT] ?? '').trim() || undefined, advisors })
            }
            found.push('Tecnología y asesores por grupo'); continue
        }

        if (nameU.startsWith('EF Y PROMEDIOS') || nameU === 'PROMEDIOS') {
            const h = headerIndex(rows, ['GRUPO', 'NOMBRE'])
            const hr = rows[h] ?? []
            const cG = colOf(hr, 'GRUPO'), cN = colOf(hr, 'NOMBRE')
            const cT = [colOf(hr, '1RO'), colOf(hr, '2DO'), colOf(hr, '3RO'), colOf(hr, 'FINAL')]
            let n = 0
            for (const r of rows.slice(h + 1)) {
                if (!r[cN] || normName(r[cN]).split(' ').length < 2) continue
                const val = (i: number) => (i >= 0 ? (r[i] ?? '').trim() : '')
                ex.history.push({ kind: 'PROMEDIOS', studentName: cleanName(r[cN]), groupKey: groupKeyOf(r[cG] ?? '') ?? undefined, data: { t1: val(cT[0]), t2: val(cT[1]), t3: val(cT[2]), final: val(cT[3]) }, source: src })
                n++
            }
            found.push(`Promedios de un ciclo anterior (${n})`); continue
        }

        if (nameU.includes('EXTRAORDINARIO') || nameU === 'IRREGULARES') {
            let n = 0
            for (const r of rows) {
                // Bloques "grupo | nombre | adeudos" en cualquier posición de la fila
                for (let i = 0; i < r.length - 2; i++) {
                    const k = groupKeyOf(r[i] ?? '')
                    if (!k || !/^\s*[1-6]\s*[A-Z]\s*$/i.test(r[i] ?? '')) continue
                    const name = r[i + 1] ?? ''
                    if (normName(name).split(' ').length < 2) continue
                    const owed = (r[i + 2] ?? '').trim()
                    const status = r.slice(i + 3).find(x => /EGRESA|REGULAR|IRREGULAR/.test(N(x)))
                    ex.history.push({ kind: 'ADEUDO', studentName: cleanName(name), groupKey: k, data: { subjects: /^\d+$/.test(owed) ? undefined : owed || undefined, count: /^\d+$/.test(owed) ? Number(owed) : undefined, status }, source: src })
                    n++
                    i += 2
                }
            }
            found.push(`Alumnos con materias adeudadas (${n})`); continue
        }

        if (nameU.includes('BAJAS') || nameU.includes('ALTAS')) {
            let n = 0
            for (const r of rows) {
                for (let i = 0; i < r.length - 3; i++) {
                    const k = groupKeyOf(r[i] ?? '')
                    if (!k || !/^\s*[1-6]\s*[A-Z]\s*$/i.test(r[i] ?? '')) continue
                    const name = r[i + 1] ?? ''
                    if (normName(name).split(' ').length < 2) continue
                    const date = (r[i + 3] ?? '').slice(0, 10)
                    const tipo = (r[i + 4] ?? '').trim()
                    const kind = i > 5 ? 'ALTA' : 'BAJA'
                    ex.history.push({ kind, studentName: cleanName(name), groupKey: k, data: { date, type: tipo, report: (r[i + 5] ?? '').trim() || undefined }, source: src })
                    n++
                    i += 4
                }
            }
            found.push(`Bajas y altas (${n})`); continue
        }

        if (sh.rows.some(r => r.some(c => c))) ignored.push(sh.name)
    }
    if (listSheets) found.unshift(`Listas de alumnos (${listSheets} grupos)`)
    if (dirSheets) found.unshift(`Directorio de padres y teléfonos (${dirSheets} grupos)`)
    ex.files.push({ name: fileName, kind: 'xlsx', found, ignored })
}

// ─────────────────────────── Word ───────────────────────────

const tables = (blocks: DocxBlock[]) => blocks.filter((b): b is Extract<DocxBlock, { type: 'table' }> => b.type === 'table')
const paras = (blocks: DocxBlock[]) => blocks.filter((b): b is Extract<DocxBlock, { type: 'p' }> => b.type === 'p').map(b => b.text)

/** Horario por grupo: tablas cuyo primer renglón es el grupo y la primera columna son horas. */
function parseGroupSchedules(blocks: DocxBlock[], src: string, ex: Extracted): number {
    let n = 0
    const slotMap = new Map<string, { start: string; end: string; isBreak: boolean }>()
    for (const t of tables(blocks)) {
        const gk = groupKeyOf(t.rows[0]?.[0] ?? '')
        const dayRow = t.rows.findIndex(r => r.filter(c => dayOf(c)).length >= 5)
        if (!gk || dayRow < 0 || !/^\s*[1-6]\s*°?\s*[A-Z]\s*$/.test(t.rows[0][0])) continue
        const days = t.rows[dayRow].map(dayOf)
        n++
        for (const r of t.rows.slice(dayRow + 1)) {
            const range = parseTimeRange(r[0] ?? '')
            if (!range) continue
            const filled = r.slice(1).filter(c => c.trim())
            const isBreak = filled.length > 0 && filled.every(c => /RECESO|RECREO|DESCANSO/.test(c.toUpperCase().replace(/\s/g, '')))
            slotMap.set(range.join('-'), { start: range[0], end: range[1], isBreak })
            if (isBreak) continue
            r.forEach((c, i) => {
                const day = days[i]
                if (i === 0 || !day || !c.trim()) return
                const [subject, ...rest] = c.split(/\n|\//).map(x => x.trim()).filter(Boolean)
                ex.classes.push({ groupKey: gk, day, start: range[0], end: range[1], subject, teacher: rest.join(' ').trim(), source: src })
            })
        }
    }
    if (n) {
        // Orden y corrección de recesos mal escritos (p. ej. "9:00 - 9:30" entre 8:40–9:30 y 10:00)
        const slots = [...slotMap.values()].sort((a, b) => toMin(a.start) - toMin(b.start) || (a.isBreak ? 1 : -1))
        const lessons = slots.filter(s => !s.isBreak).sort((a, b) => toMin(a.start) - toMin(b.start))
        for (const b of slots.filter(s => s.isBreak)) {
            const before = lessons.filter(l => toMin(l.end) <= toMin(b.end) + 30 && toMin(l.start) < toMin(b.start) + 30).pop()
            const after = lessons.find(l => toMin(l.start) >= toMin(before?.end ?? b.start))
            if (before && after && (toMin(b.start) < toMin(before.end) || toMin(b.end) !== toMin(after.start))) {
                const fixed = { start: before.end, end: after.start }
                if (toMin(fixed.end) > toMin(fixed.start)) {
                    ex.issues.push({ severity: 'info', area: 'Jornada', message: `El receso decía ${b.start}–${b.end}; se tomó ${fixed.start}–${fixed.end} (entre la clase de ${before.start} y la de ${after.start}).`, source: src })
                    b.start = fixed.start; b.end = fixed.end
                }
            }
        }
        ex.slots.push(...slots)
    }
    return n
}

/** Horario por docente: "PROF. NOMBRE   DOCENTE DE: MATERIA 1A, 2B   24 HORAS" */
function parseTeacherLoads(blocks: DocxBlock[], src: string, ex: Extracted): number {
    let n = 0
    let current: PStaff | null = null
    for (const b of blocks) {
        if (b.type !== 'p') continue
        const t = b.text
        const m = t.match(/^(?:PROFRA?\.?|PROF\.?|MTRA?\.?|MTRO\.?|LIC\.?|ING\.?|DOC\.?)?\s*(.+?)\s*\t+\s*DOCENTE DE:?\s*\t*\s*(.*)$/i)
        const line = m ? m[2] : (current && /\b\d+\s*HORAS?\b/i.test(t) && !/TOTAL/i.test(t) ? t : null)
        if (m) {
            addStaff(ex, { full: m[1] }, src)
            current = ex.staff[ex.staff.length - 1]
            n++
        }
        if (line && current) {
            const hours = Number(line.match(/(\d+)\s*HORAS?/i)?.[1] ?? 0)
            const body = line.replace(/\d+\s*HORAS?/i, '').trim()
            const groups = (body.match(/\b[1-6]\s*°?\s*[A-F]\b/g) ?? []).map(g => groupKeyOf(g)!).filter(Boolean)
            const subject = body.replace(/\b[1-6]\s*°?\s*[A-F]\b[,\s]*/g, '').replace(/[,\s]+$/, '').trim()
            if (subject) current.subjects.push(subject)
            current.groups.push(...groups)
            current.hours = (current.hours ?? 0) + hours
        }
    }
    return n
}

function parseCommissions(blocks: DocxBlock[], src: string, ex: Extracted): number {
    let n = 0
    for (const t of tables(blocks)) {
        for (let i = 0; i < t.rows.length - 1; i++) {
            const titles = t.rows[i], bodies = t.rows[i + 1]
            if (!bodies.some(c => /PRESIDENTE|SECRETARI|VOCAL|INTEGRANTE/.test(N(c)))) continue
            titles.forEach((title, j) => {
                const body = bodies[j] ?? ''
                if (!title.trim() || !/PRESIDENTE|SECRETARI|VOCAL|INTEGRANTE|TESORER/.test(N(body))) return
                if (j > 0 && titles[j - 1] === title && bodies[j - 1] === body) return // celda combinada
                const members: { role: string; name: string }[] = []
                for (const part of body.split(/\n/)) {
                    const line = part.trim()
                    if (!line) continue
                    let role = '', names = ''
                    const colon = line.lastIndexOf(':')
                    if (colon >= 0) { role = line.slice(0, colon); names = line.slice(colon + 1) }
                    else {
                        const m = line.match(/^(PRESIDENTE|PRESIDENTA|SECRETARI[OA]|TESORER[OA]|VOCAL(?:ES)?(?:\s*\d+)?|COORDINADOR[A]?|INTEGRANTES?)\s+(.+)$/i)
                        if (m) { role = m[1]; names = m[2] }
                        else if (members.length) { role = members[members.length - 1].role; names = line }
                    }
                    role = role.replace(/[.:]+/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase()
                    for (const name of names.replace(/^[\s.:]+/, '').split(/,| Y /)) if (normName(name).split(' ').length >= 2) members.push({ role: role || 'INTEGRANTE', name: cleanName(name) })
                }
                if (members.length) { ex.commissions.push({ name: title.trim().toUpperCase(), members }); n++ }
            })
            i++
        }
    }
    for (const c of ex.commissions) for (const m of c.members) {
        addStaff(ex, { full: m.name, duties: [`${m.role.charAt(0)}${m.role.slice(1).toLowerCase()} de ${c.name.toLowerCase()}`] }, src)
    }
    return n
}

/** Programa escolar de mejora continua: datos de la escuela, fechas de CTE y matriz de problemas priorizados. */
function parseSchoolProgram(blocks: DocxBlock[], src: string, ex: Extracted) {
    const found: string[] = []
    for (const t of tables(blocks)) {
        const first = N(t.rows[0]?.[0] ?? '')
        // Ficha de la escuela (2 columnas: dato | valor)
        if (t.rows.length >= 3 && t.rows.every(r => r.length >= 2) && t.rows.some(r => N(r[0]) === 'CCT')) {
            const get = (k: string) => t.rows.find(r => N(r[0]).startsWith(k))?.[1]?.trim()
            ex.meta.push({ schoolName: get('ESCUELA'), cct: get('CCT'), zone: get('ZONA')?.match(/\d+/)?.[0], shift: get('TURNO'), location: get('UBICACION'), director: get('DIRECTOR'), cycle: cycleOf(get('CICLO') ?? '') })
            found.push('Datos de la escuela')
            continue
        }
        // Calendario de sesiones de CTE
        if (has(t.rows[0] ?? [], 'SESION') && t.rows.some(r => r.some(c => parseSpanishDate(c)))) {
            for (const r of t.rows) {
                const num = Number(r[0]); const date = r.map(parseSpanishDate).find(Boolean)
                if (num && date) {
                    const extra = r.slice(2).filter(c => c && c !== '—' && c !== '-').join(' · ')
                    ex.cte.push({ number: num, date, note: extra || undefined })
                }
            }
            if (ex.cte.length) found.push(`Calendario de CTE (${ex.cte.length} sesiones)`)
            continue
        }
        // Ficha de un problema priorizado (Problema/Objetivo/Meta/Acciones/Responsable/Recursos/Seguimiento)
        if (first.startsWith('PROBLEMA PRIORIZADO') || t.rows.some(r => N(r[0]) === 'OBJETIVO')) {
            const get = (k: string) => t.rows.find(r => N(r[0]).startsWith(k))?.slice(1).find(Boolean)?.trim()
            const objective = get('OBJETIVO')
            if (!objective) continue
            const areaIdx = blocks.indexOf(t)
            const area = [...blocks.slice(0, areaIdx)].reverse().find(b => b.type === 'p' && /^AMBITO/i.test(N(b.text))) as { text: string } | undefined
            const actionsText = get('ACCIONES') ?? ''
            const actions: PPemcAction[] = actionsText.split(/\s*(?:^|\n|\s)\d+\)\s*/).map(s => s.trim()).filter(s => s.length > 3)
                .map(description => ({ description, responsible: get('RESPONSABLE'), resources: get('RECURSOS'), stage: 'Programa escolar' }))
            ex.pemcObjectives.push({ area: area?.text.replace(/^ÁMBITO\s*\d+\s*[·.:-]\s*/i, '').trim(), problem: get('PROBLEMA'), objective, goal: get('META'), indicator: get('SEGUIMIENTO'), actions, source: src })
        }
    }
    const nObj = ex.pemcObjectives.filter(o => o.source === src).length
    if (nObj) found.push(`Problemas priorizados del PEMC (${nObj})`)
    return found
}

/** PEMC por etapas (preparativos, diagnóstico, desarrollo y evaluación). */
function parsePemcProject(blocks: DocxBlock[], src: string, ex: Extracted) {
    const found: string[] = []
    const ps = paras(blocks)
    const title = ps.find(p => /NOMBRE DEL PROYECTO/i.test(p))?.replace(/^.*NOMBRE DEL PROYECTO:?\s*/i, '').trim()
    const problem = ps.find(p => /PROBLEM[AÁ]TICA ESCOLAR/i.test(p))?.replace(/^.*PROBLEM[AÁ]TICA ESCOLAR:?\s*/i, '').trim()
    if (title) ex.pemcTitle = title + (problem ? ` (problemática: ${problem.toLowerCase()})` : '')
    let stage = ''
    for (const b of blocks) {
        if (b.type === 'p') { const m = b.text.match(/^ETAPA\s*(\d+)\s*:?\s*(.*)$/i); if (m) stage = `Etapa ${m[1]}: ${m[2].trim().toLowerCase()}`; continue }
        const hdr = b.rows[0]?.map(N) ?? []
        const ci = (w: string) => hdr.findIndex(h => h.startsWith(w))
        if (ci('ACTIVIDAD') >= 0 && ci('ETAPA') >= 0) {
            // Etapa de preparativos: actividades con % de logro
            const actions = b.rows.slice(1).filter(r => r[ci('ACTIVIDAD')]).map(r => ({
                description: r[ci('ACTIVIDAD')].replace(/^[•\s]+/, ''), resources: r[ci('RECURSOS')], responsible: r[ci('RESPONSABLE')],
                period: r[ci('FECHA')], progress: r[ci('% DE LOGRO')] ?? r[hdr.length - 1], stage: r[ci('ETAPA')] || stage,
            }))
            ex.pemcObjectives.push({ area: 'Preparativos', objective: stage || 'Preparativos del ciclo', actions, source: src })
            found.push(`${stage || 'Preparativos'} (${actions.length} actividades)`)
        } else if (ci('AMBITO') >= 0 && ci('INSUMOS') >= 0) {
            for (const r of b.rows.slice(1)) if (r[0]) ex.pemcDiagnosis.push({ area: r[0].replace(/^[a-h]\.\s*/i, '').trim(), content: [r[1] && `Insumos: ${r[1]}`, r[2] && `Observaciones: ${r[2]}`].filter(Boolean).join('\n') })
            found.push('Diagnóstico por ámbito')
        } else if (ci('AMBITO') >= 0 && ci('ACCIONES') >= 0) {
            let n = 0
            let lastArea = ''
            for (const r of b.rows.slice(1)) {
                if (r[ci('AMBITO')]?.trim()) lastArea = r[ci('AMBITO')].trim()
                const objective = r[ci('OBJETIVO')]?.trim()
                if (!objective) continue
                ex.pemcObjectives.push({
                    area: lastArea, problem: r[ci('PROBLEMATICA')], objective, goal: r[ci('META')],
                    actions: [{ description: r[ci('ACCIONES')] || objective, responsible: r[ci('RESPONSABLE')], period: r[ci('FECHAS')], resources: r[ci('RECURSOS')], stage: stage || 'Desarrollo' }],
                    source: src,
                }); n++
            }
            found.push(`${stage || 'Desarrollo'} (${n} acciones)`)
        }
    }
    return found
}

export function parseDocument(blocks: DocxBlock[], fileName: string, ex: Extracted) {
    const text = N(paras(blocks).join(' ')).slice(0, 4000)
    const found: string[] = [], ignored: string[] = []
    for (const p of paras(blocks).slice(0, 12)) {
        const cct = p.match(/\b(\d{2}[A-Z]{3}\d{4}[A-Z])\b/)?.[1]
        const zone = p.match(/ZONA(?: ESCOLAR)?:?\s*(\d{1,3})/i)?.[1]
        if (cct || zone) ex.meta.push({ cct, zone, cycle: cycleOf(p) })
    }
    const nGroups = parseGroupSchedules(blocks, fileName, ex)
    if (nGroups) found.push(`Horario de ${nGroups} grupos`)
    if (paras(blocks).some(p => /DOCENTE DE:/i.test(p))) {
        const n = parseTeacherLoads(blocks, fileName, ex)
        if (n) found.push(`Carga horaria de ${n} docentes`)
    }
    if (/COMISIONES/.test(text) || tables(blocks).some(t => t.rows.some(r => r.some(c => /PRESIDENTE/.test(N(c)))))) {
        const n = parseCommissions(blocks, fileName, ex)
        if (n) found.push(`Comisiones (${n})`)
    }
    if (tables(blocks).some(t => t.rows.some(r => N(r[0]) === 'CCT' || N(r[0]).startsWith('PROBLEMA PRIORIZADO')) || (has(t.rows[0] ?? [], 'SESION') && t.rows.some(r => r.some(c => parseSpanishDate(c)))))) {
        found.push(...parseSchoolProgram(blocks, fileName, ex))
    }
    if (paras(blocks).some(p => /^ETAPA\s*\d/i.test(p))) found.push(...parsePemcProject(blocks, fileName, ex))
    if (/PROGRAMA ANALITICO/.test(text) && !found.length) ignored.push('Programa analítico (súbelo en Programa analítico; no se importa automáticamente)')
    if (!found.length && !ignored.length) ignored.push('No se reconoció el contenido')
    ex.files.push({ name: fileName, kind: 'docx', found, ignored })
}

/** Subjects como vienen en horarios: "MATEMATICAS 1", "FORMACION CIVICA E 1", "CIENCIAS (BIOLOGÍA)". */
export function cleanSubjectLabel(s: string): string {
    let x = normName(s.replace(/\(([^)]+)\)/, ' $1 '))
    x = x.replace(/\b(I{1,3}|[1-3])\b$/, '').replace(/\bE\s*$/, '').trim()
    if (x.startsWith('CIENCIAS ')) x = x.replace(/^CIENCIAS\s+/, '')
    return x
}

export const TECH_WORDS = ['AGRICULTURA', 'PECUARIA', 'GANADERIA', 'APICULTURA', 'PCIA', 'P C I A', 'CONSERVACION', 'INDUSTRIALIZACION', 'ESTRUCTURAS METALICAS', 'SOLDADURA', 'INFORMATICA', 'CARPINTERIA', 'ELECTRICIDAD', 'ELECTRONICA', 'CONFECCION', 'VESTIDO', 'DISENO', 'CONTABILIDAD', 'SECRETARIADO', 'OFIMATICA', 'COMPUTACION', 'TURISMO', 'ALIMENTOS', 'PESCA', 'ACUACULTURA', 'SILVICULTURA', 'MECANICA', 'DIBUJO', 'TECNOLOGIA']
export const isTechnology = (label: string) => { const x = cleanSubjectLabel(label); return TECH_WORDS.some(w => x.includes(w)) }

export { toMin, fromMin }
export type { PClass }
