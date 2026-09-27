import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Calendar, BookOpen, Trash2, Plus, School, Clock, Rocket, Gift } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { WizardLayout, WizardFooter, WizardStepHeader, WizardField, WizardAlert, WizardSaving, wizardInput, wizardChoice, Radio } from '../../../components/wizard/Wizard'
import { CooperativeFields, emptyCooperative, saveCooperativeSetup, type CooperativeSetup } from '../../cooperative/components/CooperativeFields'
import { SubjectSelector } from '../../../components/academic/SubjectSelector'
import { DateInput } from '../../../components/ui/DateInput'
import { OfficialCycleNote } from '../../../components/academic/OfficialCycleNote'
import { useOfficialCycle } from '../../../lib/officialCalendar'

export const OnboardingWizard = ({ onComplete }: { onComplete: () => void }) => {
    const navigate = useNavigate()
    const { data: tenant } = useTenant()

    const [step, setStep] = useState(() => {
        const saved = sessionStorage.getItem('vunlek_onboarding_step')
        return saved ? Math.min(parseInt(saved, 10) || 0, 3) : 0
    })

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [schoolData, setSchoolData] = useState(() => {
        const saved = sessionStorage.getItem('vunlek_onboarding_school_data')
        return saved ? JSON.parse(saved) : {
            name: '',
            educationalLevel: 'SECONDARY' as 'PRIMARY' | 'SECONDARY' | 'TELESECUNDARIA',
            secondaryType: null as null | 'GENERAL' | 'TECNICA',
            cct: '',
            shift: 'MORNING',
            grade: 1,
            phase: 3
        }
    })

    const [yearData, setYearData] = useState(() => {
        const saved = sessionStorage.getItem('vunlek_onboarding_year_data')
        return saved ? JSON.parse(saved) : {
            name: new Date().getMonth() > 6 ? `CICLO ${new Date().getFullYear()}-${new Date().getFullYear() + 1}` : `CICLO ${new Date().getFullYear() - 1}-${new Date().getFullYear()}`,
            startDate: new Date().getMonth() > 6 ? `${new Date().getFullYear()}-08-26` : `${new Date().getFullYear() - 1}-08-26`,
            endDate: new Date().getMonth() > 6 ? `${new Date().getFullYear() + 1}-07-16` : `${new Date().getFullYear()}-07-16`,
            source: 'estimado'
        }
    })

    // Con conexión se toman nombre, inicio y fin del calendario escolar oficial de la SEP
    // (solo si el usuario no ha cambiado las fechas). Se pueden editar.
    const { data: officialCycle, isLoading: officialLoading } = useOfficialCycle()
    const applyOfficialCycle = () => {
        if (!officialCycle) return
        setYearData((prev: any) => ({ ...prev, name: officialCycle.name, startDate: officialCycle.startDate, endDate: officialCycle.endDate, source: 'oficial' }))
    }
    useEffect(() => {
        if (officialCycle && (yearData.source ?? 'estimado') === 'estimado') applyOfficialCycle()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [officialCycle])

    const [scheduleSettings, setScheduleSettings] = useState(() => {
        const saved = sessionStorage.getItem('vunlek_onboarding_schedule_data')
        return saved ? JSON.parse(saved) : {
            startTime: '08:00',
            endTime: '14:00',
            moduleDuration: 50,
            breaks: [] as Array<{ name: string, start_time: string, end_time: string }>
        }
    })

    const [searchParams] = useSearchParams()

    // NEW: Sync persistence
    useEffect(() => {
        // Only save if we have actual data or if it's intentionally cleared
        if (schoolData.name || schoolData.cct) {
            sessionStorage.setItem('vunlek_onboarding_school_data', JSON.stringify(schoolData))
        }
    }, [schoolData])

    useEffect(() => {
        if (yearData.name) {
            sessionStorage.setItem('vunlek_onboarding_year_data', JSON.stringify(yearData))
        }
    }, [yearData])

    useEffect(() => {
        if (scheduleSettings.startTime) {
            sessionStorage.setItem('vunlek_onboarding_schedule_data', JSON.stringify(scheduleSettings))
        }
    }, [scheduleSettings])

    useEffect(() => {
        // If storage is EMPTY or only contains the DEFAULT skeleton, try to seed from tenant
        const saved = sessionStorage.getItem('vunlek_onboarding_school_data')
        const isDefault = !saved || JSON.parse(saved).name === ''

        if (tenant && isDefault) {
            setSchoolData((prev: any) => ({
                ...prev,
                name: tenant.name?.toUpperCase() || '',
                educationalLevel: (tenant.educationalLevel as any) || 'SECONDARY',
                secondaryType: (tenant as any).secondaryType ?? null,
                cct: tenant.cct || ''
            }))
        }
    }, [tenant])

    useEffect(() => {
        sessionStorage.setItem('vunlek_onboarding_step', step.toString())
    }, [step])

    useEffect(() => {
        const status = searchParams.get('status')
        if (status === 'approved') {
            // NEW: Set a persistent syncing flag so DashboardLayout knows to keep the overlay
            // even if URL params are lost during redirects/refreshes.
            sessionStorage.setItem('vunlek_payment_syncing', 'true')
        }
        if (status === 'failure' || status === 'rejected') {
            setError('El pago no fue procesado. Por favor intente nuevamente.')
            setStep(3)
        }
    }, [searchParams])

    const clearPersistence = () => {
        sessionStorage.removeItem('vunlek_onboarding_step')
        sessionStorage.removeItem('vunlek_onboarding_school_data')
        sessionStorage.removeItem('vunlek_onboarding_year_data')
        sessionStorage.removeItem('vunlek_onboarding_schedule_data')
        sessionStorage.removeItem('vunlek_payment_syncing')
        sessionStorage.removeItem('vunlek_onboarding_coop')
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

    const handleUpdateSchool = async () => {
        if (!schoolData.name || (tenant?.type !== 'INDEPENDENT' && !schoolData.cct)) {
            setError('Por favor completa los datos obligatorios.')
            return
        }
        if (schoolData.educationalLevel === 'SECONDARY' && !schoolData.secondaryType) {
            setError('Indica si es Secundaria General o Secundaria Técnica.')
            return
        }
        setError(null)
        setLoading(true)
        try {
            const { error } = await supabase.from('tenants').update({
                name: schoolData.name.toUpperCase(),
                educational_level: schoolData.educationalLevel,
                cct: schoolData.cct.toUpperCase(),
                secondary_type: schoolData.educationalLevel === 'SECONDARY' ? schoolData.secondaryType : null,
            }).eq('id', tenant?.id)
            if (error) throw error
            setStep(1)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleCreateYear = async () => {
        setLoading(true)
        try {
            const { data, error: yearError } = await supabase.from('academic_years').upsert({
                tenant_id: tenant?.id,
                name: yearData.name,
                start_date: yearData.startDate,
                end_date: yearData.endDate,
                is_active: true
            }).select().single()
            if (yearError) throw yearError
            if (data) setStep(2)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleSaveSchedule = async () => {
        setLoading(true)
        try {
            // For PRIMARY/TELESECUNDARIA level, we use a single large module (jornada completa)
            const moduleDuration = (schoolData.educationalLevel === 'PRIMARY' || schoolData.educationalLevel === 'TELESECUNDARIA') ? 600 : scheduleSettings.moduleDuration;

            const { error } = await supabase.from('schedule_settings').upsert({
                tenant_id: tenant?.id,
                start_time: scheduleSettings.startTime,
                end_time: scheduleSettings.endTime,
                module_duration: moduleDuration,
                breaks: scheduleSettings.breaks
            })
            if (error) throw error

            // Save Grade and Phase to TENANT if Primary or Telesecundaria
            if (schoolData.educationalLevel === 'PRIMARY' || schoolData.educationalLevel === 'TELESECUNDARIA') {
                const { error: tError } = await supabase.from('tenants').update({
                    grade: schoolData.grade,
                    phase: schoolData.phase
                }).eq('id', tenant?.id)
                if (tError) throw tError
            }

            setStep(3)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    /** Termina la configuración. Sin pago: el espacio ya tiene su mes de prueba desde que se creó. */
    const finishOnboarding = async () => {
        if (!tenant?.id) return
        const { error: e } = await supabase.from('tenants').update({ onboarding_completed: true }).eq('id', tenant.id)
        if (e) throw e
        clearPersistence()
        onComplete()
    }

    const [newBreak, setNewBreak] = useState({ name: 'RECESO', start: '10:00', end: '10:30' })

    const handleAddBreak = () => {
        if (newBreak.start && newBreak.end) {
            setScheduleSettings((prev: any) => ({
                ...prev,
                breaks: [...prev.breaks, { name: newBreak.name.toUpperCase(), start_time: newBreak.start, end_time: newBreak.end }]
            }))
        }
    }

    const [selectedSubjects, setSelectedSubjects] = useState<Record<string, { selected: boolean, customDetail: string }>>(() => {
        const saved = sessionStorage.getItem('vunlek_onboarding_subjects')
        return saved ? JSON.parse(saved) : {}
    })

    useEffect(() => {
        if (Object.keys(selectedSubjects).length > 0) {
            sessionStorage.setItem('vunlek_onboarding_subjects', JSON.stringify(selectedSubjects))
        }
    }, [selectedSubjects])

    // Load existing subjects from DB if returning to step 3 and storage empty
    useEffect(() => {
        const loadExistingSubjects = async () => {
            if (step === 3 && Object.keys(selectedSubjects).length === 0) {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return

                const { data } = await supabase
                    .from('profile_subjects')
                    .select('subject_catalog_id, custom_detail')
                    .eq('profile_id', user.id)

                if (data && data.length > 0) {
                    const loaded: Record<string, { selected: boolean, customDetail: string }> = {}
                    data.forEach((s: any) => {
                        loaded[s.subject_catalog_id] = {
                            selected: true,
                            customDetail: s.custom_detail || ''
                        }
                    })
                    setSelectedSubjects(loaded)
                }
            }
        }
        loadExistingSubjects()
    }, [step])

    // Secundaria Técnica + Tecnología → Cooperativa Escolar de Producción
    const { data: technologyIds = [] } = useQuery({
        queryKey: ['technology-subject-ids'],
        staleTime: 1000 * 60 * 60,
        queryFn: async () => {
            const { data } = await supabase.from('subject_catalog').select('id').ilike('name', 'tecnolog%')
            return (data ?? []).map((r: any) => r.id as string)
        },
    })
    const teachesTechnology = schoolData.educationalLevel === 'SECONDARY' && schoolData.secondaryType === 'TECNICA'
        && Object.entries(selectedSubjects).some(([id, v]) => v.selected && technologyIds.includes(id))
    const [coop, setCoop] = useState<CooperativeSetup>(() => {
        try { return { ...emptyCooperative, ...JSON.parse(sessionStorage.getItem('vunlek_onboarding_coop') || '{}') } } catch { return emptyCooperative }
    })
    useEffect(() => { try { sessionStorage.setItem('vunlek_onboarding_coop', JSON.stringify(coop)) } catch { /* nada */ } }, [coop])
    const subjectsValid = !teachesTechnology || coop.hasCooperative === false || (coop.hasCooperative === true && !!coop.name.trim() && !!coop.registrationKey.trim())

    const handleSaveSubjects = async () => {
        if (teachesTechnology && coop.hasCooperative === null) {
            setError('Indica si la escuela cuenta con Cooperativa de Producción.')
            return
        }
        if (!subjectsValid) {
            setError('Escribe el nombre y la clave de la cooperativa.')
            return
        }
        setError(null)
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('No usuario autenticado')

            // Prepare data for insertion
            const subjectsToInsert = Object.entries(selectedSubjects)
                .filter(([_, value]) => value.selected)
                .map(([catalogId, value]) => ({
                    profile_id: user.id,
                    tenant_id: tenant?.id,
                    subject_catalog_id: catalogId,
                    custom_detail: value.customDetail || null
                }))

            if (subjectsToInsert.length > 0) {
                // Delete existing just in case (though it's onboarding)
                const { error: deleteError } = await supabase.from('profile_subjects').delete().eq('profile_id', user.id)
                if (deleteError) console.error('Error deleting old subjects:', deleteError);

                const { error } = await supabase.from('profile_subjects').insert(subjectsToInsert)
                if (error) throw error
            }

            if (teachesTechnology && coop.hasCooperative && tenant?.id) {
                await saveCooperativeSetup(tenant.id, user.id, coop)
            }

            await finishOnboarding()
        } catch (err: any) {
            console.error('Error saving subjects:', err)
            setError('Error al guardar materias: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    const STEPS = [
        { label: 'Escuela', icon: School },
        { label: 'Ciclo escolar', icon: Calendar },
        { label: 'Jornada', icon: Clock },
        { label: 'Materias', icon: BookOpen },
    ]
    const isPrimaryLike = schoolData.educationalLevel === 'PRIMARY' || schoolData.educationalLevel === 'TELESECUNDARIA'
    const isIndependent = tenant?.type === 'INDEPENDENT' || (tenant?.type as string)?.toLowerCase() === 'independent'

    return (
        <WizardLayout
            eyebrow="Configuración inicial"
            title={tenant?.type === 'INDEPENDENT' ? 'Personaliza tu espacio' : 'Datos de tu escuela'}
            subtitle="Te tomará unos minutos. Puedes cambiar estos datos después en Ajustes."
            steps={STEPS}
            current={step}
            onStepClick={i => i < step && setStep(i)}
            width={step === 3 ? 'lg' : 'md'}
            footer={
                step === 0 ? <WizardFooter onNext={handleUpdateSchool} loading={loading} nextDisabled={!schoolData.name || (schoolData.educationalLevel === 'SECONDARY' && !schoolData.secondaryType)} />
                    : step === 1 ? <WizardFooter onBack={() => setStep(0)} onNext={handleCreateYear} loading={loading} nextDisabled={!yearData.name || !yearData.startDate || !yearData.endDate} />
                        : step === 2 ? <WizardFooter onBack={() => setStep(1)} onNext={handleSaveSchedule} loading={loading} />
                            : <WizardFooter onBack={() => setStep(2)} onNext={handleSaveSubjects} loading={loading} nextDisabled={!subjectsValid} nextLabel="Empezar a usar VUNLEK" nextIcon={Rocket} tone="success" />
            }
        >
            {loading && <WizardSaving label="Guardando…" />}
            {error && <div className="mb-5"><WizardAlert>{error}</WizardAlert></div>}

            {step === 0 && (
                <div className="space-y-5">
                    <WizardStepHeader icon={School} title="Tu escuela" description="Nombre, nivel educativo y clave del centro de trabajo." />
                    <WizardField label="Nombre" required>
                        <input aria-label="Nombre" value={schoolData.name} onChange={e => setSchoolData({ ...schoolData, name: e.target.value.toUpperCase() })} className={wizardInput} placeholder="Ej. ESC. SEC. TÉCNICA No. 37" />
                    </WizardField>
                    <div>
                        <span className="block text-xs font-black text-slate-600 mb-1.5">Nivel educativo <span className="text-rose-500">*</span></span>
                        <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-2">
                            {(['PRIMARY', 'SECONDARY', 'TELESECUNDARIA'] as const).map(l => (
                                <button key={l} type="button" onClick={() => setSchoolData({ ...schoolData, educationalLevel: l, secondaryType: l === 'SECONDARY' ? schoolData.secondaryType : null })} className={wizardChoice(schoolData.educationalLevel === l)}>
                                    <Radio checked={schoolData.educationalLevel === l} />
                                    {l === 'PRIMARY' ? 'Primaria' : l === 'SECONDARY' ? 'Secundaria' : 'Telesecundaria'}
                                </button>
                            ))}
                        </div>
                    </div>
                    {schoolData.educationalLevel === 'SECONDARY' && (
                        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                            <span className="block text-xs font-black text-slate-600 mb-2">Tipo de secundaria <span className="text-rose-500">*</span></span>
                            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
                                {([['GENERAL', 'Secundaria General'], ['TECNICA', 'Secundaria Técnica']] as const).map(([v, label]) => (
                                    <button key={v} type="button" onClick={() => setSchoolData({ ...schoolData, secondaryType: v })} className={wizardChoice(schoolData.secondaryType === v)}>
                                        <Radio checked={schoolData.secondaryType === v} /> {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <WizardField label="CCT (Clave del Centro de Trabajo)" required={!isIndependent} hint={isIndependent ? 'Opcional si trabajas por tu cuenta.' : undefined}>
                        <input aria-label="CCT" value={schoolData.cct} onChange={e => setSchoolData({ ...schoolData, cct: e.target.value.toUpperCase() })} className={`${wizardInput} font-mono`} placeholder="Ej. 07DST0037X" />
                    </WizardField>
                    <button type="button" onClick={handleCancelRegistration} className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-rose-600">
                        <Trash2 className="w-4 h-4" /> Cancelar registro y eliminar mi cuenta
                    </button>
                </div>
            )}

            {step === 1 && (
                <div className="space-y-5">
                    <WizardStepHeader icon={Calendar} title="Ciclo escolar" description="Se toma del calendario oficial de la SEP cuando hay conexión." />
                    <WizardField label="Nombre del ciclo" required>
                        <input aria-label="Nombre del Ciclo" value={yearData.name} onChange={e => setYearData({ ...yearData, name: e.target.value.toUpperCase(), source: 'manual' })} className={wizardInput} placeholder="CICLO 2026-2027" />
                    </WizardField>
                    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-4">
                        <WizardField label="Inicio de clases" required>
                            <DateInput aria-label="Inicio de Clases" value={yearData.startDate} onChange={e => setYearData({ ...yearData, startDate: e.target.value, source: 'manual' })} className={wizardInput} />
                        </WizardField>
                        <WizardField label="Fin de clases" required>
                            <DateInput aria-label="Fin de Clases" value={yearData.endDate} onChange={e => setYearData({ ...yearData, endDate: e.target.value, source: 'manual' })} className={wizardInput} />
                        </WizardField>
                    </div>
                    <OfficialCycleNote source={yearData.source ?? 'estimado'} official={officialCycle} loading={officialLoading} onUseOfficial={applyOfficialCycle} />
                </div>
            )}

            {step === 2 && (
                <div className="space-y-5">
                    <WizardStepHeader icon={Clock} title="Jornada" description={isPrimaryLike ? 'En primaria y telesecundaria el horario es por jornada completa.' : 'Horario de entrada, salida y duración de cada módulo.'} />
                    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-4">
                        <WizardField label="Hora de entrada">
                            <input aria-label="Hora de Entrada" type="time" value={scheduleSettings.startTime} onChange={e => setScheduleSettings({ ...scheduleSettings, startTime: e.target.value })} className={wizardInput} />
                        </WizardField>
                        <WizardField label="Hora de salida">
                            <input aria-label="Hora de Salida" type="time" value={scheduleSettings.endTime} onChange={e => setScheduleSettings({ ...scheduleSettings, endTime: e.target.value })} className={wizardInput} />
                        </WizardField>
                        {!isPrimaryLike && (
                            <WizardField label="Duración del módulo (minutos)">
                                <input aria-label="Duración Módulo (min)" type="number" min={20} max={120} value={scheduleSettings.moduleDuration} onChange={e => setScheduleSettings({ ...scheduleSettings, moduleDuration: Number(e.target.value) })} className={wizardInput} />
                            </WizardField>
                        )}
                    </div>
                    {isPrimaryLike && (
                        <div>
                            <span className="block text-xs font-black text-slate-600 mb-1.5">Grado que impartes</span>
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                {(schoolData.educationalLevel === 'TELESECUNDARIA' ? [1, 2, 3] : [1, 2, 3, 4, 5, 6]).map(g => (
                                    <button key={g} type="button" onClick={() => {
                                        const p = schoolData.educationalLevel === 'TELESECUNDARIA' ? 6 : g <= 2 ? 3 : g <= 4 ? 4 : 5
                                        setSchoolData({ ...schoolData, grade: g, phase: p })
                                    }} className={`${wizardChoice(schoolData.grade === g)} justify-center`}>{g}°</button>
                                ))}
                            </div>
                            <p className="text-xs font-bold text-indigo-700 mt-2">Fase {schoolData.phase} de la NEM</p>
                        </div>
                    )}
                    {!isIndependent && (
                        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 space-y-3">
                            <span className="block text-xs font-black text-slate-600">Recesos</span>
                            <div className="grid grid-cols-2 gap-3">
                                <WizardField label="Inicio"><input aria-label="Inicio" type="time" value={newBreak.start} onChange={e => setNewBreak({ ...newBreak, start: e.target.value })} className={wizardInput} /></WizardField>
                                <WizardField label="Fin"><input aria-label="Fin" type="time" value={newBreak.end} onChange={e => setNewBreak({ ...newBreak, end: e.target.value })} className={wizardInput} /></WizardField>
                            </div>
                            <button type="button" onClick={handleAddBreak} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-black text-indigo-700"><Plus className="w-4 h-4" /> Agregar receso</button>
                            {scheduleSettings.breaks.map((b: any, i: number) => (
                                <div key={i} className="flex items-center justify-between gap-2 bg-white rounded-xl border border-slate-100 px-3 py-2 text-sm">
                                    <span className="font-bold text-slate-700">{b.name} <span className="font-mono text-xs text-slate-500">{b.start_time}–{b.end_time}</span></span>
                                    <button aria-label="Eliminar" onClick={() => setScheduleSettings((prev: any) => ({ ...prev, breaks: prev.breaks.filter((_: any, idx: number) => idx !== i) }))} className="p-2 rounded-lg text-slate-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {step === 3 && (
                <div className="space-y-5">
                    <WizardStepHeader icon={BookOpen} title="Tus materias" description="Selecciona las asignaturas que impartirás este ciclo escolar." />
                    <WizardAlert tone="success"><span className="inline-flex items-start gap-2"><Gift className="w-4 h-4 mt-0.5 shrink-0" /><span>Tu espacio incluye <b>30 días gratis con todas las herramientas</b>. No necesitas tarjeta; te avisaremos una semana antes de que termine.</span></span></WizardAlert>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                        <span>Catálogo del programa de estudios</span>
                        <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700">{Object.values(selectedSubjects).filter(s => s.selected).length} seleccionadas</span>
                    </div>
                    <div className="rounded-2xl border border-slate-100 p-3 sm:p-4 max-h-[420px] overflow-y-auto custom-scrollbar">
                        <SubjectSelector educationalLevel={schoolData.educationalLevel} selectedSubjects={selectedSubjects} onChange={setSelectedSubjects} />
                    </div>

                    {teachesTechnology && (
                        <CooperativeFields value={coop} onChange={setCoop} />
                    )}
                </div>
            )}

        </WizardLayout>
    )
}
