/**
 * Cooperativa Escolar y Proyectos Productivos (Secundarias Técnicas).
 * Tipos, catálogo de formatos oficiales y cálculos financieros.
 */

export type DocType =
    | 'PLAN_ANUAL'
    | 'PRESUPUESTO'
    | 'INFORME_SEMESTRAL'
    | 'INFORME_ANUAL'
    | 'NOMINA_FONDO_REPARTIBLE'
    | 'NOMINA_CERTIFICADOS_DEVUELTOS'

export type DocStatus = 'BORRADOR' | 'ENVIADO' | 'APROBADO' | 'CON_OBSERVACIONES'
export type Financing = 'COOP ESC' | 'ING. PROP.' | 'OTRO'

export interface Cooperative {
    id: string
    tenant_id: string
    name: string
    registration_key: string
    kind: 'PRODUCCION' | 'CONSUMO' | 'PRODUCCION_CONSUMO'
    membership_fee: number
    certificate_value: number
    header_lines: string[]
    board: Board
    distribution: Distribution
}

export interface Board {
    presidente?: string
    tesorero?: string
    secretario?: string
    vigilancia?: string
    coordinador?: string
    director?: string
}

export interface Distribution { social: number; repartible: number; reserva: number }

export interface ProductionUnit { id: string; cooperative_id: string; teacher_id: string | null; name: string; weekly_hours: number | null }

export interface Partner {
    id: string
    student_id: string
    folio: number
    amount: number
    certificates: number
    joined_at: string
    status: 'ACTIVO' | 'DEVUELTO' | 'BAJA'
    returned_at: string | null
    returned_amount: number | null
    group_label: string | null
    academic_year_id: string | null
    student?: { first_name: string; last_name_paternal: string; last_name_maternal: string | null; group_id: string | null } | null
}

export interface Deadline {
    id: string
    doc_type: string
    due_date: string
    circular_ref: string | null
    notes: string | null
    academic_year_id: string | null
}

export interface CoopDocument {
    id: string
    cooperative_id: string
    academic_year_id: string | null
    unit_id: string | null
    teacher_id: string | null
    doc_type: DocType
    title: string | null
    data: any
    status: DocStatus
    submitted_at: string | null
    reviewed_by: string | null
    reviewed_at: string | null
    review_notes: string | null
    created_at: string
    updated_at: string
    teacher?: { full_name: string | null } | null
}

export interface CoopContext {
    coop: Cooperative
    school: { name: string; cct: string; shift: string; place: string; director: string; zone: string }
    cycle: { id: string | null; name: string; start?: string | null }
    teacher: { id: string; name: string }
    unit: ProductionUnit | null
    enrollment: number
    partners: Partner[]
}

// ---------------------------------------------------------------------------
// Catálogo de formatos

export const DOC_TYPES: { type: DocType; label: string; short: string; description: string; perTeacher: boolean }[] = [
    { type: 'PLAN_ANUAL', label: 'Plan anual de producción escolar', short: 'Plan anual', description: 'Proyectos, metas, insumos, mano de obra y cronograma del ciclo.', perTeacher: true },
    { type: 'PRESUPUESTO', label: 'Presupuesto', short: 'Presupuesto', description: 'Egresos e ingresos estimados por proyecto; la utilidad se calcula sola.', perTeacher: true },
    { type: 'INFORME_SEMESTRAL', label: 'Informe semestral de avance del plan anual', short: 'Informe semestral', description: 'Avance físico (metas) y financiero de cada proyecto.', perTeacher: true },
    { type: 'INFORME_ANUAL', label: 'Informe final del plan anual de producción', short: 'Informe anual', description: 'Balance final: utilidad bruta, amortización, utilidad neta y su distribución.', perTeacher: true },
    { type: 'NOMINA_FONDO_REPARTIBLE', label: 'Nómina de fondo repartible', short: 'Fondo repartible', description: 'Reparto automático del fondo entre los socios por puntos.', perTeacher: true },
    { type: 'NOMINA_CERTIFICADOS_DEVUELTOS', label: 'Nómina de certificados devueltos', short: 'Certificados devueltos', description: 'Devolución de la aportación a los socios que egresan de 3er grado.', perTeacher: true },
]

export const docLabel = (t: string) => DOC_TYPES.find(d => d.type === t)?.label ?? t
export const docShort = (t: string) => DOC_TYPES.find(d => d.type === t)?.short ?? t

