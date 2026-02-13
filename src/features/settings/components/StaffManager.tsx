import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useProfile } from '../../../hooks/useProfile'
import { UserPlus, Mail, Shield, Copy, Check, Trash2, Clock, AlertCircle } from 'lucide-react'

const ROLES = [
    { id: 'DIRECTOR', name: 'Director' },
    { id: 'ACADEMIC_COORD', name: 'Coord. Académica' },
    { id: 'TECH_COORD', name: 'Coord. Tecnológica' },
    { id: 'SCHOOL_CONTROL', name: 'Control Escolar' },
    { id: 'TEACHER', name: 'Docente' },
    { id: 'PREFECT', name: 'Prefectura' },
    { id: 'SUPPORT', name: 'Apoyo Educativo' },
]

export const StaffManager = () => {
    const { profile } = useProfile()
    const [loading, setLoading] = useState(true)

    const isDirectorOrAdmin = ['DIRECTOR', 'ADMIN'].includes(profile?.role || '')
    const [staff, setStaff] = useState<any[]>([])
    const [invitations, setInvitations] = useState<any[]>([])
    const [isInviting, setIsInviting] = useState(false)
    const [registrationMethod, setRegistrationMethod] = useState<'invite' | 'direct'>('invite')
    const [inviteData, setInviteData] = useState({
        email: '',
        role: 'TEACHER',
        firstName: '',
        lastNamePaternal: '',
        password: '',
        phone: ''
    })
    const [lastToken, setLastToken] = useState<string | null>(null)
    const [successMsg, setSuccessMsg] = useState('')

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // 1. Get Profile to get tenant_id
            const { data: myProfile } = await supabase
                .from('profiles')
                .select('tenant_id')
                .eq('id', user.id)
                .single()

            if (!myProfile?.tenant_id) return

            // 2. Load Staff
            const { data: staffData } = await supabase
                .from('profiles')
                .select('*')
                .eq('tenant_id', myProfile.tenant_id)
                .order('first_name')

            setStaff(staffData || [])

            // 3. Load Pending Invitations
            const { data: invData } = await supabase
                .from('staff_invitations')
                .select('*')
                .eq('tenant_id', myProfile.tenant_id)
                .eq('status', 'PENDING')
                .order('created_at', { ascending: false })

            setInvitations(invData || [])

        } catch (error) {
            console.error('Error loading staff:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSendInvite = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsInviting(true)
        setLastToken(null)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            const { data: myProfile } = await supabase.from('profiles').select('tenant_id').eq('id', user?.id).single()
            if (!myProfile?.tenant_id) throw new Error('No se encontró el inquilino')

            if (registrationMethod === 'direct') {
                // Direct call to Edge Function (Admin Action)
                const { data, error } = await supabase.functions.invoke('create-test-user', {
                    body: {
                        email: inviteData.email,
                        password: inviteData.password,
                        firstName: inviteData.firstName,
                        lastNamePaternal: inviteData.lastNamePaternal,
                        role: inviteData.role,
                        tenantId: myProfile.tenant_id
                    }
                })

                if (error) throw error
                setSuccessMsg('¡Usuario creado y vinculado exitosamente!')
            } else {
                // Traditional Invitation
                const { data, error } = await supabase
                    .from('staff_invitations')
                    .insert({
                        tenant_id: myProfile.tenant_id,
                        email: inviteData.email.toLowerCase(),
                        role: inviteData.role,
                        created_by: user?.id
                    })
                    .select()
                    .single()

                if (error) throw error
                setLastToken(data.token)
                setSuccessMsg('¡Invitación generada!')
            }

            setInviteData({ email: '', role: 'TEACHER', firstName: '', lastNamePaternal: '', password: '', phone: '' })
            setTimeout(() => setSuccessMsg(''), 3000)
            loadData()
        } catch (error: any) {
            alert('Error: ' + error.message)
        } finally {
            setIsInviting(false)
        }
    }

    const copyInviteLink = (token: string) => {
        const link = `${window.location.origin}/register?token=${token}`
        navigator.clipboard.writeText(link)
        setSuccessMsg('¡Enlace copiado!')
        setTimeout(() => setSuccessMsg(''), 3000)
    }

    const deleteInvitation = async (id: string) => {
        if (!confirm('¿Deseas cancelar esta invitación?')) return
        await supabase.from('staff_invitations').delete().eq('id', id)
        loadData()
    }

    if (loading && staff.length === 0) return <div className="p-4 animate-pulse">Cargando personal...</div>

    return (
        <div className="space-y-8">
            {/* Header info */}
            <div className="p-4 rounded-xl flex items-center justify-between bg-blue-50 border border-blue-100 transition-all">
                <div className="flex items-start">
                    <Shield className="w-5 h-5 mr-3 mt-0.5 text-blue-600" />
                    <div>
                        <h4 className="text-sm font-bold leading-none mb-1 text-blue-900">
                            Control de Acceso y Personal
                        </h4>
                        <p className="text-xs leading-relaxed text-blue-700">
                            Gestiona quién tiene acceso a los módulos de tu institución enviando invitaciones o creando credenciales directamente.
                        </p>
                    </div>
                </div>
            </div>

            {/* Invite Form */}
            {isDirectorOrAdmin ? (
                <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm">

                    {/* Method Tabs */}
                    <div className="flex items-center space-x-1 mb-6 bg-gray-50 p-1 rounded-xl w-fit">
                        <button
                            type="button"
                            onClick={() => setRegistrationMethod('invite')}
                            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${registrationMethod === 'invite'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            <Mail className="w-3 h-3 inline mr-2" />
                            Enviar Invitación
                        </button>
                        <button
                            type="button"
                            onClick={() => setRegistrationMethod('direct')}
                            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${registrationMethod === 'direct'
                                ? 'bg-white text-amber-600 shadow-sm'
                                : 'text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            <UserPlus className="w-3 h-3 inline mr-2" />
                            Registro Directo
                        </button>
                    </div>

                    <form onSubmit={handleSendInvite} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                            {/* Common Fields */}
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 ml-1">Correo Electrónico</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                    <input
                                        type="email"
                                        required
                                        placeholder="ejemplo@escuela.com"
                                        className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border-transparent rounded-xl text-sm focus:bg-white focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-inner"
                                        value={inviteData.email}
                                        onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 ml-1">Rol Asignado</label>
                                <select
                                    className="w-full px-4 py-2.5 bg-gray-50 border-transparent rounded-xl text-sm focus:bg-white focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-inner"
                                    value={inviteData.role}
                                    onChange={(e) => setInviteData({ ...inviteData, role: e.target.value })}
                                >
                                    {ROLES.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            </div>

                            {/* Direct Method specific fields */}
                            {registrationMethod === 'direct' && (
                                <>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 ml-1">Nombre(s)</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Juan"
                                            className="w-full px-4 py-2.5 bg-gray-50 border-transparent rounded-xl text-sm focus:bg-white focus:ring-amber-500 focus:border-amber-500 transition-all shadow-inner"
                                            value={inviteData.firstName}
                                            onChange={(e) => setInviteData({ ...inviteData, firstName: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 ml-1">Apellido Paterno</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Pérez"
                                            className="w-full px-4 py-2.5 bg-gray-50 border-transparent rounded-xl text-sm focus:bg-white focus:ring-amber-500 focus:border-amber-500 transition-all shadow-inner"
                                            value={inviteData.lastNamePaternal}
                                            onChange={(e) => setInviteData({ ...inviteData, lastNamePaternal: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2 ml-1">Contraseña de Acceso</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Clave123"
                                            className="w-full px-4 py-2.5 bg-gray-50 border-transparent rounded-xl text-sm font-mono focus:bg-white focus:ring-amber-500 focus:border-amber-500 transition-all shadow-inner"
                                            value={inviteData.password}
                                            onChange={(e) => setInviteData({ ...inviteData, password: e.target.value })}
                                        />
                                    </div>
                                </>
                            )}


                            <div className="flex items-end">
                                <button
                                    type="submit"
                                    disabled={isInviting}
                                    className={`w-full py-3 text-white font-black rounded-xl text-xs uppercase tracking-widest transition-all shadow-xl disabled:opacity-50 ${registrationMethod === 'direct'
                                        ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-100'
                                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'
                                        }`}
                                >
                                    {isInviting ? 'Procesando...' : (
                                        registrationMethod === 'direct' ? 'Crear Usuario Ahora' : 'Generar Invitación'
                                    )}
                                </button>
                            </div>
                        </div>
                    </form>

                    {lastToken && registrationMethod === 'invite' && (
                        <div className="mt-8 p-6 bg-indigo-50 border border-indigo-100 rounded-[2rem] animate-in fade-in slide-in-from-top-4">
                            <p className="text-xs font-black text-indigo-900 mb-3 uppercase tracking-widest">¡Enlace de Invitación Creado!</p>
                            <div className="flex items-center gap-3">
                                <input
                                    readOnly
                                    className="flex-1 text-xs bg-white border-transparent rounded-xl p-3 font-mono text-indigo-600 shadow-inner"
                                    value={`${window.location.origin}/register?token=${lastToken}`}
                                />
                                <button
                                    onClick={() => copyInviteLink(lastToken)}
                                    className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
                                >
                                    <Copy className="w-5 h-5" />
                                </button>
                            </div>
                            <p className="text-[10px] text-indigo-400 font-bold mt-3 uppercase tracking-tight">Copia y envía este enlace manualmente al docente.</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="p-8 bg-amber-50 rounded-3xl border border-amber-100 flex flex-col items-center text-center">
                    <Shield className="w-12 h-12 text-amber-500 mb-4 opacity-50" />
                    <h3 className="text-lg font-black text-amber-900 uppercase tracking-tight">Acceso de Lectura</h3>
                    <p className="text-sm text-amber-700 max-w-sm mt-1">
                        Solo el **Director** o el **Administrador** pueden gestionar las invitaciones y el registro de nuevo personal.
                    </p>
                </div>
            )}

            {successMsg && (
                <div className="fixed bottom-6 right-6 bg-gray-900/95 backdrop-blur-md text-white px-6 py-4 rounded-[2rem] text-xs font-black uppercase tracking-widest shadow-2xl animate-in slide-in-from-bottom-6 flex items-center z-50">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse mr-3" />
                    {successMsg}
                </div>
            )}

            {/* Existing Lists */}
            {invitations.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center ml-2">
                        <Clock className="w-3 h-3 mr-2 text-amber-500" />
                        Invitaciones Pendientes ({invitations.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {invitations.map(inv => (
                            <div key={inv.id} className="p-5 bg-white border border-gray-100 rounded-3xl flex items-center justify-between group hover:shadow-xl hover:shadow-gray-100 transition-all">
                                <div className="flex items-center">
                                    <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl mr-4">
                                        <Mail className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-gray-900 tracking-tight">{inv.email}</p>
                                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mt-0.5">
                                            {ROLES.find(r => r.id === inv.role)?.name || inv.role}
                                        </p>
                                    </div>
                                </div>
                                {isDirectorOrAdmin && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => copyInviteLink(inv.token)}
                                            className="p-3 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all"
                                            title="Copiar Enlace"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => deleteInvitation(inv.id)}
                                            className="p-3 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all"
                                            title="Cancelar"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="space-y-4">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center ml-2">
                    <Shield className="w-3 h-3 mr-2 text-green-500" />
                    Personal Activo ({staff.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {staff.map(member => (
                        <div key={member.id} className="p-5 bg-white border border-gray-100 rounded-[2.5rem] shadow-sm hover:shadow-xl hover:shadow-gray-100 transition-all relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Shield className="w-12 h-12 text-gray-900" />
                            </div>
                            <div className="flex items-center relative z-10">
                                <img
                                    src={member.avatar_url || `https://ui-avatars.com/api/?name=${member.first_name}+${member.last_name_paternal}&background=random`}
                                    className="w-12 h-12 rounded-[1.25rem] mr-4 shadow-sm"
                                    alt="avatar"
                                />
                                <div>
                                    <p className="text-sm font-black text-gray-900 uppercase tracking-tight leading-none mb-1.5">
                                        {member.first_name} {member.last_name_paternal}
                                    </p>
                                    <div className="inline-flex items-center px-3 py-1 bg-gray-50 text-[10px] font-black text-gray-500 rounded-full border border-gray-100 uppercase tracking-widest">
                                        {ROLES.find(r => r.id === member.role)?.name || member.role}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
