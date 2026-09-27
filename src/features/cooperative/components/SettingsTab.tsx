import { useState } from 'react'
import { Building2, Save, Users, Wrench } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useToast } from '../../../components/ui/Toast'
import { WizardAlert, WizardField } from '../../../components/wizard/Wizard'
import { DEFAULT_HEADER_LINES, num, type Board, type Cooperative } from '../lib/types'
import type { CoopBundleCtx } from './shared'
import { Btn, Card, inputSm } from './ui'

const db = supabase as any

const BOARD: [keyof Board, string][] = [
    ['presidente', 'Presidente del Consejo de Administración'],
    ['tesorero', 'Tesorero'],
    ['secretario', 'Secretario'],
    ['vigilancia', 'Comité de Vigilancia'],
    ['coordinador', 'Coordinador de Actividades Tecnológicas'],
    ['director', 'Director(a) de la escuela'],
]

export const SettingsTab = ({ bundle, onChanged }: { bundle: CoopBundleCtx; onChanged: () => void }) => {
    const { ctx, units, myUnit } = bundle
    const { showToast } = useToast()
    const c = ctx.coop
    const [form, setForm] = useState<Cooperative>({ ...c, board: { ...(c.board ?? {}) }, distribution: { ...(c.distribution ?? { social: 40, repartible: 40, reserva: 20 }) } })
    const [headers, setHeaders] = useState((c.header_lines?.length ? c.header_lines : DEFAULT_HEADER_LINES).join('\n'))
    const [unit, setUnit] = useState({ name: myUnit?.name ?? '', weekly_hours: myUnit?.weekly_hours ?? '' as number | '' })
    const [saving, setSaving] = useState(false)
    const pct = num(form.distribution.social) + num(form.distribution.repartible) + num(form.distribution.reserva)

    const save = async () => {
        if (!form.name.trim() || !form.registration_key.trim()) return showToast('El nombre y la clave son obligatorios.', 'warning')
        if (Math.round(pct) !== 100) return showToast('La distribución debe sumar 100%.', 'warning')
        setSaving(true)
        const { error } = await db.from('cooperatives').update({
            name: form.name.trim(), registration_key: form.registration_key.trim().toUpperCase(), kind: form.kind,
            membership_fee: num(form.membership_fee) || 5, certificate_value: num(form.certificate_value) || 5,
            board: form.board, distribution: { social: num(form.distribution.social), repartible: num(form.distribution.repartible), reserva: num(form.distribution.reserva) },
            header_lines: headers.split('\n').map(l => l.trim()).filter(Boolean), updated_at: new Date().toISOString(),
        }).eq('id', c.id)
        let unitError = null
        if (unit.name.trim()) {
            const payload = { name: unit.name.trim().toUpperCase(), weekly_hours: unit.weekly_hours === '' ? null : num(unit.weekly_hours) }
            unitError = myUnit
                ? (await db.from('coop_production_units').update(payload).eq('id', myUnit.id)).error
                : (await db.from('coop_production_units').insert({ ...payload, tenant_id: c.tenant_id, cooperative_id: c.id, teacher_id: ctx.teacher.id })).error
        }
        setSaving(false)
        if (error || unitError) return showToast('No se pudo guardar: ' + (error ?? unitError).message, 'error')
        showToast('Configuración guardada', 'success')
        onChanged()
    }

    const setBoard = (k: keyof Board, v: string) => setForm(f => ({ ...f, board: { ...f.board, [k]: v.toUpperCase() } }))
    const setDist = (k: 'social' | 'repartible' | 'reserva', v: string) => setForm(f => ({ ...f, distribution: { ...f.distribution, [k]: v === '' ? ('' as any) : Number(v) } }))

    return (
        <div className="space-y-4 pb-28 sm:pb-0">
            <Card title="Cooperativa" icon={Building2}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <WizardField label="Nombre" required className="sm:col-span-2"><input className={inputSm} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></WizardField>
                    <WizardField label="Clave de registro" required><input className={inputSm} value={form.registration_key} onChange={e => setForm({ ...form, registration_key: e.target.value.toUpperCase() })} /></WizardField>
                    <WizardField label="Tipo">
                        <select className={inputSm} value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as Cooperative['kind'] })}>
                            <option value="PRODUCCION">Producción</option><option value="CONSUMO">Consumo</option><option value="PRODUCCION_CONSUMO">Producción y consumo</option>
                        </select>
                    </WizardField>
                    <WizardField label="Aportación de nuevo socio ($)"><input className={inputSm} type="number" min="0" step="0.5" value={form.membership_fee} onChange={e => setForm({ ...form, membership_fee: Number(e.target.value) })} /></WizardField>
                    <WizardField label="Valor del certificado ($)" hint="Se devuelve al egresar de 3er grado."><input className={inputSm} type="number" min="0" step="0.5" value={form.certificate_value} onChange={e => setForm({ ...form, certificate_value: Number(e.target.value) })} /></WizardField>
                </div>
            </Card>

            <Card title="Mi unidad de producción" icon={Wrench}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <WizardField label="Taller / énfasis tecnológico" className="sm:col-span-2"><input className={inputSm} value={unit.name} onChange={e => setUnit({ ...unit, name: e.target.value })} placeholder="Ej. AGRICULTURA" /></WizardField>
                    <WizardField label="Horas frente a grupo (semana)"><input className={inputSm} type="number" min="0" value={unit.weekly_hours} onChange={e => setUnit({ ...unit, weekly_hours: e.target.value === '' ? '' : Number(e.target.value) })} /></WizardField>
                </div>
                {units.length > 1 && (
                    <p className="text-xs text-slate-500 mt-3">Unidades registradas: {units.map(u => u.name).join(', ')}.</p>
                )}
            </Card>

            <Card title="Consejo de administración y firmas" icon={Users}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {BOARD.map(([k, l]) => (
                        <WizardField key={k} label={l}><input className={inputSm} value={form.board[k] ?? ''} onChange={e => setBoard(k, e.target.value)} placeholder={k === 'director' ? ctx.school.director : ''} /></WizardField>
                    ))}
                </div>
                <p className="text-xs text-slate-500 mt-3">Los nombres aparecen en las líneas de firma de los formatos.</p>
            </Card>

            <Card title="Distribución del rendimiento neto">
                <div className="grid grid-cols-3 gap-3">
                    <WizardField label="Fondo social %"><input className={inputSm} type="number" min="0" max="100" value={form.distribution.social} onChange={e => setDist('social', e.target.value)} /></WizardField>
                    <WizardField label="Fondo repartible %"><input className={inputSm} type="number" min="0" max="100" value={form.distribution.repartible} onChange={e => setDist('repartible', e.target.value)} /></WizardField>
                    <WizardField label="Fondo de reserva %"><input className={inputSm} type="number" min="0" max="100" value={form.distribution.reserva} onChange={e => setDist('reserva', e.target.value)} /></WizardField>
                </div>
                {Math.round(pct) !== 100 && <div className="mt-3"><WizardAlert tone="warning">Suman {pct}%; deben sumar 100%.</WizardAlert></div>}
            </Card>

            <Card title="Encabezado oficial de los formatos">
                <WizardField label="Una línea por renglón" hint="Ajústalo si tu entidad usa otro encabezado.">
                    <textarea className={`${inputSm} min-h-[130px] font-mono text-xs`} value={headers} onChange={e => setHeaders(e.target.value)} />
                </WizardField>
            </Card>

            <div className="fixed sm:static left-0 right-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-0 z-30 bg-white/95 backdrop-blur border-t border-slate-100 sm:border-0 sm:bg-transparent px-4 py-3 sm:p-0 flex justify-end">
                <Btn tone="primary" icon={Save} onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar configuración'}</Btn>
            </div>
        </div>
    )
}
