import { useState, useEffect } from 'react'
import {
    User,
    Globe,
    Calendar,
    Venus,
    Mars,
    Heart,
    Fingerprint,
    FileText,
    Home,
    Phone,
    Camera,
    Check,
    ArrowRight,
    Loader2,
    X
} from 'lucide-react'
import { useProfile } from '../../../hooks/useProfile'

const AVATARS = [
    { id: 'av1', color: 'bg-blue-500', icon: User },
    { id: 'av2', color: 'bg-purple-500', icon: User },
    { id: 'av3', color: 'bg-emerald-500', icon: User },
    { id: 'av4', color: 'bg-orange-500', icon: User },
    { id: 'av5', color: 'bg-pink-500', icon: User },
    { id: 'av6', color: 'bg-indigo-500', icon: User },
]

export const ProfileSetupWizard = ({ onComplete }: { onComplete: () => void }) => {
    const { profile, updateProfile, isUpdating } = useProfile()
    const [step, setStep] = useState(0)
    const [formData, setFormData] = useState({
        first_name: '',
        last_name_paternal: '',
        last_name_maternal: '',
        nationality: 'MEXICANA',
        birth_date: '',
        sex: '' as 'HOMBRE' | 'MUJER' | 'OTRO',
        marital_status: '',
        curp: '',
        rfc: '',
        address_particular: '',
        phone_contact: '',
        avatar_url: ''
    })

    useEffect(() => {
        if (profile) {
            setFormData(prev => ({
                ...prev,
                first_name: profile.first_name || '',
                last_name_paternal: profile.last_name_paternal || '',
                last_name_maternal: profile.last_name_maternal || '',
                full_name: profile.full_name || ''
            }))
        }
    }, [profile])

    const handleNext = () => setStep(s => s + 1)
    const handleBack = () => setStep(s => s - 1)

    const handleFinish = async () => {
        try {
            await updateProfile({
                ...formData,
                profile_setup_completed: true,
                full_name: `${formData.first_name} ${formData.last_name_paternal} ${formData.last_name_maternal}`.trim()
            })
            onComplete()
        } catch (error) {
            console.error('Error finishing profile setup:', error)
        }
    }

    const isStepValid = () => {
        if (step === 0) return formData.first_name && formData.last_name_paternal && formData.nationality && formData.birth_date && formData.sex
        if (step === 1) return formData.curp.length === 18 && formData.rfc
        if (step === 2) return formData.address_particular && formData.phone_contact
        return true
    }

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
                {/* Progress Header */}
                <div className="bg-slate-50 px-8 py-6 flex items-center justify-between border-b border-slate-100">
                    <div className="flex gap-2">
                        {[0, 1, 2, 3].map(s => (
                            <div key={s} className={`h-1.5 rounded-full transition-all duration-500 ${s === step ? 'w-8 bg-blue-600' : s < step ? 'w-4 bg-blue-200' : 'w-4 bg-slate-200'}`} />
                        ))}
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Paso {step + 1} de 4
                    </span>
                </div>

                <div className="p-10">
                    {step === 0 && (
                        <div className="space-y-8 animate-in slide-in-from-right duration-500">
                            <div>
                                <h2 className="text-3xl font-black text-slate-800 tracking-tight">Datos Personales</h2>
                                <p className="text-slate-400 font-medium">Comencemos con tu información básica.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nombre(s)</label>
                                    <input
                                        value={formData.first_name}
                                        onChange={e => setFormData({ ...formData, first_name: e.target.value.toUpperCase() })}
                                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-100 transition-all font-bold text-slate-700"
                                        placeholder="EJ. JUAN"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Apellido Paterno</label>
                                    <input
                                        value={formData.last_name_paternal}
                                        onChange={e => setFormData({ ...formData, last_name_paternal: e.target.value.toUpperCase() })}
                                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-100 transition-all font-bold text-slate-700"
                                        placeholder="EJ. PÉREZ"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Apellido Materno</label>
                                    <input
                                        value={formData.last_name_maternal}
                                        onChange={e => setFormData({ ...formData, last_name_maternal: e.target.value.toUpperCase() })}
                                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-100 transition-all font-bold text-slate-700"
                                        placeholder="EJ. GARCÍA"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nacionalidad</label>
                                    <div className="relative">
                                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
                                        <input
                                            value={formData.nationality}
                                            onChange={e => setFormData({ ...formData, nationality: e.target.value.toUpperCase() })}
                                            className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-100 transition-all font-bold text-slate-700"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Fecha de Nacimiento</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
                                        <input
                                            type="date"
                                            value={formData.birth_date}
                                            onChange={e => setFormData({ ...formData, birth_date: e.target.value })}
                                            className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-100 transition-all font-bold text-slate-700"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Sexo</label>
                                    <div className="flex gap-2">
                                        {[
                                            { id: 'HOMBRE', icon: Mars, label: 'Hombre' },
                                            { id: 'MUJER', icon: Venus, label: 'Mujer' },
                                            { id: 'OTRO', icon: Heart, label: 'Otro' }
                                        ].map(s => (
                                            <button
                                                key={s.id}
                                                onClick={() => setFormData({ ...formData, sex: s.id as any })}
                                                className={`flex-1 py-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 ${formData.sex === s.id ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-lg shadow-blue-100' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
                                            >
                                                <s.icon className="w-5 h-5" />
                                                <span className="text-[10px] font-black uppercase">{s.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Estado Civil</label>
                                    <input
                                        value={formData.marital_status}
                                        onChange={e => setFormData({ ...formData, marital_status: e.target.value.toUpperCase() })}
                                        className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-100 transition-all font-bold text-slate-700"
                                        placeholder="EJ. SOLTERO(A)"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 1 && (
                        <div className="space-y-8 animate-in slide-in-from-right duration-500">
                            <div>
                                <h2 className="text-3xl font-black text-slate-800 tracking-tight">Identificación</h2>
                                <p className="text-slate-400 font-medium">Documentos oficiales para tu registro.</p>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">CURP</label>
                                    <div className="relative">
                                        <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                        <input
                                            value={formData.curp}
                                            onChange={e => setFormData({ ...formData, curp: e.target.value.toUpperCase() })}
                                            maxLength={18}
                                            className="w-full pl-12 pr-5 py-5 bg-slate-50 border-none rounded-[1.5rem] focus:ring-4 focus:ring-blue-100 transition-all font-black text-slate-700 tracking-widest"
                                            placeholder="XXXX000000XXXXXX00"
                                        />
                                    </div>
                                    <div className="flex justify-between px-1">
                                        <p className="text-[9px] font-bold text-slate-400">18 caracteres mínimos</p>
                                        <p className={`${formData.curp.length === 18 ? 'text-emerald-500' : formData.curp.length > 0 ? 'text-red-500' : 'text-slate-300'} text-[9px] font-black uppercase`}>
                                            {formData.curp.length}/18
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">RFC</label>
                                    <div className="relative">
                                        <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                        <input
                                            value={formData.rfc}
                                            onChange={e => setFormData({ ...formData, rfc: e.target.value.toUpperCase() })}
                                            className="w-full pl-12 pr-5 py-5 bg-slate-50 border-none rounded-[1.5rem] focus:ring-4 focus:ring-blue-100 transition-all font-black text-slate-700 tracking-widest"
                                            placeholder="XXXX000000XXX"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-8 animate-in slide-in-from-right duration-500">
                            <div>
                                <h2 className="text-3xl font-black text-slate-800 tracking-tight">Contacto</h2>
                                <p className="text-slate-400 font-medium">¿Dónde podemos localizarte?</p>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Domicilio Particular</label>
                                    <div className="relative">
                                        <Home className="absolute left-4 top-4 text-slate-400 w-5 h-5 pointer-events-none" />
                                        <textarea
                                            value={formData.address_particular}
                                            onChange={e => setFormData({ ...formData, address_particular: e.target.value.toUpperCase() })}
                                            rows={3}
                                            className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-[1.5rem] focus:ring-4 focus:ring-blue-100 transition-all font-bold text-slate-700 resize-none"
                                            placeholder="CALLE, NÚMERO, COLONIA, C.P., MUNICIPIO..."
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Teléfono de Contacto</label>
                                    <div className="relative">
                                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
                                        <input
                                            type="tel"
                                            value={formData.phone_contact}
                                            onChange={e => setFormData({ ...formData, phone_contact: e.target.value })}
                                            className="w-full pl-12 pr-5 py-5 bg-slate-50 border-none rounded-[1.5rem] focus:ring-4 focus:ring-blue-100 transition-all font-black text-slate-700"
                                            placeholder="55 0000 0000"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-8 animate-in slide-in-from-right duration-500">
                            <div className="text-center">
                                <h2 className="text-3xl font-black text-slate-800 tracking-tight">Identidad Visual</h2>
                                <p className="text-slate-400 font-medium">Elige cómo te verán tus colegas.</p>
                            </div>

                            <div className="flex justify-center mb-8">
                                <div className={`w-32 h-32 rounded-[2.5rem] flex items-center justify-center p-8 transition-all duration-500 shadow-xl ${formData.avatar_url ? AVATARS.find(a => a.id === formData.avatar_url)?.color : 'bg-slate-100 text-slate-300'}`}>
                                    {formData.avatar_url ? (
                                        <User className="w-16 h-16 text-white" />
                                    ) : (
                                        <Camera className="w-16 h-16" />
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                                {AVATARS.map(av => (
                                    <button
                                        key={av.id}
                                        onClick={() => setFormData({ ...formData, avatar_url: av.id })}
                                        className={`h-16 rounded-2xl flex items-center justify-center transition-all ${av.color} ${formData.avatar_url === av.id ? 'ring-4 ring-blue-100 scale-110 shadow-lg' : 'opacity-60 hover:opacity-100'}`}
                                    >
                                        <User className="w-6 h-6 text-white" />
                                        {formData.avatar_url === av.id && (
                                            <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
                                                <Check className="w-3 h-3 text-blue-600 font-black" />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>

                            <div className="bg-blue-50/50 p-6 rounded-[2rem] border border-blue-100 text-center">
                                <p className="text-xs font-bold text-blue-700 italic">
                                    "Esta información es vital para tu expediente institucional y la generación de documentos oficiales."
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div className="mt-12 flex gap-4">
                        {step > 0 && (
                            <button
                                onClick={handleBack}
                                className="flex-1 py-5 bg-slate-100 text-slate-500 font-black rounded-3xl hover:bg-slate-200 transition-all uppercase tracking-[0.1em] text-xs"
                            >
                                Atrás
                            </button>
                        )}
                        <button
                            onClick={step === 3 ? handleFinish : handleNext}
                            disabled={!isStepValid() || isUpdating}
                            className={`flex-[2] py-5 bg-slate-900 text-white font-black rounded-3xl transition-all uppercase tracking-[0.2em] text-sm flex items-center justify-center gap-3 shadow-xl shadow-slate-200 ${!isStepValid() ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-95'}`}
                        >
                            {isUpdating ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : step === 3 ? (
                                <>¡Listo! Finalizar <Check className="w-5 h-5" /></>
                            ) : (
                                <>Continuar <ArrowRight className="w-5 h-5" /></>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
