/** Nombre del puesto en español para mostrar (los roles se guardan en inglés). */
export const ROLE_LABEL: Record<string, string> = {
    SUPER_ADMIN: 'Administración VUNLEK',
    ADMIN: 'Administración',
    DIRECTOR: 'Dirección',
    ACADEMIC_COORD: 'Coordinación académica',
    TECH_COORD: 'Coordinación de tecnologías',
    SCHOOL_CONTROL: 'Control escolar',
    TEACHER: 'Docente',
    INDEPENDENT_TEACHER: 'Docente',
    PREFECT: 'Prefectura',
    SUPPORT: 'Apoyo / USAER',
    SOCIAL_WORKER: 'Trabajo social',
    STAFF: 'Personal de apoyo',
    TUTOR: 'Madre, padre o tutor',
    STUDENT: 'Alumno(a)',
    GUEST: 'Invitado',
    PENDING: 'Sin puesto',
}

export const roleLabel = (role?: string | null) => (role ? ROLE_LABEL[String(role).toUpperCase()] ?? role : '')
