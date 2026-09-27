import { Store } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { Radio, WizardAlert, WizardField, wizardChoice, wizardInput } from '../../../components/wizard/Wizard'

export interface CooperativeSetup {
    hasCooperative: boolean | null
    name: string
    registrationKey: string
    unitName: string
    /** Aportación por socio que fija el docente (por defecto $5.00). */
    fee: number | ''
}

export const emptyCooperative: CooperativeSetup = { hasCooperative: null, name: '', registrationKey: '', unitName: '', fee: 5 }

export const cooperativeIsValid = (c: CooperativeSetup) =>
    c.hasCooperative === false || (c.hasCooperative === true && c.name.trim().length > 1 && c.registrationKey.trim().length > 1)

/** Pregunta condicional del asistente: solo para Secundaria Técnica + Tecnología. */
export const CooperativeFields = ({ value, onChange, showUnit = true }: { value: CooperativeSetup; onChange: (v: CooperativeSetup) => void; showUnit?: boolean }) => {
    const set = (patch: Partial<CooperativeSetup>) => onChange({ ...value, ...patch })
    return (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 sm:p-5 space-y-4">
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-white text-indigo-600 flex items-center justify-center border border-indigo-100">
                    <Store className="w-5 h-5" />
                </div>
                <div>
                    <p className="text-sm font-black text-slate-900">¿La escuela cuenta con Cooperativa de Producción / Escolar? <span className="text-rose-500">*</span></p>
                    <p className="text-xs text-slate-500 mt-0.5">Si respondes que sí, activaremos el apartado “Cooperativa Escolar y Proyectos Productivos” en tu panel.</p>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <button type="button" className={wizardChoice(value.hasCooperative === true)} onClick={() => set({ hasCooperative: true })}>
                    <Radio checked={value.hasCooperative === true} /> Sí
                </button>
                <button type="button" className={wizardChoice(value.hasCooperative === false)} onClick={() => set({ hasCooperative: false })}>
                    <Radio checked={value.hasCooperative === false} /> No
                </button>
            </div>
            {value.hasCooperative && (
                <div className="grid sm:grid-cols-2 gap-4">
                    <WizardField label="Nombre de la cooperativa" required className="sm:col-span-2">
                        <input className={wizardInput} value={value.name} onChange={e => set({ name: e.target.value })}
                            placeholder="Ej. Sociedad Cooperativa Escolar “Benito Juárez” S.C. de R.L." />
                    </WizardField>
                    <WizardField label="Clave de registro" required hint="Clave asignada por el Área de Producción.">
                        <input className={wizardInput} value={value.registrationKey} onChange={e => set({ registrationKey: e.target.value.toUpperCase() })}
                            placeholder="Ej. CE-07-123" />
                    </WizardField>
                    <WizardField label="Aportación por socio ($)" hint="Tú decides el monto; puedes cambiarlo después.">
                        <input className={wizardInput} type="number" min="0" step="0.5" inputMode="decimal" value={value.fee ?? ''}
                            onChange={e => set({ fee: e.target.value === '' ? '' : Number(e.target.value) })} />
                    </WizardField>
                    {showUnit && <WizardField label="Tu taller / énfasis" hint="Opcional. Ej. Agricultura, Electricidad.">
                        <input className={wizardInput} value={value.unitName} onChange={e => set({ unitName: e.target.value })}
                            placeholder="Ej. Agricultura" />
                    </WizardField>}
                </div>
            )}
            {value.hasCooperative === true && !cooperativeIsValid(value) && (
                <WizardAlert tone="warning">El nombre y la clave de la cooperativa son obligatorios.</WizardAlert>
            )}
        </div>
    )
}

/** Crea o actualiza la cooperativa de la escuela y registra el taller del docente. */
export async function saveCooperativeSetup(tenantId: string, userId: string | null, coop: CooperativeSetup) {
    if (!coop.hasCooperative) return null
    const { data: row, error } = await supabase
        .from('cooperatives' as any)
        .upsert({
            tenant_id: tenantId, name: coop.name.trim(), registration_key: coop.registrationKey.trim(), updated_at: new Date().toISOString(),
            ...(coop.fee !== '' && coop.fee != null && Number(coop.fee) >= 0 ? { membership_fee: Number(coop.fee), certificate_value: Number(coop.fee) } : {}),
        }, { onConflict: 'tenant_id' })
        .select('id')
        .single()
    if (error) throw error
    const coopId = (row as any).id as string
    if (!userId) return coopId
    const unitName = coop.unitName.trim() || 'Tecnología'
    const { data: existing } = await supabase.from('coop_production_units' as any)
        .select('id').eq('cooperative_id', coopId).eq('teacher_id', userId).limit(1)
    if (!existing || existing.length === 0) {
        await supabase.from('coop_production_units' as any).insert({ tenant_id: tenantId, cooperative_id: coopId, teacher_id: userId, name: unitName })
    }
    return coopId
}
