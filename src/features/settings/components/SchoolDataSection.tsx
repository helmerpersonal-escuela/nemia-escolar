import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, MapPin, Phone, Save, School, Image as ImageIcon } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { useToast } from '../../../components/ui/Toast'
import { WizardField, wizardInput, wizardChoice, Radio } from '../../../components/wizard/Wizard'
import { ImageUpload, ImageSpecHint, LOGO_SPEC } from '../../../components/common/ImageUpload'
import { SchoolLocationFields, emptyLocation, isLocationComplete, loadSchoolLocation, saveSchoolLocation, type SchoolLocation } from '../../../components/location/SchoolLocationFields'
import { phaseFor } from '../../../lib/nemCatalog'

/**
 * "Datos de la escuela" en Configuración: muestra y edita en un solo lugar TODO lo que se capturó
 * al crear el espacio (identificación, nivel, ubicación, contacto y logotipos).
 * Lee y escribe en tenants + school_details, las mismas tablas que usan los asistentes.
 */

type Level = 'PRIMARY' | 'SECONDARY' | 'TELESECUNDARIA'
interface SchoolForm {
    name: string; cct: string; level: Level; secondaryType: '' | 'GENERAL' | 'TECNICA'; grade: number | null
    shift: string; regime: string; zone: string; sector: string
    phone: string; email: string; director: string
    logoLeft: string; logoRight: string
    legacyAddress: string
}

const EMPTY: SchoolForm = { name: '', cct: '', level: 'SECONDARY', secondaryType: '', grade: null, shift: 'MORNING', regime: '', zone: '', sector: '', phone: '', email: '', director: '', logoLeft: '', logoRight: '', legacyAddress: '' }
const LEVELS: [Level, string][] = [['PRIMARY', 'Primaria'], ['SECONDARY', 'Secundaria'], ['TELESECUNDARIA', 'Telesecundaria']]
const Section = ({ icon: Icon, title, hint, children }: { icon: any; title: string; hint?: string; children: React.ReactNode }) => (
    <section className="rounded-3xl border border-slate-100 bg-white p-5 sm:p-6 space-y-4">
        <header>
            <h4 className="text-base font-black text-slate-900 flex items-center gap-2"><Icon className="w-5 h-5 text-indigo-600" /> {title}</h4>
            {hint && <p className="text-sm text-slate-500 mt-1">{hint}</p>}
        </header>
        {children}
    </section>
)

