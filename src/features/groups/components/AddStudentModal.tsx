import { useState, useRef, useCallback, useEffect } from 'react'
import Webcam from 'react-webcam'
import { Camera, X, User, Phone, Mail, MapPin, Briefcase, HeartPulse, AlertCircle, FileText, Zap } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useSubscriptionLimits } from '../../../hooks/useSubscriptionLimits'
import { UpgradeModal } from '../../../components/UpgradeModal'

type Guardian = {
    firstName: string
    lastNamePaternal: string
    lastNameMaternal: string
    relationship: string
    relationshipDetails?: string
    email: string
    phone: string
    occupation: string
    address: string
}

type StudentForm = {
    // Required
    firstName: string
    lastNamePaternal: string
    lastNameMaternal: string
    gender: 'HOMBRE' | 'MUJER'
    // Optional
    curp: string
    email: string
    phone: string
    bloodType: string
    allergies: string
    condition: string
    conditionDetails: string // For "OTRO"
    photoUrl: string | null
}

const CONDITIONS_LIST = [
    "Ninguna",
    "Trastorno del Espectro Autista (TEA)",
    "Trastorno por Déficit de Atención con Hiperactividad (TDAH)",
    "Discapacidad Intelectual",
    "Dislexia (Lectura)",
    "Discalculia (Matemáticas)",
    "Disgrafía (Escritura)",
    "Discapacidad Visual",
    "Discapacidad Auditiva",
    "Discapacidad Motriz",
    "Trastornos del Lenguaje",
    "Aptitudes Sobresalientes",
    "Trastornos de Ansiedad y Depresión",
    "Trastornos de la Conducta",
    "Discapacidad Múltiple",
    "OTRO"
]

const RELATIONSHIPS = ['PADRE', 'MADRE', 'HERMANO(A)', 'ABUELO(A)', 'TIO(A)', 'TUTOR LEGAL', 'OTRO']

interface Props {
    isOpen: boolean
    onClose: () => void
    groupId: string
    tenantId: string
    onSuccess: () => void
    studentId?: string | null
}

