import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant, useWorkspaces } from '../../hooks/useTenant'
import {
    ChevronDown,
    Layout,
    Plus,
    School,
    User,
    Loader2,
    Check
} from 'lucide-react'

export const WorkspaceSwitcher = () => {
    const { data: currentTenant } = useTenant()
    const { data: workspaces, isLoading } = useWorkspaces()
    const [isOpen, setIsOpen] = useState(false)
    const [switching, setSwitching] = useState<string | null>(null)

    const handleSwitch = async (tenantId: string) => {
        if (tenantId === currentTenant?.id) return

        setSwitching(tenantId)
        try {
            const { error } = await supabase.rpc('switch_workspace', { new_tenant_id: tenantId })
            if (error) throw error

            // Full reload to clear cache and reset all state for the new workspace
            window.location.reload()
        } catch (error: any) {
            console.error('Error switching workspace:', error.message)
            setSwitching(null)
        }
    }

    const handleAddNew = () => {
        // Navigate to register page or open a modal to create new school
        window.location.href = '/register'
    }

    if (isLoading || !currentTenant) return (
        <div className="h-12 w-full bg-gray-50 animate-pulse rounded-xl mb-6"></div>
    )

    return (
        <div className="relative mb-6">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    w-full flex items-center justify-between p-3 rounded-2xl border-2 transition-all group
                    ${isOpen ? 'border-blue-500 bg-blue-50/10 shadow-lg' : 'border-gray-100 hover:border-gray-200 bg-white'}
                `}
            >
                <div className="flex items-center">
                    <div className={`p-2 rounded-xl mr-3 ${currentTenant.type === 'SCHOOL' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                        {currentTenant.type === 'SCHOOL' ? <School className="w-5 h-5" /> : <User className="w-5 h-5" />}
                    </div>
                    <div className="text-left overflow-hidden">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Espacio de Trabajo</p>
                        <p className="text-sm font-black text-gray-900 truncate max-w-[120px]">{currentTenant.name}</p>
                    </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl z-50 p-2 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest p-3 border-b border-gray-50 mb-2">
                            Tus Espacios
                        </div>

                        <div className="space-y-1">
                            {workspaces?.map((w) => {
                                const isActive = w.id === currentTenant.id
                                const isSwitching = switching === w.id

                                return (
                                    <button
                                        key={w.id}
                                        disabled={switching !== null}
                                        onClick={() => handleSwitch(w.id)}
                                        className={`
                                            w-full flex items-center justify-between p-3 rounded-xl transition-all
                                            ${isActive ? 'bg-blue-50 cursor-default' : 'hover:bg-gray-50'}
                                        `}
                                    >
                                        <div className="flex items-center overflow-hidden">
                                            <div className={`p-1.5 rounded-lg mr-3 ${w.type === 'SCHOOL' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                                {w.type === 'SCHOOL' ? <School className="w-4 h-4" /> : <User className="w-4 h-4" />}
                                            </div>
                                            <span className={`text-sm truncate ${isActive ? 'font-black text-blue-700' : 'font-bold text-gray-700'}`}>
                                                {w.name}
                                            </span>
                                        </div>
                                        {isActive && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                                        {isSwitching && <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />}
                                    </button>
                                )
                            })}
                        </div>

                        <div className="mt-2 pt-2 border-t border-gray-50">
                            <button
                                onClick={handleAddNew}
                                className="w-full flex items-center p-3 rounded-xl text-indigo-600 hover:bg-indigo-50 transition-all font-black text-xs uppercase tracking-tight"
                            >
                                <Plus className="w-4 h-4 mr-3" />
                                Agregar Nuevo Espacio
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
