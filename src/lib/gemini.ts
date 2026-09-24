
import { getMethodologyInstructions } from './nemMethodologies'
import { aiGenerate } from './aiClient'

export class GeminiService {
    /**
     * Las llamadas a IA se hacen en el servidor (función Edge `ai-proxy`).
     * Los parámetros del constructor se conservan solo por compatibilidad
     * y se ignoran: el navegador ya no maneja llaves.
     */
     
    constructor(_apiKey?: string, _groqKey?: string, _openaiKey?: string) { }

    /** Compatibilidad: la configuración ahora vive en el servidor. */
     
    public async refreshConfig(..._args: unknown[]) { }

    /** Compatibilidad: el servidor maneja los reintentos entre proveedores. */
    public get isFallingBack(): boolean {
        return false
    }

    // ...


    // ...

    async generateLessonPlanSuggestions(context: {
        topic?: string
        subject?: string
        grade?: string
        field?: string // Campo formativo
        methodology?: string
        problemContext?: string // Contexto socioeducativo / Problemática
        pdaDetail?: string
        sessions?: any[] // Lista de sesiones
        temporality?: string
        purpose?: string
        textbook?: string
        pagesFrom?: string
        pagesTo?: string
        extractedText?: string
        level?: string // Nivel educativo (Primaria, Secundaria, etc.)
    }) {
        const isProject = context.temporality === 'PROJECT'
        const projectPurpose = context.purpose ? `Propósito del Proyecto: ${context.purpose}` : ''

        // Dynamic instructions based on methodology
        const methodologyBox = getMethodologyInstructions(context.methodology || '', context.sessions?.length || 0)

        // Fallback for "General Project" if no specific methodology matched but it is a project
        const projectInstructions = (isProject && !methodologyBox) ? `
            ESTRUCTURA DE PROYECTO (MÉTODO DE PROYECTOS):
            Debes organizar las sesiones siguiendo las fases del método de proyectos (Identificación, Recuperación, Planificación, Acercamiento, Comprensión, Reconocimiento, Concreción, Integración, Difusión, Consideraciones, Avances).
            
            IMPORTANTE:
            - NO pongas solo el nombre de la fase. DESCRIBE ACTIVIDADES ESPECÍFICAS.
            - Distribuye las fases lógicamente en las ${context.sessions?.length} sesiones.
            ` : methodologyBox

        const prompt = `
            Actúa como un experto pedagogo de la Nueva Escuela Mexicana (NEM).
            Genera 3 sugerencias de secuencias didácticas detalladas, creativas y listas para aplicar en clase.
            
            Contexto del Programa Analítico:
            ${context.problemContext || 'No especificado'}

            Parámetros:
            - Tipo: ${isProject ? 'PROYECTO EDUCATIVO (Detallado)' : 'SECUENCIA DIDÁCTICA'}
            - Nivel Educativo: ${context.level || 'No especificado'}
            - Grado: ${context.grade || 'No especificado'}
            - Materia: ${context.subject || 'General'}
            - Tema: ${context.topic || 'No especificado'}
            - ${projectPurpose}
            - Campo: ${context.field || 'Lenguajes'}
            - Metodología: ${context.methodology || 'Aprendizaje Basado en Proyectos'}
            - PDA: ${context.pdaDetail || 'No especificado'}
            ${context.textbook ? `- LIBRO DE TEXTO: "${context.textbook}" (Páginas: ${context.pagesFrom || ''} a ${context.pagesTo || ''})` : ''}
            ${context.extractedText ? `\n--- CONTENIDO TEXTUAL EXTRAÍDO DEL LIBRO (ÚSALO COMO BASE PARA LA PLANEACIÓN) ---\n${context.extractedText.substring(0, 8000)}\n---------------------------------------------------------` : ''}

            ${context.level?.toLowerCase().includes('primaria') ? 'ENFOQUE PRIMARIA: Prioriza actividades lúdicas, material concreto, y evaluación formativa. Usa un lenguaje y dinámicas aptas para niños de primaria.' : ''}

            ${projectInstructions}

            Sesiones a planear (${context.sessions?.length || 0} sesiones):
            ${context.sessions?.map((s, i) => `S${i + 1}: ${s.date} (${s.duration} min)`).join('\n')}
            
            REGLAS PARA EL CONTENIDO (MUY IMPORTANTE):
            1. APERTURA: Actividades para despertar el interés, rescate de saberes previos o planteamiento del conflicto cognitivo. (Mínimo 30 palabras)
            2. DESARROLLO: Actividades centrales, investigación, trabajo colaborativo, creación de productos. Sé muy descriptivo paso a paso. (Mínimo 60 palabras)
            3. CIERRE: Evaluación formativa, socialización, reflexión o tarea. (Mínimo 30 palabras)
            
            NO generes texto abstracto como "Se realizarán actividades de desarrollo". DESCRIBE LA ACTIVIDAD EXACTA.
            ${context.textbook ? `USA EL LIBRO DE TEXTO COMO REFERENCIA: Utiliza los temas y el contexto del libro de texto "${context.textbook}" (páginas ${context.pagesFrom}-${context.pagesTo}) para inspirar tus propuestas. Puedes sugerir actividades propias o adaptaciones que no necesariamente se encuentren literalmente en el libro, siempre que guarden relación con sus contenidos.` : ''}
            
            Debes generar 3 propuestas distintas. Cada propuesta debe contener sugerencias para TODAS las sesiones mencionadas, asegurando progresión pedagógica.

            Formato de respuesta esperado (DEBE SER UN OBJETO JSON VÁLIDO):
            {
                "suggestions": [
                    {
                        "title": "Título sugerente de la propuesta (ej. Proyecto de 3 semanas sobre...)",
                        "sessions": [
                            {
                                "date": "YYYY-MM-DD (copiar de la lista)",
                                "apertura": "Texto de apertura",
                                "desarrollo": "Texto de desarrollo",
                                "cierre": "Texto de cierre"
                            }
                        ]
                    }
                ]
            }
        `

        try {
            const text = await this.callWithFallbacks(prompt)
            const clean = this.cleanJson(text)
            console.log('[GeminiService] Text cleaned, parsing JSON...')
            const data = JSON.parse(clean)

            // Si viene envuelto en un objeto
            let result = Array.isArray(data) ? data : (data.suggestions || data.proposals || data.items || []);
            console.log(`[GeminiService] Parsed ${result.length} suggestions. Content:`, result)

            // Forzar que sea array
            if (!Array.isArray(result)) {
                if (data && typeof data === 'object') {
                    result = Object.values(data).filter(v => typeof v === 'object' && (v as any).title);
                } else {
                    result = [];
                }
            }

            return result;
        } catch (error) {
            console.error('Error generating grading suggestions:', error)
            throw new Error('Falló la generación de sugerencias con IA')
        }
    }

