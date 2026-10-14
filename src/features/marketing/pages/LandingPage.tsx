import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    ArrowRight, BookOpenCheck, CalendarCheck, CheckCircle2, ChartColumn, ClipboardList, GraduationCap,
    HeartHandshake, Mail, MessageCircle, NotebookPen, QrCode, School, ShieldCheck, Sparkles, Users, WifiOff,
} from 'lucide-react'
import { BrandLogo } from '../../../components/brand/BrandLogo'

/* Capturas reales de la escuela de demostración (datos ficticios), en /public/landing. */
const SHOTS = {
    inicio: '/landing/inicio-docente.webp',
    programa: '/landing/programa-analitico.webp',
    planeacion: '/landing/planeacion.webp',
    clase: '/landing/clase.webp',
    evaluacion: '/landing/evaluacion.webp',
    alumnos: '/landing/alumnos.webp',
    familia: '/landing/familia.webp',
    familiaAcceso: '/landing/familia-acceso.webp',
}

/* Marco de tableta para las capturas de 780 px de ancho */
const TabletFrame = ({ src, alt, h = 854, eager = false, className = '' }: { src: string; alt: string; h?: number; eager?: boolean; className?: string }) => (
    <figure className={`rounded-[1.6rem] sm:rounded-[2.2rem] bg-slate-900 p-2 sm:p-3 shadow-[0_35px_70px_-30px_rgba(66,66,143,0.55)] ring-1 ring-slate-800 ${className}`}>
        <img src={src} alt={alt} width={780} height={h} loading={eager ? 'eager' : 'lazy'} decoding="async" className="block w-full h-auto rounded-[1.1rem] sm:rounded-[1.5rem] bg-slate-100" />
    </figure>
)

/* Marco de celular para las capturas de 591 px de ancho */
const PhoneFrame = ({ src, alt, h = 1210, className = '' }: { src: string; alt: string; h?: number; className?: string }) => (
    <figure className={`rounded-[2.2rem] bg-slate-900 p-2 shadow-[0_30px_60px_-20px_rgba(15,23,42,0.5)] ring-1 ring-slate-800 ${className}`}>
        <img src={src} alt={alt} width={591} height={h} loading="lazy" decoding="async" className="block w-full h-auto rounded-[1.7rem] bg-slate-100" />
    </figure>
)

type Step = { n: number; icon: ReactNode; tag: string; title: string; text: string; points: string[]; shot: string; alt: string }

const STEPS: Step[] = [
    {
        n: 1, icon: <BookOpenCheck className="w-5 h-5" />, tag: 'Programa analítico',
        title: 'Parte del programa analítico de tu escuela',
        text: 'Contextualiza los contenidos y los Procesos de Desarrollo de Aprendizaje (PDA) de cada campo formativo con la problemática de tu comunidad. La IA te propone la redacción y tú decides.',
        points: ['Contenidos y PDA por fase y grado', 'Problemáticas del diagnóstico de la escuela', 'Se comparte con todo el colectivo docente'],
        shot: SHOTS.programa, alt: 'Programa analítico: la IA contextualiza los contenidos con la problemática de la escuela',
    },
    {
        n: 2, icon: <NotebookPen className="w-5 h-5" />, tag: 'Planeación didáctica',
        title: 'Planea a partir de lo que ya definiste',
        text: 'La planeación toma los contenidos y PDA de tu programa analítico. Eliges la metodología sociocrítica y el libro de texto, y la IA arma la secuencia de sesiones para que la ajustes.',
        points: ['Metodologías de la NEM (proyectos, ABP, STEAM, aprendizaje servicio)', 'Sesiones con fechas según tu horario', 'Instrumentos de evaluación sugeridos'],
        shot: SHOTS.planeacion, alt: 'Planeación didáctica: secuencia de actividades desde el horario o con el asistente de IA',
    },
    {
        n: 3, icon: <CalendarCheck className="w-5 h-5" />, tag: 'En clase',
        title: 'En el aula, todo a un toque',
        text: 'Desde tu libreta pasas lista, registras actividades e incidencias y ves cuál clase te toca. Funciona también sin internet y se sincroniza al volver la señal.',
        points: ['Asistencia con QR, NFC o con un toque', 'Actividades ligadas a la planeación', 'Captura sin conexión'],
        shot: SHOTS.clase, alt: 'Pase de lista del grupo con el acumulado de asistencias, retardos y faltas',
    },
    {
        n: 4, icon: <ChartColumn className="w-5 h-5" />, tag: 'Evaluación',
        title: 'La evaluación se arma sola',
        text: 'Cada actividad calificada alimenta la evaluación formativa del periodo. Los promedios, el portafolio de evidencias y los reportes se calculan automáticamente, listos para el consejo y la boleta.',
        points: ['Criterios con su porcentaje (tareas, proyectos, examen)', 'Promedios por periodo sin hojas de cálculo', 'Rúbricas, listas de cotejo y portafolio'],
        shot: SHOTS.evaluacion, alt: 'Calificaciones del grupo con ponderación por criterio y promedio final',
    },
]

