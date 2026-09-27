import {
    amountInWords, annualTotals, budgetTotals, docLabel, fundTotals, money, num, partnerName, returnTotals, rowAmount, semesterTotals,
    SHIFT_LABEL, DEFAULT_HEADER_LINES, MONTHS,
    type AnnualData, type BudgetData, type CoopContext, type CoopDocument, type FundData, type Partner, type PlanData, type ReturnData, type SemesterData,
} from './types'

/**
 * Modelo neutro de un formato oficial. Lo consumen el generador de PDF y el de Excel,
 * así ambos salen idénticos.
 */
export interface FormatColumn { label: string; width?: number; align?: 'left' | 'right' | 'center' }
export interface FormatTable { title?: string; columns: FormatColumn[]; rows: (string | number)[][]; footer?: (string | number)[] }
export interface FormatModel {
    title: string
    subtitle?: string
    headerLines: string[]
    meta: [string, string][]
    tables: FormatTable[]
    summary?: [string, string][]
    notes?: string[]
    signatures: string[]
    landscape?: boolean
    status?: string
    fileName: string
}

const fmtDate = (iso?: string) => {
    if (!iso) return ''
    const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()
}
const m = (v: unknown) => money(num(v))
const safe = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/_+/g, '_').slice(0, 80)

/** Encabezado común: escuela, CCT, turno, ciclo, cooperativa y clave. */
function commonMeta(ctx: CoopContext, extra: [string, string][] = []): [string, string][] {
    return [
        ['Escuela', ctx.school.name],
        ['CCT', ctx.school.cct],
        ['Turno', SHIFT_LABEL[ctx.school.shift] ?? ctx.school.shift ?? ''],
        ['Ciclo escolar', ctx.cycle.name],
        ['Cooperativa', ctx.coop.name],
        ['Clave de registro', ctx.coop.registration_key],
        ...extra,
    ]
}

const board = (ctx: CoopContext) => ctx.coop.board ?? {}
const sig = (role: string, name?: string) => (name ? `${name}\n${role}` : role)

