import { supabase } from '../../../lib/supabase'

export const CTE_PORTAL_URL = 'https://gestion.cte.sep.gob.mx/insumos/'
export const CTE_MANAGER_ROLES = ['DIRECTOR', 'ADMIN', 'ACADEMIC_COORD', 'TECH_COORD', 'SUPER_ADMIN']

export type SessionStatus = 'PLANNED' | 'AGENDA_READY' | 'DONE'
export type AgreementStatus = 'PENDIENTE' | 'EN_PROCESO' | 'CUMPLIDO' | 'NO_CUMPLIDO'
export type DocumentKind = 'GUIA_OFICIAL' | 'PRESENTACION' | 'ACTA' | 'EVIDENCIA' | 'DIAGNOSTICO' | 'OTRO'

export interface AgendaItem {
    id: string
    time: string
    topic: string
    responsible: string
    status: 'pending' | 'in_progress' | 'completed'
    duration?: number
    notes?: string
}

export interface CteSession {
    id: string
    tenant_id: string
    school_year: string
    session_type: 'INTENSIVA' | 'ORDINARIA' | 'EXTRAORDINARIA'
    session_number: number
    date: string
    title: string | null
    status: SessionStatus
    agenda: AgendaItem[]
    purpose: string | null
    minutes: string | null
    official_url: string | null
}

export interface CteDocument {
    id: string
    tenant_id: string
    session_id: string | null
    kind: DocumentKind
    title: string
    storage_path: string | null
    mime_type: string | null
    size_bytes: number | null
    extracted_text: string | null
    created_at: string
}

export interface CteAgreement {
    id: string
    tenant_id: string
    session_id: string | null
    description: string
    responsible_profile_id: string | null
    responsible_label: string | null
    due_date: string | null
    status: AgreementStatus
    follow_up: string | null
    created_at: string
}

export interface ProposalContent {
    proposito?: string
    temas_prioritarios?: { tema: string; evidencia?: string }[]
    agenda?: { hora?: string; tema: string; responsable?: string; duracion_min?: number; descripcion?: string }[]
    seguimiento_acuerdos?: { acuerdo: string; sugerencia: string }[]
    productos_esperados?: string[]
    preparacion_previa?: string[]
    notas?: string
}

export interface CteProposal {
    id: string
    session_id: string | null
    content: ProposalContent
    sources: { tipo: string; titulo: string }[]
    status: 'DRAFT' | 'APPLIED' | 'DISCARDED'
    created_at: string
}

export interface StaffMember {
    profile_id: string
    name: string
    role: string
}

export const AGREEMENT_STATUS_LABEL: Record<AgreementStatus, string> = {
    PENDIENTE: 'Pendiente',
    EN_PROCESO: 'En proceso',
    CUMPLIDO: 'Cumplido',
    NO_CUMPLIDO: 'No cumplido',
}

export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
    GUIA_OFICIAL: 'Guía / insumo oficial SEP',
    PRESENTACION: 'Presentación',
    ACTA: 'Acta o minuta',
    EVIDENCIA: 'Evidencia / producto',
    DIAGNOSTICO: 'Diagnóstico escolar',
    OTRO: 'Otro',
}

