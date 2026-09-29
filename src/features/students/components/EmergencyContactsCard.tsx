import { useEffect, useState } from 'react'
import { Phone, PhoneCall, AlertTriangle } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { formatPhone, normalizePhone } from '../../../lib/phones'

type GuardianPhones = {
    id: string
    first_name: string | null
    last_name_paternal: string | null
    relationship: string | null
    phone: string | null
    phone_alt1: string | null
    phone_alt2: string | null
}

/** Contactos de emergencia del alumno: un toque para llamar desde el celular. */
export const EmergencyContactsCard = ({ studentId }: { studentId: string }) => {
    const [rows, setRows] = useState<GuardianPhones[] | null>(null)

    useEffect(() => {
        let alive = true
        setRows(null)
        supabase.from('guardians')
            .select('id, first_name, last_name_paternal, relationship, phone, phone_alt1, phone_alt2')
            .eq('student_id', studentId)
            .then(({ data }) => { if (alive) setRows((data ?? []) as GuardianPhones[]) })
        return () => { alive = false }
    }, [studentId])

    if (rows === null) return null

    return (
        <div className="squishy-card bg-white p-5 sm:p-6">
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-rose-500" /> Contactos de emergencia
            </h3>
            {rows.length === 0 ? (
                <p className="mt-3 text-sm font-bold text-amber-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Sin tutor registrado. Captúralo en el expediente del alumno.
                </p>
            ) : (
                <ul className="mt-3 space-y-3">
                    {rows.map(g => {
                        const phones = [g.phone, g.phone_alt1, g.phone_alt2].map(normalizePhone).filter(p => p.length === 10)
                        return (
                            <li key={g.id}>
                                <p className="text-sm font-black text-slate-800">
                                    {[g.first_name, g.last_name_paternal].filter(Boolean).join(' ')}
                                    <span className="ml-2 text-xs font-bold text-slate-500">{g.relationship}</span>
                                </p>
                                {phones.length === 0 ? (
                                    <p className="text-xs font-bold text-amber-800 mt-1">Sin teléfono. Pídelo a la familia.</p>
                                ) : (
                                    <div className="flex flex-wrap gap-2 mt-1.5">
                                        {phones.map((p, i) => (
                                            <a key={p + i} href={`tel:${p}`}
                                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${i === 0 ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-700'}`}>
                                                <Phone className="w-3.5 h-3.5" /> {formatPhone(p)}
                                                <span className="text-[10px] font-black opacity-80">{i === 0 ? 'PRINCIPAL' : `RESPALDO ${i}`}</span>
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}
