import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { HelpCircle, X } from 'lucide-react'
import { getTextSize, setTextSize, TEXT_SIZE_OPTIONS, type TextSize } from '../../lib/textSize'

/**
 * Ayuda contextual: "¿Cómo se usa esta pantalla?" en lenguaje sencillo, para docentes
 * con poca experiencia en sistemas. Se abre con el botón "?" del encabezado.
 */

interface Help { title: string; steps: string[]; tip?: string }

const HELP: { match: (path: string, search: string) => boolean; help: Help }[] = [
    {
        match: p => p === '/',
        help: {
            title: 'Tu inicio',
            steps: [
                'Si eres nuevo, sigue la tarjeta "Primeros pasos": te lleva en orden a lo que falta.',
                'Abajo (en el celular) o a la izquierda (en la computadora) está el menú. Arriba van las tareas de todos los días.',
                'Lo que usas de vez en cuando está dentro de "Planeación NEM" y "Más".',
            ],
            tip: 'El punto verde de arriba indica que hay conexión. Sin señal puedes seguir pasando lista y calificando: se guarda y se envía después.',
        },
    },
    {
        match: (p, s) => p === '/gradebook' && s.includes('ATTENDANCE'),
        help: {
            title: 'Pasar lista',
            steps: [
                'Elige el grupo (si solo tienes uno, se abre solo).',
                'Revisa la fecha (arriba) y marca a cada alumno: asistencia, falta, retardo o justificada.',
                'Al terminar presiona "Guardar asistencia". Mientras no guardes, abajo verás cuántos cambios faltan.',
            ],
            tip: 'Funciona sin internet: se guarda en tu dispositivo y se envía sola cuando vuelve la señal.',
        },
    },
    {
        match: p => p === '/gradebook',
        help: {
            title: 'Calificaciones',
            steps: [
                'Elige el grupo y el periodo (trimestre).',
                'Escribe la calificación de cada actividad; el promedio se calcula solo.',
                'Los criterios de evaluación (qué porcentaje vale cada cosa) se configuran en el grupo.',
            ],
        },
    },
    {
        match: p => p === '/groups' || p.startsWith('/groups/'),
        help: {
            title: 'Grupos y alumnos',
            steps: [
                'Crea un grupo con su grado y letra (por ejemplo 1° A).',
                'Entra al grupo y usa "Agregar alumno" para uno por uno, o "Importar" para subir tu lista desde Excel.',
                'Dentro del grupo también defines los criterios de evaluación.',
            ],
        },
    },
    {
        match: p => p === '/planning',
        help: {
            title: 'Mis planeaciones',
            steps: [
                'Presiona "Nueva planeación".',
                'Todas tus planeaciones quedan aquí; puedes abrirlas, editarlas o imprimirlas.',
            ],
            tip: 'Antes de planear conviene tener tu programa analítico: de ahí salen los contenidos y PDA.',
        },
    },
    {
        match: p => p.startsWith('/planning/'),
        help: {
            title: 'Crear una planeación',
            steps: [
                'Paso 1: la materia y el campo formativo se llenan solos. Elige una de las propuestas de título o escribe el tuyo.',
                'Elige el grupo, el periodo y el esquema (semanal, mensual o por proyecto).',
                'Avanza con "Siguiente". La IA te propone contenidos, actividades y evaluación; todo se puede editar.',
                'Al final guarda e imprime.',
            ],
        },
    },
    {
        match: p => p.startsWith('/analytical-program'),
        help: {
            title: 'Programa analítico',
            steps: [
                'Se hace uno por cada campo formativo de tus materias.',
                'Sigue los 7 pasos. En cada botón de IA espera unos segundos; la pantalla te lleva al resultado.',
                'Todo lo que propone la IA es editable. Revisa el paso 7: confirma que solo incluya tus materias.',
            ],
            tip: 'Los datos de la escuela se toman de Configuración → Datos de la escuela.',
        },
    },
    {
        match: p => p === '/agenda',
        help: { title: 'Mi agenda', steps: ['Aquí ves los eventos del calendario escolar oficial y los tuyos.', 'Muévete entre meses con las flechas de arriba y toca un día para ver sus actividades.', 'Con "Nuevo evento" agregas tus propias actividades o recordatorios.'] },
    },
    {
        match: p => p === '/settings',
        help: {
            title: 'Configuración',
            steps: [
                'Mi perfil: tu nombre y foto.',
                'Mis materias: las asignaturas que impartes (definen tus programas y planeaciones).',
                'Datos de la escuela, Ciclo escolar y periodos, y Jornada: lo que capturaste al crear tu espacio.',
                'En cuanto cambias algo aparece abajo una barra oscura: toca "Guardar cambios" o "Descartar". Es igual en todas las secciones.',
            ],
            tip: 'El tamaño de letra (en Mi perfil) se aplica al momento y no necesita guardarse.',
        },
    },
    {
        match: p => p === '/mis-pdas',
        help: { title: 'PDAs, ejes y metodologías', steps: ['Consulta los PDA oficiales de tus materias y grados.', 'Crea tus propios PDA o metodologías y oculta los que no uses.'] },
    },
    {
        match: p => p === '/rubrics' || p.startsWith('/rubrics/'),
        help: { title: 'Instrumentos de evaluación', steps: ['Crea rúbricas, listas de cotejo o escalas.', 'La IA puede proponerte uno a partir de tu planeación; después lo ajustas.'] },
    },
    {
        match: p => p === '/cte',
        help: { title: 'Consejo Técnico Escolar', steps: ['Consulta la agenda de la sesión y tus compromisos.', 'Registra el avance de los acuerdos que te asignaron.'] },
    },
]