const FlowChain = () => (
    <ol className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-sm font-bold" aria-label="Recorrido del trabajo docente">
        {STEPS.map((s, i) => (
            <li key={s.n} className="flex items-center gap-2 sm:gap-3">
                <a href={`#paso-${s.n}`} className="flex items-center gap-2 rounded-full bg-white border border-indigo-100 px-3.5 py-2 text-indigo-900 shadow-sm hover:border-indigo-300 transition-colors">
                    <span className="grid place-items-center w-6 h-6 rounded-full bg-indigo-600 text-white text-xs">{s.n}</span>
                    {s.tag}
                </a>
                {i < STEPS.length - 1 && <ArrowRight className="hidden sm:block w-4 h-4 text-indigo-300" aria-hidden="true" />}
            </li>
        ))}
    </ol>
)

export const LandingPage = () => {
    const navigate = useNavigate()
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 24)
        onScroll()
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    const primaryBtn = 'btn-tactile inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50'
    const secondaryBtn = 'inline-flex items-center justify-center gap-2 rounded-2xl bg-white border border-slate-200 px-6 py-3.5 text-sm font-bold text-slate-700 hover:border-indigo-300 hover:text-indigo-700 transition-colors'

    return (
        <div className="min-h-screen overflow-x-hidden bg-[hsl(220_30%_96%)] text-slate-900 selection:bg-indigo-200">
            {/* Manchas suaves, igual que el fondo de la app */}
            <div className="pointer-events-none fixed inset-0 -z-0" aria-hidden="true">
                <div className="absolute -top-40 -left-32 w-[36rem] h-[36rem] rounded-full bg-indigo-200/50 blur-3xl" />
                <div className="absolute top-1/3 -right-40 w-[34rem] h-[34rem] rounded-full bg-fuchsia-200/40 blur-3xl" />
            </div>

            {/* Barra superior */}
            <header className={`fixed inset-x-0 top-0 z-50 transition-all ${scrolled ? 'bg-white/85 backdrop-blur-xl border-b border-slate-200/70 shadow-sm' : 'bg-transparent'}`}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-4">
                    <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2.5" aria-label="VUNLEK, ir al inicio">
                        <BrandLogo className="h-9 w-auto" alt="" />
                        <span className="text-xl font-black tracking-tight text-[#42428F]">VUNLEK</span>
                    </button>
                    <nav className="hidden lg:flex items-center gap-8 text-sm font-bold text-slate-600" aria-label="Secciones">
                        <a href="#recorrido" className="hover:text-indigo-700">Cómo funciona</a>
                        <a href="#alumnos" className="hover:text-indigo-700">Control escolar</a>
                        <a href="#familias" className="hover:text-indigo-700">Familias</a>
                        <a href="#para-quien" className="hover:text-indigo-700">Para quién</a>
                    </nav>
                    <div className="flex items-center gap-2">
                        <button onClick={() => navigate('/login')} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-white/70">Iniciar sesión</button>
                        <button onClick={() => navigate('/register')} className="hidden sm:inline-flex rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">Crear cuenta</button>
                    </div>
                </div>
            </header>

            <main className="relative">
                {/* Portada */}
                <section className="pt-28 sm:pt-36 pb-16 sm:pb-24 px-4 sm:px-6">
                    <div className="max-w-7xl mx-auto grid lg:grid-cols-[1fr_1.15fr] gap-12 lg:gap-16 items-center">
                        <div>
                            <span className="inline-flex items-center gap-2 rounded-full bg-white border border-indigo-100 px-3.5 py-1.5 text-xs font-bold text-indigo-700 shadow-sm">
                                <Sparkles className="w-4 h-4" /> Hecho para la Nueva Escuela Mexicana
                            </span>
                            <h1 className="mt-6 text-[2.5rem] sm:text-6xl xl:text-[4.2rem] font-black leading-[1.02] tracking-tight text-slate-900">
                                Menos papeleo.<br />
                                <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 bg-clip-text text-transparent">Más tiempo para enseñar.</span>
                            </h1>
                            <p className="mt-6 max-w-xl text-lg text-slate-600 leading-relaxed">
                                VUNLEK conecta tu <strong className="text-slate-800">programa analítico</strong>, tus <strong className="text-slate-800">planeaciones</strong>, el <strong className="text-slate-800">trabajo en clase</strong> y la <strong className="text-slate-800">evaluación</strong> en un solo lugar, con ayuda de la inteligencia artificial. Lo que capturas una vez se aprovecha en todo lo demás.
                            </p>
                            <div className="mt-8 flex flex-col sm:flex-row gap-3">
                                <button onClick={() => navigate('/register')} className={primaryBtn}>Crear mi cuenta docente <ArrowRight className="w-4 h-4" /></button>
                                <button onClick={() => navigate('/escuelas')} className={secondaryBtn}><School className="w-4 h-4" /> Soy escuela: pedir presupuesto</button>
                            </div>
                            <button onClick={() => navigate('/familia')} className="mt-5 text-sm font-bold text-indigo-700 underline underline-offset-4 hover:text-indigo-900">
                                ¿Eres madre, padre o tutor? Entra con el código de tu hijo(a)
                            </button>
                        </div>
                        <div className="relative">
                            <TabletFrame eager src={SHOTS.inicio} alt="Inicio del docente en VUNLEK con la clase en curso" className="ml-auto w-[88%] sm:w-[78%] lg:w-[86%] xl:w-[78%] -rotate-1" />
                            <PhoneFrame src={SHOTS.familia} alt="Seguimiento de la familia en el celular: promedio, asistencia y actividades pendientes" className="absolute -bottom-8 left-0 w-[34%] sm:w-[190px] rotate-3" />
                        </div>
                    </div>
                </section>

                {/* Recorrido conectado */}
                <section id="recorrido" className="scroll-mt-24 px-4 sm:px-6 py-16 sm:py-24">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center max-w-3xl mx-auto">
                            <p className="text-sm font-bold text-indigo-600">Todo está conectado</p>
                            <h2 className="mt-2 text-3xl sm:text-5xl font-black tracking-tight">Del programa analítico a la boleta, sin volver a capturar</h2>
                            <p className="mt-4 text-lg text-slate-600">Cada paso toma lo que hiciste en el anterior. Así dejas de copiar lo mismo en formatos distintos.</p>
                        </div>
                        <div className="mt-8"><FlowChain /></div>

                        <div className="mt-16 sm:mt-24 space-y-20 sm:space-y-32">
                            {STEPS.map((s, i) => (
                                <article key={s.n} id={`paso-${s.n}`} className="scroll-mt-28 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                                    <div className={i % 2 ? 'lg:order-2' : ''}>
                                        <div className="flex items-center gap-3">
                                            <span className="grid place-items-center w-11 h-11 rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-500/30">{s.icon}</span>
                                            <span className="text-sm font-bold text-indigo-700">Paso {s.n} · {s.tag}</span>
                                        </div>
                                        <h3 className="mt-5 text-2xl sm:text-4xl font-black tracking-tight">{s.title}</h3>
                                        <p className="mt-4 text-slate-600 text-lg leading-relaxed">{s.text}</p>
                                        <ul className="mt-6 space-y-2.5">
                                            {s.points.map(p => (
                                                <li key={p} className="flex items-start gap-2.5 text-slate-700 font-medium">
                                                    <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0 text-emerald-500" /> {p}
                                                </li>
                                            ))}
                                        </ul>
                                        {i < STEPS.length - 1 && (
                                            <p className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700">
                                                <ArrowRight className="w-4 h-4" /> Esto alimenta: {STEPS[i + 1].tag.toLowerCase()}
                                            </p>
                                        )}
                                    </div>
                                    <TabletFrame src={s.shot} alt={s.alt} className={`w-full max-w-[460px] mx-auto ${i % 2 ? 'lg:order-1 lg:-rotate-1' : 'lg:rotate-1'}`} />
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Control de alumnos */}
                <section id="alumnos" className="scroll-mt-24 px-4 sm:px-6 py-16 sm:py-24 bg-white/60 border-y border-slate-200/70">
                    <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                        <TabletFrame src={SHOTS.alumnos} h={792} alt="Reporte de desempeño del alumno con promedio, tareas y asistencia" className="w-full max-w-[460px] mx-auto -rotate-1" />
                        <div>
                            <p className="text-sm font-bold text-indigo-600">Control escolar</p>
                            <h2 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight">Cada alumno, con su historia completa</h2>
                            <p className="mt-4 text-lg text-slate-600">Dirección, coordinación, prefectura y docentes trabajan sobre la misma información, cada quien con los permisos de su función.</p>
                            <div className="mt-8 grid sm:grid-cols-2 gap-4">
                                {[
                                    { icon: <ClipboardList className="w-5 h-5" />, t: 'Expediente único', d: 'Asistencia, calificaciones, incidencias y entrevistas.' },
                                    { icon: <QrCode className="w-5 h-5" />, t: 'Credenciales', d: 'Entrada y pase de lista con QR o NFC.' },
                                    { icon: <GraduationCap className="w-5 h-5" />, t: 'Seguimiento', d: 'Alertas de inasistencia y bajo rendimiento.' },
                                    { icon: <WifiOff className="w-5 h-5" />, t: 'Sin conexión', d: 'Captura en el aula aunque falle el internet.' },
                                ].map(c => (
                                    <div key={c.t} className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-sm">
                                        <span className="grid place-items-center w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600">{c.icon}</span>
                                        <h3 className="mt-3 font-black">{c.t}</h3>
                                        <p className="mt-1 text-sm text-slate-600">{c.d}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Familias */}
                <section id="familias" className="scroll-mt-24 px-4 sm:px-6 py-16 sm:py-24">
                    <div className="max-w-6xl mx-auto grid md:grid-cols-[1fr_auto] gap-10 lg:gap-20 items-center">
                        <div>
                            <p className="text-sm font-bold text-indigo-600">Comunicación con familias</p>
                            <h2 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight">Las familias saben cómo van sus hijos, sin esperar a la boleta</h2>
                            <p className="mt-4 text-lg text-slate-600">Madres, padres y tutores siguen el avance desde su celular y hablan con la escuela por un canal oficial, sin compartir números personales.</p>
                            <ul className="mt-6 space-y-3">
                                {[
                                    { icon: <ChartColumn className="w-5 h-5" />, t: 'Calificaciones, tareas y asistencia al día' },
                                    { icon: <MessageCircle className="w-5 h-5" />, t: 'Mensajes con docentes y dirección' },
                                    { icon: <HeartHandshake className="w-5 h-5" />, t: 'Avisos, citatorios y justificantes' },
                                    { icon: <ShieldCheck className="w-5 h-5" />, t: 'Un tutor titular y hasta dos accesos extra, todos identificados' },
                                ].map(x => (
                                    <li key={x.t} className="flex items-center gap-3 font-medium text-slate-700">
                                        <span className="grid place-items-center w-9 h-9 shrink-0 rounded-xl bg-fuchsia-50 text-fuchsia-600">{x.icon}</span> {x.t}
                                    </li>
                                ))}
                            </ul>
                            <button onClick={() => navigate('/familia')} className={`${secondaryBtn} mt-8`}>Entrar como familia <ArrowRight className="w-4 h-4" /></button>
                        </div>
                        <PhoneFrame src={SHOTS.familiaAcceso} h={1280} alt="Panel del tutor: acceso como tutor titular y solicitud de cuentas adicionales" className="mx-auto md:mx-0 w-[230px] sm:w-[260px]" />
                    </div>
                </section>

                {/* Para quién */}
                <section id="para-quien" className="scroll-mt-24 px-4 sm:px-6 py-16 sm:py-24">
                    <div className="max-w-7xl mx-auto">
                        <h2 className="text-center text-3xl sm:text-4xl font-black tracking-tight">Para toda la comunidad escolar</h2>
                        <div className="mt-10 grid md:grid-cols-3 gap-6">
                            {[
                                { icon: <NotebookPen className="w-6 h-6" />, t: 'Docentes', d: 'Crea tu cuenta y lleva tus grupos, planeaciones y evaluación aunque tu escuela todavía no use VUNLEK.', cta: 'Crear cuenta docente', to: '/register' },
                                { icon: <School className="w-6 h-6" />, t: 'Escuelas', d: 'Toda la plantilla en un mismo espacio. El costo se calcula según el número de docentes y alumnos, y puedes probarlo completo durante un mes.', cta: 'Solicitar presupuesto', to: '/escuelas' },
                                { icon: <Users className="w-6 h-6" />, t: 'Familias', d: 'Entra con el código que te entrega la escuela y sigue el avance de tus hijos desde el celular.', cta: 'Entrar como familia', to: '/familia' },
                            ].map(c => (
                                <div key={c.t} className="squishy-card bg-white border border-slate-200/80 p-8 flex flex-col">
                                    <span className="grid place-items-center w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white">{c.icon}</span>
                                    <h3 className="mt-5 text-xl font-black">{c.t}</h3>
                                    <p className="mt-2 text-slate-600 flex-1">{c.d}</p>
                                    <button onClick={() => navigate(c.to)} className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-indigo-700 hover:text-indigo-900">{c.cta} <ArrowRight className="w-4 h-4" /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Llamado final */}
                <section className="px-4 sm:px-6 pb-20 sm:pb-28">
                    <div className="max-w-5xl mx-auto rounded-[2rem] sm:rounded-[2.5rem] bg-gradient-to-br from-[#42428F] via-indigo-700 to-violet-700 px-6 py-12 sm:p-16 text-center text-white shadow-2xl shadow-indigo-900/30">
                        <BrandLogo tone="blanco" className="h-14 w-auto mx-auto" alt="" />
                        <h2 className="mt-6 text-3xl sm:text-4xl font-black tracking-tight">Recupera las horas que hoy se van en formatos</h2>
                        <p className="mt-4 text-indigo-100 text-lg max-w-2xl mx-auto">Empieza con tu grupo hoy mismo o escríbenos para llevar VUNLEK a toda tu escuela.</p>
                        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                            <button onClick={() => navigate('/register')} className="btn-tactile inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-sm font-bold text-indigo-800">Crear mi cuenta <ArrowRight className="w-4 h-4" /></button>
                            <a href="mailto:ventas@vunlek.com" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/30 px-6 py-3.5 text-sm font-bold hover:bg-white/10"><Mail className="w-4 h-4" /> ventas@vunlek.com</a>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="relative border-t border-slate-200/80 bg-white/70 px-4 sm:px-6 py-10">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-sm">
                    <div className="flex items-center gap-2.5">
                        <BrandLogo className="h-8 w-auto" alt="" />
                        <span className="font-black text-[#42428F]">VUNLEK</span>
                        <span className="text-slate-400">· © 2026 Ko'on Soluciones</span>
                    </div>
                    <nav aria-label="Legal" className="flex flex-wrap justify-center gap-x-6 gap-y-2 font-bold text-slate-600">
                        <a href="/privacidad" className="hover:text-indigo-700">Privacidad</a>
                        <a href="/terminos" className="hover:text-indigo-700">Términos</a>
                        <a href="/eliminar-cuenta" className="hover:text-indigo-700">Eliminar cuenta</a>
                        <a href="mailto:ventas@vunlek.com" className="hover:text-indigo-700">ventas@vunlek.com</a>
                    </nav>
                </div>
            </footer>
        </div>
    )
}
