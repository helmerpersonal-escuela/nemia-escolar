export const NEM_METHODOLOGIES = {
    'PROJECTS': {
        keywords: ['proyecto', 'comunitario'],
        name: 'Aprendizaje Basado en Proyectos Comunitarios',
        structure: `
        ESTRUCTURA OBLIGATORIA (Aprendizaje Basado en Proyectos Comunitarios):
        Debes organizar las sesiones siguiendo estas 3 FASES y 11 MOMENTOS:

        FASE 1: PLANEACIÓN
        - Momento 1: Identificación (del problema real y del insumo inicial).
        - Momento 2: Recuperación (de saberes previos y conocimientos del grupo).
        - Momento 3: Planificación (negociación de pasos, tiempos, producciones y responsables).

        FASE 2: ACCIÓN
        - Momento 4: Acercamiento (exploración inicial del problema).
        - Momento 5: Comprensión y producción (análisis profundo y creación de los productos).
        - Momento 6: Reconocimiento (identificar avances, dificultades y ajustes).
        - Momento 7: Concreción (primera versión completa del producto).
        - Momento 8: Integración (intercambio, retroalimentación y mejoras).

        FASE 3: INTERVENCIÓN
        - Momento 9: Difusión (presentación y aplicación en la escuela o comunidad).
        - Momento 10: Consideraciones (reflexión sobre el impacto).
        - Momento 11: Avances (seguimiento, evaluación del impacto y propuestas de mejora).
        `
    },
    'ABP': {
        keywords: ['problemas', 'abp'],
        name: 'Aprendizaje Basado en Problemas (ABP)',
        structure: `
        ESTRUCTURA OBLIGATORIA (Aprendizaje Basado en Problemas - ABP):
        Debes organizar las sesiones siguiendo estas 6 ETAPAS:

        1. Presentemos (reflexión inicial con imagen o lectura detonadora).
        2. Recolectemos (recuperar saberes previos sobre el tema).
        3. Formulemos el problema (definir claramente el problema a investigar).
        4. Organicemos la experiencia (plan de indagación y ruta de trabajo).
        5. Vivamos la experiencia (ejecución, indagación y resolución).
        6. Resultados y análisis (cierre, difusión de hallazgos y nuevas preguntas).
        `
    },
    'STEAM': {
        keywords: ['indagación', 'steam', 'científico'],
        name: 'Aprendizaje Basado en Indagación (STEAM)',
        structure: `
        ESTRUCTURA OBLIGATORIA (Aprendizaje Basado en Indagación - STEAM):
        Debes organizar las sesiones siguiendo estos 5 CICLOS/FASES:

        1. Introducción al tema y identificación de la problemática (uso de conocimientos previos).
        2. Diseño de investigación y desarrollo de la indagación (experimentación, búsqueda).
        3. Organización y estructuración de respuestas (análisis de datos obtenidos).
        4. Presentación de resultados y propuestas de acción (solución).
        5. Metacognición (reflexión sobre el proceso y lo aprendido).
        `
    },
    'SERVICE': {
        keywords: ['servicio', 'as'],
        name: 'Aprendizaje Servicio (AS)',
        structure: `
        ESTRUCTURA OBLIGATORIA (Aprendizaje Servicio - AS):
        Debes organizar las sesiones siguiendo estas 5 ETAPAS:

        1. Punto de partida (sensibilización e identificación de necesidad comunitaria).
        2. Lo que sé y lo que quiero saber (diagnóstico participativo y saberes previos).
        3. Organicemos las actividades (planificación detallada del servicio).
        4. Creatividad en marcha (ejecución del servicio y monitoreo).
        5. Compartimos y evaluamos lo aprendido (evaluación final y proyección).
        `
    }
}

export const getMethodologyInstructions = (methodologyInput: string, sessionsCount: number): string => {
    const input = methodologyInput?.toLowerCase() || '';
    let selected = null;

    if (input.includes('proyecto') || input.includes('comunitario')) selected = NEM_METHODOLOGIES.PROJECTS;
    else if (input.includes('problemas') || input.includes('abp')) selected = NEM_METHODOLOGIES.ABP;
    else if (input.includes('indagación') || input.includes('steam')) selected = NEM_METHODOLOGIES.STEAM;
    else if (input.includes('servicio')) selected = NEM_METHODOLOGIES.SERVICE;

    if (!selected) return '';

    return `
    ${selected.structure}

    IMPORTANTE:
    - NO pongas solo el nombre de la fase/momento. ESO NO SIRVE.
    - DEBES describir ACTIVIDADES ESPECÍFICAS para el docente y los alumnos en cada sesión.
    - Distribuye estos momentos/etapas lógicamente a lo largo de las ${sessionsCount} sesiones disponibles.
    - Si hay pocas sesiones, puedes agrupar momentos. Si hay muchas, puedes dedicar varias sesiones a un momento complejo (como la Acción/Ejecución).
    `;
}
