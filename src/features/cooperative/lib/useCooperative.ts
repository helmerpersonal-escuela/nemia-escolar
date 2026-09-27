import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import type { CoopContext, CoopDocument, Cooperative, Deadline, Partner, ProductionUnit } from './types'

const db = supabase as any

export const REVIEWER_ROLES = ['TECH_COORD', 'DIRECTOR', 'ADMIN', 'ACADEMIC_COORD']

export function useCoopRole() {
    const { data: tenant } = useTenant()
    const role = (tenant as any)?.role ?? 'TEACHER'
    const independent = (tenant as any)?.type === 'INDEPENDENT'
    return {
        tenant,
        role,
        independent,
        /** Revisa y valida (Coordinación de Actividades Tecnológicas / dirección). Solo existe en espacios de escuela:
         *  el docente independiente no escala su revisión, trabaja sus formatos como documentos personales. */
        isReviewer: REVIEWER_ROLES.includes(role) && !independent,
        /** Llena formatos de su unidad de producción. */
        isTeacher: ['TEACHER', 'INDEPENDENT_TEACHER'].includes(role) || independent,
    }
}

/** Cooperativa de la escuela (null si aún no se registra). Se usa también en el menú y el tablero. */
export function useCooperativeRecord() {
    const { data: tenant } = useTenant()
    const tenantId = (tenant as any)?.id as string | undefined
    return useQuery({
        queryKey: ['coop', 'record', tenantId],
        enabled: !!tenantId && tenantId !== '00000000-0000-0000-0000-000000000000',
        staleTime: 5 * 60_000,
        queryFn: async (): Promise<Cooperative | null> => {
            const { data, error } = await db.from('cooperatives').select('*').eq('tenant_id', tenantId).maybeSingle()
            if (error) throw error
            return data
        },
    })
}

export interface CoopBundle {
    ctx: CoopContext | null
    units: ProductionUnit[]
    partners: Partner[]
    deadlines: Deadline[]
    documents: CoopDocument[]
    myUnit: ProductionUnit | null
}

export function useCooperativeData() {
    const { tenant } = useCoopRole()
    const tenantId = (tenant as any)?.id as string | undefined
    const { data: coop, isLoading: coopLoading } = useCooperativeRecord()

    const bundle = useQuery({
        queryKey: ['coop', 'bundle', tenantId, coop?.id],
        enabled: !!coop && !!tenantId,
        queryFn: async (): Promise<CoopBundle> => {
            const { data: { user } } = await supabase.auth.getUser()
            const me = sessionStorage.getItem('vunlek_impersonate_id') || user?.id || ''
            const [school, year, units, partners, enrollment, groups] = await Promise.all([
                db.from('school_details').select('official_name, cct, shift, address_municipality, address_state, director_name, zone').eq('tenant_id', tenantId).maybeSingle(),
                db.from('academic_years').select('id, name, start_date').eq('tenant_id', tenantId).eq('is_active', true).maybeSingle(),
                db.from('coop_production_units').select('*').eq('cooperative_id', coop!.id).order('name'),
                db.from('coop_partners').select('*, student:students(first_name, last_name_paternal, last_name_maternal, group_id)').eq('cooperative_id', coop!.id).order('folio'),
                db.from('students').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).or('status.is.null,status.not.in.(GRADUATED,INACTIVE)'),
                db.from('groups').select('id, grade, section').eq('tenant_id', tenantId).is('archived_at', null),
            ])
            // Grupo actual del socio (el que tenía al inscribirse puede haber cambiado de grado)
            const groupLabel = new Map<string, string>((groups.data ?? []).map((g: any) => [g.id, `${g.grade}° ${g.section}`]))
            for (const p of (partners.data ?? []) as Partner[]) {
                const current = p.student?.group_id ? groupLabel.get(p.student.group_id) : undefined
                if (current) p.group_label = current
            }
            if (partners.error) throw partners.error
            const yearId: string | null = year.data?.id ?? null
            let deadlinesQ = db.from('coop_deadlines').select('*').eq('tenant_id', tenantId).order('due_date')
            let docsQ = db.from('coop_documents').select('*, teacher:profiles!coop_documents_teacher_id_fkey(full_name)').eq('cooperative_id', coop!.id).order('created_at')
            if (yearId) {
                deadlinesQ = deadlinesQ.or(`academic_year_id.eq.${yearId},academic_year_id.is.null`)
                docsQ = docsQ.or(`academic_year_id.eq.${yearId},academic_year_id.is.null`)
            }
            const [deadlines, documents] = await Promise.all([deadlinesQ, docsQ])
            if (documents.error) throw documents.error

            const s = school.data ?? {}
            const t = tenant as any
            const unitList: ProductionUnit[] = units.data ?? []
            const myUnit = unitList.find(u => u.teacher_id === me) ?? null
            const ctx: CoopContext = {
                coop: coop!,
                school: {
                    name: (s.official_name || t?.name || '').toUpperCase(),
                    cct: (s.cct || t?.cct || '').toUpperCase(),
                    shift: s.shift || '',
                    place: [s.address_municipality, s.address_state].filter(Boolean).join(', ').toUpperCase(),
                    director: (s.director_name || '').toUpperCase(),
                    zone: s.zone || '',
                },
                cycle: { id: yearId, name: year.data?.name ?? '', start: year.data?.start_date ?? null },
                teacher: { id: me, name: (t?.fullName || '').toUpperCase() },
                unit: myUnit,
                enrollment: enrollment.count ?? 0,
                partners: partners.data ?? [],
            }
            return { ctx, units: unitList, partners: partners.data ?? [], deadlines: deadlines.data ?? [], documents: documents.data ?? [], myUnit }
        },
    })

    return { coop, coopLoading, ...bundle }
}

export function useInvalidateCoop() {
    const qc = useQueryClient()
    return () => qc.invalidateQueries({ queryKey: ['coop'] })
}
