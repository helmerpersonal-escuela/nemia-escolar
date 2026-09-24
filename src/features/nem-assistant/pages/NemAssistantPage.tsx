import { useState } from 'react';
import { useProfile } from '../../../hooks/useProfile';
import { ChatInterface } from '../components/ChatInterface';
import { DocumentManager } from '../components/DocumentManager';
import { Sparkles, FileText, Bot } from 'lucide-react';

export const NemAssistantPage = () => {
    const [activeTab, setActiveTab] = useState<'chat' | 'docs'>('chat');
    const { profile, isSuperAdmin } = useProfile();

    const canManageDocs = isSuperAdmin || ['ADMIN', 'DIRECTOR', 'ACADEMIC_COORD'].includes(profile?.role || '');

    return (
        <div className="h-full flex flex-col bg-slate-50/50 -m-4 sm:-m-8 p-4 sm:p-8">
            <div className="max-w-6xl w-full mx-auto flex-1 flex flex-col">
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                                <Bot className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
                                    Asistente NEM Ai
                                </h1>
                                <p className="text-sm font-medium text-slate-500">
                                    Tu copadre pedagógico experto en la Nueva Escuela Mexicana
                                </p>
                            </div>
                        </div>
                    </div>

                    {canManageDocs && (
                        <div className="flex items-center bg-white p-1 rounded-2xl shadow-sm border border-slate-100 self-start sm:self-auto">
                            <button
                                onClick={() => setActiveTab('chat')}
                                className={`flex items-center px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'chat' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <Sparkles className="w-4 h-4 mr-2" />
                                Chat
                            </button>
                            <button
                                onClick={() => setActiveTab('docs')}
                                className={`flex items-center px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'docs' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <FileText className="w-4 h-4 mr-2" />
                                Documentos Base
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex-1 min-h-0 bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden flex flex-col relative">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                    {activeTab === 'chat' ? (
                        <ChatInterface />
                    ) : (
                        <DocumentManager />
                    )}
                </div>
            </div>
        </div>
    );
};