export function buildDocumentModel(doc: CoopDocument, ctx: CoopContext): FormatModel {
    const d = doc.data ?? {}
    const teacher = doc.teacher?.full_name || ctx.teacher.name
    const b = board(ctx)
    const headerLines = ctx.coop.header_lines?.length ? ctx.coop.header_lines : DEFAULT_HEADER_LINES
    const unitName = ctx.unit?.name ?? ''
    const base = { headerLines, status: doc.status }
    const fname = (x: string) => `${safe(x)}_${safe(ctx.cycle.name)}`

    switch (doc.doc_type) {
        case 'PLAN_ANUAL': {
            const p = d as PlanData
            const rows = (p.rows ?? []).filter(r => r.project)
            return {
                ...base, title: 'PLAN ANUAL DE PRODUCCIÓN ESCOLAR', landscape: true, fileName: fname('Plan_anual'),
                meta: commonMeta(ctx, [['Docente', teacher], ['Énfasis tecnológico', unitName], ['Matrícula', String(ctx.enrollment)], ['Lugar', p.place], ['Fecha', fmtDate(p.date)]]),
                tables: [
                    {
                        title: 'Proyectos y metas',
                        columns: [{ label: 'NP', width: 4, align: 'center' }, { label: 'Proyecto', width: 20 }, { label: 'Meta (propuesta inicial)', width: 14 }, { label: 'Grado', width: 6, align: 'center' },
                            { label: 'Horas frente a grupo', width: 8, align: 'center' }, { label: 'Inicio', width: 10 }, { label: 'Término', width: 10 }, { label: 'Financiamiento', width: 10 }],
                        rows: rows.map((r, i) => [i + 1, r.project, r.goal, r.grade, r.hours === '' ? '' : r.hours, fmtDate(r.start), fmtDate(r.end), r.financing]),
                    },
                    {
                        title: 'Insumos y mano de obra',
                        columns: [{ label: 'NP', width: 4, align: 'center' }, { label: 'Proyecto', width: 20 }, { label: 'Insumos', width: 38 }, { label: 'Mano de obra', width: 38 }],
                        rows: rows.map((r, i) => [i + 1, r.project, r.inputs, r.labor]),
                    },
                    {
                        title: 'Cronograma',
                        columns: [{ label: 'Proyecto', width: 23 }, ...MONTHS.map(mo => ({ label: mo, width: 7, align: 'center' as const }))],
                        rows: rows.map(r => [r.project, ...MONTHS.map(mo => (r.months ?? []).includes(mo) ? 'X' : '')]),
                    },
                ],
                notes: [p.notes, 'Los proyectos productivos deben ser afines a la naturaleza del énfasis tecnológico y con resultados de acuerdo al número de horas.'].filter(Boolean),
                signatures: [sig('DOCENTE', teacher), sig('COORDINADOR DE ACT. TECNOLÓGICAS', b.coordinador), sig('PRESIDENTE COOP. ESCOLAR', b.presidente), sig('TESORERO COOP. ESCOLAR', b.tesorero), sig('DIRECTOR DE LA ESCUELA', b.director || ctx.school.director)],
            }
        }
        case 'PRESUPUESTO': {
            const p = d as BudgetData
            const t = budgetTotals(p)
            const exp = (p.expenses ?? []).filter(r => r.concept)
            const rec = (p.recoveries ?? []).filter(r => r.concept)
            const summary: [string, string][] = [['Ingresos estimados', money(t.ingresos)], ['Egresos estimados', money(t.egresos)], ['Utilidad estimada', money(t.utilidad)]]
            if (t.realUtilidad != null) summary.push(['Ingresos reales', money(t.realIngresos!)], ['Egresos reales', money(t.realEgresos!)], ['Utilidad real', money(t.realUtilidad)], ['Variación', money(t.realUtilidad - t.utilidad)])
            return {
                ...base, title: `PRESUPUESTO No. ${p.number || '01'}`, fileName: fname(`Presupuesto_${p.number || '01'}_${p.project || ''}`),
                meta: commonMeta(ctx, [['Unidad de producción', p.unitName || unitName], ['Proyecto', p.project], ['Fecha de inicio', fmtDate(p.startDate)], ['Fecha de terminación', fmtDate(p.endDate)], ['Docente', teacher]]),
                tables: [
                    {
                        title: 'Egresos',
                        columns: [{ label: 'NP', width: 6, align: 'center' }, { label: 'Concepto de egreso', width: 40 }, { label: 'Unidad', width: 12 }, { label: 'Cantidad', width: 12, align: 'right' }, { label: 'Precio unitario', width: 15, align: 'right' }, { label: 'Importe', width: 15, align: 'right' }],
                        rows: exp.map((r, i) => [i + 1, r.concept, r.unit, num(r.qty), m(r.price), money(rowAmount(r))]),
                        footer: ['', 'TOTAL', '', '', '', money(t.egresos)],
                    },
                    {
                        title: 'Recuperaciones (ingresos)',
                        columns: [{ label: 'NP', width: 6, align: 'center' }, { label: 'Producto', width: 40 }, { label: 'Unidad', width: 12 }, { label: 'Cantidad', width: 12, align: 'right' }, { label: 'Precio de venta', width: 15, align: 'right' }, { label: 'Importe', width: 15, align: 'right' }],
                        rows: rec.map((r, i) => [i + 1, r.concept, r.unit, num(r.qty), m(r.price), money(rowAmount(r))]),
                        footer: ['', 'TOTAL', '', '', '', money(t.ingresos)],
                    },
                ],
                summary,
                notes: ['Los docentes que no cumplan su meta por descuido o negligencia se verán obligados a cubrir lo programado en su presupuesto.'],
                signatures: [sig('PRESIDENTE C. ADMÓN.', b.presidente), sig('TESORERO C. ADMÓN.', b.tesorero), sig('TITULAR DE LA ASIGNATURA', teacher), sig('COORDINADOR', b.coordinador), sig('DIRECTOR', b.director || ctx.school.director)],
            }
        }
        case 'INFORME_SEMESTRAL': {
            const p = d as SemesterData
            const t = semesterTotals(p)
            const rows = (p.rows ?? []).filter(r => r.project)
            return {
                ...base, title: 'INFORME SEMESTRAL DE AVANCE DEL PLAN ANUAL DE PRODUCCIÓN ESCOLAR', landscape: true, fileName: fname(`Informe_semestral_${p.semester}`),
                meta: commonMeta(ctx, [['Docente', teacher], ['Asignatura tecnológica', unitName], ['Semestre', p.semester], ['Total horas frente a grupo', String(p.hours ?? '')], ['Tipo de financiamiento', p.financing], ['Lugar', p.place], ['Fecha', fmtDate(p.date)]]),
                tables: [{
                    columns: [{ label: 'Proyecto', width: 20 }, { label: 'Meta (propuesta inicial)', width: 14 }, { label: 'Avance del semestre', width: 14 }, { label: '% avance físico', width: 8, align: 'right' },
                        { label: 'Ingresos', width: 10, align: 'right' }, { label: 'Egresos', width: 10, align: 'right' }, { label: 'Saldo', width: 10, align: 'right' }, { label: 'Observaciones', width: 14 }],
                    rows: rows.map(r => [r.project, r.goal, r.achieved, r.physicalPct === '' ? '' : `${num(r.physicalPct)}%`, m(r.income), m(r.expense), money(num(r.income) - num(r.expense)), r.observations]),
                    footer: ['TOTAL', '', '', `${t.physical}%`, money(t.income), money(t.expense), money(t.balance), ''],
                }],
                summary: [['Avance físico promedio', `${t.physical}%`], ['Avance financiero (saldo)', money(t.balance)]],
                signatures: [sig('DOCENTE', teacher), sig('COORDINADOR', b.coordinador), sig('DIRECTOR DE LA ESCUELA', b.director || ctx.school.director)],
            }
        }
        case 'INFORME_ANUAL': {
            const p = d as AnnualData
            const t = annualTotals(p)
            const rows = (p.rows ?? []).filter(r => r.project)
            const dist = p.distribution ?? { social: 40, repartible: 40, reserva: 20 }
            return {
                ...base, title: 'INFORME FINAL DEL PLAN ANUAL DE PRODUCCIÓN ESCOLAR', landscape: true, fileName: fname('Informe_anual'),
                meta: commonMeta(ctx, [['Docente', teacher], ['Asignatura tecnológica', unitName], ['Total horas frente a grupo', String(p.hours ?? '')], ['Tipo de financiamiento', p.financing], ['Lugar', p.place], ['Fecha', fmtDate(p.date)]]),
                tables: [{
                    columns: [{ label: 'Proyecto', width: 22 }, { label: 'Presup. núm.', width: 7, align: 'center' }, { label: 'Meta propuesta', width: 14 }, { label: 'Resultado final', width: 14 },
                        { label: 'Ingresos', width: 12, align: 'right' }, { label: 'Egresos', width: 12, align: 'right' }, { label: 'Utilidades', width: 12, align: 'right' }],
                    rows: rows.map(r => [r.project, r.budgetNo, r.goal, r.result, m(r.income), m(r.expense), money(num(r.income) - num(r.expense))]),
                    footer: ['TOTAL', '', '', '', money(t.income), money(t.expense), money(t.bruta)],
                }],
                summary: [
                    ['Total utilidad bruta', money(t.bruta)], ['Amortización', m(p.amortization)], ['Utilidad neta', money(t.neta)],
                    [`${num(dist.social)}% Fondo social`, money(t.social)], [`${num(dist.repartible)}% Fondo repartible`, money(t.repartible)], [`${num(dist.reserva)}% Fondo de reserva`, money(t.reserva)],
                    ['Total distribuido', money(t.social + t.repartible + t.reserva)],
                ],
                notes: ['Este informe se debe entregar cualquiera que sea su financiamiento.'],
                signatures: [sig('DOCENTE', teacher), sig('COORDINADOR', b.coordinador), sig('PRESIDENTE C. ADM. COOP.', b.presidente), sig('DIRECTOR DE LA ESCUELA', b.director || ctx.school.director)],
            }
        }
        case 'NOMINA_FONDO_REPARTIBLE': {
            const p = d as FundData
            const t = fundTotals(p)
            return {
                ...base, title: 'NÓMINA DE FONDO REPARTIBLE', fileName: fname('Nomina_fondo_repartible'),
                meta: commonMeta(ctx, [['Unidad de producción', unitName], ['Ubicación', ctx.school.place], ['Fecha', fmtDate(p.date)], ['Fondo repartible', m(p.fund)], ['Valor por punto', money(t.perPoint)]]),
                tables: [{
                    columns: [{ label: 'NP', width: 5, align: 'center' }, { label: 'Nombre', width: 33 }, { label: 'Grupo', width: 7, align: 'center' }, { label: 'Puntos', width: 8, align: 'right' },
                        { label: 'Valor por punto', width: 11, align: 'right' }, { label: 'Importe', width: 11, align: 'right' }, { label: 'Sección consumo', width: 11, align: 'right' }, { label: 'Total', width: 11, align: 'right' }, { label: 'Firma', width: 13 }],
                    rows: (p.rows ?? []).map((r, i) => [i + 1, r.name, r.group, num(r.points), money(t.perPoint), money(t.lines[i]?.importe ?? 0), m(r.consumption), money(t.lines[i]?.total ?? 0), '']),
                    footer: ['', 'TOTAL', '', t.points, '', money(t.importe), money(t.consumption), money(t.total), ''],
                }],
                signatures: [sig('ENTREGÓ · TESORERO DE LA COOPERATIVA', b.tesorero), sig('VERIFICÓ · PRESIDENTE DE LA COOPERATIVA', b.presidente), sig('RECIBIÓ · ASESOR DE LA UNIDAD DE PRODUCCIÓN', teacher), sig('Vo. Bo. · EL DIRECTOR', b.director || ctx.school.director)],
            }
        }
        case 'NOMINA_CERTIFICADOS_DEVUELTOS': {
            const p = d as ReturnData
            const t = returnTotals(p)
            return {
                ...base, title: 'NÓMINA DE CERTIFICADOS DEVUELTOS', fileName: fname('Nomina_certificados_devueltos'),
                meta: commonMeta(ctx, [['Unidad de producción', unitName], ['Ubicación', ctx.school.place], ['Fecha', fmtDate(p.date)]]),
                tables: [{
                    columns: [{ label: 'NP', width: 6, align: 'center' }, { label: 'Nombre', width: 40 }, { label: 'Grupo', width: 8, align: 'center' }, { label: 'Certificados devueltos', width: 12, align: 'right' },
                        { label: 'Valor', width: 10, align: 'right' }, { label: 'Importe', width: 12, align: 'right' }, { label: 'Firma', width: 12 }],
                    rows: (p.rows ?? []).map((r, i) => [i + 1, r.name, r.group, num(r.certificates), m(r.value), money(t.lines[i] ?? 0), '']),
                    footer: ['', 'TOTAL', '', t.certificates, '', money(t.total), ''],
                }],
                summary: [['Importe total devuelto', `${money(t.total)} (${amountInWords(t.total)})`]],
                signatures: [sig('ENTREGÓ · TESORERO DE LA COOPERATIVA', b.tesorero), sig('ENTREGÓ · PRESIDENTE DE LA COOPERATIVA', b.presidente), sig('RECIBIÓ · ASESOR DE LA UNIDAD DE PRODUCCIÓN', teacher), sig('Vo. Bo. · DIRECTOR DE LA ESCUELA', b.director || ctx.school.director), sig('COORDINADOR TÉCNICO', b.coordinador)],
            }
        }
    }
    return { ...base, title: docLabel(doc.doc_type), meta: commonMeta(ctx), tables: [], signatures: [], fileName: fname(doc.doc_type) }
}

