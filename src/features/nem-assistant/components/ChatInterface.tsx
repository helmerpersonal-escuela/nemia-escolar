import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { NemAiService } from '../../../services/NemAiService';
import ReactMarkdown from 'react-markdown';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    isError?: boolean;
}

export const ChatInterface = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([{
        id: 'welcome',
        role: 'assistant',
        content: '¡Hola! Soy tu Asistente Pedagógico experto en la Nueva Escuela Mexicana. ¿En qué te puedo ayudar hoy? (Ej. "¿Cuáles son los ejes articuladores?" o "Ayúdame con una planeación sobre inclusión")',
        timestamp: new Date()
    }]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const aiService = useRef(new NemAiService());

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const contextChunks = await aiService.current.searchRelevantContext(userMsg.content, 5);
            const responseText = await aiService.current.chatWithNem(userMsg.content, contextChunks);

            const aiMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: responseText,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, aiMsg]);
        } catch (error: any) {
            console.error('Chat Error:', error);
            const errorMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: error.message || 'Lo siento, ocurrió un error al procesar tu consulta. Intenta nuevamente.',
                timestamp: new Date(),
                isError: true
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50/30">
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                        <div className={`w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center shadow-sm ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-600' : msg.isError ? 'bg-red-100 text-red-600' : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'}`}>
                            {msg.role === 'user' ? <User className="w-5 h-5" /> : msg.isError ? <AlertCircle className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                        </div>

                        <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 sm:p-5 shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : msg.isError ? 'bg-red-50 border border-red-100 text-slate-800 rounded-tl-sm' : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm'}`}>
                            <div className={`prose prose-sm sm:prose-base max-w-none ${msg.role === 'user' ? 'prose-invert text-white' : 'prose-slate'} prose-p:leading-relaxed prose-pre:bg-slate-800 prose-pre:text-slate-50`}>
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                            <div className={`text-[11px] sm:text-xs font-medium mt-3 text-right opacity-70 ${msg.role === 'user' ? 'text-indigo-200' : 'text-slate-500'}`}>
                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex gap-4">
                        <div className="w-10 h-10 shrink-0 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-sm">
                            <Bot className="w-5 h-5" />
                        </div>
                        <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm p-5 shadow-sm flex items-center gap-3">
                            <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                            <span className="text-sm font-medium text-slate-500 animate-pulse">Consultando la documentación oficial...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 sm:p-6 bg-white border-t border-slate-100">
                <div className="max-w-4xl mx-auto relative">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="Pregunta sobre la Nueva Escuela Mexicana..."
                        className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl py-4 pl-5 pr-16 focus:ring-0 focus:border-indigo-500 transition-colors resize-none placeholder:text-slate-400 font-medium scrollbar-hide min-h-[60px] max-h-[200px]"
                        rows={1}
                        style={{ height: 'auto' }}
                    />
                    <button aria-label="Enviar"
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="absolute right-3 bottom-3 p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all shadow-md shadow-indigo-200 btn-tactile flex items-center justify-center"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                    {!input.trim() && (
                        <div className="absolute right-16 bottom-5 flex items-center gap-1.5 text-xs font-bold text-slate-300 pointer-events-none hidden sm:flex">
                            <Sparkles className="w-3.5 h-3.5" />
                            NEM AI
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
