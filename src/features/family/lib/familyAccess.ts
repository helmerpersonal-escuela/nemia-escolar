import { supabase } from '../../../lib/supabase'

export type AccessRole = 'TITULAR' | 'EXTRA'
export interface AccessAccount { id: string; name: string; relationship: string | null; phone: string | null; email: string | null; role: AccessRole; since: string | null; is_me: boolean }
export interface AccessRequest { id: string; full_name: string; relationship: string; phone: string | null; reason: string | null; status: 'PENDING' | 'APPROVED' | 'REJECTED'; code: string | null; expires: string | null; response: string | null; created_at: string }
export interface StudentAccess { student_id: string; student: string; my_role: AccessRole | null; accounts: AccessAccount[]; requests: AccessRequest[] }
export interface PendingRequest { id: string; student_id: string; student: string; group: string | null; titular: string | null; full_name: string; relationship: string; phone: string | null; reason: string | null; created_at: string }

export const MAX_EXTRA = 2
export const RELATIONSHIPS = ['Madre', 'Padre', 'Abuela', 'Abuelo', 'Tía', 'Tío', 'Hermana', 'Hermano', 'Tutor(a) legal', 'Otro']
export const ROLE_TEXT: Record<AccessRole, string> = { TITULAR: 'Tutor titular', EXTRA: 'Cuenta adicional' }

/** Para la familia: sus hijos y con qué tipo de acceso entra. Para la escuela: las cuentas de un alumno. */
export async function accessOverview(studentId?: string): Promise<StudentAccess[]> {
    const { data, error } = await supabase.rpc('family_access_overview', { p_student: studentId ?? null })
    if (error) throw new Error(error.message)
    return (data as StudentAccess[]) ?? []
}

/** Cuentas adicionales ocupadas o en trámite de un alumno. */
export const usedSlots = (s: StudentAccess) =>
    s.accounts.filter(a => a.role === 'EXTRA').length + s.requests.filter(r => r.status === 'PENDING' || r.status === 'APPROVED').length
