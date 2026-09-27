import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import {
    School,
    MapPin,
    PhoneCall,
    BookOpen,
    ShieldCheck,
    Check,
    Plus,
    X,
    Upload,
    Globe,
    Instagram,
    Facebook,
    Twitter
} from 'lucide-react'
import { WizardLayout, WizardFooter, WizardStepHeader, WizardField, WizardAlert, WizardSaving, wizardInput, wizardChoice, Radio } from '../../../components/wizard/Wizard'
import { CooperativeFields, emptyCooperative, cooperativeIsValid, saveCooperativeSetup, type CooperativeSetup } from '../../cooperative/components/CooperativeFields'
import { DateInput } from '../../../components/ui/DateInput'
import { OfficialCycleNote, type CycleSource } from '../../../components/academic/OfficialCycleNote'
import { useOfficialCycle, cycleNameFromDates } from '../../../lib/officialCalendar'

export const SchoolOnboardingWizard = ({ onComplete }: { onComplete: () => void }) => {
    const navigate = useNavigate()
    const { data: tenant } = useTenant()

    // Persistence: load initial step from storage if available
    const [step, setStep] = useState(() => {
        const saved = sessionStorage.getItem('vunlek_school_onboarding_step')
        return saved ? parseInt(saved, 10) : 0
    })

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // --- FORM STATE ---
    const [formData, setFormData] = useState(() => {
        const saved = sessionStorage.getItem('vunlek_school_onboarding_data')
        return saved ? JSON.parse(saved) : {
            // 1. Identity
            official_name: '',
            cct: '',
            shift: 'MORNING' as 'MORNING' | 'AFTERNOON' | 'FULL_TIME',
            zone: '',
            sector: '',
            regime: 'PÚBLICO (FEDERAL)',

            // 2. Location
            address_street: '',
            address_neighborhood: '',
            address_zip_code: '',
            address_municipality: '',
            address_state: '',

            // 3. Contact
            phone: '',
            email: '',
            social_media: {
                website: '',
                facebook: '',
                instagram: '',
                twitter: ''
            },

            // 4. Academic
            educational_level: 'SECONDARY',
            secondary_type: null as null | 'GENERAL' | 'TECNICA',
            curriculum_plan: 'PLAN 2022 (NEM)',
            workshops: [] as string[],
            current_cycle_name: cycleNameFromDates('2026-08-31', '2027-07-09'),
            current_cycle_start: '2026-08-31',
            current_cycle_end: '2027-07-09',
            cycle_source: 'estimado' as CycleSource,

            // 5. Auth & Logos
            director_name: '',
            director_curp: '',
            logo_url: '',
            header_logo_url: '',
            digital_seal_url: ''
        }
    })

    const [newWorkshop, setNewWorkshop] = useState('')
    const [coop, setCoop] = useState<CooperativeSetup>(() => {
        try { return { ...emptyCooperative, ...JSON.parse(sessionStorage.getItem('vunlek_school_onboarding_coop') || '{}') } } catch { return emptyCooperative }
    })
    useEffect(() => { sessionStorage.setItem('vunlek_school_onboarding_coop', JSON.stringify(coop)) }, [coop])
    const isTecnica = formData.educational_level === 'SECONDARY' && formData.secondary_type === 'TECNICA'
    // Al corregir el campo, se quita el aviso
    useEffect(() => { setError(null) }, [coop, formData.secondary_type, formData.educational_level, formData.official_name, formData.cct])

    // Con conexión: nombre, inicio y fin del ciclo desde el calendario oficial de la SEP
    // (si el usuario no los ha cambiado). Se pueden editar.
    const { data: officialCycle, isLoading: officialLoading } = useOfficialCycle()
    const applyOfficialCycle = () => {
        if (!officialCycle) return
        setFormData((prev: any) => ({ ...prev, current_cycle_name: officialCycle.name, current_cycle_start: officialCycle.startDate, current_cycle_end: officialCycle.endDate, cycle_source: 'oficial' }))
    }
    useEffect(() => {
        if (officialCycle && (formData.cycle_source ?? 'estimado') === 'estimado') applyOfficialCycle()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [officialCycle])
    const [searchParams] = useSearchParams()

    // NEW: Sync persistence
    useEffect(() => {
        // Only save if we have actual data
        if (formData.official_name || formData.cct) {
            sessionStorage.setItem('vunlek_school_onboarding_data', JSON.stringify(formData))
        }
    }, [formData])

    useEffect(() => {
        sessionStorage.setItem('vunlek_school_onboarding_step', step.toString())
    }, [step])

    useEffect(() => {
        // Handle persistent syncing flag
        const status = searchParams.get('status')
        if (status === 'approved') {
            sessionStorage.setItem('vunlek_payment_syncing', 'true')
        }
    }, [searchParams])

    useEffect(() => {
        // If storage is EMPTY or only contains the DEFAULT skeleton, try to seed from tenant
        const saved = sessionStorage.getItem('vunlek_school_onboarding_data')
        const isDefault = !saved || JSON.parse(saved).official_name === ''

        if (tenant && isDefault) {
            setFormData((prev: any) => ({
                ...prev,
                official_name: tenant.name?.toUpperCase() || '',
                cct: tenant.cct || '',
                logo_url: tenant.logoUrl || ''
            }))
        }
    }, [tenant])

    const clearPersistence = () => {
        sessionStorage.removeItem('vunlek_school_onboarding_step')
        sessionStorage.removeItem('vunlek_school_onboarding_data')
        sessionStorage.removeItem('vunlek_payment_syncing')
        sessionStorage.removeItem('vunlek_school_onboarding_coop')
    }

    const handleCancelRegistration = async () => {
        if (confirm('¿Estás seguro de cancelar tu registro? Toda tu información será eliminada para liberar tu correo.')) {
            setLoading(true)
            try {
                // Call RPC to delete own account
                const { error } = await supabase.rpc('delete_own_account')
                if (error) throw error

                // Sign out just in case
                await supabase.auth.signOut()

                // Clear storage
                clearPersistence()
                localStorage.clear()

                // Redirect to login
                window.location.href = '/login'
            } catch (err: any) {
                console.error('Error canceling registration:', err)
                alert('Error al cancelar: ' + err.message)
                setLoading(false)
            }
        }
    }

    const stepError = (): string | null => {
        if (step === 0 && (!formData.official_name?.trim() || !formData.cct?.trim())) return 'Escribe el nombre oficial y la CCT del plantel.'
        if (step === 3) {
            if (formData.educational_level === 'SECONDARY' && !formData.secondary_type) return 'Indica si la secundaria es General o Técnica.'
            if (isTecnica && !cooperativeIsValid(coop)) return coop.hasCooperative === null
                ? 'Indica si la escuela cuenta con Cooperativa de Producción / Escolar.'
                : 'El nombre y la clave de la cooperativa son obligatorios.'
        }
        return null
    }

    const handleSaveStep = async () => {
        const invalid = stepError()
        if (invalid) { setError(invalid); window.scrollTo({ top: 0, behavior: 'smooth' }); return }
        setError(null)
        if (step < 4) {
            setStep(step + 1)
            window.scrollTo(0, 0)
            return
        }

        // Final Save
        setLoading(true)
        setError(null)
        try {
            // 1. Save to school_details
            // El ciclo no va en school_details: se guarda como ciclo escolar activo (academic_years).
            const { current_cycle_start, current_cycle_end, current_cycle_name, cycle_source, ...schoolData } = formData
            void cycle_source

            const { error: schoolError } = await supabase
                .from('school_details')
                .upsert({
                    tenant_id: tenant?.id,
                    ...schoolData,
                    secondary_type: formData.educational_level === 'SECONDARY' ? formData.secondary_type : null,
                    official_name: formData.official_name.toUpperCase(),
                    cct: formData.cct.toUpperCase(),
                    updated_at: new Date().toISOString()
                })

            if (schoolError) throw schoolError

            // 1b. Ciclo escolar activo (antes las fechas de este paso se descartaban)
            if (current_cycle_start && current_cycle_end && tenant?.id) {
                const { data: activeYear } = await supabase
                    .from('academic_years')
                    .select('id')
                    .eq('tenant_id', tenant.id)
                    .eq('is_active', true)
                    .maybeSingle()
                const yearRow = {
                    tenant_id: tenant.id,
                    name: (current_cycle_name || cycleNameFromDates(current_cycle_start, current_cycle_end)).toUpperCase(),
                    start_date: current_cycle_start,
                    end_date: current_cycle_end,
                    is_active: true,
                }
                const { error: yearError } = activeYear
                    ? await supabase.from('academic_years').update(yearRow).eq('id', activeYear.id)
                    : await supabase.from('academic_years').insert(yearRow)
                if (yearError) throw yearError
            }

            // 2. Mark onboarding as completed in tenants
            const { error: tenantError } = await supabase
                .from('tenants')
                .update({
                    onboarding_completed: true,
                    secondary_type: formData.educational_level === 'SECONDARY' ? formData.secondary_type : null,
                    name: formData.official_name.toUpperCase(),
                    cct: formData.cct.toUpperCase()
                })
                .eq('id', tenant?.id)

            if (tenantError) throw tenantError

            // 3. Cooperativa escolar (solo Secundaria Técnica)
            if (isTecnica && coop.hasCooperative && tenant?.id) await saveCooperativeSetup(tenant.id, null, coop)

            clearPersistence()
            onComplete()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const steps = [
        { label: 'Identidad', icon: School },
        { label: 'Ubicación', icon: MapPin },
        { label: 'Contacto', icon: PhoneCall },
        { label: 'Académica', icon: BookOpen },
        { label: 'Autorización', icon: ShieldCheck }
    ]

    const handleAddWorkshop = () => {
        if (newWorkshop.trim()) {
            setFormData((prev: any) => ({
                ...prev,
                workshops: [...prev.workshops, newWorkshop.trim().toUpperCase()]
            }))
            setNewWorkshop('')
        }
    }

    const handleRemoveWorkshop = (index: number) => {
        setFormData((prev: any) => ({
            ...prev,
            workshops: prev.workshops.filter((_: any, i: number) => i !== index)
        }))
    }

    const set = (patch: Record<string, any>) => setFormData((prev: any) => ({ ...prev, ...patch }))
    const setSocial = (key: string, value: string) => setFormData((prev: any) => ({ ...prev, social_media: { ...prev.social_media, [key]: value } }))
    const goBack = () => { setError(null); setStep(step - 1); window.scrollTo(0, 0) }

    return (
        <WizardLayout
            eyebrow="Registro de escuela"
            title="Configuración institucional"
            subtitle="Configura el espacio digital oficial de tu plantel."
            steps={steps}
            current={step}
            onStepClick={i => { setError(null); setStep(i) }}
            width="lg"
            footer={
                <WizardFooter
                    onBack={step === 0 ? handleCancelRegistration : goBack}
                    backLabel={step === 0 ? 'Cancelar registro' : 'Anterior'}
                    onNext={handleSaveStep}
                    nextLabel={step === steps.length - 1 ? 'Finalizar registro' : 'Siguiente'}
                    nextIcon={step === steps.length - 1 ? Check : undefined}
                    tone={step === steps.length - 1 ? 'success' : 'primary'}
                    loading={loading}
                />
            }
        >
            {loading && <WizardSaving label="Guardando configuración…" />}
            {error && <div className="mb-6"><WizardAlert>{error}</WizardAlert></div>}

            {step === 0 && (
                <>
                    <WizardStepHeader icon={School} title="Identidad institucional" description="Datos legales que identifican al plantel ante las autoridades." />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                        <WizardField label="Nombre oficial del plantel" required>
                            <input className={wizardInput} value={formData.official_name} onChange={e => set({ official_name: e.target.value })} placeholder="Ej. Escuela Secundaria Técnica No. 12" />
                        </WizardField>
                        <WizardField label="CCT (Clave de Centro de Trabajo)" required>
                            <input className={wizardInput} value={formData.cct} onChange={e => set({ cct: e.target.value.toUpperCase() })} placeholder="07DST0000X" />
                        </WizardField>
                        <WizardField label="Turno">
                            <select className={wizardInput} value={formData.shift} onChange={e => set({ shift: e.target.value })}>
                                <option value="MORNING">Matutino</option>
                                <option value="AFTERNOON">Vespertino</option>
                                <option value="FULL_TIME">Tiempo completo</option>
                            </select>
                        </WizardField>
                        <WizardField label="Régimen">
                            <select className={wizardInput} value={formData.regime} onChange={e => set({ regime: e.target.value })}>
                                <option value="PÚBLICO (FEDERAL)">Público (federal)</option>
                                <option value="PÚBLICO (ESTATAL)">Público (estatal)</option>
                                <option value="TRANSFERIDO">Transferido</option>
                                <option value="PARTICULAR">Particular / privado</option>
                            </select>
                        </WizardField>
                        <WizardField label="Zona escolar">
                            <input className={wizardInput} value={formData.zone} onChange={e => set({ zone: e.target.value })} placeholder="Ej. 054" />
                        </WizardField>
                        <WizardField label="Sector">
                            <input className={wizardInput} value={formData.sector} onChange={e => set({ sector: e.target.value })} placeholder="Ej. 01" />
                        </WizardField>
                    </div>
                </>
            )}

            {step === 1 && (
                <>
                    <WizardStepHeader icon={MapPin} title="Ubicación" description="Dirección oficial para documentos administrativos." />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                        <WizardField label="Calle y número" className="md:col-span-2">
                            <input className={wizardInput} value={formData.address_street} onChange={e => set({ address_street: e.target.value })} placeholder="Ej. Av. Reforma S/N" />
                        </WizardField>
                        <WizardField label="Colonia o localidad">
                            <input className={wizardInput} value={formData.address_neighborhood} onChange={e => set({ address_neighborhood: e.target.value })} placeholder="Ej. Centro" />
                        </WizardField>
                        <WizardField label="Código postal">
                            <input className={wizardInput} inputMode="numeric" value={formData.address_zip_code} onChange={e => set({ address_zip_code: e.target.value })} placeholder="00000" />
                        </WizardField>
                        <WizardField label="Municipio">
                            <input className={wizardInput} value={formData.address_municipality} onChange={e => set({ address_municipality: e.target.value })} placeholder="Ej. Tuxtla Gutiérrez" />
                        </WizardField>
                        <WizardField label="Estado">
                            <input className={wizardInput} value={formData.address_state} onChange={e => set({ address_state: e.target.value })} placeholder="Ej. Chiapas" />
                        </WizardField>
                    </div>
                </>
            )}

            {step === 2 && (
                <>
                    <WizardStepHeader icon={PhoneCall} title="Contacto" description="Canales oficiales para la comunidad escolar." />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                        <WizardField label="Teléfono institucional">
                            <input className={wizardInput} type="tel" value={formData.phone} onChange={e => set({ phone: e.target.value })} placeholder="(000) 000-0000" />
                        </WizardField>
                        <WizardField label="Correo electrónico oficial">
                            <input className={wizardInput} type="email" value={formData.email} onChange={e => set({ email: e.target.value })} placeholder="correo@escuela.gob.mx" />
                        </WizardField>
                        {([
                            ['website', Globe, 'Sitio web (opcional)'],
                            ['facebook', Facebook, 'Facebook'],
                            ['instagram', Instagram, 'Instagram'],
                            ['twitter', Twitter, 'X / Twitter'],
                        ] as const).map(([key, Icon, label]) => (
                            <WizardField key={key} label={label}>
                                <div className="relative">
                                    <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input className={`${wizardInput} pl-11`} value={formData.social_media?.[key] ?? ''} onChange={e => setSocial(key, e.target.value)} />
                                </div>
                            </WizardField>
                        ))}
                    </div>
                </>
            )}

            {step === 3 && (
                <>
                    <WizardStepHeader icon={BookOpen} title="Configuración académica" description="Nivel, plan de estudios, tecnologías y fechas del ciclo." />
                    <div className="space-y-5">
                        <WizardField label="Nivel educativo" required>
                            <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-3">
                                {[['PRIMARY', 'Primaria'], ['SECONDARY', 'Secundaria'], ['TELESECUNDARIA', 'Telesecundaria']].map(([v, l]) => (
                                    <button key={v} type="button" className={wizardChoice(formData.educational_level === v)}
                                        onClick={() => set({ educational_level: v, secondary_type: v === 'SECONDARY' ? formData.secondary_type : null })}>
                                        <Radio checked={formData.educational_level === v} /> {l}
                                    </button>
                                ))}
                            </div>
                        </WizardField>
                        {formData.educational_level === 'SECONDARY' && (
                            <WizardField label="Tipo de secundaria" required>
                                <div className="grid grid-cols-2 gap-3">
                                    {[['GENERAL', 'General'], ['TECNICA', 'Técnica']].map(([v, l]) => (
                                        <button key={v} type="button" className={wizardChoice(formData.secondary_type === v)} onClick={() => set({ secondary_type: v })}>
                                            <Radio checked={formData.secondary_type === v} /> {l}
                                        </button>
                                    ))}
                                </div>
                            </WizardField>
                        )}
                        {isTecnica && <CooperativeFields value={coop} onChange={setCoop} showUnit={false} />}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                            <WizardField label="Plan de estudios">
                                <select className={wizardInput} value={formData.curriculum_plan} onChange={e => set({ curriculum_plan: e.target.value })}>
                                    <option value="PLAN 2022 (NEM)">Plan 2022 (NEM)</option>
                                    <option value="PLAN 2017">Plan 2017 (Aprendizajes Clave)</option>
                                    <option value="PLAN 2011">Plan 2011</option>
                                </select>
                            </WizardField>
                            <WizardField label="Tecnologías / talleres" hint="Escribe el taller y presiona Agregar.">
                                <div className="flex gap-2">
                                    <input aria-label="Tecnologías / Talleres" className={`${wizardInput} min-w-0`} value={newWorkshop}
                                        onChange={e => setNewWorkshop(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddWorkshop() } }}
                                        placeholder="Ej. Carpintería" />
                                    <button type="button" aria-label="Agregar taller" onClick={handleAddWorkshop} className="shrink-0 px-4 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700">
                                        <Plus className="w-5 h-5" />
                                    </button>
                                </div>
                            </WizardField>
                        </div>
                        {formData.workshops.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {formData.workshops.map((w: string, i: number) => (
                                    <span key={i} className="pl-3 pr-1 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold flex items-center gap-1 border border-indigo-100">
                                        {w}
                                        <button type="button" aria-label={`Quitar ${w}`} onClick={() => handleRemoveWorkshop(i)} className="p-1 rounded-full hover:bg-indigo-100"><X className="w-3 h-3" /></button>
                                    </span>
                                ))}
                            </div>
                        )}
                        <div className="rounded-2xl border border-slate-100 p-4 space-y-3">
                            <WizardField label="Ciclo escolar actual">
                                <input aria-label="Nombre del ciclo escolar" className={wizardInput} value={formData.current_cycle_name} onChange={e => set({ current_cycle_name: e.target.value.toUpperCase(), cycle_source: 'manual' })} placeholder="CICLO 2026-2027" />
                            </WizardField>
                            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
                                <WizardField label="Inicio">
                                    <DateInput aria-label="Inicio del ciclo escolar" value={formData.current_cycle_start} onChange={e => set({ current_cycle_start: e.target.value, cycle_source: 'manual' })} className={wizardInput} />
                                </WizardField>
                                <WizardField label="Fin">
                                    <DateInput aria-label="Fin del ciclo escolar" value={formData.current_cycle_end} onChange={e => set({ current_cycle_end: e.target.value, cycle_source: 'manual' })} className={wizardInput} />
                                </WizardField>
                            </div>
                            <OfficialCycleNote source={formData.cycle_source ?? 'estimado'} official={officialCycle} loading={officialLoading} onUseOfficial={applyOfficialCycle} />
                        </div>
                    </div>
                </>
            )}

            {step === 4 && (
                <>
                    <WizardStepHeader icon={ShieldCheck} title="Dirección y autorización" description="Datos del director y logotipos para boletas y formatos oficiales." />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                        <WizardField label="Nombre del director(a)">
                            <input className={wizardInput} value={formData.director_name} onChange={e => set({ director_name: e.target.value })} placeholder="Ej. Profr. Juan Pérez López" />
                        </WizardField>
                        <WizardField label="CURP del director">
                            <input className={wizardInput} value={formData.director_curp} onChange={e => set({ director_curp: e.target.value.toUpperCase() })} placeholder="XXXX000000XXXXXX00" />
                        </WizardField>
                        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <LogoUpload label="Logotipo del plantel" hint="PNG, sugerido 500×500" url={formData.logo_url} onUpload={u => set({ logo_url: u })} />
                            <LogoUpload label="Logo institucional (SEP)" hint="Imagen oficial del gobierno" url={formData.header_logo_url} onUpload={u => set({ header_logo_url: u })} />
                            <LogoUpload label="Sello digital" hint="Para validar boletas" url={formData.digital_seal_url} onUpload={u => set({ digital_seal_url: u })} />
                        </div>
                    </div>
                </>
            )}
        </WizardLayout>
    )
}

// --- HELPER COMPONENTS ---

interface LogoUploadProps {
    label: string;
    hint: string;
    url: string;
    onUpload: (url: string) => void;
}

const LogoUpload = ({ label, hint, url, onUpload }: LogoUploadProps) => {
    const id = `upload-${label.replace(/\W+/g, '-')}`
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (event) => onUpload(event.target?.result as string)
        reader.readAsDataURL(file)
    }

    return (
        <div className="p-4 rounded-2xl border-2 border-dashed border-slate-200 hover:border-indigo-300 transition text-center">
            {url ? (
                <div className="relative inline-block mb-3">
                    <img src={url} alt={label} className="h-20 mx-auto rounded-xl border border-slate-100" />
                    <button type="button" aria-label={`Quitar ${label}`} onClick={() => onUpload('')} className="absolute -top-2 -right-2 p-1 bg-white border border-slate-200 text-slate-500 hover:text-rose-600 rounded-full shadow">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            ) : (
                <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Upload className="w-5 h-5" />
                </div>
            )}
            <p className="text-sm font-black text-slate-800">{label}</p>
            <p className="text-xs text-slate-500 mb-3">{hint}</p>
            <input type="file" id={id} className="hidden" onChange={handleFileChange} accept="image/*" />
            <label htmlFor={id} className="inline-block px-4 py-2 rounded-xl border border-slate-200 text-xs font-black text-slate-600 hover:border-indigo-300 hover:text-indigo-700 cursor-pointer">
                {url ? 'Cambiar imagen' : 'Seleccionar imagen'}
            </label>
        </div>
    )
}