/** Relación de nuevos socios (certificados suscritos en el ciclo). */
export function buildPartnersModel(partners: Partner[], ctx: CoopContext): FormatModel {
    const rows = [...partners].sort((a, b) => a.folio - b.folio)
    const total = rows.reduce((s, p) => s + num(p.amount), 0)
    const b = board(ctx)
    return {
        title: 'RELACIÓN DE NUEVOS SOCIOS', headerLines: ctx.coop.header_lines?.length ? ctx.coop.header_lines : DEFAULT_HEADER_LINES,
        fileName: `Relacion_nuevos_socios_${safe(ctx.cycle.name)}`,
        meta: commonMeta(ctx, [['Nuevos socios', String(rows.length)], ['Capital social', `${money(total)} (${amountInWords(total)})`]]),
        tables: [{
            columns: [{ label: 'Folio', width: 8, align: 'center' }, { label: 'Apellido paterno, materno y nombre', width: 46 }, { label: 'Grupo', width: 10, align: 'center' },
                { label: 'Certificados suscritos', width: 12, align: 'right' }, { label: 'Valor', width: 10, align: 'right' }, { label: 'Monto', width: 14, align: 'right' }],
            rows: rows.map(p => [p.folio, partnerName(p), p.group_label ?? '', p.certificates, money(num(p.amount) / Math.max(1, p.certificates)), money(num(p.amount))]),
            footer: ['', 'TOTAL', '', rows.reduce((s, p) => s + p.certificates, 0), '', money(total)],
        }],
        signatures: [sig('RECIBIÓ · TESORERO', b.tesorero), sig('COMITÉ DE VIGILANCIA', b.vigilancia), sig('VISTO BUENO · DIRECTOR(A)', b.director || ctx.school.director)],
    }
}

