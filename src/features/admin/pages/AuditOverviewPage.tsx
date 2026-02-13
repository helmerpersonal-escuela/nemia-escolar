import { ShieldCheck, AlertCircle, CheckCircle2, Layout, Database, Server, Smartphone, Lock, Eye, Zap, TrendingUp, Accessibility, Palette, BookOpen, RefreshCcw, Link, History } from 'lucide-react'

const AuditItem = ({ title, status, description, icon: Icon }: any) => (
    <div className="flex items-start p-4 bg-white/50 backdrop-blur-sm rounded-2xl border border-gray-100 hover:shadow-lg transition-all duration-300 group">
        <div className={`p-3 rounded-xl mr-4 ${status === 'PASS' ? 'bg-emerald-100 text-emerald-600' : status === 'WARN' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
            <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
                <h4 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{title}</h4>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${status === 'PASS' ? 'bg-emerald-500/10 text-emerald-600' : status === 'WARN' ? 'bg-amber-500/10 text-amber-600' : 'bg-blue-500/10 text-blue-600'}`}>
                    {status === 'PASS' ? 'CUMPLIDO' : status === 'WARN' ? 'REVISIÓN' : 'PENDIENTE'}
                </span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
        </div>
    </div>
)

const AuditSection = ({ title, icon: Icon, items }: any) => (
    <section className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex items-center mb-6">
            <div className="p-2 bg-slate-900 text-white rounded-lg mr-3">
                <Icon className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{title}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item: any) => (
                <AuditItem key={item.title} {...item} />
            ))}
        </div>
    </section>
)

export const AuditOverviewPage = () => {
    return (
        <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8 bg-slate-50/50 min-h-screen">
            {/* Header */}
            <header className="mb-12">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2 bg-blue-600 text-white px-3 py-1 rounded-full animate-pulse shadow-lg shadow-blue-200">
                        <Lock className="h-3 w-3" />
                        <span className="text-[10px] font-black uppercase tracking-widest">SISTEMA INTEGRAL DE AUDITORÍA</span>
                    </div>
                </div>
                <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tighter">Estado de Resiliencia NEMIA</h1>
                <p className="text-slate-500 font-medium max-w-2xl">
                    Reporte técnico consolidado sobre la integridad del frontend, backend y arquitectura de datos.
                </p>
            </header>
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-100">
                        <ShieldCheck className="w-6 h-6" />
                    </div>
                    <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">Auditoría y Verificación de Resiliencia</h1>
                </div>
                <p className="text-gray-500 font-medium">Estado actual de la integridad del sistema Nemia y validación de componentes críticos.</p>
            </div>

            {/* Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                <ResilienceMetric title="Integridad DB" value="100%" status="PASS" icon={Database} />
                <ResilienceMetric title="Resiliencia Offline" value="ACTIVO" status="PASS" icon={Smartphone} />
                <ResilienceMetric title="Seguridad RLS" value="Válido" status="PASS" icon={Lock} />
                <ResilienceMetric title="Perf. Rendimiento" value="98/100" status="PASS" icon={Zap} />
            </div>

            {/* Sections */}
            <div className="space-y-8">
                <AuditSection
                    title="Frontend Resilience"
                    icon={Layout}
                    items={[
                        { title: 'Offline Data Sync', status: 'PASS', description: 'Sistema de Outbox/Cola implementado para Guardado, Calificaciones y Asistencia.', icon: RefreshCcw },
                        { title: 'Optimistic UI', status: 'PASS', description: 'Actualizaciones de estado locales antes de confirmación del servidor.', icon: Zap },
                        { title: 'Error Boundaries', status: 'PASS', description: 'Captura de errores en componentes críticos para evitar crash global.', icon: AlertCircle },
                        { title: 'PWA Ready', status: 'PASS', description: 'Configuración básica para funcionamiento independiente.', icon: Smartphone },
                    ]}
                />

                <AuditSection
                    title="Database Integrity & Resilience"
                    icon={Database}
                    items={[
                        { title: 'RLS Policies', status: 'PASS', description: 'Políticas granulares por tenant y perfil. Acceso denegado default.', icon: ShieldCheck },
                        { title: 'Nuclear Resurrection', status: 'PASS', description: 'Script de recuperación probado y validado (V3).', icon: RefreshCcw },
                        { title: 'Schema Consistency', status: 'PASS', description: 'Normalización de tablas core (profiles, tenants).', icon: BookOpen },
                        { title: 'Constraints', status: 'PASS', description: 'Foreign keys y On Delete Cascade configurados correctamente.', icon: Link },
                    ]}
                />

                <AuditSection
                    title="System Backend (Edge/Auth)"
                    icon={Server}
                    items={[
                        { title: 'Multi-Tenant Isolation', status: 'PASS', description: 'Aislamiento lógico garantizado mediante tenant_id en todas las queries.', icon: Lock },
                        { title: 'Auth Lifecycle', status: 'PASS', description: 'Manejo de sesiones, refresco de tokens y redirección automática.', icon: Eye },
                        { title: 'God Mode Security', status: 'PASS', description: 'Acceso restringido a helmerpersonal@gmail.com.', icon: ShieldCheck },
                    ]}
                />
            </div>
        </div>
    )
}

const ResilienceMetric = ({ title, value, status, icon: Icon }: any) => (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-gray-50 rounded-xl text-gray-400">
                <Icon className="w-5 h-5" />
            </div>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${status === 'PASS' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                }`}>
                {status}
            </span>
        </div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{title}</p>
        <p className="text-2xl font-black text-gray-900 tracking-tighter">{value}</p>
    </div>
)
