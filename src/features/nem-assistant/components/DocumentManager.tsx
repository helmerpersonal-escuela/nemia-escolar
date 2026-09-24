import { useState, useEffect, useRef } from 'react';
import { Upload, FileText, Trash2, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { PdfExtractionService } from '../../../services/PdfExtractionService';
import { NemAiService } from '../../../services/NemAiService';
import { useProfile } from '../../../hooks/useProfile';

interface NemDocument {
    id: string;
    title: string;
    original_filename: string;
    created_at: string;
}

export const DocumentManager = () => {
    const [documents, setDocuments] = useState<NemDocument[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<{ status: string, progress: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const aiService = useRef(new NemAiService());
    const { profile } = useProfile();

    useEffect(() => {
        loadDocuments();
    }, []);

    const loadDocuments = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('nem_documents')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setDocuments(data || []);
        } catch (err: any) {
            console.error('Error loading documents:', err);
            setError('Error al cargar la lista de documentos.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !profile?.id) return;

        if (file.type !== 'application/pdf') {
            setError('Solo se permiten archivos PDF.');
            return;
        }

        setError(null);
        setIsUploading(true);
        setUploadProgress({ status: 'Extrayendo texto del PDF...', progress: 10 });

        try {
            const text = await PdfExtractionService.extractTextFromFile(file);
            if (!text || text.length < 50) {
                throw new Error('No se pudo extraer texto suficiente del PDF.');
            }

            setUploadProgress({ status: 'Dividiendo texto en fragmentos (chunking)...', progress: 30 });
            const chunks = PdfExtractionService.chunkText(text, 1500, 200);
            setUploadProgress({ status: 'Generando embeddings vectoriales con OpenAI y guardando...', progress: 50 });

            await aiService.current.processAndStoreDocument(file, text, chunks, profile.id);

            setUploadProgress({ status: '¡Completado!', progress: 100 });
            setTimeout(() => {
                setUploadProgress(null);
                loadDocuments();
            }, 2000);

        } catch (err: any) {
            console.error('Error processing PDF:', err);
            setError(err.message || 'Error procesando el documento.');
            setUploadProgress(null);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDelete = async (id: string, title: string) => {
        if (!window.confirm(`¿Estás seguro de eliminar el documento "${title}" y todo su conocimiento vectorial?`)) return;

        try {
            const { error } = await supabase.from('nem_documents').delete().eq('id', id);
            if (error) throw error;
            setDocuments(prev => prev.filter(doc => doc.id !== id));
        } catch (err: any) {
            console.error('Error deleting doc:', err);
            alert('No se pudo eliminar el documento.');
        }
    };

    return (
        <div className="p-6 h-full flex flex-col bg-slate-50/50">
            <div className="mb-8">
                <h2 className="text-lg font-black text-slate-800 mb-2">Base de Conocimientos Oficial</h2>
                <p className="text-sm font-medium text-slate-500 mb-6">
                    Sube documentos PDF oficiales de la NEM (Plan de Estudios, Programas Sintéticos, Acuerdos, Libros de Texto). El asistente leerá y recordará esta información para sus respuestas.
                </p>

                <div
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all cursor-pointer ${isUploading ? 'border-indigo-200 bg-indigo-50 pointer-events-none' : 'border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/50 bg-white'}`}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="application/pdf"
                        className="hidden"
                    />

                    {isUploading ? (
                        <div className="flex flex-col items-center">
                            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
                            <p className="text-sm font-bold text-indigo-900 mb-2">{uploadProgress?.status}</p>
                            <div className="w-full max-w-md bg-white rounded-full h-2.5 border border-indigo-100 overflow-hidden">
                                <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2.5 transition-all duration-500" style={{ width: `${uploadProgress?.progress}%` }}></div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center">
                            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-4 shadow-inner">
                                <Upload className="w-8 h-8" />
                            </div>
                            <p className="text-base font-bold text-slate-700 mb-1">Haz clic para subir un nuevo PDF</p>
                            <p className="text-xs font-medium text-slate-500">Tamaño máximo recomendado: 50MB (PDF de texto)</p>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-2xl flex items-center gap-3 text-sm font-medium border border-red-100">
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                        {error}
                    </div>
                )}
            </div>

            <div className="flex-1 min-h-0 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                        Documentos Indexados ({documents.length})
                    </h3>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                        </div>
                    ) : documents.length === 0 ? (
                        <div className="text-center p-8 text-slate-500 font-medium text-sm">
                            No hay documentos en la base de conocimientos. Sube uno para comenzar.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {documents.map(doc => (
                                <div key={doc.id} className="flex items-center justify-between p-3 sm:p-4 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors group">
                                    <div className="flex items-center min-w-0 gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shrink-0 shadow-sm">
                                            <FileText className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-slate-700 truncate">{doc.title}</p>
                                            <p className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">
                                                Añadido el {new Date(doc.created_at).toLocaleDateString()} • {doc.original_filename}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(doc.id, doc.title)}
                                        className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors sm:opacity-0 group-hover:opacity-100 btn-tactile"
                                        title="Eliminar Documento"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
