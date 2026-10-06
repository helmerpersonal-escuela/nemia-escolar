import { AiUsagePanel } from '../components/AiUsagePanel'
import { SpaceSubscriptionsPanel, PromoAndLicensesPanel, SalesLeadsCard } from '../components/BillingAdminPanel'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import {
    Database, Book, BookOpen, Search, Users, Zap, Settings, Building2, CheckCircle2, Brain, CreditCard, History,
    Save, UserRound, RefreshCw, Mail, Key, Volume2, Info, LogOut, ArrowLeftCircle, LayoutGrid, Bug, Shield, UserMinus, X, AlertTriangle,
} from 'lucide-react'
import { TextbookManager } from '../components/TextbookManager'
import { SyntheticProgramsManager } from '../components/SyntheticProgramsManager'
import { ClientIssuesPanel } from '../components/ClientIssuesPanel'
import { ADMIN_PEOPLE_KEY, ADMIN_SPACES_KEY, fetchAdminPeople, PeoplePanel, type Notify } from '../components/PeoplePanel'
import { fetchAdminSpaces, SpacesPanel } from '../components/SpacesPanel'

type TabId = 'leads' | 'errors' | 'tenants' | 'users' | 'subscriptions' | 'licenses' | 'billing' | 'textbooks' | 'synthetic' | 'landing' | 'ai' | 'settings' | 'sounds' | 'backups'

/** Secciones del panel, agrupadas por lo que el administrador viene a hacer. */
const SECTIONS: { group: string; items: { id: TabId; label: string; icon: any; help: string }[] }[] = [
    { group: 'Día a día', items: [
        { id: 'users', label: 'Personas y cuentas', icon: Users, help: 'Busca a una persona, entra a ver lo que ve, ayúdale con su acceso o da de baja su cuenta.' },
        { id: 'tenants', label: 'Escuelas y espacios', icon: Building2, help: 'Cada escuela o docente independiente, con sus miembros, grupos y alumnos.' },
        { id: 'errors', label: 'Errores y mejoras', icon: Bug, help: 'Lo que la app reportó sola y lo que pidieron los usuarios.' },
    ] },
    { group: 'Suscripciones', items: [
        { id: 'leads', label: 'Presupuestos de escuelas', icon: Building2, help: 'Escuelas que pidieron presupuesto: sus datos, docentes y alumnos, para contactarlas.' },
        { id: 'subscriptions', label: 'Suscripciones', icon: RefreshCw, help: 'Estado de la suscripción de cada espacio.' },
        { id: 'licenses', label: 'Claves y códigos', icon: Key, help: 'Claves de licencia y códigos promocionales.' },
        { id: 'billing', label: 'Movimientos', icon: CreditCard, help: 'Pagos registrados.' },
    ] },
    { group: 'Contenido', items: [
        { id: 'textbooks', label: 'Libros de texto', icon: Book, help: 'Catálogo de libros de texto gratuitos.' },
        { id: 'synthetic', label: 'Programas sintéticos', icon: BookOpen, help: 'Contenidos y procesos de desarrollo de aprendizaje.' },
        { id: 'landing', label: 'Página de inicio', icon: LayoutGrid, help: 'Textos de la página pública.' },
    ] },
    { group: 'Sistema', items: [
        { id: 'ai', label: 'Inteligencia artificial', icon: Brain, help: 'Proveedor, llaves y consumo.' },
        { id: 'settings', label: 'Correo (SMTP)', icon: Mail, help: 'Servidor con el que se envían los correos.' },
        { id: 'sounds', label: 'Sonidos', icon: Volume2, help: 'Sonidos de avisos y chat.' },
        { id: 'backups', label: 'Respaldos', icon: Database, help: 'Dónde están los respaldos de la base de datos.' },
    ] },
]
const ALL_TABS = SECTIONS.flatMap(g => g.items)
// Pestañas de la versión anterior que ahora viven dentro de "Personas y cuentas"
const OLD_TABS: Record<string, TabId> = { admins: 'users', rescue: 'users' }