/** Fecha local (no UTC) en formato AAAA-MM-DD. */
export const todayISO = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Ciclo escolar vigente: de agosto a julio (p. ej. 2026-2027). */
export function currentSchoolYear(today = new Date()): string {
    const y = today.getFullYear()
    return today.getMonth() >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`
}

export function sessionLabel(s: Pick<CteSession, 'session_type' | 'session_number' | 'title'>): string {
    if (s.title) return s.title
    if (s.session_type === 'INTENSIVA') return `Fase intensiva — sesión ${s.session_number}`
    if (s.session_type === 'EXTRAORDINARIA') return 'Sesión extraordinaria'
    return `${s.session_number}ª sesión ordinaria`
}

/** Próxima sesión (hoy incluido) o la última si ya pasaron todas. */
export function pickNextSession<T extends Pick<CteSession, 'date'>>(sessions: T[], todayISO: string): T | undefined {
    const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date))
    return sorted.find(s => s.date >= todayISO) ?? sorted[sorted.length - 1]
}

export async function fetchStaff(tenantId: string): Promise<StaffMember[]> {
    const { data, error } = await supabase.rpc('tenant_staff', { p_tenant: tenantId })
    if (error) throw error
    return ((data ?? []) as { profile_id: string; name: string | null; role: string }[])
        .map(r => ({ profile_id: r.profile_id, role: r.role, name: r.name || 'Sin nombre' }))
}

// ---------------------------------------------------------------------------
// Propuesta con IA
// ---------------------------------------------------------------------------

export interface ProposalContext {
    school: { name?: string; level?: string }
    session: Pick<CteSession, 'date' | 'session_type' | 'session_number' | 'title' | 'purpose'>
    officialDocs: Pick<CteDocument, 'title' | 'kind' | 'extracted_text'>[]
    schoolDocs: Pick<CteDocument, 'title' | 'kind' | 'extracted_text'>[]
    agreements: Pick<CteAgreement, 'description' | 'status' | 'due_date' | 'follow_up' | 'responsible_label'>[]
    previousMinutes: { label: string; minutes: string }[]
    indicators: unknown
    pemc: { objectives: string[]; actions: string[] }
}

const clip = (s: string | null | undefined, n: number) => {
    const t = (s ?? '').replace(/\s+\n/g, '\n').trim()
    return t.length > n ? t.slice(0, n) + ' […]' : t
}

/** Arma el prompt respetando el tope del proxy de IA (≈60 000 caracteres). */
export function buildProposalPrompt(ctx: ProposalContext, maxChars = 52_000): string {
    const header = `Eres asesor pedagógico de una escuela mexicana (Nueva Escuela Mexicana).
Prepara la PROPUESTA para la próxima sesión del Consejo Técnico Escolar (CTE) que revisarán
la dirección y la coordinación. Usa SOLO la información proporcionada; si falta algo, dilo en "notas".
No inventes datos numéricos. Respeta los tiempos y actividades de la guía oficial cuando exista.

Escuela: ${ctx.school.name ?? 'N/D'} · Nivel: ${ctx.school.level ?? 'N/D'}
Sesión objetivo: ${sessionLabel(ctx.session as CteSession)} · Fecha: ${ctx.session.date}
${ctx.session.purpose ? `Propósito registrado: ${ctx.session.purpose}` : ''}`

    const agreements = ctx.agreements.length
        ? ctx.agreements.map(a =>
            `- [${AGREEMENT_STATUS_LABEL[a.status as AgreementStatus] ?? a.status}] ${a.description}` +
            (a.responsible_label ? ` (responsable: ${a.responsible_label})` : '') +
            (a.due_date ? ` · fecha compromiso ${a.due_date}` : '') +
            (a.follow_up ? ` · seguimiento: ${clip(a.follow_up, 300)}` : '')).join('\n')
        : 'Sin acuerdos registrados.'

    const pemc = [
        ctx.pemc.objectives.length ? `Objetivos: ${ctx.pemc.objectives.map(o => clip(o, 200)).join(' | ')}` : '',
        ctx.pemc.actions.length ? `Acciones: ${ctx.pemc.actions.map(a => clip(a, 200)).join(' | ')}` : '',
    ].filter(Boolean).join('\n') || 'Sin PEMC capturado.'

    const fixed = `${header}

## Acuerdos de sesiones anteriores
${agreements}

## Indicadores de la escuela (agregados, sin datos personales)
${clip(JSON.stringify(ctx.indicators ?? {}), 6000)}

## PEMC
${pemc}`

    const footer = `

Responde SOLO con JSON válido con esta forma:
{
  "proposito": "propósito de la sesión en 1-2 oraciones",
  "temas_prioritarios": [{"tema": "...", "evidencia": "dato o documento que lo respalda"}],
  "agenda": [{"hora": "08:00", "tema": "...", "responsable": "Dirección|Coordinación|Colectivo|...", "duracion_min": 30, "descripcion": "qué se hará y con qué producto"}],
  "seguimiento_acuerdos": [{"acuerdo": "...", "sugerencia": "..."}],
  "productos_esperados": ["..."],
  "preparacion_previa": ["qué deben preparar dirección, coordinación y docentes antes de la sesión"],
  "notas": "limitaciones o información faltante"
}`

    // El resto del espacio se reparte entre guías oficiales, documentos y actas.
    let budget = maxChars - fixed.length - footer.length - 200
    const sections: string[] = []
    const addDocs = (title: string, docs: Pick<CteDocument, 'title' | 'kind' | 'extracted_text'>[], share: number) => {
        if (!docs.length) return
        const limit = Math.max(0, Math.floor(budget * share))
        const per = Math.max(800, Math.floor(limit / docs.length))
        let used = 0
        const body = docs.map(d => {
            const txt = clip(d.extracted_text, Math.min(per, limit - used))
            used += txt.length
            return `### ${d.title}\n${txt || '(sin texto extraído)'}`
        }).join('\n\n')
        sections.push(`## ${title}\n${body}`)
        budget -= body.length
    }
    addDocs('Guía(s) e insumos oficiales de la sesión', ctx.officialDocs, 0.55)
    addDocs('Documentos de la escuela', ctx.schoolDocs, 0.6)
    if (ctx.previousMinutes.length) {
        const per = Math.max(500, Math.floor(Math.max(budget, 0) / ctx.previousMinutes.length))
        sections.push('## Actas / minutas anteriores\n' +
            ctx.previousMinutes.map(m => `### ${m.label}\n${clip(m.minutes, per)}`).join('\n\n'))
    }

    return `${fixed}\n\n${sections.join('\n\n')}`.slice(0, maxChars - footer.length) + footer
}