    async summarizeLessonPlanSessions(sessions: any[]) {
        try {
            const prompt = `
                Actúa como un analista pedagógico y diseñador de experiencias de aprendizaje gamificadas. Tu misión es transformar sesiones de clase en "Misiones" épicas.

                SECUENCIA ORIGINAL:
                ${JSON.stringify(sessions)}

                REGLAS CRÍTICAS DE CREATIVIDAD Y COHERENCIA:
                1. 'summary': Un resumen ultra-breve (MÁXIMO 10-15 palabras) para el dropdown del docente.
                2. 'suggestedTitle': UN NOMBRE CREATIVO Y RELACIONADO CON LA ESTRATEGIA (Máximo 5 palabras).
                   - VINCULACIÓN: El título DEBE reflejar tanto el tema como la METODOLOGÍA de la clase.
                   - EJEMPLOS: 'El Gran Juicio de los Átomos', 'Cartografía Visual del Cerebro', 'Alquimia en la Cocina'.
                3. 'instructionRoadmap': UNA GUÍA DETALLADA PARA EL ESTUDIANTE (70-100 palabras).
                   - ESTRUCTURA OBLIGATORIA (usa estos encabezados en MAYÚSCULAS):
                     * MISIÓN: Describe la actividad principal de forma motivadora.
                     * ENTREGABLE: Qué producto concreto deben entregar hoy/al final.
                     * EVALUACIÓN: 2 o 3 criterios clave que tomarás en cuenta para calificar.
                   - Tono: Aventurero, profesional y altamente pedagógico.

                FORMATO ESPERADO (JSON ESTRICTO):
                {
                    "summaries": [
                        {
                            "date": "YYYY-MM-DD",
                            "summary": "Resumen ejecutivo para el docente",
                            "suggestedTitle": "Título vinculado a la Estrategia",
                            "instructionRoadmap": "Instrucciones detalladas y motivadoras para el alumno"
                        }
                    ]
                }
            `

            const text = await this.callWithFallbacks(prompt)
            const clean = this.cleanJson(text)
            const data = JSON.parse(clean)

            return this.ensureArray(data, 'summaries')

        } catch (error) {
            console.error('Error summarizing sessions:', error)
            return []
        }
    }