export function findPageHelp(path: string, search: string): Help | null {
    return HELP.find(h => h.match(path, search))?.help ?? null
}

export function PageHelpButton({ path, search }: { path: string; search: string }) {
    const help = findPageHelp(path, search)
    const [open, setOpen] = useState(false)
    useEffect(() => { setOpen(false) }, [path, search])
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open])
    if (!help) return null

    return (
        <>
            <button type="button" onClick={() => setOpen(true)} aria-label={`Ayuda: cómo se usa ${help.title}`}
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-indigo-700 bg-indigo-50 hover:bg-indigo-100">
                <HelpCircle className="w-5 h-5" />
            </button>
            {open && createPortal(
                <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm" onClick={() => setOpen(false)}>
                    <div role="dialog" aria-modal="true" aria-labelledby="ayuda-titulo" onClick={e => e.stopPropagation()}
                        className="bg-white w-full sm:max-w-lg max-h-[85dvh] overflow-y-auto rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6">
                        <div className="flex items-start justify-between gap-3 mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><HelpCircle className="w-5 h-5" /></div>
                                <div>
                                    <p className="text-xs font-black text-indigo-600">Cómo se usa</p>
                                    <h2 id="ayuda-titulo" className="text-lg font-black text-slate-900">{help.title}</h2>
                                </div>
                            </div>
                            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar ayuda" className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"><X className="w-5 h-5" /></button>
                        </div>
                        <ol className="space-y-3">
                            {help.steps.map((s, i) => (
                                <li key={i} className="flex gap-3">
                                    <span className="w-7 h-7 shrink-0 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center">{i + 1}</span>
                                    <p className="text-sm text-slate-700 leading-relaxed pt-1">{s}</p>
                                </li>
                            ))}
                        </ol>
                        {help.tip && <p className="mt-5 text-sm text-emerald-900 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3"><strong>Consejo:</strong> {help.tip}</p>}
                        <QuickTextSize />
                        <button type="button" onClick={() => setOpen(false)} className="mt-5 w-full py-3 rounded-2xl bg-indigo-600 text-white text-sm font-black">Entendido</button>
                    </div>
                </div>,
                document.body,
            )}
        </>
    )
}

/** Atajo para agrandar la letra desde la ayuda (también está en Configuración → Mi perfil). */
function QuickTextSize() {
    const [size, setSize] = useState<TextSize>(getTextSize())
    const SAMPLE: Record<TextSize, string> = { normal: 'text-sm', lg: 'text-base', xl: 'text-lg' }
    return (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <span className="text-sm font-semibold text-slate-700">¿Letra pequeña?</span>
            <div role="radiogroup" aria-label="Tamaño de letra" className="flex gap-1.5">
                {TEXT_SIZE_OPTIONS.map(o => (
                    <button key={o.value} type="button" role="radio" aria-checked={size === o.value} aria-label={`Letra ${o.label.toLowerCase()}`}
                        onClick={() => { setTextSize(o.value); setSize(o.value) }}
                        className={`w-11 h-11 rounded-xl font-bold ${SAMPLE[o.value]} ${size === o.value ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}>
                        A
                    </button>
                ))}
            </div>
        </div>
    )
}
