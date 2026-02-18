import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { queryClient } from '../../../lib/queryClient'
import { Check, Calendar, BookOpen, AlertCircle, Trash2, Plus, ArrowRight, School, Clock, Loader2, Coffee, ArrowLeft, CreditCard, Zap, Gift, ShieldCheck } from 'lucide-react'
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
            educationalLevel: 'SECONDARY' as 'SECONDARY' | 'TELESECUNDARIA',
            cct: '',
            shift: 'MORNING'
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
            const { error } = await supabase.from('schedule_settings').upsert({
                tenant_id: tenant?.id,
                start_time: scheduleSettings.startTime,
                end_time: scheduleSettings.endTime,
                module_duration: scheduleSettings.moduleDuration,
                breaks: scheduleSettings.breaks
            })
            if (error) throw error
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

            <div className="clay-card min-h-[500px] relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-50">
                    <div
                        className="h-full bg-blue-600 transition-all duration-500 ease-out"
                        style={{ width: `${((step + 1) / 5) * 100}%` }}
                    />
                </div>

                <div className="p-8 md:p-12">

                    {loading && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                            <p className="mt-6 text-slate-600 font-black uppercase tracking-widest text-xs">Procesando...</p>
                        </div>
                    )}

                    {step === 0 && (
                        // ... step 0 content ...
                        <div className="animate-in fade-in slide-in-from-right duration-500 max-w-lg mx-auto">
                            <div className="text-center mb-10">
                                <div className="inline-flex items-center justify-center p-6 bg-blue-100 rounded-3xl text-blue-600 mb-6 shadow-inner">
                                    <School className="w-12 h-12" />
                                </div>
                                <h2 className="text-3xl font-black text-gray-900">{tenant?.type === 'INDEPENDENT' ? 'Personaliza tu Espacio' : 'Datos de la Escuela'}</h2>
                            </div>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Nombre</label>
                                    <input value={schoolData.name} onChange={e => setSchoolData({ ...schoolData, name: e.target.value.toUpperCase() })} className="clay-input w-full p-4 font-bold" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Nivel</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {['SECONDARY', 'TELESECUNDARIA'].map(l => (
                                                <button key={l} onClick={() => setSchoolData({ ...schoolData, educationalLevel: l as any })} className={`py-4 rounded-2xl border-b-4 font-black transition-all ${schoolData.educationalLevel === l ? 'bg-indigo-100 text-indigo-700 border-indigo-300' : 'bg-slate-50 text-slate-400'}`}>
                                                    {l === 'SECONDARY' ? 'Secundaria' : 'Telesecundaria'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">CCT</label>
                                        <input value={schoolData.cct} onChange={e => setSchoolData({ ...schoolData, cct: e.target.value.toUpperCase() })} className="clay-input w-full p-4 font-bold" />
                                    </div>
                                </div>
                                <button onClick={handleUpdateSchool} className="clay-button w-full py-5 bg-indigo-500 text-white rounded-2xl font-black text-lg hover:bg-indigo-600 flex items-center justify-center gap-3 uppercase tracking-widest">
                                    Continuar <ArrowRight className="w-5 h-5" />
                                </button>
                                <button onClick={handleCancelRegistration} className="w-full mt-4 py-4 text-red-500 font-bold text-xs uppercase tracking-widest hover:bg-red-50 rounded-2xl transition-all flex items-center justify-center gap-2">
                                    <Trash2 className="w-4 h-4" /> Cancelar y Eliminar Cuenta
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 1 && (
                        // ... step 1 content ...
                        <div className="animate-in fade-in slide-in-from-right duration-500 max-w-lg mx-auto">
                            <div className="text-center mb-8">
                                <Calendar className="w-16 h-16 text-blue-600 mx-auto mb-6" />
                                <h2 className="text-3xl font-black text-slate-900">Ciclo Escolar</h2>
                            </div>
                            <div className="space-y-6">
                                <input value={yearData.name} onChange={e => setYearData({ ...yearData, name: e.target.value.toUpperCase() })} className="clay-input w-full p-4 font-bold" />
                                <div className="grid grid-cols-2 gap-4">
                                    <input type="date" value={yearData.startDate} onChange={e => setYearData({ ...yearData, startDate: e.target.value })} className="clay-input w-full p-4 font-bold" />
                                    <input type="date" value={yearData.endDate} onChange={e => setYearData({ ...yearData, endDate: e.target.value })} className="clay-input w-full p-4 font-bold" />
                                </div>
                                <button onClick={handleCreateYear} className="clay-button w-full py-5 bg-blue-500 text-white rounded-2xl font-black text-lg uppercase tracking-widest flex items-center justify-center gap-3">
                                    Continuar <ArrowRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        // ... step 2 content ...
                        <div className="animate-in fade-in slide-in-from-right duration-500">
                            <div className="text-center mb-10">
                                <Clock className="w-16 h-16 text-orange-600 mx-auto mb-6" />
                                <h2 className="text-3xl font-black text-slate-900">Horarios</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-2xl mx-auto">
                                <div className="p-8 bg-slate-50 rounded-3xl border-2 border-slate-100 space-y-4">
                                    <input type="time" value={scheduleSettings.startTime} onChange={e => setScheduleSettings({ ...scheduleSettings, startTime: e.target.value })} className="clay-input w-full p-3 text-center" />
                                    <input type="time" value={scheduleSettings.endTime} onChange={e => setScheduleSettings({ ...scheduleSettings, endTime: e.target.value })} className="clay-input w-full p-3 text-center" />
                                    <input type="number" value={scheduleSettings.moduleDuration} onChange={e => setScheduleSettings({ ...scheduleSettings, moduleDuration: Number(e.target.value) })} className="clay-input w-full p-3 text-center" />
                                </div>
                                <div className="space-y-4">
                                    {/* ... breaks ... */}
                                    {tenant?.type !== 'INDEPENDENT' && (tenant?.type as string)?.toLowerCase() !== 'independent' && (
                                        <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                                            <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100 mb-4">
                                                <div className="grid grid-cols-2 gap-2 mb-2">
                                                    <div>
                                                        <label className="text-[10px] font-black text-orange-400 uppercase">Inicio</label>
                                                        <input type="time" value={newBreak.start} onChange={e => setNewBreak({ ...newBreak, start: e.target.value })} className="w-full p-2 rounded-xl border border-orange-200 text-xs font-bold text-orange-800" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-black text-orange-400 uppercase">Fin</label>
                                                        <input type="time" value={newBreak.end} onChange={e => setNewBreak({ ...newBreak, end: e.target.value })} className="w-full p-2 rounded-xl border border-orange-200 text-xs font-bold text-orange-800" />
                                                    </div>
                                                </div>
                                                <button onClick={handleAddBreak} className="w-full py-2 bg-orange-500 text-white rounded-xl font-black uppercase text-[10px] shadow-lg shadow-orange-200 hover:bg-orange-600 transition-all">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Plus className="w-3 h-3" /> Agregar Receso / Actividad
                                                    </div>
                                                </button>
                                            </div>
                                            {scheduleSettings.breaks.length > 0 && (
                                                <div className="space-y-2">
                                                    {scheduleSettings.breaks.map((b: any, i: number) => (
                                                        <div key={i} className="p-4 bg-white border-2 border-orange-50 rounded-2xl flex justify-between items-center capitalize font-bold text-slate-600">
                                                            <span>{b.name} ({b.start_time} - {b.end_time})</span>
                                                            <button onClick={() => setScheduleSettings((prev: any) => ({ ...prev, breaks: prev.breaks.filter((_: any, idx: number) => idx !== i) }))} className="text-red-400 bg-red-50 p-2 rounded-xl hover:bg-red-100 transition-colors">×</button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <button onClick={handleSaveSchedule} className="clay-button w-full py-6 bg-indigo-500 text-white rounded-3xl font-black text-xl mt-12 uppercase tracking-widest flex items-center justify-center gap-3">
                                Continuar <ArrowRight className="w-6 h-6" />
                            </button>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="animate-in fade-in slide-in-from-right duration-500 max-w-4xl mx-auto flex flex-col h-full">
                            <div className="text-center mb-6">
                                <BookOpen className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
                                <h2 className="text-3xl font-black text-slate-900">Tus Materias</h2>
                                <p className="text-slate-500 mt-2">Selecciona las asignaturas que impartirás este ciclo escolar.</p>
                            </div>

                            <div className="bg-white rounded-3xl border-2 border-slate-100 flex flex-col shadow-sm overflow-hidden mb-6">
                                <div className="bg-emerald-50 py-4 px-6 border-b border-emerald-100 flex justify-between items-center">
                                    <span className="text-xs font-black text-emerald-800 uppercase tracking-widest flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        Catálogo Disponible
                                    </span>
                                    <span className="bg-white px-4 py-1.5 rounded-full text-[10px] font-black text-emerald-600 shadow-sm border border-emerald-100">
                                        {Object.values(selectedSubjects).filter(s => s.selected).length} MATERIAS SELECCIONADAS
                                    </span>
                                </div>
                                <div className="p-2 overflow-y-auto custom-scrollbar max-h-[450px] bg-slate-50/50">
                                    <SubjectSelector
                                        educationalLevel={schoolData.educationalLevel}
                                        selectedSubjects={selectedSubjects}
                                        onChange={setSelectedSubjects}
                                    />
                                </div>
                                <div className="bg-gray-50 p-3 text-center border-t border-gray-100">
                                    <p className="text-[10px] text-gray-400 font-medium">Desplázate para ver más materias</p>
                                </div>
                            </div>

                            <button
                                onClick={handleSaveSubjects}
                                className="clay-button w-full py-5 bg-emerald-500 text-white rounded-2xl font-black text-lg uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-200"
                            >
                                Continuar <ArrowRight className="w-6 h-6" />
                            </button>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="animate-in fade-in slide-in-from-right duration-500 max-w-2xl mx-auto">
                            <div className="text-center mb-10">
                                <CreditCard className="w-16 h-16 text-indigo-600 mx-auto mb-6" />
                                <h2 className="text-3xl font-black text-slate-900">¡Ya casi terminamos!</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white p-8 rounded-3xl border-2 border-blue-100 flex flex-col items-center text-center">
                                    <Gift className="w-10 h-10 text-blue-500 mb-4" />
                                    <h3 className="text-xl font-black mb-2">Prueba Gratis</h3>
                                    <p className="text-sm text-slate-500 mb-6 font-medium">30 días sin costo, luego $399/año.</p>
                                    <button onClick={handleStartFreeTrial} className="clay-button w-full py-4 bg-blue-500 text-white rounded-2xl font-black">Iniciar Prueba</button>
                                </div>
                                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-8 rounded-3xl border-2 border-indigo-200 flex flex-col items-center text-center">
                                    <Zap className="w-10 h-10 text-indigo-600 mb-4" />
                                    <h3 className="text-xl font-black mb-2">Suscripción PRO</h3>
                                    <div className="mb-6"><span className="text-3xl font-black text-indigo-600">$599</span><span className="text-slate-400 font-bold">/año</span></div>
                                    <button onClick={handleActivateSubscription} className="clay-button w-full py-4 bg-indigo-500 text-white rounded-2xl font-black">Activar Ahora</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