    async generateAbsenceActivities(context: {
        reason?: string
        days: {
            date: string
            classes: {
                time: string
                duration: number // Duración en minutos
                group: string
                subject: string
                topicContext?: string // Título de la planeación
                pda?: string
                textbook?: string
                pages?: string
                planningDetail?: string // Secuencia didáctica de la planeación
            }[]
        }[]
    }) {
        const prompt = `
            Actúa como un docente experto que debe dejar instrucciones de "Guardia" o "Suplencia" para sus grupos porque tendrá una inasistencia (${context.reason || 'Permiso/Salud'}).
            
            OBJETIVO:
            Generar una "Ficha de Trabajo para el Prefecto/Suplente" por cada clase. 
            Las instrucciones deben ser TAN CLARAS Y SIMPLES que cualquier persona (aunque no sea docente de la materia) pueda darlas y supervisar la clase.

            CONTEXTO DE LAS AUSENCIAS:
            ${context.days.map(d => `
            FECHA: ${d.date}
            Clases ese día:
            ${d.classes.map(c => `- ${c.time} (${c.duration} min): ${c.group} - ${c.subject}
              * Tema: ${c.topicContext || 'Repaso'}
              * PDA: ${c.pda || 'No especificado'}
              * Referencia Libro de Texto: ${c.textbook ? `"${c.textbook}" (Páginas ${c.pages || 'No indicadas'})` : 'No especificado'}
              * Secuencia didáctica docente (Referencia): ${c.planningDetail || 'No hay detalles'}`).join('\n')}
            `).join('\n')}

            REGLAS DE ORO (INCUMPLIRLAS INVALIDA TU RESPUESTA):
            1. LENGUAJE 100% CIUDADANO: 
               - PROHIBIDO usar: "PDA", "Proceso de Desarrollo", "Ejes Articuladores", "Campo Formativo", "Metodología", "Sesión", "Secuencia Didáctica", "Evaluación Formativa", "Conflicto Cognitivo", "Saberes Previos", "Socioeducativo".
               - USA EN SU LUGAR: "Tema", "Actividad", "Lo que van a aprender", "Instrucciones", "Paso 1, 2, 3", "Preguntas", "Ejercicios".
               - Imagina que le hablas a un PREFECTO o un PADRE DE FAMILIA que no sabe nada de pedagogía.
            2. USO DEL LIBRO DE TEXTO (CRÍTICO):
               - Si se proporciona un libro y páginas, TUS ACTIVIDADES DEBEN BASARSE EN ÉL.
               - Instruye explícitamente: "Abran su libro en la página X", "Resuelvan el ejercicio Y".
            3. EXTENSIÓN MÍNIMA:
               - instrucciones_for_substitute: Mínimo 80 palabras. Debe ser un guion paso a paso (Inicio, Desarrollo, Cierre).
               - printable_resource.content: Mínimo 150 palabras. Si usas libro, crea preguntas complementarias o un cuestionario sobre la lectura.
            4. CRONOGRAMA DE LA CLASE:
               - Divide la duración (${context.days.flatMap(d => d.classes.map(c => c.duration)).join('/')} min) en bloques de tiempo exactos (ej. [10 min] Introducción, [30 min] Actividad principal, [10 min] Entrega).
            5. PRODUCTO FÍSICO:
               - Especifica claramente qué debe recibir y firmar el prefecto al final.

            Formato de respuesta esperado (JSON):
            {
                "activities": [
                    {
                        "date": "YYYY-MM-DD",
                        "time": "HH:MM",
                        "duration": "...",
                        "group": "...",
                        "subject": "...",
                        "title": "...",
                        "instructions_for_substitute": "...",
                        "student_work": "...",
                        "printable_resource": {
                           "type": "LECTURA|CUESTIONARIO|EJERCICIO|CASO_ESTUDIO",
                           "title": "...",
                           "content": "Contenido extenso aquí..."
                        },
                        "final_product": "..."
                    }
                ]
            }
        `

        try {
            const text = await this.callWithFallbacks(prompt)
            const clean = this.cleanJson(text)
            const data = JSON.parse(clean)
            console.log('[GeminiService] Absence activities parsed:', data)

            const rawActivities = this.ensureArray(data, 'activities')

            // NORMALIZACIÓN: Asegurar que los campos de texto no sean objetos
            return rawActivities.map(act => ({
                ...act,
                instructions_for_substitute: this.stringifyField(act.instructions_for_substitute),
                student_work: this.stringifyField(act.student_work),
                printable_resource: act.printable_resource ? {
                    ...act.printable_resource,
                    content: this.stringifyField(act.printable_resource.content)
                } : null
            }))
        } catch (error) {
            console.error('Error generating absence activities:', error)
            return []
        }
    }

