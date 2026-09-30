/**
 * Pasos de arranque y sus dependencias. "La regla de oro": si un paso no funciona,
 * casi siempre falta algo del paso anterior. Antes de dejar entrar a una pantalla (o hacer una acción)
 * se revisa que sus pasos previos estén completos y, si no, se dice cuál falta.
 */

export type StepId = 'ciclo' | 'jornada' | 'personal' | 'grupos' | 'materias' | 'asignacion' | 'alumnos' | 'tutores'

export interface SetupStatus {
    workspace: 'SCHOOL' | 'INDEPENDENT'
    role: string
    activeYear: boolean
    periods: number
    hasSchedule: boolean
    teachers: number
    groups: number
    groupSubjects: number
    myAssignments: number
    students: number
    guardians: number
}

export interface StepDef {
    id: StepId
    /** Número del paso en la lista de arranque de 9 pasos */
    number: number
    label: string
    why: string
    path: string
    /** Puestos que pueden completar el paso ellos mismos */
    fixers: string[]
    /** Tipo de solicitud al técnico cuando la persona no puede completarlo */
    requestKind: string
    deps: StepId[]
    done: (s: SetupStatus) => boolean
}

const DIRECTION = ['DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'INDEPENDENT_TEACHER']
const SCHOOL_DATA = [...DIRECTION, 'SCHOOL_CONTROL', 'ACADEMIC_COORD', 'TECH_COORD']
const TEACHER_ROLES = ['TEACHER']

export const STEPS: Record<StepId, StepDef> = {
    ciclo: {
        id: 'ciclo', number: 2, label: 'Ciclo escolar y periodos de evaluación', path: '/settings?tab=cycle', fixers: DIRECTION, requestKind: 'ESCUELA', deps: [],
        why: 'Los grupos, las calificaciones y las planeaciones se guardan dentro de un ciclo y un periodo.',
        done: s => s.activeYear && s.periods > 0,
    },
    jornada: {
        id: 'jornada', number: 3, label: 'Jornada escolar (entrada, salida, módulos y recesos)', path: '/settings?tab=horarios', fixers: DIRECTION, requestKind: 'ESCUELA', deps: [],
        why: 'El horario se arma sobre los módulos de la jornada.',
        done: s => s.hasSchedule,
    },
    personal: {
        id: 'personal', number: 5, label: 'Dar de alta a los docentes', path: '/settings?tab=personal', fixers: DIRECTION, requestKind: 'PERSONAL', deps: [],
        why: 'Cada materia necesita un docente.',
        done: s => s.workspace === 'INDEPENDENT' || s.teachers > 0,
    },
    grupos: {
        id: 'grupos', number: 6, label: 'Crear los grupos (grado, grupo y turno)', path: '/groups', fixers: SCHOOL_DATA, requestKind: 'GRUPOS', deps: ['ciclo'],
        why: 'Los alumnos, las materias y la lista se organizan por grupo.',
        done: s => s.groups > 0,
    },
    materias: {
        id: 'materias', number: 7, label: 'Asignar materias y docente a cada grupo', path: '/groups', fixers: SCHOOL_DATA, requestKind: 'GRUPOS', deps: ['grupos', 'personal'],
        why: 'El horario, las planeaciones y la evaluación se hacen por materia.',
        done: s => s.groupSubjects > 0,
    },
    asignacion: {
        id: 'asignacion', number: 7, label: 'Asignarte tus grupos y materias', path: '/groups', fixers: SCHOOL_DATA, requestKind: 'GRUPOS', deps: ['materias'],
        why: 'Solo ves los grupos y materias que la escuela te asignó.',
        // Solo aplica a docentes de escuela; los demás puestos ven todos los grupos
        done: s => s.workspace === 'INDEPENDENT' || !TEACHER_ROLES.includes(s.role) || s.myAssignments > 0,
    },
    alumnos: {
        id: 'alumnos', number: 8, label: 'Inscribir a los alumnos', path: '/groups', fixers: SCHOOL_DATA, requestKind: 'ALUMNOS', deps: ['grupos'],
        why: 'Sin alumnos inscritos no hay lista, calificaciones ni reportes.',
        done: s => s.students > 0,
    },
    tutores: {
        id: 'tutores', number: 8, label: 'Registrar a los tutores con sus teléfonos', path: '/groups', fixers: SCHOOL_DATA, requestKind: 'ALUMNOS', deps: ['alumnos'],
        why: 'El código de cada familia se genera a partir de su tutor registrado.',
        done: s => s.guardians > 0,
    },
}

const ORDER: StepId[] = ['ciclo', 'jornada', 'personal', 'grupos', 'materias', 'asignacion', 'alumnos', 'tutores']

/** Pasos que faltan para `required`, incluyendo los previos de los que dependen, en el orden en que se hacen. */
export function missingSteps(status: SetupStatus, required: StepId[]): StepDef[] {
    const need = new Set<StepId>()
    const visit = (id: StepId) => { if (need.has(id)) return; need.add(id); STEPS[id].deps.forEach(visit) }
    required.forEach(visit)
    return ORDER.filter(id => need.has(id) && !STEPS[id].done(status)).map(id => STEPS[id])
}

export const canFix = (step: StepDef, role: string) => step.fixers.includes(String(role).toUpperCase())

/** Enlace a una solicitud al técnico ya llenada. */
export const requestLink = (step: StepDef, action: string) =>
    `/solicitudes?tipo=${encodeURIComponent(step.requestKind)}&titulo=${encodeURIComponent(`Falta: ${step.label}`)}&detalle=${encodeURIComponent(`Quise ${action} y VUNLEK indica que primero falta el paso ${step.number}: ${step.label}.`)}`
