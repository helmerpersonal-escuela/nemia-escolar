import { useState, useRef, useCallback, useEffect } from 'react'
import Webcam from 'react-webcam'
import { Camera, User, UserPlus, Phone, Mail, MapPin, Briefcase, HeartPulse, AlertCircle, FileText, Zap, Check } from 'lucide-react'
import { createPortal } from 'react-dom'
import { WizardFooter, WizardProgress, WizardModalHeader, wizardInput } from '../../../components/wizard/Wizard'
import { supabase } from '../../../lib/supabase'
import { useSubscriptionLimits } from '../../../hooks/useSubscriptionLimits'
import { UpgradeModal } from '../../../components/UpgradeModal'
import { normalizePhone, phonesProblem } from '../../../lib/phones'

type Guardian = {
    firstName: string
    lastNamePaternal: string
    lastNameMaternal: string
    relationship: string
    relationshipDetails?: string
    email: string
    phone: string
    phoneAlt1: string
    phoneAlt2: string
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
        relationship: 'MADRE', relationshipDetails: '', email: '', phone: '', phoneAlt1: '', phoneAlt2: '', occupation: '', address: ''
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
                            phoneAlt1: gData.phone_alt1 || '',
                            phoneAlt2: gData.phone_alt2 || '',
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
                msg += `\n\nContraseña temporal: ${data.tempPassword}\n\nNo se envía por correo: entrégala en persona. Otra opción más sencilla: imprime su código en "Códigos para familias".`
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
        if (guardian.firstName.trim()) {
            const phoneProblem = phonesProblem(guardian.phone, guardian.phoneAlt1, guardian.phoneAlt2)
            if (phoneProblem) {
                alert(`Datos del tutor: ${phoneProblem}\nCada madre, padre o tutor necesita al menos un teléfono principal para emergencias.`)
                setStep(2)
                return
            }
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
                    phone: normalizePhone(guardian.phone) || null,
                    phone_alt1: normalizePhone(guardian.phoneAlt1) || null,
                    phone_alt2: normalizePhone(guardian.phoneAlt2) || null,
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

    // Portal al <body>: así ningún contenedor con transform/overflow de la página lo deforma
    return createPortal(
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm">
            <div role="dialog" aria-modal="true" aria-label={studentId ? 'Editar alumno' : 'Registrar nuevo alumno'}
                className="bg-white w-full sm:max-w-3xl h-[100dvh] sm:h-auto sm:max-h-[90dvh] sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden">
                <WizardModalHeader icon={UserPlus} onClose={onClose}
                    title={studentId ? 'Editar alumno' : 'Registrar nuevo alumno'}
                    subtitle="Datos del alumno, su tutor y fotografía" />

                <div className="px-5 sm:px-6 pt-4 shrink-0">
                    <WizardProgress className="mb-1" freeNavigation onStepClick={i => setStep(i + 1)} current={step - 1}
                        steps={[{ label: 'Alumno' }, { label: 'Tutor' }, { label: 'Foto' }]} />
                </div>

                {/* Content */}
                <div className="px-5 py-5 sm:p-6 overflow-y-auto flex-1 overscroll-contain">
                    {step === 1 && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="flex items-center gap-2 text-base font-black text-slate-900 mb-4"><User className="w-5 h-5 text-indigo-600" /> Información Personal</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="relative">
                                        <label className="block text-xs font-black text-slate-600 mb-1.5">Nombre(s) *</label>
                                        <input aria-label="Nombre(s) *" name="firstName" value={student.firstName} onChange={handleStudentChange} className={`${wizardInput}`} placeholder="Ej. JUAN PABLO" />
                                    </div>
                                    <div className="relative">
                                        <label className="block text-xs font-black text-slate-600 mb-1.5">Apellido Paterno *</label>
                                        <input aria-label="Apellido Paterno *" name="lastNamePaternal" value={student.lastNamePaternal} onChange={handleStudentChange} className={`${wizardInput}`} placeholder="Ej. PÉREZ" />
                                    </div>
                                    <div className="relative">
                                        <label className="block text-xs font-black text-slate-600 mb-1.5">Apellido Materno *</label>
                                        <input aria-label="Apellido Materno *" name="lastNameMaternal" value={student.lastNameMaternal} onChange={handleStudentChange} className={`${wizardInput}`} placeholder="Ej. LÓPEZ" />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-slate-600 mb-1.5">Sexo *</label>
                                    <select aria-label="Sexo *" name="gender" value={student.gender} onChange={handleStudentChange} className={`${wizardInput} cursor-pointer`}>
                                        <option value="HOMBRE">HOMBRE</option>
                                        <option value="MUJER">MUJER</option>
                                    </select>
                                </div>
                                <div className="relative">
                                    <label className="block text-xs font-black text-slate-600 mb-1.5">CURP</label>
                                    <FileText className="absolute left-4 top-[36px] w-4 h-4 text-slate-400 pointer-events-none" />
                                    <input aria-label="CURP" name="curp" value={student.curp} onChange={handleStudentChange} className={`${wizardInput} pl-11`} placeholder="Clave Única de Registro" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="relative">
                                    <label className="block text-xs font-black text-slate-600 mb-1.5">Teléfono (Opcional)</label>
                                    <Phone className="absolute left-4 top-[36px] w-4 h-4 text-slate-400 pointer-events-none" />
                                    <input aria-label="Teléfono (Opcional)" name="phone" value={student.phone} onChange={handleStudentChange} className={`${wizardInput} pl-11`} placeholder="10 dígitos" />
                                </div>
                                <div className="relative">
                                    <label className="block text-xs font-black text-slate-600 mb-1.5">Correo Electrónico (Opcional)</label>
                                    <Mail className="absolute left-4 top-[36px] w-4 h-4 text-slate-400 pointer-events-none" />
                                    <input aria-label="Correo Electrónico (Opcional)" type="email" name="email" value={student.email} onChange={handleStudentChange} className={`${wizardInput} pl-11`} placeholder="correo@ejemplo.com" />
                                </div>
                            </div>

                            {/* Medical / Conditions */}
                            <div className="bg-slate-50 rounded-2xl p-4 sm:p-6 border border-slate-100">
                                <h4 className="font-black text-slate-900 mb-4 flex items-center gap-2 text-base">
                                    <HeartPulse className="w-5 h-5 text-rose-500" /> Información Médica y Adicional
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-xs font-black text-slate-600 mb-1.5">Tipo de Sangre</label>
                                        <select aria-label="Tipo de Sangre" name="bloodType" value={student.bloodType} onChange={handleStudentChange} className={`${wizardInput}`}>
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
                                    <div className="relative">
                                        <label className="block text-xs font-black text-slate-600 mb-1.5">Alergias</label>
                                        <AlertCircle className="absolute left-4 top-[36px] w-4 h-4 text-slate-400 pointer-events-none" />
                                        <input aria-label="Alergias" name="allergies" value={student.allergies} onChange={handleStudentChange} className={`${wizardInput} pl-11`} placeholder="Ej. Penicilina (Opcional)" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-600 mb-1.5">Condición / Discapacidad</label>
                                    <select aria-label="Condición / Discapacidad" name="condition" value={student.condition} onChange={handleStudentChange} className={`${wizardInput}`}>
                                        {CONDITIONS_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                {student.condition === 'OTRO' && (
                                    <div className="mt-4">
                                        <label className="block text-xs font-black text-slate-600 mb-1.5">Especifique la condición</label>
                                        <input aria-label="Especifique la condición" name="conditionDetails" value={student.conditionDetails} onChange={handleStudentChange} className={`${wizardInput}`} placeholder="Describa la condición..." autoFocus />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 text-amber-900 flex items-start">
                                <AlertCircle className="h-5 w-5 text-amber-700 mr-3 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold mb-1">Contacto de Emergencia</p>
                                    <p className="text-sm opacity-90">Estos datos son cruciales para contactar al tutor en caso de emergencia.</p>
                                </div>
                            </div>

                            <div>
                                <h3 className="flex items-center gap-2 text-base font-black text-slate-900 mb-4"><User className="w-5 h-5 text-indigo-600" /> Datos del Tutor</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="relative">
                                        <label className="block text-xs font-black text-slate-600 mb-1.5">Nombre(s) *</label>
                                        <input aria-label="Nombre(s) *" name="firstName" value={guardian.firstName} onChange={handleGuardianChange} className={`${wizardInput}`} placeholder="Nombres" />
                                    </div>
                                    <div className="relative">
                                        <label className="block text-xs font-black text-slate-600 mb-1.5">Apellido Paterno *</label>
                                        <input aria-label="Apellido Paterno *" name="lastNamePaternal" value={guardian.lastNamePaternal} onChange={handleGuardianChange} className={`${wizardInput}`} placeholder="Apellido P." />
                                    </div>
                                    <div className="relative">
                                        <label className="block text-xs font-black text-slate-600 mb-1.5">Apellido Materno *</label>
                                        <input aria-label="Apellido Materno *" name="lastNameMaternal" value={guardian.lastNameMaternal} onChange={handleGuardianChange} className={`${wizardInput}`} placeholder="Apellido M." />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-slate-600 mb-1.5">Parentesco *</label>
                                    <select aria-label="Parentesco *" name="relationship" value={guardian.relationship} onChange={handleGuardianChange} className={`${wizardInput}`}>
                                        {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                                <div className="relative">
                                    <label className="block text-xs font-black text-slate-600 mb-1.5">Teléfono principal *</label>
                                    <Phone className="absolute left-4 top-[36px] w-4 h-4 text-slate-400 pointer-events-none" />
                                    <input aria-label="Teléfono principal" type="tel" inputMode="tel" name="phone" value={guardian.phone} onChange={handleGuardianChange} className={`${wizardInput} pl-11`} placeholder="10 dígitos" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="relative">
                                    <label className="block text-xs font-black text-slate-600 mb-1.5">Teléfono de respaldo 1</label>
                                    <Phone className="absolute left-4 top-[36px] w-4 h-4 text-slate-400 pointer-events-none" />
                                    <input aria-label="Teléfono de respaldo 1" type="tel" inputMode="tel" name="phoneAlt1" value={guardian.phoneAlt1} onChange={handleGuardianChange} className={`${wizardInput} pl-11`} placeholder="Otro número (familiar, trabajo)" />
                                </div>
                                <div className="relative">
                                    <label className="block text-xs font-black text-slate-600 mb-1.5">Teléfono de respaldo 2</label>
                                    <Phone className="absolute left-4 top-[36px] w-4 h-4 text-slate-400 pointer-events-none" />
                                    <input aria-label="Teléfono de respaldo 2" type="tel" inputMode="tel" name="phoneAlt2" value={guardian.phoneAlt2} onChange={handleGuardianChange} className={`${wizardInput} pl-11`} placeholder="Otro número" />
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 -mt-2">Para emergencias: el principal es obligatorio; los de respaldo, muy recomendables.</p>
                            <div className="relative">
                                <label className="block text-xs font-black text-slate-600 mb-1.5">Ocupación</label>
                                <Briefcase className="absolute left-4 top-[36px] w-4 h-4 text-slate-400 pointer-events-none" />
                                <input aria-label="Ocupación" name="occupation" value={guardian.occupation} onChange={handleGuardianChange} className={`${wizardInput} pl-11`} placeholder="Ej. Empleado, Comerciante..." />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="relative">
                                    <label className="block text-xs font-black text-slate-600 mb-1.5">Correo Electrónico (Acceso)</label>
                                    <Mail className="absolute left-4 top-[36px] w-4 h-4 text-slate-400 pointer-events-none" />
                                    <input aria-label="Correo Electrónico (Acceso)" type="email" name="email" value={guardian.email} onChange={handleGuardianChange} className={`${wizardInput} pl-11`} placeholder="tutor@ejemplo.com" />
                                </div>
                                <div className="flex items-end">
                                    {existingProfile ? (
                                        <div className="w-full p-4 bg-indigo-50 border-2 border-indigo-100 rounded-2xl flex items-center gap-3 animate-in fade-in zoom-in-95 duration-300">
                                            <div className="p-2 bg-indigo-600 rounded-xl">
                                                <User className="w-4 h-4 text-white" />
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-black text-indigo-600 uppercase tracking-widest">Tutor Reconocido</p>
                                                <p className="text-xs font-bold text-slate-700">Se vinculará a la cuenta existente.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleInviteTutor}
                                            disabled={invitingTutor || !guardian.email || invitationSent || searchingProfile}
                                            className={`w-full py-3 rounded-2xl text-sm font-black flex items-center justify-center transition-all ${invitationSent
                                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-default'
                                                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-indigo-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none'
                                                }`}
                                        >
                                            <Zap className={`w-4 h-4 mr-2 ${invitationSent ? 'text-emerald-700' : 'text-indigo-200'}`} />
                                            {invitingTutor ? 'Generando...' : searchingProfile ? 'Verificando...' : invitationSent ? 'Acceso Enviado' : 'Enviar Credenciales'}
                                        </button>
                                    )}
                                </div>
                                <div className="sm:col-span-2 relative">
                                    <label className="block text-xs font-black text-slate-600 mb-1.5">Dirección Completa</label>
                                    <MapPin className="absolute left-4 top-[36px] w-4 h-4 text-slate-400 pointer-events-none" />
                                    <input aria-label="Dirección Completa" name="address" value={guardian.address} onChange={handleGuardianChange} className={`${wizardInput} pl-11`} placeholder="Calle, Número, Colonia, CP..." />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6 text-center">
                            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 sm:p-6 flex flex-col items-center justify-center min-h-[260px] bg-slate-50">
                                {showCamera ? (
                                    <>
                                        <Webcam
                                            audio={false}
                                            ref={webcamRef}
                                            screenshotFormat="image/jpeg"
                                            className="rounded-2xl shadow-lg mb-4 w-full max-w-sm max-h-[50dvh] object-cover"
                                        />
                                        <button onClick={capture} type="button" className="px-5 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-black hover:bg-indigo-700">
                                            <Camera className="inline w-5 h-5 mr-2" /> Capturar Foto
                                        </button>
                                    </>
                                ) : imgSrc ? (
                                    <>
                                        <img src={imgSrc} alt="Preview" className="rounded-2xl shadow-lg mb-4 w-full max-w-sm max-h-[50dvh] object-cover" />
                                        <div className="flex flex-wrap gap-2 justify-center">
                                            <button onClick={() => setImgSrc(null)} type="button" className="px-5 py-3 rounded-2xl text-sm font-black text-slate-600 hover:bg-slate-100">
                                                Eliminar
                                            </button>
                                            <button onClick={() => setShowCamera(true)} type="button" className="px-5 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-black">
                                                Retomar
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center">
                                        <Camera className="w-14 h-14 text-slate-300 mx-auto mb-2" />
                                        <p className="text-sm text-slate-500 mb-4">Aún no hay foto</p>
                                        <div className="flex flex-col sm:flex-row gap-2 justify-center">
                                            <button onClick={() => setShowCamera(true)} type="button" className="px-5 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-black hover:bg-indigo-700">
                                                Activar Cámara
                                            </button>
                                            <button
                                                onClick={() => setImgSrc(`https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random().toString(36).slice(2, 10)}&gender=${student.gender === 'MUJER' ? 'female' : 'male'}`)}
                                                type="button"
                                                className="px-5 py-3 bg-white text-slate-700 border border-slate-200 rounded-2xl text-sm font-black hover:bg-slate-50"
                                            >
                                                Usar Avatar
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="border border-slate-100 p-4 rounded-2xl bg-slate-50 opacity-60 cursor-not-allowed">
                                <h3 className="text-sm font-black text-slate-700">Huella digital (próximamente)</h3>
                                <p className="text-xs text-slate-500">Se requiere un lector compatible.</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="shrink-0 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-4 border-t border-slate-100 bg-white">
                    {step < 3
                        ? <WizardFooter sticky={false} onBack={step > 1 ? () => setStep(s => Math.max(1, s - 1)) : onClose} backLabel={step > 1 ? 'Anterior' : 'Cancelar'} onNext={() => setStep(s => Math.min(3, s + 1))} />
                        : <WizardFooter sticky={false} onBack={() => setStep(s => Math.max(1, s - 1))} onNext={handleSubmit} loading={loading} nextDisabled={fetching} tone="success" nextIcon={Check}
                            nextLabel={studentId ? 'Guardar cambios' : 'Registrar alumno'} />}
                </div>
            </div>

            <UpgradeModal
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                currentPlan={limits.planType}
                currentGroups={limits.currentGroups}
                maxGroups={limits.maxGroups}
                reason="students"
            />
        </div>,
        document.body
    )
}