export const SchoolDataSection = ({ readOnly = false }: { readOnly?: boolean }) => {
    const { data: tenantCtx } = useTenant()
    const tenantId = tenantCtx?.id
    const isSchool = (tenantCtx as any)?.type !== 'INDEPENDENT'
    const { showToast } = useToast()
    const qc = useQueryClient()
    const [form, setForm] = useState<SchoolForm>(EMPTY)
    const [location, setLocation] = useState<SchoolLocation>(emptyLocation)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const set = (p: Partial<SchoolForm>) => setForm(f => ({ ...f, ...p }))

    useEffect(() => {
        if (!tenantId) return
        let alive = true
        ;(async () => {
            setLoading(true)
            const [{ data: t }, { data: sd }, loc] = await Promise.all([
                supabase.from('tenants').select('name, cct, educational_level, secondary_type, grade, phone, address, logo_left_url, logo_right_url').eq('id', tenantId).maybeSingle(),
                supabase.from('school_details').select('official_name, cct, shift, regime, zone, sector, phone, email, director_name, secondary_type, educational_level, logo_url, header_logo_url').eq('tenant_id', tenantId).maybeSingle(),
                loadSchoolLocation(tenantId).catch(() => null),
            ])
            if (!alive) return
            const tt = (t ?? {}) as any, s = (sd ?? {}) as any
            setForm({
                name: s.official_name || tt.name || '',
                cct: s.cct || tt.cct || '',
                level: (tt.educational_level || s.educational_level || 'SECONDARY') as Level,
                secondaryType: (tt.secondary_type || s.secondary_type || '') as any,
                grade: tt.grade ?? null,
                shift: s.shift || 'MORNING',
                regime: s.regime || '',
                zone: s.zone || '',
                sector: s.sector || '',
                phone: s.phone || tt.phone || '',
                email: s.email || '',
                director: s.director_name || '',
                // Si el espacio se creó con el asistente, los logos quedaron en school_details
                logoLeft: tt.logo_left_url || s.header_logo_url || '',
                logoRight: tt.logo_right_url || s.logo_url || '',
                legacyAddress: loc ? '' : (tt.address || ''),
            })
            if (loc) setLocation(loc)
            setLoading(false)
        })()
        return () => { alive = false }
    }, [tenantId])

    const save = async () => {
        if (!tenantId) return
        if (!form.name.trim()) { showToast('Escribe el nombre de la escuela.', 'error'); return }
        if (isSchool && !form.cct.trim()) { showToast('La CCT es obligatoria para las escuelas.', 'error'); return }
        if (form.level === 'SECONDARY' && !form.secondaryType) { showToast('Indica si es Secundaria General o Técnica.', 'error'); return }
        if (location.state && !isLocationComplete(location)) { showToast('Completa el municipio y la colonia de la escuela.', 'error'); return }
        setSaving(true)
        try {
            const name = form.name.trim().toUpperCase(), cct = form.cct.trim().toUpperCase()
            const grade = form.level === 'PRIMARY' ? form.grade : null
            const { error: e1 } = await supabase.from('tenants').update({
                name, cct,
                educational_level: form.level,
                secondary_type: form.level === 'SECONDARY' ? form.secondaryType : null,
                grade,
                phase: form.level === 'PRIMARY' ? phaseFor('PRIMARY', grade) : phaseFor(form.level, null),
                phone: form.phone.trim() || null,
                logo_left_url: form.logoLeft || null,
                logo_right_url: form.logoRight || null,
            } as any).eq('id', tenantId)
            if (e1) throw e1
            const { error: e2 } = await supabase.from('school_details').upsert({
                tenant_id: tenantId,
                official_name: name,
                cct,
                shift: form.shift || null,
                regime: form.regime || null,
                zone: form.zone.trim() || null,
                sector: form.sector.trim() || null,
                phone: form.phone.trim() || null,
                email: form.email.trim() || null,
                director_name: form.director.trim() || null,
                educational_level: form.level,
                secondary_type: form.level === 'SECONDARY' ? form.secondaryType : null,
                updated_at: new Date().toISOString(),
            } as any, { onConflict: 'tenant_id' })
            if (e2) throw e2
            if (location.state) await saveSchoolLocation(tenantId, location, { name, cct })
            await qc.invalidateQueries({ queryKey: ['tenant'] })
            showToast('Datos de la escuela guardados.', 'success')
        } catch (err: any) {
            showToast(`No se pudieron guardar los datos: ${err.message}`, 'error')
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <p className="text-sm text-slate-500 flex items-center gap-2 p-6"><Loader2 className="w-4 h-4 animate-spin" /> Cargando datos de la escuela…</p>

    const phase = form.level === 'PRIMARY' ? phaseFor('PRIMARY', form.grade) : phaseFor(form.level, null)

    return (
        <div className="space-y-6">
            <div className="border-b border-slate-100 pb-5">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Datos de la escuela</h3>
                <p className="text-sm text-slate-500 mt-1">Lo que registraste al crear tu espacio. Aparece en tus planeaciones, programa analítico y documentos.</p>
                {readOnly && <p className="mt-3 text-sm font-bold text-amber-800 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-2">Solo la dirección puede modificar estos datos.</p>}
            </div>

            <fieldset disabled={readOnly || saving} className="space-y-6">
                <Section icon={School} title="Identificación" hint="Nombre y clave con los que la escuela aparece en documentos oficiales.">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <WizardField label="Nombre de la escuela" required className="sm:col-span-2">
                            <input className={wizardInput} value={form.name} onChange={e => set({ name: e.target.value.toUpperCase() })} placeholder="Ej. ESC. SEC. TÉCNICA No. 37" />
                        </WizardField>
                        <WizardField label="CCT (Clave del Centro de Trabajo)" required={isSchool} hint={isSchool ? undefined : 'Opcional si trabajas por tu cuenta.'}>
                            <input className={`${wizardInput} font-mono`} value={form.cct} onChange={e => set({ cct: e.target.value.toUpperCase() })} placeholder="07DST0037X" />
                        </WizardField>
                        <WizardField label="Turno">
                            <select className={wizardInput} value={form.shift} onChange={e => set({ shift: e.target.value })}>
                                <option value="MORNING">Matutino</option>
                                <option value="AFTERNOON">Vespertino</option>
                                <option value="FULL_TIME">Tiempo completo</option>
                            </select>
                        </WizardField>
                        <WizardField label="Zona escolar"><input className={wizardInput} value={form.zone} onChange={e => set({ zone: e.target.value })} placeholder="Ej. 054" /></WizardField>
                        <WizardField label="Sector"><input className={wizardInput} value={form.sector} onChange={e => set({ sector: e.target.value })} placeholder="Ej. 01" /></WizardField>
                        {isSchool && (
                            <WizardField label="Régimen" className="sm:col-span-2">
                                <select className={wizardInput} value={form.regime} onChange={e => set({ regime: e.target.value })}>
                                    <option value="">Sin especificar</option>
                                    <option value="PÚBLICO (FEDERAL)">Público (federal)</option>
                                    <option value="PÚBLICO (ESTATAL)">Público (estatal)</option>
                                    <option value="TRANSFERIDO">Transferido</option>
                                    <option value="PARTICULAR">Particular / privado</option>
                                </select>
                            </WizardField>
                        )}
                    </div>

                    <div>
                        <span className="block text-xs font-black text-slate-600 mb-1.5">Nivel educativo <span className="text-rose-500">*</span></span>
                        <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-2">
                            {LEVELS.map(([v, label]) => (
                                <button key={v} type="button" onClick={() => set({ level: v, secondaryType: v === 'SECONDARY' ? form.secondaryType : '', grade: v === 'PRIMARY' ? form.grade : null })} className={wizardChoice(form.level === v)}>
                                    <Radio checked={form.level === v} /> {label}
                                </button>
                            ))}
                        </div>
                    </div>
                    {form.level === 'SECONDARY' && (
                        <div>
                            <span className="block text-xs font-black text-slate-600 mb-1.5">Tipo de secundaria <span className="text-rose-500">*</span></span>
                            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
                                {([['GENERAL', 'Secundaria General'], ['TECNICA', 'Secundaria Técnica']] as const).map(([v, label]) => (
                                    <button key={v} type="button" onClick={() => set({ secondaryType: v })} className={wizardChoice(form.secondaryType === v)}>
                                        <Radio checked={form.secondaryType === v} /> {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {form.level === 'PRIMARY' && !isSchool && (
                        <WizardField label="Grado que atiendes" hint={phase ? `Corresponde a la Fase ${phase} de la NEM.` : undefined}>
                            <select className={wizardInput} value={form.grade ?? ''} onChange={e => set({ grade: e.target.value ? Number(e.target.value) : null })}>
                                <option value="">Selecciona el grado</option>
                                {[1, 2, 3, 4, 5, 6].map(g => <option key={g} value={g}>{g}° grado</option>)}
                            </select>
                        </WizardField>
                    )}
                    {phase && form.level !== 'PRIMARY' && <p className="text-xs text-slate-500">Fase {phase} de la Nueva Escuela Mexicana.</p>}
                </Section>

                <Section icon={MapPin} title="Ubicación" hint="Estado, municipio y colonia del catálogo oficial. Si tu colonia no aparece, escríbela.">
                    {form.legacyAddress && !location.state && (
                        <p className="text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
                            <strong>Dirección registrada antes:</strong> {form.legacyAddress}. Selecciona el estado, municipio y colonia para completarla.
                        </p>
                    )}
                    <SchoolLocationFields value={location} onChange={setLocation} />
                </Section>

                <Section icon={Phone} title="Contacto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <WizardField label="Teléfono"><input className={wizardInput} inputMode="tel" value={form.phone} onChange={e => set({ phone: e.target.value })} placeholder="10 dígitos" /></WizardField>
                        <WizardField label="Correo de la escuela"><input className={wizardInput} type="email" value={form.email} onChange={e => set({ email: e.target.value })} placeholder="escuela@ejemplo.edu.mx" /></WizardField>
                        {isSchool && <WizardField label="Director(a)" className="sm:col-span-2"><input className={wizardInput} value={form.director} onChange={e => set({ director: e.target.value })} placeholder="Nombre completo" /></WizardField>}
                    </div>
                </Section>

                <Section icon={ImageIcon} title="Logotipos para documentos" hint="Aparecen en el encabezado de planeaciones, boletas y reportes: el escudo a la izquierda y el logo de tu escuela a la derecha.">
                    <ImageSpecHint spec={LOGO_SPEC} className="mb-4" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <ImageUpload spec={LOGO_SPEC} showSpec={false} label="Escudo oficial (izquierda)" currentUrl={form.logoLeft} onUpload={url => set({ logoLeft: url })} bucket="school-assets" />
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <ImageUpload spec={LOGO_SPEC} showSpec={false} label="Logo de la escuela (derecha)" currentUrl={form.logoRight} onUpload={url => set({ logoRight: url })} bucket="school-assets" />
                        </div>
                    </div>
                </Section>
            </fieldset>

            {!readOnly && (
                <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-4 z-20 flex justify-end">
                    <button type="button" onClick={save} disabled={saving}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 text-white text-sm font-black shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 disabled:opacity-50">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar cambios
                    </button>
                </div>
            )}
        </div>
    )
}
