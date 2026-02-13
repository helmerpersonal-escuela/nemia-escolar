import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import {
    School,
    MapPin,
    PhoneCall,
    BookOpen,
    ShieldCheck,
    ArrowRight,
    ArrowLeft,
    Check,
    Upload,
    Loader2,
    Globe,
    Instagram,
    Facebook,
    Twitter
} from 'lucide-react'

export const SchoolOnboardingWizard = ({ onComplete }: { onComplete: () => void }) => {
    const { data: tenant } = useTenant()
    const [step, setStep] = useState(0)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // --- FORM STATE ---
    const [formData, setFormData] = useState({
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
        educational_level: 'SECUNDARIA TÉCNICA',
        curriculum_plan: 'PLAN 2022 (NEM)',
        workshops: [] as string[],
        current_cycle_start: '2025-08-25',
        current_cycle_end: '2026-07-15',

        // 5. Auth & Logos
        director_name: '',
        director_curp: '',
        logo_url: '',
        header_logo_url: '',
        digital_seal_url: ''
    })

    const [newWorkshop, setNewWorkshop] = useState('')

    useEffect(() => {
        if (tenant) {
            setFormData(prev => ({
                ...prev,
                official_name: tenant.name || '',
                cct: tenant.cct || '',
                logo_url: tenant.logoUrl || ''
            }))
        }
    }, [tenant])

    const handleSaveStep = async () => {
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
            // Exclude current_cycle_start and current_cycle_end as they are not in the schema yet
            const { current_cycle_start, current_cycle_end, ...schoolData } = formData

            const { error: schoolError } = await supabase
                .from('school_details')
                .upsert({
                    tenant_id: tenant?.id,
                    ...schoolData,
                    official_name: formData.official_name.toUpperCase(),
                    cct: formData.cct.toUpperCase(),
                    updated_at: new Date().toISOString()
                })

            if (schoolError) throw schoolError

            // 2. Mark onboarding as completed in tenants
            const { error: tenantError } = await supabase
                .from('tenants')
                .update({
                    onboarding_completed: true,
                    name: formData.official_name.toUpperCase(),
                    cct: formData.cct.toUpperCase()
                })
                .eq('id', tenant?.id)

            if (tenantError) throw tenantError

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
            setFormData(prev => ({
                ...prev,
                workshops: [...prev.workshops, newWorkshop.trim().toUpperCase()]
            }))
            setNewWorkshop('')
        }
    }

    const handleRemoveWorkshop = (index: number) => {
        setFormData(prev => ({
            ...prev,
            workshops: prev.workshops.filter((_, i) => i !== index)
        }))
    }

    return (
        <div className="max-w-5xl mx-auto py-8 px-4">
            {/* Header */}
            <div className="flex justify-between items-center mb-12">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                        Configuración Institucional
                    </h1>
                    <p className="text-slate-500 font-medium">
                        Configura el espacio digital oficial de tu plantel educativo.
                    </p>
                </div>
                <div className="hidden md:flex items-center space-x-2">
                    {steps.map((s, i) => (
                        <div key={i} className="flex items-center">
                            <div className={`p-2 rounded-xl transition-all ${step === i ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : step > i ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                <s.icon className="w-5 h-5" />
                            </div>
                            {i < steps.length - 1 && <div className={`w-4 h-0.5 ${step > i ? 'bg-emerald-200' : 'bg-slate-100'}`} />}
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-blue-100/50 border border-slate-100 overflow-hidden relative min-h-[600px]">
                {loading && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                        <p className="font-black text-slate-900 uppercase tracking-widest text-sm">Guardando configuración...</p>
                    </div>
                )}

                {/* Progress Bar */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-50">
                    <div
                        className="h-full bg-blue-600 transition-all duration-500 ease-out"
                        style={{ width: `${((step + 1) / steps.length) * 100}%` }}
                    />
                </div>

                <div className="p-8 md:p-12">
                    {/* Error Alert */}
                    {error && (
                        <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 font-bold flex items-center shadow-sm">
                            <ArrowLeft className="w-5 h-5 mr-3" />
                            {error}
                        </div>
                    )}

                    {/* Step 0: Identity */}
                    {step === 0 && (
                        <div className="animate-in fade-in slide-in-from-right duration-500">
                            <SectionHeader
                                title="Identidad Institucional"
                                description="Datos fiscales y legales que identifican al plantel ante las autoridades."
                                icon={School}
                                color="blue"
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <InputField
                                    label="Nombre Oficial del Plantel"
                                    value={formData.official_name}
                                    onChange={v => setFormData({ ...formData, official_name: v })}
                                    placeholder='Ej: "ESCUELA SECUNDARIA TÉCNICA NO. 12"'
                                />
                                <InputField
                                    label="CCT (Clave Centro de Trabajo)"
                                    value={formData.cct}
                                    onChange={v => setFormData({ ...formData, cct: v })}
                                    placeholder="00XXX0000X"
                                />
                                <SelectField
                                    label="Turno"
                                    value={formData.shift}
                                    onChange={v => setFormData({ ...formData, shift: v as any })}
                                    options={[
                                        { label: 'Matutino', value: 'MORNING' },
                                        { label: 'Vespertino', value: 'AFTERNOON' },
                                        { label: 'Tiempo Completo', value: 'FULL_TIME' }
                                    ]}
                                />
                                <InputField
                                    label="Zona Escolar"
                                    value={formData.zone}
                                    onChange={v => setFormData({ ...formData, zone: v })}
                                    placeholder="Ej: 054"
                                />
                                <InputField
                                    label="Sector"
                                    value={formData.sector}
                                    onChange={v => setFormData({ ...formData, sector: v })}
                                    placeholder="Ej: 01"
                                />
                                <SelectField
                                    label="Régimen"
                                    value={formData.regime}
                                    onChange={v => setFormData({ ...formData, regime: v })}
                                    options={[
                                        { label: 'Público (Federal)', value: 'PÚBLICO (FEDERAL)' },
                                        { label: 'Público (Estatal)', value: 'PÚBLICO (ESTATAL)' },
                                        { label: 'Transferido', value: 'TRANSFERIDO' },
                                        { label: 'Particular / Privado', value: 'PARTICULAR' }
                                    ]}
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 1: Location */}
                    {step === 1 && (
                        <div className="animate-in fade-in slide-in-from-right duration-500">
                            <SectionHeader
                                title="Ubicación Geográfica"
                                description="Dirección oficial para geolocalización y documentos administrativos."
                                icon={MapPin}
                                color="emerald"
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="md:col-span-2">
                                    <InputField
                                        label="Calle y Número (Exterior/Interior)"
                                        value={formData.address_street}
                                        onChange={v => setFormData({ ...formData, address_street: v })}
                                        placeholder="Ej: Av. Reforma S/N"
                                    />
                                </div>
                                <InputField
                                    label="Colonia o Localidad"
                                    value={formData.address_neighborhood}
                                    onChange={v => setFormData({ ...formData, address_neighborhood: v })}
                                    placeholder="Ej: Centro"
                                />
                                <InputField
                                    label="Código Postal"
                                    value={formData.address_zip_code}
                                    onChange={v => setFormData({ ...formData, address_zip_code: v })}
                                    placeholder="00000"
                                />
                                <InputField
                                    label="Municipio"
                                    value={formData.address_municipality}
                                    onChange={v => setFormData({ ...formData, address_municipality: v })}
                                    placeholder="Ej: Guadalajara"
                                />
                                <InputField
                                    label="Estado"
                                    value={formData.address_state}
                                    onChange={v => setFormData({ ...formData, address_state: v })}
                                    placeholder="Ej: Jalisco"
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 2: Contact */}
                    {step === 2 && (
                        <div className="animate-in fade-in slide-in-from-right duration-500">
                            <SectionHeader
                                title="Contacto y Comunicación"
                                description="Canales oficiales para vinculación con la SEP y la comunidad."
                                icon={PhoneCall}
                                color="purple"
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <InputField
                                    label="Teléfono Institucional"
                                    value={formData.phone}
                                    onChange={v => setFormData({ ...formData, phone: v })}
                                    placeholder="(000) 000-0000"
                                />
                                <InputField
                                    label="Correo Electrónico Oficial"
                                    value={formData.email}
                                    onChange={v => setFormData({ ...formData, email: v })}
                                    placeholder="correo@escuela.gob.mx"
                                />
                                <div className="md:col-span-2">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center">
                                        <Globe className="w-4 h-4 mr-2" /> Redes Sociales y Sitios
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="relative">
                                            <Globe className="absolute left-4 top-4 w-5 h-5 text-slate-300" />
                                            <input
                                                value={formData.social_media.website}
                                                onChange={e => setFormData({ ...formData, social_media: { ...formData.social_media, website: e.target.value } })}
                                                className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-slate-100 focus:border-purple-400 outline-none font-bold text-slate-700"
                                                placeholder="Sitio Web (Opcional)"
                                            />
                                        </div>
                                        <div className="relative">
                                            <Facebook className="absolute left-4 top-4 w-5 h-5 text-slate-300" />
                                            <input
                                                value={formData.social_media.facebook}
                                                onChange={e => setFormData({ ...formData, social_media: { ...formData.social_media, facebook: e.target.value } })}
                                                className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-slate-100 focus:border-purple-400 outline-none font-bold text-slate-700"
                                                placeholder="Facebook Profile"
                                            />
                                        </div>
                                        <div className="relative">
                                            <Instagram className="absolute left-4 top-4 w-5 h-5 text-slate-300" />
                                            <input
                                                value={formData.social_media.instagram}
                                                onChange={e => setFormData({ ...formData, social_media: { ...formData.social_media, instagram: e.target.value } })}
                                                className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-slate-100 focus:border-purple-400 outline-none font-bold text-slate-700"
                                                placeholder="Instagram Handle"
                                            />
                                        </div>
                                        <div className="relative">
                                            <Twitter className="absolute left-4 top-4 w-5 h-5 text-slate-300" />
                                            <input
                                                value={formData.social_media.twitter}
                                                onChange={e => setFormData({ ...formData, social_media: { ...formData.social_media, twitter: e.target.value } })}
                                                className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-slate-100 focus:border-purple-400 outline-none font-bold text-slate-700"
                                                placeholder="Twitter / X"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Academic */}
                    {step === 3 && (
                        <div className="animate-in fade-in slide-in-from-right duration-500">
                            <SectionHeader
                                title="Configuración Académica"
                                description="Programas de estudio, tecnologías y fechas clave del ciclo."
                                icon={BookOpen}
                                color="orange"
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <SelectField
                                    label="Nivel Educativo"
                                    value={formData.educational_level}
                                    onChange={v => setFormData({ ...formData, educational_level: v })}
                                    options={[
                                        { label: 'Secundaria General', value: 'SECUNDARIA GENERAL' },
                                        { label: 'Secundaria Técnica', value: 'SECUNDARIA TÉCNICA' },
                                        { label: 'Telesecundaria', value: 'TELESECUNDARIA' },
                                        { label: 'Bachillerato', value: 'BACHILLERATO' }
                                    ]}
                                />
                                <SelectField
                                    label="Plan de Estudios"
                                    value={formData.curriculum_plan}
                                    onChange={v => setFormData({ ...formData, curriculum_plan: v })}
                                    options={[
                                        { label: 'Plan 2022 (NEM)', value: 'PLAN 2022 (NEM)' },
                                        { label: 'Plan 2017 (Aprendizajes Clave)', value: 'PLAN 2017' },
                                        { label: 'Plan 2011', value: 'PLAN 2011' }
                                    ]}
                                />
                                <div className="space-y-4">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Ciclo Escolar Actual</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-slate-400 ml-1">INICIO</span>
                                            <input type="date" value={formData.current_cycle_start} onChange={e => setFormData({ ...formData, current_cycle_start: e.target.value })} className="w-full p-4 rounded-2xl border-2 border-slate-100 font-bold text-slate-700" />
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold text-slate-400 ml-1">FIN</span>
                                            <input type="date" value={formData.current_cycle_end} onChange={e => setFormData({ ...formData, current_cycle_end: e.target.value })} className="w-full p-4 rounded-2xl border-2 border-slate-100 font-bold text-slate-700" />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Tecnologías / Talleres</label>
                                    <div className="flex gap-2">
                                        <input
                                            value={newWorkshop}
                                            onChange={e => setNewWorkshop(e.target.value)}
                                            onKeyPress={e => e.key === 'Enter' && handleAddWorkshop()}
                                            placeholder="Añadir Taller (Ej: Carpintería)"
                                            className="flex-grow p-4 rounded-2xl border-2 border-slate-100 font-bold outline-none focus:border-orange-400 text-sm"
                                        />
                                        <button onClick={handleAddWorkshop} className="p-4 bg-orange-600 text-white rounded-2xl shadow-lg shadow-orange-100 active:scale-95 transition-all">
                                            <Check className="w-6 h-6" />
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {formData.workshops.map((w, i) => (
                                            <span key={i} className="px-4 py-2 bg-orange-50 text-orange-700 rounded-full text-xs font-black flex items-center border border-orange-100">
                                                {w}
                                                <button onClick={() => handleRemoveWorkshop(i)} className="ml-2 hover:text-red-500">×</button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Auth & Logos */}
                    {step === 4 && (
                        <div className="animate-in fade-in slide-in-from-right duration-500">
                            <SectionHeader
                                title="Representación y Autorización"
                                description="Datos de dirección y personalización de boletas oficiales."
                                icon={ShieldCheck}
                                color="indigo"
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <InputField
                                    label="Nombre del Director(a)"
                                    value={formData.director_name}
                                    onChange={v => setFormData({ ...formData, director_name: v })}
                                    placeholder="Ej: Profr. Juan Pérez López"
                                />
                                <InputField
                                    label="CURP del Director"
                                    value={formData.director_curp}
                                    onChange={v => setFormData({ ...formData, director_curp: v })}
                                    placeholder="XXXX000000XXXXXX00"
                                />
                                <div className="md:col-span-2">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1 mb-4 block">Identidad Visual y Sellos</label>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <LogoUpload
                                            label="Logotipo del Plantel"
                                            hint="Formato PNG, sugerido 500x500"
                                            url={formData.logo_url}
                                            onUpload={u => setFormData({ ...formData, logo_url: u })}
                                        />
                                        <LogoUpload
                                            label="Logo Institucional (SEP)"
                                            hint="Imagen oficial del gobierno"
                                            url={formData.header_logo_url}
                                            onUpload={u => setFormData({ ...formData, header_logo_url: u })}
                                        />
                                        <LogoUpload
                                            label="Sello Digital Educativo"
                                            hint="Para validación de boletas"
                                            url={formData.digital_seal_url}
                                            onUpload={u => setFormData({ ...formData, digital_seal_url: u })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Navigation */}
                    <div className="mt-16 flex justify-between items-center bg-slate-50/80 -mx-12 -mb-12 p-8 border-t border-slate-100">
                        <button
                            onClick={() => setStep(step - 1)}
                            disabled={step === 0}
                            className={`flex items-center font-black text-sm uppercase tracking-widest px-8 py-4 rounded-2xl transition-all ${step === 0 ? 'opacity-0' : 'text-slate-400 hover:text-slate-600 hover:bg-white'}`}
                        >
                            <ArrowLeft className="w-5 h-5 mr-3" /> Atrás
                        </button>
                        <button
                            onClick={handleSaveStep}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-black text-sm uppercase tracking-widest px-12 py-5 rounded-[2rem] shadow-2xl shadow-blue-200 transition-all active:scale-95 flex items-center"
                        >
                            {step === steps.length - 1 ? '🎉 Finalizar Registro' : 'Siguiente Paso'}
                            <ArrowRight className="w-5 h-5 ml-3" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// --- HELPER COMPONENTS ---

interface SectionHeaderProps {
    title: string;
    description: string;
    icon: React.ElementType;
    color: 'blue' | 'emerald' | 'purple' | 'orange' | 'indigo';
}

const SectionHeader = ({ title, description, icon: Icon, color }: SectionHeaderProps) => {
    const colorClasses: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        purple: 'bg-purple-50 text-purple-600 border-purple-100',
        orange: 'bg-orange-50 text-orange-600 border-orange-100',
        indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100'
    }

    return (
        <div className="mb-10 flex items-start space-x-6">
            <div className={`p-5 rounded-[1.75rem] border-2 ${colorClasses[color]}`}>
                <Icon className="w-10 h-10" />
            </div>
            <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h3>
                <p className="text-slate-500 font-medium max-w-md">{description}</p>
            </div>
        </div>
    )
}

interface InputFieldProps {
    label: string;
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    type?: string;
}

const InputField = ({ label, value, onChange, placeholder, type = "text" }: InputFieldProps) => (
    <div className="space-y-2 group">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 group-focus-within:text-blue-500 transition-colors">{label}</label>
        <input
            type={type}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 focus:bg-white focus:outline-none font-bold text-slate-700 transition-all bg-slate-50/30 placeholder:text-slate-300"
        />
    </div>
)

interface SelectFieldProps {
    label: string;
    value: string;
    onChange: (val: string) => void;
    options: Array<{ label: string, value: string }>;
}

const SelectField = ({ label, value, onChange, options }: SelectFieldProps) => (
    <div className="space-y-2 group">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 group-focus-within:text-blue-500 transition-colors">{label}</label>
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 focus:bg-white focus:outline-none font-bold text-slate-700 transition-all bg-slate-50/30 appearance-none"
        >
            {options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
            ))}
        </select>
    </div>
)

interface LogoUploadProps {
    label: string;
    hint: string;
    url: string;
    onUpload: (url: string) => void;
}

const LogoUpload = ({ label, hint, url, onUpload }: LogoUploadProps) => {
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // In a real app, upload to Supabase Storage here
        // For now, simulate with a data URL or just show placeholder action
        const reader = new FileReader()
        reader.onload = (event) => {
            onUpload(event.target?.result as string)
        }
        reader.readAsDataURL(file)
    }

    return (
        <div className="p-6 bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-3xl group hover:border-blue-400 hover:bg-blue-50/30 transition-all text-center">
            {url ? (
                <div className="relative inline-block">
                    <img src={url} alt="Logo preview" className="h-24 mx-auto mb-4 rounded-xl shadow-md border-2 border-white" />
                    <button
                        onClick={() => onUpload('')}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow-lg"
                    >
                        <Check className="w-4 h-4" />
                    </button>
                </div>
            ) : (
                <div className="p-4 bg-white rounded-2xl shadow-sm inline-block mb-4">
                    <Upload className="w-8 h-8 text-slate-300 group-hover:text-blue-500 transition-colors" />
                </div>
            )}
            <h5 className="text-xs font-black text-slate-800 uppercase tracking-tight">{label}</h5>
            <p className="text-[10px] text-slate-400 font-bold mb-4">{hint}</p>
            <input
                type="file"
                id={`upload-${label}`}
                className="hidden"
                onChange={handleFileChange}
                accept="image/*"
            />
            <label
                htmlFor={`upload-${label}`}
                className="inline-block px-4 py-2 bg-white border border-slate-200 rounded-full text-[10px] font-black uppercase text-slate-500 hover:border-blue-400 hover:text-blue-600 cursor-pointer shadow-sm transition-all active:scale-95"
            >
                Seleccionar Imagen
            </label>
        </div>
    )
}
