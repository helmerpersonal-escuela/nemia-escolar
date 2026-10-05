import { TextSizeSetting } from '../components/TextSizeSetting';
import { formatSubjectName } from '../../../lib/subjectName';
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { Pencil, User, School, Lock, Save, BookOpen, Sparkles, Database, Copy, Trash2, Calendar, Users, Clock, Plus, CreditCard, ArrowLeft, GraduationCap, Check, Layers, Bell } from 'lucide-react'
import { StaffManager } from '../components/StaffManager'
import { NotificationSettings } from '../components/NotificationSettings'
import { PeriodManager } from '../../evaluation/components/PeriodManager'
import { ScheduleConfig } from '../components/ScheduleConfig'
import { SpecialScheduleManager } from '../components/SpecialScheduleManager'
import { ImageUpload } from '../../../components/common/ImageUpload'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import { SecuritySettings } from '../components/SecuritySettings'
import L from 'leaflet'
import { BillingSection } from '../components/BillingSection'
import { BILLING_ENABLED } from '../../../lib/billing'
import { useLocation } from 'react-router-dom'
import { AcademicYearManager } from '../components/AcademicYearManager'
import { useProfile } from '../../../hooks/useProfile'
import { SubjectSelector } from '../../../components/academic/SubjectSelector'
import { SchoolDataSection } from '../components/SchoolDataSection'
import { SettingsHeader, SettingsCard, SettingsActionButton, SaveBar } from '../components/SettingsUI'
import { WizardField, wizardInput } from '../../../components/wizard/Wizard'
import { useToast } from '../../../components/ui/Toast'
import { useQueryClient } from '@tanstack/react-query'

// Leaflet Icons Fix
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { DateInput } from '../../../components/ui/DateInput'
import { askConfirm } from '../../../components/ui/ConfirmDialog'

// @ts-expect-error -- pendiente de tipar
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

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

