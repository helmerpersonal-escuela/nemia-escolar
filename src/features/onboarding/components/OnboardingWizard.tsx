import { useState, useEffect } from 'react'

import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { queryClient } from '../../../lib/queryClient'

import { Check, Calendar, BookOpen, AlertCircle, Trash2, Plus, ArrowRight, School, Clock, Loader2, Coffee, ArrowLeft, CreditCard, Zap, Gift, X } from 'lucide-react'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'
// import { PaymentModule } from '../../../components/payment/PaymentModule'

export const OnboardingWizard = ({ onComplete }: { onComplete: () => void }) => {
    const navigate = useNavigate()
    const { data: tenant } = useTenant()
    const [step, setStep] = useState(0) // 0: School Details, 1: Cycle, 2: Schedule, 3: Payment
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // --- FORM STATE ---

    // Step 0: School Details
    const [schoolData, setSchoolData] = useState({
        name: '',
        educationalLevel: 'SECONDARY' as 'SECONDARY' | 'TELESECUNDARIA',
        cct: '',
        shift: 'MORNING' // 'MORNING', 'AFTERNOON', 'FULL_TIME'
    })

    // Step 1: Academic Year
    const [yearData, setYearData] = useState({
        name: new Date().getMonth() > 6 ? `CICLO ${new Date().getFullYear()}-${new Date().getFullYear() + 1}` : `CICLO ${new Date().getFullYear() - 1}-${new Date().getFullYear()}`,
        startDate: new Date().getMonth() > 6 ? `${new Date().getFullYear()}-08-26` : `${new Date().getFullYear() - 1}-08-26`,
        endDate: new Date().getMonth() > 6 ? `${new Date().getFullYear() + 1}-07-16` : `${new Date().getFullYear()}-07-16`
    })
    const [activeYearId, setActiveYearId] = useState<string | null>(null)

    // Groups will be created after onboarding based on subscription limits
    const [createdGroups, setCreatedGroups] = useState<any[]>([])

    // Step 2: Subjects
    const [subjectCatalog, setSubjectCatalog] = useState<any[]>([])
    const [groupSubjects, setGroupSubjects] = useState<Record<string, string[]>>({})
    // Map of groupId -> catalogId -> customDetail
    const [subjectSpecs, setSubjectSpecs] = useState<Record<string, Record<string, string>>>({})

    // Step 3: Schedule
    const [scheduleSettings, setScheduleSettings] = useState({
        startTime: '08:00',
        endTime: '14:00',
        moduleDuration: 50,
        breaks: [] as Array<{ name: string, start_time: string, end_time: string }>
    })

    // Payment Modal (Removed in favor of External Browser)
    // const [showPaymentModal, setShowPaymentModal] = useState(false)
    // const [currentPreferenceId, setCurrentPreferenceId] = useState('')

    // --- EFFECTS ---


    // Query Params for Payment Callback
    const [searchParams] = useSearchParams()

    useEffect(() => {
        if (tenant) {
            setSchoolData(prev => ({
                ...prev,
                name: tenant.name?.toUpperCase() || '',
                educationalLevel: (tenant.educationalLevel as any) || 'SECONDARY',
                cct: tenant.cct || ''
            }))
        }
    }, [tenant])

    useEffect(() => {
        const status = searchParams.get('status')
        if (status === 'failure' || status === 'rejected') {
            setError('El pago no fue procesado. Por favor intente nuevamente.')
            setStep(3) // Go back to payment step
        }
    }, [searchParams])

    useEffect(() => {
        const loadCatalog = async () => {
            const { data } = await supabase
                .from('subject_catalog')
                .select('*')
                .or(`educational_level.eq.${schoolData.educationalLevel},educational_level.eq.BOTH`)
                .order('name')
            if (data) setSubjectCatalog(data)
        }
        loadCatalog()
    }, [schoolData.educationalLevel])


    // --- HANDLERS ---

    const handleUpdateSchool = async () => {
        const isIndependent = tenant?.type === 'INDEPENDENT'
        const isNameMissing = !schoolData.name
        const isCctMissing = !isIndependent && !schoolData.cct

        if (isNameMissing || isCctMissing) {
            setError(isIndependent
                ? 'Por favor completa el nombre de tu espacio de trabajo.'
                : 'Por favor completa el nombre y la CCT de la escuela.')
            return
        }
        setLoading(true)
        setError(null)
        try {
            const { error } = await supabase
                .from('tenants')
                .update({
                    name: schoolData.name.toUpperCase(),
                    educational_level: schoolData.educationalLevel,
                    cct: schoolData.cct.toUpperCase(),
                })
                .eq('id', tenant?.id)
            if (error) throw error
            setStep(1)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleCreateYear = async () => {
        if (!yearData.name || !yearData.startDate || !yearData.endDate) {
            setError('Por favor completa las fechas del ciclo escolar.')
            return
        }
        setLoading(true)
        try {
            const { data: existing } = await supabase.from('academic_years').select('id').eq('tenant_id', tenant?.id).eq('is_active', true).maybeSingle()

            if (existing) {
                setActiveYearId(existing.id)
            } else {
                const { data, error } = await supabase.from('academic_years').insert({
                    tenant_id: tenant?.id,
                    name: yearData.name.toUpperCase(),
                    start_date: yearData.startDate,
                    end_date: yearData.endDate,
                    is_active: true
                }).select().maybeSingle()
                if (error) throw error
                setActiveYearId(data.id)
            }
            // Skip to subjects (step 2) since groups are created after onboarding
            setStep(2)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleAssignAllSubjects = () => {
        if (createdGroups.length === 0) return

        const newMap = { ...groupSubjects }
        createdGroups.forEach(g => {
            const coreSubjects = subjectCatalog.filter(s => !s.requires_specification).map(s => s.id)
            newMap[g.id] = coreSubjects
        })
        setGroupSubjects(newMap)
    }

    const handleSaveSubjects = async () => {
        // Enforce validation for required specifications
        let missingSpec = false
        Object.entries(groupSubjects).forEach(([groupId, subjectIds]) => {
            subjectIds.forEach(subId => {
                const catalogItem = subjectCatalog.find(s => s.id === subId)
                if (catalogItem?.requires_specification) {
                    const spec = subjectSpecs[groupId]?.[subId]
                    if (!spec || spec.trim() === '') {
                        missingSpec = true
                    }
                }
            })
        })

        if (missingSpec) {
            setError('Por favor especifica el nombre de la tecnología o especialidad para todas las materias que lo requieran.')
            return
        }

        setLoading(true)
        setError(null)
        try {
            const groupInserts: any[] = []
            const profileInserts: any[] = []
            const { data: { user } } = await supabase.auth.getUser()

            Object.entries(groupSubjects).forEach(([groupId, subjectIds]) => {
                subjectIds.forEach(subId => {
                    const catalogItem = subjectCatalog.find(s => s.id === subId)
                    const spec = subjectSpecs[groupId]?.[subId] || null

                    groupInserts.push({
                        tenant_id: tenant?.id,
                        group_id: groupId,
                        subject_catalog_id: subId,
                        custom_name: spec // Store tech detail as custom_name for group context
                    })

                    if (user) {
                        profileInserts.push({
                            tenant_id: tenant?.id,
                            profile_id: user.id,
                            subject_catalog_id: subId,
                            custom_detail: spec // Store tech detail as custom_detail for profile
                        })
                    }
                })
            })

            if (groupInserts.length > 0) {
                // Clear old associations first to avoid unique constraint errors during re-runs
                const groupIds = createdGroups.map(g => g.id)
                await supabase.from('group_subjects').delete().in('group_id', groupIds)

                const { error } = await supabase.from('group_subjects').insert(groupInserts)
                if (error) console.error("Error inserting group_subjects:", error)

                if (user && profileInserts.length > 0) {
                    // De-duplicate profile inserts (unique on profile_id, subject_catalog_id)
                    const uniqueProfileInserts = Array.from(new Map(profileInserts.map(item => [item.subject_catalog_id, item])).values())
                    await supabase.from('profile_subjects').delete().eq('profile_id', user.id)
                    await supabase.from('profile_subjects').insert(uniqueProfileInserts)
                }
            }

            setStep(2) // Go to schedule (step 2)
        } catch (err: any) {
            console.error(err)
            setStep(2) // Go to schedule even on error
        } finally {
            setLoading(false)
        }
    }

    const handleAddBreak = () => {
        setScheduleSettings(prev => ({
            ...prev,
            breaks: [...prev.breaks, { name: 'RECESO', start_time: '10:30', end_time: '11:00' }]
        }))
    }

    const handleRemoveBreak = (index: number) => {
        setScheduleSettings(prev => ({
            ...prev,
            breaks: prev.breaks.filter((_, i) => i !== index)
        }))
    }

    const handleUpdateBreak = (index: number, field: string, value: string) => {
        setScheduleSettings(prev => ({
            ...prev,
            breaks: prev.breaks.map((b, i) => i === index ? { ...b, [field]: value } : b)
        }))
    }

    const handleSaveSchedule = async () => {
        setLoading(true)
        try {
            // Manual upsert to avoid 409 Conflict
            const { data: existing } = await supabase
                .from('schedule_settings')
                .select('id')
                .eq('tenant_id', tenant?.id)
                .maybeSingle()

            const payload = {
                tenant_id: tenant?.id,
                start_time: scheduleSettings.startTime,
                end_time: scheduleSettings.endTime,
                module_duration: scheduleSettings.moduleDuration,
                breaks: scheduleSettings.breaks
            }

            if (existing) {
                const { error } = await supabase.from('schedule_settings').update(payload).eq('id', existing.id)
                if (error) throw error
            } else {
                const { error } = await supabase.from('schedule_settings').insert(payload)
                if (error) throw error
            }
            setStep(3) // Move to payment step (step 3)
        } catch (err) {
            console.error(err)
            setError('Error al guardar la configuración de horarios')
        } finally {
            setLoading(false)
        }
    }

    const handleStartFreeTrial = async () => {
        setLoading(true)
        try {
            if (!tenant?.id) throw new Error("No se encontró la información de la escuela")

            const { data: { user } } = await supabase.auth.getUser()
            console.log("Creating Preference for User:", user?.email)
            const payerEmail = user?.email || 'test_user_pago@test.com'

            const { data, error } = await supabase.functions.invoke('create-payment-preference', {
                body: {
                    title: 'Prueba Gratis 30 Días',
                    price: 0,
                    quantity: 1,
                    tenantId: tenant.id,
                    userId: user?.id,
                    email: user?.email || 'test_user_pago@test.com', // Fallback
                    planType: 'basic',
                    isTrial: true,
                    trialDays: 30,
                    platform: Capacitor.getPlatform() // 'web', 'ios', or 'android'
                }
            })

            if (error) throw error


            const { preferenceId, init_point } = data

            if (!init_point) {
                throw new Error("No se pudo iniciar el proceso de pago. Intente nuevamente.")
            }

            // Open external browser for payment
            await Browser.open({ url: init_point })

            // Optionally set state to pending verification or similar
            // setCurrentPreferenceId(preferenceId)
            // setShowPaymentModal(true)
        } catch (error: any) {
            console.error('Error creating trial preference:', error)
            setError('Error al iniciar el periodo de prueba: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleActivateSubscription = async () => {
        setLoading(true)
        try {
            if (!tenant?.id) throw new Error("No se encontró la información de la escuela")

            const { data: { user } } = await supabase.auth.getUser()
            const { data, error } = await supabase.functions.invoke('create-payment-preference', {
                body: {
                    title: 'Suscripción Anual - Sistema Escolar',
                    price: 4500, // $4500 MXN
                    quantity: 1,
                    tenantId: tenant.id,
                    userId: user?.id,
                    email: user?.email || 'test_user_pago@test.com',
                    planType: 'pro',
                    isTrial: false,
                    platform: Capacitor.getPlatform()
                }
            })

            if (error) throw error

            const { preferenceId, init_point } = data

            if (!init_point) {
                throw new Error("No se pudo iniciar el proceso de pago. Intente nuevamente.")
            }

            // Open external browser for payment
            await Browser.open({ url: init_point })

            // setCurrentPreferenceId(preferenceId)
            // setShowPaymentModal(true)
        } catch (error: any) {
            console.error('Error creating preference:', error)
            setError('Error al iniciar el proceso de pago: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    // handlePaymentSuccess removed - now handled by DashboardLayout globally
    // to prevent race conditions and ensure unified sync experience.


    return (
        <div className="max-w-4xl mx-auto py-12 px-4 relative">
            {/* Background Elements */}
            <div className="absolute top-0 right-[-10%] w-72 h-72 bg-purple-200/30 rounded-full blur-3xl -z-10 pointer-events-none"></div>
            <div className="absolute bottom-0 left-[-10%] w-72 h-72 bg-blue-200/30 rounded-full blur-3xl -z-10 pointer-events-none"></div>

            {/* Header */}
            <div className="text-center mb-10 relative z-10">
                {new URLSearchParams(window.location.search).get('status') === 'approved' && (
                    <div className="mb-8 p-6 bg-emerald-50 border-2 border-emerald-200 rounded-[2rem] text-center animate-bounce">
                        <p className="text-emerald-700 font-black mb-4">¡PAGO DETECTADO CORRECTAMENTE!</p>
                        <button
                            onClick={() => onComplete()}
                            className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-emerald-200"
                        >
                            Entrar al Portal Ahora
                        </button>
                    </div>
                )}
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                    Configuración Inicial
                </h1>
                <p className="text-slate-500 mt-2 font-medium">
                    Ayúdanos a configurar tu escuela para brindarte la mejor experiencia profesional.
                </p>
            </div>

            {/* Stepper */}
            <div className="flex justify-center mb-12">
                {[0, 1, 2, 3, 4].map((s) => (
                    <div key={s} className="flex items-center">
                        <div className={`w-3 h-3 rounded-full transition-all duration-300 ${s === step ? 'bg-indigo-600 scale-150 ring-4 ring-indigo-100' : s < step ? 'bg-indigo-400' : 'bg-gray-200'}`} />
                        {s < 4 && <div className={`w-12 h-0.5 rounded-full mx-1 ${s < step ? 'bg-indigo-200' : 'bg-gray-100'}`} />}
                    </div>
                ))}
            </div>

            <div className="clay-card min-h-[500px] p-8 md:p-12 relative overflow-hidden">
                {loading && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                        <div className="p-4 bg-white rounded-3xl shadow-xl border border-indigo-50 animate-bounce">
                            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                        </div>
                        <p className="mt-6 text-slate-600 font-black animate-pulse uppercase tracking-[0.2em] text-xs">Procesando información...</p>
                    </div>
                )}

                {step === 0 && (
                    <div className="animate-in fade-in slide-in-from-right duration-500 max-w-lg mx-auto">
                        <div className="text-center mb-10">
                            <div className="inline-flex items-center justify-center p-6 bg-blue-100 rounded-[2rem] text-blue-600 mb-6 shadow-inner">
                                <School className="w-12 h-12 inflatable-icon" />
                            </div>
                            <h2 className="text-3xl font-black text-gray-900 leading-tight">
                                {tenant?.type === 'INDEPENDENT' ? 'Personaliza tu Espacio Docente' : 'Configuración de la Institución'}
                            </h2>
                            <p className="text-gray-500 font-medium mt-2">
                                {tenant?.type === 'INDEPENDENT'
                                    ? 'Define el nombre de tu proyecto educativo o aula virtual.'
                                    : 'Completa los datos oficiales de tu escuela.'}
                            </p>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                                    {tenant?.type === 'INDEPENDENT' ? 'Nombre de tu Proyecto/Aula' : 'Nombre de la Escuela'}
                                </label>
                                <input
                                    type="text"
                                    value={schoolData.name}
                                    onChange={(e) => setSchoolData({ ...schoolData, name: e.target.value.toUpperCase() })}
                                    className="clay-input w-full p-4 font-bold text-gray-800 outline-none"
                                    placeholder={tenant?.type === 'INDEPENDENT' ? 'EJ: MIS CLASES PARTICULARES' : 'EJ: ESCUELA SECUNDARIA TÉCNICA'}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                                        Nivel Educativo
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {['SECONDARY', 'TELESECUNDARIA'].map(l => (
                                            <button
                                                key={l}
                                                onClick={() => setSchoolData({ ...schoolData, educationalLevel: l as any })}
                                                className={`py-4 rounded-2xl border-b-4 text-sm font-black transition-all active:scale-95 ${schoolData.educationalLevel === l ? 'bg-indigo-100 text-indigo-700 border-indigo-300' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}
                                            >
                                                {l === 'SECONDARY' ? 'Secundaria' : 'Telesecundaria'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                                        CCT {tenant?.type === 'INDEPENDENT' && <span className="text-gray-400 font-medium">(Opcional)</span>}
                                    </label>
                                    <input
                                        type="text"
                                        value={schoolData.cct}
                                        onChange={(e) => setSchoolData({ ...schoolData, cct: e.target.value.toUpperCase() })}
                                        className="clay-input w-full p-4 font-bold text-gray-800 outline-none"
                                        placeholder="EJ: 07DPR0001X"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Turno</label>
                                <select
                                    value={schoolData.shift}
                                    onChange={e => setSchoolData({ ...schoolData, shift: e.target.value })}
                                    className="clay-input w-full px-5 py-4 font-bold text-slate-800 appearance-none outline-none"
                                >
                                    <option value="MORNING">Matutino</option>
                                    <option value="AFTERNOON">Vespertino</option>
                                    <option value="FULL_TIME">Tiempo Completo</option>
                                </select>
                            </div>


                            <div className="flex gap-4 mt-6">
                                <button
                                    onClick={async () => {
                                        if (confirm('¿Deseas cancelar el proceso y cerrar sesión? Podrás iniciar de nuevo.')) {
                                            await supabase.auth.signOut()
                                            navigate('/register')
                                        }
                                    }}
                                    className="flex-1 py-5 bg-white border-2 border-slate-100 text-slate-400 rounded-2xl font-black text-lg hover:border-red-100 hover:text-red-500 transition-all uppercase tracking-widest flex items-center justify-center gap-3"
                                >
                                    <ArrowLeft className="w-5 h-5" /> Cancelar
                                </button>
                                <button onClick={handleUpdateSchool} className="clay-button flex-[2] py-5 bg-indigo-500 text-white rounded-2xl font-black text-lg hover:bg-indigo-600 uppercase tracking-widest flex items-center justify-center gap-3">
                                    Continuar <ArrowRight className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {step === 1 && (
                    <div className="animate-in fade-in slide-in-from-right duration-500 max-w-lg mx-auto">
                        <div className="text-center mb-8">
                            <div className="inline-flex p-6 bg-blue-50 rounded-[2rem] text-blue-600 mb-6 border-b-4 border-blue-200 shadow-inner">
                                <Calendar className="w-12 h-12 inflatable-icon" />
                            </div>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Ciclo Escolar</h2>
                            <p className="text-slate-500 font-medium">Define el periodo activo de trabajo</p>
                        </div>
                        <div className="space-y-6">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Nombre del Ciclo</label>
                                <input
                                    value={yearData.name}
                                    onChange={e => setYearData({ ...yearData, name: e.target.value.toUpperCase() })}
                                    className="clay-input w-full px-5 py-4 font-bold text-slate-800 outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Fecha Inicio</label>
                                    <input type="date" value={yearData.startDate} onChange={e => setYearData({ ...yearData, startDate: e.target.value })} className="clay-input w-full px-5 py-4 font-bold text-slate-800 outline-none" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Fecha Fin</label>
                                    <input type="date" value={yearData.endDate} onChange={e => setYearData({ ...yearData, endDate: e.target.value })} className="clay-input w-full px-5 py-4 font-bold text-slate-800 outline-none" />
                                </div>
                            </div>
                            <button onClick={handleCreateYear} className="clay-button w-full py-5 bg-blue-500 text-white rounded-2xl font-black text-lg mt-8 hover:bg-blue-600 uppercase tracking-widest flex items-center justify-center gap-3">
                                Continuar <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="animate-in fade-in slide-in-from-right duration-500">
                        <div className="text-center mb-10">
                            <div className="inline-flex p-6 bg-orange-50 rounded-[2rem] text-orange-600 mb-6 border-b-4 border-orange-200 shadow-inner">
                                <Clock className="w-12 h-12 inflatable-icon" />
                            </div>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Horarios y Recesos</h2>
                            <p className="text-slate-500 font-medium">Configura los tiempos de la jornada escolar</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            {/* General Config */}
                            <div className="space-y-6">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Clock className="w-4 h-4" /> Jornada General
                                </h3>
                                <div className="p-8 bg-slate-50/50 border-2 border-slate-100 rounded-[2rem] space-y-6">
                                    <div className="flex justify-between items-center group">
                                        <label className="font-black text-slate-700">Hora de Entrada</label>
                                        <input type="time" value={scheduleSettings.startTime} onChange={e => setScheduleSettings({ ...scheduleSettings, startTime: e.target.value })} className="clay-input p-3 w-32 font-black text-slate-700 text-center outline-none" />
                                    </div>
                                    <div className="flex justify-between items-center group">
                                        <label className="font-black text-slate-700">Hora de Salida</label>
                                        <input type="time" value={scheduleSettings.endTime} onChange={e => setScheduleSettings({ ...scheduleSettings, endTime: e.target.value })} className="clay-input p-3 w-32 font-black text-slate-700 text-center outline-none" />
                                    </div>
                                    <div className="flex justify-between items-center group">
                                        <label className="font-black text-slate-700">Duración Módulo</label>
                                        <div className="flex items-center gap-2">
                                            <input type="number" value={scheduleSettings.moduleDuration} onChange={e => setScheduleSettings({ ...scheduleSettings, moduleDuration: Number(e.target.value) })} className="clay-input w-24 p-3 font-black text-center outline-none" />
                                            <span className="text-xs font-bold text-slate-400">min</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Breaks Config */}
                            <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Coffee className="w-4 h-4" /> Recesos y Descansos
                                    </h3>
                                    <button onClick={handleAddBreak} className="clay-button p-3 bg-orange-100 text-orange-600 rounded-xl hover:bg-orange-200">
                                        <Plus className="w-6 h-6" />
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {scheduleSettings.breaks.map((b, i) => (
                                        <div key={i} className="p-5 bg-white border-2 border-orange-50 rounded-2xl shadow-sm space-y-4">
                                            <div className="flex gap-2">
                                                <input
                                                    value={b.name}
                                                    onChange={e => handleUpdateBreak(i, 'name', e.target.value.toUpperCase())}
                                                    placeholder="NOMBRE (EJ. RECESO)"
                                                    className="clay-input flex-1 text-xs font-black p-3 outline-none uppercase"
                                                />
                                                <button onClick={() => handleRemoveBreak(i)} className="text-red-300 hover:text-red-500">
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="flex-1 space-y-1">
                                                    <span className="text-[10px] font-black text-slate-300 uppercase">Inicio</span>
                                                    <input type="time" value={b.start_time} onChange={e => handleUpdateBreak(i, 'start_time', e.target.value)} className="clay-input w-full text-sm font-black p-2" />
                                                </div>
                                                <div className="flex-1 space-y-1">
                                                    <span className="text-[10px] font-black text-slate-300 uppercase">Fin</span>
                                                    <input type="time" value={b.end_time} onChange={e => handleUpdateBreak(i, 'end_time', e.target.value)} className="clay-input w-full text-sm font-black p-2" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {scheduleSettings.breaks.length === 0 && (
                                        <div className="py-10 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                                            <p className="text-slate-300 font-bold italic text-sm">No has agregado recesos</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <button onClick={handleSaveSchedule} className="clay-button w-full py-6 bg-indigo-500 text-white rounded-[2rem] font-black text-xl mt-12 hover:bg-indigo-600 flex items-center justify-center gap-4 tracking-widest uppercase">
                            Continuar <ArrowRight className="w-6 h-6" />
                        </button>
                    </div>
                )}

                {step === 3 && (
                    <div className="animate-in fade-in slide-in-from-right duration-500 max-w-2xl mx-auto">
                        <div className="text-center mb-10">
                            <div className="inline-flex p-6 bg-indigo-50 rounded-[2rem] text-indigo-600 mb-6 border-b-4 border-indigo-200 shadow-inner">
                                <CreditCard className="w-12 h-12 inflatable-icon" />
                            </div>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight">¡Ya casi terminamos!</h2>
                            <p className="text-slate-500 font-medium mt-2">Elige cómo quieres comenzar tu experiencia</p>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-2xl flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-700 font-medium">{error}</p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                            {/* Free Trial Option - Basic Plan */}
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-[2rem] opacity-20 group-hover:opacity-30 transition-opacity"></div>
                                <div className="relative bg-white p-8 rounded-[2rem] border-2 border-blue-100 hover:border-blue-300 transition-all h-full flex flex-col">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="p-3 bg-blue-50 rounded-2xl">
                                            <Gift className="w-8 h-8 text-blue-600" />
                                        </div>
                                        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-black rounded-full uppercase tracking-wider">Básico</span>
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900 mb-2">Prueba Gratuita</h3>
                                    <p className="text-slate-600 text-sm font-medium mb-6 flex-grow">
                                        <span className="font-black text-blue-600">30 días gratis</span>, luego $399 MXN/año. Hasta 2 grupos. Cancela cuando quieras.
                                    </p>
                                    <ul className="space-y-3 mb-6">
                                        <li className="flex items-start gap-2 text-sm">
                                            <Check className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                            <span className="text-slate-700 font-medium">Hasta 2 grupos (50 estudiantes c/u)</span>
                                        </li>
                                        <li className="flex items-start gap-2 text-sm">
                                            <Check className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                            <span className="text-slate-700 font-medium">Tarjeta requerida (sin cargo inmediato)</span>
                                        </li>
                                        <li className="flex items-start gap-2 text-sm">
                                            <Check className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                            <span className="text-slate-700 font-medium">Cobro automático después de 30 días</span>
                                        </li>
                                    </ul>
                                    <button
                                        onClick={handleStartFreeTrial}
                                        className="clay-button w-full py-4 bg-blue-500 text-white rounded-2xl font-black text-lg hover:bg-blue-600 flex items-center justify-center gap-2"
                                    >
                                        <Gift className="w-5 h-5" />
                                        Iniciar Prueba de 30 Días
                                    </button>
                                    <p className="text-xs text-center text-slate-500 mt-2 font-medium">
                                        Pago de $0 hoy, luego $399 MXN después de 30 días
                                    </p>
                                </div>
                            </div>

                            {/* Pro Subscription Option */}
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-[2rem] opacity-30 group-hover:opacity-40 transition-opacity"></div>
                                <div className="relative bg-gradient-to-br from-indigo-50 to-purple-50 p-8 rounded-[2rem] border-2 border-indigo-200 hover:border-indigo-300 transition-all h-full flex flex-col">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="p-3 bg-indigo-100 rounded-2xl">
                                            <Zap className="w-8 h-8 text-indigo-600" />
                                        </div>
                                        <span className="px-3 py-1 bg-indigo-600 text-white text-xs font-black rounded-full uppercase tracking-wider">Pro</span>
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900 mb-2">Activar Ahora</h3>
                                    <p className="text-slate-700 text-sm font-medium mb-6 flex-grow">
                                        Activa tu suscripción PRO y obtén <span className="font-black text-indigo-600">hasta 5 grupos</span> con acceso ilimitado inmediato.
                                    </p>
                                    <ul className="space-y-3 mb-6">
                                        <li className="flex items-start gap-2 text-sm">
                                            <Check className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                                            <span className="text-slate-700 font-medium">Hasta 5 grupos (50 estudiantes c/u)</span>
                                        </li>
                                        <li className="flex items-start gap-2 text-sm">
                                            <Check className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                                            <span className="text-slate-700 font-medium">Soporte prioritario 24/7</span>
                                        </li>
                                        <li className="flex items-start gap-2 text-sm">
                                            <Check className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                                            <span className="text-slate-700 font-medium">Actualizaciones y mejoras continuas</span>
                                        </li>
                                    </ul>
                                    <div className="mb-4 p-4 bg-white/70 rounded-xl border border-indigo-100">
                                        <div className="flex items-baseline justify-center gap-2">
                                            <span className="text-4xl font-black text-indigo-600">$599</span>
                                            <span className="text-slate-500 font-bold text-sm">MXN / año</span>
                                        </div>
                                        <p className="text-center text-xs text-slate-500 font-medium mt-1">Pago único anual</p>
                                    </div>
                                    <button
                                        onClick={handleActivateSubscription}
                                        className="clay-button w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl font-black text-lg hover:from-indigo-600 hover:to-purple-600 flex items-center justify-center gap-2"
                                    >
                                        <Zap className="w-5 h-5" />
                                        Activar Suscripción PRO
                                    </button>
                                    <p className="text-xs text-center text-slate-500 mt-2 font-medium">
                                        Pago único de $599 MXN hoy
                                    </p>
                                </div>
                            </div>
                        </div>


                        <div className="text-center">
                            <p className="text-xs text-slate-400 font-medium">
                                🔒 Conexión segura con <span className="font-black text-slate-600">Mercado Pago</span>
                            </p>
                            <p className="text-xs text-slate-400 font-medium mt-1">
                                Puedes cambiar tu plan en cualquier momento desde Configuración
                            </p>
                        </div>
                    </div>
                )}

            </div>

            {/* Payment Modal Removed */}
        </div>
    )
}

