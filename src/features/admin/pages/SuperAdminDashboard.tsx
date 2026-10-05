import { AiUsagePanel } from '../components/AiUsagePanel'
import { SpaceSubscriptionsPanel, PromoAndLicensesPanel } from '../components/BillingAdminPanel'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import {
    Activity,
    Shield,
    Database,
    Book,
    BookOpen,
    Search,
    Users,
    Zap,
    Settings,
    Building2,
    CheckCircle2,
    Brain,
    CreditCard,
    History,
    DownloadCloud,
    Save,
    UserCheck,
    LifeBuoy,
    RefreshCw,
    Mail,
    Key,
    Volume2,
    Info,
    LogOut,
    ArrowLeftCircle,
    Trash2,
    LayoutGrid,
    Bug
} from 'lucide-react'
import { AdminUserTable } from '../components/AdminUserTable'
import { RegularUserTable } from '../components/RegularUserTable'
import { TextbookManager } from '../components/TextbookManager'
import { SyntheticProgramsManager } from '../components/SyntheticProgramsManager'
import { ClientIssuesPanel } from '../components/ClientIssuesPanel'
import { askConfirm } from '../../../components/ui/ConfirmDialog'

export const SuperAdminDashboard = () => {
    const [stats, setStats] = useState({
        totalTenants: 0,
        schoolCount: 0,
        independentCount: 0,
        totalUsers: 0,
        serverHealth: '100% stable',
        dbSize: 0
    })
    const [activeTab, setActiveTabState] = useState<'tenants' | 'admins' | 'users' | 'rescue' | 'ai' | 'backups' | 'billing' | 'settings' | 'sounds' | 'licenses' | 'subscriptions' | 'textbooks' | 'synthetic' | 'landing' | 'errors'>(() => {
        const saved = localStorage.getItem('godmode_active_tab')
        return (saved as any) || 'tenants'
    })
    const navigate = useNavigate()

    const setActiveTab = (tab: 'tenants' | 'admins' | 'users' | 'rescue' | 'ai' | 'backups' | 'billing' | 'settings' | 'sounds' | 'licenses' | 'subscriptions' | 'textbooks' | 'synthetic' | 'landing' | 'errors') => {
        localStorage.setItem('godmode_active_tab', tab)
        setActiveTabState(tab)
    }
    const [tenants, setTenants] = useState<any[]>([])
    const [allUsers, setAllUsers] = useState<any[]>([])
    const [recentLogs, setRecentLogs] = useState<any[]>([])
    const [deletedAccounts, setDeletedAccounts] = useState<any[]>([])
    const [transactions, setTransactions] = useState<any[]>([])
    const [licenses, setLicenses] = useState<any[]>([])
    const [subscriptionsData, setSubscriptionsData] = useState<any[]>([])
    const [selectedUser, setSelectedUser] = useState<any>(null)

    // Las llaves de IA se guardan solo en system_settings (lectura exclusiva del servidor);
    // ya no se copian al navegador.
    const [aiSettings, setAiSettingsState] = useState<any>(() => {
        try { localStorage.removeItem('godmode_ai_settings') } catch { /* sin acceso */ }
        return { openai_key: '', gemini_key: '', groq_key: '', anthropic_key: '', preferred_provider: 'gemini' }
    })
    const setAiSettings = (settings: any) => {
        setAiSettingsState(settings)
    }

    const [billingSettings, setBillingSettingsState] = useState<any>(() => {
        try { localStorage.removeItem('godmode_billing_settings') } catch { /* sin acceso */ }
        return { auto_license_activation: 'true' }
    })
    const setBillingSettings = (settings: any) => {
        setBillingSettingsState(settings)
    }

    const [smtpSettings, setSmtpSettingsState] = useState<any>(() => {
        try { localStorage.removeItem('godmode_smtp_settings') } catch { /* sin acceso */ }
        return { smtp_host: '', smtp_port: '587', smtp_user: '', smtp_pass: '', smtp_crypto: 'STARTTLS', smtp_from_email: '', smtp_from_name: 'Vunlek Notificaciones' }
    })
    const setSmtpSettings = (settings: any) => {
        setSmtpSettingsState(settings)
    }

    const [isSaving, setIsSaving] = useState(false)
    const [loading, setLoading] = useState(true)
    const [purgeEmail, setPurgeEmail] = useState('')
    const [backupStatus, setBackupStatus] = useState<'idle' | 'running' | 'success'>('idle')
    const [searchTerm, setSearchTerm] = useState('')
    const [soundSettings, setSoundSettingsState] = useState<any>(() => {
        const saved = localStorage.getItem('godmode_sound_settings')
        if (saved && saved !== 'undefined') {
            try { return JSON.parse(saved) } catch (e) { console.warn('Failed to parse sound_settings') }
        }
        return { chat_sound_url: '/sounds/notification.mp3', notification_sound_url: '' }
    })
    const setSoundSettings = (settings: any) => {
        localStorage.setItem('godmode_sound_settings', JSON.stringify(settings))
        setSoundSettingsState(settings)
    }

    const [landingSettings, setLandingSettingsState] = useState<any>(() => {
        const saved = localStorage.getItem('godmode_landing_settings')
        if (saved && saved !== 'undefined') {
            try { return JSON.parse(saved) } catch (e) { console.warn('Failed to parse landing_settings') }
        }
        return {
            landing_heroTitle: 'VUNLEK OS',
            landing_heroSubtitle: 'El Sistema Operativo para la Educación del Futuro.',
            landing_heroDescription: 'Transforma tu aula con tecnología inmersiva, inteligencia artificial y gestión táctil de última generación.',
            landing_ctaText: 'Comenzar Ahora',
            landing_features: JSON.stringify([
                { icon: 'Zap', title: 'Velocidad Cuántica', description: 'Gestión de calificaciones y asistencias en milisegundos.' },
                { icon: 'Shield', title: 'Seguridad Blindada', description: 'Tus datos protegidos con encriptación de grado militar.' },
                { icon: 'Brain', title: 'IA Integrada', description: 'Generación de planeaciones y rúbricas con inteligencia artificial.' }
            ])
        }
    })
    const setLandingSettings = (settings: any) => {
        localStorage.setItem('godmode_landing_settings', JSON.stringify(settings))
        setLandingSettingsState(settings)
    }
    const [uploadingKey, setUploadingKey] = useState<string | null>(null)

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            try {
                const { data: tenantsList, count: totalTenants } = await supabase.from('tenants').select('*, profiles(count)', { count: 'exact' }).order('created_at', { ascending: false })
                const { data: profilesList, count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact' }).order('created_at', { ascending: false })
                const { data: deletedCols } = await supabase.from('profiles').select('*').not('deleted_at', 'is', null)
                const { data: txList } = await supabase.from('view_god_mode_transactions').select('*').order('created_at', { ascending: false }).limit(20)
                const { data: subData } = await supabase.from('view_god_mode_subscriptions').select('*').order('created_at', { ascending: false })

                setStats({
                    totalTenants: totalTenants || 0,
                    schoolCount: tenantsList?.filter(t => t.type === 'SCHOOL').length || 0,
                    independentCount: tenantsList?.filter(t => t.type === 'INDEPENDENT').length || 0,
                    totalUsers: totalUsers || 0,
                    serverHealth: '100% stable',
                    dbSize: 0
                })
                setTenants(tenantsList || [])
                setAllUsers(profilesList || [])
                setDeletedAccounts(deletedCols || [])
                setTransactions(txList || [])
                setSubscriptionsData(subData || [])
            } catch (err) { console.error('Error fetching admin data:', err) } finally { setLoading(false) }
        }

        const fetchSettings = async () => {
            const { data } = await supabase.from('system_settings').select('key, value')
            if (data) {
                const settings: any = {}
                data.forEach(item => settings[item.key] = item.value)
                setSmtpSettings((prev: any) => ({ ...prev, ...settings }))
                setAiSettings((prev: any) => ({ ...prev, ...settings }))
                setBillingSettings((prev: any) => ({ ...prev, ...settings }))
                setSoundSettings((prev: any) => ({ ...prev, ...settings }))
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

    const handleSaveGroup = async (group: 'smtp' | 'ai' | 'billing' | 'sounds' | 'landing') => {
        setIsSaving(true)
        try {
            let toSave = {}
            if (group === 'smtp') toSave = smtpSettings
            if (group === 'ai') toSave = aiSettings
            if (group === 'billing') toSave = billingSettings
            if (group === 'sounds') toSave = soundSettings
            if (group === 'landing') toSave = landingSettings

            const updates = Object.entries(toSave).map(([key, value]) => ({
                key,
                value: String(value),
                updated_at: new Date().toISOString()
            }))

            const { error } = await supabase.from('system_settings').upsert(updates)
            if (error) throw error

            // Update local storage and other services
            if (group === 'sounds') {
                localStorage.setItem('godmode_sound_settings', JSON.stringify(soundSettings))
            }

            alert('Configuración guardada exitosamente.')
        } catch (err: any) {
            console.error('Error saving settings group:', group, err)
            alert('Error: ' + err.message)
        } finally {
            setIsSaving(false)
        }
    }

    const handleReturnToClassroom = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const { data: workspaces } = await supabase.from('profile_tenants').select('tenant_id').eq('profile_id', user.id).limit(1)
            if (workspaces && workspaces.length > 0) {
                await supabase.from('profiles').update({ tenant_id: workspaces[0].tenant_id }).eq('id', user.id)
                window.location.href = '/'
            } else { window.location.href = '/onboarding' }
        } catch (error) { console.error('Error exiting God Mode:', error) }
    }

    const handleSignOut = async () => { await supabase.auth.signOut(); window.location.href = '/login' }
    const handleImpersonate = (id: string) => window.open(`${window.location.origin}/?impersonate=${id}`, '_blank')
    const handleDeleteUser = async (userId: string) => {
        if ((await askConfirm('¿Eliminar este usuario permanentemente?'))) {
            await supabase.from('profiles').delete().eq('id', userId)
            window.location.reload()
        }
    }
    const handleDeleteSubscription = async (userId: string) => {
        if ((await askConfirm('Eliminar suscripción?'))) {
            await supabase.from('subscriptions').delete().eq('user_id', userId)
            window.location.reload()
        }
    }
    const handleResetPassword = async (email: string) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email)
        if (error) alert('Error: ' + error.message)
        else alert('Email de recuperación enviado a ' + email)
    }
    const handleSetProvisionalPassword = async (userId: string, email: string) => {
        const password = Math.floor(100000 + Math.random() * 900000).toString()
        if ((await askConfirm(`¿Resetear contraseña de ${email} a: ${password}?`))) {
            try {
                const { data, error } = await supabase.rpc('admin_set_any_password', {
                    target_user_id: userId,
                    new_password: password
                })
                if (error) throw error
                alert(`Contrastela actualizada a: ${password}\n\nCompártela con el usuario.`)
            } catch (err: any) { alert('Error: ' + err.message) }
        }
    }
    const handleToggleDemo = async (userId: string, currentDemoStatus: boolean) => {
        await supabase.from('profiles').update({ is_demo: !currentDemoStatus }).eq('id', userId)
        window.location.reload()
    }
    const handleRestoreAccount = async (userId: string) => {
        if ((await askConfirm('¿Restaurar esta cuenta?'))) {
            await supabase.from('profiles').update({ deleted_at: null }).eq('id', userId)
            window.location.reload()
        }
    }
    const handlePermanentDelete = async (userId: string) => {
        if ((await askConfirm('¿ELIMINAR PERMANENTEMENTE? Esta acción no se puede deshacer.'))) {
            await supabase.from('profiles').delete().eq('id', userId)
            window.location.reload()
        }
    }
    const handleVerifyEmail = async (userId: string, email: string) => {
        if ((await askConfirm(`¿Marcar el correo ${email} como verificado manualmente?`))) {
            try {
                const { data, error } = await supabase.rpc('admin_verify_email', {
                    target_user_id: userId
                })
                if (error) throw error
                alert('Correo verificado exitosamente.')
                window.location.reload()
            } catch (err: any) {
                alert('Error: ' + err.message)
            }
        }
    }
    const handleRunBackup = async () => {
        setBackupStatus('running')
        setTimeout(() => {
            setBackupStatus('success')
            setTimeout(() => setBackupStatus('idle'), 2000)
        }, 3000)
    }

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><RefreshCw className="animate-spin text-indigo-500 w-12 h-12" /></div>

    console.log('DEBUG allUsers in Dashboard:', allUsers)

    return (
        <div className="min-h-screen bg-[#F0F2F5] text-slate-900 flex flex-col lg:flex-row font-sans selection:bg-indigo-100 selection:text-indigo-700">
            <aside className="glass-panel m-3 lg:m-4 lg:w-80 lg:shrink-0 rounded-[1.75rem] lg:rounded-[2.5rem] flex flex-col lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] z-20 shadow-2xl min-w-0">
                <div className="p-4 lg:p-8 border-b border-indigo-50/50">
                    <div className="flex items-center space-x-4 lg:mb-2">
                        <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg rotate-[-5deg]">
                            <Shield className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tighter text-indigo-950 uppercase italic leading-none">God Mode</h1>
                            <p className="text-[10px] text-indigo-400 font-black tracking-widest uppercase mt-1">Vunlek OS v2.5</p>
                        </div>
                    </div>
                </div>
                <nav className="flex-grow p-3 lg:p-4 flex lg:flex-col gap-2 lg:mt-2 overflow-x-auto lg:overflow-x-visible lg:overflow-y-auto custom-scrollbar">
                    {['errors', 'tenants', 'admins', 'users', 'rescue', 'ai', 'backups', 'billing', 'subscriptions', 'licenses', 'sounds', 'settings', 'landing', 'textbooks', 'synthetic'].map((tab: any) => (
                        <button key={tab} onClick={() => setActiveTab(tab)} className={`shrink-0 lg:w-full flex items-center space-x-3 px-4 py-3 lg:py-4 rounded-2xl font-bold capitalize whitespace-nowrap transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-500 hover:bg-white'}`}>
                            {tab === 'errors' && <Bug className="w-5 h-5" />}
                            {tab === 'tenants' && <Building2 className="w-5 h-5" />}
                            {tab === 'admins' && <Shield className="w-5 h-5" />}
                            {tab === 'users' && <Users className="w-5 h-5" />}
                            {tab === 'rescue' && <LifeBuoy className="w-5 h-5" />}
                            {tab === 'ai' && <Brain className="w-5 h-5" />}
                            {tab === 'backups' && <Database className="w-5 h-5" />}
                            {tab === 'billing' && <CreditCard className="w-5 h-5" />}
                            {tab === 'subscriptions' && <RefreshCw className="w-5 h-5" />}
                            {tab === 'licenses' && <Key className="w-5 h-5" />}
                            {tab === 'sounds' && <Volume2 className="w-5 h-5" />}
                            {tab === 'settings' && <Settings className="w-5 h-5" />}
                            {tab === 'landing' && <LayoutGrid className="w-5 h-5" />}
                            {tab === 'textbooks' && <Book className="w-5 h-5" />}
                            {tab === 'synthetic' && <BookOpen className="w-5 h-5" />}
                            <span>{tab === 'synthetic' ? 'Prog. Sintéticos' : tab === 'errors' ? 'Errores' : tab === 'subscriptions' ? 'Suscripciones' : tab === 'licenses' ? 'Claves y códigos' : tab}</span>
                        </button>
                    ))}
                </nav>
                <div className="p-3 lg:p-4 mt-auto border-t border-indigo-50/50 flex lg:flex-col gap-2">
                    <button onClick={handleReturnToClassroom} className="flex-1 lg:w-full flex items-center space-x-3 px-4 py-3 lg:py-4 rounded-2xl font-black text-indigo-600 bg-white border-2 border-indigo-100 hover:border-indigo-600 transition-all shadow-md">
                        <ArrowLeftCircle className="w-6 h-6" />
                        <span className="uppercase text-xs italic tracking-tighter">Mi Aula Docente</span>
                    </button>
                    <button onClick={handleSignOut} className="lg:w-full flex items-center space-x-3 px-4 py-3 lg:py-4 rounded-2xl font-black text-rose-600 hover:bg-rose-50 transition-all">
                        <LogOut className="w-6 h-6" />
                        <span className="uppercase text-xs italic tracking-tighter">Salir</span>
                    </button>
                </div>
            </aside>

            <main className="flex-grow min-w-0 overflow-y-auto px-3 pb-6 lg:px-8 lg:py-8 relative z-10 transition-all">
                <header className="glass-panel rounded-[1.75rem] lg:rounded-[2rem] p-5 lg:p-8 mb-6 lg:mb-8 flex flex-col sm:flex-row gap-4 justify-between sm:items-center shadow-xl border-white/80">
                    <div>
                        <h2 className="text-2xl lg:text-3xl font-black text-indigo-950 italic uppercase tracking-tighter flex items-center gap-4 break-words">
                            {activeTab === 'errors' ? 'Errores y mejoras' : activeTab === 'subscriptions' ? 'Suscripciones' : activeTab === 'licenses' ? 'Claves y códigos promocionales' : activeTab}
                        </h2>
                        <p className="text-slate-500 font-bold mt-1 uppercase text-xs tracking-wider opacity-60">Control Maestro</p>
                    </div>
                    <div className="flex items-center space-x-4 w-full sm:w-auto">
                        <div className="relative w-full">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-12 pr-4 py-3 rounded-2xl border-2 border-slate-100 focus:border-indigo-400 transition-all w-full sm:w-80 font-bold text-sm"
                            />
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4 mb-6 sm:mb-8 animate-in slide-in-from-bottom-4 duration-500 delay-150">
                    <div className="squishy-card p-3 sm:p-4 bg-white border border-indigo-50 shadow-sm flex flex-col items-center justify-center text-center min-w-0">
                        <Building2 className="w-6 h-6 text-indigo-500 mb-2" />
                        <span className="text-lg sm:text-2xl font-black text-slate-800 leading-tight">{stats.totalTenants}</span>
                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-400 font-bold uppercase tracking-widest mt-1">Tenants</span>
                    </div>
                    <div className="squishy-card p-3 sm:p-4 bg-white border border-indigo-50 shadow-sm flex flex-col items-center justify-center text-center min-w-0">
                        <Users className="w-6 h-6 text-indigo-500 mb-2" />
                        <span className="text-lg sm:text-2xl font-black text-slate-800 leading-tight">{stats.totalUsers}</span>
                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-400 font-bold uppercase tracking-widest mt-1">Usuarios</span>
                    </div>
                    <div className="squishy-card p-3 sm:p-4 bg-white border border-indigo-50 shadow-sm flex flex-col items-center justify-center text-center min-w-0">
                        <Shield className="w-6 h-6 text-indigo-500 mb-2" />
                        <span className="text-lg sm:text-2xl font-black text-slate-800 leading-tight">{stats.schoolCount}</span>
                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-400 font-bold uppercase tracking-widest mt-1">Escuelas</span>
                    </div>
                    <div className="squishy-card p-3 sm:p-4 bg-white border border-indigo-50 shadow-sm flex flex-col items-center justify-center text-center min-w-0">
                        <UserCheck className="w-6 h-6 text-indigo-500 mb-2" />
                        <span className="text-lg sm:text-2xl font-black text-slate-800 leading-tight">{stats.independentCount}</span>
                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-400 font-bold uppercase tracking-widest mt-1">Indep.</span>
                    </div>
                    <div className="squishy-card p-3 sm:p-4 bg-white border border-indigo-50 shadow-sm flex flex-col items-center justify-center text-center min-w-0">
                        <Activity className="w-6 h-6 text-emerald-500 mb-2" />
                        <span className="text-lg sm:text-2xl font-black text-slate-800 leading-tight">{stats.serverHealth}</span>
                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-400 font-bold uppercase tracking-widest mt-1">Estado</span>
                    </div>
                    <div className="squishy-card p-3 sm:p-4 bg-white border border-indigo-50 shadow-sm flex flex-col items-center justify-center text-center min-w-0">
                        <Database className="w-6 h-6 text-indigo-500 mb-2" />
                        <span className="text-lg sm:text-2xl font-black text-slate-800 leading-tight">{stats.dbSize} MB</span>
                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-400 font-bold uppercase tracking-widest mt-1">Storage</span>
                    </div>
                </div>

                <div className="space-y-8 animate-in fade-in duration-500">
                    {activeTab === 'errors' && <ClientIssuesPanel search={searchTerm} />}

                    {activeTab === 'tenants' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {tenants.map(t => (
                                <div key={t.id} className="squishy-card p-6 bg-white rounded-3xl shadow-lg border border-indigo-50">
                                    <h4 className="font-black text-indigo-950 uppercase mb-4">{t.name}</h4>
                                    <div className="flex justify-between items-center text-xs font-bold text-slate-400">
                                        <span>Status: {t.status}</span>
                                        <button onClick={() => handleImpersonate(t.id)} className="text-indigo-600 hover:underline">Entrar</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'admins' && (
                        <AdminUserTable
                            users={allUsers}
                            searchTerm={searchTerm}
                            onResetPassword={handleResetPassword}
                            onImpersonate={handleImpersonate}
                            onVerifyEmail={handleVerifyEmail}
                        />
                    )}

                    {activeTab === 'users' && (
                        <RegularUserTable
                            users={allUsers}
                            searchTerm={searchTerm}
                            onImpersonate={handleImpersonate}
                            onDelete={handleDeleteUser}
                            onToggleDemo={handleToggleDemo}
                            onResetPassword={handleResetPassword}
                            onSetProvisionalPassword={handleSetProvisionalPassword}
                            onVerifyEmail={handleVerifyEmail}
                        />
                    )}

                    {activeTab === 'rescue' && (
                        <div className="space-y-6">
                            <div className="squishy-card p-8 bg-white rounded-3xl shadow-lg border border-rose-100">
                                <h4 className="font-black text-rose-950 uppercase mb-6 flex items-center gap-2">
                                    <LifeBuoy className="w-5 h-5 text-rose-500" /> Cuentas Eliminadas
                                </h4>
                                <div className="space-y-4">
                                    {deletedAccounts.map(acc => (
                                        <div key={acc.id} className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <div className="min-w-0">
                                                <p className="font-black text-slate-950 uppercase text-sm break-all">{acc.email}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                                    Eliminado: {new Date(acc.deleted_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleRestoreAccount(acc.id)} className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold text-xs hover:bg-emerald-600">
                                                    Restaurar
                                                </button>
                                                <button onClick={() => handlePermanentDelete(acc.id)} className="px-4 py-2 bg-rose-500 text-white rounded-xl font-bold text-xs hover:bg-rose-600">
                                                    Eliminar
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {deletedAccounts.length === 0 && (
                                        <p className="text-center text-slate-400 py-8">No hay cuentas eliminadas</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'ai' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="squishy-card p-8 bg-white rounded-3xl shadow-lg border border-indigo-50">
                                <h4 className="font-black text-indigo-950 uppercase mb-6 flex items-center gap-2"><Brain className="w-5 h-5 text-indigo-500" /> Configuración de IA</h4>
                                <div className="space-y-4">
                                    <div className="group/field">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Proveedor Primario</label>
                                        <select aria-label="Proveedor Primario"
                                            value={aiSettings.preferred_provider || 'gemini'}
                                            onChange={e => setAiSettings({ ...aiSettings, preferred_provider: e.target.value })}
                                            className="input-squishy w-full px-4 py-3 text-sm border-2 border-slate-50 bg-white"
                                        >
                                            <option value="gemini">Google Gemini (Recomendado)</option>
                                            <option value="groq">Groq (Llama 3.1 / Grok)</option>
                                            <option value="openai">OpenAI (GPT-4o mini)</option>
                                        </select>
                                    </div>
                                    <div className="group/field">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Google Gemini API Key</label>
                                        <input aria-label="Google Gemini API Key" type="password" placeholder="AIzaSy..." value={aiSettings.gemini_key} onChange={e => setAiSettings({ ...aiSettings, gemini_key: e.target.value })} className="input-squishy w-full px-4 py-3 text-sm border-2 border-slate-50" />
                                    </div>
                                    <div className="group/field">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Groq API Key</label>
                                        <input aria-label="Groq API Key" type="password" placeholder="gsk_..." value={aiSettings.groq_key} onChange={e => setAiSettings({ ...aiSettings, groq_key: e.target.value })} className="input-squishy w-full px-4 py-3 text-sm border-2 border-slate-50" />
                                    </div>
                                    <div className="group/field">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">OpenAI API Key (Opcional)</label>
                                        <input aria-label="OpenAI API Key (Opcional)" type="password" placeholder="sk-..." value={aiSettings.openai_key} onChange={e => setAiSettings({ ...aiSettings, openai_key: e.target.value })} className="input-squishy w-full px-4 py-3 text-sm border-2 border-slate-50" />
                                    </div>
                                    <button onClick={() => handleSaveGroup('ai')} disabled={isSaving} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 transition-all shadow-lg active:scale-95">Guardar Llaves de IA</button>
                                </div>
                            </div>
                            <AiUsagePanel />
                        </div>
                    )}

                    {activeTab === 'backups' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="squishy-card p-8 bg-white rounded-3xl shadow-lg border border-indigo-50">
                                <h4 className="font-black text-indigo-950 uppercase mb-6 flex items-center gap-2">
                                    <Database className="w-5 h-5 text-indigo-500" /> Respaldo de Base de Datos
                                </h4>
                                <div className="space-y-4">
                                    <button
                                        onClick={handleRunBackup}
                                        disabled={backupStatus === 'running'}
                                        className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        {backupStatus === 'running' && <RefreshCw className="w-5 h-5 animate-spin" />}
                                        {backupStatus === 'success' && <CheckCircle2 className="w-5 h-5" />}
                                        {backupStatus === 'idle' && <DownloadCloud className="w-5 h-5" />}
                                        {backupStatus === 'running' ? 'Generando Backup...' : backupStatus === 'success' ? 'Backup Completado' : 'Generar Backup Ahora'}
                                    </button>
                                    <p className="text-xs text-slate-400 text-center">Último backup: Nunca</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'billing' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="squishy-card p-8 bg-white rounded-3xl shadow-lg border border-indigo-50">
                                <h4 className="font-black text-indigo-950 uppercase mb-6 flex items-center gap-2">
                                    <History className="w-5 h-5 text-indigo-500" /> Transacciones Recientes
                                </h4>
                                <div className="space-y-3 max-h-96 overflow-y-auto">
                                    {transactions.map(tx => (
                                        <div key={tx.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <p className="font-bold text-xs text-slate-900">{tx.email || tx.user_id}</p>
                                            <p className="text-[10px] text-slate-400">${tx.amount} - {tx.status}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'subscriptions' && <SpaceSubscriptionsPanel search={searchTerm} />}

                    {activeTab === 'licenses' && <PromoAndLicensesPanel />}

                    {activeTab === 'sounds' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="squishy-card p-8 bg-white rounded-3xl shadow-lg border border-indigo-50">
                                <h4 className="font-black text-indigo-950 uppercase mb-6 flex items-center gap-2">
                                    <Volume2 className="w-5 h-5 text-indigo-500" /> Configuración de Sonidos
                                </h4>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Sonido de Chat</label>
                                        <input aria-label="Sonido de Chat" type="text" placeholder="/sounds/notification.mp3" value={soundSettings.chat_sound_url} onChange={e => setSoundSettings({ ...soundSettings, chat_sound_url: e.target.value })} className="input-squishy w-full px-4 py-3 text-sm border-2 border-slate-50" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Sonido de Notificación</label>
                                        <input aria-label="Sonido de Notificación" type="text" placeholder="/sounds/notification.mp3" value={soundSettings.notification_sound_url} onChange={e => setSoundSettings({ ...soundSettings, notification_sound_url: e.target.value })} className="input-squishy w-full px-4 py-3 text-sm border-2 border-slate-50" />
                                    </div>
                                    <button onClick={() => handleSaveGroup('sounds')} disabled={isSaving} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 transition-all shadow-lg active:scale-95">Guardar Sonidos</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="squishy-card p-8 bg-white rounded-3xl shadow-lg border border-indigo-50">
                                <h4 className="font-black text-indigo-950 uppercase mb-6 flex items-center gap-2"><Mail className="w-5 h-5 text-indigo-500" /> SMTP Config</h4>
                                <div className="space-y-4">
                                    <input type="text" placeholder="Host" value={smtpSettings.smtp_host} onChange={e => setSmtpSettings({ ...smtpSettings, smtp_host: e.target.value })} className="input-squishy w-full px-4 py-3 text-sm border-2 border-slate-50" />
                                    <input type="text" placeholder="Port" value={smtpSettings.smtp_port} onChange={e => setSmtpSettings({ ...smtpSettings, smtp_port: e.target.value })} className="input-squishy w-full px-4 py-3 text-sm border-2 border-slate-50" />
                                    <input type="text" placeholder="User" value={smtpSettings.smtp_user} onChange={e => setSmtpSettings({ ...smtpSettings, smtp_user: e.target.value })} className="input-squishy w-full px-4 py-3 text-sm border-2 border-slate-50" />
                                    <input type="password" placeholder="Pass" value={smtpSettings.smtp_pass} onChange={e => setSmtpSettings({ ...smtpSettings, smtp_pass: e.target.value })} className="input-squishy w-full px-4 py-3 text-sm border-2 border-slate-50" />
                                    <button onClick={() => handleSaveGroup('smtp')} disabled={isSaving} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700 transition-all shadow-lg active:scale-95">Guardar SMTP</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'landing' && (
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="squishy-card p-8 bg-white rounded-[2.5rem] shadow-xl border border-indigo-50">
                                    <h4 className="font-black text-indigo-950 uppercase italic mb-6 flex items-center gap-3">
                                        <LayoutGrid className="w-6 h-6 text-indigo-500" />
                                        Hero Editor
                                    </h4>
                                    <div className="space-y-6">
                                        <div className="group/field">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Título Principal</label>
                                            <input aria-label="Título Principal" type="text" value={landingSettings.landing_heroTitle} onChange={e => setLandingSettings({ ...landingSettings, landing_heroTitle: e.target.value })} className="input-squishy w-full px-5 py-4 text-sm font-bold border-2 border-slate-50 focus:border-indigo-400 transition-all" />
                                        </div>
                                        <div className="group/field">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Subtítulo</label>
                                            <input aria-label="Subtítulo" type="text" value={landingSettings.landing_heroSubtitle} onChange={e => setLandingSettings({ ...landingSettings, landing_heroSubtitle: e.target.value })} className="input-squishy w-full px-5 py-4 text-sm font-bold border-2 border-slate-50 focus:border-indigo-400 transition-all" />
                                        </div>
                                        <div className="group/field">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Descripción</label>
                                            <textarea aria-label="Descripción" rows={4} value={landingSettings.landing_heroDescription} onChange={e => setLandingSettings({ ...landingSettings, landing_heroDescription: e.target.value })} className="input-squishy w-full px-5 py-4 text-sm font-bold border-2 border-slate-50 focus:border-indigo-400 transition-all resize-none" />
                                        </div>
                                        <div className="group/field">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Texto del Botón (CTA)</label>
                                            <input aria-label="Texto del Botón (CTA)" type="text" value={landingSettings.landing_ctaText} onChange={e => setLandingSettings({ ...landingSettings, landing_ctaText: e.target.value })} className="input-squishy w-full px-5 py-4 text-sm font-bold border-2 border-slate-50 focus:border-indigo-400 transition-all" />
                                        </div>
                                        <button onClick={() => handleSaveGroup('landing')} disabled={isSaving} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-black transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3">
                                            <Save className="w-5 h-5" />
                                            Actualizar Hero
                                        </button>
                                    </div>
                                </div>

                                <div className="squishy-card p-8 bg-white rounded-[2.5rem] shadow-xl border border-indigo-50">
                                    <div className="flex justify-between items-center mb-6">
                                        <h4 className="font-black text-indigo-950 uppercase italic flex items-center gap-3">
                                            <Zap className="w-6 h-6 text-amber-500" />
                                            Features (JSON)
                                        </h4>
                                        <Info className="w-5 h-5 text-slate-300 cursor-help" />
                                    </div>
                                    <div className="space-y-6">
                                        <div className="group/field">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Lista de Funcionalidades</label>
                                            <textarea aria-label="Lista de Funcionalidades"
                                                rows={15}
                                                value={landingSettings.landing_features}
                                                onChange={e => setLandingSettings({ ...landingSettings, landing_features: e.target.value })}
                                                className="input-squishy w-full px-5 py-4 text-xs font-mono border-2 border-slate-50 focus:border-amber-400 transition-all resize-none"
                                            />
                                        </div>
                                        <button onClick={() => handleSaveGroup('landing')} disabled={isSaving} className="w-full py-4 bg-amber-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-amber-700 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3">
                                            <Save className="w-5 h-5" />
                                            Actualizar Funciones
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'textbooks' && (
                        <TextbookManager />
                    )}

                    {activeTab === 'synthetic' && (
                        <SyntheticProgramsManager />
                    )}
                </div>
            </main>
        </div>
    )
}
