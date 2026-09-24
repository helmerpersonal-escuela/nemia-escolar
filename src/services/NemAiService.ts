import { supabase } from '../lib/supabase';
import { aiEmbed } from '../lib/aiClient';

export class NemAiService {
    /**
     * Genera embeddings usando OpenAI text-embedding-3-small (1536 dimensiones)
     */
    async generateEmbedding(text: string): Promise<number[]> {
        try {
            return await aiEmbed(text);
        } catch (error) {
            console.error('Error generating embedding:', error);
            throw new Error('Falló la generación del vector de embedding.');
        }
    }

    /**
     * Guarda un documento en Supabase y sus fragmentos vectorizados
     */
    async processAndStoreDocument(file: File, extractedText: string, chunks: string[], uploaderId: string) {
        const { data: document, error: docError } = await supabase
            .from('nem_documents')
            .insert({
                title: file.name.replace('.pdf', ''),
                file_url: 'local',
                original_filename: file.name,
                file_size_bytes: file.size,
                uploaded_by: uploaderId
            })
            .select()
            .single();

        if (docError) throw new Error(`Error guardando el documento: ${docError.message}`);

        const batchSize = 10;
        const totalChunks = chunks.length;
        console.log(`Procesando ${totalChunks} fragmentos para vectorización...`);

        let insertedCount = 0;

        for (let i = 0; i < totalChunks; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize);

            const embeddings = await aiEmbed(batch);

            const insertPayload = batch.map((chunkText, index) => ({
                document_id: document.id,
                content: chunkText,
                embedding: embeddings[index],
                chunk_index: i + index
            }));

            const { error: chunkError } = await supabase
                .from('nem_document_chunks')
                .insert(insertPayload);

            if (chunkError) {
                console.error('Error guardando un lote de fragmentos:', chunkError);
            } else {
                insertedCount += batch.length;
            }
        }

        return {
            document,
            chunksProcessed: insertedCount,
            totalChunks
        };
    }

    /**
     * Realiza la búsqueda semántica en Supabase
     */
    async searchRelevantContext(query: string, matchCount: number = 4) {
        const queryEmbedding = await this.generateEmbedding(query);

        const { data, error } = await supabase.rpc('match_nem_chunks', {
            query_embedding: queryEmbedding,
            match_threshold: 0.3,
            match_count: matchCount
        });

        if (error) {
            console.error('Error en búsqueda semántica:', error);
            throw error;
        }

        return data;
    }

    /**
     * Combina el contexto recuperado con un prompt especializado y llama a Gemini
     */
    async chatWithNem(question: string, contextChunks: any[]): Promise<string> {
        const { GeminiService } = await import('../lib/gemini');
        const geminiService = new GeminiService();

        const contextText = contextChunks
            .map((chunk, i) => `[Fuente ${i + 1}: ${chunk.document_title || 'Documento'} - Similitud: ${Math.round(chunk.similarity * 100)}%]\n${chunk.content}`)
            .join('\n\n');

        const prompt = `Actúa como un Asistente Pedagógico experto en la Nueva Escuela Mexicana (NEM).
Tu objetivo es responder de manera clara, profesional y útil usando ÚNICAMENTE la información provista en el CONTEXTO OFICIAL DE LA NEM.

CONTEXTO OFICIAL EXTRAÍDO DE DOCUMENTOS NEM:
-------------------------------------------------
${contextText || '(No se encontraron documentos relevantes en la base de datos para esta consulta. Responde basándote en tu conocimiento general de la NEM)'}
-------------------------------------------------

PREGUNTA DEL DOCENTE:
"${question}"

REGLAS ESTRICTAS:
1. Basa tu respuesta PRINCIPALMENTE en el contexto provisto.
2. CITA TUS FUENTES explícitamente en el texto usando el formato [Fuente X].
3. Mantén un tono profesional, alentador y centrado en la comunidad (filosofía NEM).
4. Estructura tu respuesta con viñetas o párrafos cortos para facilitar la lectura.`;

        try {
            const responseText = await geminiService.generateContent(prompt, false);
            return responseText;
        } catch (error) {
            console.error('Error in NemAiService generation:', error);
            throw new Error('No se pudo generar la respuesta del asistente virtual.');
        }
    }
}
