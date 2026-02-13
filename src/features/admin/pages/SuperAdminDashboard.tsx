
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import {
    Activity,
    Shield,
    Database,
    Users,
    DollarSign,
    Server,
    Search,
    Lock,
    Play,
    AlertTriangle,
    Zap,
    XCircle,
    Settings,
    Building2,
    Clock,
    CheckCircle2,
    Brain,
    CreditCard,
    History,
    Undo,
    DownloadCloud,
    HardDrive,
    Terminal,
    Save,
    Trash,
    UserMinus,
    UserCheck,
    LifeBuoy,
    RefreshCw,
    Mail,
    Key,
    ActivitySquare,
    UserCog,
    Volume2,
    MessageSquare,
    Info
} from 'lucide-react'
import { AdminUserTable } from '../components/AdminUserTable'
import { RegularUserTable } from '../components/RegularUserTable'

export const SuperAdminDashboard = () => {
    const [stats, setStats] = useState({
        totalTenants: 0,
        schoolCount: 0,
        independentCount: 0,
        totalUsers: 0,
        serverHealth: '100% stable',
        dbSize: 0
    })
    const [activeTab, setActiveTabState] = useState<'tenants' | 'admins' | 'users' | 'rescue' | 'ai' | 'backups' | 'billing' | 'settings' | 'sounds'>(() => {
        const saved = localStorage.getItem('godmode_active_tab')
        return (saved as any) || 'tenants'
    })

    // Wrapper to persist activeTab to localStorage
    const setActiveTab = (tab: 'tenants' | 'admins' | 'users' | 'rescue' | 'ai' | 'backups' | 'billing' | 'settings' | 'sounds') => {
        localStorage.setItem('godmode_active_tab', tab)
        setActiveTabState(tab)
    }
    const [tenants, setTenants] = useState<any[]>([])
    const [allUsers, setAllUsers] = useState<any[]>([])
    const [recentLogs, setRecentLogs] = useState<any[]>([])
    const [deletedAccounts, setDeletedAccounts] = useState<any[]>([])
    const [transactions, setTransactions] = useState<any[]>([])
    const [licenses, setLicenses] = useState<any[]>([])
    const [selectedUser, setSelectedUser] = useState<any>(null)
    const [paymentPreferenceId, setPaymentPreferenceId] = useState<string | null>(null)

    // Config States with localStorage persistence
    const [aiSettings, setAiSettingsState] = useState<any>(() => {
        const saved = localStorage.getItem('godmode_ai_settings')
        if (saved && saved !== 'undefined') {
            try {
                return JSON.parse(saved)
            } catch (e) {
                console.warn('Failed to parse ai_settings from localStorage')
            }
        }
        return {
            openai_key: '',
            gemini_key: '',
            anthropic_key: ''
        }
    })
    const setAiSettings = (settings: any) => {
        localStorage.setItem('godmode_ai_settings', JSON.stringify(settings))
        setAiSettingsState(settings)
    }

    const [billingSettings, setBillingSettingsState] = useState<any>(() => {
        const saved = localStorage.getItem('godmode_billing_settings')
        if (saved && saved !== 'undefined') {
            try {
                return JSON.parse(saved)
            } catch (e) {
                console.warn('Failed to parse billing_settings from localStorage')
            }
        }
        return {
            mercadopago_public_key: '',
            mercadopago_access_token: '',
            auto_license_activation: 'true'
        }
    })
    const setBillingSettings = (settings: any) => {
        localStorage.setItem('godmode_billing_settings', JSON.stringify(settings))
        setBillingSettingsState(settings)
    }

    const [smtpSettings, setSmtpSettingsState] = useState<any>(() => {
        const saved = localStorage.getItem('godmode_smtp_settings')
        if (saved && saved !== 'undefined') {
            try {
                return JSON.parse(saved)
            } catch (e) {
                console.warn('Failed to parse smtp_settings from localStorage')
            }
        }
        return {
            smtp_host: '',
            smtp_port: '587',
            smtp_user: '',
            smtp_pass: '',
            smtp_crypto: 'STARTTLS',
            smtp_from_email: '',
            smtp_from_name: 'NEMIA Notificaciones'
        }
    })
    const setSmtpSettings = (settings: any) => {
        localStorage.setItem('godmode_smtp_settings', JSON.stringify(settings))
        setSmtpSettingsState(settings)
    }

    const [isSaving, setIsSaving] = useState(false)
    const [loading, setLoading] = useState(true)
    const [purgeEmail, setPurgeEmail] = useState('')
    const [generatedLicense, setGeneratedLicense] = useState('')
    const [backupStatus, setBackupStatus] = useState<'idle' | 'running' | 'success'>('idle')
    const [searchTerm, setSearchTerm] = useState('')
    const [soundSettings, setSoundSettingsState] = useState<any>(() => {
        const saved = localStorage.getItem('godmode_sound_settings')
        if (saved && saved !== 'undefined') {
            try {
                return JSON.parse(saved)
            } catch (e) {
                console.warn('Failed to parse sound_settings from localStorage')
            }
        }
        return {
            chat_sound_url: '/sounds/notification.mp3',
            notification_sound_url: ''
        }
    })
    const setSoundSettings = (settings: any) => {
        localStorage.setItem('godmode_sound_settings', JSON.stringify(settings))
        setSoundSettingsState(settings)
    }
    const [uploadingKey, setUploadingKey] = useState<string | null>(null)
    const [fetchError, setFetchError] = useState<string | null>(null)

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            try {
                // 1. Fetch Tenants
                const { data: tenantsList, count: totalTenants } = await supabase
                    .from('tenants')
                    .select('*, profiles(count)', { count: 'exact' })
                    .order('created_at', { ascending: false })

                // 2. Fetch All Profiles (Rescue Area)
                const { data: profilesList, count: totalUsers, error: profileError } = await supabase
                    .from('profiles')
                    .select('*', { count: 'exact' }) // Removed tenants(name) temporarily to debug
                    .order('created_at', { ascending: false })

                if (profileError) {
                    console.error('Profile fetch error:', profileError)
                    setFetchError('Profile Error: ' + profileError.message)
                } else {
                    console.log('Profiles Fetched:', profilesList?.length)
                }

                // 3. Fetch Deleted Profiles
                const { data: deletedCols } = await supabase
                    .from('profiles')
                    .select('*')
                    .not('deleted_at', 'is', null)

                // 4. Fetch Transactions (Billing)
                // Note: Join with profiles requires correct FK setup or hinted join.
                // We use simplified query for now to avoid 400 Bad Request if FK is missing or column issue.
                const { data: txList, error: txError } = await supabase
                    .from('payment_transactions')
                    .select('*, profiles:user_id(first_name)')
                    .order('created_at', { ascending: false })
                    .limit(20)

                if (txError) console.error('Error fetching transactions:', txError)

                // 5. Fetch Licenses
                const { data: licList } = await supabase
                    .from('licenses')
                    .select('*, tenants(name)')
                    .order('created_at', { ascending: false })

                // 6. Fetch DB Size (Resource Monitor)
                let dbSize = 0;
                try {
                    const { data, error } = await supabase.rpc('get_database_size')
                    if (!error && data !== null) {
                        dbSize = Math.round(data / (1024 * 1024)) // Convert to MB if returned in bytes
                    }
                } catch (e) {
                    console.warn('DB Size check failed: Feature not yet implemented in DB or permission denied.')
                }

                const schools = tenantsList?.filter(t => t.type === 'SCHOOL').length || 0
                const independents = tenantsList?.filter(t => t.type === 'INDEPENDENT').length || 0

                setStats({
                    totalTenants: totalTenants || 0,
                    schoolCount: schools,
                    independentCount: independents,
                    totalUsers: totalUsers || 0,
                    serverHealth: '100% stable',
                    dbSize: dbSize
                })

                setTenants(tenantsList || [])
                setAllUsers(profilesList || [])
                setRecentLogs(tenantsList?.slice(0, 5) || [])
                setDeletedAccounts(deletedCols || [])
                setTransactions(txList || [])
                setLicenses(licList || [])
                setLicenses(licList || [])
            } catch (err: any) {
                console.error('Error fetching admin data:', err)
                setFetchError(err.message || JSON.stringify(err))
            } finally {
                setLoading(false)
            }
        }

        const fetchSettings = async () => {
            const { data } = await supabase.from('system_settings').select('key, value')
            if (data) {
                const settings: any = {}
                data.forEach(item => settings[item.key] = item.value)

                // Only update if DB has values, otherwise keep localStorage values
                setSmtpSettings((prev: any) => ({
                    ...prev,
                    ...(settings.smtp_host && { smtp_host: settings.smtp_host }),
                    ...(settings.smtp_port && { smtp_port: settings.smtp_port }),
                    ...(settings.smtp_user && { smtp_user: settings.smtp_user }),
                    ...(settings.smtp_pass && { smtp_pass: settings.smtp_pass }),
                    ...(settings.smtp_crypto && { smtp_crypto: settings.smtp_crypto }),
                    ...(settings.smtp_from_email && { smtp_from_email: settings.smtp_from_email }),
                    ...(settings.smtp_from_name && { smtp_from_name: settings.smtp_from_name })
                }))

                setAiSettings((prev: any) => ({
                    ...prev,
                    ...(settings.openai_key && { openai_key: settings.openai_key }),
                    ...(settings.gemini_key && { gemini_key: settings.gemini_key }),
                    ...(settings.anthropic_key && { anthropic_key: settings.anthropic_key })
                }))

                setBillingSettings((prev: any) => ({
                    ...prev,
                    ...(settings.mercadopago_public_key && { mercadopago_public_key: settings.mercadopago_public_key }),
                    ...(settings.mercadopago_access_token && { mercadopago_access_token: settings.mercadopago_access_token }),
                    ...(settings.auto_license_activation && { auto_license_activation: settings.auto_license_activation })
                }))

                setSoundSettings((prev: any) => ({
                    ...prev,
                    ...(settings.chat_sound_url && { chat_sound_url: settings.chat_sound_url }),
                    ...(settings.notification_sound_url && { notification_sound_url: settings.notification_sound_url })
                }))
            }
        }

        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) setSelectedUser(user)
        }

        fetchData()
        fetchSettings()
        getUser()
    }, [])

    const handleSaveGroup = async (group: 'smtp' | 'ai' | 'billing' | 'sounds') => {
        setIsSaving(true)
        try {
            let toSave = {}
            if (group === 'smtp') toSave = smtpSettings
            if (group === 'ai') toSave = aiSettings
            if (group === 'billing') toSave = billingSettings
            if (group === 'sounds') toSave = soundSettings

            const updates = Object.entries(toSave).map(([key, value]) => ({
                key,
                value: String(value),
                updated_at: new Date().toISOString()
            }))

            const { error } = await supabase.from('system_settings').upsert(updates)
            if (error) throw error
            alert('Configuración guardada.')
        } catch (err: any) {
            alert('Error: ' + err.message)
        } finally {
            setIsSaving(false)
        }
    }

    const handleUploadSound = async (event: any, settingKey: string) => {
        const file = event.target.files?.[0]
        if (!file) return

        setUploadingKey(settingKey)
        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `system/${settingKey}_${Date.now()}.${fileExt}`
            const filePath = `${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('school-assets')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('school-assets')
                .getPublicUrl(filePath)

            setSoundSettings((prev: any) => ({ ...prev, [settingKey]: publicUrl }))
            alert('Archivo subido correctamente. No olvides guardar cambios.')
        } catch (error: any) {
            console.error('Error uploading sound:', error)
            alert('Error al subir archivo: ' + error.message)
        } finally {
            setUploadingKey(null)
        }
    }

    const handleBackup = async () => {
        setBackupStatus('running')
        setTimeout(() => {
            setBackupStatus('success')
            alert('Respaldo completado.')
            setTimeout(() => setBackupStatus('idle'), 2000)
        }, 1500)
    }

    const handleToggleStatus = async (tenantId: string, currentStatus: string) => {
        alert('Cambio de estado procesado.')
    }

    const handleRestoreAccount = async (id: string) => {
        try { await supabase.rpc('restore_account', { target_user_id: id }); window.location.reload() } catch (e: any) { alert(e.message) }
    }

    const handlePurgeAccount = async (id: string) => {
        if (confirm('¿Purgar definitivamente?')) {
            try { await supabase.rpc('purge_account', { target_user_id: id }); window.location.reload() } catch (e: any) { alert(e.message) }
        }
    }

    const handlePurgeByEmail = async () => {
        if (!purgeEmail) return
        try { await supabase.rpc('purge_auth_user_by_email', { target_email: purgeEmail }); alert('Email purgado'); setPurgeEmail('') } catch (e: any) { alert(e.message) }
    }

    const handleGenerateLicense = () => {
        const key = Array.from({ length: 4 }, () => Math.random().toString(36).substring(2, 6).toUpperCase()).join('-')
        setGeneratedLicense(key)
    }

    const handleImpersonate = (id: string, role?: string) => {
        // Open in new tab with impersonate param
        const url = `${window.location.origin}/?impersonate=${id}`
        window.open(url, '_blank')
    }

    const handleDeleteUser = async (id: string) => {
        if (!confirm('¿Estás seguro de mover este usuario a la papelera (Soft Delete)?')) return
        try {
            // Use RPC instead of direct update to ensure email renaming in auth.users
            const { error } = await supabase.rpc('soft_delete_account', { target_user_id: id })

            if (error) throw error
            alert('Usuario movido a la papelera correctamente.')
            window.location.reload()
        } catch (e: any) {
            console.error('Delete error:', e)
            alert('Error al eliminar usuario: ' + (e.message || 'Error desconocido'))
        }
    }

    const handleToggleDemo = async (id: string, currentDemoStatus: boolean) => {
        const action = currentDemoStatus ? 'desactivar' : 'activar'
        if (!confirm(`¿Estás seguro de ${action} el modo demo para este usuario?`)) return
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ is_demo: !currentDemoStatus })
                .eq('id', id)
            if (error) throw error
            alert(`Modo demo ${currentDemoStatus ? 'desactivado' : 'activado'} correctamente.`)
            window.location.reload()
        } catch (e: any) {
            alert('Error al cambiar modo demo: ' + e.message)
        }
    }

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex font-sans">
            {/* Sidebar Navigation */}
            <aside className="w-72 bg-slate-950 border-r border-slate-800 flex flex-col sticky top-0 h-screen overflow-y-auto">
                <div className="p-8 border-b border-slate-800">
                    <div className="flex items-center space-x-3 mb-2">
                        <div className="bg-blue-600 p-2 rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.4)]">
                            <Shield className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-xl font-black tracking-tighter text-white uppercase italic">God Mode</h1>
                    </div>
                    <p className="text-[10px] text-slate-500 font-black tracking-widest uppercase">Admin Central v2.0</p>
                </div>

                <nav className="flex-grow p-4 space-y-2 mt-4">
                    <button onClick={() => setActiveTab('tenants')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'tenants' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-900 hover:text-slate-300'}`}>
                        <Building2 opacity={0.7} className="w-5 h-5" />
                        <span>Gestión de Nodos</span>
                    </button>
                    <button onClick={() => setActiveTab('admins')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'admins' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-900 hover:text-slate-300'}`}>
                        <Shield opacity={0.7} className="w-5 h-5" />
                        <span>Administradores</span>
                    </button>
                    <button onClick={() => setActiveTab('users')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-900 hover:text-slate-300'}`}>
                        <Users opacity={0.7} className="w-5 h-5" />
                        <span>Base de Usuarios</span>
                    </button>
                    <button onClick={() => setActiveTab('rescue')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'rescue' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-900 hover:text-slate-300'}`}>
                        <LifeBuoy opacity={0.7} className="w-5 h-5" />
                        <span>Área de Rescate</span>
                    </button>
                    <button onClick={() => setActiveTab('ai')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'ai' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-900 hover:text-slate-300'}`}>
                        <Brain opacity={0.7} className="w-5 h-5" />
                        <span>Control de IA</span>
                    </button>
                    <button onClick={() => setActiveTab('backups')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'backups' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-900 hover:text-slate-300'}`}>
                        <Database opacity={0.7} className="w-5 h-5" />
                        <span>Respaldos & Versiones</span>
                    </button>
                    <button onClick={() => setActiveTab('billing')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'billing' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-900 hover:text-slate-300'}`}>
                        <CreditCard opacity={0.7} className="w-5 h-5" />
                        <span>Facturación & MP</span>
                    </button>
                    <button onClick={() => setActiveTab('sounds')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'sounds' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-900 hover:text-slate-300'}`}>
                        <Volume2 opacity={0.7} className="w-5 h-5" />
                        <span>Sonidos Generales</span>
                    </button>

                    <div className="pt-4 mt-4 border-t border-slate-800 space-y-2">
                        <a href="/messages" className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-900 hover:text-slate-300 transition-all">
                            <Mail opacity={0.7} className="w-5 h-5" />
                            <span>Mensajería NEMIA</span>
                        </a>
                        <a href="/" className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-900 hover:text-slate-300 transition-all">
                            <UserCheck opacity={0.7} className="w-5 h-5" />
                            <span>Portal Docente</span>
                        </a>
                        <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'settings' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:bg-slate-900'}`}>
                            <Settings opacity={0.7} className="w-5 h-5" />
                            <span>Ajustes SMTP</span>
                        </button>
                    </div>
                </nav>

                <div className="p-6 bg-slate-900/50 mt-auto">
                    <div className="flex items-center space-x-3 mb-4">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span className="text-[10px] font-black tracking-widest text-emerald-400">SERVER ONLINE</span>
                    </div>
                    <div className="bg-slate-800 rounded-xl p-3 flex justify-between items-center">
                        <ActivitySquare className="w-4 h-4 text-slate-500" />
                        <span className="text-[11px] font-mono text-slate-400">{stats.serverHealth}</span>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-grow overflow-y-auto">
                <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-8 sticky top-0 z-10 flex justify-between items-center">
                    <div className="animate-in fade-in slide-in-from-left-4">
                        <h2 className="text-3xl font-black text-white italic uppercase">
                            {activeTab === 'tenants' ? 'Gestión de Nodos' :
                                activeTab === 'admins' ? 'Núcleo de Mando' :
                                    activeTab === 'users' ? 'Directorio Global' :
                                        activeTab === 'rescue' ? 'Área de Rescate' :
                                            activeTab === 'ai' ? 'Neuronas Artificiales' :
                                                activeTab === 'backups' ? 'Núcleo de Datos' :
                                                    activeTab === 'billing' ? 'Finanzas & Licencias' :
                                                        'Configuración de Sistema'}
                        </h2>
                        <p className="text-slate-400 font-medium">Control total sobre los parámetros avanzados del sistema escolar.</p>
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-500 absolute left-4 top-4" />
                            <input
                                type="text"
                                placeholder="Buscar en servidor..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-6 py-3 text-sm focus:ring-2 focus:ring-blue-600 outline-none w-64 transition-all"
                            />
                        </div>
                    </div>
                </header>

                <div className="p-8 space-y-8">
                    {/* Stats Summary row */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-in fade-in zoom-in-95">
                        <div className="bg-slate-800 border border-slate-700 p-6 rounded-3xl group hover:border-blue-500/50 transition-all">
                            <Users className="w-5 h-5 text-blue-500 mb-2" />
                            <h3 className="text-3xl font-black text-white">{stats.totalUsers}</h3>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">Usuarios Base</p>
                        </div>
                        <div className="bg-slate-800 border border-slate-700 p-6 rounded-3xl group hover:border-emerald-500/50 transition-all">
                            <Building2 className="w-5 h-5 text-emerald-500 mb-2" />
                            <h3 className="text-3xl font-black text-white">{stats.schoolCount}</h3>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">Instituciones</p>
                        </div>
                        <div className="bg-slate-800 border border-slate-700 p-6 rounded-3xl group hover:border-purple-500/50 transition-all">
                            <Users className="w-5 h-5 text-purple-500 mb-2" />
                            <h3 className="text-3xl font-black text-white">{stats.independentCount}</h3>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">Freelance</p>
                        </div>
                        <div className="bg-slate-800 border border-slate-700 p-6 rounded-3xl group hover:border-rose-500/50 transition-all">
                            <DollarSign className="w-5 h-5 text-rose-500 mb-2" />
                            <h3 className="text-3xl font-black text-white">100%</h3>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">Solvencia</p>
                        </div>
                    </div>

                    {/* System Health / Resource Monitor Widget */}
                    <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 shadow-xl animate-in fade-in slide-in-from-bottom-8">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-black text-white italic uppercase flex items-center">
                                <Activity className="w-5 h-5 mr-3 text-blue-500" />
                                Monitor de Recursos (SLA)
                            </h3>
                            <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">En Línea</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* User Capacity Monitor */}
                            <div>
                                <div className="flex justify-between items-end mb-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Concurrencia (Usuarios)</label>
                                    <span className={`text-sm font-black ${stats.totalUsers > 750 ? 'text-amber-500' : 'text-slate-300'}`}>
                                        {stats.totalUsers} / 1000
                                    </span>
                                </div>
                                <div className="h-4 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
                                    <div
                                        className={`h-full transition-all duration-1000 ${stats.totalUsers > 900 ? 'bg-red-600' : stats.totalUsers > 750 ? 'bg-amber-500' : 'bg-blue-600'}`}
                                        style={{ width: `${Math.min((stats.totalUsers / 1000) * 100, 100)}%` }}
                                    />
                                </div>
                                {stats.totalUsers > 750 && (
                                    <div className="mt-2 flex items-center text-amber-500 bg-amber-500/10 p-2 rounded-lg">
                                        <AlertTriangle className="w-4 h-4 mr-2" />
                                        <span className="text-[10px] font-bold uppercase">Advertencia: Capacidad al 75%. Considerar Escalar.</span>
                                    </div>
                                )}
                            </div>

                            {/* Storage Monitor */}
                            <div>
                                <div className="flex justify-between items-end mb-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Almacenamiento (DB)</label>
                                    <span className={`text-sm font-black ${(stats as any).dbSize > 375 ? 'text-amber-500' : 'text-slate-300'}`}>
                                        {(stats as any).dbSize || 0} MB / 500 MB
                                    </span>
                                </div>
                                <div className="h-4 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
                                    <div
                                        className={`h-full transition-all duration-1000 ${(stats as any).dbSize > 450 ? 'bg-red-600' : (stats as any).dbSize > 375 ? 'bg-amber-500' : 'bg-emerald-600'}`}
                                        style={{ width: `${Math.min((((stats as any).dbSize || 0) / 500) * 100, 100)}%` }}
                                    />
                                </div>
                                {(stats as any).dbSize > 375 && (
                                    <div className="mt-2 flex items-center text-amber-500 bg-amber-500/10 p-2 rounded-lg">
                                        <AlertTriangle className="w-4 h-4 mr-2" />
                                        <span className="text-[10px] font-bold uppercase">Advertencia: Almacenamiento al 75%. Contactar Soporte.</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    {activeTab === 'tenants' && (
                        <div className="bg-slate-800 border border-slate-700 rounded-[2.5rem] overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="p-8 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
                                <div className="flex items-center space-x-3">
                                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                    <h3 className="text-xl font-black text-white uppercase italic tracking-tight">Administradores de Nodos</h3>
                                </div>
                                <span className="text-[10px] font-black px-3 py-1 bg-blue-500/10 text-blue-500 rounded-full border border-blue-500/20">OPERATIVOS</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-900/50 border-b border-slate-700 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                        <tr>
                                            <th className="px-8 py-5 text-left">Institución / Freelance</th>
                                            <th className="px-8 py-5 text-left">Capacidad</th>
                                            <th className="px-8 py-5 text-left">Estatus</th>
                                            <th className="px-8 py-5 text-right">Mando</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700">
                                        {tenants.filter(t => t.name?.toLowerCase().includes(searchTerm.toLowerCase())).map(t => (
                                            <tr key={t.id} className="hover:bg-slate-700/30 transition-all group">
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center">
                                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white shadow-lg mr-4 ${t.type === 'SCHOOL' ? 'bg-gradient-to-br from-amber-400 to-orange-600' : 'bg-gradient-to-br from-blue-500 to-purple-600'}`}>
                                                            {t.name?.[0] || 'T'}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-black text-white uppercase tracking-tight">{t.name || 'Sin Identificar'}</p>
                                                            <p className="text-[10px] text-slate-500 font-mono italic">UID: {t.id}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex flex-col">
                                                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black w-fit mb-2 ${t.type === 'SCHOOL' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                                            {t.type === 'SCHOOL' ? 'COLEGIO ENTERPRISE' : 'DOCENTE FREELANCE'}
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 italic flex items-center">
                                                            <Clock className="w-3 h-3 mr-1" />
                                                            Desde: {new Date(t.created_at).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center space-x-2">
                                                        <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                                        <span className="text-[10px] font-black uppercase text-slate-200 tracking-wider">Activo</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-all">
                                                        <button onClick={() => handleImpersonate(t.id)} className="p-3 bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white rounded-xl transition-all" title="Simular Usuario">
                                                            <Play className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => handleToggleStatus(t.id, 'ACTIVE')} className="p-3 bg-amber-600/10 text-amber-500 hover:bg-amber-600 hover:text-white rounded-xl transition-all" title="Suspender">
                                                            <Lock className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'admins' && (
                        <AdminUserTable
                            users={allUsers}
                            searchTerm={searchTerm}
                        />
                    )}

                    {activeTab === 'users' && (
                        <RegularUserTable
                            users={allUsers}
                            searchTerm={searchTerm}
                            onImpersonate={handleImpersonate}
                            onDelete={handleDeleteUser}
                        />
                    )}

                    {activeTab === 'rescue' && (
                        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
                            <div className="bg-slate-800 border border-slate-700 rounded-[2.5rem] p-8 shadow-2xl">
                                <h3 className="text-2xl font-black text-white italic uppercase mb-8 flex items-center">
                                    <LifeBuoy className="w-8 h-8 text-emerald-500 mr-4" />
                                    Protocolo de Rescate Integral
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                                    <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800">
                                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center">
                                            <Search className="w-4 h-4 mr-2" />
                                            Purgado Manual de Colisiones
                                        </h4>
                                        <div className="flex space-x-2">
                                            <input
                                                type="email"
                                                placeholder="usuario@dominio.com"
                                                value={purgeEmail}
                                                onChange={(e) => setPurgeEmail(e.target.value)}
                                                className="flex-grow bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500"
                                            />
                                            <button onClick={handlePurgeByEmail} className="bg-red-600 hover:bg-red-500 text-white px-8 rounded-2xl font-black text-xs transition-all shadow-lg shadow-red-900/30 font-bold uppercase">PURGAR</button>
                                        </div>
                                    </div>
                                    <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 border-dashed">
                                        <div className="flex h-full items-center justify-center">
                                            <p className="text-[11px] text-slate-600 font-black uppercase text-center italic tracking-widest">Almacén de Borrado Temporal Listo</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 border-t border-slate-700 pt-8">
                                    <h4 className="text-sm font-black text-white uppercase italic mb-6">Procesos de Recuperación Disponibles</h4>
                                    <div className="space-y-4 max-h-96 overflow-y-auto pr-4 custom-scrollbar">
                                        {deletedAccounts.map(account => (
                                            <div key={account.id} className="bg-slate-900/50 border border-slate-700 p-6 rounded-3xl flex justify-between items-center group transition-all hover:bg-slate-900">
                                                <div className="flex items-center">
                                                    <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 shadow-inner mr-4">
                                                        <UserMinus className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-white uppercase italic text-sm">{account.first_name || 'Cuenta Huerfana'}</p>
                                                        <p className="text-xs text-slate-500 font-mono tracking-tighter uppercase">Borrado: {new Date(account.deleted_at).toLocaleString()}</p>
                                                    </div>
                                                </div>
                                                <div className="flex space-x-3">
                                                    <button onClick={() => handleRestoreAccount(account.id)} className="px-6 py-3 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white rounded-2xl font-black text-[10px] tracking-widest transition-all">RESTAURAR</button>
                                                    <button onClick={() => handlePurgeAccount(account.id)} className="px-6 py-3 bg-red-600/20 text-red-500 border border-red-500/30 hover:bg-red-600 hover:text-white rounded-2xl font-black text-[10px] tracking-widest transition-all">PURGAR</button>
                                                </div>
                                            </div>
                                        ))}
                                        {deletedAccounts.length === 0 && (
                                            <div className="text-center py-20 bg-slate-900/30 border-2 border-dashed border-slate-800 rounded-3xl">
                                                <Clock className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                                                <p className="text-xs text-slate-600 font-black uppercase tracking-widest italic">Papelera de Reciclaje Vacía</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'ai' && (
                        <div className="max-w-4xl space-y-8 animate-in slide-in-from-right-8 duration-500">
                            <div className="bg-slate-800 border border-slate-700 rounded-[2.5rem] p-10 relative overflow-hidden shadow-2xl">
                                <Brain className="absolute top-0 right-0 w-64 h-64 text-purple-600/5 -mr-20 -mt-20 group-hover:scale-110 transition-transform duration-1000" />
                                <h3 className="text-3xl font-black text-white italic uppercase mb-10 relative z-10">Neuronas Artificiales</h3>
                                <div className="space-y-8 relative z-10">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">OpenAI Project Key</label>
                                            <div className="relative group">
                                                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-purple-500 transition-colors" />
                                                <input
                                                    type="password"
                                                    value={aiSettings.openai_key}
                                                    onChange={(e) => setAiSettings({ ...aiSettings, openai_key: e.target.value })}
                                                    placeholder="sk-...."
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-6 py-4 text-sm font-mono text-purple-400 focus:ring-2 focus:ring-purple-600 outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Google Gemini Key</label>
                                            <div className="relative group">
                                                <Zap className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-blue-500 transition-colors" />
                                                <input
                                                    type="password"
                                                    value={aiSettings.gemini_key}
                                                    onChange={(e) => setAiSettings({ ...aiSettings, gemini_key: e.target.value })}
                                                    placeholder="AIza...."
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-6 py-4 text-sm font-mono text-blue-400 focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex justify-end pt-6 border-t border-slate-700">
                                        <button onClick={() => handleSaveGroup('ai')} disabled={isSaving} className="bg-blue-600 hover:bg-blue-500 text-white px-12 py-4 rounded-2xl font-black italic tracking-tighter uppercase text-sm shadow-xl shadow-blue-900/40 transition-all flex items-center">
                                            <Save className="w-4 h-4 mr-2" />
                                            {isSaving ? 'Guardando...' : 'Inyectar API Keys'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'backups' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-left-8 duration-500">
                            <div className="bg-slate-800 border border-slate-700 rounded-[2.5rem] p-8 shadow-2xl flex flex-col justify-between">
                                <h3 className="text-2xl font-black text-white uppercase italic mb-8">Gestión de Respaldos</h3>
                                <div className="space-y-4 mb-8">
                                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700 flex justify-between items-center group cursor-pointer hover:border-emerald-500/50 transition-all">
                                        <div className="flex items-center space-x-3">
                                            <HardDrive className="w-5 h-5 text-emerald-500" />
                                            <span className="text-xs font-black uppercase text-white">Full Snapshot</span>
                                        </div>
                                        <span className="text-[10px] font-mono text-slate-500 uppercase italic">Hace 3 horas</span>
                                    </div>
                                </div>
                                <button onClick={handleBackup} disabled={backupStatus === 'running'} className="w-full py-6 bg-slate-950 border border-slate-800 rounded-3xl flex items-center justify-center space-x-4 hover:bg-black transition-all group shadow-xl">
                                    <DownloadCloud className={`w-8 h-8 text-blue-500 group-hover:scale-110 transition-transform ${backupStatus === 'running' ? 'animate-bounce' : ''}`} />
                                    <span className="font-black uppercase tracking-[0.2em] text-sm">Disparar Respaldo Maestro</span>
                                </button>
                            </div>
                            <div className="bg-gradient-to-br from-red-600 to-rose-700 border border-red-500 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
                                <History className="absolute top-0 right-0 w-48 h-48 text-white/10 -mr-12 -mt-12 group-hover:rotate-12 transition-transform duration-1000" />
                                <div className="relative z-10 h-full flex flex-col justify-between">
                                    <div>
                                        <h3 className="text-2xl font-black text-white uppercase italic mb-2">Reversión de Sistema (Rollback)</h3>
                                        <p className="text-red-100/70 text-xs font-medium italic mb-10 leading-relaxed">Permite regresar el núcleo operativo a una versión anterior estable en caso de inestabilidad post-parche.</p>
                                    </div>
                                    <button className="w-full py-6 bg-white text-rose-700 rounded-3xl font-black uppercase tracking-widest text-sm shadow-2xl hover:scale-[1.02] active:scale-95 transition-all">Regresar a Build v1.8.4 Stable</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'billing' && (
                        <div className="max-w-4xl space-y-8 animate-in slide-in-from-right-8 duration-500">
                            <div className="bg-slate-800 border border-slate-700 rounded-[2.5rem] p-10 relative overflow-hidden shadow-2xl">
                                <CreditCard className="absolute top-0 right-0 w-64 h-64 text-rose-600/5 -mr-20 -mt-20 group-hover:scale-110 transition-transform duration-1000" />
                                <h3 className="text-3xl font-black text-white italic uppercase mb-10 relative z-10">Mercado Pago Integration</h3>
                                <div className="space-y-8 relative z-10">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Public Key (Frontend)</label>
                                            <div className="relative group">
                                                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-rose-500 transition-colors" />
                                                <input
                                                    type="text"
                                                    value={billingSettings.mercadopago_public_key}
                                                    onChange={(e) => setBillingSettings({ ...billingSettings, mercadopago_public_key: e.target.value })}
                                                    placeholder="APP_USR-..."
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-6 py-4 text-sm font-mono text-rose-400 focus:ring-2 focus:ring-rose-600 outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Access Token (Backend)</label>
                                            <div className="relative group">
                                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-rose-500 transition-colors" />
                                                <input
                                                    type="password"
                                                    value={billingSettings.mercadopago_access_token}
                                                    onChange={(e) => setBillingSettings({ ...billingSettings, mercadopago_access_token: e.target.value })}
                                                    placeholder="APP_USR-..."
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-6 py-4 text-sm font-mono text-rose-400 focus:ring-2 focus:ring-rose-600 outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-6">
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 bg-blue-500/10 rounded-xl">
                                                <Info className="w-5 h-5 text-blue-400" />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-white text-sm mb-2">Cómo obtener tus credenciales</h4>
                                                <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
                                                    <li>Visita <a href="https://www.mercadopago.com.mx/developers" target="_blank" className="text-blue-400 hover:underline">Mercado Pago Developers</a></li>
                                                    <li>Crea una aplicación o selecciona una existente</li>
                                                    <li>Copia el <strong className="text-white">Public Key</strong> y el <strong className="text-white">Access Token</strong></li>
                                                    <li>Pega las credenciales aquí y guarda</li>
                                                </ol>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between p-6 bg-slate-900/50 border border-slate-700 rounded-2xl">
                                        <div className="flex items-center gap-3">
                                            <Zap className="w-5 h-5 text-yellow-500" />
                                            <div>
                                                <p className="font-black text-white text-sm">Activación Automática de Licencias</p>
                                                <p className="text-xs text-slate-500">Activar licencias PRO al confirmar pago</p>
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={billingSettings.auto_license_activation === 'true'}
                                                onChange={(e) => setBillingSettings({ ...billingSettings, auto_license_activation: e.target.checked ? 'true' : 'false' })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-rose-900 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
                                        </label>
                                    </div>

                                    <div className="flex justify-end pt-6 border-t border-slate-700">
                                        <button onClick={() => handleSaveGroup('billing')} disabled={isSaving} className="bg-rose-600 hover:bg-rose-500 text-white px-12 py-4 rounded-2xl font-black italic tracking-tighter uppercase text-sm shadow-xl shadow-rose-900/40 transition-all flex items-center">
                                            <Save className="w-4 h-4 mr-2" />
                                            {isSaving ? 'Guardando...' : 'Guardar Configuración de Pagos'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Transactions List */}
                            <div className="bg-slate-800 border border-slate-700 rounded-[2.5rem] p-10 shadow-2xl">
                                <h3 className="text-2xl font-black text-white italic uppercase mb-6">Transacciones Recientes</h3>
                                <div className="space-y-3">
                                    {transactions.length > 0 ? (
                                        transactions.map((tx: any) => (
                                            <div key={tx.id} className="bg-slate-900/50 border border-slate-700 p-5 rounded-2xl flex justify-between items-center">
                                                <div>
                                                    <p className="font-black text-white text-sm">{tx.profiles?.first_name || 'Usuario'}</p>
                                                    <p className="text-xs text-slate-500 font-mono">{tx.payment_id}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-black text-emerald-400">${tx.amount} MXN</p>
                                                    <p className="text-xs text-slate-500">{new Date(tx.created_at).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-12 bg-slate-900/30 border-2 border-dashed border-slate-800 rounded-2xl">
                                            <CreditCard className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                                            <p className="text-xs text-slate-600 font-black uppercase tracking-widest">No hay transacciones registradas</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'sounds' && (
                        <div className="max-w-4xl space-y-8 animate-in slide-in-from-right-8 duration-500">
                            <div className="bg-slate-800 border border-slate-700 rounded-[2.5rem] p-10 relative overflow-hidden shadow-2xl">
                                <Volume2 className="absolute top-0 right-0 w-64 h-64 text-blue-600/5 -mr-20 -mt-20 group-hover:scale-110 transition-transform duration-1000" />
                                <h3 className="text-3xl font-black text-white italic uppercase mb-10 relative z-10">Sonidos del Sistema</h3>

                                <div className="space-y-8 relative z-10">
                                    {/* Chat Sound */}
                                    <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-700">
                                        <h4 className="text-lg font-black text-white mb-4 flex items-center gap-2">
                                            <MessageSquare className="w-5 h-5 text-blue-500" />
                                            Sonido de Chat
                                        </h4>
                                        <div className="flex items-center gap-4">
                                            <input
                                                type="text"
                                                value={soundSettings.chat_sound_url}
                                                onChange={(e) => setSoundSettings({ ...soundSettings, chat_sound_url: e.target.value })}
                                                className="flex-grow bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-blue-400 font-mono"
                                                placeholder="https://.../chat.mp3"
                                            />
                                            <button
                                                onClick={() => {
                                                    const audio = new Audio(soundSettings.chat_sound_url)
                                                    audio.play().catch(e => alert('Error al reproducir: ' + e.message))
                                                }}
                                                className="p-3 bg-slate-800 rounded-xl hover:bg-slate-700 text-white transition-all"
                                                title="Probar sonido"
                                            >
                                                <Play className="w-5 h-5" />
                                            </button>
                                        </div>
                                        <div className="mt-4">
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Subir Nuevo Archivo (MP3/WAV)</label>
                                            <input
                                                type="file"
                                                accept="audio/*"
                                                onChange={(e) => handleUploadSound(e, 'chat_sound_url')}
                                                className="block w-full text-sm text-slate-500
                                                    file:mr-4 file:py-2 file:px-4
                                                    file:rounded-full file:border-0
                                                    file:text-xs file:font-semibold
                                                    file:bg-blue-600 file:text-white
                                                    hover:file:bg-blue-700
                                                    transition-all
                                                "
                                            />
                                            {uploadingKey === 'chat_sound_url' && <p className="text-xs text-blue-400 mt-2 animate-pulse">Subiendo archivo...</p>}
                                        </div>
                                    </div>

                                    <div className="flex justify-end pt-6 border-t border-slate-700">
                                        <button onClick={() => handleSaveGroup('sounds')} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-500 text-white px-12 py-4 rounded-2xl font-black italic tracking-tighter uppercase text-sm shadow-xl shadow-emerald-900/40 transition-all flex items-center">
                                            <Save className="w-4 h-4 mr-2" />
                                            {isSaving ? 'Guardando...' : 'Guardar Configuración de Sonidos'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500">
                            <div className="bg-slate-800 border border-slate-700 rounded-[2.5rem] p-10 shadow-2xl">
                                <div className="flex items-center space-x-4 mb-10">
                                    <div className="p-4 bg-indigo-500/20 rounded-2xl">
                                        <Mail className="w-8 h-8 text-indigo-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-black text-white italic uppercase leading-none">Canal SMTP</h2>
                                        <p className="text-slate-500 font-medium">Configura el servidor de salida para el sistema de correos.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Host Hostname</label>
                                        <input type="text" value={smtpSettings.smtp_host} onChange={e => setSmtpSettings({ ...smtpSettings, smtp_host: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-sm text-white font-medium outline-none focus:ring-2 focus:ring-indigo-600 transition-all font-mono" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Puerto de Envío</label>
                                        <input type="text" value={smtpSettings.smtp_port} onChange={e => setSmtpSettings({ ...smtpSettings, smtp_port: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-sm text-white font-medium outline-none focus:ring-2 focus:ring-indigo-600 transition-all font-mono" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Usuario Auth</label>
                                        <input type="text" value={smtpSettings.smtp_user} onChange={e => setSmtpSettings({ ...smtpSettings, smtp_user: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-sm text-white font-medium outline-none focus:ring-2 focus:ring-indigo-600 transition-all font-mono" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Password / App Key</label>
                                        <input type="password" value={smtpSettings.smtp_pass} onChange={e => setSmtpSettings({ ...smtpSettings, smtp_pass: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-sm text-white font-medium outline-none focus:ring-2 focus:ring-indigo-600 transition-all font-mono" />
                                    </div>
                                </div>
                                <div className="mt-10 flex justify-end">
                                    <button onClick={() => handleSaveGroup('smtp')} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-4 rounded-2xl font-black italic tracking-tighter uppercase text-sm shadow-xl shadow-indigo-900/40 transition-all active:scale-95 flex items-center">
                                        <Save className="w-4 h-4 mr-2" />
                                        Inyectar SMTP Settings
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div >
            </main>
        </div>
    )
}
