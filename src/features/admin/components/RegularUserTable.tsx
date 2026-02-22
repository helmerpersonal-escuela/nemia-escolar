import { Users, GraduationCap, School, Play, Search, Trash2, Filter, TestTube, Key } from 'lucide-react'

interface RegularUserTableProps {
    users: any[]
    searchTerm: string
    onImpersonate: (id: string, role: string) => void
    onDelete: (id: string) => void
    onToggleDemo?: (id: string, currentDemoStatus: boolean) => void
    onResetPassword?: (email: string) => void
    onSetProvisionalPassword?: (id: string, email: string) => void
}

export const RegularUserTable = ({ users, searchTerm, onImpersonate, onDelete, onToggleDemo, onResetPassword, onSetProvisionalPassword }: RegularUserTableProps) => {
    // Filter for regular users
    const regularUsers = users.filter(user =>
        ['TEACHER', 'STUDENT', 'FAMILY', 'INDEPENDENT_TEACHER', 'TUTOR'].includes(user.role) &&
        (user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.last_name_paternal?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.last_name_maternal?.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    const getRoleBadgeCheck = (role: string) => {
        switch (role) {
            case 'TEACHER': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
            case 'INDEPENDENT_TEACHER': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
            case 'STUDENT': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            case 'FAMILY': return 'bg-orange-500/10 text-orange-400 border-orange-500/20'
            case 'TUTOR': return 'bg-purple-500/10 text-purple-400 border-purple-500/20'
            default: return 'bg-slate-500/10 text-slate-400'
        }
    }

    const getRoleIcon = (role: string) => {
        switch (role) {
            case 'TEACHER': return <School className="w-3 h-3 mr-1" />
            case 'INDEPENDENT_TEACHER': return <School className="w-3 h-3 mr-1" />
            case 'STUDENT': return <GraduationCap className="w-3 h-3 mr-1" />
            case 'FAMILY': return <Users className="w-3 h-3 mr-1" />
            case 'TUTOR': return <Users className="w-3 h-3 mr-1" />
            default: return null
        }
    }

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-[2.5rem] overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-8 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-white uppercase italic tracking-tight">Base de Usuarios</h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Maestros, Alumnos y Familias</p>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    {/* Filters could go here */}
                    <span className="text-[10px] font-black px-4 py-2 bg-slate-700 text-slate-300 rounded-full border border-slate-600">
                        {regularUsers.length} REGISTROS
                    </span>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-slate-900/50 border-b border-slate-700 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                        <tr>
                            <th className="px-8 py-5 text-left">Usuario</th>
                            <th className="px-8 py-5 text-left">Rol / Perfil</th>
                            <th className="px-8 py-5 text-left">Vinculación (Tenant)</th>
                            <th className="px-8 py-5 text-right">Controles</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {regularUsers.map(user => (
                            <tr key={user.id} className="hover:bg-slate-700/30 transition-all group">
                                <td className="px-8 py-6">
                                    <div className="flex items-center">
                                        <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-300 mr-4">
                                            {user.first_name?.[0] || 'U'}{user.last_name_paternal?.[0] || ''}
                                        </div>
                                        <div>
                                            <p className="text-md font-bold text-white">
                                                {user.first_name} {user.last_name_paternal} {user.last_name_maternal}
                                            </p>
                                            <p className="text-[11px] text-slate-500 font-mono italic">{user.email || 'Sin correo vinculado'}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-6">
                                    <div className="flex items-center gap-2">
                                        <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${getRoleBadgeCheck(user.role)}`}>
                                            {getRoleIcon(user.role)}
                                            {user.role}
                                        </span>
                                        {user.is_demo && (
                                            <span className="inline-flex items-center px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                <TestTube className="w-3 h-3 mr-1" />
                                                DEMO
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-8 py-6">
                                    {user.tenants ? (
                                        <div className="flex items-center text-slate-400">
                                            <School className="w-3 h-3 mr-2 opacity-50" />
                                            <span className="text-xs font-semibold">{user.tenants.name}</span>
                                        </div>
                                    ) : (
                                        <span className="text-[10px] text-slate-600 italic">Sin vinculación</span>
                                    )}
                                </td>
                                <td className="px-8 py-6 text-right">
                                    <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                                        {onToggleDemo && (
                                            <button
                                                onClick={() => onToggleDemo(user.id, user.is_demo || false)}
                                                className={`p-2.5 rounded-xl transition-all ${user.is_demo
                                                    ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-600 hover:text-white'
                                                    : 'bg-slate-600/10 text-slate-400 hover:bg-slate-600 hover:text-white'
                                                    }`}
                                                title={user.is_demo ? 'Desactivar Modo Demo' : 'Activar Modo Demo'}
                                            >
                                                <TestTube className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => onImpersonate(user.id, user.role)}
                                            className="p-2.5 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-xl transition-all"
                                            title="Simular Usuario"
                                        >
                                            <Play className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => onDelete(user.id)}
                                            className="p-2.5 bg-red-500/10 text-red-500 hover:bg-red-600 hover:text-white rounded-xl transition-all"
                                            title="Eliminar (Soft Delete)"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        {onResetPassword && (
                                            <button
                                                onClick={() => onResetPassword(user.email)}
                                                className="p-2.5 bg-amber-500/10 text-amber-500 hover:bg-amber-600 hover:text-white rounded-xl transition-all"
                                                title="Enviar Link de Recuperación"
                                            >
                                                <Key className="w-4 h-4" />
                                            </button>
                                        )}
                                        {onSetProvisionalPassword && (
                                            <button
                                                onClick={() => onSetProvisionalPassword(user.id, user.email)}
                                                className="p-2.5 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-600 hover:text-white rounded-xl transition-all"
                                                title="Resetear a Contraseña Provisional"
                                            >
                                                <Key className="w-4 h-4 fill-emerald-500/20" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {regularUsers.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-8 py-12 text-center">
                                    <Search className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                                    <p className="text-slate-500 font-medium text-sm">No se encontraron usuarios con este criterio</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
