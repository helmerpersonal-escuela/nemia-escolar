
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getMethodologyInstructions } from './nemMethodologies'

export class GeminiService {
    private genAI: GoogleGenerativeAI
    private apiKey: string
    private groqKey?: string
    private openaiKey?: string
    private groq: any = null
    private groqModel: string = 'llama-3.3-70b-versatile'
    private modelFlash: any


    private modelPro: any

    private static COOLDOWN_KEY = 'gemini_cooldown_timestamp'
    private static GEMINI_COOLDOWN = 1000 * 60 * 60 // 1 hour

    constructor(apiKey?: string, groqKey?: string, openaiKey?: string) {
        // BUG FIX: Sanitizar INMEDIATAMENTE al recibir del constructor
        // para evitar que refreshConfig use llaves sucias si no hay env/local
        this.apiKey = this.preSanitize(apiKey)
        this.groqKey = this.preSanitize(groqKey)
        this.openaiKey = this.preSanitize(openaiKey)
        this.refreshConfig()

        this.genAI = new GoogleGenerativeAI(this.apiKey)
        this.modelFlash = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
        this.modelPro = this.genAI.getGenerativeModel({ model: "gemini-1.5-pro" })

        console.log(`[GeminiService v2.4] Inicializado. Fallback activo: ${this.isFallingBack}`)
    }

    private preSanitize(val: any): string {
        if (!val || val === 'undefined' || val === 'null') return ''
        let str = String(val).trim()
        str = str.replace(/["']/g, '')
        if (str.includes('=') && !str.includes('{')) {
            const parts = str.split('=')
            const possibleKey = parts[parts.length - 1].trim()
            if (possibleKey.length > 10) str = possibleKey
        }
        return str
    }

    private refreshConfig(key?: string, gKey?: string, oKey?: string) {
        const sanitize = (val: any) => this.preSanitize(val)

        // 1. Try environment variable
        let envKey = sanitize(import.meta.env.VITE_GEMINI_API_KEY)
        let envGKey = sanitize(import.meta.env.VITE_GROQ_API_KEY)
        let envOKey = sanitize(import.meta.env.VITE_OPENAI_API_KEY)

        // 2. Try localStorage (God Mode settings)
        let localKey = '', localGKey = '', localOKey = ''
        try {
            const saved = localStorage.getItem('godmode_ai_settings')
            if (saved && saved !== 'undefined' && saved !== 'null') {
                const settings = JSON.parse(saved)
                localKey = sanitize(settings.gemini_key)
                localGKey = sanitize(settings.groq_key)
                localOKey = sanitize(settings.openai_key)
            }
        } catch (e) {
            console.warn('[GeminiService] Error leyendo configuración local:', e)
        }

        // Final Priority: Argument > God Mode (LocalStorage) > Environment > Current
        const previousKey = this.apiKey
        const previousGKey = this.groqKey
        const previousOKey = this.openaiKey

        this.apiKey = sanitize(key) || localKey || envKey || previousKey
        this.groqKey = sanitize(gKey) || localGKey || envGKey || previousGKey
        this.openaiKey = sanitize(oKey) || localOKey || envOKey || previousOKey

        // BUG FIX: Si la llave cambió o el SDK no está listo, re-inicializar
        if (this.apiKey && (this.apiKey !== previousKey || !this.modelFlash)) {
            console.log('[GeminiService] Re-inicializando SDK con llave válida...')
            this.genAI = new GoogleGenerativeAI(this.apiKey)
            this.modelFlash = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
            this.modelPro = this.genAI.getGenerativeModel({ model: "gemini-1.5-pro" })
        }

        if (!this.apiKey && !this.groqKey && !this.openaiKey) {
            // Only log if not already warned or if we are actually trying to call something
            if (!(window as any).__GEMINI_KEYS_WARNED__) {
                console.warn('[GeminiService] API Key (Gemini o Groq) no configurada aún. Se usará LocalStorage o Fallback si están disponibles.');
                (window as any).__GEMINI_KEYS_WARNED__ = true;
            }
        } else {
            if (this.apiKey) console.log('[GeminiService] Configuración de Gemini lista.')
            if (this.groqKey) console.log('[GeminiService] Configuración de Groq lista.')
            if (this.openaiKey) console.log('[GeminiService] Configuración de OpenAI lista.')
        }
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
            - Grado: ${context.grade || 'No especificado'}
            - Materia: ${context.subject || 'General'}
            - Tema: ${context.topic || 'No especificado'}
            - ${projectPurpose}
            - Campo: ${context.field || 'Lenguajes'}
            - Metodología: ${context.methodology || 'Aprendizaje Basado en Proyectos'}
            - PDA: ${context.pdaDetail || 'No especificado'}
            ${context.textbook ? `- LIBRO DE TEXTO: "${context.textbook}" (Páginas: ${context.pagesFrom || ''} a ${context.pagesTo || ''})` : ''}
            ${context.extractedText ? `\n--- CONTENIDO TEXTUAL EXTRAÍDO DEL LIBRO (ÚSALO COMO BASE PARA LA PLANEACIÓN) ---\n${context.extractedText.substring(0, 8000)}\n---------------------------------------------------------` : ''}

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

    private async callWithFallbacks(prompt: string) {
        this.refreshConfig()
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
                    const is404 = err.message.includes('404') || err.message.includes('not found')
                    errors.push(`SDK (${modelName}): ${err.message}`)
                    console.warn(`[GeminiService] SDK error for ${modelName}:`, err.message)

                    if (is404) {
                        // If it's a 404, this specific model is likely not available in this region/key
                        // We continue to the next model instead of breaking immediately
                        console.log(`[GeminiService] Model ${modelName} returned 404. Trying next...`)
                        continue
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
                            const is404 = response.status === 404
                            errors.push(`Direct (${modelName}): ${response.status} ${errorMsg}`)
                            console.warn(`[GeminiService] Direct fetch error for ${modelName}:`, response.status, errorMsg)

                            if (is404) {
                                console.log(`[GeminiService] Direct fetch ${modelName} returned 404. Trying next...`)
                                continue
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
            const groqKey = this.groqKey

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

        console.log('[OpenAI] Intentando vía OpenAI (GPT-4o mini)...')
        try {
            if (this.openaiKey) {
                const controller = new AbortController()
                const timeoutId = setTimeout(() => controller.abort(), 15000)

                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.openaiKey}`,
                        'Content-Type': 'application/json'
                    },
                    signal: controller.signal,
                    body: JSON.stringify({
                        model: 'gpt-4o-mini',
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
                        console.log('[OpenAI] Respuesta recibida exitosamente.')
                        return text.trim()
                    }
                } else {
                    const errData = await response.json().catch(() => ({}))
                    errors.push(`OpenAI: ${response.status} ${errData.error?.message || response.statusText}`)
                }
            } else {
                errors.push('OpenAI: Llave no configurada.')
            }
        } catch (err: any) {
            errors.push(`OpenAI Error: ${err.name === 'AbortError' ? 'Timeout (15s)' : err.message}`)
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

export const geminiService = new GeminiService()
