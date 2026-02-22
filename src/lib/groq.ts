
import { getMethodologyInstructions } from './nemMethodologies'

export class GroqService {
    private apiKey: string;
    private baseUrl = 'https://api.groq.com/openai/v1/chat/completions';
    private model = 'llama-3.1-8b-instant'; // Cambio a 8b para mayor velocidad y límites de tasa más altos

    constructor(apiKey?: string) {
        // 1. Try environment variable
        let key = import.meta.env.VITE_GROQ_API_KEY

        // 2. Try localStorage (God Mode settings)
        if (!key) {
            try {
                const saved = localStorage.getItem('godmode_ai_settings')
                if (saved && saved !== 'undefined' && saved !== 'null') {
                    const settings = JSON.parse(saved)
                    if (settings.groq_key) {
                        key = settings.groq_key
                        console.log('[GroqService] Usando API Key de configuración global (God Mode)')
                    }
                }
            } catch (e) {
                console.warn('[GroqService] Error leyendo configuración local:', e)
            }
        }

        // Priority: Argument > Environment > LocalStorage
        this.apiKey = (apiKey || key || '').trim();

        // Autodetección de Proveedor: Grok (xAI) vs Groq
        if (this.apiKey.startsWith('xai-')) {
            this.baseUrl = 'https://api.x.ai/v1/chat/completions';
            this.model = 'grok-3';
            console.log('[GroqService] Detectada llave de xAI (Grok). Usando modelo grok-3');
        } else {
            this.baseUrl = 'https://api.groq.com/openai/v1/chat/completions';
            this.model = 'llama-3.1-8b-instant';
        }

        if (this.apiKey) {
            console.log(`[GroqService] Inicializado satisfactoriamente (${this.apiKey.substring(0, 4)}...${this.apiKey.slice(-4)})`);
        } else {
            console.warn('[GroqService] Inicializado SIN clave API');
        }
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
        `;

        try {
            const text = await this.callGroq(prompt, true);
            const data = JSON.parse(text);

            // Si viene envuelto en un objeto (hallucinación común de modelos pequeños o requisito de json_object)
            let result = Array.isArray(data) ? data : (data.suggestions || data.proposals || data.items || Object.values(data).filter(v => typeof v === 'object'));

            // Forzar que sea array
            if (!Array.isArray(result)) {
                // Si aún no es array, pero es un objeto con propiedades, intentar convertirlo
                if (data && typeof data === 'object') {
                    result = Object.values(data).filter(v => typeof v === 'object' && (v as any).title);
                } else {
                    result = [];
                }
            }

            return result;
        } catch (error) {
            console.error('Error generating Groq suggestions:', error);
            throw new Error('Falló la generación de sugerencias con Grok');
        }
    }

    private async callGroq(prompt: string, isJson = false): Promise<string> {
        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        {
                            role: 'system',
                            content: 'Eres un experto pedagogo de la Nueva Escuela Mexicana (NEM). ' +
                                (isJson ? 'Responde únicamente con el objeto JSON solicitado, sin texto extra ni bloques de código markdown.' : '')
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.7,
                    response_format: isJson ? { type: 'json_object' } : undefined
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const msg = (typeof errorData.error === 'string' ? errorData.error : errorData.error?.message) || errorData.message || response.statusText;

                // Si es error 400 por JSON, reintentar sin modo JSON forzado pero pidiéndolo en el prompt
                if (response.status === 400 && isJson) {
                    console.warn('[GroqService] Falló con json_object, reintentando modo texto...');
                    return this.callGroq(prompt, false);
                }

                // Si es error de límite de tasa, sugerir esperar
                if (response.status === 429) {
                    throw new Error(`Límite de Groq alcanzado (429): ${msg}. Por favor espera unos minutos.`);
                }

                if (response.status === 401) {
                    throw new Error(`Error de Autenticación (401): La clave API de Groq es inválida o ha expirado. Por favor verifica los Ajustes de IA.`);
                }

                throw new Error(`Error de Groq (${response.status}): ${msg}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || '';
        } catch (error: any) {
            console.error('Error in Groq call:', error);
            throw error;
        }
    }

    async generateDiagnosis(schoolData: any, groupData: any) {
        const prompt = `
            Genera un diagnóstico grupal pedagógico detallado para:
            Escuela: ${schoolData.name}
            Grado: ${schoolData.grades}
            Contexto: ${schoolData.location}
            
            Datos del grupo:
            ${groupData}
            
            Incluye:
            1. Fortalezas académicas
            2. Áreas de oportunidad
            3. Estilos de aprendizaje predominantes
            4. Recomendaciones generales
        `;
        return this.callGroq(prompt);
    }

    async suggestPDAs(content: string, grade: string, phase: number = 6) {
        const prompt = `
            Para el contenido: "${content}" del grado ${grade} (Fase ${phase}),
            sugiere 3 Procesos de Desarrollo de Aprendizaje (PDA) específicos y accionables.
            Formato: Lista numerada.
        `;
        return this.callGroq(prompt);
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
        `;

        try {
            const responseText = await this.callGroq(prompt, true);
            const data = JSON.parse(responseText || '[]');
            // Llama a veces devuelve un objeto {"temas": [...]} en lugar de un array plano
            if (Array.isArray(data)) return data;

            const values = Object.values(data);
            const firstArray = values.find(Array.isArray);
            return firstArray || [];
        } catch (error) {
            console.error('[GroqService] Error extracting themes:', error);
            return [];
        }
    }

    async generateStructuredProgram(context: {
        grade: string
        problem: string
        diagnosis: string
        contexto: string
        phase?: number
    }) {
        const phase = context.phase || 6;
        const prompt = `
            Actúa como un experto pedagogo de la Nueva Escuela Mexicana (NEM).
            Genera una propuesta de Programa Analítico para ${context.grade} (Fase ${phase}) basada en:
            - Grado: ${context.grade}
            - Problemática Principal: ${context.problem}
            - Diagnóstico: ${context.diagnosis}
            - Contexto: ${context.contexto}

            Debes generar una propuesta para CADA UNO de los 4 Campos Formativos, seleccionando contenidos del Programa Sintético Fase ${phase} que se relacionen con la problemática.
            
            Estructura de respuesta requerida (JSON estricto):
            {
                "lenguajes": [
                    {
                        "content": "Contenido exacto del programa sintético...",
                        "pda": "Proceso de desarrollo de aprendizaje...",
                        "problem": "Problemática específica o tema de interés...",
                        "axes": ["Eje 1", "Eje 2"],
                        "guidelines": "Orientación didáctica breve...",
                        "duration": "10"
                    }
                ],
                "saberes": [ ... ],
                "etica": [ ... ],
                "humano": [ ... ]
            }
            
            Reglas:
            - "axes" deben ser Ejes Articuladores reales (Inclusión, Pensamiento Crítico, Interculturalidad crítica, Igualdad de género, Vida saludable, Apropiación de las culturas a través de la lectura y la escritura, Artes y experiencias estéticas).
            - "duration" es el número de días estimado (texto numérico).
            - Genera al menos 2 contenidos por campo que sean pertinentes.
            - Usa un tono profesional y pedagógico.
        `;

        try {
            const text = await this.callGroq(prompt, true);
            return JSON.parse(text);
        } catch (e) {
            console.error("Error parsing structured program", e);
            return null;
        }
    }

    async generateContent(prompt: string, isJson = false) {
        return this.callGroq(prompt, isJson);
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

        // Si es un array plano, lo procesamos en un solo lote (o dividido si es muy grande)
        if (Array.isArray(contents)) {
            // Dividir en lotes de 10 para no saturar el prompt
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

        // Si es un objeto agrupado por materia
        const entries = Object.entries(contents);
        const results = [];
        for (const [subject, items] of entries) {
            const res = await this._generateSubjectBatch(context, subject, items);
            results.push(...res);
            await new Promise(r => setTimeout(r, 500)); // Delay entre materias
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
            const response = await this.callGroq(prompt, true);
            const data = JSON.parse(response);

            // Si viene envuelto en un objeto (hallucinación común de modelos pequeños)
            let result = Array.isArray(data) ? data : (data.program || data.contents || data.items || []);

            // Forzar que sea array
            if (!Array.isArray(result)) result = [];

            // Limpieza y validación de strings (para evitar "object as child")
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
}