    private stringifyField(field: any): string {
        if (!field) return ''
        if (typeof field === 'string') return field

        if (typeof field === 'object') {
            // Si la IA devolvió un objeto con momentos (Apertura, Desarrollo, Cierre)
            return Object.entries(field)
                .map(([key, value]) => `${key.toUpperCase()}:\n${this.stringifyField(value)}`)
                .join('\n\n')
        }

        return String(field)
    }

    async generateDiagnosisNarrative(context: {
        communityPoints: string
        schoolPoints: string
        classroomPoints: string
    }) {
        const prompt = `
            Actúa como un experto pedagogo de la Nueva Escuela Mexicana (NEM).
            Toma los siguientes puntos clave sobre el contexto de un docente y redacta una narrativa fluida, 
            profesional y pedagógica para la sección "Lectura de la Realidad / Diagnóstico Socioeducativo" 
            de su Programa Analítico.
            
            Puntos sobre la Comunidad: ${context.communityPoints}
            Puntos sobre la Escuela: ${context.schoolPoints}
            Puntos sobre el Aula: ${context.classroomPoints}

            La redacción debe ser coherente, en tercera persona, y enfocada en cómo estos factores 
            influyen en el proceso de enseñanza-aprendizaje. Máximo 4 párrafos.
        `

        return this.callWithFallbacks(prompt)
    }

    public async generateContent(prompt: string, isJson = false) {
        return this.callWithFallbacks(prompt, isJson)
    }

    private async callWithFallbacks(prompt: string, isJson = false) {
        return aiGenerate(prompt, isJson)
    }

    async suggestPdaForProblem(problem: string, campoFormativo: string) {
        const prompt = `
            Actúa como un experto en la NEM. 
            Dada la siguiente problemática detectada en la escuela: "${problem}" 
            y el Campo Formativo: "${campoFormativo}".
            
            Sugiere 3 Procesos de Desarrollo de Aprendizaje (PDA) que podrían ayudar a abordar esta problemática.
            Explica brevemente la vinculación de cada PDA con el problema.

            Formato de respuesta esperado (JSON):
            [
                { "pda_suggestion": "Descripción del PDA", "vinculation": "Por qué ayuda a resolver el problema" }
            ]
        `

        const text = await this.callWithFallbacks(prompt)
        const clean = this.cleanJson(text)
        return JSON.parse(clean)
    }