/** Constancia de nuevos certificados por unidad de producción. */
export function buildConstanciaModel(partners: Partner[], allPartners: number, ctx: CoopContext, units: { name: string; count: number; amount: number }[]): FormatModel {
    const total = units.reduce((s, u) => s + u.amount, 0)
    const b = board(ctx)
    return {
        title: 'CONSTANCIA DE NUEVOS CERTIFICADOS', headerLines: ctx.coop.header_lines?.length ? ctx.coop.header_lines : DEFAULT_HEADER_LINES,
        fileName: `Constancia_nuevos_certificados_${safe(ctx.cycle.name)}`,
        meta: commonMeta(ctx, [['Ubicación', ctx.school.place], ['Total de nuevos socios', String(partners.length)], ['Número total de socios', String(allPartners)]]),
        tables: [{
            title: 'Nuevos certificados',
            columns: [{ label: '', width: 6, align: 'center' }, { label: 'Unidad de producción', width: 50 }, { label: 'No. socios', width: 14, align: 'right' }, { label: 'Importe', width: 15, align: 'right' }, { label: 'Subtotal', width: 15, align: 'right' }],
            rows: units.map((u, i) => [`${String.fromCharCode(65 + i)}.-`, u.name, u.count, money(u.amount), money(u.amount)]),
            footer: ['', 'TOTAL', units.reduce((s, u) => s + u.count, 0), '', money(total)],
        }],
        summary: [['Importe total de nuevos certificados', `${money(total)} (${amountInWords(total)})`]],
        signatures: [sig('TESORERO · CONSEJO DE ADMINISTRACIÓN', b.tesorero), sig('PRESIDENTE · CONSEJO DE ADMINISTRACIÓN', b.presidente)],
    }
}