export function parseProposal(raw: string): ProposalContent {
    const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start < 0 || end < start) throw new Error('La IA no devolvió una propuesta válida')
    const parsed = JSON.parse(cleaned.slice(start, end + 1))
    return {
        proposito: typeof parsed.proposito === 'string' ? parsed.proposito : undefined,
        temas_prioritarios: Array.isArray(parsed.temas_prioritarios) ? parsed.temas_prioritarios : [],
        agenda: Array.isArray(parsed.agenda) ? parsed.agenda.filter((a: { tema?: unknown } | null) => typeof a?.tema === 'string') : [],
        seguimiento_acuerdos: Array.isArray(parsed.seguimiento_acuerdos) ? parsed.seguimiento_acuerdos : [],
        productos_esperados: Array.isArray(parsed.productos_esperados) ? parsed.productos_esperados.map(String) : [],
        preparacion_previa: Array.isArray(parsed.preparacion_previa) ? parsed.preparacion_previa.map(String) : [],
        notas: typeof parsed.notas === 'string' ? parsed.notas : undefined,
    }
}

export function proposalToAgenda(p: ProposalContent): AgendaItem[] {
    return (p.agenda ?? []).map(a => ({
        id: crypto.randomUUID(),
        time: a.hora ?? '',
        topic: a.tema,
        responsible: a.responsable ?? '',
        duration: a.duracion_min,
        notes: a.descripcion,
        status: 'pending' as const,
    }))
}

/**
 * Publica la agenda para docentes (la leen desde su panel en school_details.cte_config).
 * Devuelve false si la escuela aún no captura sus datos generales en Ajustes.
 */
export async function publishAgenda(session: Pick<CteSession, 'id' | 'tenant_id'>, agenda: AgendaItem[]): Promise<boolean> {
    const { data, error } = await supabase.rpc('cte_publish_agenda', {
        p_tenant: session.tenant_id,
        p_agenda: agenda,
        p_session: session.id,
    })
    if (error) throw error
    return data === true
}
