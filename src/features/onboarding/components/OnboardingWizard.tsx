import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Check, Users, Calendar, BookOpen, AlertCircle, Trash2, Plus, ArrowRight, School, Clock, Loader2, Coffee } from 'lucide-react'

export const OnboardingWizard = ({ onComplete }: { onComplete: () => void }) => {
    const { data: tenant } = useTenant()
    const [step, setStep] = useState(0) // 0: School Details, 1: Cycle, 2: Groups, 3: Subjects, 4: Schedule
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // --- FORM STATE ---

    // Step 0: School Details
    const [schoolData, setSchoolData] = useState({
        name: '',
        educationalLevel: 'PRIMARY' as 'PRESCHOOL' | 'PRIMARY' | 'SECONDARY' | 'HIGH_SCHOOL',
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

    // Step 2: Groups
    const [createdGroups, setCreatedGroups] = useState<any[]>([])
    const [bulkGrade, setBulkGrade] = useState('1')
    const [bulkSections, setBulkSections] = useState('A')

    // Step 3: Subjects
    const [subjectCatalog, setSubjectCatalog] = useState<any[]>([])
    const [groupSubjects, setGroupSubjects] = useState<Record<string, string[]>>({})
    // Map of groupId -> catalogId -> customDetail
    const [subjectSpecs, setSubjectSpecs] = useState<Record<string, Record<string, string>>>({})

    // Step 4: Schedule
    const [scheduleSettings, setScheduleSettings] = useState({
        startTime: '08:00',
        endTime: '14:00',
        moduleDuration: 50,
        breaks: [] as Array<{ name: string, start_time: string, end_time: string }>
    })

    // --- EFFECTS ---

    useEffect(() => {
        if (tenant) {
            setSchoolData(prev => ({
                ...prev,
                name: tenant.name?.toUpperCase() || '',
                educationalLevel: (tenant.educationalLevel as any) || 'PRIMARY',
                cct: tenant.cct || ''
            }))
        }
    }, [tenant])

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
            setStep(2)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleAddGroup = async () => {
        if (!activeYearId) return
        setLoading(true)
        try {
            const { data, error } = await supabase.from('groups').insert({
                tenant_id: tenant?.id,
                academic_year_id: activeYearId,
                grade: bulkGrade,
                section: bulkSections.toUpperCase(),
                shift: schoolData.shift
            }).select().maybeSingle()

            if (error) throw error
            setCreatedGroups(prev => [...prev, data])

            const nextSection = String.fromCharCode(bulkSections.charCodeAt(0) + 1)
            if (/[A-Z]/.test(nextSection)) setBulkSections(nextSection)

        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteGroup = async (id: string) => {
        setLoading(true)
        try {
            await supabase.from('groups').delete().eq('id', id)
            setCreatedGroups(prev => prev.filter(g => g.id !== id))
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

            setStep(4)
        } catch (err: any) {
            console.error(err)
            setStep(4)
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

    const handleFinish = async () => {
        setLoading(true)
        try {
            await supabase.from('schedule_settings').upsert({
                tenant_id: tenant?.id,
                start_time: scheduleSettings.startTime,
                end_time: scheduleSettings.endTime,
                module_duration: scheduleSettings.moduleDuration,
                breaks: scheduleSettings.breaks
            })

            await supabase.from('tenants').update({ onboarding_completed: true }).eq('id', tenant?.id)
            onComplete()
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-4xl mx-auto py-12 px-4">
            {/* Header */}
            <div className="text-center mb-10">
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

            <div className="bg-white rounded-[2rem] shadow-2xl shadow-indigo-100/50 border border-slate-100 min-h-[500px] p-8 md:p-12 relative overflow-hidden">
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
                            <div className="inline-flex items-center justify-center p-4 bg-blue-100 rounded-3xl text-blue-600 mb-4">
                                {tenant?.type === 'INDEPENDENT' ? <Users className="w-8 h-8" /> : <School className="w-8 h-8" />}
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
                                    className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none transition-all font-bold text-gray-800"
                                    placeholder={tenant?.type === 'INDEPENDENT' ? 'EJ: MIS CLASES PARTICULARES' : 'EJ: ESCUELA PRIMARIA BENITO JUAREZ'}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                                        Nivel Educativo
                                    </label>
                                    <select
                                        value={schoolData.educationalLevel}
                                        onChange={(e) => setSchoolData({ ...schoolData, educationalLevel: e.target.value as any })}
                                        className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none transition-all font-bold text-gray-800 appearance-none"
                                    >
                                        <option value="PRESCHOOL">Preescolar</option>
                                        <option value="PRIMARY">Primaria</option>
                                        <option value="SECONDARY">Secundaria</option>
                                        <option value="HIGH_SCHOOL">Preparatoria</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                                        CCT {tenant?.type === 'INDEPENDENT' && <span className="text-gray-400 font-medium">(Opcional)</span>}
                                    </label>
                                    <input
                                        type="text"
                                        value={schoolData.cct}
                                        onChange={(e) => setSchoolData({ ...schoolData, cct: e.target.value.toUpperCase() })}
                                        className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none transition-all font-bold text-gray-800"
                                        placeholder="EJ: 07DPR0001X"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Turno</label>
                                <select
                                    value={schoolData.shift}
                                    onChange={e => setSchoolData({ ...schoolData, shift: e.target.value })}
                                    className="w-full px-5 py-4 rounded-2xl border-slate-100 border-2 focus:border-indigo-500 focus:outline-none font-bold text-slate-800 transition-all appearance-none bg-white"
                                >
                                    <option value="MORNING">Matutino</option>
                                    <option value="AFTERNOON">Vespertino</option>
                                    <option value="FULL_TIME">Tiempo Completo</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Nivel Educativo</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {['PRESCHOOL', 'PRIMARY', 'SECONDARY', 'HIGH_SCHOOL'].map(l => (
                                        <button
                                            key={l}
                                            onClick={() => setSchoolData({ ...schoolData, educationalLevel: l as any })}
                                            className={`py-4 rounded-2xl border-2 text-sm font-black transition-all ${schoolData.educationalLevel === l ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md shadow-indigo-100' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
                                        >
                                            {l === 'PRESCHOOL' ? 'Preescolar' : l === 'PRIMARY' ? 'Primaria' : l === 'SECONDARY' ? 'Secundaria' : 'Bachillerato'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button onClick={handleUpdateSchool} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-lg mt-4 hover:bg-indigo-700 shadow-xl shadow-indigo-200 hover:-translate-y-0.5 active:translate-y-0 transition-all uppercase tracking-widest flex items-center justify-center gap-3">
                                Continuar <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}

                {step === 1 && (
                    <div className="animate-in fade-in slide-in-from-right duration-500 max-w-lg mx-auto">
                        <div className="text-center mb-8">
                            <div className="inline-flex p-4 bg-blue-50 rounded-[2rem] text-blue-600 mb-4 border-2 border-blue-100">
                                <Calendar className="w-10 h-10" />
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
                                    className="w-full px-5 py-4 rounded-2xl border-slate-100 border-2 focus:border-blue-500 focus:outline-none font-bold text-slate-800"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Fecha Inicio</label>
                                    <input type="date" value={yearData.startDate} onChange={e => setYearData({ ...yearData, startDate: e.target.value })} className="w-full px-5 py-4 rounded-2xl border-slate-100 border-2 font-bold text-slate-800" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Fecha Fin</label>
                                    <input type="date" value={yearData.endDate} onChange={e => setYearData({ ...yearData, endDate: e.target.value })} className="w-full px-5 py-4 rounded-2xl border-slate-100 border-2 font-bold text-slate-800" />
                                </div>
                            </div>
                            <button onClick={handleCreateYear} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-lg mt-4 hover:bg-blue-700 shadow-xl shadow-blue-200 hover:-translate-y-0.5 active:translate-y-0 transition-all uppercase tracking-widest flex items-center justify-center gap-3">
                                Configurar Grupos <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="animate-in fade-in slide-in-from-right duration-500 max-w-lg mx-auto">
                        <div className="text-center mb-8">
                            <div className="inline-flex p-4 bg-emerald-50 rounded-[2rem] text-emerald-600 mb-4 border-2 border-emerald-100">
                                <Users className="w-10 h-10" />
                            </div>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Mis Grupos</h2>
                            <p className="text-slate-500 font-medium">Agrega los grupos que estarán a tu cargo</p>
                        </div>

                        <div className="bg-slate-50/80 p-6 rounded-[2rem] mb-8 flex items-end gap-3 border border-slate-100">
                            <div className="flex-1 space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Grado</label>
                                <select value={bulkGrade} onChange={e => setBulkGrade(e.target.value)} className="w-full p-4 rounded-2xl border border-slate-200 font-black bg-white appearance-none text-slate-700">
                                    {[1, 2, 3, 4, 5, 6].map(g => <option key={g} value={g}>{g}° Grado</option>)}
                                </select>
                            </div>
                            <div className="flex-1 space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Sección</label>
                                <input value={bulkSections} onChange={e => setBulkSections(e.target.value.toUpperCase())} className="w-full p-4 rounded-2xl border border-slate-200 font-black text-center bg-white" maxLength={1} />
                            </div>
                            <button onClick={handleAddGroup} className="p-4 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all hover:scale-105 active:scale-95">
                                <Plus className="w-8 h-8" />
                            </button>
                        </div>

                        <div className="space-y-3 mb-8 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                            {createdGroups.map(g => (
                                <div key={g.id} className="group flex justify-between items-center p-5 bg-white border-2 border-slate-50 rounded-2xl shadow-sm hover:border-emerald-200 hover:shadow-md transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-xl">
                                            {g.grade}{g.section}
                                        </div>
                                        <div>
                                            <span className="font-black text-slate-800 text-lg uppercase">{g.grade}° de {schoolData.educationalLevel === 'PRIMARY' ? 'Primaria' : 'Secundaria'}</span>
                                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{g.shift === 'MORNING' ? 'Turno Matutino' : 'Turno Vespertino'}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => handleDeleteGroup(g.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            ))}
                            {createdGroups.length === 0 && (
                                <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-[2rem]">
                                    <p className="text-slate-400 font-bold italic">Agrega tu primer grupo para continuar</p>
                                </div>
                            )}
                        </div>

                        <button onClick={() => setStep(3)} disabled={createdGroups.length === 0} className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-emerald-100 disabled:opacity-50 transition-all">
                            Siguiente ({createdGroups.length} {createdGroups.length === 1 ? 'Grupo' : 'Grupos'})
                        </button>
                    </div>
                )}

                {step === 3 && (
                    <div className="animate-in fade-in slide-in-from-right duration-500">
                        <div className="text-center mb-8">
                            <div className="inline-flex p-4 bg-purple-50 rounded-[2rem] text-purple-600 mb-4 border-2 border-purple-100">
                                <BookOpen className="w-10 h-10" />
                            </div>
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Contenidos y Materias</h2>
                            <p className="text-slate-500 font-medium">Asigna las disciplinas a cada grupo</p>
                        </div>

                        <div className="flex justify-center mb-10">
                            <button onClick={handleAssignAllSubjects} className="px-6 py-3 bg-indigo-50 text-indigo-700 rounded-full font-black text-sm hover:bg-indigo-100 transition-all flex items-center gap-2 border border-indigo-200">
                                ✨ Carga Rápida NEM (Asignar materias oficiales)
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[450px] overflow-y-auto pr-4 custom-scrollbar">
                            {createdGroups.map(g => {
                                const assignedIds = groupSubjects[g.id] || []
                                return (
                                    <div key={g.id} className="p-6 bg-slate-50/50 border-2 border-slate-100 rounded-[2rem] space-y-4">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-black text-slate-700">
                                                {g.grade}{g.section}
                                            </div>
                                            <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">{g.grade}° "{g.section}"</h3>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="relative">
                                                <select
                                                    onChange={(e) => {
                                                        if (e.target.value) {
                                                            const current = groupSubjects[g.id] || []
                                                            if (!current.includes(e.target.value)) {
                                                                setGroupSubjects({ ...groupSubjects, [g.id]: [...current, e.target.value] })
                                                            }
                                                        }
                                                    }}
                                                    className="w-full p-4 rounded-xl border border-slate-200 bg-white font-bold text-sm text-slate-600 outline-none focus:border-indigo-400 appearance-none"
                                                >
                                                    <option value="">+ Agregar Materia</option>
                                                    {subjectCatalog.map(s => (
                                                        <option key={s.id} value={s.id}>{s.name}</option>
                                                    ))}
                                                </select>
                                                <Plus className="absolute right-4 top-4 w-4 h-4 text-slate-400 pointer-events-none" />
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                {assignedIds.map(subId => {
                                                    const catalogItem = subjectCatalog.find(s => s.id === subId)
                                                    const requiresSpec = catalogItem?.requires_specification
                                                    return (
                                                        <div key={subId} className="w-full bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-3">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-sm font-black text-slate-700 uppercase">{catalogItem?.name}</span>
                                                                <button
                                                                    onClick={() => {
                                                                        const filtered = assignedIds.filter(id => id !== subId)
                                                                        setGroupSubjects({ ...groupSubjects, [g.id]: filtered })
                                                                    }}
                                                                    className="text-red-300 hover:text-red-500"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                            {requiresSpec && (
                                                                <input
                                                                    type="text"
                                                                    placeholder="Ej: Carpintería, Informática, Danza..."
                                                                    value={subjectSpecs[g.id]?.[subId] || ''}
                                                                    onChange={(e) => {
                                                                        setSubjectSpecs({
                                                                            ...subjectSpecs,
                                                                            [g.id]: {
                                                                                ...(subjectSpecs[g.id] || {}),
                                                                                [subId]: e.target.value.toUpperCase()
                                                                            }
                                                                        })
                                                                    }}
                                                                    className="w-full text-xs p-3 border-2 border-indigo-50 bg-indigo-50/30 rounded-lg focus:border-indigo-200 focus:outline-none font-bold placeholder:text-indigo-300"
                                                                />
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        <button onClick={handleSaveSubjects} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-lg mt-10 shadow-xl shadow-indigo-100 hover:bg-indigo-700">
                            Configurar Horario <ArrowRight className="w-5 h-5 inline-block ml-2" />
                        </button>
                    </div>
                )}

                {step === 4 && (
                    <div className="animate-in fade-in slide-in-from-right duration-500">
                        <div className="text-center mb-10">
                            <div className="inline-flex p-4 bg-orange-50 rounded-[2rem] text-orange-600 mb-4 border-2 border-orange-100">
                                <Clock className="w-10 h-10" />
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
                                        <input type="time" value={scheduleSettings.startTime} onChange={e => setScheduleSettings({ ...scheduleSettings, startTime: e.target.value })} className="p-3 border-2 border-white rounded-xl font-black text-slate-700 shadow-sm focus:border-orange-400 outline-none" />
                                    </div>
                                    <div className="flex justify-between items-center group">
                                        <label className="font-black text-slate-700">Hora de Salida</label>
                                        <input type="time" value={scheduleSettings.endTime} onChange={e => setScheduleSettings({ ...scheduleSettings, endTime: e.target.value })} className="p-3 border-2 border-white rounded-xl font-black text-slate-700 shadow-sm focus:border-orange-400 outline-none" />
                                    </div>
                                    <div className="flex justify-between items-center group">
                                        <label className="font-black text-slate-700">Duración Módulo</label>
                                        <div className="flex items-center gap-2">
                                            <input type="number" value={scheduleSettings.moduleDuration} onChange={e => setScheduleSettings({ ...scheduleSettings, moduleDuration: Number(e.target.value) })} className="w-20 p-3 border-2 border-white rounded-xl font-black shadow-sm text-center outline-none focus:border-orange-400" />
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
                                    <button onClick={handleAddBreak} className="p-2 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200 transition-colors">
                                        <Plus className="w-5 h-5" />
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
                                                    className="flex-1 text-xs font-black p-2 bg-slate-50 rounded-lg outline-none focus:bg-orange-50/50 uppercase"
                                                />
                                                <button onClick={() => handleRemoveBreak(i)} className="text-red-300 hover:text-red-500">
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="flex-1 space-y-1">
                                                    <span className="text-[10px] font-black text-slate-300 uppercase">Inicio</span>
                                                    <input type="time" value={b.start_time} onChange={e => handleUpdateBreak(i, 'start_time', e.target.value)} className="w-full text-sm font-black p-2 border border-slate-100 rounded-lg" />
                                                </div>
                                                <div className="flex-1 space-y-1">
                                                    <span className="text-[10px] font-black text-slate-300 uppercase">Fin</span>
                                                    <input type="time" value={b.end_time} onChange={e => handleUpdateBreak(i, 'end_time', e.target.value)} className="w-full text-sm font-black p-2 border border-slate-100 rounded-lg" />
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

                        <button onClick={handleFinish} className="w-full py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xl mt-12 hover:bg-black shadow-2xl shadow-slate-300 transform hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-4 tracking-widest uppercase">
                            🎉 Finalizar Configuración y Entrar
                        </button>
                    </div>
                )}

            </div>
        </div>
    )
}
