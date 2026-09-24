import * as pdfjsLib from 'pdfjs-dist';

// Cargar el worker dinámicamente usando un CDN para evitar problemas de build con Vite, o local si está bien configurado.
// Utilizaremos el CDN de unpkg o cdnjs provisto por la versión exacta para evitar el error de import.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export class PdfExtractionService {
    /**
     * Extrae el texto de un archivo PDF usando pdfjs-dist
     */
    static async extractTextFromFile(file: File): Promise<string> {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            let fullText = '';

            // Extraer página por página
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();

                // Mapear los items y unirlos
                const pageText = textContent.items
                    .map((item: any) => item.str)
                    .join(' ');

                fullText += pageText + '\n\n';
            }

            return fullText.trim();
        } catch (error) {
            console.error('Error extracting text from PDF:', error);
            throw new Error('No se pudo extraer el texto del archivo PDF.');
        }
    }

    /**
     * Divide un texto en fragmentos (chunks) más pequeños.
     * Basado en un tamaño máximo de caracteres con un ligero overlap (superposición).
     */
    static chunkText(text: string, maxChunkSize: number = 2000, overlap: number = 200): string[] {
        if (!text) return [];

        // Limpiar el texto un poco
        const cleanText = text.replace(/\\s+/g, ' ');
        const chunks: string[] = [];
        let startIndex = 0;

        while (startIndex < cleanText.length) {
            let endIndex = startIndex + maxChunkSize;

            // Si no es el final del texto, buscar un punto o espacio para cortar limpiamente
            if (endIndex < cleanText.length) {
                // Retroceder un poco para buscar un final de frase (.)
                const lastPeriod = cleanText.lastIndexOf('.', endIndex);
                if (lastPeriod > startIndex + maxChunkSize / 2) {
                    endIndex = lastPeriod + 1;
                } else {
                    // Si no hay punto cerca, buscar espacio
                    const lastSpace = cleanText.lastIndexOf(' ', endIndex);
                    if (lastSpace > startIndex + maxChunkSize / 2) {
                        endIndex = lastSpace + 1;
                    }
                }
            }

            const chunk = cleanText.slice(startIndex, endIndex).trim();
            if (chunk.length > 0) {
                chunks.push(chunk);
            }

            // Avanzar startIndex, restando el overlap para que haya contenido compartido
            startIndex = endIndex - overlap;

            // Por si acaso, para evitar bucles infinitos si no avanzó
            if (startIndex <= 0 || endIndex - overlap <= startIndex) {
                startIndex = endIndex;
            }
        }

        return chunks;
    }
}
