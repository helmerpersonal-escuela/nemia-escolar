import { Shield, UserCog, MoreVertical, CheckCircle2, Key, Play, MailCheck } from 'lucide-react'

interface AdminUserTableProps {
    users: any[]
    searchTerm: string
    onResetPassword?: (email: string) => void
    onImpersonate?: (id: string, role: string) => void
    onVerifyEmail?: (id: string, email: string) => void
}

export const AdminUserTable = ({ users, searchTerm, onResetPassword, onImpersonate, onVerifyEmail }: AdminUserTableProps) => {
    const admins = users.filter(user => {
        const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN'
        if (!isAdmin) return false

        const st = searchTerm.trim().toLowerCase()
        if (!st) return true // Show all if search is empty

        return (
            (user.email || '').toLowerCase().includes(st) ||
            (user.first_name || '').toLowerCase().includes(st) ||
            (user.last_name_paternal || '').toLowerCase().includes(st) ||
            (user.last_name_maternal || '').toLowerCase().includes(st)
        )
    })

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-[2.5rem] overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-8 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-purple-600/20 rounded-xl flex items-center justify-center">
                        <Shield className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-white uppercase italic tracking-tight">Núcleo de Mando</h3>
                        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">Administradores del Sistema</p>
                    </div>
                </div>
                <span className="text-[11px] font-black px-4 py-2 bg-purple-500/10 text-purple-400 rounded-full border border-purple-500/20">
                    {admins.length} OPERADORES
                </span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-slate-900/50 border-b border-slate-700 text-slate-400 text-[11px] font-black uppercase tracking-widest">
                        <tr>
                            <th className="px-8 py-5 text-left">Operador</th>
                            <th className="px-8 py-5 text-left">Nivel de Acceso</th>
                            <th className="px-8 py-5 text-left">Estado</th>
                            <th className="px-8 py-5 text-left">Última Conexión</th>
                            <th className="px-8 py-5 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {admins.map(user => (
                            <tr key={user.id} className="hover:bg-slate-700/30 transition-all group">
                                <td className="px-8 py-6">
                                    <div className="flex items-center">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center font-black text-xs text-white shadow-lg mr-4 border-2 border-slate-800">
                                            {user.first_name?.[0] || 'A'}{user.last_name_paternal?.[0] || 'D'}
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-white">{user.first_name} {user.last_name_paternal} {user.last_name_maternal}</p>
                                            <p className="text-[11px] text-slate-500 font-mono italic">{user.email || 'Sin correo vinculado'}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-6">
                                    <span className={`inline-flex items-center px-3 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider ${user.role === 'SUPER_ADMIN'
                                        ? 'bg-amber-500/10 text-amber-700 border border-amber-500/20'
                                        : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                        }`}>
                                        {user.role === 'SUPER_ADMIN' ? 'GOD MODE' : 'ADMINISTRADOR'}
                                    </span>
                                </td>
                                <td className="px-8 py-6">
                                    <div className="flex items-center space-x-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                                        <span className="text-[11px] font-medium text-slate-300">Activo</span>
                                    </div>
                                </td>
                                <td className="px-8 py-6">
                                    <p className="text-[11px] text-slate-500 font-mono">
                                        {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'Nunca'}
                                    </p>
                                </td>
                                <td className="px-8 py-6 text-right">
                                    <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                                        {onImpersonate && (
                                            <button
                                                onClick={() => onImpersonate(user.id, user.role)}
                                                className="p-2.5 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-xl transition-all"
                                                title="Simular Usuario"
                                            >
                                                <Play className="w-4 h-4" />
                                            </button>
                                        )}
                                        {onResetPassword && (
                                            <button
                                                onClick={() => onResetPassword(user.email)}
                                                className="p-2.5 bg-amber-500/10 text-amber-700 hover:bg-amber-600 hover:text-white rounded-xl transition-all"
                                                title="Enviar Link de Recuperación"
                                            >
                                                <Key className="w-4 h-4" />
                                            </button>
                                        )}
                                        {onVerifyEmail && (
                                            <button
                                                onClick={() => onVerifyEmail(user.id, user.email)}
                                                className="p-2.5 bg-blue-500/10 text-blue-500 hover:bg-blue-600 hover:text-white rounded-xl transition-all"
                                                title="Marcar Correo como Verificado"
                                            >
                                                <MailCheck className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button aria-label="Más opciones" className="p-2.5 hover:bg-slate-700 rounded-xl text-slate-500 hover:text-white transition-colors">
                                            <MoreVertical className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {admins.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-8 py-12 text-center">
                                    <UserCog className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                                    <p className="text-slate-500 font-medium text-sm">No se encontraron administradores</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
