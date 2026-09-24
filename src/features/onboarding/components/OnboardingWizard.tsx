import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Calendar, BookOpen, Trash2, Plus, ArrowRight, School, Clock, Loader2, CreditCard, Zap, Gift } from 'lucide-react'
import { SubjectSelector } from '../../../components/academic/SubjectSelector'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'

export const OnboardingWizard = ({ onComplete }: { onComplete: () => void }) => {
    const navigate = useNavigate()
    const { data: tenant } = useTenant()

    const [step, setStep] = useState(() => {
        const saved = sessionStorage.getItem('vunlek_onboarding_step')
        return saved ? parseInt(saved, 10) : 0
    })

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [schoolData, setSchoolData] = useState(() => {
        const saved = sessionStorage.getItem('vunlek_onboarding_school_data')
        return saved ? JSON.parse(saved) : {
            name: '',
            educationalLevel: 'SECONDARY' as 'PRIMARY' | 'SECONDARY' | 'TELESECUNDARIA',
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
            endDate: new Date().getMonth() > 6 ? `${new Date().getFullYear() + 1}-07-16` : `${new Date().getFullYear()}-07-16`
        }
    })

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
        setLoading(true)
        try {
            const { error } = await supabase.from('tenants').update({
                name: schoolData.name.toUpperCase(),
                educational_level: schoolData.educationalLevel,
                cct: schoolData.cct.toUpperCase(),
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
            const { data } = await supabase.from('academic_years').upsert({
                tenant_id: tenant?.id,
                name: yearData.name,
                start_date: yearData.startDate,
                end_date: yearData.endDate,
                is_active: true
            }).select().single()
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

    const handleStartFreeTrial = async () => {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('No usuario autenticado')

            // Call the new RPC for Free Trial (No Payment)
            const { data, error } = await supabase.rpc('start_free_trial', {
                p_plan_type: 'basic'
            })

            if (error) throw error
            if (data && !data.success) throw new Error(data.error || 'Error al iniciar prueba')

            // Success! Redirect to success page or Dashboard
            // We simulate the "approved" status so the dashboard knows to refresh
            await Browser.open({ url: '/?status=approved' })
            // Or just navigate internal: navigate('/dashboard')
            // But preserving the query param flow:
            window.location.href = '/?status=approved'

        } catch (err: any) {
            console.error('Free Trial Error:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleActivateSubscription = async () => {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            const { data, error } = await supabase.functions.invoke('create-payment-preference', {
                body: {
                    title: 'Suscripción Anual - Vunlek',
                    price: 599,
                    quantity: 1,
                    tenantId: tenant?.id,
                    userId: user?.id,
                    email: user?.email,
                    planType: 'pro',
                    isTrial: false,
                    platform: Capacitor.getPlatform()
                }
            })
            if (error) throw error
            if (data?.init_point) await Browser.open({ url: data.init_point })
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
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

    const handleSaveSubjects = async () => {
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

            setStep(4)
        } catch (err: any) {
            console.error('Error saving subjects:', err)
            setError('Error al guardar materias: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    // Import SubjectSelector dynamically or at top if not already (Checked: it is not imported yet in prompt, adding import in next block call would be better but I can't do multiple unrelated edits easily. 
    // Wait, I need to add the import first or ensure it's there. I'll assume I can add it or I'll use a separate tool call for imports if needed, but replace_file_content targets a block. 
    // I will add the import in a separate call or try to include it if I target the top of the file, but here I am targeting the body.
    // I will stick to modifying the body steps here and add the import in a preceding call? No, I must do one call per file usually or use multi_replace.
    // I'll use multi_replace to do both import and body changes safely.)

    return (
        <div className="max-w-4xl mx-auto py-12 px-4 relative">
            {/* ... header ... */}
            <div className="text-center mb-10 relative z-10">
                <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Configuración Inicial</h1>
                <p className="text-slate-500 font-medium">Ayúdanos a configurar tu escuela para brindarte la mejor experiencia profesional.</p>
            </div>

            <div className="flex justify-center mb-12">
                {[0, 1, 2, 3, 4].map((s) => (
                    <div key={s} className="flex items-center">
                        <div className={`w-3 h-3 rounded-full transition-all duration-300 ${s === step ? 'bg-indigo-600 scale-150 ring-4 ring-indigo-100' : s < step ? 'bg-indigo-400' : 'bg-gray-200'}`} />
                        {s < 4 && <div className={`w-8 h-0.5 rounded-full mx-1 ${s < step ? 'bg-indigo-200' : 'bg-gray-100'}`} />}
                    </div>
                ))}
            </div>

            <div className="squishy-card min-h-[500px] relative overflow-hidden bg-white mt-4 border-2 border-indigo-50/50">
                <div className="absolute top-0 left-0 right-0 h-2 bg-indigo-50">
                    <div
                        className="h-full bg-indigo-500 transition-all duration-500 ease-out rounded-r-full"
                        style={{ width: `${((step + 1) / 5) * 100}%` }}
                    />
                </div>

                <div className="p-8 md:p-16">

                    {loading && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                            <p className="mt-6 text-slate-600 font-black uppercase tracking-widest text-xs">Procesando...</p>
                        </div>
                    )}

                    {step === 0 && (
                        <div className="animate-in fade-in slide-in-from-right duration-500 max-w-lg mx-auto">
                            <div className="text-center mb-10">
                                <div className="inline-flex items-center justify-center p-6 bg-indigo-100 rounded-[2rem] text-indigo-600 mb-6 shadow-inner ring-4 ring-white">
                                    <School className="w-12 h-12" />
                                </div>
                                <h2 className="text-3xl md:text-4xl font-black text-indigo-950 italic tracking-tight uppercase">
                                    {tenant?.type === 'INDEPENDENT' ? 'Personaliza tu Espacio' : 'Datos de la Escuela'}
                                </h2>
                            </div>
                            <div className="space-y-8">
                                <div className="group/field">
                                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-2 transition-colors group-focus-within:text-indigo-500">Nombre</label>
                                    <input aria-label="Nombre" value={schoolData.name} onChange={e => setSchoolData({ ...schoolData, name: e.target.value.toUpperCase() })} className="input-squishy w-full px-6 py-5 text-sm font-bold border-2 border-slate-50 focus:border-indigo-400 transition-all" placeholder="Ej. Esc. Primaria Benito Juárez" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="md:col-span-2">
                                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-2">Nivel</label>
                                        <div className="flex flex-col sm:flex-row gap-4">
                                            {['PRIMARY', 'SECONDARY', 'TELESECUNDARIA'].map(l => (
                                                <button
                                                    key={l}
                                                    onClick={() => setSchoolData({ ...schoolData, educationalLevel: l as any })}
                                                    className={`flex-1 py-5 px-6 rounded-[2rem] border-2 transition-all flex items-center justify-center gap-3 active:scale-95 ${schoolData.educationalLevel === l
                                                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-[inset_0_4px_12px_rgba(79,70,229,0.15)] ring-4 ring-indigo-100/50'
                                                        : 'border-slate-100 hover:border-indigo-300 hover:bg-slate-50 text-slate-500 shadow-sm'
                                                        }`}
                                                >
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${schoolData.educationalLevel === l ? 'border-indigo-600' : 'border-slate-300'}`}>
                                                        {schoolData.educationalLevel === l && <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />}
                                                    </div>
                                                    <span className="font-extrabold tracking-tight text-xs uppercase">
                                                        {l === 'PRIMARY' ? 'Primaria' : l === 'SECONDARY' ? 'Secundaria' : 'Telesecundaria'}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="md:col-span-2 group/field">
                                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-2 transition-colors group-focus-within:text-indigo-500">CCT</label>
                                        <input aria-label="CCT" value={schoolData.cct} onChange={e => setSchoolData({ ...schoolData, cct: e.target.value.toUpperCase() })} className="input-squishy w-full px-6 py-5 text-sm font-bold border-2 border-slate-50 focus:border-indigo-400 transition-all font-mono" placeholder="Ej. 07DPR0000X" />
                                    </div>
                                </div>
                                <div className="pt-4 space-y-4">
                                    <button onClick={handleUpdateSchool} className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-sm hover:bg-indigo-700 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest border-b-4 border-indigo-800 hover:border-indigo-900 hover:translate-y-0.5">
                                        Continuar <ArrowRight className="w-5 h-5" />
                                    </button>
                                    <button onClick={handleCancelRegistration} className="w-full py-4 text-slate-500 font-bold text-[11px] uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 rounded-2xl transition-all flex items-center justify-center gap-2">
                                        <Trash2 className="w-4 h-4" /> Cancelar y Eliminar Cuenta
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 1 && (
                        <div className="animate-in fade-in slide-in-from-right duration-500 max-w-lg mx-auto">
                            <div className="text-center mb-10">
                                <div className="inline-flex items-center justify-center p-6 bg-blue-100 rounded-[2rem] text-blue-600 mb-6 shadow-inner ring-4 ring-white">
                                    <Calendar className="w-12 h-12" />
                                </div>
                                <h2 className="text-3xl md:text-4xl font-black text-slate-900 italic tracking-tight uppercase">Ciclo Escolar</h2>
                            </div>
                            <div className="space-y-8">
                                <div className="group/field">
                                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-2 transition-colors group-focus-within:text-blue-500">Nombre del Ciclo</label>
                                    <input aria-label="Nombre del Ciclo" value={yearData.name} onChange={e => setYearData({ ...yearData, name: e.target.value.toUpperCase() })} className="input-squishy w-full px-6 py-5 text-sm font-bold border-2 border-slate-50 focus:border-blue-400 transition-all font-mono" placeholder="Ej. 2024-2025" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="group/field">
                                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-2 transition-colors group-focus-within:text-blue-500">Inicio de Clases</label>
                                        <input aria-label="Inicio de Clases" type="date" value={yearData.startDate} onChange={e => {
                                            const val = e.target.value;
                                            if (val && val.split('-')[0].length > 4) return;
                                            setYearData({ ...yearData, startDate: val });
                                        }} className="input-squishy w-full px-6 py-5 text-sm font-bold border-2 border-slate-50 focus:border-blue-400 transition-all text-slate-600" />
                                    </div>
                                    <div className="group/field">
                                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-2 transition-colors group-focus-within:text-blue-500">Fin de Clases</label>
                                        <input aria-label="Fin de Clases" type="date" value={yearData.endDate} onChange={e => {
                                            const val = e.target.value;
                                            if (val && val.split('-')[0].length > 4) return;
                                            setYearData({ ...yearData, endDate: val });
                                        }} className="input-squishy w-full px-6 py-5 text-sm font-bold border-2 border-slate-50 focus:border-blue-400 transition-all text-slate-600" />
                                    </div>
                                </div>
                                <div className="pt-4">
                                    <button onClick={handleCreateYear} className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black text-sm hover:bg-blue-700 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest border-b-4 border-blue-800 hover:border-blue-900 hover:translate-y-0.5">
                                        Generar Calendario <ArrowRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="animate-in fade-in slide-in-from-right duration-500">
                            <div className="text-center mb-10">
                                <div className="inline-flex items-center justify-center p-6 bg-orange-100 rounded-[2rem] text-orange-600 mb-6 shadow-inner ring-4 ring-white">
                                    <Clock className="w-12 h-12" />
                                </div>
                                <h2 className="text-3xl md:text-4xl font-black text-slate-900 italic tracking-tight uppercase">Jornada y Grado</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                                <div className="squishy-card p-8 bg-slate-50 border-2 border-slate-100 space-y-6 md:p-10 h-fit">
                                    <div className="group/field">
                                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-2 transition-colors group-focus-within:text-orange-500">Hora de Entrada</label>
                                        <input aria-label="Hora de Entrada" type="time" value={scheduleSettings.startTime} onChange={e => setScheduleSettings({ ...scheduleSettings, startTime: e.target.value })} className="input-squishy w-full px-6 py-5 text-sm font-bold text-center border-2 border-white focus:border-orange-400 transition-all" />
                                    </div>
                                    <div className="group/field">
                                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-2 transition-colors group-focus-within:text-orange-500">Hora de Salida</label>
                                        <input aria-label="Hora de Salida" type="time" value={scheduleSettings.endTime} onChange={e => setScheduleSettings({ ...scheduleSettings, endTime: e.target.value })} className="input-squishy w-full px-6 py-5 text-sm font-bold text-center border-2 border-white focus:border-orange-400 transition-all" />
                                    </div>
                                    {schoolData.educationalLevel !== 'PRIMARY' && (
                                        <div className="group/field">
                                            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-2 transition-colors group-focus-within:text-orange-500">Duración Módulo (min)</label>
                                            <input aria-label="Duración Módulo (min)" type="number" value={scheduleSettings.moduleDuration} onChange={e => setScheduleSettings({ ...scheduleSettings, moduleDuration: Number(e.target.value) })} className="input-squishy w-full px-6 py-5 text-sm font-bold text-center border-2 border-white focus:border-orange-400 transition-all" />
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-6">
                                    {(schoolData.educationalLevel === 'PRIMARY' || schoolData.educationalLevel === 'TELESECUNDARIA') && (
                                        <div className="squishy-card p-8 bg-indigo-50/30 border-2 border-indigo-100/50 space-y-6 md:p-10">
                                            <div className="p-5 bg-white/60 rounded-[2rem] border-2 border-indigo-100/50 text-center shadow-sm">
                                                <p className="text-[12px] font-black text-indigo-700 uppercase tracking-widest mb-1 italic">Jornada Completa</p>
                                                <p className="text-[11px] font-bold text-indigo-500/80 uppercase">En Primaria y Telesecundaria el horario es por jornada.</p>
                                            </div>

                                            <div className="space-y-4 pt-2">
                                                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest text-center">Grado/Grupo que Impartes</label>
                                                <div className="grid grid-cols-3 gap-3">
                                                    {(schoolData.educationalLevel === 'TELESECUNDARIA' ? [1, 2, 3] : [1, 2, 3, 4, 5, 6]).map(g => (
                                                        <button
                                                            key={g}
                                                            onClick={() => {
                                                                const p = schoolData.educationalLevel === 'TELESECUNDARIA' ? 6 : g <= 2 ? 3 : g <= 4 ? 4 : 5;
                                                                setSchoolData({ ...schoolData, grade: g, phase: p });
                                                            }}
                                                            className={`p-4 sm:p-5 rounded-[1.5rem] border-2 font-black text-sm sm:text-base transition-all active:scale-95 ${schoolData.grade === g ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-[inset_0_4px_12px_rgba(79,70,229,0.15)] ring-4 ring-indigo-100/50' : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:bg-slate-50 shadow-sm'}`}
                                                        >
                                                            {g}°
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="mt-4 text-center">
                                                    <span className="inline-block bg-indigo-600 text-white text-[11px] font-black px-4 py-2 rounded-full uppercase tracking-widest shadow-lg shadow-indigo-600/20">
                                                        Fase {schoolData.phase} NEM
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {tenant?.type !== 'INDEPENDENT' && (tenant?.type as string)?.toLowerCase() !== 'independent' && (
                                        <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                                            <div className="squishy-card p-6 bg-orange-50 rounded-[2rem] border-2 border-orange-100 mb-6">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                                    <div>
                                                        <label className="block text-[11px] font-black text-orange-400 uppercase mb-2 ml-1">Inicio</label>
                                                        <input aria-label="Inicio" type="time" value={newBreak.start} onChange={e => setNewBreak({ ...newBreak, start: e.target.value })} className="input-squishy w-full px-4 py-3 border-2 border-white focus:border-orange-300 text-sm font-bold text-orange-800" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-black text-orange-400 uppercase mb-2 ml-1">Fin</label>
                                                        <input aria-label="Fin" type="time" value={newBreak.end} onChange={e => setNewBreak({ ...newBreak, end: e.target.value })} className="input-squishy w-full px-4 py-3 border-2 border-white focus:border-orange-300 text-sm font-bold text-orange-800" />
                                                    </div>
                                                </div>
                                                <button onClick={handleAddBreak} className="w-full py-4 bg-orange-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-orange-500/20 hover:bg-orange-600 transition-all hover:-translate-y-0.5 active:scale-95 border-b-4 border-orange-700">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Plus className="w-4 h-4" /> Agregar Receso
                                                    </div>
                                                </button>
                                            </div>
                                            {scheduleSettings.breaks.length > 0 && (
                                                <div className="space-y-3">
                                                    {scheduleSettings.breaks.map((b: any, i: number) => (
                                                        <div key={i} className="squishy-card p-5 bg-white border-2 border-slate-100 rounded-2xl flex justify-between items-center capitalize font-bold text-slate-600 shadow-sm">
                                                            <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                                                                <span className="text-sm">{b.name}</span>
                                                                <span className="text-xs text-slate-500 font-mono">({b.start_time} - {b.end_time})</span>
                                                            </div>
                                                            <button aria-label="Eliminar" onClick={() => setScheduleSettings((prev: any) => ({ ...prev, breaks: prev.breaks.filter((_: any, idx: number) => idx !== i) }))} className="text-rose-400 bg-rose-50 p-2.5 rounded-xl hover:bg-rose-100 transition-colors shadow-inner">
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="max-w-4xl mx-auto mt-12">
                                <button onClick={handleSaveSchedule} className="w-full py-5 bg-orange-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-orange-700 transition-all shadow-xl shadow-orange-600/20 active:scale-95 border-b-4 border-orange-800 hover:-translate-y-0.5">
                                    Confirmar Estructura <ArrowRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="animate-in fade-in slide-in-from-right duration-500 max-w-4xl mx-auto flex flex-col h-full">
                            <div className="text-center mb-10">
                                <div className="inline-flex items-center justify-center p-6 bg-emerald-100 rounded-[2rem] text-emerald-700 mb-6 shadow-inner ring-4 ring-white">
                                    <BookOpen className="w-12 h-12" />
                                </div>
                                <h2 className="text-3xl md:text-4xl font-black text-slate-900 italic tracking-tight uppercase">Tus Materias</h2>
                                <p className="text-slate-500 mt-3 font-medium">Selecciona las asignaturas que impartirás este ciclo escolar.</p>
                            </div>

                            <div className="squishy-card bg-emerald-50/30 rounded-[2.5rem] border-4 border-emerald-50 flex flex-col shadow-inner overflow-hidden mb-8 ring-4 ring-white">
                                <div className="bg-white/80 backdrop-blur-md py-5 px-8 border-b-2 border-emerald-100 flex flex-col sm:flex-row gap-4 justify-between items-center relative z-10 shadow-sm">
                                    <span className="text-xs font-black text-emerald-800 uppercase tracking-widest flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/50" />
                                        Catálogo Disponible
                                    </span>
                                    <span className="bg-emerald-100 px-5 py-2 rounded-full text-[11px] font-black text-emerald-700 shadow-inner border border-emerald-200">
                                        {Object.values(selectedSubjects).filter(s => s.selected).length} SELECCIONADAS
                                    </span>
                                </div>
                                <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar max-h-[500px]">
                                    <SubjectSelector
                                        educationalLevel={schoolData.educationalLevel}
                                        selectedSubjects={selectedSubjects}
                                        onChange={setSelectedSubjects}
                                    />
                                </div>
                                <div className="bg-emerald-800/5 backdrop-blur-sm p-4 text-center border-t-2 border-emerald-100/50">
                                    <p className="text-[11px] text-emerald-700/60 font-black uppercase tracking-widest italic">Desplázate para ver más materias ↑↓</p>
                                </div>
                            </div>

                            <div className="max-w-2xl mx-auto w-full">
                                <button
                                    onClick={handleSaveSubjects}
                                    className="w-full py-5 bg-emerald-500 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/30 active:scale-95 border-b-4 border-emerald-700 hover:-translate-y-0.5"
                                >
                                    Guardar Materias <ArrowRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="w-full animate-in fade-in duration-500">
                            <div className="animate-in fade-in slide-in-from-right duration-500 max-w-4xl mx-auto">
                                <div className="text-center mb-12">
                                    <div className="inline-flex items-center justify-center p-6 bg-indigo-100 rounded-[2rem] text-indigo-600 mb-6 shadow-inner ring-4 ring-white">
                                        <CreditCard className="w-12 h-12" />
                                    </div>
                                    <h2 className="text-3xl md:text-5xl font-black text-indigo-950 italic tracking-tight uppercase">¡Ya casi terminamos!</h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="squishy-card bg-white p-10 lg:p-12 rounded-[3rem] border-4 border-blue-50 flex flex-col items-center text-center shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
                                        <div className="p-5 bg-blue-100 rounded-full mb-6">
                                            <Gift className="w-12 h-12 text-blue-600" />
                                        </div>
                                        <h3 className="text-2xl font-black mb-3 text-slate-800 uppercase tracking-tight">Prueba Gratis</h3>
                                        <p className="text-sm text-slate-500 mb-8 font-medium leading-relaxed">Disfruta 30 días sin costo para probar todas las herramientas PRO. Luego, $399/año.</p>
                                        <button onClick={handleStartFreeTrial} className="w-full py-5 bg-slate-100 text-slate-700 rounded-[2rem] font-black uppercase tracking-widest border-2 border-slate-200 hover:bg-slate-200 hover:text-slate-900 transition-all active:scale-95">Iniciar Prueba</button>
                                    </div>

                                    <div className="squishy-card bg-indigo-600 p-10 lg:p-12 rounded-[3rem] border-4 border-indigo-400 flex flex-col items-center text-center shadow-2xl shadow-indigo-600/30 ring-8 ring-indigo-50 hover:-translate-y-1 transition-all relative overflow-hidden">
                                        <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
                                        <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-black/10 rounded-full blur-2xl" />

                                        <div className="p-5 bg-white/20 rounded-full mb-6 backdrop-blur-sm relative z-10">
                                            <Zap className="w-12 h-12 text-white" />
                                        </div>
                                        <h3 className="text-2xl font-black mb-3 text-white uppercase tracking-tight relative z-10">Suscripción PRO</h3>
                                        <div className="mb-8 relative z-10">
                                            <span className="text-5xl font-black text-white">$599</span>
                                            <span className="text-indigo-200 font-bold ml-1 text-lg">/año</span>
                                        </div>
                                        {!Capacitor.isNativePlatform() ? (
                                            <button onClick={handleActivateSubscription} className="w-full py-5 bg-white text-indigo-700 rounded-[2rem] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-xl active:scale-95 border-b-4 border-indigo-200 relative z-10">Activar Ahora</button>
                                        ) : (
                                            <button
                                                onClick={() => window.open('https://vunlek.com', '_system')}
                                                className="clay-button w-full py-4 bg-indigo-50 text-indigo-600 rounded-2xl font-black text-xs uppercase"
                                            >
                                                Gestionar en Web
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-8">
                                <button onClick={handleCancelRegistration} className="w-full py-4 text-red-500 font-bold text-xs uppercase tracking-widest hover:bg-red-50 rounded-2xl transition-all flex items-center justify-center gap-2">
                                    <Trash2 className="w-4 h-4" /> Cancelar Registro
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
