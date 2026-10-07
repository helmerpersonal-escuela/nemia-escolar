/** Catálogo base de incidencias. Cada escuela puede agregar las suyas desde la bitácora. */
export type IncidentType = 'CONDUCTA' | 'ACADEMICO' | 'EMOCIONAL' | 'POSITIVO' | 'SALUD'
export type Severity = 'BAJA' | 'MEDIA' | 'ALTA'
export interface CatalogItem { id?: string; name: string; type: IncidentType; severity: Severity; measure: string | null; base?: boolean }

export const TYPE_LABEL: Record<IncidentType, string> = { CONDUCTA: 'Conducta', ACADEMICO: 'Académica', EMOCIONAL: 'Socioemocional', SALUD: 'Salud', POSITIVO: 'Reconocimiento' }
export const SEVERITY_LABEL: Record<Severity, string> = { BAJA: 'Leve', MEDIA: 'Moderada', ALTA: 'Grave' }
export const STATUS_LABEL: Record<string, string> = { OPEN: 'En seguimiento', RESOLVED: 'Atendida', SIGNED: 'Firmada por la familia' }
export const PROGRESS_LABEL: Record<string, string> = { SIN_AVANCE: 'Sin avance', EN_PROCESO: 'En proceso', CUMPLIDO: 'Cumplido' }

export const BASE_CATALOG: CatalogItem[] = [
    { name: 'Llegó tarde al salón', type: 'CONDUCTA', severity: 'BAJA', measure: 'Diálogo con el alumno y registro del retardo.' },
    { name: 'No trajo el material de trabajo', type: 'ACADEMICO', severity: 'BAJA', measure: 'Aviso a la familia y acuerdo de entrega.' },
    { name: 'No entregó tareas o proyectos', type: 'ACADEMICO', severity: 'BAJA', measure: 'Plan de regularización con fechas.' },
    { name: 'Uso del celular durante la clase', type: 'CONDUCTA', severity: 'BAJA', measure: 'Resguardo del equipo y entrega a la familia.' },
    { name: 'Interrumpió la clase de forma reiterada', type: 'CONDUCTA', severity: 'BAJA', measure: 'Diálogo y compromiso por escrito.' },
    { name: 'Portó el uniforme incompleto', type: 'CONDUCTA', severity: 'BAJA', measure: 'Aviso a la familia.' },
    { name: 'Salió del salón sin permiso', type: 'CONDUCTA', severity: 'MEDIA', measure: 'Citatorio a la familia y compromiso.' },
    { name: 'Faltó al respeto a un compañero', type: 'CONDUCTA', severity: 'MEDIA', measure: 'Mediación entre los involucrados y acuerdo de convivencia.' },
    { name: 'Faltó al respeto al personal', type: 'CONDUCTA', severity: 'MEDIA', measure: 'Citatorio a la familia y carta compromiso.' },
    { name: 'Dañó mobiliario o material de la escuela', type: 'CONDUCTA', severity: 'MEDIA', measure: 'Reparación del daño acordada con la familia.' },
    { name: 'Copió en una evaluación', type: 'ACADEMICO', severity: 'MEDIA', measure: 'Nueva evaluación y diálogo con la familia.' },
    { name: 'Se ausentó de la escuela sin aviso', type: 'CONDUCTA', severity: 'MEDIA', measure: 'Llamada a la familia el mismo día.' },
    { name: 'Agresión física a un compañero', type: 'CONDUCTA', severity: 'ALTA', measure: 'Separar, atender a los involucrados, citar a las familias y aplicar el protocolo de convivencia.' },
    { name: 'Acoso escolar', type: 'CONDUCTA', severity: 'ALTA', measure: 'Activar el protocolo de la autoridad educativa, proteger a quien lo recibe y citar a las familias.' },
    { name: 'Introdujo objetos o sustancias no permitidos', type: 'CONDUCTA', severity: 'ALTA', measure: 'Resguardo, aviso inmediato a la dirección y a la familia; seguir el protocolo.' },
    { name: 'Se le observa triste o aislado', type: 'EMOCIONAL', severity: 'MEDIA', measure: 'Entrevista con su asesor y aviso a la familia; canalizar si continúa.' },
    { name: 'Crisis emocional en la escuela', type: 'EMOCIONAL', severity: 'ALTA', measure: 'Acompañar en un lugar tranquilo, avisar a la familia y canalizar a apoyo especializado.' },
    { name: 'Se sintió mal o se lastimó', type: 'SALUD', severity: 'MEDIA', measure: 'Primeros auxilios, aviso a la familia y registro de quién lo recogió.' },
    { name: 'Apoyó a sus compañeros', type: 'POSITIVO', severity: 'BAJA', measure: 'Reconocimiento ante el grupo y aviso a la familia.' },
    { name: 'Participación destacada', type: 'POSITIVO', severity: 'BAJA', measure: 'Reconocimiento y aviso a la familia.' },
].map(c => ({ ...c, base: true })) as CatalogItem[]

/** Catálogo completo: el de base más lo que agregó la escuela, sin repetir nombres. */
export function mergeCatalog(own: CatalogItem[]): CatalogItem[] {
    const names = new Set(own.map(c => c.name.trim().toLowerCase()))
    return [...own, ...BASE_CATALOG.filter(c => !names.has(c.name.toLowerCase()))]
        .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name, 'es'))
}