/** Recibo / comprobante digital de la aportación de un socio. */
export function buildReceiptModel(p: Partner, ctx: CoopContext): FormatModel {
    const b = board(ctx)
    const amount = num(p.amount)
    return {
        title: 'RECIBO DE APORTACIÓN DE SOCIO', subtitle: `Folio ${String(p.folio).padStart(4, '0')}`,
        headerLines: ctx.coop.header_lines?.length ? ctx.coop.header_lines : DEFAULT_HEADER_LINES,
        fileName: `Recibo_socio_${String(p.folio).padStart(4, '0')}`,
        meta: [
            ['Cooperativa', ctx.coop.name], ['Registro', ctx.coop.registration_key], ['Escuela', ctx.school.name], ['CCT', ctx.school.cct],
            ['Socio', partnerName(p)], ['Grupo', p.group_label ?? ''], ['Fecha', fmtDate(p.joined_at)], ['Ciclo escolar', ctx.cycle.name],
        ],
        tables: [{
            columns: [{ label: 'Concepto', width: 55 }, { label: 'Certificados', width: 15, align: 'right' }, { label: 'Importe', width: 30, align: 'right' }],
            rows: [['Aportación de nuevo socio (certificado de aportación)', p.certificates, money(amount)]],
            footer: ['TOTAL', '', money(amount)],
        }],
        summary: [['Bueno por', `${money(amount)} (${amountInWords(amount)})`]],
        notes: ['Comprobante generado digitalmente por VUNLEK. Consérvalo: la aportación se devuelve al egresar de 3er grado.'],
        signatures: [sig('TESORERO DEL C. ADMINISTRACIÓN', b.tesorero), sig('PRESIDENTE DEL C. ADMINISTRACIÓN', b.presidente)],
    }
}
