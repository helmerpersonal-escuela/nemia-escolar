import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { exportUserData } from '../../../utils/backupUtils'
import { User, School, Lock, Save, BookOpen, Sparkles, Database, Copy, Trash2, AlertCircle, Calendar, Users, Clock, Plus, DownloadCloud, Shield, CreditCard } from 'lucide-react'
import { StaffManager } from '../components/StaffManager'
import { PeriodManager } from '../../evaluation/components/PeriodManager'
import { ScheduleConfig } from '../components/ScheduleConfig'
import { SpecialScheduleManager } from '../components/SpecialScheduleManager'
import { ImageUpload } from '../../../components/common/ImageUpload'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import { SecuritySettings } from '../components/SecuritySettings'
import L from 'leaflet'
import { BillingSection } from '../components/BillingSection'
import { useLocation } from 'react-router-dom'

// Leaflet Icons Fix
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
    const initialTab = (searchParams.get('tab') as any) || 'profile'

    const [loading, setLoading] = useState(true)
    const [updating, setUpdating] = useState(false)
    const [activeTab, setActiveTab] = useState<'profile' | 'school' | 'subjects' | 'periods' | 'horarios' | 'personal' | 'security' | 'ai' | 'billing'>(initialTab)
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
    useEffect(() => {
        if (profile.role?.toUpperCase() === 'INDEPENDENT_TEACHER' && ['horarios', 'personal'].includes(activeTab)) {
            setActiveTab('profile')
        }
    }, [profile.role, activeTab])

    const isDirectorOrAdmin = ['DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'INDEPENDENT_TEACHER', 'ACADEMIC_COORD', 'TECH_COORD'].includes(profile?.role?.toUpperCase() || '')
    const isAcademicCoord = profile?.role?.toUpperCase() === 'ACADEMIC_COORD'
    const isSuperAdmin = profile?.role?.toUpperCase() === 'SUPER_ADMIN'
    const isStaffReadOnly = !isDirectorOrAdmin

    const [tenant, setTenant] = useState({
        id: '',
        name: '',
        cct: '',
        phone: '',
        address: '',
        educational_level: 'PRIMARY',
        location_lat: 19.4326,
        location_lng: -99.1332,
        ai_config: { apiKey: '' },
        cte_config: { next_date: '', link: '' },
        logo_left_url: '',
        logo_right_url: ''
    })

    const [selectedUserSubjects, setSelectedUserSubjects] = useState<{ catalogId: string | null, customDetail: string }[]>([])
    const [aiSettings, setAiSettings] = useState({ apiKey: '' })

    const [showAddSubject, setShowAddSubject] = useState(false)
    const [catalogNames, setCatalogNames] = useState<Record<string, string>>({})
    const [catalogItems, setCatalogItems] = useState<any[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [showMigrationModal, setShowMigrationModal] = useState(false)
    const [migrationSql, setMigrationSql] = useState('')

    useEffect(() => {
        loadData()

        // Handle redirection for expired trials
        if (location.state?.trialExpired) {
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
                    setProfile({
                        ...profileData,
                        role: ptData?.role || profileData.role || '',
                        first_name: (ptData?.first_name || profileData.first_name || '').toUpperCase(),
                        last_name_paternal: (ptData?.last_name_paternal || profileData.last_name_paternal || '').toUpperCase(),
                        last_name_maternal: (ptData?.last_name_maternal || profileData.last_name_maternal || '').toUpperCase(),
                        avatar_url: ptData?.avatar_url || profileData.avatar_url || '',
                        email: user.email || ''
                    })
                } else {
                    setProfile({
                        ...profileData,
                        first_name: (profileData.first_name || '').toUpperCase(),
                        last_name_paternal: (profileData.last_name_paternal || '').toUpperCase(),
                        last_name_maternal: (profileData.last_name_maternal || '').toUpperCase(),
                        avatar_url: profileData.avatar_url || '',
                        email: user.email || ''
                    })
                }

                const effectiveRole = (workspaceRole || profileData.role || '').toUpperCase()

                if (profileData.tenant_id) {
                    const { data: tenantData } = await supabase
                        .from('tenants')
                        .select('*, ai_config')
                        .eq('id', profileData.tenant_id)
                        .single()

                    if (tenantData) {
                        setTenant({
                            id: tenantData.id,
                            name: (tenantData.name || '').toUpperCase(),
                            cct: (tenantData.cct || '').toUpperCase(),
                            phone: (tenantData.phone || '').toUpperCase(),
                            address: (tenantData.address || '').toUpperCase(),
                            educational_level: tenantData.educational_level || 'PRIMARY',
                            location_lat: tenantData.location_lat || 19.4326,
                            location_lng: tenantData.location_lng || -99.1332,
                            ai_config: tenantData.ai_config || { apiKey: '' },
                            cte_config: { next_date: '', link: '' }, // Loaded shortly after
                            logo_left_url: tenantData.logo_left_url || '',
                            logo_right_url: tenantData.logo_right_url || ''
                        })
                        if (tenantData.ai_config?.apiKey) {
                            setAiSettings({ apiKey: tenantData.ai_config.apiKey })
                        }

                        // Fetch School Details (for technologies/workshops) - ONLY if role is relevant
                        let schoolDetails = null
                        if (['TEACHER', 'DIRECTOR', 'ACADEMIC_COORD', 'TECH_COORD', 'INDEPENDENT_TEACHER'].includes(effectiveRole)) {
                            const { data } = await supabase
                                .from('school_details')
                                .select('workshops, cte_config')
                                .eq('tenant_id', tenantData.id)
                                .maybeSingle()
                            schoolDetails = data

                            if (data?.cte_config) {
                                setTenant(prev => ({ ...prev, cte_config: data.cte_config }))
                            }
                        }

                        // 3. Get Catalog Names (for display)
                        const { data: catalogData } = await supabase.from('subject_catalog').select('id, name, educational_level')
                        if (catalogData) {
                            let mergedCatalog = [...(catalogData || [])]

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
                    }
                }

                // 4. Get Subjects - ONLY for teaching roles
                if (['TEACHER', 'DIRECTOR', 'ACADEMIC_COORD', 'TECH_COORD', 'INDEPENDENT_TEACHER'].includes(effectiveRole)) {
                    const { data: subjectData } = await supabase
                        .from('profile_subjects')
                        .select('subject_catalog_id, custom_detail')
                        .eq('profile_id', user.id)

                    if (subjectData) {
                        const mapped = subjectData.map((curr: any) => ({
                            catalogId: curr.subject_catalog_id,
                            customDetail: (curr.custom_detail || '').toUpperCase()
                        }))
                        setSelectedUserSubjects(mapped)
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
            }
        } else {
            showSuccess('Perfil actualizado para este espacio')
            // Refresh logic to ensure hooks pick up new data
            loadData()
        }

        setUpdating(false)
    }

    const handleUpdateTenant = async () => {
        setUpdating(true)
        try {
            // 1. Update Tenants table
            const { error: tenantError } = await supabase.from('tenants').update({
                name: tenant.name.toUpperCase(),
                phone: tenant.phone.toUpperCase(),
                address: tenant.address.toUpperCase(),
                cct: tenant.cct.toUpperCase(),
                location_lat: tenant.location_lat,
                location_lng: tenant.location_lng,
                educational_level: tenant.educational_level,
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
            const { error: deleteError } = await supabase.from('profile_subjects').delete().eq('profile_id', profile.id)
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

            showSuccess('Materias actualizadas correctamente')
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
            ai_config: { apiKey: aiSettings.apiKey }
        }).eq('id', tenant.id)

        if (!error) {
            showSuccess('Configuración de IA guardada')
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
                                <Database className="w-6 h-6 text-amber-600" />
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
            <div className="mb-8">
                <h1 className="text-3xl font-black text-gray-900 tracking-tight">Configuración</h1>
                <p className="text-gray-500 font-medium">Gestiona tu perfil personal, la información de la escuela y preferencias del sistema.</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Vertical Sidebar Navigation */}
                {/* Vertical Sidebar Navigation */}
                <aside className="lg:w-72 flex-shrink-0">
                    <div className="bg-white p-3 rounded-[2.5rem] border border-gray-100 shadow-sm sticky top-24 space-y-8">
                        {/* PERSONAL SECTION */}
                        <div>
                            <h4 className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Personal</h4>
                            <nav className="space-y-1">
                                {[
                                    { id: 'profile', label: 'Mi Perfil', icon: User, color: 'text-blue-600', bg: 'bg-blue-50' },
                                    // Hide subjects for roles that don't teach. 
                                    // includes check is case-sensitive, ensure consistency.
                                    ...(['TEACHER', 'DIRECTOR', 'ACADEMIC_COORD', 'TECH_COORD', 'INDEPENDENT_TEACHER'].includes(profile.role?.toUpperCase()) ? [
                                        { id: 'subjects', label: 'Mis Materias', icon: BookOpen, color: 'text-purple-600', bg: 'bg-purple-50' }
                                    ] : []),
                                    { id: 'security', label: 'Seguridad', icon: Lock, color: 'text-gray-600', bg: 'bg-gray-100' },
                                    { id: 'billing', label: 'Plan y Facturación', icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50' },
                                ].map((item: any) => {
                                    const isActive = activeTab === item.id;
                                    const Icon = item.icon;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => setActiveTab(item.id as any)}
                                            className={`
                                                w-full flex items-center px-4 py-3 text-sm font-bold rounded-2xl transition-all duration-200 group
                                                ${isActive ? `${item.bg} ${item.color} shadow-sm shadow-black/5` : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}
                                            `}
                                        >
                                            <Icon className={`w-4 h-4 mr-3 transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </nav>
                        </div>

                        {/* INSTITUTIONAL SECTION (DIRECTOR/ADMIN ONLY) */}
                        {isDirectorOrAdmin && (
                            <div>
                                <h4 className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Institucional</h4>
                                <nav className="space-y-1">
                                    {[
                                        { id: 'school', label: 'Datos Escuela', icon: School, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                        ...(['INDEPENDENT_TEACHER'].includes(profile.role?.toUpperCase()) ? [] : [
                                            { id: 'horarios', label: 'Jornada y Horarios', icon: Clock, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                                        ]),
                                        { id: 'periods', label: 'Periodos Escolares', icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50' },
                                    ].map((item: any) => {
                                        const isActive = activeTab === item.id;
                                        const Icon = item.icon;
                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => setActiveTab(item.id as any)}
                                                className={`
                                                    w-full flex items-center px-4 py-3 text-sm font-bold rounded-2xl transition-all duration-200 group
                                                    ${isActive ? `${item.bg} ${item.color} shadow-sm shadow-black/5` : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}
                                                `}
                                            >
                                                <Icon className={`w-4 h-4 mr-3 transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                                                {item.label}
                                            </button>
                                        );
                                    })}
                                </nav>
                            </div>
                        )}

                        {/* ADMINISTRATION SECTION */}
                        {(isDirectorOrAdmin || isSuperAdmin) && (
                            <div>
                                <h4 className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Gestión</h4>
                                <nav className="space-y-1">
                                    {[
                                        ...(['INDEPENDENT_TEACHER'].includes(profile.role?.toUpperCase()) ? [] : [
                                            { id: 'personal', label: 'Plantilla Docente', icon: Users, color: 'text-rose-600', bg: 'bg-rose-50', adminOnly: true },
                                        ]),
                                        { id: 'ai', label: 'Configuración IA', icon: Sparkles, color: 'text-indigo-600', bg: 'bg-indigo-50', superOnly: true },
                                    ].map((item: any) => {
                                        if (item.adminOnly && !isDirectorOrAdmin) return null;
                                        if (item.superOnly && !isSuperAdmin) return null;
                                        const isActive = activeTab === item.id;
                                        const Icon = item.icon;
                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => setActiveTab(item.id as any)}
                                                className={`
                                                    w-full flex items-center px-4 py-3 text-sm font-bold rounded-2xl transition-all duration-200 group
                                                    ${isActive ? `${item.bg} ${item.color} shadow-sm shadow-black/5` : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}
                                                `}
                                            >
                                                <Icon className={`w-4 h-4 mr-3 transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                                                {item.label}
                                            </button>
                                        );
                                    })}
                                </nav>
                            </div>
                        )}

                        {/* Danger Zone */}
                        {(isDirectorOrAdmin || isSuperAdmin) && (
                            <div className="pt-4 border-t border-gray-50 px-4">
                                <button
                                    onClick={() => setActiveTab('security')}
                                    className="w-full text-[10px] font-black text-rose-400 hover:text-rose-600 transition-colors uppercase tracking-[0.15em] flex items-center"
                                >
                                    <Trash2 className="w-3 h-3 mr-2" />
                                    Eliminar Cuenta
                                </button>
                            </div>
                        )}
                    </div>
                </aside>

                {/* Content Area */}
                <main className="flex-1 min-w-0">
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden min-h-[600px]">

                        <div className="p-8 lg:p-12 animate-in fade-in slide-in-from-right-4 duration-500">
                            {/* PROFILE TAB */}
                            {activeTab === 'profile' && (
                                <div className="space-y-6">
                                    <div className="mb-10 flex flex-col md:flex-row items-center gap-8 bg-gray-50 p-8 rounded-3xl border border-gray-100">
                                        <div className="relative group">
                                            <img
                                                src={profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.first_name}+${profile.last_name_paternal}`}
                                                alt="Avatar"
                                                className="w-32 h-32 rounded-full bg-white shadow-xl border-4 border-white object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                            <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white p-2 rounded-xl shadow-lg">
                                                <Sparkles className="w-4 h-4" />
                                            </div>
                                        </div>
                                        <div className="flex-1 text-center md:text-left">
                                            <h3 className="text-xl font-black text-gray-900 tracking-tight">Tu Identidad</h3>
                                            <p className="text-sm text-gray-500 font-medium mb-4">Personaliza tu avatar para ser reconocido por tus alumnos y colegas.</p>
                                            <div className="flex flex-wrap justify-center md:justify-start gap-4">
                                                {AVATARS.map(url => (
                                                    <button
                                                        key={url}
                                                        onClick={() => setProfile({ ...profile, avatar_url: url })}
                                                        className={`w-10 h-10 rounded-full overflow-hidden border-4 transition-all hover:scale-110 ${profile.avatar_url === url ? 'border-blue-500 shadow-md ring-4 ring-blue-50' : 'border-white shadow-sm hover:border-blue-200'}`}
                                                    >
                                                        <img src={url} className="w-full h-full" alt="avatar option" />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Nombre(s)</label>
                                            <input
                                                type="text"
                                                value={profile.first_name || ''}
                                                onChange={(e) => setProfile({ ...profile, first_name: e.target.value.toUpperCase() })}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Apellido Paterno</label>
                                            <input
                                                type="text"
                                                value={profile.last_name_paternal || ''}
                                                onChange={(e) => setProfile({ ...profile, last_name_paternal: e.target.value.toUpperCase() })}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Apellido Materno</label>
                                            <input
                                                type="text"
                                                value={profile.last_name_maternal || ''}
                                                onChange={(e) => setProfile({ ...profile, last_name_maternal: e.target.value.toUpperCase() })}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Correo Electrónico</label>
                                            <input
                                                type="email"
                                                disabled
                                                value={profile.email || ''}
                                                className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-gray-500 font-bold focus:ring-0 cursor-not-allowed"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-end pt-8 border-t border-gray-100">
                                        <button
                                            onClick={handleUpdateProfile}
                                            disabled={updating}
                                            className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-gray-200 disabled:opacity-50 flex items-center"
                                        >
                                            <Save className="w-4 h-4 mr-2" />
                                            {updating ? 'Guardando...' : 'Actualizar Perfil'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'school' && (
                                <div className="space-y-12">
                                    <div className="flex flex-col md:flex-row justify-between items-start gap-4 border-b border-gray-100 pb-6">
                                        <div>
                                            <h3 className="text-2xl font-black text-gray-900 tracking-tight">Datos de la Escuela</h3>
                                            <p className="text-sm text-gray-500 font-medium">Información oficial y ubicación geográfica de tu institución.</p>
                                        </div>
                                        {isDirectorOrAdmin && (
                                            <button
                                                onClick={handleUpdateTenant}
                                                disabled={updating}
                                                className="px-6 py-3 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-gray-200 disabled:opacity-50 flex items-center"
                                            >
                                                <Save className="w-4 h-4 mr-2" />
                                                {updating ? 'Guardando...' : 'Guardar Cambios'}
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Nombre Oficial</label>
                                            <div className="relative group">
                                                <School className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                                <input
                                                    type="text"
                                                    value={tenant.name}
                                                    onChange={(e) => setTenant({ ...tenant, name: e.target.value })}
                                                    className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-transparent rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                                                    placeholder="Ej. Escuela Secundaria Técnica #45"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Clave de Centro de Trabajo (CCT)</label>
                                            <div className="relative group">
                                                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors font-black text-[10px]">CCT</div>
                                                <input
                                                    type="text"
                                                    value={tenant.cct || ''}
                                                    onChange={(e) => setTenant({ ...tenant, cct: e.target.value })}
                                                    className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-transparent rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:border-blue-500 transition-all outline-none uppercase"
                                                    placeholder="Ej. 14DST0045J"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* CTE CONFIGURATION */}
                                    <div className="pt-6 border-t border-gray-100 mt-6">
                                        <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
                                            <Clock className="w-4 h-4 mr-2 text-blue-500" />
                                            Configuración de Consejo Técnico
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Próxima Fecha</label>
                                                <input
                                                    type="date"
                                                    value={tenant.cte_config?.next_date || ''}
                                                    onChange={(e) => setTenant({
                                                        ...tenant,
                                                        cte_config: { ...tenant.cte_config, next_date: e.target.value }
                                                    })}
                                                    className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                                                />
                                                <p className="text-[10px] text-gray-400 mt-1 ml-1">Dejar vacío para cálculo automático (último viernes).</p>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Enlace a Orden del Día</label>
                                                <input
                                                    type="url"
                                                    value={tenant.cte_config?.link || ''}
                                                    onChange={(e) => setTenant({
                                                        ...tenant,
                                                        cte_config: { ...tenant.cte_config, link: e.target.value }
                                                    })}
                                                    className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:border-blue-500 transition-all outline-none"
                                                    placeholder="https://drive.google.com/..."
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Teléfono Institucional</label>
                                            <input
                                                type="text"
                                                disabled={isStaffReadOnly}
                                                value={tenant.phone || ''}
                                                onChange={(e) => setTenant({ ...tenant, phone: e.target.value.toUpperCase() })}
                                                className={`w-full px-5 py-3.5 bg-gray-50 border border-transparent rounded-2xl text-gray-900 font-bold focus:bg-white focus:border-blue-500 transition-all outline-none ${isStaffReadOnly ? 'cursor-not-allowed text-gray-500' : ''}`}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Nivel Educativo</label>
                                            <select
                                                disabled={isStaffReadOnly}
                                                value={tenant.educational_level || ''}
                                                onChange={(e) => setTenant({ ...tenant, educational_level: e.target.value })}
                                                className={`w-full px-5 py-3.5 bg-gray-50 border border-transparent rounded-2xl text-gray-900 font-bold focus:bg-white focus:border-blue-500 transition-all outline-none ${isStaffReadOnly ? 'cursor-not-allowed text-gray-500 appearance-none' : ''}`}
                                            >
                                                <option value="PRESCHOOL">Preescolar</option>
                                                <option value="PRIMARY">Primaria</option>
                                                <option value="SECONDARY">Secundaria</option>
                                                <option value="HIGH_SCHOOL">Bachillerato</option>
                                                <option value="UNIVERSITY">Universidad</option>
                                            </select>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Dirección Completa</label>
                                            <input
                                                type="text"
                                                disabled={isStaffReadOnly}
                                                value={tenant.address || ''}
                                                onChange={(e) => setTenant({ ...tenant, address: e.target.value.toUpperCase() })}
                                                className={`w-full px-5 py-3.5 bg-gray-50 border border-transparent rounded-2xl text-gray-900 font-bold focus:bg-white focus:border-blue-500 transition-all outline-none ${isStaffReadOnly ? 'cursor-not-allowed text-gray-500' : ''}`}
                                            />
                                        </div>

                                        <div className="col-span-2 space-y-4">
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Geolocalización</label>
                                            <div className="h-[350px] rounded-[2rem] overflow-hidden border border-gray-100 shadow-inner group relative">
                                                <MapContainer
                                                    center={[tenant.location_lat || 19.43, tenant.location_lng || -99.13]}
                                                    zoom={13}
                                                    style={{ height: '100%', width: '100%' }}
                                                >
                                                    <TileLayer
                                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                                    />
                                                    <LocationMarker
                                                        position={{ lat: tenant.location_lat, lng: tenant.location_lng }}
                                                        setPosition={(pos) => setTenant(prev => ({ ...prev, location_lat: pos.lat, location_lng: pos.lng }))}
                                                    />
                                                </MapContainer>
                                                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-4 py-2 rounded-xl text-[10px] font-black uppercase text-gray-500 border border-white/50 shadow-lg pointer-events-none">
                                                    Haz clic para actualizar
                                                </div>
                                            </div>
                                        </div>

                                        <div className="col-span-2 border-t border-gray-50 pt-10">
                                            <h4 className="text-sm font-black text-gray-900 mb-6 flex items-center uppercase tracking-widest">
                                                <Sparkles className="w-5 h-5 mr-3 text-blue-500" />
                                                Identidad Visual en Documentos
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                                                    <ImageUpload
                                                        label="Escudo Oficial"
                                                        currentUrl={tenant.logo_left_url}
                                                        onUpload={(url) => setTenant(prev => ({ ...prev, logo_left_url: url }))}
                                                        bucket="school-assets"
                                                    />
                                                    <p className="text-[10px] font-medium text-gray-400 mt-4 leading-relaxed italic">
                                                        Se utilizará para encabezados oficiales (ej. SEP o Secretaría Estatal).
                                                    </p>
                                                </div>
                                                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                                                    <ImageUpload
                                                        label="Logo Institucional"
                                                        currentUrl={tenant.logo_right_url}
                                                        onUpload={(url) => setTenant(prev => ({ ...prev, logo_right_url: url }))}
                                                        bucket="school-assets"
                                                    />
                                                    <p className="text-[10px] font-medium text-gray-400 mt-4 leading-relaxed italic">
                                                        Logotipo propio de la escuela para boletas y reportes.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* HORARIOS TAB */}
                            {activeTab === 'horarios' && (
                                <div className="space-y-16">
                                    <ScheduleConfig />
                                    <div className="pt-16 border-t border-gray-100">
                                        <SpecialScheduleManager />
                                    </div>
                                </div>
                            )}

                            {/* SUBJECTS TAB */}
                            {activeTab === 'subjects' && (
                                <div className="space-y-6">
                                    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-8">
                                        <div className="flex flex-col md:flex-row justify-between items-start gap-4 border-b border-gray-100 pb-6 mb-4">
                                            <div>
                                                <h3 className="text-2xl font-black text-gray-900 tracking-tight">Mis Materias</h3>
                                                <p className="text-sm text-gray-500 font-medium tracking-tight">Selecciona las asignaturas que impartes para personalizar tu experiencia.</p>
                                            </div>
                                            {isDirectorOrAdmin && (
                                                <button
                                                    onClick={() => setShowAddSubject(!showAddSubject)}
                                                    className={`flex items-center px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${showAddSubject ? 'bg-gray-100 text-gray-600' : 'bg-blue-600 text-white shadow-xl shadow-blue-100 hover:bg-blue-700'}`}
                                                >
                                                    {showAddSubject ? 'Ocultar Catálogo' : '+ Agregar Materia'}
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {selectedUserSubjects.length === 0 ? (
                                                <div className="col-span-full text-center py-20 bg-gray-50 rounded-[2rem] border-2 border-dashed border-gray-200">
                                                    <div className="bg-white p-4 rounded-2xl shadow-sm inline-block mb-4">
                                                        <BookOpen className="w-10 h-10 text-blue-200" />
                                                    </div>
                                                    <p className="text-gray-400 font-bold tracking-tight">No has seleccionado materias aún.</p>
                                                    <button
                                                        onClick={() => setShowAddSubject(true)}
                                                        className="mt-4 text-blue-600 font-black text-xs uppercase underline tracking-widest"
                                                    >
                                                        Abrir catálogo ahora
                                                    </button>
                                                </div>
                                            ) : (
                                                selectedUserSubjects.map((s, index) => (
                                                    <div key={index} className="flex items-center justify-between p-6 bg-white rounded-3xl border border-gray-100 group transition-all hover:shadow-xl hover:shadow-gray-100 hover:border-blue-100 relative overflow-hidden">
                                                        <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-100 group-hover:bg-blue-500 transition-colors" />
                                                        <div className="flex-1 ml-2">
                                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Asignatura</span>
                                                            <span className="text-sm font-black text-gray-900 group-hover:text-blue-600 transition-colors">
                                                                {catalogNames[s.catalogId || ''] || 'Personalizada'}
                                                            </span>
                                                            {(s.catalogId === null || catalogNames[s.catalogId || ''] === 'Tecnología' || catalogNames[s.catalogId || ''] === 'OTRA MATERIA') && (
                                                                <div className="mt-3">
                                                                    <input
                                                                        type="text"
                                                                        disabled={isStaffReadOnly}
                                                                        placeholder="Ej: Robótica, Inglés Técnico..."
                                                                        value={s.customDetail}
                                                                        onChange={(e) => {
                                                                            const newList = [...selectedUserSubjects]
                                                                            newList[index] = { ...newList[index], customDetail: e.target.value.toUpperCase() }
                                                                            setSelectedUserSubjects(newList)
                                                                        }}
                                                                        className={`w-full text-xs font-bold p-3 bg-gray-50 border-transparent rounded-xl focus:bg-white focus:ring-0 focus:border-blue-200 tracking-tight ${isStaffReadOnly ? 'cursor-not-allowed' : ''}`}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                        {isDirectorOrAdmin && (
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedUserSubjects(selectedUserSubjects.filter((_, i) => i !== index))
                                                                }}
                                                                className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        {showAddSubject && (
                                            <div className="mt-8 pt-8 border-t border-gray-100 animate-in slide-in-from-top-4 duration-300">
                                                <div className="mb-4">
                                                    <input
                                                        type="text"
                                                        placeholder="Buscar materia en el catálogo..."
                                                        value={searchTerm}
                                                        onChange={(e) => setSearchTerm(e.target.value)}
                                                        className="w-full px-5 py-4 bg-gray-50 border border-transparent rounded-[1.25rem] text-sm font-bold text-gray-900 focus:bg-white focus:border-blue-500 transition-all outline-none shadow-sm"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                                                    {catalogItems
                                                        .filter(item => {
                                                            const itemLevel = item.educational_level ? item.educational_level.toUpperCase() : '';
                                                            const schoolLevel = tenant.educational_level ? tenant.educational_level.toUpperCase() : 'PRIMARY';
                                                            const matchesLevel = itemLevel === schoolLevel || itemLevel === 'BOTH' || itemLevel === 'TODOS';
                                                            const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
                                                            return matchesLevel && matchesSearch;
                                                        })
                                                        .length === 0 ? (
                                                        <div className="col-span-full p-12 text-center bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-100">
                                                            <div className="p-3 bg-white rounded-full shadow-sm inline-block mb-3">
                                                                <AlertCircle className="w-8 h-8 text-gray-200" />
                                                            </div>
                                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-relaxed">
                                                                No se encontraron materias para el nivel<br />
                                                                <span className="text-blue-500">{tenant.educational_level || 'tu escuela'}</span>
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        catalogItems
                                                            .filter(item => {
                                                                const itemLevel = item.educational_level ? item.educational_level.toUpperCase() : '';
                                                                const schoolLevel = tenant.educational_level ? tenant.educational_level.toUpperCase() : 'PRIMARY';
                                                                const matchesLevel = itemLevel === schoolLevel || itemLevel === 'BOTH' || itemLevel === 'TODOS';
                                                                const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
                                                                return matchesLevel && matchesSearch;
                                                            })
                                                            .map(item => (
                                                                <button
                                                                    key={item.id}
                                                                    onClick={() => {
                                                                        if (!selectedUserSubjects.some(prev => prev.catalogId === item.id)) {
                                                                            setSelectedUserSubjects([...selectedUserSubjects, { catalogId: item.id, customDetail: '' }])
                                                                        }
                                                                        setSearchTerm('')
                                                                    }}
                                                                    className="group text-left p-4 rounded-2xl border border-gray-100 hover:bg-blue-50 hover:border-blue-200 transition-all relative overflow-hidden"
                                                                >
                                                                    <div className="absolute top-0 right-0 w-8 h-8 bg-blue-100/50 rounded-bl-full -mr-4 -mt-4 group-hover:scale-150 transition-transform" />
                                                                    <span className="text-sm font-black text-gray-700 group-hover:text-blue-600 transition-colors relative z-10">
                                                                        {item.name}
                                                                    </span>
                                                                    <span className="block text-[8px] font-black text-gray-300 uppercase tracking-widest mt-1 relative z-10">
                                                                        {item.is_technology ? 'Tecnología de la Escuela' : 'Catálogo Oficial'}
                                                                    </span>
                                                                </button>
                                                            ))
                                                    )
                                                    }
                                                    <button
                                                        onClick={() => {
                                                            setSelectedUserSubjects([...selectedUserSubjects, { catalogId: null, customDetail: '' }])
                                                            setSearchTerm('')
                                                        }}
                                                        className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-gray-200 hover:bg-gray-50 hover:border-gray-400 transition-all text-gray-400 group"
                                                    >
                                                        <Plus className="w-4 h-4 mb-1 group-hover:scale-110 transition-transform" />
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-center">Otra materia<br />del docente</span>
                                                    </button>

                                                    {isDirectorOrAdmin && (
                                                        <button
                                                            onClick={async () => {
                                                                const name = prompt('Nombre de la nueva materia personalizada (se agregará a tu catálogo):')?.toUpperCase();
                                                                if (name && tenant.id) {
                                                                    setUpdating(true);
                                                                    try {
                                                                        // 1. Fetch current school_details to get existing workshops
                                                                        const { data: currentDetails, error: fetchError } = await supabase
                                                                            .from('school_details')
                                                                            .select('workshops')
                                                                            .eq('tenant_id', tenant.id)
                                                                            .single();

                                                                        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

                                                                        const currentWorkshops = currentDetails?.workshops || [];

                                                                        if (currentWorkshops.includes(name)) {
                                                                            alert('Esta materia ya existe en tu catálogo.');
                                                                            setUpdating(false);
                                                                            return;
                                                                        }

                                                                        const newWorkshops = [...currentWorkshops, name];

                                                                        // 2. Upsert school_details
                                                                        const { error: updateError } = await supabase
                                                                            .from('school_details')
                                                                            .upsert({
                                                                                tenant_id: tenant.id,
                                                                                workshops: newWorkshops,
                                                                                official_name: tenant.name,
                                                                                cct: tenant.cct || 'PARTICULAR'
                                                                            }, { onConflict: 'tenant_id' });

                                                                        if (updateError) throw updateError;

                                                                        showSuccess('Materia agregada al catálogo de tu escuela');

                                                                        // 3. Refresh Catalog locally
                                                                        const newId = `tech-${newWorkshops.length - 1}`;
                                                                        const newItem = {
                                                                            id: newId,
                                                                            name: name,
                                                                            educational_level: 'SECONDARY',
                                                                            is_technology: true
                                                                        };

                                                                        setCatalogItems([...catalogItems, newItem]);
                                                                        setCatalogNames({ ...catalogNames, [newId]: name });

                                                                        if (confirm('¿Deseas agregar esta materia a tu carga académica ahora?')) {
                                                                            setSelectedUserSubjects([...selectedUserSubjects, { catalogId: newId, customDetail: '' }]);
                                                                        }

                                                                    } catch (err: any) {
                                                                        console.error(err);
                                                                        alert('Error al crear la materia: ' + err.message);
                                                                    } finally {
                                                                        setUpdating(false);
                                                                    }
                                                                }
                                                            }}
                                                            className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-blue-100 bg-blue-50/30 hover:bg-blue-50 hover:border-blue-300 transition-all text-blue-500 group"
                                                        >
                                                            <Sparkles className="w-4 h-4 mb-1 group-hover:rotate-12 transition-transform" />
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-center">Crear materia<br />propia</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {isDirectorOrAdmin && (
                                        <div className="flex justify-end pt-4">
                                            <button
                                                onClick={handleUpdateSubjects}
                                                disabled={updating}
                                                className="flex items-center px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 disabled:opacity-50"
                                            >
                                                <Save className="w-4 h-4 mr-2" />
                                                {updating ? 'Guardando...' : 'Guardar Cambios en Materias'}
                                            </button>
                                        </div>
                                    )}
                                    {isStaffReadOnly && (
                                        <div className="mt-8 bg-amber-50 p-6 rounded-3xl border border-amber-100 flex items-start">
                                            <AlertCircle className="w-5 h-5 text-amber-600 mr-4 mt-1" />
                                            <p className="text-xs font-bold text-amber-800 leading-relaxed uppercase tracking-wider">
                                                La asignación de materias es gestionada por la dirección. Por favor, contacta con tu administrador si requieres cambios.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'periods' && (
                                <div className="space-y-12">
                                    <div className="flex flex-col md:flex-row justify-between items-start gap-4 border-b border-gray-100 pb-6">
                                        <div>
                                            <h3 className="text-2xl font-black text-gray-900 tracking-tight">Periodos de Evaluación</h3>
                                            <p className="text-sm text-gray-500 font-medium">Configura los trimestres y fechas clave del ciclo escolar.</p>
                                        </div>
                                    </div>

                                    <div className="bg-indigo-50/50 p-8 rounded-[2rem] border border-indigo-100/50 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-8 opacity-10">
                                            <Calendar className="w-24 h-24 text-indigo-600" />
                                        </div>
                                        <div className="relative z-10">
                                            <div className="flex items-center mb-6">
                                                <div className="p-3 bg-indigo-600 rounded-2xl text-white mr-5 shadow-xl shadow-indigo-100">
                                                    <Calendar className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h4 className="text-lg font-black text-gray-900 uppercase tracking-tight">Sincronización de Tiempos</h4>
                                                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-0.5">Gestión de Calendario</p>
                                                </div>
                                            </div>
                                            <p className="text-sm text-gray-600 leading-relaxed max-w-2xl">
                                                Los periodos definidos aquí organizan automáticamente tus planeaciones, reportes de asistencia y el concentrado de calificaciones.
                                                Asegúrate de que las fechas coincidan con el calendario oficial de la SEP.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-[2rem] border border-gray-100 p-2 shadow-sm">
                                        <PeriodManager />
                                    </div>
                                </div>
                            )}

                            {/* PERSONAL TAB */}
                            {activeTab === 'personal' && (
                                <StaffManager />
                            )}

                            {activeTab === 'security' && (
                                <SecuritySettings
                                    profile={profile}
                                    tenant={tenant}
                                    isDirectorOrAdmin={isDirectorOrAdmin || isSuperAdmin}
                                />
                            )}

                            {activeTab === 'ai' && (
                                <div className="space-y-12">
                                    <div className="flex flex-col md:flex-row justify-between items-start gap-4 border-b border-gray-100 pb-6">
                                        <div>
                                            <h3 className="text-2xl font-black text-gray-900 tracking-tight">Inteligencia Artificial</h3>
                                            <p className="text-sm text-gray-500 font-medium tracking-tight">El motor cognitivo que potencia tus planeaciones y evaluaciones.</p>
                                        </div>
                                        <button
                                            onClick={handleUpdateAiSettings}
                                            disabled={updating}
                                            className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 flex items-center"
                                        >
                                            <Save className="w-4 h-4 mr-2" />
                                            {updating ? 'Guardando...' : 'Guardar Configuración'}
                                        </button>
                                    </div>

                                    <div className="space-y-8 max-w-2xl">
                                        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-indigo-200 relative overflow-hidden">
                                            <div className="absolute top-0 right-0 p-8 opacity-20">
                                                <Sparkles className="w-32 h-32" />
                                            </div>
                                            <div className="relative z-10">
                                                <div className="flex items-center mb-6">
                                                    <div className="p-3 bg-white/20 backdrop-blur rounded-2xl mr-4">
                                                        <Sparkles className="w-6 h-6" />
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">AI Core Engine</span>
                                                </div>
                                                <h4 className="text-xl font-black mb-4">Potencia tu labor docente</h4>
                                                <p className="text-sm text-indigo-50 leading-relaxed opacity-90">
                                                    El sistema detecta automáticamente si utilizas <b>Groq (Llama 3)</b> o <b>Google Gemini</b> basándose en tu clave.
                                                    Recomendamos Groq por su velocidad y estabilidad en tareas de redacción pedagógica.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">API Key (Groq o Gemini)</label>
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <div className="relative flex-grow">
                                                        <input
                                                            type="password"
                                                            placeholder="gsk_... o AIza..."
                                                            value={aiSettings.apiKey}
                                                            onChange={(e) => setAiSettings({ apiKey: e.target.value })}
                                                            className="w-full px-5 py-4 bg-gray-50 border-transparent rounded-2xl text-sm font-mono focus:bg-white focus:ring-0 focus:border-indigo-500 transition-all shadow-inner"
                                                        />
                                                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                                            {aiSettings.apiKey.startsWith('gsk_') ? (
                                                                <span className="text-[10px] font-black bg-orange-100 text-orange-600 px-3 py-1 rounded-full uppercase tracking-tighter">Groq</span>
                                                            ) : aiSettings.apiKey.startsWith('AIza') ? (
                                                                <span className="text-[10px] font-black bg-blue-100 text-blue-600 px-3 py-1 rounded-full uppercase tracking-tighter">Gemini</span>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => window.open(aiSettings.apiKey.startsWith('gsk_') ? 'https://console.groq.com/keys' : 'https://aistudio.google.com/app/apikey', '_blank')}
                                                        className="px-6 py-4 bg-gray-50 border border-gray-100 text-indigo-600 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-indigo-50 transition-colors whitespace-nowrap"
                                                    >
                                                        Obtener Key
                                                    </button>
                                                </div>
                                            </div>

                                            {aiSettings.apiKey && tenant.ai_config?.apiKey === aiSettings.apiKey && (
                                                <div className="flex items-center bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-3" />
                                                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Motor Configurado y Activo</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="pt-12 border-t border-gray-50">
                                            <div className="flex items-center mb-6">
                                                <div className="w-1 h-8 bg-amber-400 rounded-full mr-4" />
                                                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">Developer Toolkit</h3>
                                            </div>
                                            <div className="bg-gray-50 p-8 rounded-[2.5rem] border border-gray-100 group transition-all hover:bg-white hover:shadow-xl hover:shadow-gray-100">
                                                <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                                                    <div className="flex-1 text-center sm:text-left">
                                                        <h4 className="font-black text-gray-900 uppercase tracking-tight mb-1">Poblar Base de Datos</h4>
                                                        <p className="text-xs text-gray-500 font-medium">Genera alumnos, grupos y calificaciones de prueba para demostraciones.</p>
                                                    </div>
                                                    <button
                                                        onClick={async () => {
                                                            const confirm = window.confirm('¿Estas seguro? Esto creará muchos datos de prueba.')
                                                            if (!confirm) return
                                                            setUpdating(true)
                                                            try {
                                                                const { seedDatabase } = await import('../../../utils/seed_data')
                                                                const result = await seedDatabase(tenant.id)
                                                                if (result.success) {
                                                                    showSuccess('Datos generados correctamente')
                                                                    alert('Log:\n' + result.log.join('\n'))
                                                                } else {
                                                                    alert('Error:\n' + result.log.join('\n'))
                                                                }
                                                            } catch (e) {
                                                                console.error(e)
                                                                alert('Error fatal al ejecutar seed')
                                                            } finally {
                                                                setUpdating(false)
                                                            }
                                                        }}
                                                        disabled={updating}
                                                        className="px-6 py-3 bg-white border border-gray-200 text-gray-900 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm"
                                                    >
                                                        Ejecutar Seed
                                                    </button>
                                                </div>
                                                <div className="mt-6 flex items-center justify-center sm:justify-start text-[10px] font-black text-amber-600 bg-amber-50 py-2 px-4 rounded-full border border-amber-100 inline-flex">
                                                    <Lock className="w-3 h-3 mr-2" />
                                                    ENTORNO DE PRUEBAS SOLAMENTE
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* SECURITY TAB */}

                        </div>
                    </div>
                </main >
            </div >
        </div >
    )
}