export const SuperAdminDashboard = () => {
    const [activeTab, setActiveTabState] = useState<TabId>(() => {
        const saved = localStorage.getItem('godmode_active_tab') ?? ''
        const id = (OLD_TABS[saved] ?? saved) as TabId
        return ALL_TABS.some(t => t.id === id) ? id : 'users'
    })
    const setActiveTab = (tab: TabId) => {
        localStorage.setItem('godmode_active_tab', tab)
        setActiveTabState(tab)
        setSearchTerm('')
    }
    const [peopleFilter, setPeopleFilter] = useState<'active' | 'admins' | 'deleted' | undefined>(undefined)
    const [spaceFilter, setSpaceFilter] = useState<{ id: string; name: string } | null>(null)
    const [transactions, setTransactions] = useState<any[]>([])

    // Avisos de resultado (en lugar de ventanas emergentes y recargas de página)
    const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null)
    const noticeTimer = useRef<number | undefined>(undefined)
    const notify: Notify = useCallback((tone, text) => {
        window.clearTimeout(noticeTimer.current)
        setNotice({ tone, text })
        // Los errores se quedan hasta que se cierran; lo demás se va solo
        if (tone !== 'error') noticeTimer.current = window.setTimeout(() => setNotice(null), 7000)
    }, [])

    const { data: people = [] } = useQuery({ queryKey: ADMIN_PEOPLE_KEY, queryFn: fetchAdminPeople, staleTime: 30_000 })
    const { data: spaces = [] } = useQuery({ queryKey: ADMIN_SPACES_KEY, queryFn: fetchAdminSpaces, staleTime: 30_000 })

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

    useEffect(() => {
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
        const fetchTransactions = async () => {
            const { data } = await supabase.from('view_god_mode_transactions').select('*').order('created_at', { ascending: false }).limit(20)
            setTransactions(data || [])
        }
        void fetchSettings()
        void fetchTransactions()
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

            notify('success', 'Configuración guardada.')
        } catch (err: any) {
            console.error('Error saving settings group:', group, err)
            notify('error', err.message)
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

    const current = ALL_TABS.find(t => t.id === activeTab) ?? ALL_TABS[0]
    const searchable = ['users', 'tenants', 'errors', 'subscriptions'].includes(activeTab)
    const goPeople = (filter: 'active' | 'admins' | 'deleted') => { setSpaceFilter(null); setPeopleFilter(filter); setActiveTab('users') }
    const summary = [
        { label: 'Escuelas', value: spaces.filter(s => s.type === 'SCHOOL').length, icon: Building2, onClick: () => setActiveTab('tenants') },
        { label: 'Docentes independientes', value: spaces.filter(s => s.type === 'INDEPENDENT').length, icon: UserRound, onClick: () => setActiveTab('tenants') },
        { label: 'Cuentas activas', value: people.filter(p => !p.deleted_at).length, icon: Users, onClick: () => goPeople('active') },
        { label: 'Dadas de baja', value: people.filter(p => p.deleted_at).length, icon: UserMinus, onClick: () => goPeople('deleted') },
    ]

    return (
        <div className="min-h-screen bg-[#F0F2F5] text-slate-900 flex flex-col lg:flex-row font-sans">
            <aside className="bg-white m-3 lg:m-4 lg:w-72 lg:shrink-0 rounded-3xl border border-slate-200 flex flex-col lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] z-20 min-w-0">
                <div className="p-4 lg:p-5 border-b border-slate-100 flex items-center gap-3">
                    <div className="bg-indigo-600 p-2.5 rounded-2xl"><Shield className="w-5 h-5 text-white" /></div>
                    <div>
                        <h1 className="text-lg font-black tracking-tight text-slate-900 leading-none">Modo dios</h1>
                        <p className="text-[11px] text-slate-500 font-bold mt-1">Administración de VUNLEK</p>
                    </div>
                </div>
                <nav aria-label="Secciones" className="flex-grow p-3 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible lg:overflow-y-auto">
                    {SECTIONS.map(group => (
                        <div key={group.group} className="flex lg:flex-col gap-1 lg:mb-3 shrink-0">
                            <p className="hidden lg:block px-3 pt-2 pb-1 text-[11px] font-black uppercase tracking-widest text-slate-400">{group.group}</p>
                            {group.items.map(item => (
                                <button key={item.id} onClick={() => setActiveTab(item.id)} aria-current={activeTab === item.id ? 'page' : undefined}
                                    className={`shrink-0 lg:w-full flex items-center gap-3 min-h-11 px-3.5 py-2.5 rounded-2xl text-sm font-bold whitespace-nowrap text-left transition ${activeTab === item.id ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                                    <item.icon className="w-5 h-5 shrink-0" /> {item.label}
                                </button>
                            ))}
                        </div>
                    ))}
                </nav>
                <div className="p-3 border-t border-slate-100 flex lg:flex-col gap-2">
                    <button onClick={handleReturnToClassroom} className="flex-1 lg:w-full flex items-center gap-3 min-h-11 px-3.5 rounded-2xl text-sm font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-100">
                        <ArrowLeftCircle className="w-5 h-5" /> Volver a mi aula
                    </button>
                    <button onClick={handleSignOut} className="lg:w-full flex items-center gap-3 min-h-11 px-3.5 rounded-2xl text-sm font-black text-rose-600 hover:bg-rose-50">
                        <LogOut className="w-5 h-5" /> Salir
                    </button>
                </div>
            </aside>

            <main className="flex-grow min-w-0 px-3 pb-10 lg:px-6 lg:py-4">
                <header className="mb-5 flex flex-col sm:flex-row gap-4 justify-between sm:items-end">
                    <div className="min-w-0">
                        <h2 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">{current.label}</h2>
                        <p className="text-sm text-slate-600 mt-1">{current.help}</p>
                    </div>
                    {searchable && (
                        <div className="relative w-full sm:w-80 shrink-0">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input type="search" aria-label="Buscar en esta sección" placeholder={activeTab === 'users' ? 'Nombre, correo, puesto o escuela' : 'Buscar…'}
                                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                className="pl-12 pr-4 min-h-12 rounded-2xl border-2 border-slate-200 focus:border-indigo-400 outline-none w-full font-bold text-sm bg-white" />
                        </div>
                    )}
                </header>

                {(activeTab === 'users' || activeTab === 'tenants') && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                        {summary.map(c => (
                            <button key={c.label} onClick={c.onClick} className="bg-white border border-slate-200 rounded-2xl p-4 text-left hover:border-indigo-300 transition min-w-0">
                                <c.icon className="w-5 h-5 text-indigo-500" />
                                <p className="text-2xl font-black text-slate-900 leading-tight mt-1">{c.value}</p>
                                <p className="text-xs font-bold text-slate-500">{c.label}</p>
                            </button>
                        ))}
                    </div>
                )}

                {notice && (
                    <div role={notice.tone === 'error' ? 'alert' : 'status'}
                        className={`fixed z-[130] left-3 right-3 sm:left-auto sm:right-6 bottom-4 sm:max-w-md flex items-start gap-3 p-4 rounded-2xl shadow-2xl border-2 text-sm font-bold ${notice.tone === 'error' ? 'bg-rose-50 border-rose-200 text-rose-900' : notice.tone === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-white border-slate-200 text-slate-800'}`}>
                        {notice.tone === 'error' ? <AlertTriangle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0" />}
                        <span className="flex-1">{notice.text}</span>
                        <button onClick={() => setNotice(null)} aria-label="Cerrar aviso" className="p-1 -m-1 rounded-lg hover:bg-black/5"><X className="w-4 h-4" /></button>
                    </div>
                )}

                <div className="space-y-8">
                    {activeTab === 'errors' && <ClientIssuesPanel search={searchTerm} />}

                    {activeTab === 'tenants' && (
                        <SpacesPanel search={searchTerm} onSeeMembers={space => { setSpaceFilter(space); setPeopleFilter('active'); setActiveTab('users') }} />
                    )}

                    {activeTab === 'users' && (
                        <PeoplePanel search={searchTerm} notify={notify} initialFilter={peopleFilter}
                            spaceFilter={spaceFilter} onClearSpace={() => setSpaceFilter(null)} />
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
                        <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-2xl space-y-3">
                            <h4 className="font-black text-slate-900 flex items-center gap-2"><Database className="w-5 h-5 text-indigo-500" /> Respaldos de la base de datos</h4>
                            <p className="text-sm text-slate-600">VUNLEK no genera respaldos desde esta pantalla. Los respaldos los hace Supabase, según el plan del proyecto, y se consultan y restauran en su panel: <b>Database → Backups</b>.</p>
                            <p className="text-sm text-slate-600">Antes de un cambio grande (por ejemplo, borrar cuentas en lote) conviene revisar ahí la fecha del último respaldo.</p>
                        </div>
                    )}

                    {activeTab === 'billing' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="squishy-card p-8 bg-white rounded-3xl shadow-lg border border-indigo-50">
                                <h4 className="font-black text-indigo-950 uppercase mb-6 flex items-center gap-2">
                                    <History className="w-5 h-5 text-indigo-500" /> Movimientos recientes
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

                    {activeTab === 'leads' && <SalesLeadsCard onOpenKeys={() => setActiveTab('licenses')} />}

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
