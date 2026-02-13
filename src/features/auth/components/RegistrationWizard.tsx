import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { Check, ChevronRight, School, MapPin, Users, User, Building2, BookOpen } from 'lucide-react'
import { useTenant } from '../../../hooks/useTenant'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { SubjectSelector } from '../../../components/academic/SubjectSelector'

// Fix for default marker icons in React Leaflet
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

// Steps configuration
const STEPS = [
    { id: 1, title: 'Datos Escolares', icon: Building2 },
    { id: 2, title: 'Ubicación', icon: MapPin },
    { id: 3, title: 'Mis Materias', icon: BookOpen },
    { id: 4, title: 'Config. Académica', icon: School },
    { id: 5, title: 'Identidad', icon: User },
]

const LocationMarker = ({ position, setPosition }: { position: { lat: number, lng: number }, setPosition: (pos: { lat: number, lng: number }) => void }) => {
    useMapEvents({
        click(e) {
            setPosition(e.latlng)
        },
    })
    return position ? <Marker position={position} /> : null
}

const AVATARS = [
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Scooter',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Simba',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Annie',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Jack',
]

type Subject = {
    id: string
    name: string
    field_of_study: string
    requires_specification: boolean
}

export const RegistrationWizard = () => {
    const navigate = useNavigate()
    const { data: tenantId } = useTenant()
    const [currentStep, setCurrentStep] = useState(1)
    const [loading, setLoading] = useState(false)

    // Form State
    const [formData, setFormData] = useState({
        // Step 1: School Info
        schoolName: '',
        educationalLevel: 'SECONDARY',
        cct: '',
        phone: '',
        address: '',

        // Step 2: Location
        locationLat: 19.4326, // Default CDMX
        locationLng: -99.1332,

        // Step 3: Subjects
        selectedSubjects: {} as Record<string, { selected: boolean, customDetail: string }>,

        // Step 4: Academic
        selectedGrades: [] as string[],
        groupsPerGrade: {} as Record<string, string>, // '1': 'A,B' (comma separated for UI simplicity)

        // Step 5: Identity
        firstName: '',
        lastNamePaternal: '',
        lastNameMaternal: '',
        avatarUrl: AVATARS[0],
        logoUrl: ''
    })

    const validateStep = () => {
        switch (currentStep) {
            case 1: // School Info
                if (!formData.schoolName || !formData.cct || !formData.phone || !formData.address) {
                    alert("Por favor complete todos los datos de la escuela")
                    return false
                }
                return true
            case 5: // Identity
                if (!formData.firstName || !formData.lastNamePaternal || !formData.lastNameMaternal) {
                    alert("Por favor complete sus datos personales")
                    return false
                }
                return true
            default:
                return true
        }
    }

    const handleNext = async () => {
        if (!validateStep()) return

        if (currentStep < STEPS.length) {
            setCurrentStep(c => c + 1)
        } else {
            await handleSubmit()
        }
    }

    const handleSubmit = async () => {
        setLoading(true)
        try {
            if (!tenantId) throw new Error("No Tenant ID")

            // 1. Update Tenant Details
            const { error: tenantError } = await supabase
                .from('tenants')
                .update({
                    name: formData.schoolName,
                    educational_level: formData.educationalLevel,
                    cct: formData.cct,
                    phone: formData.phone,
                    address: formData.address,
                    location_lat: formData.locationLat,
                    location_lng: formData.locationLng,
                    onboarding_completed: true
                })
                .eq('id', tenantId)

            if (tenantError) throw tenantError

            // 1.5 Save Subjects
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error("No user")

            const subjectsToInsert = Object.entries(formData.selectedSubjects)
                .filter(([_, val]) => val.selected)
                .map(([subjectId, val]) => ({
                    profile_id: user.id,
                    tenant_id: tenantId,
                    subject_catalog_id: subjectId,
                    custom_detail: val.customDetail || null
                }))

            if (subjectsToInsert.length > 0) {
                await supabase.from('profile_subjects').insert(subjectsToInsert)
            }

            // 2. Create Initial Groups Logic
            // First find/create academic year (reusing logic from GroupsPage but simplified)
            const { data: years } = await supabase.from('academic_years').select('id').eq('is_active', true).limit(1)
            let yearId = years?.[0]?.id

            if (!yearId) {
                const { data: newYear, error: yearError } = await supabase.from('academic_years').insert({
                    tenant_id: tenantId,
                    name: 'Ciclo Inicial 2024-2025',
                    start_date: '2024-08-01',
                    end_date: '2025-07-30',
                    is_active: true
                }).select().single()
                if (yearError) throw yearError
                yearId = newYear.id
            }

            // Loop and insert groups
            for (const grade of formData.selectedGrades) {
                const groupsString = formData.groupsPerGrade[grade] || 'A'
                const sections = groupsString.split(',').map(s => s.trim().toUpperCase())

                for (const section of sections) {
                    if (!section) continue
                    await supabase.from('groups').insert({
                        tenant_id: tenantId,
                        academic_year_id: yearId,
                        grade: grade,
                        section: section,
                        shift: 'MORNING' // Default for bulk create
                    })
                }
            }

            // 3. Update Profile Avatar and Names
            if (user) {
                await supabase.from('profiles').update({
                    avatar_url: formData.avatarUrl,
                    first_name: formData.firstName,
                    last_name_paternal: formData.lastNamePaternal,
                    last_name_maternal: formData.lastNameMaternal
                }).eq('id', user.id)
            }

            // navigate('/') 
            // Force reload to refresh session/context states or redirect to clean dashboard
            window.location.href = '/'

        } catch (error: any) {
            console.error(error)
            alert('Error al guardar: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const toggleGrade = (grade: string) => {
        setFormData(prev => {
            const exists = prev.selectedGrades.includes(grade)
            const newGrades = exists
                ? prev.selectedGrades.filter(g => g !== grade)
                : [...prev.selectedGrades, grade].sort()
            return { ...prev, selectedGrades: newGrades }
        })
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">Configuración Inicial</h1>

            {/* Stepper */}
            <div className="flex items-center space-x-4 mb-8 w-full max-w-3xl justify-center overflow-x-auto">
                {STEPS.map((step, idx) => (
                    <div key={step.id} className="flex items-center min-w-fit">
                        <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${currentStep >= step.id ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 text-gray-400'
                            }`}>
                            {step.icon && <step.icon className="w-5 h-5" />}
                        </div>
                        {idx < STEPS.length - 1 && (
                            <div className={`w-8 sm:w-12 h-1 mx-2 ${currentStep > step.id ? 'bg-blue-600' : 'bg-gray-300'}`} />
                        )}
                    </div>
                ))}
            </div>

            {/* Content Card */}
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-3xl min-h-[500px] flex flex-col">
                <div className="flex-1">
                    {currentStep === 1 && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-semibold">Datos de la Escuela</h2>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Nombre de la Escuela</label>
                                <input
                                    type="text"
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                                    value={formData.schoolName}
                                    onChange={(e) => setFormData({ ...formData, schoolName: e.target.value.toUpperCase() })}
                                    placeholder="NOMBRE DE LA ESCUELA"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Nivel Educativo</label>
                                <select
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.educationalLevel}
                                    onChange={(e) => setFormData({ ...formData, educationalLevel: e.target.value })}
                                >
                                    <option value="SECONDARY">Secundaria</option>
                                    <option value="TELESECUNDARIA">Telesecundaria</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">CCT (Clave Centro de Trabajo)</label>
                                <input
                                    type="text"
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                                    value={formData.cct}
                                    onChange={(e) => setFormData({ ...formData, cct: e.target.value.toUpperCase() })}
                                    placeholder="Ej. 09DPR1234Z"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Teléfono de Contacto</label>
                                <input
                                    type="tel"
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value.toUpperCase() })}
                                />
                            </div>
                        </div>
                    )}

                    {currentStep === 2 && (
                        <div className="space-y-4 h-full flex flex-col">
                            <h2 className="text-xl font-semibold">Ubicación</h2>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Dirección Completa</label>
                                <input
                                    type="text"
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value.toUpperCase() })}
                                    placeholder="CALLE, NÚMERO, COLONIA, CIUDAD..."
                                />
                            </div>
                            <div className="h-[300px] w-full border rounded-lg overflow-hidden relative z-0">
                                <MapContainer
                                    center={[formData.locationLat, formData.locationLng]}
                                    zoom={13}
                                    style={{ height: '100%', width: '100%' }}
                                >
                                    <TileLayer
                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                        attribution="&copy; OpenStreetMap contributors"
                                    />
                                    <LocationMarker
                                        position={{ lat: formData.locationLat, lng: formData.locationLng }}
                                        setPosition={(pos) => setFormData({ ...formData, locationLat: pos.lat, locationLng: pos.lng })}
                                    />
                                </MapContainer>
                            </div>
                            <p className="text-xs text-gray-500 text-center">Haz clic en el mapa para ajustar la ubicación exacta.</p>
                        </div>
                    )}

                    {currentStep === 3 && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-semibold">Mis Materias</h2>
                            <p className="text-sm text-gray-500">Selecciona las materias que impartes en tu grado.</p>

                            <SubjectSelector
                                educationalLevel={formData.educationalLevel}
                                selectedSubjects={formData.selectedSubjects}
                                onChange={(subjects) => setFormData({ ...formData, selectedSubjects: subjects })}
                            />
                        </div>
                    )}

                    {currentStep === 4 && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <h2 className="text-xl font-semibold">Configuración Académica</h2>
                                <p className="text-gray-500 text-sm">Selecciona los grados que impartes y define los grupos.</p>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                {['1', '2', '3'].map(grade => (
                                    <button
                                        key={grade}
                                        onClick={() => toggleGrade(grade)}
                                        className={`p-3 rounded-lg border-2 text-center transition-all ${formData.selectedGrades.includes(grade)
                                            ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold'
                                            : 'border-gray-200 hover:border-blue-200'
                                            }`}
                                    >
                                        {grade}° Grado
                                    </button>
                                ))}
                            </div>

                            {formData.selectedGrades.length > 0 && (
                                <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                                    <h3 className="text-sm font-medium text-gray-700">Grupos por Grado (separados por coma)</h3>
                                    {formData.selectedGrades.map(grade => (
                                        <div key={grade} className="flex items-center space-x-3">
                                            <span className="w-20 font-medium text-gray-900">{grade}° Grado:</span>
                                            <input
                                                type="text"
                                                className="flex-1 px-3 py-1 border border-gray-300 rounded-md"
                                                placeholder="Ej. A, B"
                                                value={formData.groupsPerGrade[grade] || ''}
                                                onChange={(e) => setFormData(prev => ({
                                                    ...prev,
                                                    groupsPerGrade: { ...prev.groupsPerGrade, [grade]: e.target.value }
                                                }))}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {currentStep === 5 && (
                        <div className="space-y-6">
                            <div className="text-center mb-6">
                                <h2 className="text-xl font-semibold">Datos Personales e Identidad</h2>
                                <p className="text-sm text-gray-500">Completa tu información personal.</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Nombre(s)</label>
                                    <input
                                        type="text"
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                                        value={formData.firstName}
                                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value.toUpperCase() })}
                                        placeholder="NOMBRE(S)"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Apellido Paterno</label>
                                        <input
                                            type="text"
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                                            value={formData.lastNamePaternal}
                                            onChange={(e) => setFormData({ ...formData, lastNamePaternal: e.target.value.toUpperCase() })}
                                            placeholder="APELLIDO PATERNO"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Apellido Materno</label>
                                        <input
                                            type="text"
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                                            value={formData.lastNameMaternal}
                                            onChange={(e) => setFormData({ ...formData, lastNameMaternal: e.target.value.toUpperCase() })}
                                            placeholder="APELLIDO MATERNO"
                                        />
                                    </div>
                                </div>
                            </div>

                            <h3 className="text-lg font-medium text-center mt-6">Elige tu Avatar</h3>
                            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                                {AVATARS.map((url, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setFormData({ ...formData, avatarUrl: url })}
                                        className={`relative rounded-full p-1 border-4 transition-all ${formData.avatarUrl === url ? 'border-blue-500 scale-110' : 'border-transparent hover:border-gray-200'
                                            }`}
                                    >
                                        <img src={url} alt={`Avatar ${idx}`} className="w-full h-auto rounded-full bg-gray-100" />
                                        {formData.avatarUrl === url && (
                                            <div className="absolute bottom-0 right-0 bg-blue-500 text-white rounded-full p-1">
                                                <Check className="w-3 h-3" />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>

                            <div className="pt-8 border-t">
                                <h3 className="text-sm font-medium text-gray-700 mb-2">Logo de la Escuela (Opcional)</h3>
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center text-gray-500">
                                    <School className="w-8 h-8 mb-2" />
                                    <span className="text-sm">Subir logo (Próximamente)</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-8 flex justify-between pt-4 border-t border-gray-100">
                    <button
                        onClick={() => {
                            if (confirm('¿Estás seguro de que quieres cancelar el registro actual? Podrás volver a elegir entre Docente Independiente o Institución.')) {
                                navigate('/register')
                            }
                        }}
                        className="px-4 py-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                        Cancelar Registro
                    </button>

                    <div className="flex space-x-4">
                        {currentStep > 1 && (
                            <button
                                onClick={() => setCurrentStep(c => c - 1)}
                                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Atrás
                            </button>
                        )}
                        <button
                            onClick={handleNext}
                            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center shadow-lg transform hover:-translate-y-0.5 transition-all"
                            disabled={loading}
                        >
                            {loading ? 'Guardando...' : currentStep === STEPS.length ? 'Finalizar Configuración' : 'Siguiente'}
                            <ChevronRight className="ml-2 w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
