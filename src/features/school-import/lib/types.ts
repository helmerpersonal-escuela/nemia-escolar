export type Gender = 'HOMBRE' | 'MUJER'
export type Day = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY'

export type Severity = 'error' | 'warning' | 'info'
export type Issue = { severity: Severity; area: string; message: string; source?: string }

export type SchoolMeta = {
    schoolName?: string
    cct?: string
    zone?: string
    cycle?: string
    shift?: string
    location?: string
    director?: string
}

export type PStudent = {
    groupKey: string
    full: string
    first_name: string
    last_name_paternal: string
    last_name_maternal: string
    gender: Gender | null
    curp?: string
    source: string
}

export type PGuardianRow = {
    groupKey: string
    studentFull: string
    tutorFull: string
    phones: string[]
    badPhones: string[]
    note?: string
    source: string
}

export type PStaff = {
    full: string
    functionLabel?: string
    subjects: string[]
    groups: string[]
    hours?: number
    duties: string[]
    sources: string[]
}

export type PGroupInfo = { groupKey: string; technology?: string; advisors: string[] }

export type PSlot = { start: string; end: string; isBreak: boolean }
export type PClass = { groupKey: string; day: Day; start: string; end: string; subject: string; teacher: string; source: string }

export type PCommission = { name: string; members: { role: string; name: string }[] }
export type PCteSession = { number: number; date: string; note?: string }
export type PPemcAction = { description: string; responsible?: string; period?: string; resources?: string; progress?: string; stage?: string }
export type PPemcObjective = { area?: string; problem?: string; objective: string; goal?: string; indicator?: string; actions: PPemcAction[]; source: string }
export type PPemcDiagnosis = { area: string; content: string }
export type PHistory = { kind: 'PROMEDIOS' | 'ADEUDO' | 'BAJA' | 'ALTA' | 'NOTA'; studentName: string; groupKey?: string; data: Record<string, unknown>; source: string }

/** Todo lo que se pudo leer de los archivos, antes de compararlo con lo que ya hay en el sistema. */
export type Extracted = {
    meta: SchoolMeta[]
    students: PStudent[]
    guardians: PGuardianRow[]
    staff: PStaff[]
    groupInfo: PGroupInfo[]
    slots: PSlot[]
    classes: PClass[]
    commissions: PCommission[]
    cte: PCteSession[]
    pemcTitle?: string
    pemcObjectives: PPemcObjective[]
    pemcDiagnosis: PPemcDiagnosis[]
    history: PHistory[]
    issues: Issue[]
    files: FileSummary[]
}

export type FileSummary = { name: string; kind: 'xlsx' | 'docx' | 'other'; found: string[]; ignored: string[] }

export const emptyExtracted = (): Extracted => ({
    meta: [], students: [], guardians: [], staff: [], groupInfo: [], slots: [], classes: [], commissions: [], cte: [],
    pemcObjectives: [], pemcDiagnosis: [], history: [], issues: [], files: [],
})