export const SettingsPage = () => {
    const [searchParams] = useSearchParams()
    // Enlaces antiguos: "periods" ahora vive junto con el ciclo escolar
    const rawTab = searchParams.get('tab')
    const initialTab = (rawTab === 'periods' ? 'cycle' : rawTab === 'ai' ? 'profile' : rawTab as any) || 'profile'

    const [loading, setLoading] = useState(true)
    const [updating, setUpdating] = useState(false)
    const queryClient = useQueryClient()
    const [activeTab, setActiveTab] = useState<'profile' | 'school' | 'subjects' | 'periods' | 'cycle' | 'horarios' | 'personal' | 'security' | 'avisos' | 'ai' | 'billing'>(initialTab)
    const location = useLocation()
    const [successMessage, setSuccessMessage] = useState('')
    const [profile, setProfile] = useState({
        id: '',
        first_name: '',
        last_name_paternal: '',
        last_name_maternal: '',
        avatar_url: '',
        email: '',
        tenant_id: '',
        role: ''
    })

    // Security Redirection: If Independent Teacher tries to access hidden tabs, fallback to profile
    /*
    useEffect(() => {
        if (profile.role?.toUpperCase() === 'INDEPENDENT_TEACHER' && ['personal'].includes(activeTab)) {
            setActiveTab('profile')
        }
    }, [profile.role, activeTab])
    */
    const { profile: hookProfile, updateProfile, isUpdating: isProfileUpdating, isSuperAdmin: hookIsSuperAdmin } = useProfile()

    const [tenant, setTenant] = useState({
        id: '',
        name: '',
        cct: '',
        phone: '',
        address: '',
        educational_level: 'SECONDARY',
        type: 'SCHOOL',
        location_lat: 19.4326,
        location_lng: -99.1332,
        grade: null as number | null,
        phase: null as number | null,
        ai_config: { groq_key: '', gemini_key: '', openai_key: '', apiKey: '' },
        cte_config: { next_date: '', link: '' },
        logo_left_url: '',
        logo_right_url: ''
    })

    const [selectedUserSubjects, setSelectedUserSubjects] = useState<{ catalogId: string | null, customDetail: string }[]>([])
    const [aiSettings, setAiSettings] = useState({
        groq_key: '',
        gemini_key: '',
        openai_key: ''
    })

    // Lo último guardado, para saber si hay cambios pendientes (barra "Guardar cambios")
    const profileKey = (p: { first_name: string; last_name_paternal: string; last_name_maternal: string; avatar_url: string }) =>
        JSON.stringify([p.first_name, p.last_name_paternal, p.last_name_maternal, p.avatar_url])
    const [savedProfileKey, setSavedProfileKey] = useState<string | null>(null)
    const [savedSubjectsKey, setSavedSubjectsKey] = useState('[]')
    const [savedAiKey, setSavedAiKey] = useState(JSON.stringify({ groq_key: '', gemini_key: '', openai_key: '' }))
    const setProfileAndBaseline = (p: any) => { setProfile(p); setSavedProfileKey(profileKey(p)) }
    const { showToast } = useToast()
    // En celular, deja visible la opción activa de la fila deslizable (solo al cambiar de sección)
    useEffect(() => {
        const el = document.querySelector<HTMLElement>('[data-settings-chip="active"]')
        const row = el?.closest('nav')
        if (el && row) row.scrollTo({ left: el.offsetLeft - row.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' })
    }, [activeTab, loading])
    const [showAddSubject, setShowAddSubject] = useState(false)
    const [catalogNames, setCatalogNames] = useState<Record<string, string>>({})
    const [catalogItems, setCatalogItems] = useState<any[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [showMigrationModal, setShowMigrationModal] = useState(false)
    const [migrationSql, setMigrationSql] = useState('')
    const [isEditingSubjects, setIsEditingSubjects] = useState(false)

    // Robust Role Enforcement
    const workspaceType = tenant?.type || 'SCHOOL'
    let currentRole = (hookProfile?.role || profile?.role || '').toUpperCase()
    const PROTECTED_ROLES = ['TUTOR', 'SCHOOL_CONTROL', 'PREFECT', 'SUPPORT', 'STUDENT', 'SUPER_ADMIN', 'SYSTEM_ADMIN']

    if (workspaceType === 'INDEPENDENT' && !PROTECTED_ROLES.includes(currentRole)) {
        currentRole = 'INDEPENDENT_TEACHER'
    }

    const isDirectorOrAdmin = ['DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'INDEPENDENT_TEACHER', 'ACADEMIC_COORD', 'TECH_COORD'].includes(currentRole)
    const isAcademicCoord = currentRole === 'ACADEMIC_COORD'
    const isSuperAdmin = hookIsSuperAdmin || ['helmerferras@gmail.com', 'helmerpersonal@gmail.com'].includes(profile?.email || '') || currentRole === 'SUPER_ADMIN'
    const isStaffReadOnly = !isDirectorOrAdmin

    useEffect(() => {
        loadData()

        // Handle redirection for expired trials
        if (BILLING_ENABLED && location.state?.trialExpired) {
            setActiveTab('billing')
        }
    }, [location.state])


    const loadData = async () => {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // 1. Get Profile
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single()

            if (profileData) {
                let workspaceRole = null
                if (profileData.tenant_id) {
                    // Fetch Workspace-Specific Identity from profile_tenants
                    const { data: ptData } = await supabase
                        .from('profile_tenants')
                        .select('first_name, last_name_paternal, last_name_maternal, avatar_url, role')
                        .eq('profile_id', user.id)
                        .eq('tenant_id', profileData.tenant_id)
                        .maybeSingle()

                    workspaceRole = ptData?.role
                    setProfileAndBaseline({
                        ...profileData,
                        role: ptData?.role || profileData.role || '',
                        first_name: (ptData?.first_name || profileData.first_name || '').toUpperCase(),
                        last_name_paternal: (ptData?.last_name_paternal || profileData.last_name_paternal || '').toUpperCase(),
                        last_name_maternal: (ptData?.last_name_maternal || profileData.last_name_maternal || '').toUpperCase(),
                        avatar_url: ptData?.avatar_url || profileData.avatar_url || '',
                        email: user.email || ''
                    })
                } else {
                    setProfileAndBaseline({
                        ...profileData,
                        first_name: (profileData.first_name || '').toUpperCase(),
                        last_name_paternal: (profileData.last_name_paternal || '').toUpperCase(),
                        last_name_maternal: (profileData.last_name_maternal || '').toUpperCase(),
                        avatar_url: profileData.avatar_url || '',
                        email: user.email || ''
                    })
                }

                let effectiveRole = (workspaceRole || profileData.role || '').toUpperCase()

                if (profileData.tenant_id) {
                    const { data: tenantData } = await supabase
                        .from('tenants')
                        .select('*, ai_config')
                        .eq('id', profileData.tenant_id)
                        .single()

                    if (tenantData) {
                        // Robust Role Enforcement
                        const PROTECTED_ROLES = ['TUTOR', 'SCHOOL_CONTROL', 'PREFECT', 'SUPPORT', 'STUDENT', 'SUPER_ADMIN', 'SYSTEM_ADMIN']
                        if (tenantData.type === 'INDEPENDENT' && !PROTECTED_ROLES.includes(effectiveRole)) {
                            effectiveRole = 'INDEPENDENT_TEACHER'
                        }

                        setTenant({
                            id: tenantData.id,
                            name: (tenantData.name || '').toUpperCase(),
                            cct: (tenantData.cct || '').toUpperCase(),
                            phone: (tenantData.phone || '').toUpperCase(),
                            address: (tenantData.address || '').toUpperCase(),
                            educational_level: tenantData.educational_level || 'PRIMARY',
                            type: tenantData.type || 'SCHOOL',
                            location_lat: tenantData.location_lat || 19.4326,
                            location_lng: tenantData.location_lng || -99.1332,
                            grade: tenantData.grade || null,
                            phase: tenantData.phase || null,
                            ai_config: tenantData.ai_config || { apiKey: '' },
                            cte_config: { next_date: '', link: '' }, // Loaded shortly after
                            logo_left_url: tenantData.logo_left_url || '',
                            logo_right_url: tenantData.logo_right_url || ''
                        })
                        if (tenantData.ai_config) {
                            const ai = {
                                groq_key: tenantData.ai_config.groq_key || tenantData.ai_config.apiKey || '',
                                gemini_key: tenantData.ai_config.gemini_key || '',
                                openai_key: tenantData.ai_config.openai_key || ''
                            }
                            setAiSettings(ai)
                            setSavedAiKey(JSON.stringify(ai))
                        }

                        // Fetch School Details (for technologies/workshops) - ONLY if role is relevant
                        let schoolDetails = null
                        if (['TEACHER', 'DIRECTOR', 'ACADEMIC_COORD', 'TECH_COORD', 'INDEPENDENT_TEACHER'].includes(effectiveRole)) {
                            try {
                                const { data, error } = await supabase
                                    .from('school_details')
                                    .select('*')
                                    .eq('tenant_id', tenantData.id)
                                    .maybeSingle()

                                if (error) {
                                    // Ignore 400 errors caused by missing columns/table
                                    if (error.code !== 'PGRST100' && error.code !== '42703' && error.code !== '400') {
                                        console.error('Error fetching school details:', error)
                                    }
                                } else {
                                    schoolDetails = data
                                    if (data?.cte_config) {
                                        setTenant(prev => ({ ...prev, cte_config: data.cte_config }))
                                    }
                                }
                            } catch (err) {
                                // Silently fail if table/columns don't exist
                                console.warn('Could not fetch school_details (likely missing table/columns)')
                            }
                        }

                        // 3. Get Catalog Names (for display)
                        const { data: catalogData } = await supabase.from('subject_catalog').select('id, name, educational_level')
                        if (catalogData) {
                            const mergedCatalog = [...(catalogData || [])]

                            // Inject technologies from school_details
                            if (schoolDetails?.workshops) {
                                schoolDetails.workshops.forEach((w: string, i: number) => {
                                    mergedCatalog.push({
                                        id: `tech-${i}`,
                                        name: w.toUpperCase(),
                                        educational_level: 'SECONDARY',
                                        is_technology: true
                                    } as any)
                                })
                            }

                            setCatalogItems(mergedCatalog)
                            const names = mergedCatalog.reduce((acc: any, curr: any) => {
                                acc[curr.id] = curr.name
                                return acc
                            }, {})
                            setCatalogNames(names)
                        }

                        // 4. Get Subjects - ONLY for teaching roles
                        if (['TEACHER', 'DIRECTOR', 'ACADEMIC_COORD', 'TECH_COORD', 'INDEPENDENT_TEACHER'].includes(effectiveRole)) {
                            console.log('Fetching subjects for role:', effectiveRole);
                            const { data: subjectData, error: subjectError } = await supabase
                                .from('profile_subjects')
                                .select('subject_catalog_id, custom_detail')
                                .eq('profile_id', user.id)
                                .eq('tenant_id', tenantData.id)

                            if (subjectError) console.error('Error fetching subjects:', subjectError);
                            console.log('Fetched subjects:', subjectData);

                            if (subjectData) {
                                const mapped = subjectData.map((curr: any) => ({
                                    catalogId: curr.subject_catalog_id,
                                    customDetail: (curr.custom_detail || '')
                                }))
                                setSelectedUserSubjects(mapped)
                                setSavedSubjectsKey(JSON.stringify(mapped))
                            }
                        }
                    }
                }

                // (End of subject fetching)

            }
        } catch (error) {
            console.error('Error loading settings:', error)
        } finally {
            setLoading(false)
        }
    }

    const showSuccess = (msg: string) => {
        showToast(msg, 'success')
        setSuccessMessage(msg)
        setTimeout(() => setSuccessMessage(''), 3000)
    }

    const handleUpdateProfile = async () => {
        setUpdating(true)

        // Try to use the new RPC for workspace-specific updates
        const { error } = await supabase.rpc('update_profile_for_workspace', {
            p_first_name: profile.first_name,
            p_last_name_paternal: profile.last_name_paternal,
            p_last_name_maternal: profile.last_name_maternal,
            p_avatar_url: profile.avatar_url
        })

        if (error) {
            console.error('RPC Error, falling back to profile update', error)
            // Fallback: If RPC doesn't exist (migration not run), update global profile
            const { error: fallbackError } = await supabase.from('profiles').update({
                first_name: profile.first_name,
                last_name_paternal: profile.last_name_paternal,
                last_name_maternal: profile.last_name_maternal,
                avatar_url: profile.avatar_url
            }).eq('id', profile.id)

            if (fallbackError) {
                alert('Error al actualizar perfil: ' + fallbackError.message)
            } else {
                showSuccess('Perfil actualizado (Modo Global)')
                setSavedProfileKey(profileKey(profile))
            }
        } else {
            showSuccess('Perfil actualizado para este espacio')
            setSavedProfileKey(profileKey(profile))
            // Clear draft on save
            localStorage.removeItem(`settings_draft_${profile.id}`)
            // Refresh logic to ensure hooks pick up new data
            loadData()
        }

        setUpdating(false)
    }

    const handleUpdateTenant = async () => {
        setUpdating(true)
        try {
            // Calculate NEM Phase if Primary or Telesecundaria
            let newPhase = tenant.phase;
            if (tenant.educational_level === 'PRIMARY' && tenant.grade) {
                if (tenant.grade === 1 || tenant.grade === 2) newPhase = 3;
                else if (tenant.grade === 3 || tenant.grade === 4) newPhase = 4;
                else if (tenant.grade === 5 || tenant.grade === 6) newPhase = 5;
            } else if (tenant.educational_level === 'TELESECUNDARIA') {
                newPhase = 6;
            }

            // 1. Update Tenants table
            const { error: tenantError } = await supabase.from('tenants').update({
                name: tenant.name.toUpperCase(),
                phone: tenant.phone.toUpperCase(),
                address: tenant.address.toUpperCase(),
                cct: tenant.cct.toUpperCase(),
                location_lat: tenant.location_lat,
                location_lng: tenant.location_lng,
                educational_level: tenant.educational_level,
                grade: (tenant.educational_level === 'PRIMARY' || tenant.educational_level === 'TELESECUNDARIA') ? tenant.grade : null,
                phase: (tenant.educational_level === 'PRIMARY' || tenant.educational_level === 'TELESECUNDARIA') ? newPhase : null,
                logo_left_url: tenant.logo_left_url,
                logo_right_url: tenant.logo_right_url
            }).eq('id', tenant.id)

            if (tenantError) throw tenantError

            // 2. Update School Details (CTE Config)
            // We use upsert to ensure it works even if the row doesn't exist yet
            const { error: detailsError } = await supabase.from('school_details').upsert({
                tenant_id: tenant.id,
                official_name: tenant.name.toUpperCase(),
                cct: tenant.cct.toUpperCase(),
                cte_config: tenant.cte_config
            }, { onConflict: 'tenant_id' })

            if (detailsError) throw detailsError

            showSuccess('Datos de escuela actualizados')
            localStorage.removeItem(`settings_draft_${profile.id}`)
        } catch (error: any) {
            console.error('Update Error:', error)
            // Check for missing column error
            if (error.message?.includes('cte_config') || error.code === '42703' || error.message?.includes('schema cache')) {
                setMigrationSql(`ALTER TABLE public.school_details ADD COLUMN IF NOT EXISTS cte_config jsonb DEFAULT '{"next_date": null, "link": null}'::jsonb;`)
                setShowMigrationModal(true)
            } else {
                alert('Error al actualizar: ' + error.message)
            }
        } finally {
            setUpdating(false)
        }
    }

    const handleUpdateSubjects = async () => {
        setUpdating(true)
        try {
            // 1. Delete existing subjects for this user
            const { error: deleteError } = await supabase.from('profile_subjects').delete().eq('profile_id', profile.id).eq('tenant_id', tenant.id)
            if (deleteError) throw deleteError

            // 2. Insert selection
            const subjectsToInsert = selectedUserSubjects.map(s => ({
                profile_id: profile.id,
                tenant_id: tenant.id,
                subject_catalog_id: s.catalogId,
                custom_detail: s.customDetail || null
            }))

            if (subjectsToInsert.length > 0) {
                const { error: insertError } = await supabase.from('profile_subjects').insert(subjectsToInsert)
                if (insertError) throw insertError
            }

            queryClient.invalidateQueries({ queryKey: ['teacher-scope'] })
            showSuccess('Materias actualizadas correctamente')
            setSavedSubjectsKey(JSON.stringify(selectedUserSubjects))
            setIsEditingSubjects(false)
            localStorage.removeItem(`settings_draft_${profile.id}`)
        } catch (err) {
            console.error(err)
            alert('Error al guardar materias')
        } finally {
            setUpdating(false)
        }
    }



    const handleUpdateAiSettings = async () => {
        if (!tenant.id) {
            alert('Error: No se ha cargado la información de la escuela. Intenta recargar la página.')
            return
        }

        setUpdating(true)
        const { error } = await supabase.from('tenants').update({
            ai_config: {
                apiKey: aiSettings.groq_key, // For backward compatibility
                groq_key: aiSettings.groq_key,
                gemini_key: aiSettings.gemini_key,
                openai_key: aiSettings.openai_key
            }
        }).eq('id', tenant.id)

        if (!error) {
            setTenant(prev => ({
                ...prev,
                ai_config: {
                    apiKey: aiSettings.groq_key,
                    groq_key: aiSettings.groq_key,
                    gemini_key: aiSettings.gemini_key,
                    openai_key: aiSettings.openai_key
                }
            }))
            showSuccess('Configuración de IA guardada')
            setSavedAiKey(JSON.stringify(aiSettings))
            localStorage.removeItem(`settings_draft_${profile?.id}`)
        } else {
            console.error(error)
            // Check for schema error (PostgREST specific or general column missing)
            if (error.message.includes('ai_config') || error.code === '42703' || error.message.includes('schema cache')) {
                setMigrationSql(`alter table tenants add column if not exists ai_config jsonb default '{}'::jsonb;`)
                setShowMigrationModal(true)
            } else {
                alert('Error: ' + error.message)
            }
        }

        setUpdating(false)
    }



    if (loading && !profile.id) return <div className="p-8">Cargando...</div>

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Migration Required Modal */}
            {showMigrationModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in duration-200">
                        <div className="bg-amber-50 p-6 border-b border-amber-100 flex items-start">
                            <div className="bg-amber-100 p-2 rounded-lg mr-4">
                                <Database className="w-6 h-6 text-amber-700" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Actualización de Base de Datos Requerida</h3>
                                <p className="text-sm text-amber-800 mt-1">
                                    Para guardar la configuración de IA, necesitamos agregar una pequeña mejora a tu base de datos.
                                </p>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-gray-600">
                                Por favor, copia el siguiente código y ejecútalo en el <b>SQL Editor</b> de tu panel de Supabase:
                            </p>

                            <div className="relative">
                                <pre className="bg-gray-900 text-gray-100 p-4 rounded-xl text-xs font-mono overflow-x-auto border border-gray-700">
                                    {migrationSql}
                                </pre>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(migrationSql)
                                        showSuccess('Código copiado al portapapeles')
                                    }}
                                    className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                                    title="Copiar SQL"
                                >
                                    <Copy className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="bg-gray-50 p-4 rounded-xl text-xs text-gray-500">
                                <strong>Pasos:</strong>
                                <ol className="list-decimal ml-4 mt-2 space-y-1">
                                    <li>Ve a tu proyecto en Supabase.</li>
                                    <li>Abre la sección "SQL Editor" (barra lateral izquierda).</li>
                                    <li>Pega el código y dale click a "Run".</li>
                                    <li>Vuelve aquí e intenta guardar de nuevo.</li>
                                </ol>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                            <button
                                onClick={() => setShowMigrationModal(false)}
                                className="px-5 py-2.5 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors"
                            >
                                Entendido, ya lo copié
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="mb-4 lg:mb-8">
                <h1 className="text-3xl font-black text-gray-900 tracking-tight">Configuración</h1>
                <p className="text-gray-500 font-medium">Tus datos, los de tu escuela y cómo trabaja la app. Los cambios se guardan con el botón que aparece abajo.</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 lg:gap-8">
                {/* Navegación de Configuración: menú lateral en computadora, fila deslizable en celular */}
                {(() => {
                    const groups: { title: string; items: { id: string; label: string; icon: any }[] }[] = [
                        {
                            title: 'Personal', items: [
                                { id: 'profile', label: 'Mi perfil', icon: User },
                                ...(['TEACHER', 'DIRECTOR', 'ACADEMIC_COORD', 'TECH_COORD', 'ADMIN', 'INDEPENDENT_TEACHER'].includes(currentRole) ? [{ id: 'subjects', label: 'Mis materias', icon: BookOpen }] : []),
                                { id: 'avisos', label: 'Avisos y sonido', icon: Bell },
                                { id: 'security', label: 'Seguridad', icon: Lock },
                                ...(BILLING_ENABLED && profile.role?.toUpperCase() !== 'TUTOR' ? [{ id: 'billing', label: 'Mi cuenta', icon: CreditCard }] : []),
                            ]
                        },
                        ...((isDirectorOrAdmin || ['TEACHER', 'ACADEMIC_COORD', 'TECH_COORD', 'PREFECT', 'SUPPORT'].includes(currentRole)) ? [{
                            title: 'Escuela', items: [
                                { id: 'school', label: 'Datos de la escuela', icon: School },
                                { id: 'cycle', label: 'Ciclo escolar y periodos', icon: Calendar },
                                { id: 'horarios', label: 'Jornada escolar', icon: Clock },
                            ]
                        }] : []),
                        ...(((isDirectorOrAdmin || isSuperAdmin) && profile.role?.toUpperCase() !== 'INDEPENDENT_TEACHER' && tenant.type !== 'INDEPENDENT') ? [{
                            title: 'Gestión', items: [
                                ...(isDirectorOrAdmin ? [{ id: 'personal', label: 'Personal: altas y bajas', icon: Users }] : []),
                            ]
                        }] : []),
                    ].filter(g => g.items.length)
                    const all = groups.flatMap(g => g.items)
                    return (
                        <>
                            {/* Celular: una fila de opciones que se desliza */}
                            <nav aria-label="Secciones de configuración" className="lg:hidden -mx-3 px-3 overflow-x-auto scrollbar-hide">
                                <div className="flex gap-2 w-max pb-1">
                                    {all.map(item => {
                                        const Icon = item.icon, active = activeTab === item.id
                                        return (
                                            <button key={item.id} type="button" onClick={() => setActiveTab(item.id as any)} aria-current={active ? 'page' : undefined}
                                                data-settings-chip={active ? 'active' : undefined}
                                                className={`inline-flex items-center gap-2 min-h-[44px] px-4 rounded-2xl text-sm font-bold border whitespace-nowrap ${active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                                                <Icon className="w-4 h-4" />{item.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </nav>
                            {/* Computadora: menú lateral */}
                            <aside className="hidden lg:block lg:w-72 flex-shrink-0">
                                <div className="bg-white p-3 rounded-[2rem] border border-slate-100 shadow-sm sticky top-24 space-y-6">
                                    {groups.map(g => (
                                        <div key={g.title}>
                                            <h4 className="px-4 pt-2 text-xs font-bold text-slate-500 mb-2">{g.title}</h4>
                                            <nav className="space-y-1">
                                                {g.items.map(item => {
                                                    const Icon = item.icon, active = activeTab === item.id
                                                    return (
                                                        <button key={item.id} type="button" onClick={() => setActiveTab(item.id as any)} aria-current={active ? 'page' : undefined}
                                                            className={`w-full flex items-center px-4 py-3 text-sm font-bold rounded-2xl transition-colors ${active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                                                            <Icon className="w-4 h-4 mr-3" />{item.label}
                                                        </button>
                                                    )
                                                })}
                                            </nav>
                                        </div>
                                    ))}
                                </div>
                            </aside>
                        </>
                    )
                })()}

                {/* Content Area */}
                <main className="flex-1 min-w-0">
                    {/* overflow-clip (no hidden): así las barras "Guardar" fijas (sticky) siguen visibles al desplazarse */}
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-clip min-h-[600px]">

                        <div className="p-5 sm:p-8 lg:p-10 animate-in fade-in duration-300">
                            {(() => {
                                const H: Record<string, { icon: any; title: string; description: string }> = {
                                    profile: { icon: User, title: 'Mi perfil', description: 'Tu nombre y foto como aparecen en la app y en tus documentos. También puedes agrandar la letra.' },
                                    subjects: { icon: BookOpen, title: 'Mis materias', description: 'Las materias que impartes. Definen tu programa analítico (uno por campo formativo) y las opciones de tus planeaciones.' },
                                    security: { icon: Lock, title: 'Seguridad', description: 'Tu contraseña, verificación en dos pasos y respaldo de tus datos.' },
                                    billing: { icon: CreditCard, title: 'Mi cuenta', description: 'El estado de tu suscripción.' },
                                    school: { icon: School, title: 'Datos de la escuela', description: 'Lo que registraste al crear tu espacio. Aparece en tus planeaciones, programa analítico y documentos.' },
                                    cycle: { icon: Calendar, title: 'Ciclo escolar y periodos', description: 'Las fechas del ciclo y los periodos de evaluación (trimestres). Organizan tus calificaciones, asistencia y planeaciones.' },
                                    horarios: { icon: Clock, title: 'Jornada escolar', description: 'Hora de entrada y salida, duración de cada clase y recesos. Se usa para armar tu horario y tus planeaciones.' },
                                    personal: { icon: Users, title: 'Personal: altas y bajas', description: 'Da de alta a docentes, directivos y demás personal, cambia su puesto o dales de baja cuando ya no trabajen en la escuela.' },
                                }
                                const h = H[activeTab]
                                return h ? <SettingsHeader icon={h.icon} title={h.title} description={h.description} /> : null
                            })()}
                            {/* PROFILE TAB */}
                            {activeTab === 'profile' && (
                                <div className="space-y-6">
                                    <SettingsCard icon={User} title="Tus datos" hint="Así apareces en tus planeaciones, listas y documentos.">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <WizardField label="Nombre(s)">
                                                <input aria-label="Nombre(s)" className={wizardInput} value={profile.first_name || ''}
                                                    onChange={(e) => setProfile({ ...profile, first_name: e.target.value.toUpperCase() })} />
                                            </WizardField>
                                            <WizardField label="Apellido paterno">
                                                <input aria-label="Apellido paterno" className={wizardInput} value={profile.last_name_paternal || ''}
                                                    onChange={(e) => setProfile({ ...profile, last_name_paternal: e.target.value.toUpperCase() })} />
                                            </WizardField>
                                            <WizardField label="Apellido materno">
                                                <input aria-label="Apellido materno" className={wizardInput} value={profile.last_name_maternal || ''}
                                                    onChange={(e) => setProfile({ ...profile, last_name_maternal: e.target.value.toUpperCase() })} />
                                            </WizardField>
                                            <WizardField label="Correo" hint="Con él entras a la app; no se puede cambiar aquí.">
                                                <input aria-label="Correo" type="email" disabled className={`${wizardInput} opacity-70 cursor-not-allowed`} value={profile.email || ''} />
                                            </WizardField>
                                        </div>
                                    </SettingsCard>

                                    <SettingsCard icon={Sparkles} title="Tu foto" hint="Elige una imagen para que tus alumnos y colegas te reconozcan.">
                                        <div className="flex flex-col sm:flex-row items-center gap-5">
                                            <img
                                                src={profile.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${profile.first_name}+${profile.last_name_paternal}`}
                                                alt="Tu foto actual"
                                                className="w-20 h-20 rounded-full bg-slate-50 border-4 border-white shadow object-cover"
                                            />
                                            <div className="flex flex-wrap justify-center sm:justify-start gap-3">
                                                {AVATARS.map(url => (
                                                    <button
                                                        key={url}
                                                        type="button"
                                                        aria-label="Usar esta foto"
                                                        aria-pressed={profile.avatar_url === url}
                                                        onClick={() => setProfile({ ...profile, avatar_url: url })}
                                                        className={`w-12 h-12 rounded-full overflow-hidden border-4 ${profile.avatar_url === url ? 'border-indigo-500 ring-4 ring-indigo-50' : 'border-white shadow-sm hover:border-indigo-200'}`}
                                                    >
                                                        <img src={url} className="w-full h-full" alt="" />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </SettingsCard>

                                    <TextSizeSetting />

                                    <SaveBar
                                        dirty={savedProfileKey !== null && savedProfileKey !== profileKey(profile)}
                                        saving={updating}
                                        onSave={handleUpdateProfile}
                                        onDiscard={() => { try { const [f, p, m, av] = JSON.parse(savedProfileKey || '[]'); setProfile(prev => ({ ...prev, first_name: f, last_name_paternal: p, last_name_maternal: m, avatar_url: av })) } catch { /* nada */ } }}
                                        what="cambios en tu perfil"
                                    />
                                </div>
                            )}

                            {activeTab === 'subjects' && (
                                <div className="space-y-6">
                                    {isEditingSubjects ? (
                                        <SettingsCard icon={Pencil} title="Elige las materias que impartes"
                                            hint="Toca las materias que das; puedes buscarlas por nombre. Si das Tecnología, elige tu especialidad."
                                            action={<SettingsActionButton icon={ArrowLeft} onClick={() => {
                                                setSelectedUserSubjects(JSON.parse(savedSubjectsKey)); setIsEditingSubjects(false)
                                            }}>Volver sin cambios</SettingsActionButton>}>
                                            <SubjectSelector
                                                educationalLevel={tenant.educational_level || 'SECONDARY'}
                                                selectedSubjects={selectedUserSubjects.reduce((acc: any, curr) => {
                                                    if (curr.catalogId) {
                                                        acc[curr.catalogId] = { selected: true, customDetail: curr.customDetail }
                                                    }
                                                    return acc
                                                }, {})}
                                                onChange={(newSubjects) => {
                                                    const list = Object.entries(newSubjects)
                                                        .filter(([_, val]) => val.selected)
                                                        .map(([key, val]) => ({
                                                            catalogId: key,
                                                            customDetail: val.customDetail
                                                        }))
                                                    setSelectedUserSubjects(list)
                                                }}
                                            />
                                        </SettingsCard>
                                    ) : (
                                        <SettingsCard icon={BookOpen} title="Materias que impartes"
                                            hint={<>El nivel educativo y el grado se cambian en <button type="button" onClick={() => setActiveTab('school')} className="font-bold text-indigo-700 underline">Datos de la escuela</button>.</>}
                                            action={<SettingsActionButton icon={Pencil} onClick={() => setIsEditingSubjects(true)}>{selectedUserSubjects.length ? 'Agregar o cambiar' : 'Agregar materias'}</SettingsActionButton>}>
                                            {selectedUserSubjects.length === 0 ? (
                                                <p className="text-sm text-slate-500 text-center py-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                                                    Aún no registras materias. Usa “Agregar materias” para empezar a planear.
                                                </p>
                                            ) : (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
{selectedUserSubjects.map((subject, index) => {
                                                            const baseName = catalogNames[subject.catalogId || ''] || 'Materia';
                                                            const subjectName = formatSubjectName(baseName, subject.customDetail);
                                                            const needsSpecialty = /tecnolog/i.test(baseName) && !subject.customDetail;
                                                            return (
                                                                <div key={index} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex justify-between items-start group relative overflow-hidden">
                                                                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 rounded-l-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                    <div>
                                                                        <h4 className="font-bold text-gray-900 text-sm mb-1 line-clamp-2">{subjectName}</h4>
                                                                        {needsSpecialty && (
                                                                            <button type="button" onClick={() => setIsEditingSubjects(true)} className="mt-1 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg text-left">
                                                                                Falta tu especialidad (ej. Informática). Toca para agregarla.
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    <button
                                                                        onClick={async () => {
                                                                            if ((await askConfirm(`¿Estás seguro de quitar ${subjectName}?`))) {
                                                                                const newList = selectedUserSubjects.filter((_, i) => i !== index);
                                                                                setSelectedUserSubjects(newList);
                                                                                setUpdating(true);
                                                                                try {
                                                                                    const { error: deleteError } = await supabase.from('profile_subjects').delete().eq('profile_id', profile.id).eq('tenant_id', tenant.id)
                                                                                    if (deleteError) throw deleteError

                                                                                    const subjectsToInsert = newList.map(s => ({
                                                                                        profile_id: profile.id,
                                                                                        tenant_id: tenant.id,
                                                                                        subject_catalog_id: s.catalogId,
                                                                                        custom_detail: s.customDetail || null
                                                                                    }))

                                                                                    if (subjectsToInsert.length > 0) {
                                                                                        const { error: insertError } = await supabase.from('profile_subjects').insert(subjectsToInsert)
                                                                                        if (insertError) throw insertError
                                                                                    }
                                                                                    queryClient.invalidateQueries({ queryKey: ['teacher-scope'] })
                                                                                    setSavedSubjectsKey(JSON.stringify(newList));
                                                                                    showSuccess('Materia eliminada');
                                                                                } catch (e) {
                                                                                    console.error(e);
                                                                                    alert('Error al eliminar');
                                                                                    loadData();
                                                                                } finally {
                                                                                    setUpdating(false);
                                                                                }
                                                                            }
                                                                        }}
                                                                        className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-xl transition-all"
                                                                        title="Quitar materia"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}
                                                </div>
                                            )}
                                        </SettingsCard>
                                    )}
                                    <SaveBar
                                        dirty={savedSubjectsKey !== JSON.stringify(selectedUserSubjects)}
                                        saving={updating}
                                        onSave={handleUpdateSubjects}
                                        onDiscard={() => { setSelectedUserSubjects(JSON.parse(savedSubjectsKey)); setIsEditingSubjects(false) }}
                                        what="cambios en tus materias"
                                    />
                                </div>
                            )}



                            {activeTab === 'school' && (
                                <SchoolDataSection readOnly={!isDirectorOrAdmin} />
                            )}

                            {activeTab === 'horarios' && (
                                <div className="space-y-6">
                                    <ScheduleConfig />
                                    {/* Todos lo ven; solo dirección/coordinación o el docente independiente lo modifican */}
                                    <SpecialScheduleManager readOnly={!['DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'ACADEMIC_COORD', 'TECH_COORD', 'INDEPENDENT_TEACHER'].includes(currentRole)} />
                                </div>
                            )}



                            {
                                activeTab === 'cycle' && (
                                    <div className="space-y-6">
                                        <AcademicYearManager readOnly={!isDirectorOrAdmin} />
                                        <PeriodManager readOnly={!isDirectorOrAdmin} />
                                    </div>
                                )
                            }

                            {/* PERSONAL TAB */}
                            {
                                activeTab === 'personal' && (
                                    <StaffManager />
                                )
                            }




                            {/* BILLING TAB */}
                            {
                                activeTab === 'billing' && profile.role?.toUpperCase() !== 'TUTOR' && (
                                    <BillingSection />
                                )
                            }

                            {activeTab === 'avisos' && <NotificationSettings />}

                            {/* SECURITY TAB */}
                            {activeTab === 'security' && (
                                <SecuritySettings
                                    profile={profile}
                                    tenant={tenant}
                                    isDirectorOrAdmin={isDirectorOrAdmin}
                                />
                            )}

                        </div>
                    </div>
                </main >
            </div >
        </div >
    )
}