export const STATUS_META: Record<DocStatus, { label: string; tone: string }> = {
    BORRADOR: { label: 'Borrador', tone: 'bg-slate-100 text-slate-600 border-slate-200' },
    ENVIADO: { label: 'Enviado a revisión', tone: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
    APROBADO: { label: 'Aprobado', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    CON_OBSERVACIONES: { label: 'Con observaciones', tone: 'bg-amber-50 text-amber-800 border-amber-100' },
}

export const MONTHS = ['SEP', 'OCT', 'NOV', 'DIC', 'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL']

export const DEFAULT_HEADER_LINES = [
    'SECRETARÍA DE EDUCACIÓN',
    'SUBSECRETARÍA DE EDUCACIÓN FEDERALIZADA',
    'DIRECCIÓN DE EDUCACIÓN SECUNDARIA Y SUPERIOR',
    'DEPARTAMENTO DE EDUCACIÓN SECUNDARIA TÉCNICA',
    'SUBJEFATURA DE PRODUCCIÓN Y EDUCACIÓN TECNOLÓGICA',
]

// ---------------------------------------------------------------------------
// Estructura de cada formato (campo data jsonb)

export interface PlanRow { project: string; goal: string; grade: string; hours: number | ''; start: string; end: string; financing: Financing; inputs: string; labor: string; months: string[] }
export interface PlanData { place: string; date: string; rows: PlanRow[]; notes: string }

export interface MoneyRow { concept: string; unit: string; qty: number | ''; price: number | '' }
export interface BudgetData { number: string; project: string; unitName: string; startDate: string; endDate: string; expenses: MoneyRow[]; recoveries: MoneyRow[]; realIncome: number | ''; realExpense: number | '' }

export interface ProgressRow { project: string; goal: string; achieved: string; physicalPct: number | ''; income: number | ''; expense: number | ''; observations: string }
export interface SemesterData { semester: 'PRIMERO' | 'SEGUNDO'; place: string; date: string; hours: number | ''; financing: Financing; rows: ProgressRow[] }

export interface FinalRow { project: string; budgetNo: string; goal: string; result: string; income: number | ''; expense: number | '' }
export interface AnnualData { place: string; date: string; hours: number | ''; financing: Financing; rows: FinalRow[]; amortization: number | ''; distribution: Distribution }

export interface FundRow { partnerId?: string; name: string; group: string; points: number | ''; consumption: number | '' }
export interface FundData { date: string; fund: number | ''; rows: FundRow[] }

export interface ReturnRow { partnerId?: string; name: string; group: string; certificates: number | ''; value: number | '' }
export interface ReturnData { date: string; rows: ReturnRow[] }

const today = () => new Date().toISOString().slice(0, 10)

export const emptyPlanRow = (): PlanRow => ({ project: '', goal: '', grade: '1°', hours: '', start: '', end: '', financing: 'COOP ESC', inputs: '', labor: '', months: [] })
export const emptyMoneyRow = (): MoneyRow => ({ concept: '', unit: '', qty: '', price: '' })
export const emptyProgressRow = (): ProgressRow => ({ project: '', goal: '', achieved: '', physicalPct: '', income: '', expense: '', observations: '' })
export const emptyFinalRow = (): FinalRow => ({ project: '', budgetNo: '', goal: '', result: '', income: '', expense: '' })

/** Datos iniciales de un formato, precargados con lo que ya existe (plan anual, socios, etc.). */
export function initialData(type: DocType, ctx: CoopContext, related: CoopDocument[] = []): any {
    const plan = related.find(d => d.doc_type === 'PLAN_ANUAL')?.data as PlanData | undefined
    const planRows = plan?.rows?.filter(r => r.project) ?? []
    const budgets = related.filter(d => d.doc_type === 'PRESUPUESTO')
    const place = ctx.school.place
    switch (type) {
        case 'PLAN_ANUAL':
            return { place, date: today(), rows: [emptyPlanRow()], notes: '' } satisfies PlanData
        case 'PRESUPUESTO':
            return {
                number: String(budgets.length + 1).padStart(2, '0'), project: planRows[0]?.project ?? '', unitName: ctx.unit?.name ?? '',
                startDate: planRows[0]?.start ?? '', endDate: planRows[0]?.end ?? '',
                expenses: [emptyMoneyRow()], recoveries: [emptyMoneyRow()], realIncome: '', realExpense: '',
            } satisfies BudgetData
        case 'INFORME_SEMESTRAL': {
            const semesters = related.filter(d => d.doc_type === 'INFORME_SEMESTRAL').length
            return {
                semester: semesters > 0 ? 'SEGUNDO' : 'PRIMERO', place, date: today(), hours: ctx.unit?.weekly_hours ?? '', financing: 'COOP ESC',
                rows: planRows.length ? planRows.map(r => ({ ...emptyProgressRow(), project: r.project, goal: r.goal })) : [emptyProgressRow()],
            } satisfies SemesterData
        }
        case 'INFORME_ANUAL':
            return {
                place, date: today(), hours: ctx.unit?.weekly_hours ?? '', financing: 'COOP ESC', amortization: '',
                distribution: { ...(ctx.coop.distribution ?? { social: 40, repartible: 40, reserva: 20 }) },
                rows: planRows.length
                    ? planRows.map((r, i) => {
                        const b = budgets.find(x => (x.data as BudgetData)?.project?.trim().toLowerCase() === r.project.trim().toLowerCase())
                        return { ...emptyFinalRow(), project: r.project, goal: r.goal, budgetNo: (b?.data as BudgetData)?.number ?? String(i + 1).padStart(2, '0') }
                    })
                    : [emptyFinalRow()],
            } satisfies AnnualData
        case 'NOMINA_FONDO_REPARTIBLE': {
            const annual = related.find(d => d.doc_type === 'INFORME_ANUAL')?.data as AnnualData | undefined
            const fund = annual ? round2(annualTotals(annual).repartible) : ''
            return {
                date: today(), fund,
                rows: ctx.partners.filter(p => p.status === 'ACTIVO').map(p => ({ partnerId: p.id, name: partnerName(p), group: p.group_label ?? '', points: 1, consumption: '' })),
            } satisfies FundData
        }
        case 'NOMINA_CERTIFICADOS_DEVUELTOS':
            return {
                date: today(),
                rows: ctx.partners.filter(p => p.status !== 'BAJA' && isThirdGrade(p.group_label)).map(p => ({
                    partnerId: p.id, name: partnerName(p), group: p.group_label ?? '', certificates: p.certificates, value: round2(num(p.amount) / Math.max(1, p.certificates)),
                })),
            } satisfies ReturnData
    }
}

// ---------------------------------------------------------------------------
// Cálculos

export const num = (v: unknown) => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : 0 }
export const round2 = (n: number) => Math.round(n * 100) / 100
export const money = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

export const rowAmount = (r: MoneyRow) => round2(num(r.qty) * num(r.price))

export function budgetTotals(d: BudgetData) {
    const egresos = round2((d.expenses ?? []).reduce((s, r) => s + rowAmount(r), 0))
    const ingresos = round2((d.recoveries ?? []).reduce((s, r) => s + rowAmount(r), 0))
    const realIngresos = d.realIncome === '' || d.realIncome == null ? null : num(d.realIncome)
    const realEgresos = d.realExpense === '' || d.realExpense == null ? null : num(d.realExpense)
    return {
        egresos, ingresos, utilidad: round2(ingresos - egresos),
        realIngresos, realEgresos,
        realUtilidad: realIngresos != null && realEgresos != null ? round2(realIngresos - realEgresos) : null,
    }
}

export function semesterTotals(d: SemesterData) {
    const rows = d.rows ?? []
    const income = round2(rows.reduce((s, r) => s + num(r.income), 0))
    const expense = round2(rows.reduce((s, r) => s + num(r.expense), 0))
    const withPct = rows.filter(r => r.physicalPct !== '' && r.physicalPct != null)
    const physical = withPct.length ? Math.round(withPct.reduce((s, r) => s + num(r.physicalPct), 0) / withPct.length) : 0
    return { income, expense, balance: round2(income - expense), physical }
}

export function annualTotals(d: AnnualData) {
    const rows = d.rows ?? []
    const income = round2(rows.reduce((s, r) => s + num(r.income), 0))
    const expense = round2(rows.reduce((s, r) => s + num(r.expense), 0))
    const bruta = round2(income - expense)
    const neta = round2(bruta - num(d.amortization))
    const dist = d.distribution ?? { social: 40, repartible: 40, reserva: 20 }
    const base = Math.max(neta, 0)
    const social = round2(base * num(dist.social) / 100)
    const repartible = round2(base * num(dist.repartible) / 100)
    const reserva = round2(base - social - repartible) // absorbe el redondeo
    return { income, expense, bruta, neta, social, repartible, reserva, pctTotal: num(dist.social) + num(dist.repartible) + num(dist.reserva) }
}

export function fundTotals(d: FundData) {
    const rows = d.rows ?? []
    const points = rows.reduce((s, r) => s + num(r.points), 0)
    const fund = num(d.fund)
    const perPoint = points > 0 ? fund / points : 0
    const lines = rows.map(r => {
        const importe = round2(num(r.points) * perPoint)
        return { importe, total: round2(importe + num(r.consumption)) }
    })
    // Ajuste de centavos: la suma de importes debe coincidir con el fondo.
    const diff = round2(fund - lines.reduce((s, l) => s + l.importe, 0))
    if (diff !== 0 && lines.length) {
        const i = lines.findIndex((_, k) => num(rows[k].points) > 0)
        if (i >= 0) { lines[i].importe = round2(lines[i].importe + diff); lines[i].total = round2(lines[i].total + diff) }
    }
    return {
        points, perPoint: round2(perPoint), lines,
        importe: round2(lines.reduce((s, l) => s + l.importe, 0)),
        consumption: round2(rows.reduce((s, r) => s + num(r.consumption), 0)),
        total: round2(lines.reduce((s, l) => s + l.total, 0)),
    }
}

export function returnTotals(d: ReturnData) {
    const rows = d.rows ?? []
    const lines = rows.map(r => round2(num(r.certificates) * num(r.value)))
    return { lines, certificates: rows.reduce((s, r) => s + num(r.certificates), 0), total: round2(lines.reduce((s, x) => s + x, 0)) }
}

/** Docente independiente: marca personal de entrega (no hay revisión dentro de la app). */
export const deliveredAt = (doc: Pick<CoopDocument, 'data'>): string | null => doc.data?._deliveredAt ?? null

/** Resumen corto para listas (utilidad, avance…). */
export function docHeadline(doc: Pick<CoopDocument, 'doc_type' | 'data'>): string {
    const d = doc.data ?? {}
    switch (doc.doc_type) {
        case 'PLAN_ANUAL': return `${(d.rows ?? []).filter((r: PlanRow) => r.project).length} proyecto(s)`
        case 'PRESUPUESTO': { const t = budgetTotals(d); return `${d.project || 'Sin proyecto'} · utilidad ${money(t.utilidad)}` }
        case 'INFORME_SEMESTRAL': { const t = semesterTotals(d); return `${d.semester === 'SEGUNDO' ? '2°' : '1°'} semestre · avance ${t.physical}% · saldo ${money(t.balance)}` }
        case 'INFORME_ANUAL': { const t = annualTotals(d); return `Utilidad neta ${money(t.neta)}` }
        case 'NOMINA_FONDO_REPARTIBLE': { const t = fundTotals(d); return `${(d.rows ?? []).length} socio(s) · ${money(t.total)}` }
        case 'NOMINA_CERTIFICADOS_DEVUELTOS': { const t = returnTotals(d); return `${(d.rows ?? []).length} socio(s) · ${money(t.total)}` }
    }
    return ''
}

// ---------------------------------------------------------------------------
// Utilidades

export const partnerName = (p: Partner) => {
    const s = p.student
    if (!s) return 'Alumno'
    return [s.last_name_paternal, s.last_name_maternal, s.first_name].filter(Boolean).join(' ').toUpperCase()
}

export const isThirdGrade = (label?: string | null) => /^\s*3/.test(label ?? '')

export const SHIFT_LABEL: Record<string, string> = { MORNING: 'MATUTINO', AFTERNOON: 'VESPERTINO', FULL_TIME: 'TIEMPO COMPLETO' }

/** Días que faltan para una fecha (negativo = vencida). */
export const daysUntil = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`)
    const t = new Date(); t.setHours(0, 0, 0, 0)
    return Math.round((d.getTime() - t.getTime()) / 86400000)
}

/** Importe con letra (pesos mexicanos), p. ej. "CINCO PESOS 00/100 M.N." */
export function amountInWords(amount: number): string {
    const n = Math.floor(Math.abs(amount))
    const cents = Math.round((Math.abs(amount) - n) * 100)
    const words = (n === 0 ? 'CERO' : toWords(n)).replace(/UNO$/, 'UN').replace(/VEINTIUN\b/g, 'VEINTIÚN')
    return `${words} ${n === 1 ? 'PESO' : 'PESOS'} ${String(cents).padStart(2, '0')}/100 M.N.`
}

const UNITS = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE',
    'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO',
    'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE']
const TENS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
const HUNDREDS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']

function below1000(n: number): string {
    if (n === 100) return 'CIEN'
    const h = Math.floor(n / 100), r = n % 100
    let out = HUNDREDS[h]
    if (r) {
        const part = r < 30 ? UNITS[r] : `${TENS[Math.floor(r / 10)]}${r % 10 ? ` Y ${UNITS[r % 10]}` : ''}`
        out = out ? `${out} ${part}` : part
    }
    return out
}

function toWords(n: number): string {
    if (n < 1000) return below1000(n)
    if (n < 1_000_000) {
        const th = Math.floor(n / 1000), r = n % 1000
        const head = th === 1 ? 'MIL' : `${below1000(th).replace(/UNO$/, 'UN')} MIL`
        return r ? `${head} ${below1000(r)}` : head
    }
    const m = Math.floor(n / 1_000_000), r = n % 1_000_000
    const head = m === 1 ? 'UN MILLÓN' : `${toWords(m).replace(/UNO$/, 'UN')} MILLONES`
    return r ? `${head} ${toWords(r)}` : head
}
