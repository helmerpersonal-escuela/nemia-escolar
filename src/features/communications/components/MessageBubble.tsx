import type { Message } from '../../../hooks/useChat'
import { FileText, Download } from 'lucide-react'

interface Props {
    message: Message
    isOwn: boolean
}

export const MessageBubble = ({ message, isOwn }: Props) => {
    const time = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    const isOnlyEmojis = (str: string) => {
        const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
        const emojis = str.match(emojiRegex);
        if (!emojis) return false;
        const stripped = str.replace(emojiRegex, '').replace(/\s/g, '');
        return stripped.length === 0;
    };

    const renderContent = () => {
        switch (message.type) {
            case 'IMAGE':
                return (
                    <div className="space-y-2">
                        <img src={message.content} alt="Shared" className="rounded-xl max-w-full h-auto shadow-sm" />
                    </div>
                )
            case 'REPORT':
                return (
                    <div className="flex items-center gap-3 p-3 bg-white/20 rounded-xl backdrop-blur-sm border border-white/10">
                        <div className="p-2 bg-white rounded-lg">
                            <FileText className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate">Reporte: {message.metadata?.reportName || 'Documento'}</p>
                            <p className="text-[10px] opacity-70">Haz clic para descargar</p>
                        </div>
                        <Download className="h-4 w-4" />
                    </div>
                )
            default:
                const onlyEmojis = isOnlyEmojis(message.content);
                return (
                    <p className={`leading-relaxed whitespace-pre-wrap ${onlyEmojis ? 'text-4xl py-2' : 'text-sm font-medium'}`}>
                        {message.content}
                    </p>
                )
        }
    }

    const isSystem = !message.sender_id || message.type === 'SYSTEM'

    if (isSystem) {
        return (
            <div className="flex justify-center mb-6 animate-in fade-in zoom-in-95 duration-500">
                <div className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-full shadow-sm max-w-[85%] text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Sistema Escolar</p>
                    <p className="text-xs text-slate-600 font-medium">{message.content}</p>
                </div>
            </div>
        )
    }

    return (
        <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            <div className={`
                max-w-[80%] md:max-w-[70%] px-4 py-3 rounded-[2rem] shadow-sm relative group
                ${isOwn
                    ? 'bg-blue-600 text-white rounded-tr-none'
                    : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'}
            `}>
                {!isOwn && (
                    <p className="text-[10px] font-black text-slate-400 mb-1 uppercase tracking-tight">
                        {message.profiles?.first_name} {message.profiles?.last_name_paternal}
                    </p>
                )}

                {renderContent()}

                <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <span className={`text-[9px] font-bold ${isOwn ? 'text-blue-100' : 'text-slate-400'}`}>
                        {time}
                    </span>
                </div>
            </div>
        </div>
    )
}
