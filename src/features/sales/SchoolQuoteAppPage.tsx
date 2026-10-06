import { useQuery } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { useProfile } from '../../hooks/useProfile'
import { SchoolQuoteForm } from './SchoolQuoteForm'
import { useSchoolTrial } from './useSchoolTrial'
import { formatDateEs } from '../../components/ui/DateInput'

/** Dentro de la app (dirección): solicitar presupuesto con los datos de la escuela ya propuestos. */
export const SchoolQuoteAppPage = () => {
    const { data: tenant } = useTenant()
    const { profile } = useProfile()
    const trial = useSchoolTrial()
    const tenantId = (tenant as any)?.id as string | undefined

    const { data: counts } = useQuery({
        queryKey: ['quote-counts', tenantId],
        enabled: !!tenantId,
        queryFn: async () => {
            const [staff, students] = await Promise.all([
                supabase.from('profile_tenants').select('profile_id', { count: 'exact', head: true }).eq('tenant_id', tenantId!).not('role', 'in', '(TUTOR,STUDENT)'),
                supabase.from('students').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId!),
            ])
            return { teachers: staff.count ?? null, students: students.count ?? null }
        },
    })

    const p = profile as any
    return (
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6 sm:py-10 space-y-5">
            <header className="flex items-start gap-3">
                <div className="w-12 h-12 shrink-0 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Building2 className="w-6 h-6" /></div>
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Presupuesto para tu escuela</h1>
                    <p className="text-slate-600 mt-1">El costo depende de cuántos docentes y alumnos usan el sistema. Confirma los datos y ventas te contactará con una propuesta.</p>
                </div>
            </header>
            {trial?.endsAt && (
                <p className="text-sm font-bold text-indigo-900 bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-3">
                    {trial.daysLeft > 0
                        ? `Tu mes de prueba con todas las funciones termina el ${formatDateEs(trial.endsAt.slice(0, 10))} (quedan ${trial.daysLeft} ${trial.daysLeft === 1 ? 'día' : 'días'}).`
                        : `Tu mes de prueba terminó el ${formatDateEs(trial.endsAt.slice(0, 10))}.`}
                </p>
            )}
            <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 sm:p-8">
                <SchoolQuoteForm defaults={{
                    name: [p?.first_name, p?.last_name_paternal, p?.last_name_maternal].filter(Boolean).join(' '),
                    email: p?.email ?? '',
                    school: (tenant as any)?.name ?? '',
                    cct: (tenant as any)?.cct ?? '',
                    teachers: counts?.teachers, students: counts?.students,
                }} />
            </section>
        </div>
    )
}