    async extractThemesFromText(context: { text?: string, textbookTitle?: string, field?: string }) {
        const prompt = `
            Actúa como un experto pedagogo de la Nueva Escuela Mexicana (NEM).
            TU OBJETIVO: Extraer o proponer entre 5 y 10 "Temas Clave" o "Contenidos de Interés" para una planeación didáctica.
            
            CONTEXTO:
            - Campo Formativo: ${context.field || 'No especificado'}
            - Libro de Texto: ${context.textbookTitle || 'No especificado'}
            ${context.text ? `- TEXTO EXTRAÍDO DEL DOCUMENTO:\n${context.text.substring(0, 5000)}` : ''}

            INSTRUCCIONES:
            1. Analiza el ${context.text ? 'texto extraído' : 'título del libro'} y el Campo Formativo.
            2. Identifica temas específicos, lecciones o conceptos centrales que se mencionan o que son propios del grado y campo.
            3. MUY IMPORTANTE: ESTAS MATERIAS SON DE EDUCACIÓN BÁSICA DE MÉXICO (Primaria/Secundaria). Si el campo formativo es "Lenguajes", se refiere a Español, Inglés o Artes, NUNCA a lenguajes de programación o software.
            4. Los temas deben ser cortos (máximo 6 palabras cada uno).
            5. Devuelve ÚNICAMENTE un array de strings en formato JSON.

            Formato de respuesta esperado:
            ["Tema 1", "Tema 2", "Tema 3", "Tema 4", "Tema 5"]
        `

        try {
            const text = await this.callWithFallbacks(prompt)
            const clean = this.cleanJson(text)
            const data = JSON.parse(clean)
            return Array.isArray(data) ? data : []
        } catch (error) {
            console.error('[GeminiService] Error extracting themes:', error)
            return []
        }
    }

    async generateInstrument(context: { activity: string, subject?: string, type: string }) {
        const isChecklist = context.type === 'CHECKLIST'
        const prompt = `
        Actúas como un experto en evaluación educativa. Genera un instrumento de evaluación tipo "${isChecklist ? 'CHECKLIST (Lista de Cotejo)' : 'ANALYTIC (Rúbrica Analítica)'}" para la siguiente actividad:
        
        ACTIVIDAD: "${context.activity}"
        MATERIA: "${context.subject || 'General'}"
        
        INSTRUCCIONES CRÍTICAS:
        ${isChecklist ? `
        ESTÁS EN MODO LISTA DE COTEJO:
        - El JSON debe ser un ARRAY de objetos.
        - CADA objeto debe tener: "name", "percentage" y "description".
        - PROHIBIDO incluir la propiedad "levels". SOLO se evalúa si cumple o no (Sí/No).
        - La suma de "percentage" debe ser 100.
        ` : `
        ESTÁS EN MODO RÚBRICA ANALÍTICA:
        - El JSON debe ser un ARRAY de objetos (criterios).
        - CADA objeto debe tener: "name", "percentage", "description" y "levels".
        - "levels" debe ser un array con 4 niveles (Excelente, Bueno, Regular, Insuficiente).
        - La suma de "percentage" debe ser 100.
        `}

        Formato exacto para ${isChecklist ? 'LISTA DE COTEJO' : 'RÚBRICA'}:
        ${isChecklist ? `
        [
            {
                "name": "Indicador a evaluar",
                "percentage": 20,
                "description": "Descripción de lo que se observa"
            }
        ]
        ` : `
        [
            {
                "name": "Nombre del Criterio",
                "percentage": 40,
                "description": "Descripción breve",
                "levels": [
                    { "title": "Excelente", "score": 10, "description": "..." },
                    { "title": "Bueno", "score": 8, "description": "..." },
                    { "title": "Regular", "score": 6, "description": "..." },
                    { "title": "Insuficiente", "score": 4, "description": "..." }
                ]
            }
        ]
        `}

        IMPORTANTE: Responde SOLO con el JSON válido, sin texto adicional ni bloques de código.
        `

        try {
            const text = await this.callWithFallbacks(prompt)
            const clean = this.cleanJson(text)
            const data = JSON.parse(clean)
            return this.ensureArray(data, 'criteria')
        } catch (error) {
            console.error("Error generating instrument:", error)
            return [
                { name: "Criterio Generado (Fallback)", percentage: 100, description: "Error en IA, edite manualmente." }
            ]
        }
    }

