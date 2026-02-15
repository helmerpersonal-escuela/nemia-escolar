import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { queryClient } from '../../../lib/queryClient'
import { Check, Calendar, BookOpen, AlertCircle, Trash2, Plus, ArrowRight, School, Clock, Loader2, Coffee, ArrowLeft, CreditCard, Zap, Gift, ShieldCheck } from 'lucide-react'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'

export const OnboardingWizard = ({ onComplete }: { onComplete: () => void }) => {
    const navigate = useNavigate()
    const { data: tenant } = useTenant()

    const [step, setStep] = useState(() => {
        const saved = sessionStorage.getItem('nemia_onboarding_step')
        return saved ? parseInt(saved, 10) : 0
    })

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [schoolData, setSchoolData] = useState(() => {
        const saved = sessionStorage.getItem('nemia_onboarding_school_data')
        return saved ? JSON.parse(saved) : {
            name: '',
            educationalLevel: 'SECONDARY' as 'SECONDARY' | 'TELESECUNDARIA',
            cct: '',
            shift: 'MORNING'
        }
    })

    const [yearData, setYearData] = useState(() => {
        const saved = sessionStorage.getItem('nemia_onboarding_year_data')
        return saved ? JSON.parse(saved) : {
            name: new Date().getMonth() > 6 ? `CICLO ${new Date().getFullYear()}-${new Date().getFullYear() + 1}` : `CICLO ${new Date().getFullYear() - 1}-${new Date().getFullYear()}`,
            startDate: new Date().getMonth() > 6 ? `${new Date().getFullYear()}-08-26` : `${new Date().getFullYear() - 1}-08-26`,
            endDate: new Date().getMonth() > 6 ? `${new Date().getFullYear() + 1}-07-16` : `${new Date().getFullYear()}-07-16`
        }
    })

    const [scheduleSettings, setScheduleSettings] = useState(() => {
        const saved = sessionStorage.getItem('nemia_onboarding_schedule_data')
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
            sessionStorage.setItem('nemia_onboarding_school_data', JSON.stringify(schoolData))
        }
    }, [schoolData])

    useEffect(() => {
        if (yearData.name) {
            sessionStorage.setItem('nemia_onboarding_year_data', JSON.stringify(yearData))
        }
    }, [yearData])

    useEffect(() => {
        if (scheduleSettings.startTime) {
            sessionStorage.setItem('nemia_onboarding_schedule_data', JSON.stringify(scheduleSettings))
        }
    }, [scheduleSettings])

    useEffect(() => {
        // If storage is EMPTY or only contains the DEFAULT skeleton, try to seed from tenant
        const saved = sessionStorage.getItem('nemia_onboarding_school_data')
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
        sessionStorage.setItem('nemia_onboarding_step', step.toString())
    }, [step])

    useEffect(() => {
        const status = searchParams.get('status')
        if (status === 'approved') {
            // NEW: Set a persistent syncing flag so DashboardLayout knows to keep the overlay
            // even if URL params are lost during redirects/refreshes.
            sessionStorage.setItem('nemia_payment_syncing', 'true')
        }
        if (status === 'failure' || status === 'rejected') {
            setError('El pago no fue procesado. Por favor intente nuevamente.')
            setStep(3)
        }
    }, [searchParams])

    const clearPersistence = () => {
        sessionStorage.removeItem('nemia_onboarding_step')
        sessionStorage.removeItem('nemia_onboarding_school_data')
        sessionStorage.removeItem('nemia_onboarding_year_data')
        sessionStorage.removeItem('nemia_onboarding_schedule_data')
        sessionStorage.removeItem('nemia_payment_syncing')
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
            const { data, error } = await supabase.functions.invoke('create-payment-preference', {
                body: {
                    title: 'Prueba Gratis 30 Días',
                    price: 0,
                    quantity: 1,
                    tenantId: tenant?.id,
                    userId: user?.id,
                    email: user?.email,
                    planType: 'basic',
                    isTrial: true,
                    trialDays: 30,
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

    const handleActivateSubscription = async () => {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            const { data, error } = await supabase.functions.invoke('create-payment-preference', {
                body: {
                    title: 'Suscripción Anual - Sistema Escolar',
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

    const handleAddBreak = () => {
        setScheduleSettings((prev: any) => ({
            ...prev,
            breaks: [...prev.breaks, { name: 'RECESO', start_time: '10:00', end_time: '10:30' }]
        }))
    }

    return (
        <div className="max-w-4xl mx-auto py-12 px-4 relative">
            <div className="text-center mb-10 relative z-10">
                <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Configuración Inicial</h1>
                <p className="text-slate-500 font-medium">Ayúdanos a configurar tu escuela para brindarte la mejor experiencia profesional.</p>
            </div>

            <div className="flex justify-center mb-12">
                {[0, 1, 2, 3].map((s) => (
                    <div key={s} className="flex items-center">
                        <div className={`w-3 h-3 rounded-full transition-all duration-300 ${s === step ? 'bg-indigo-600 scale-150 ring-4 ring-indigo-100' : s < step ? 'bg-indigo-400' : 'bg-gray-200'}`} />
                        {s < 3 && <div className={`w-12 h-0.5 rounded-full mx-1 ${s < step ? 'bg-indigo-200' : 'bg-gray-100'}`} />}
                    </div>
                ))}
            </div>

            <div className="clay-card min-h-[500px] relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-50">
                    <div
                        className="h-full bg-blue-600 transition-all duration-500 ease-out"
                        style={{ width: `${((step + 1) / 4) * 100}%` }}
                    />
                </div>

                <div className="p-8 md:p-12">
                    <div className="mb-8 bg-slate-900 border border-slate-700/50 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl relative z-20">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-white text-[10px] font-black uppercase tracking-widest">¿Ya realizaste tu pago?</p>
                                <p className="text-slate-400 text-[9px] font-medium">Usa este botón si sigues viendo esta pantalla tras pagar</p>
                            </div>
                        </div>
                        <button
                            onClick={async () => {
                                setLoading(true)
                                try {
                                    let tid = tenant?.id
                                    if (!tid) {
                                        const { data: { user } } = await supabase.auth.getUser()
                                        const { data: p } = await supabase.from('profiles').select('tenant_id').eq('id', user?.id).maybeSingle()
                                        tid = p?.tenant_id
                                    }
                                    if (tid) {
                                        await supabase.from('tenants').update({ onboarding_completed: true }).eq('id', tid)
                                        queryClient.clear()
                                        clearPersistence()
                                        window.location.href = '/'
                                    }
                                } catch (e) { console.error(e) } finally { setLoading(false) }
                            }}
                            disabled={loading}
                            className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-emerald-500 transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                            Sincronizar mi suscripción ahora
                        </button>
                    </div>

                    {loading && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                            <p className="mt-6 text-slate-600 font-black uppercase tracking-widest text-xs">Procesando...</p>
                        </div>
                    )}

                    {step === 0 && (
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
                            </div>
                        </div>
                    )}

                    {step === 1 && (
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
                                    <button onClick={handleAddBreak} className="p-3 bg-orange-100 text-orange-600 rounded-xl w-full font-black uppercase text-xs">Agregar Receso</button>
                                    {scheduleSettings.breaks.map((b: any, i: number) => (
                                        <div key={i} className="p-4 bg-white border-2 border-orange-50 rounded-2xl flex justify-between items-center capitalize font-bold text-slate-600">
                                            {b.name} ({b.start_time} - {b.end_time})
                                            <button onClick={() => setScheduleSettings((prev: any) => ({ ...prev, breaks: prev.breaks.filter((_: any, idx: number) => idx !== i) }))} className="text-red-400">×</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <button onClick={handleSaveSchedule} className="clay-button w-full py-6 bg-indigo-500 text-white rounded-3xl font-black text-xl mt-12 uppercase tracking-widest flex items-center justify-center gap-3">
                                Continuar <ArrowRight className="w-6 h-6" />
                            </button>
                        </div>
                    )}

                    {step === 3 && (
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