export const AddStudentModal = ({ isOpen, onClose, groupId, tenantId, onSuccess, studentId }: Props) => {
    const [step, setStep] = useState(() => {
        const savedStep = sessionStorage.getItem('vunlek_temp_student_step')
        return savedStep ? parseInt(savedStep, 10) : 1
    })
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(false)
    const [invitingTutor, setInvitingTutor] = useState(false)
    const [invitationSent, setInvitationSent] = useState(false)
    const [invitedProfileId, setInvitedProfileId] = useState<string | null>(null)
    const [existingProfile, setExistingProfile] = useState<{ id: string, first_name: string, last_name_paternal: string } | null>(null)
    const [searchingProfile, setSearchingProfile] = useState(false)
    const [showUpgradeModal, setShowUpgradeModal] = useState(false)
    const [currentStudentCount, setCurrentStudentCount] = useState(0)
    const limits = useSubscriptionLimits()

    // Form States
    const [student, setStudent] = useState<StudentForm>({
        firstName: '', lastNamePaternal: '', lastNameMaternal: '', gender: 'HOMBRE',
        curp: '', email: '', phone: '', bloodType: '', allergies: '', condition: 'Ninguna', conditionDetails: '',
        photoUrl: null
    })

    const [guardian, setGuardian] = useState<Guardian>({
        firstName: '', lastNamePaternal: '', lastNameMaternal: '',
        relationship: 'MADRE', relationshipDetails: '', email: '', phone: '', occupation: '', address: ''
    })

    // Webcam
    const webcamRef = useRef<Webcam>(null)
    const [imgSrc, setImgSrc] = useState<string | null>(null)
    const [showCamera, setShowCamera] = useState(false)

    // Use a ref to track if the modal was previously open
    const prevOpenRef = useRef(false)

    // Check for existing profile when email changes
    useEffect(() => {
        const checkExistingEmail = async () => {
            if (guardian.email && guardian.email.includes('@') && guardian.email.length > 5) {
                setSearchingProfile(true)
                try {
                    const { data, error } = await supabase
                        .from('profiles')
                        .select('id, first_name, last_name_paternal')
                        .eq('role', 'TUTOR')
                        .ilike('email', guardian.email)
                        .maybeSingle()

                    if (data) {
                        setExistingProfile(data)
                        setInvitedProfileId(data.id)
                        // Pre-fill names if they are empty
                        setGuardian(prev => ({
                            ...prev,
                            firstName: prev.firstName || data.first_name || '',
                            lastNamePaternal: prev.lastNamePaternal || data.last_name_paternal || ''
                        }))
                    } else {
                        setExistingProfile(null)
                    }
                } catch (err) {
                    console.error('Error searching profile:', err)
                } finally {
                    setSearchingProfile(false)
                }
            } else {
                setExistingProfile(null)
            }
        }

        const timer = setTimeout(checkExistingEmail, 500)
        return () => clearTimeout(timer)
    }, [guardian.email])

    useEffect(() => {
        const wasJustOpened = isOpen && !prevOpenRef.current
        prevOpenRef.current = isOpen

        if (isOpen && studentId) {
            setFetching(true)
            const fetchData = async () => {
                try {
                    // 1. Fetch Student
                    const { data: sData, error: sError } = await supabase
                        .from('students')
                        .select('*')
                        .eq('id', studentId)
                        .single()
                    if (sError) throw sError

                    // 2. Fetch Guardian
                    const { data: gData, error: gError } = await supabase
                        .from('guardians')
                        .select('*')
                        .eq('student_id', studentId)
                        .maybeSingle() // Use maybeSingle as guardian might not exist

                    if (gError && gError.code !== 'PGRST116') throw gError

                    // 3. Populate State
                    setStudent({
                        firstName: sData.first_name || '',
                        lastNamePaternal: sData.last_name_paternal || '',
                        lastNameMaternal: sData.last_name_maternal || '',
                        gender: (sData.gender as 'HOMBRE' | 'MUJER') || 'HOMBRE',
                        curp: sData.curp || '',
                        email: sData.email || '',
                        phone: sData.phone || '',
                        bloodType: sData.blood_type || '',
                        allergies: sData.allergies || '',
                        condition: sData.condition === 'OTRO' ? 'OTRO' : (sData.condition || 'Ninguna'),
                        conditionDetails: sData.condition === 'OTRO' ? sData.condition_details || '' : '',
                        photoUrl: sData.photo_url || null
                    })

                    setImgSrc(sData.photo_url || null)

                    if (gData) {
                        setGuardian({
                            firstName: gData.first_name || '',
                            lastNamePaternal: gData.last_name_paternal || '',
                            lastNameMaternal: gData.last_name_maternal || '',
                            relationship: gData.relationship === 'OTRO' ? 'OTRO' : (gData.relationship || 'MADRE'),
                            relationshipDetails: gData.relationship === 'OTRO' ? (gData.relationship_details || '') : '',
                            email: gData.email || '',
                            phone: gData.phone || '',
                            occupation: gData.occupation || '',
                            address: gData.address || '',
                            id: gData.id // Store guardian ID for invitation
                        } as any)
                        if (gData.profile_id) {
                            setInvitationSent(true)
                        }
                    }
                } catch (err: any) {
                    console.error('Error fetching student:', err)
                    alert('Error al cargar datos del alumno')
                    onClose()
                } finally {
                    setFetching(false)
                }
            }
            fetchData()
        } else if (wasJustOpened && !studentId) {
            // Check for persisted data
            const savedStudent = sessionStorage.getItem('vunlek_temp_student')
            const savedGuardian = sessionStorage.getItem('vunlek_temp_guardian')
            const savedStep = sessionStorage.getItem('vunlek_temp_student_step')

            // Restore data for create mode ONLY when just opened
            if (savedStep) setStep(parseInt(savedStep, 10))
            if (savedStudent) setStudent(JSON.parse(savedStudent))
            if (savedGuardian) setGuardian(JSON.parse(savedGuardian))

            setImgSrc(null)
            setInvitationSent(false)
            setInvitedProfileId(null)
        }
    }, [isOpen, studentId])

    useEffect(() => {
        if (!studentId && step > 1) {
            sessionStorage.setItem('vunlek_temp_student_step', step.toString())
        }
    }, [step, studentId])

    // Fetch current student count for this group
    useEffect(() => {
        if (isOpen && groupId && !studentId) {
            const fetchStudentCount = async () => {
                const { count } = await supabase
                    .from('students')
                    .select('*', { count: 'exact', head: true })
                    .eq('group_id', groupId)
                if (count !== null) setCurrentStudentCount(count)
            }
            fetchStudentCount()
        }
    }, [isOpen, groupId, studentId])

    const capture = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot()
        if (imageSrc) {
            setImgSrc(imageSrc)
            setStudent(prev => ({ ...prev, photoUrl: imageSrc })) // Store base64 mostly for preview/upload
            setShowCamera(false)
        }
    }, [webcamRef])

    const handleStudentChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        // Enforce UPPERCASE for text fields, except for email and photoUrl
        const uppercased = ['email', 'photoUrl'].includes(name) ? value : value.toUpperCase()
        setStudent(prev => {
            const newState = { ...prev, [name]: uppercased }
            if (!studentId) sessionStorage.setItem('vunlek_temp_student', JSON.stringify(newState))
            return newState
        })
    }

    const handleGuardianChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        const uppercased = ['email'].includes(name) ? value : value.toUpperCase()
        setGuardian(prev => {
            const newState = { ...prev, [name]: uppercased }
            if (!studentId) sessionStorage.setItem('vunlek_temp_guardian', JSON.stringify(newState))
            return newState
        })
        // Reset invitation state if email changes
        if (name === 'email') {
            setInvitationSent(false)
            setExistingProfile(null)
            setInvitedProfileId(null)
        }
    }

    const handleInviteTutor = async () => {
        if (!guardian.email) {
            alert('Se requiere un correo electrónico para enviar el acceso.')
            return
        }
        if (!guardian.firstName || !guardian.lastNamePaternal) {
            alert('Nombre y Apellido Paterno del tutor son obligatorios.')
            return
        }

        setInvitingTutor(true)
        try {
            const { data, error } = await supabase.functions.invoke('invite-tutor', {
                body: {
                    email: guardian.email,
                    firstName: guardian.firstName,
                    lastNamePaternal: guardian.lastNamePaternal,
                    studentName: `${student.firstName} ${student.lastNamePaternal}`,
                    tenantId: tenantId,
                    guardianId: (guardian as any).id // Pass existing guardian ID if available
                }
            })

            if (error) throw error
            setInvitedProfileId(data.userId)
            setInvitationSent(true)

            let msg = '¡Acceso enviado correctamente!'
            if (data.tempPassword) {
                msg += `\n\nContraseña temporal generada: ${data.tempPassword}\n\nSe ha enviado un correo con las instrucciones.`
            } else {
                msg += `\n\nEl usuario ya existe, se ha vinculado correctamente.`
            }
            alert(msg)
        } catch (err: any) {
            console.error('Error inviting tutor:', err)
            alert('Error al enviar acceso: ' + (err.message || 'Error desconocido'))
        } finally {
            setInvitingTutor(false)
        }
    }

    const handleSubmit = async () => {
        if (!student.firstName || !student.lastNamePaternal || !student.lastNameMaternal) {
            alert('Nombre y Apellidos del alumno son obligatorios')
            return
        }

        // Check student limit only when creating new student (not editing)
        if (!studentId && currentStudentCount >= limits.maxStudentsPerGroup) {
            setShowUpgradeModal(true)
            return
        }

        setLoading(true)
        try {
            // 1. Insert or Update Student
            let studentRes;
            const studentPayload = {
                tenant_id: tenantId, // Should verify tenant matches if editing
                group_id: groupId,
                first_name: student.firstName,
                last_name_paternal: student.lastNamePaternal,
                last_name_maternal: student.lastNameMaternal,
                gender: student.gender,
                curp: student.curp || null,
                email: student.email || null,
                phone: student.phone || null,
                blood_type: student.bloodType || null,
                allergies: student.allergies || null,
                condition: student.condition,
                condition_details: student.condition === 'OTRO' ? student.conditionDetails : null,
                photo_url: student.photoUrl || null
            };

            if (studentId) {
                // UPDATE
                studentRes = await supabase
                    .from('students')
                    .update(studentPayload)
                    .eq('id', studentId)
                    .select()
                    .single()
            } else {
                // INSERT
                studentRes = await supabase
                    .from('students')
                    .insert(studentPayload)
                    .select()
                    .single()
            }

            const { data: studentData, error: studentError } = studentRes;
            if (studentError) throw studentError

            // 2. Insert or Update Guardian (if basic info provided)
            if (guardian.firstName && guardian.lastNamePaternal) {
                // Check if guardian already exists for this student
                // For simplicity in MVP, we might delete existing and re-insert, or try to find by student_id

                // Better approach: UPSERT based on student_id? 
                // Guardians table PK is ID, but we want unique per student?
                // Let's just find existing guardian ID first.

                const { data: existingGuardian } = await supabase.from('guardians').select('id').eq('student_id', studentData.id).maybeSingle();

                const guardianPayload = {
                    student_id: studentData.id,
                    tenant_id: tenantId,
                    first_name: guardian.firstName,
                    last_name_paternal: guardian.lastNamePaternal,
                    last_name_maternal: guardian.lastNameMaternal || null,
                    relationship: guardian.relationship,
                    email: guardian.email || null,
                    phone: guardian.phone || null,
                    occupation: guardian.occupation || null,
                    address: guardian.address || null,
                    profile_id: invitedProfileId // Link the profile created via manual invitation
                };

                let guardianId;
                if (existingGuardian) {
                    const { data: gData, error: gErr } = await supabase.from('guardians').update(guardianPayload).eq('id', existingGuardian.id).select().single();
                    if (gErr) throw gErr;
                    guardianId = gData.id;
                } else {
                    const { data: gData, error: gErr } = await supabase.from('guardians').insert(guardianPayload).select().single();
                    if (gErr) throw gErr;
                    guardianId = gData.id;
                }

                // If an invitation was sent and a profile_id exists, ensure invitationSent is true
                if (invitedProfileId) {
                    setInvitationSent(true);
                }
                // (Invitation is now handled manually via the button "Enviar Acceso")
            }

            // Clear temporary storage
            sessionStorage.removeItem('vunlek_temp_student')
            sessionStorage.removeItem('vunlek_temp_guardian')
            sessionStorage.removeItem('vunlek_temp_student_step')

            onSuccess()
            onClose()
        } catch (error: any) {
            console.error(error)
            alert('Error al guardar alumno: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <div className="squishy-card max-w-3xl w-full flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b">
                    <h2 className="text-xl font-bold text-gray-900">{studentId ? 'Editar Alumno' : 'Registrar Nuevo Alumno'}</h2>
                    <button onClick={onClose}><X className="h-6 w-6 text-gray-400" /></button>
                </div>

                {/* Tabs / Steps */}
                {/* Tabs / Steps */}
                {/* Tabs / Steps */}
                <div className="flex bg-slate-50 border-b border-slate-100 p-2 gap-2">
                    {[
                        { id: 1, label: 'Alumno', icon: <User className="w-4 h-4" /> },
                        { id: 2, label: 'Tutor', icon: <Briefcase className="w-4 h-4" /> },
                        { id: 3, label: 'Biometría', icon: <Camera className="w-4 h-4" /> }
                    ].map(s => (
                        <button
                            key={s.id}
                            onClick={() => setStep(s.id)}
                            className={`flex-1 py-3 px-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-1.5 ${step === s.id
                                ? 'bg-white text-indigo-600 shadow-[0_8px_20px_-4px_rgba(79,70,229,0.2)] scale-[1.02] border-b-4 border-indigo-200'
                                : 'text-slate-400 hover:bg-white/50'
                                }`}
                        >
                            <div className={`p-2 rounded-xl ${step === s.id ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                                {s.icon}
                            </div>
                            {s.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {step === 1 && (
                        <div className="space-y-8">
                            <div>
                                <h3 className="section-title"><User className="text-blue-600" /> Información Personal</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="input-group">
                                        <label className="label-std">Nombre(s) *</label>
                                        <input name="firstName" value={student.firstName} onChange={handleStudentChange} className="input-std" placeholder="Ej. JUAN PABLO" />
                                    </div>
                                    <div className="input-group">
                                        <label className="label-std">Apellido Paterno *</label>
                                        <input name="lastNamePaternal" value={student.lastNamePaternal} onChange={handleStudentChange} className="input-std" placeholder="Ej. PÉREZ" />
                                    </div>
                                    <div className="input-group">
                                        <label className="label-std">Apellido Materno *</label>
                                        <input name="lastNameMaternal" value={student.lastNameMaternal} onChange={handleStudentChange} className="input-std" placeholder="Ej. LÓPEZ" />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="label-std">Sexo *</label>
                                    <select name="gender" value={student.gender} onChange={handleStudentChange} className="input-std cursor-pointer">
                                        <option value="HOMBRE">HOMBRE</option>
                                        <option value="MUJER">MUJER</option>
                                    </select>
                                </div>
                                <div className="input-group">
                                    <label className="label-std">CURP</label>
                                    <FileText className="input-icon" />
                                    <input name="curp" value={student.curp} onChange={handleStudentChange} className="input-std input-with-icon" placeholder="Clave Única de Registro" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="input-group">
                                    <label className="label-std">Teléfono (Opcional)</label>
                                    <Phone className="input-icon" />
                                    <input name="phone" value={student.phone} onChange={handleStudentChange} className="input-std input-with-icon" placeholder="10 dígitos" />
                                </div>
                                <div className="input-group">
                                    <label className="label-std">Correo Electrónico (Opcional)</label>
                                    <Mail className="input-icon" />
                                    <input type="email" name="email" value={student.email} onChange={handleStudentChange} className="input-std input-with-icon" placeholder="correo@ejemplo.com" />
                                </div>
                            </div>

                            {/* Medical / Conditions */}
                            <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100 mt-8">
                                <h4 className="font-bold text-blue-800 mb-6 flex items-center text-lg">
                                    <HeartPulse className="mr-2 h-6 w-6" /> Información Médica y Adicional
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                    <div>
                                        <label className="label-std text-blue-900">Tipo de Sangre</label>
                                        <select name="bloodType" value={student.bloodType} onChange={handleStudentChange} className="input-std">
                                            <option value="">Seleccionar...</option>
                                            <option value="A+">A+</option>
                                            <option value="A-">A-</option>
                                            <option value="B+">B+</option>
                                            <option value="B-">B-</option>
                                            <option value="AB+">AB+</option>
                                            <option value="AB-">AB-</option>
                                            <option value="O+">O+</option>
                                            <option value="O-">O-</option>
                                        </select>
                                    </div>
                                    <div className="input-group">
                                        <label className="label-std text-blue-900">Alergias</label>
                                        <AlertCircle className="input-icon text-blue-400" />
                                        <input name="allergies" value={student.allergies} onChange={handleStudentChange} className="input-std input-with-icon border-blue-200 focus:ring-blue-500" placeholder="Ej. Penicilina (Opcional)" />
                                    </div>
                                </div>
                                <div>
                                    <label className="label-std text-blue-900">Condición / Discapacidad</label>
                                    <select name="condition" value={student.condition} onChange={handleStudentChange} className="input-std">
                                        {CONDITIONS_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                {student.condition === 'OTRO' && (
                                    <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                                        <label className="label-std text-blue-900">Especifique la condición</label>
                                        <input name="conditionDetails" value={student.conditionDetails} onChange={handleStudentChange} className="input-std border-blue-300" placeholder="Describa la condición..." autoFocus />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-8">
                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-amber-900 flex items-start shadow-sm">
                                <AlertCircle className="h-6 w-6 text-amber-600 mr-3 flex-shrink-0" />
                                <div>
                                    <p className="font-bold mb-1">Contacto de Emergencia</p>
                                    <p className="text-sm opacity-90">Estos datos son cruciales para contactar al tutor en caso de emergencia.</p>
                                </div>
                            </div>

                            <div>
                                <h3 className="section-title"><User className="text-gray-600" /> Datos del Tutor</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="input-group">
                                        <label className="label-std">Nombre(s) *</label>
                                        <input name="firstName" value={guardian.firstName} onChange={handleGuardianChange} className="input-std" placeholder="Nombres" />
                                    </div>
                                    <div className="input-group">
                                        <label className="label-std">Apellido Paterno *</label>
                                        <input name="lastNamePaternal" value={guardian.lastNamePaternal} onChange={handleGuardianChange} className="input-std" placeholder="Apellido P." />
                                    </div>
                                    <div className="input-group">
                                        <label className="label-std">Apellido Materno *</label>
                                        <input name="lastNameMaternal" value={guardian.lastNameMaternal} onChange={handleGuardianChange} className="input-std" placeholder="Apellido M." />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="label-std">Parentesco *</label>
                                    <select name="relationship" value={guardian.relationship} onChange={handleGuardianChange} className="input-std">
                                        {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                                <div className="input-group">
                                    <label className="label-std">Teléfono de Contacto</label>
                                    <Phone className="input-icon" />
                                    <input name="phone" value={guardian.phone} onChange={handleGuardianChange} className="input-std input-with-icon" placeholder="10 dígitos" />
                                </div>
                            </div>
                            <div className="input-group">
                                <label className="label-std">Ocupación</label>
                                <Briefcase className="input-icon" />
                                <input name="occupation" value={guardian.occupation} onChange={handleGuardianChange} className="input-std input-with-icon" placeholder="Ej. Empleado, Comerciante..." />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="input-group">
                                    <label className="label-std text-indigo-700">Correo Electrónico (Acceso)</label>
                                    <Mail className="input-icon text-indigo-400" />
                                    <input type="email" name="email" value={guardian.email} onChange={handleGuardianChange} className="input-std input-with-icon border-indigo-200 focus:ring-indigo-500" placeholder="tutor@ejemplo.com" />
                                </div>
                                <div className="flex items-end">
                                    {existingProfile ? (
                                        <div className="w-full p-4 bg-indigo-50 border-2 border-indigo-100 rounded-2xl flex items-center gap-3 animate-in fade-in zoom-in-95 duration-300">
                                            <div className="p-2 bg-indigo-600 rounded-xl">
                                                <User className="w-4 h-4 text-white" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Tutor Reconocido</p>
                                                <p className="text-xs font-bold text-slate-700">Se vinculará a la cuenta existente.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleInviteTutor}
                                            disabled={invitingTutor || !guardian.email || invitationSent || searchingProfile}
                                            className={`w-full py-3 rounded-xl font-bold flex items-center justify-center transition-all ${invitationSent
                                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-default'
                                                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-indigo-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none'
                                                }`}
                                        >
                                            <Zap className={`w-4 h-4 mr-2 ${invitationSent ? 'text-emerald-500' : 'text-indigo-200'}`} />
                                            {invitingTutor ? 'Generando...' : searchingProfile ? 'Verificando...' : invitationSent ? 'Acceso Enviado' : 'Enviar Credenciales'}
                                        </button>
                                    )}
                                </div>
                                <div className="md:col-span-2">
                                    <label className="label-std">Dirección Completa</label>
                                    <MapPin className="input-icon" />
                                    <input name="address" value={guardian.address} onChange={handleGuardianChange} className="input-std input-with-icon" placeholder="Calle, Número, Colonia, CP..." />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6 text-center">
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center min-h-[300px] bg-gray-50">
                                {showCamera ? (
                                    <>
                                        <Webcam
                                            audio={false}
                                            ref={webcamRef}
                                            screenshotFormat="image/jpeg"
                                            className="rounded-lg shadow-lg mb-4 max-h-[300px]"
                                        />
                                        <button onClick={capture} type="button" className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700">
                                            <Camera className="inline w-5 h-5 mr-2" /> Capturar Foto
                                        </button>
                                    </>
                                ) : imgSrc ? (
                                    <>
                                        <img src={imgSrc} alt="Preview" className="rounded-lg shadow-lg mb-4 max-h-[300px]" />
                                        <div className="space-x-4">
                                            <button onClick={() => setImgSrc(null)} type="button" className="px-4 py-2 text-gray-600 hover:text-gray-800">
                                                Eliminar
                                            </button>
                                            <button onClick={() => setShowCamera(true)} type="button" className="px-4 py-2 bg-blue-600 text-white rounded-full">
                                                Retomar
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center">
                                        <Camera className="w-16 h-16 text-gray-300 mx-auto mb-2" />
                                        <p className="text-gray-500 mb-4">No hay foto capturada</p>
                                        <div className="flex space-x-3 justify-center">
                                            <button onClick={() => setShowCamera(true)} type="button" className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700">
                                                Activar Cámara
                                            </button>
                                            <button
                                                onClick={() => setImgSrc(`https://api.dicebear.com/7.x/avataaars/svg?seed=${student.curp || student.firstName}&gender=${student.gender === 'MUJER' ? 'female' : 'male'}`)}
                                                type="button"
                                                className="px-6 py-2 bg-gray-100 text-gray-700 border border-gray-300 rounded-full hover:bg-gray-200"
                                            >
                                                Usar Avatar
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="border p-4 rounded-md bg-gray-50 opacity-50 cursor-not-allowed">
                                <h3 className="font-semibold text-gray-700">Huella Digital (Próximamente)</h3>
                                <p className="text-xs text-gray-500">Se requiere hardware compatible.</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t flex justify-between">
                    <button
                        type="button"
                        onClick={() => setStep(s => Math.max(1, s - 1))}
                        className={`px-6 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors ${step === 1 ? 'invisible' : ''}`}
                    >
                        Anterior
                    </button>

                    {step < 3 ? (
                        <button
                            type="button"
                            onClick={() => setStep(s => Math.min(3, s + 1))}
                            className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-black shadow-lg shadow-indigo-200 btn-tactile uppercase tracking-widest text-xs"
                        >
                            Siguiente
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={loading || fetching}
                            className="px-8 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl hover:shadow-green-200 font-black shadow-lg transition-all disabled:opacity-50 btn-tactile uppercase tracking-widest text-xs"
                        >
                            {loading ? 'Guardando...' : (studentId ? 'Guardar Cambios' : 'Registrar Alumno')}
                        </button>
                    )}
                </div>
            </div>

            <style>{`
                .input-std {
                    @apply mt-1 block w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-slate-900 placeholder-slate-400 transition-all font-bold outline-none;
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
                }
                .input-std:focus {
                    @apply border-indigo-300 ring-4 ring-indigo-50 bg-indigo-50/30;
                    box-shadow: inset 0 2px 4px rgba(79,70,229,0.05);
                }
                .label-std {
                    @apply block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1;
                }
                .section-title {
                    @apply text-lg font-black text-slate-800 border-b-2 border-slate-50 pb-3 mb-6 flex items-center gap-2 uppercase tracking-tight;
                }
                .input-group {
                    @apply relative;
                }
                .input-icon {
                    @apply absolute left-4 top-[36px] text-slate-300 h-5 w-5 pointer-events-none transition-colors;
                }
                .input-std:focus + .input-icon, 
                .input-group:focus-within .input-icon {
                    @apply text-indigo-400;
                }
                .input-with-icon {
                    @apply pl-12;
                }
                .btn-tactile {
                    @apply active:scale-90 transition-all duration-200 relative overflow-hidden;
                }
                .btn-tactile::after {
                    content: '';
                    @apply absolute inset-0 bg-white/20 opacity-0 transition-opacity;
                }
                .btn-tactile:active::after {
                    @apply opacity-100;
                }
                .input-std {
                    @apply mt-1 block w-full px-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-slate-900 placeholder-slate-400 transition-all font-bold outline-none;
                    box-shadow: inset 0 3px 6px rgba(0,0,0,0.03);
                }
                .input-std:focus {
                    @apply border-indigo-300 ring-[6px] ring-indigo-50 bg-white;
                    box-shadow: inset 0 2px 4px rgba(79,70,229,0.08);
                }
                .label-std {
                    @apply block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1;
                }
                .section-title {
                    @apply text-lg font-black text-slate-800 border-b-2 border-slate-50 pb-3 mb-6 flex items-center gap-2 uppercase tracking-tight;
                }
                .input-group {
                    @apply relative;
                }
                .input-icon {
                    @apply absolute left-4 top-[36px] text-slate-300 h-5 w-5 pointer-events-none transition-colors;
                }
                .input-std:focus + .input-icon, 
                .input-group:focus-within .input-icon {
                    @apply text-indigo-400;
                }
                .input-with-icon {
                    @apply pl-12;
                }
                .squishy-card {
                    @apply bg-white rounded-[40px] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] border-b-[8px] border-slate-100;
                }
                .clay-btn {
                    box-shadow: 
                        inset 0 4px 4px rgba(255,255,255,0.4),
                        inset 0 -4px 6px rgba(0,0,0,0.1),
                        0 10px 20px -5px rgba(0,0,0,0.2);
                }
            `}</style>

            <UpgradeModal
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                currentPlan={limits.planType}
                currentGroups={limits.currentGroups}
                maxGroups={limits.maxGroups}
                reason="students"
            />
        </div>
    )
}