    async generateAssignmentProposals(context: { topic: string, subject?: string }) {
        const prompt = `
            Actúa como un experto pedagogo. Genera 3 propuestas de actividades de evaluación variadas para el siguiente tema/contexto:
            
            TEMA/ACTIVIDAD: "${context.topic}"
            ASIGNATURA: "${context.subject || 'General'}"
            
            Debes sugerir una mezcla de tipos:
            1. Una Tarea para CASA (Refuerzo/Investigación).
            2. Un Trabajo en CLASE (Práctica/Colaborativo).
            3. Un Proyecto o Evaluación Rápida.

            Para cada propuesta, define:
            - Título atractivo.
            - Descripción clara y estructurada (100-150 palabras).
              * Debe incluir: MISIÓN (pasos), ENTREGABLE (producto final) y EVALUACIÓN (criterios de éxito).
            - Tipo (HOMEWORK, CLASSWORK, PROJECT, EXAM, PARTICIPATION).
            - Entorno/Ubicación (HOME, SCHOOL).
            - Instrumento recomendado (ANALYTIC, CHECKLIST).

            Formato JSON esperado (ARRAY):
            [
                {
                    "title": "...",
                    "description": "...",
                    "type": "HOMEWORK",
                    "location": "HOME",
                    "instrumentType": "ANALYTIC"
                },
                ...
            ]
        `

        try {
            const text = await this.callWithFallbacks(prompt)
            const clean = this.cleanJson(text)
            const data = JSON.parse(clean)
            return this.ensureArray(data, 'proposals')
        } catch (error) {
            console.error("Error generating proposals:", error)
            return []
        }
    }

    async enrichAssignmentDescription(context: { title: string, description: string, subject?: string }) {
        const prompt = `
            Actúa como un experto pedagogo. Tu tarea es "REFORZAR" y "REESTRUCTURAR" la descripción de una actividad escolar existente para que sea clara, motivadora y fácil de dictar.
            
            DATOS DE LA ACTIVIDAD ACTUAL:
            - Título: "${context.title}"
            - Descripción actual: "${context.description}"
            - Asignatura: "${context.subject || 'General'}"
            
            REGLAS DE REFORMULACIÓN:
            1. No inventes un tema nuevo, mantén el objetivo de la descripción original.
            2. Usa LENGUAJE 100% CIUDADANO (evita tecnicismos pedagógicos).
            3. ESTRUCTURA OBLIGATORIA (Usa estos marcadores EXACTOS):
               MISIÓN: [Contenido aquí]
               ENTREGABLE: [Contenido aquí]
               EVALUACIÓN: [Contenido aquí]

            IMPORTANTE: Los marcadores deben estar en una línea nueva. No uses negritas adicionales dentro de los marcadores si interfieren con el texto plano. No incluyas nada más en la respuesta.
        `

        try {
            const text = await this.callWithFallbacks(prompt)
            // No necesitamos limpiar JSON aquí porque pedimos texto plano
            return text.trim()
        } catch (error) {
            console.error("Error enriching assignment:", error)
            return context.description // Fallback a la original
        }
    }

    async generateComprehensiveProgram(context: {
        grade: string
        problem: string
        diagnosis: string
        contexto: string
    }, contents: any) {
        const results = {
            lenguajes: [] as any[],
            saberes: [] as any[],
            etica: [] as any[],
            humano: [] as any[]
        }

        // Generación secuencial con delays para evitar 429
        results.lenguajes = await this.generateFieldProposal(context, contents.lenguajes);
        await new Promise(r => setTimeout(r, 1000));

        results.saberes = await this.generateFieldProposal(context, contents.saberes);
        await new Promise(r => setTimeout(r, 1000));

        results.etica = await this.generateFieldProposal(context, contents.etica);
        await new Promise(r => setTimeout(r, 1000));

        results.humano = await this.generateFieldProposal(context, contents.humano);

        return results;
    }

