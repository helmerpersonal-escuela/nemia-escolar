import { useNavigate } from 'react-router-dom'
import { Rocket, Shield, Zap, Users, BookOpen, ChevronRight, Play, Star, Sparkles, Globe, Cpu, MousePointer2, Mail, MessageSquarePlus, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'

export const LandingPage = () => {
    const navigate = useNavigate()
    const [scrolled, setScrolled] = useState(false)
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)
    const [landingConfig, setLandingConfig] = useState<any>({
        heroTitle: 'VUNLEK OS',
        heroSubtitle: 'El Sistema Operativo para la Educación del Futuro.',
        heroDescription: 'Transforma tu aula con tecnología inmersiva, inteligencia artificial y gestión táctil de última generación.',
        ctaText: 'Comenzar Ahora',
        features: [
            { icon: 'Zap', title: 'Automatización Neural', description: 'Elimina el 85% de la carga administrativa. Calificaciones, promedios y reportes generados en milisegundos, liberando a tus docentes para lo que realmente importa.' },
            { icon: 'Shield', title: 'Ciberseguridad Militar', description: 'Tus datos viven en una fortaleza digital. Encriptación AES-256 de punta a punta y respaldos automáticos cada hora garantizan la integridad de tu institución.' },
            { icon: 'Brain', title: 'Copiloto Pedagógico AI', description: 'El núcleo de Vunlek. Genera planeaciones didácticas completas, rúbricas detalladas y material de apoyo adaptado a la SEP en segundos.' },
            { icon: 'Users', title: 'Ecosistema Unificado', description: 'Padres, alumnos y docentes en perfecta sintonía. Notificaciones en tiempo real y chat integrado eliminan los malentendidos para siempre.' },
            { icon: 'Star', title: 'Analytics Predictivo', description: 'Convierte datos en superpoderes. Tableros visuales que detectan tendencias de rendimiento y ausentismo antes de que se conviertan en problemas reales.' },
            { icon: 'MousePointer2', title: 'Experiencia Táctil', description: 'Diseñado para ser tocado. Una interfaz fluida, intuitiva y increíblemente hermosa que funciona como magia en iPads y tabletas.' }
        ]
    })

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50)
        window.addEventListener('scroll', handleScroll)

        // Fetch dynamic config from system_settings if available
        const fetchConfig = async () => {
            const { data } = await supabase.from('system_settings').select('key, value')
            if (data) {
                const config: any = {}
                data.forEach(item => {
                    if (item.key.startsWith('landing_')) {
                        config[item.key.replace('landing_', '')] = item.value
                    }
                })
                if (Object.keys(config).length > 0) {
                    // If features is stored as JSON string, parse it
                    if (config.features) {
                        try { config.features = JSON.parse(config.features) } catch (e) { /* fallback */ }
                    }
                    setLandingConfig((prev: any) => ({ ...prev, ...config }))
                }
            }
        }
        fetchConfig()

        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    const getIcon = (name: string) => {
        switch (name) {
            case 'Zap': return <Zap className="w-6 h-6" />
            case 'Shield': return <Shield className="w-6 h-6" />
            case 'Brain': return <Cpu className="w-6 h-6" />
            case 'Rocket': return <Rocket className="w-6 h-6" />
            case 'Users': return <Users className="w-6 h-6" />
            case 'BookOpen': return <BookOpen className="w-6 h-6" />
            default: return <Sparkles className="w-6 h-6" />
        }
    }

    return (
        <div className="min-h-screen bg-[#050510] text-white font-sans selection:bg-indigo-500 selection:text-white overflow-x-hidden">
            {/* Ambient Background Elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 blur-[150px] rounded-full animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[150px] rounded-full"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]"></div>
            </div>

            {/* Floating Contact Widget */}
            <div className="fixed bottom-8 right-8 z-50 animate-in slide-in-from-bottom-10 fade-in duration-1000">
                <div className="flex items-center gap-4 bg-white/5 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl hover:bg-white/10 transition-colors group cursor-default">
                    <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Mail className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Contacto</p>
                        <p className="text-sm font-bold text-white tracking-wide">ventas@vunlek.com</p>
                    </div>
                </div>
            </div>

            {/* Navbar */}
            <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'py-4 bg-[#050510]/80 backdrop-blur-xl border-b border-white/5' : 'py-8 bg-transparent'}`}>
                <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
                    <div
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                        className="flex items-center gap-3 group cursor-pointer"
                    >
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
                            <Rocket className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-2xl font-black tracking-tighter italic uppercase group-hover:tracking-normal transition-all duration-500">VUNLEK</span>
                    </div>

                    <div className="hidden md:flex items-center gap-10">
                        <a href="#features" className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">Funciones</a>
                        <a href="#stats" className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors">Impacto</a>
                        <button
                            onClick={() => navigate('/register')}
                            className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
                        >
                            Registrarse
                        </button>
                        <button
                            onClick={() => navigate('/login')}
                            className="px-8 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-[10px] font-black uppercase tracking-widest"
                        >
                            Iniciar Sesión
                        </button>
                    </div>

                    {/* Mobile Menu Button - Visible on small screens */}
                    <div className="md:hidden">
                        <button
                            onClick={() => navigate('/login')}
                            className="px-6 py-2 rounded-xl bg-white/10 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white"
                        >
                            Ingresar
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-40 pb-32 px-6 overflow-hidden">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                    <div className="relative z-10 space-y-8">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full animate-in slide-in-from-left duration-700">
                            <Sparkles className="w-4 h-4 text-indigo-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Inteligencia Artificial Educativa</span>
                        </div>

                        <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] animate-in slide-in-from-bottom-8 duration-700 delay-100">
                            {landingConfig.heroTitle} <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-rose-400">
                                {landingConfig.heroSubtitle}
                            </span>
                        </h1>

                        <p className="text-xl text-slate-400 max-w-lg leading-relaxed font-bold animate-in fade-in duration-1000 delay-300">
                            {landingConfig.heroDescription}
                        </p>

                        <div className="flex flex-wrap items-center gap-6 pt-4 animate-in zoom-in-95 duration-700 delay-500">
                            <button
                                onClick={() => navigate('/register')}
                                className="btn-tactile px-10 py-5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2rem] text-xs font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-500/40 flex items-center gap-3 active:scale-95 group"
                            >
                                {landingConfig.ctaText}
                                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                            <button className="flex items-center gap-4 group p-2">
                                <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-all group-hover:scale-110 active:scale-90">
                                    <Play className="w-5 h-5 text-white fill-white" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white transition-colors">Ver Video</span>
                            </button>
                        </div>
                    </div>

                    <div className="relative animate-in zoom-in-95 duration-1000">
                        {/* Futuristic Dashboard Preview Mockup */}
                        <div className="relative z-10 w-full aspect-square md:aspect-video rounded-[3rem] bg-gradient-to-br from-slate-800 to-slate-900 border-4 border-white/10 shadow-[0_0_100px_-20px_rgba(79,70,229,0.3)] overflow-hidden group">
                            <div className="absolute inset-0 bg-blue-600/10 blur-[100px]"></div>
                            <div className="absolute top-0 left-0 right-0 h-10 bg-white/5 backdrop-blur-md flex items-center px-6 gap-2">
                                <div className="w-2 h-2 rounded-full bg-rose-500/50"></div>
                                <div className="w-2 h-2 rounded-full bg-amber-500/50"></div>
                                <div className="w-2 h-2 rounded-full bg-emerald-500/50"></div>
                            </div>
                            {/* Inner Preview Styling */}
                            <div className="p-12 pt-16 grid grid-cols-2 gap-6 h-full opacity-60 group-hover:opacity-100 transition-opacity duration-700">
                                <div className="space-y-6">
                                    <div className="h-32 bg-white/5 rounded-3xl border border-white/10 animate-pulse"></div>
                                    <div className="h-20 bg-indigo-500/10 rounded-3xl border border-indigo-500/20"></div>
                                    <div className="h-40 bg-white/5 rounded-3xl border border-white/10"></div>
                                </div>
                                <div className="space-y-6 pt-12">
                                    <div className="h-40 bg-purple-500/10 rounded-3xl border border-purple-500/20"></div>
                                    <div className="h-32 bg-white/5 rounded-3xl border border-white/10 animate-pulse delay-75"></div>
                                </div>
                            </div>
                            {/* Floating Tactile Elements */}
                            <div className="absolute top-20 right-[-20px] w-40 p-4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl rotate-12 group-hover:rotate-0 transition-transform duration-700">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-3 h-3 bg-emerald-400 rounded-full animate-ping"></div>
                                    <span className="text-[8px] font-black uppercase tracking-widest">En Vivo</span>
                                </div>
                                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                                    <div className="w-2/3 h-full bg-gradient-to-r from-emerald-400 to-cyan-400"></div>
                                </div>
                            </div>
                        </div>
                        {/* Decorative background shapes */}
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-600/20 blur-3xl rounded-full"></div>
                        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-600/20 blur-3xl rounded-full"></div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-32 px-6 relative">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-20 space-y-4">
                        <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter italic">Infraestructura de Grado Superior</h2>
                        <p className="text-slate-500 font-bold max-w-2xl mx-auto uppercase text-xs tracking-[0.3em]">Redescubre lo que es posible en la gestión educativa</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {landingConfig.features.map((feature: any, idx: number) => (
                            <div key={idx} className="squishy-card p-10 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-indigo-500/50 transition-all group h-full">
                                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 rounded-[1.5rem] flex items-center justify-center mb-10 group-hover:scale-110 transition-transform">
                                    <div className="text-indigo-400 group-hover:text-indigo-300 transition-colors">
                                        {getIcon(feature.icon)}
                                    </div>
                                </div>
                                <h3 className="text-xl font-black uppercase italic mb-4 tracking-tight">{feature.title}</h3>
                                <p className="text-slate-400 font-bold leading-relaxed">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Impressive Stats Section */}
            <section id="stats" className="py-32 px-6 relative bg-gradient-to-b from-[#050510] to-[#0A0A1F]">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
                        <div className="space-y-2">
                            <h3 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-indigo-400 to-white italic">+200</h3>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Escuelas</p>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-purple-400 to-white italic">15K</h3>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Docentes</p>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-rose-400 to-white italic">98%</h3>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Eficiencia</p>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-indigo-400 to-white italic">AI-X</h3>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Integración</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Testimonials Section */}
            <section className="py-20 px-6 relative overflow-hidden">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16 space-y-4">
                        <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter italic">Lo que dicen los educadores</h2>
                        <p className="text-slate-500 font-bold max-w-2xl mx-auto uppercase text-xs tracking-[0.3em]">Únete a la revolución educativa</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
                        {[
                            { name: "Carlos Méndez", role: "Director Secundaria", text: "Gestionar mi escuela nunca había sido tan rápido. Vunlek es el futuro.", stars: 5, img: "https://randomuser.me/api/portraits/men/32.jpg" },
                            { name: "Ana Torres", role: "Docente de Español", text: "La IA me ahorra horas cada semana en planeaciones. ¡Increíble!", stars: 5, img: "https://randomuser.me/api/portraits/women/44.jpg" },
                            { name: "Luis Fernandez", role: "Coordinador Académico", text: "La interfaz es hermosa y muy intuitiva. A mis maestros les encanta.", stars: 5, img: "https://randomuser.me/api/portraits/men/11.jpg" },
                            { name: "María González", role: "Maestra de Primaria", text: "Por fin un sistema que no se cae y es fácil de usar. 100% recomendado.", stars: 5, img: "https://randomuser.me/api/portraits/women/65.jpg" },
                            { name: "Jorge Ruiz", role: "Profesor de Matemáticas", text: "Vunlek tiene todo lo que necesito en un solo lugar. La asistencia es facilísima.", stars: 4, img: "https://randomuser.me/api/portraits/men/85.jpg" },
                            { name: "Sofia Ramirez", role: "Directora General", text: "La seguridad de los datos me da mucha tranquilidad. Excelente plataforma.", stars: 5, img: "https://randomuser.me/api/portraits/women/22.jpg" },
                            { name: "Pedro Sanchez", role: "Docente de Historia", text: "Las rúbricas generadas por IA son muy precisas. Me ayudan muchísimo.", stars: 5, img: "https://randomuser.me/api/portraits/men/67.jpg" },
                            { name: "Laura Diaz", role: "Coordinadora de Nivel", text: "El soporte técnico es rápido y siempre resuelven mis dudas.", stars: 4, img: "https://randomuser.me/api/portraits/women/12.jpg" },
                            { name: "Ricardo Gomez", role: "Profesor de Química", text: "Mis alumnos están fascinados viendo sus calificaciones al instante.", stars: 5, img: "https://randomuser.me/api/portraits/men/33.jpg" },
                            { name: "Elena Castro", role: "Maestra de Preescolar", text: "Muy visual y fácil de entender. Hasta los padres lo agradecen.", stars: 5, img: "https://randomuser.me/api/portraits/women/55.jpg" },
                            { name: "Javier Lopez", role: "Director Preparatoria", text: "La mejor inversión que hemos hecho en tecnología educativa.", stars: 5, img: "https://randomuser.me/api/portraits/men/66.jpg" },
                            { name: "Carmen Ortiz", role: "Docente de Inglés", text: "Me encanta poder llevar todo el control desde mi celular o tablet.", stars: 4, img: "https://randomuser.me/api/portraits/women/15.jpg" },
                            { name: "Roberto Silva", role: "Profesor de Educación Física", text: "Simple, rápido y eficiente. Justo lo que buscaba para mis clases.", stars: 5, img: "https://randomuser.me/api/portraits/men/1.jpg" },
                            { name: "Patricia Vega", role: "Administrativa", text: "Los reportes se generan solos. Adiós a las horas extras de fin de mes.", stars: 5, img: "https://randomuser.me/api/portraits/women/5.jpg" },
                            { name: "Miguel Angel", role: "Docente Universitario", text: "Una herramienta potente y moderna. Vunlek está a otro nivel.", stars: 5, img: "https://randomuser.me/api/portraits/men/10.jpg" },
                        ].map((review, idx) => (
                            <div key={idx} className="p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all hover:-translate-y-1">
                                <div className="flex gap-1 mb-3 text-amber-400">
                                    {[...Array(review.stars)].map((_, i) => (
                                        <Star key={i} className="w-4 h-4 fill-current" />
                                    ))}
                                </div>
                                <p className="text-slate-300 text-sm mb-4 leading-relaxed font-medium">"{review.text}"</p>
                                <div className="flex items-center gap-3">
                                    <img
                                        src={review.img}
                                        alt={review.name}
                                        className="w-10 h-10 rounded-full border-2 border-indigo-500/30 object-cover"
                                    />
                                    <div>
                                        <p className="text-sm font-bold text-white">{review.name}</p>
                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{review.role}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-center">
                        <button
                            onClick={() => setIsReviewModalOpen(true)}
                            className="group flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-sm font-bold uppercase tracking-widest text-slate-300 hover:text-white"
                        >
                            <MessageSquarePlus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                            Publicar Comentario
                        </button>
                    </div>
                </div>
            </section>

            {/* Review Modal */}
            {isReviewModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#0A0A1F] border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">Tu opinión cuenta</h3>
                            <button onClick={() => setIsReviewModalOpen(false)} className="text-slate-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={(e) => {
                            e.preventDefault()
                            // Simulate submission
                            setIsReviewModalOpen(false)
                            // You could verify with a toast here if integrated
                            alert("¡Gracias! Tu comentario ha sido enviado a moderación.")
                        }} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Nombre Completo</label>
                                <input required type="text" className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500 transition-colors" placeholder="Ej. Juan Pérez" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Cargo / Rol</label>
                                <input required type="text" className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500 transition-colors" placeholder="Ej. Docente de Matemáticas" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Comentario</label>
                                <textarea required rows={4} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500 transition-colors" placeholder="¿Qué te parece Vunlek?"></textarea>
                            </div>
                            <div className="pt-2">
                                <button type="submit" className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl font-bold uppercase tracking-widest text-xs hover:shadow-lg hover:shadow-indigo-500/20 transition-all">
                                    Enviar Reseña
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Footer */}
            <footer className="py-20 px-6 border-t border-white/5">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                            <Rocket className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-black uppercase italic tracking-tighter">VUNLEK</span>
                    </div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">© 2026 Vunlek Corporation. Educación Inmersiva.</p>
                    <div className="flex items-center gap-8">
                        <Globe className="w-5 h-5 text-slate-500 hover:text-white transition-colors cursor-pointer" />
                        <Shield className="w-5 h-5 text-slate-500 hover:text-white transition-colors cursor-pointer" />
                        <MousePointer2 className="w-5 h-5 text-slate-500 hover:text-white transition-colors cursor-pointer" />
                    </div>
                </div>
            </footer>
        </div>
    )
}
