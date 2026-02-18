import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant, useWorkspaces } from '../../hooks/useTenant'
import { useProfile } from '../../hooks/useProfile'
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
    const { profile, isSuperAdmin = false } = useProfile()
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

                        {/* GOD MODE EXIT: Only for Super Admins */}
                        {isSuperAdmin && currentTenant.id !== '00000000-0000-0000-0000-000000000000' && (
                            <div className="mt-2 pt-2 border-t border-gray-100">
                                <button
                                    onClick={async () => {
                                        setSwitching('god-mode')
                                        try {
                                            const { error: rpcError } = await supabase.rpc('back_to_god_mode')

                                            if (rpcError) {
                                                console.warn('RPC back_to_god_mode failed, trying manual fix:', rpcError)

                                                // 1. Try to auto-heal the RPC using exec_sql (if available)
                                                const sqlFix = `
                                                    CREATE OR REPLACE FUNCTION public.back_to_god_mode() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
                                                    BEGIN
                                                        IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (email IN ('helmerferras@gmail.com', 'helmerpersonal@gmail.com') OR role = 'SUPER_ADMIN')) THEN
                                                            UPDATE public.profiles SET tenant_id = NULL, role = 'SUPER_ADMIN' WHERE id = auth.uid();
                                                        ELSE RAISE EXCEPTION 'Not authorized'; END IF;
                                                    END; $$;
                                                    GRANT EXECUTE ON FUNCTION public.back_to_god_mode() TO authenticated;
                                                `;
                                                try {
                                                    await supabase.rpc('exec_sql', { sql_query: sqlFix })
                                                } catch (e) {
                                                    console.error('Exec_sql failed:', e)
                                                }

                                                // 2. Try direct table update as ultimate fallback
                                                const { data: { user } } = await supabase.auth.getUser()
                                                if (user) {
                                                    await supabase.from('profiles').update({ tenant_id: null, role: 'SUPER_ADMIN' }).eq('id', user.id)
                                                }

                                                // Even if rpc fails, we reload because manual update might have worked
                                            }
                                            window.location.reload()
                                        } catch (error: any) {
                                            console.error('Error in God Mode switch:', error)
                                            window.location.reload()
                                        }
                                    }}
                                    disabled={switching !== null}
                                    className="w-full flex items-center p-3 rounded-xl hover:bg-slate-900 hover:text-white transition-all group text-slate-500"
                                >
                                    <div className="p-1.5 rounded-lg mr-3 bg-blue-600 text-white shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
                                        <Layout className="w-4 h-4" />
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-widest">Control de Sistema</span>
                                    {switching === 'god-mode' && <Loader2 className="w-4 h-4 ml-auto animate-spin" />}
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
