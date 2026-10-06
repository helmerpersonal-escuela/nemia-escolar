import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Building2, GraduationCap, Layers, Loader2, UserRound, Users } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { ADMIN_SPACES_KEY } from './PeoplePanel'

export interface AdminSpace {
    id: string
    name: string
    type: 'SCHOOL' | 'INDEPENDENT' | string
    cct: string | null
    created_at: string | null
    members: number
    students: number
    groups: number
    sub_status: string | null
    sub_plan: string | null
    sub_ends: string | null
}

export const fetchAdminSpaces = async (): Promise<AdminSpace[]> => {
    const { data, error } = await supabase.rpc('admin_spaces' as any)
    if (error) throw error
    return (data ?? []) as AdminSpace[]
}

const SUB_TEXT: Record<string, string> = { TRIAL: 'Prueba', ACTIVE: 'Activa', PAST_DUE: 'Pago pendiente', EXPIRED: 'Vencida', CANCELED: 'Cancelada' }
const day = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : null

/** Escuelas y espacios de docentes independientes, con lo que tienen dentro. */
export const SpacesPanel = ({ search, onSeeMembers }: { search: string; onSeeMembers: (space: { id: string; name: string }) => void }) => {
    const { data: spaces = [], isLoading, error } = useQuery({ queryKey: ADMIN_SPACES_KEY, queryFn: fetchAdminSpaces, staleTime: 30_000 })
    const shown = useMemo(() => {
        const q = search.trim().toLowerCase()
        return q ? spaces.filter(s => [s.name, s.cct].some(v => String(v ?? '').toLowerCase().includes(q))) : spaces
    }, [spaces, search])

    if (isLoading) return <div className="py-16 flex justify-center"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>
    if (error) return <p role="alert" className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 text-sm font-bold">No se pudo cargar la lista: {(error as any).message}</p>
    if (!shown.length) return <p className="bg-white border border-slate-200 rounded-3xl py-14 text-center text-slate-600 font-bold">No hay espacios que coincidan.</p>

    return (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {shown.map(s => {
                const school = s.type === 'SCHOOL'
                const empty = Number(s.members) === 0
                return (
                    <li key={s.id} className="bg-white border border-slate-200 rounded-3xl p-5 flex flex-col gap-4">
                        <div className="flex items-start gap-3">
                            <div className={`w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center ${school ? 'bg-indigo-50 text-indigo-600' : 'bg-cyan-50 text-cyan-700'}`}>
                                {school ? <Building2 className="w-5 h-5" /> : <UserRound className="w-5 h-5" />}
                            </div>
                            <div className="min-w-0">
                                <h4 className="font-black text-slate-900 leading-tight break-words">{s.name}</h4>
                                <p className="text-xs font-bold text-slate-500 mt-0.5">{school ? 'Escuela' : 'Docente independiente'}{s.cct ? ` · ${s.cct}` : ''}</p>
                            </div>
                        </div>
                        <dl className="grid grid-cols-3 gap-2 text-center">
                            {([[Users, s.members, 'Miembros'], [Layers, s.groups, 'Grupos'], [GraduationCap, s.students, 'Alumnos']] as const).map(([Icon, n, label]) => (
                                <div key={label} className="bg-slate-50 rounded-2xl py-2.5">
                                    <Icon className="w-4 h-4 text-slate-400 mx-auto" />
                                    <dd className="text-lg font-black text-slate-900 leading-tight">{n}</dd>
                                    <dt className="text-[11px] font-bold text-slate-500">{label}</dt>
                                </div>
                            ))}
                        </dl>
                        {empty && <p className="flex items-start gap-2 text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 rounded-2xl p-2.5"><AlertTriangle className="w-4 h-4 shrink-0" /> Sin miembros: nadie puede entrar a este espacio.</p>}
                        <div className="flex items-center justify-between gap-2 mt-auto">
                            <p className="text-xs text-slate-500">
                                <b className="text-slate-700">{s.sub_status ? SUB_TEXT[s.sub_status] ?? s.sub_status : 'Sin suscripción'}</b>
                                {s.sub_ends ? ` · hasta ${day(s.sub_ends)}` : ''}<br />Creado: {day(s.created_at) ?? '—'}
                            </p>
                            <button onClick={() => onSeeMembers({ id: s.id, name: s.name })} disabled={empty}
                                className="min-h-11 px-4 rounded-2xl bg-indigo-50 text-indigo-700 text-sm font-black hover:bg-indigo-100 disabled:opacity-40">Ver miembros</button>
                        </div>
                    </li>
                )
            })}
        </ul>
    )
}
