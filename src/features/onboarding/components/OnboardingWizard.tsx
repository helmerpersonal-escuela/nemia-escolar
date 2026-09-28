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
import { SchoolLocationFields, emptyLocation, isLocationComplete, saveSchoolLocation, loadSchoolLocation, type SchoolLocation } from '../../../components/location/SchoolLocationFields'
import { askConfirm } from '../../../components/ui/ConfirmDialog'

export const OnboardingWizard = ({ onComplete }: { onComplete: () => void }) => {
    const navigate = useNavigate()
    const { data: tenant } = useTenant()

    const [step, setStep] = useState(() => {
        const saved = sessionStorage.getItem('vunlek_onboarding_step')
        return saved ? Math.min(parseInt(saved, 10) || 0, 3) : 0
    })

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Ubicación de la escuela (estado, municipio, colonia y punto en el mapa)
    const [location, setLocation] = useState<SchoolLocation>(() => {
        try { return { ...emptyLocation, ...JSON.parse(sessionStorage.getItem('vunlek_onboarding_location') || '{}') } } catch { return emptyLocation }
    })
    useEffect(() => { try { sessionStorage.setItem('vunlek_onboarding_location', JSON.stringify(location)) } catch { /* nada */ } }, [location])
    // Si la escuela ya tenía ubicación guardada, se recupera
    useEffect(() => {
        if (!tenant?.id || location.state) return
        loadSchoolLocation(tenant.id).then(l => { if (l) setLocation(l) }).catch(() => {})
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tenant?.id])

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
            breaks: [{ name: 'RECESO', start_time: '10:30', end_time: '11:00' }] as Array<{ name: string, start_time: string, end_time: string }>
        }
    })

    // Periodos de evaluación (opcional): cuántos y de qué fecha a qué fecha
    const [evalPeriods, setEvalPeriods] = useState<Array<{ name: string, start: string, end: string }>>(() => {
        try { return JSON.parse(sessionStorage.getItem('vunlek_onboarding_periods') || '[]') } catch { return [] }
    })
    useEffect(() => { try { sessionStorage.setItem('vunlek_onboarding_periods', JSON.stringify(evalPeriods)) } catch { /* nada */ } }, [evalPeriods])

    // Si se regresa al asistente (se cerró la app, se recargó), retoma lo que ya estaba guardado
    useEffect(() => {
        if (!tenant?.id) return
        let cancelled = false
        ;(async () => {
            if (!sessionStorage.getItem('vunlek_onboarding_schedule_data')) {
                const { data } = await supabase.from('schedule_settings').select('start_time, end_time, module_duration, breaks').eq('tenant_id', tenant.id).maybeSingle()
                if (!cancelled && data) setScheduleSettings((prev: any) => ({
                    ...prev,
                    startTime: String(data.start_time ?? prev.startTime).slice(0, 5),
                    endTime: String(data.end_time ?? prev.endTime).slice(0, 5),
                    moduleDuration: data.module_duration && data.module_duration < 600 ? data.module_duration : prev.moduleDuration,
                    breaks: Array.isArray(data.breaks) ? data.breaks : prev.breaks,
                }))
            }
            if (!sessionStorage.getItem('vunlek_onboarding_periods')) {
                const { data } = await supabase.from('evaluation_periods').select('name, start_date, end_date').eq('tenant_id', tenant.id).order('start_date')
                if (!cancelled && data?.length) setEvalPeriods(data.map((d: any) => ({ name: d.name, start: d.start_date, end: d.end_date })))
            }
        })()
        return () => { cancelled = true }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tenant?.id])

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
        sessionStorage.removeItem('vunlek_onboarding_periods')
        sessionStorage.removeItem('vunlek_onboarding_location')
    }

    const handleCancelRegistration = async () => {
        if ((await askConfirm('¿Estás seguro de cancelar tu registro? Toda tu información será eliminada para liberar tu correo.'))) {
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
        if (!isLocationComplete(location)) {
            setError('Indica el estado, el municipio y la colonia o localidad de tu escuela.')
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
            if (tenant?.id) await saveSchoolLocation(tenant.id, location, { name: schoolData.name.toUpperCase(), cct: schoolData.cct.toUpperCase() })
            setStep(1)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const periodsError = (): string | null => {
        for (let i = 0; i < evalPeriods.length; i++) {
            const p = evalPeriods[i]
            if (!p.name.trim() || !p.start || !p.end) return `Completa el nombre y las fechas del periodo ${i + 1}.`
            if (p.start > p.end) return `En "${p.name}" la fecha de inicio es posterior a la de fin.`
            if (i > 0 && p.start <= evalPeriods[i - 1].end) return `"${p.name}" empieza antes de que termine "${evalPeriods[i - 1].name}".`
        }
        return null
    }

    const handleCreateYear = async () => {
        if (!tenant?.id) return
        const pe = periodsError()
        if (pe) { setError(pe); return }
        setError(null)
        setLoading(true)
        try {
            // Reutiliza el ciclo activo si ya existe (evita ciclos duplicados al volver a este paso)
            const { data: existing } = await supabase.from('academic_years').select('id').eq('tenant_id', tenant.id).eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle()
            const payload = { tenant_id: tenant.id, name: yearData.name, start_date: yearData.startDate, end_date: yearData.endDate, is_active: true }
            const { error: yearError } = existing
                ? await supabase.from('academic_years').update(payload).eq('id', existing.id)
                : await supabase.from('academic_years').insert(payload)
            if (yearError) throw yearError

            if (evalPeriods.length > 0) {
                const { data: current } = await supabase.from('evaluation_periods').select('id, is_closed').eq('tenant_id', tenant.id).order('start_date')
                const rows = current ?? []
                for (let i = 0; i < evalPeriods.length; i++) {
                    const p = evalPeriods[i]
                    const values = { name: p.name.trim().toUpperCase(), start_date: p.start, end_date: p.end }
                    const { error: pErr } = rows[i]
                        ? await supabase.from('evaluation_periods').update(values).eq('id', rows[i].id)
                        : await supabase.from('evaluation_periods').insert({ ...values, tenant_id: tenant.id, is_active: i === 0 && rows.length === 0 })
                    if (pErr) throw pErr
                }
                // Los periodos sobrantes de un intento anterior se quitan (si ya tienen datos, se conservan)
                for (const extra of rows.slice(evalPeriods.length)) {
                    if (!extra.is_closed) await supabase.from('evaluation_periods').delete().eq('id', extra.id)
                }
            }
            setStep(2)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    /** Reparte el ciclo en n periodos iguales (se pueden ajustar después). */
    const splitPeriods = (n: number) => {
        if (n === 0) { setEvalPeriods([]); return }
        const start = new Date(yearData.startDate + 'T12:00:00')
        const end = new Date(yearData.endDate + 'T12:00:00')
        const total = Math.max(1, end.getTime() - start.getTime())
        const iso = (d: Date) => d.toISOString().slice(0, 10)
        const label = n === 3 ? 'TRIMESTRE' : n === 2 ? 'SEMESTRE' : 'PERIODO'
        setEvalPeriods(Array.from({ length: n }, (_, i) => {
            const a = new Date(start.getTime() + (total * i) / n)
            const b = new Date(start.getTime() + (total * (i + 1)) / n - (i < n - 1 ? 86400000 : 0))
            return { name: `${label} ${i + 1}`, start: iso(a), end: iso(b) }
        }))
    }

    const breaksError = (): string | null => {
        const { startTime, endTime, breaks } = scheduleSettings
        if (!startTime || !endTime || startTime >= endTime) return 'La hora de salida debe ser posterior a la de entrada.'
        const sorted = [...breaks].sort((a: any, b: any) => a.start_time.localeCompare(b.start_time))
        for (let i = 0; i < sorted.length; i++) {
            const b = sorted[i]
            if (!b.start_time || !b.end_time) return `Indica la hora de inicio y fin del receso ${i + 1}.`
            if (b.start_time >= b.end_time) return `El receso ${i + 1} termina antes de empezar.`
            if (b.start_time < startTime || b.end_time > endTime) return `El receso ${i + 1} queda fuera de la jornada (${startTime}–${endTime}).`
            if (i > 0 && b.start_time < sorted[i - 1].end_time) return 'Dos recesos se enciman; revisa sus horarios.'
        }
        return null
    }

    const handleSaveSchedule = async () => {
        const be = breaksError()
        if (be) { setError(be); return }
        setError(null)
        setLoading(true)
        try {
            // For PRIMARY/TELESECUNDARIA level, we use a single large module (jornada completa)
            const moduleDuration = (schoolData.educationalLevel === 'PRIMARY' || schoolData.educationalLevel === 'TELESECUNDARIA') ? 600 : scheduleSettings.moduleDuration;

            const { error } = await supabase.from('schedule_settings').upsert({
                tenant_id: tenant?.id,
                start_time: scheduleSettings.startTime,
                end_time: scheduleSettings.endTime,
                module_duration: moduleDuration,
                breaks: [...scheduleSettings.breaks]
                    .sort((a: any, b: any) => a.start_time.localeCompare(b.start_time))
                    .map((b: any, i: number, all: any[]) => ({ ...b, name: all.length > 1 ? `RECESO ${i + 1}` : 'RECESO' }))
            }, { onConflict: 'tenant_id' })
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

    const addMinutes = (hhmm: string, m: number) => {
        const [h, mi] = hhmm.split(':').map(Number)
        const t = Math.min(23 * 60 + 59, h * 60 + mi + m)
        return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
    }
    const setBreakCount = (n: number) => setScheduleSettings((prev: any) => {
        const list = [...prev.breaks]
        while (list.length > n) list.pop()
        while (list.length < n) {
            const last = list[list.length - 1]
            const start = last ? addMinutes(last.end_time, 90) : '10:30'
            list.push({ name: 'RECESO', start_time: start, end_time: addMinutes(start, last ? 15 : 30) })
        }
        return { ...prev, breaks: list }
    })
    const updateBreak = (i: number, k: 'start_time' | 'end_time', v: string) =>
        setScheduleSettings((prev: any) => ({ ...prev, breaks: prev.breaks.map((b: any, idx: number) => idx === i ? { ...b, [k]: v } : b) }))

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
                step === 0 ? <WizardFooter onNext={handleUpdateSchool} loading={loading} nextDisabled={!schoolData.name || (schoolData.educationalLevel === 'SECONDARY' && !schoolData.secondaryType) || !isLocationComplete(location)} />
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
                    <div className="pt-2 border-t border-slate-100">
                        <p className="text-sm font-black text-slate-900 mt-4 mb-1">¿Dónde está la escuela?</p>
                        <p className="text-xs text-slate-500 mb-4">Estado, municipio y colonia del catálogo oficial de SEPOMEX. Si tu colonia no aparece, escríbela.</p>
                        <SchoolLocationFields value={location} onChange={setLocation} />
                    </div>
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

                    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 space-y-3">
                        <div>
                            <span className="block text-xs font-black text-slate-600">Periodos de evaluación <span className="font-bold text-slate-400">(opcional)</span></span>
                            <p className="text-xs text-slate-500 mt-0.5">¿En cuántos periodos evalúas el ciclo? Proponemos fechas iguales; ajústalas a las de tu escuela.</p>
                        </div>
                        <div className="grid grid-cols-3 min-[420px]:grid-cols-5 gap-2">
                            {[0, 2, 3, 4, 5].map(n => (
                                <button key={n} type="button" onClick={() => splitPeriods(n)} className={`${wizardChoice(evalPeriods.length === n)} justify-center text-xs`}>
                                    {n === 0 ? 'Después' : n}
                                </button>
                            ))}
                        </div>
                        {evalPeriods.map((p, i) => (
                            <div key={i} className="bg-white rounded-xl border border-slate-100 p-3 space-y-2">
                                <input aria-label={`Nombre del periodo ${i + 1}`} value={p.name} onChange={e => setEvalPeriods(list => list.map((x, j) => j === i ? { ...x, name: e.target.value.toUpperCase() } : x))} className={`${wizardInput} text-sm`} />
                                <div className="grid grid-cols-2 gap-2">
                                    <WizardField label="Del"><DateInput aria-label={`Inicio del periodo ${i + 1}`} value={p.start} onChange={e => setEvalPeriods(list => list.map((x, j) => j === i ? { ...x, start: e.target.value } : x))} className={wizardInput} /></WizardField>
                                    <WizardField label="Al"><DateInput aria-label={`Fin del periodo ${i + 1}`} value={p.end} onChange={e => setEvalPeriods(list => list.map((x, j) => j === i ? { ...x, end: e.target.value } : x))} className={wizardInput} /></WizardField>
                                </div>
                            </div>
                        ))}
                        {evalPeriods.length === 0 && (
                            <p className="text-xs font-bold text-indigo-700">Puedes cargarlos después en <b>Ajustes → Periodos de Evaluación</b>. Los necesitarás para capturar calificaciones.</p>
                        )}
                    </div>
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
                    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className="text-xs font-black text-slate-600">¿Cuántos recesos hay en la jornada?</span>
                            <div className="flex items-center gap-2">
                                <button type="button" aria-label="Quitar un receso" onClick={() => setBreakCount(Math.max(0, scheduleSettings.breaks.length - 1))} disabled={scheduleSettings.breaks.length === 0} className="w-9 h-9 rounded-xl bg-white border border-slate-200 font-black text-slate-700 disabled:opacity-40">−</button>
                                <span className="w-8 text-center text-lg font-black text-slate-900" aria-live="polite">{scheduleSettings.breaks.length}</span>
                                <button type="button" aria-label="Agregar un receso" onClick={() => setBreakCount(Math.min(4, scheduleSettings.breaks.length + 1))} disabled={scheduleSettings.breaks.length >= 4} className="w-9 h-9 rounded-xl bg-white border border-slate-200 font-black text-indigo-700 disabled:opacity-40"><Plus className="w-4 h-4 mx-auto" /></button>
                            </div>
                        </div>
                        {scheduleSettings.breaks.map((b: any, i: number) => (
                            <div key={i} className="bg-white rounded-xl border border-slate-100 p-3">
                                <span className="block text-xs font-black text-indigo-700 mb-2">Receso {scheduleSettings.breaks.length > 1 ? i + 1 : ''}</span>
                                <div className="grid grid-cols-2 gap-3">
                                    <WizardField label="De"><input aria-label={`Inicio del receso ${i + 1}`} type="time" value={b.start_time} onChange={e => updateBreak(i, 'start_time', e.target.value)} className={wizardInput} /></WizardField>
                                    <WizardField label="A"><input aria-label={`Fin del receso ${i + 1}`} type="time" value={b.end_time} onChange={e => updateBreak(i, 'end_time', e.target.value)} className={wizardInput} /></WizardField>
                                </div>
                            </div>
                        ))}
                        {scheduleSettings.breaks.length === 0 && <p className="text-xs text-slate-500">Sin recesos. Puedes agregarlos después en Ajustes → Jornada y Horarios.</p>}
                    </div>
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