    async generateFieldProposal(context: {
        grade: string
        problem: string
        diagnosis: string
        phase?: number
    }, contents: Record<string, string[]> | string[]) {

        if (Array.isArray(contents)) {
            const chunks = [];
            for (let i = 0; i < contents.length; i += 10) {
                chunks.push(contents.slice(i, i + 10));
            }

            const results = [];
            for (const chunk of chunks) {
                const res = await this._generateSubjectBatch(context, "General", chunk);
                results.push(...res);
                if (chunks.length > 1) await new Promise(r => setTimeout(r, 500));
            }
            return results;
        }

        const entries = Object.entries(contents);
        const results = [];
        for (const [subject, items] of entries) {
            const res = await this._generateSubjectBatch(context, subject, items);
            results.push(...res);
            await new Promise(r => setTimeout(r, 500));
        }
        return results;
    }

    private async _generateSubjectBatch(context: any, subjectName: string, contentList: string[]) {
        if (!contentList || contentList.length === 0) return [];

        const phase = context.phase || 6;
        const prompt = `
            Actúa como un experto pedagogo de la Nueva Escuela Mexicana (NEM).
            Para cada uno de estos contenidos de ${subjectName.toUpperCase()} (Fase ${phase}), genera:
            ${JSON.stringify(contentList)}

            Para cada contenido individual, debes proporcionar:
            1. Un "pda" (Proceso de Desarrollo de Aprendizaje) adaptado a ${context.grade} (Fase ${phase}).
            2. La "problem" (Relación con esta problemática: ${context.problem}).
            3. "axes" (Array con 1 o 2 Ejes Articuladores).
            4. "guidelines" (Orientación Didáctica de máx 20 palabras, SOLO TEXTO).
            5. "duration" (Número de días sugerido).

            Responde ÚNICAMENTE con un JSON Array siguiendo este formato exacto:
            [
                {
                    "content": "COPIA EXACTA DEL CONTENIDO RECIBIDO",
                    "pda": "Texto del PDA sugerido",
                    "problem": "Descripción de la relación con el problema",
                    "axes": ["Pensamiento Crítico", "Inclusión"],
                    "guidelines": "Texto de la sugerencia didáctica",
                    "duration": "10"
                }
            ]
        `;

        try {
            const response = await this.callWithFallbacks(prompt);
            const data = JSON.parse(this.cleanJson(response));
            let result = Array.isArray(data) ? data : (data.program || data.contents || data.items || []);
            if (!Array.isArray(result)) result = [];

            return result.map((item: any) => ({
                content: typeof item.content === 'object' ? JSON.stringify(item.content) : String(item.content || ''),
                pda: typeof item.pda === 'object' ? JSON.stringify(item.pda) : String(item.pda || ''),
                problem: typeof item.problem === 'object' ? JSON.stringify(item.problem) : String(item.problem || ''),
                axes: Array.isArray(item.axes) ? item.axes.map((a: any) => String(a)) : [],
                guidelines: typeof item.guidelines === 'object' ? JSON.stringify(item.guidelines) : String(item.guidelines || ''),
                duration: String(item.duration || '10')
            }));
        } catch (error) {
            console.error(`Error in batch for ${subjectName}`, error);
            return [];
        }
    }

    private cleanJson(text: string): string {
        try {
            let jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim()

            const firstBracket = Math.min(
                jsonStr.indexOf('[') === -1 ? Infinity : jsonStr.indexOf('['),
                jsonStr.indexOf('{') === -1 ? Infinity : jsonStr.indexOf('{')
            )
            const lastBracket = Math.max(jsonStr.lastIndexOf(']'), jsonStr.lastIndexOf('}'))

            if (firstBracket === Infinity || lastBracket === -1) return jsonStr
            jsonStr = jsonStr.substring(firstBracket, lastBracket + 1)

            // Limpiar comas finales antes de cerrar llaves o corchetes
            jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1')

            // SANEAMIENTO SELECTIVO
            jsonStr = jsonStr.replace(/"((?:[^"\\]|\\.)*)"/g, (match, p1) => {
                 
