
import { GoogleGenerativeAI } from '@google/generative-ai'

export class GeminiService {
    private genAI: GoogleGenerativeAI
    private apiKey: string

    private static COOLDOWN_KEY = 'gemini_cooldown_timestamp'
    private static GEMINI_COOLDOWN = 1000 * 60 * 60 // 1 hour

    constructor(apiKey: string) {
        const verifiedKey = import.meta.env.VITE_GEMINI_API_KEY || ''
        this.apiKey = apiKey || verifiedKey
        console.log('[GeminiService v2.1] Inicializado. Fallback activo:', this.isFallingBack)
        this.genAI = new GoogleGenerativeAI(this.apiKey)
    }

    public get isFallingBack(): boolean {
        try {
            const lastFail = localStorage.getItem(GeminiService.COOLDOWN_KEY)
            if (!lastFail) return false
            const now = Date.now()
            return (now - parseInt(lastFail)) < GeminiService.GEMINI_COOLDOWN
        } catch { return false }
    }

    private markGeminiAsFailed() {
        try {
            localStorage.setItem(GeminiService.COOLDOWN_KEY, Date.now().toString())
        } catch { }
    }

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
    }) {
        const isProject = context.temporality === 'PROJECT'
        const projectPurpose = context.purpose ? `Propósito del Proyecto: ${context.purpose}` : ''

        const projectInstructions = isProject ? `
            ESTRUCTURA DE PROYECTO (MÉTODO DE PROYECTOS):
            Debes organizar las sesiones siguiendo las fases del método de proyectos (Identificación, Recuperación, Planificación, Acercamiento, Comprensión, Reconocimiento, Concreción, Integración, Difusión, Consideraciones, Avances).
            
            IMPORTANTE:
            - NO pongas solo el nombre de la fase (ej. "Fase de Identificación"). ESO NO SIRVE.
            - DEBES describir ACTIVIDADES ESPECÍFICAS para el docente y los alumnos.
            - Incluye preguntas detonadoras, dinámicas de grupo, investigaciones específicas.
            - Menciona recursos didácticos concretos en la redacción (libros, videos, materiales).
            - Distribuye las fases lógicamente en las ${context.sessions?.length} sesiones.
            ` : ''

        const prompt = `
            Actúa como un experto pedagogo de la Nueva Escuela Mexicana (NEM).
            Genera 3 sugerencias de secuencias didácticas detalladas, creativas y listas para aplicar en clase.
            
            Contexto del Programa Analítico:
            ${context.problemContext || 'No especificado'}

            Parámetros:
            - Tipo: ${isProject ? 'PROYECTO EDUCATIVO (Detallado)' : 'SECUENCIA DIDÁCTICA'}
            - Grado: ${context.grade || 'No especificado'}
            - Materia: ${context.subject || 'General'}
            - Tema: ${context.topic || 'No especificado'}
            - ${projectPurpose}
            - Campo: ${context.field || 'Lenguajes'}
            - Metodología: ${context.methodology || 'Aprendizaje Basado en Proyectos'}
            - PDA: ${context.pdaDetail || 'No especificado'}

            ${projectInstructions}

            Sesiones a planear (${context.sessions?.length || 0} sesiones):
            ${context.sessions?.map((s, i) => `S${i + 1}: ${s.date} (${s.duration} min)`).join('\n')}
            
            REGLAS PARA EL CONTENIDO (MUY IMPORTANTE):
            1. APERTURA: Actividades para despertar el interés, rescate de saberes previos o planteamiento del conflicto cognitivo. (Mínimo 30 palabras)
            2. DESARROLLO: Actividades centrales, investigación, trabajo colaborativo, creación de productos. Sé muy descriptivo paso a paso. (Mínimo 60 palabras)
            3. CIERRE: Evaluación formativa, socialización, reflexión o tarea. (Mínimo 30 palabras)
            
            NO generes texto abstracto como "Se realizarán actividades de desarrollo". DESCRIBE LA ACTIVIDAD EXACTA.
            
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
              * Secuencia didáctica docente (Referencia): ${c.planningDetail || 'No hay detalles'}`).join('\n')}
            `).join('\n')}

            REGLAS DE ORO (INCUMPLIRLAS INVALIDA TU RESPUESTA):
            1. LENGUAJE 100% CIUDADANO: 
               - PROHIBIDO usar: "PDA", "Proceso de Desarrollo", "Ejes Articuladores", "Campo Formativo", "Metodología", "Sesión", "Secuencia Didáctica", "Evaluación Formativa", "Conflicto Cognitivo", "Saberes Previos", "Socioeducativo".
               - USA EN SU LUGAR: "Tema", "Actividad", "Lo que van a aprender", "Instrucciones", "Paso 1, 2, 3", "Preguntas", "Ejercicios".
               - Imagina que le hablas a un PREFECTO o un PADRE DE FAMILIA que no sabe nada de pedagogía.
            2. EXTENSIÓN MÍNIMA:
               - instrucciones_for_substitute: Mínimo 80 palabras. Debe ser un guion paso a paso (Inicio, Desarrollo, Cierre).
               - printable_resource.content: Mínimo 150 palabras. No pongas solo "Hacer ejercicio"; DEBES escribir el ejercicio completo (preguntas, lecturas, casos).
            3. CRONOGRAMA DE LA CLASE:
               - Divide la duración (${context.days.flatMap(d => d.classes.map(c => c.duration)).join('/')} min) en bloques de tiempo exactos (ej. [10 min] Introducción, [30 min] Actividad principal, [10 min] Entrega).
            4. PRODUCTO FÍSICO:
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

    private async callWithFallbacks(prompt: string) {
        const now = Date.now()
        const skipGemini = this.isFallingBack

        const modelsToTry = [
            'gemini-1.5-flash-latest',
            'gemini-1.5-flash',
            'gemini-1.5-pro-latest',
            'gemini-1.5-pro',
            'gemini-pro'
        ]
        let errors: string[] = []

        if (!skipGemini) {
            for (const modelName of modelsToTry) {
                try {
                    console.log(`[SDK] Probando modelo: ${modelName}...`)
                    const model = this.genAI.getGenerativeModel({ model: modelName })
                    const result = await model.generateContent(prompt)
                    const response = await result.response
                    const text = response.text()
                    if (text) return text.trim()
                } catch (err: any) {
                    errors.push(`SDK (${modelName}): ${err.message}`)
                    if (err.message.includes('404')) {
                        this.markGeminiAsFailed()
                        break // Si un modelo da 404, es probable que todos den 404 (región/config)
                    }
                }
            }

            if (!this.isFallingBack) {
                console.log('[Direct] Intentando vía Fetch directo (API v1beta)...')
                for (const modelName of modelsToTry) {
                    try {
                        const cleanModelName = modelName.startsWith('models/') ? modelName.split('/')[1] : modelName
                        const url = `https://generativelanguage.googleapis.com/v1/models/${cleanModelName}:generateContent?key=${this.apiKey}`
                        const response = await fetch(url, {
                            // Usar abort controller para no colgar
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                        })
                        if (response.ok) {
                            const data = await response.json()
                            const text = data.candidates?.[0]?.content?.parts?.[0]?.text
                            if (text) return text.trim()
                        } else {
                            const errData = await response.json().catch(() => ({}))
                            const errorMsg = errData.error?.message || response.statusText
                            errors.push(`Direct (${modelName}): ${response.status} ${errorMsg}`)
                            if (response.status === 404) {
                                this.markGeminiAsFailed()
                                break
                            }
                        }
                    } catch (err: any) {
                        errors.push(`Fetch (${modelName}): ${err.message}`)
                    }
                }
            }
        } else {
            console.log('[Gemini] Saltando temporalmente debido a errores previos...')
        }

        console.log('[Groq] Intentando vía Groq (Llama 3)...')
        try {
            const groqKey = import.meta.env.VITE_GROQ_API_KEY || ''

            // Usar AbortController para timeout
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 15000) // 15s timeout

            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${groqKey}`,
                    'Content-Type': 'application/json'
                },
                signal: controller.signal,
                body: JSON.stringify({
                    model: 'llama-3.1-8b-instant',
                    messages: [
                        { role: 'system', content: 'Eres un experto pedagogo de la Nueva Escuela Mexicana (NEM). Responde ÚNICAMENTE con el JSON solicitado.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.7
                })
            })

            clearTimeout(timeoutId)

            if (response.ok) {
                const data = await response.json()
                const text = data.choices?.[0]?.message?.content
                if (text) {
                    console.log('[Groq] Respuesta recibida exitosamente.')
                    return text.trim()
                }
            } else {
                const errData = await response.json().catch(() => ({}))
                errors.push(`Groq: ${response.status} ${errData.error?.message || response.statusText}`)
            }
        } catch (err: any) {
            errors.push(`Groq Error: ${err.name === 'AbortError' ? 'Timeout (15s)' : err.message}`)
        }

        throw new Error(`Ningún modelo de IA pudo procesar la solicitud.\n\nResumen:\n- ${errors.join('\n- ')}`)
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
            - Descripción clara (instrucciones breves).
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

            // SANEAMIENTO SELECTIVO: Solo escapamos caracteres de control (como saltos de línea reales)
            // SI ocurren dentro de una cadena de texto de JSON ("...").
            jsonStr = jsonStr.replace(/"((?:[^"\\]|\\.)*)"/g, (match, p1) => {
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

        // Try to find the first array property
        const arrays = Object.values(data).filter(v => Array.isArray(v))
        if (arrays.length > 0) {
            // If there's a key hint (like 'suggestions' or 'proposals'), try to match it first
            if (keyHint && Array.isArray(data[keyHint])) return data[keyHint]
            return arrays[0] as any[]
        }

        // If it's a single object that matches the expected structure, wrap it in an array
        return [data]
    }
}

export const geminiService = new GeminiService('')