                // eslint-disable-next-line no-control-regex -- se buscan caracteres de control a propósito
                const cleaned = p1.replace(/[\u0000-\u001F]/g, (c: string) => {
                    if (c === '\n') return '\\n'
                    if (c === '\r') return '\\r'
                    if (c === '\t') return '\\t'
                    return ''
                })
                return `"${cleaned}"`
            })

            return jsonStr
        } catch (e) {
            return text
        }
    }

    private ensureArray(data: any, keyHint?: string): any[] {
        if (Array.isArray(data)) return data
        if (!data || typeof data !== 'object') return []

        const arrays = Object.values(data).filter(v => Array.isArray(v))
        if (arrays.length > 0) {
            if (keyHint && Array.isArray(data[keyHint])) return data[keyHint]
            return arrays[0] as any[]
        }

        return [data]
    }
    async generateDailyClassPlan(context: {
        lessonPlan: any,
        classDate: string,
        duration: string,
        isSecondary: boolean
    }) {
        const lp = context.lessonPlan
        const prompt = `
            Actúa como un experto pedagogo de la Nueva Escuela Mexicana (NEM). 
            Tu objetivo es generar un "Plan de Clase Diario" detallado para la sesión del día ${context.classDate}.
            
            CONTEXTO DE LA PLANEACIÓN GENERAL:
            - Título: ${lp.title}
            - Campo Formativo: ${lp.field}
            - Metodología: ${lp.methodology}
            - Contenido/PDA: ${lp.pda_detail || lp.contents?.join(', ')}
            - Ejes Articuladores: ${lp.ejes_articuladores?.join(', ')}
            
            PARÁMETROS DE LA SESIÓN:
            - Fecha: ${context.classDate}
            - Duración/Tiempo: ${context.duration} ${context.isSecondary ? 'Módulos' : 'Minutos'}
            ${context.isSecondary ? '- NIVEL: SECUNDARIA (Enfócate en profundidad temática y trabajo colegiado)' : '- NIVEL: PRIMARIA (Prioriza actividades lúdicas y material concreto)'}

            REQUISITOS DEL CONTENIDO (DEBES INCLUIR TODOS ESTOS CAMPOS):
            1. GUION MINUTO A MINUTO: Cronograma detallado de la sesión ajustado a la duración de ${context.duration}.
            2. ACTIVIDADES PASO A PASO: Instrucciones claras y sencillas para los alumnos.
            3. PREGUNTAS MOTIVADORAS: Preguntas para detonar el diálogo y pensamiento crítico.
            4. EJES ARTICULADORES: Explicar cómo se integran en esta sesión específica.
            5. INSTRUMENTO DE EVALUACIÓN: Sugerencia de Rúbrica o Lista de Cotejo (editable).
            6. RECURSOS NECESARIOS: Libros NEM, materiales reciclados, digitales, etc.
            7. TAREA SIGNIFICATIVA: Actividad opcional para realizar en casa que vincule con la realidad.

            FORMATO DE RESPUESTA (JSON):
            {
                "script": "Guion minuto a minuto...",
                "activities": "Instrucciones paso a paso...",
                "questions": "Preguntas detonadoras...",
                "axes_integration": "Cómo se aplican los ejes articuladores...",
                "evaluation_instrument": "Rúbrica o lista de cotejo sugerida...",
                "resources": "Materiales detallados...",
                "significant_homework": "Descripción de la tarea (opcional)..."
            }
        `

        try {
            const text = await this.callWithFallbacks(prompt)
            const clean = this.cleanJson(text)
            return JSON.parse(clean)
        } catch (error) {
            console.error('Error generating daily class plan:', error)
            throw new Error('No se pudo generar el plan de clase con IA')
        }
    }
}

export const geminiService = new GeminiService()
