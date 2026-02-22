import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useChat } from '../../hooks/useChat'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { MessageBubble } from './components/MessageBubble'
import EmojiPicker, { type EmojiClickData } from 'emoji-picker-react'
import { usePresence } from '../../hooks/usePresence'
import { useProfile } from '../../hooks/useProfile'
import {
    Send,
    Paperclip,
    Smile,
    Image as ImageIcon,
    FileText,
    MoreVertical,
    ChevronLeft,
    Phone,
    Video,
    Plus,
    Users as UsersIcon,
    Search,
    X,
    Megaphone,
    Bell,
    CheckCircle,
    Trash2
} from 'lucide-react'

// ProfileItem Component
const ProfileItem = ({ profile, isSelected, onChat, onToggle, isOnline, isStarting }: {
    profile: any
    isSelected: boolean
    onChat: () => void
    onToggle: (e: React.MouseEvent) => void
    isOnline: boolean
    isStarting?: boolean
}) => (
    <div
        className={`
            flex items-center justify-between p-2 sm:p-3 rounded-2xl transition-all border-2
            ${isSelected ? 'bg-blue-50 border-blue-200' : 'border-transparent'}
        `}
    >
        <button
            onClick={onChat}
            disabled={isStarting}
            className="flex items-center gap-3 sm:gap-4 flex-1 text-left hover:bg-slate-50 rounded-xl p-2 transition-all disabled:opacity-60 group"
            title="Iniciar conversación"
        >
            <div className="relative shrink-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center font-black text-white text-sm sm:text-base">
                    {isStarting
                        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : profile.first_name?.[0]
                    }
                </div>
                <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${isOnline ? 'bg-green-500' : 'bg-slate-300'}`} />
            </div>
            <div>
                <h4 className="font-bold text-slate-800 text-sm sm:text-base group-hover:text-blue-600 transition-colors">
                    {profile.first_name} {profile.last_name_paternal}
                </h4>
                <div className="flex flex-col gap-0.5">
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-tighter">
                        {profile.role === 'TUTOR' ? 'Padre de Familia' : profile.role === 'TEACHER' ? 'Docente' : profile.role}
                    </p>
                    {profile.student_names && (
                        <p className="text-[10px] text-blue-600 font-bold uppercase truncate max-w-[150px]">
                            {profile.role === 'TEACHER' ? `Docente de: ${profile.student_names}` : `Tutor de: ${profile.student_names}`}
                        </p>
                    )}
                </div>
            </div>
        </button>
        <button
            onClick={onToggle}
            title={isSelected ? 'Quitar del grupo' : 'Agregar al grupo'}
            className={`ml-2 p-2 rounded-xl transition-all shrink-0 ${isSelected ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'bg-slate-100 text-slate-400 hover:bg-blue-50 hover:text-blue-600'}`}
        >
            {isSelected ? <UsersIcon className="h-4 w-4 sm:h-5 sm:w-5" /> : <Plus className="h-4 w-4 sm:h-5 sm:w-5" />}
        </button>
    </div>
)




export const ChatModule = () => {
    const { roomId } = useParams<{ roomId: string }>()
    const { messages, rooms, loading, sendMessage, startDirectChat, createGroupChat, deleteRoom } = useChat(roomId)
    const [inputText, setInputText] = useState('')
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)
    const [showNewChatModal, setShowNewChatModal] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [profiles, setProfiles] = useState<any[]>([])
    const [groupedProfiles, setGroupedProfiles] = useState<{
        docentes: any[]
        administrativos: any[]
        alumnos_tutores: any[]
    }>({ docentes: [], administrativos: [], alumnos_tutores: [] })
    const [selectedProfiles, setSelectedProfiles] = useState<string[]>([])
    const [groupName, setGroupName] = useState('')
    const [isCreating, setIsCreating] = useState(false)
    const [startingProfileId, setStartingProfileId] = useState<string | null>(null)
    const [showEmojiPicker, setShowEmojiPicker] = useState(false)
    const [soundEnabled, setSoundEnabled] = useState(true)
    const [activeTab, setActiveTab] = useState<'chats' | 'announcements'>('chats')
    const [announcements, setAnnouncements] = useState<any[]>([])
    const [showNewAnnouncementModal, setShowNewAnnouncementModal] = useState(false)
    const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', sendEmail: false })
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const navigate = useNavigate()
    const { data: tenant } = useTenant()
    const { isUserOnline } = usePresence()

    const canCreateAnnouncements = useMemo(() => {
        return tenant?.role === 'DIRECTOR' || tenant?.role === 'ADMIN'
    }, [tenant])

    const currentRoom = useMemo(() => rooms.find(r => r.id === roomId), [rooms, roomId])

    const { profile } = useProfile()
    const isReadOnly = useMemo(() => {
        if (profile?.is_demo) return true
        if (!currentRoom) return false
        if (currentRoom.type === 'SYSTEM' as any) return true
        if (currentRoom.name === 'Sistema' || currentRoom.name === 'Avisos del Sistema') return true
        return false
    }, [currentRoom, profile])

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) setCurrentUserId(data.user.id)
        })
        loadAnnouncements()
    }, [])

    const loadAnnouncements = async () => {
        try {
            const { data, error } = await supabase
                .from('school_announcements')
                .select('*')
                .order('created_at', { ascending: false })
            if (error) {
                console.warn('Announcements table not ready yet')
                setAnnouncements([])
                return
            }
            setAnnouncements(data || [])
        } catch (e) {
            setAnnouncements([])
        }
    }

    const handleSendAnnouncement = async () => {
        if (profile?.is_demo) {
            alert('Modo Demo: El envío de comunicados está deshabilitado.')
            return
        }
        if (!newAnnouncement.title || !newAnnouncement.content) return

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: profileData } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()

        const { error } = await supabase
            .from('school_announcements')
            .insert({
                tenant_id: profileData?.tenant_id,
                sender_id: user.id,
                title: newAnnouncement.title,
                content: newAnnouncement.content,
                send_email: newAnnouncement.sendEmail
            })

        if (!error) {
            setShowNewAnnouncementModal(false)
            setNewAnnouncement({ title: '', content: '', sendEmail: false })
            loadAnnouncements()
        }
    }

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        if (showNewChatModal) {
            fetchProfiles()
        }
    }, [showNewChatModal])

    const fetchProfiles = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Check for custom permissions first
        const { data: customPermissions } = await supabase
            .from('chat_permissions')
            .select('*')
            .eq('profile_id', user.id)
            .eq('tenant_id', tenant?.id)
            .maybeSingle() // Use maybeSingle() to handle missing records gracefully

        let query = supabase
            .from('profiles')
            .select('*')
            .eq('tenant_id', tenant?.id)

        // Apply custom permissions if they exist
        if (customPermissions) {
            const allowedRoles: string[] = []

            if (customPermissions.can_view_all_users) {
                // No filter - can see everyone
            } else {
                if (customPermissions.can_view_staff) {
                    allowedRoles.push('DIRECTOR', 'ADMIN', 'PREFECT', 'SUPPORT', 'SOCIAL_WORKER', 'STAFF')
                }
                if (customPermissions.can_view_teachers) {
                    allowedRoles.push('TEACHER')
                }
                if (customPermissions.can_view_students) {
                    allowedRoles.push('STUDENT', 'TUTOR')
                }

                if (allowedRoles.length > 0) {
                    query = query.in('role', allowedRoles)
                }
            }
        } else {
            // Default role-based filtering (no custom permissions)
            const currentRole = tenant?.role

            if (currentRole === 'STUDENT' || currentRole === 'TUTOR') {
                // Students/Tutors can only see staff
                query = query.in('role', ['DIRECTOR', 'PREFECT', 'SUPPORT', 'TEACHER', 'ADMIN', 'SOCIAL_WORKER'])
            } else if (currentRole === 'TEACHER') {
                // Teachers can see all staff + their students
                query = query
            } else if (currentRole === 'PREFECT' || currentRole === 'SUPPORT' || currentRole === 'SOCIAL_WORKER') {
                // Administrative staff can see all staff (no students)
                query = query.in('role', ['DIRECTOR', 'PREFECT', 'SUPPORT', 'TEACHER', 'ADMIN', 'SOCIAL_WORKER', 'STAFF'])
            }
            // DIRECTOR and ADMIN can see everyone (no filter)
        }

        if (searchQuery) {
            query = query.or(`first_name.ilike.%${searchQuery}%,last_name_paternal.ilike.%${searchQuery}%`)
        }

        const { data } = await query.order('first_name', { ascending: true })

        // Fetch relationships to identify teachers of the tutor's children or students of a tutor
        let profileListWithStudents = data || []
        const currentRole = tenant?.role

        if (currentRole === 'TUTOR') {
            // Get tutor's children
            const { data: myGuardianship } = await supabase
                .from('guardians')
                .select('student_id')
                .eq('user_id', user.id)

            const childIds = myGuardianship?.map(g => g.student_id) || []

            if (childIds.length > 0) {
                // Get teachers of those children
                const { data: teacherGroups } = await supabase
                    .from('group_subjects')
                    .select('teacher_id, group:groups(id, grade, section), students:students(id, first_name, last_name_paternal)')
                    .in('group_id', (await supabase.from('students').select('group_id').in('id', childIds)).data?.map(s => s.group_id) || [])

                if (teacherGroups) {
                    profileListWithStudents = profileListWithStudents.map(p => {
                        if (p.role === 'TEACHER') {
                            const relatedChildren = teacherGroups
                                .filter(tg => tg.teacher_id === p.id)
                                .map(tg => tg.students.find((s: any) => childIds.includes(s.id)))
                                .filter(Boolean)

                            if (relatedChildren.length > 0) {
                                const names = Array.from(new Set(relatedChildren.map((s: any) => s.first_name))).join(', ')
                                return { ...p, student_names: names }
                            }
                        }
                        return p
                    })
                }
            }
        } else if (profileListWithStudents.some(p => p.role === 'TUTOR')) {
            const tutorIds = profileListWithStudents.filter(p => p.role === 'TUTOR').map(p => p.id)
            const { data: relations } = await supabase
                .from('guardians')
                .select('user_id, student:students(first_name, last_name_paternal)')
                .in('user_id', tutorIds)

            if (relations) {
                profileListWithStudents = profileListWithStudents.map(p => {
                    const studentRefs = relations.filter(r => r.user_id === p.id)
                    if (studentRefs.length > 0) {
                        const names = studentRefs.map(r => `${(r as any).student.first_name} ${(r as any).student.last_name_paternal}`).join(', ')
                        return { ...p, student_names: names }
                    }
                    return p
                })
            }
        }

        // Group profiles by category
        const grouped = {
            docentes: [] as any[],
            administrativos: [] as any[],
            alumnos_tutores: [] as any[]
        }

        profileListWithStudents.forEach(profile => {
            if (profile.role === 'TEACHER') {
                grouped.docentes.push(profile)
            } else if (['DIRECTOR', 'ADMIN', 'PREFECT', 'SUPPORT', 'SOCIAL_WORKER', 'STAFF'].includes(profile.role)) {
                grouped.administrativos.push(profile)
            } else if (['STUDENT', 'TUTOR'].includes(profile.role)) {
                grouped.alumnos_tutores.push(profile)
            }
        })

        setProfiles(profileListWithStudents)
        setGroupedProfiles(grouped)
    }

    useEffect(() => {
        const timer = setTimeout(() => {
            if (showNewChatModal) fetchProfiles()
        }, 300)
        return () => clearTimeout(timer)
    }, [searchQuery])

    const handleStartChat = async (profileId: string) => {
        if (isCreating) return

        setIsCreating(true)
        setStartingProfileId(profileId)
        try {
            const newRoomId = await startDirectChat(profileId)
            if (newRoomId) {
                setShowNewChatModal(false)
                navigate(`/messages/${newRoomId}`)
            } else {
                alert('No se pudo iniciar la conversación. Intenta de nuevo.')
            }
        } catch (error) {
            console.error('Error starting chat:', error)
            alert('Error al iniciar el chat. Intenta de nuevo.')
        } finally {
            setIsCreating(false)
            setStartingProfileId(null)
        }
    }

    const handleCreateGroup = async () => {
        if (!groupName || selectedProfiles.length === 0) return
        setIsCreating(true)
        try {
            const newRoomId = await createGroupChat(groupName, selectedProfiles)
            if (newRoomId) {
                setShowNewChatModal(false)
                setSelectedProfiles([])
                setGroupName('')
                navigate(`/messages/${newRoomId}`)
            }
        } catch (error) {
            console.error('Error creating group:', error)
        } finally {
            setIsCreating(false)
        }
    }

    const toggleProfileSelection = (id: string) => {
        setSelectedProfiles(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        )
    }

    const handleSend = async () => {
        if (profile?.is_demo) {
            alert('Modo Demo: No puedes enviar mensajes reales en este perfil de prueba.')
            return
        }
        if (!inputText.trim()) return
        await sendMessage(inputText)
        setInputText('')
        setShowEmojiPicker(false)
    }

    const handleEmojiClick = (emojiData: EmojiClickData) => {
        setInputText(prev => prev + emojiData.emoji)
    }

    const playNotificationSound = () => {
        if (!soundEnabled) return
        // Create a simple notification beep using Web Audio API
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)

        oscillator.frequency.value = 800
        oscillator.type = 'sine'

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)

        oscillator.start(audioContext.currentTime)
        oscillator.stop(audioContext.currentTime + 0.5)
    }

    return (
        <div className="flex flex-col md:flex-row h-[calc(100vh-8rem)] bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-100">
            {/* Sidebar: Chat Rooms */}
            <div className={`
                w-full md:w-80 border-r border-slate-100 flex-col bg-slate-50/30
                ${roomId ? 'hidden md:flex' : 'flex'}
            `}>
                <div className="p-6 border-b border-slate-100 bg-white flex items-center justify-between">
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        Mensajes
                    </h2>
                    <button
                        onClick={() => setShowNewChatModal(true)}
                        className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all"
                    >
                        <Plus className="h-5 w-5" />
                    </button>
                </div>
                <div className="p-4 bg-white border-b border-slate-100 flex gap-2">
                    <button
                        onClick={() => setActiveTab('chats')}
                        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'chats' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Conversaciones
                    </button>
                    <button
                        onClick={() => setActiveTab('announcements')}
                        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'announcements' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Comunicados
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {activeTab === 'chats' ? (
                        rooms.filter(room => room.type !== 'SYSTEM').map(room => (
                            <div
                                key={room.id}
                                onClick={() => navigate(`/messages/${room.id}`)}
                                className={`
                                    group p-4 rounded-2xl cursor-pointer transition-all border-2
                                    ${room.id === roomId
                                        ? 'bg-white border-blue-600 shadow-lg shadow-blue-50'
                                        : 'bg-white/50 border-transparent hover:bg-white hover:border-slate-200'}
                                `}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white font-black">
                                        {room.name.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center mb-1">
                                            <h3 className="font-black text-slate-800 truncate text-sm">{room.name}</h3>
                                            {room.unread_count > 0 && (
                                                <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-400 truncate font-medium">{room.last_message?.content || 'Inicia una conversación'}</p>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            const confirmed = window.confirm(`¿Eliminar chat con "${room.name}"? Esta acción no se puede deshacer.`)
                                            if (confirmed) {
                                                deleteRoom(room.id).then(success => {
                                                    if (success && roomId === room.id) navigate('/messages')
                                                })
                                            }
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 rounded-lg transition-all"
                                        title="Eliminar chat"
                                    >
                                        <Trash2 className="h-4 w-4 text-slate-400 hover:text-red-600" />
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="space-y-3">
                            {announcements.map(ann => (
                                <div key={ann.id} className="p-4 bg-white border border-slate-100 rounded-2xl group hover:shadow-lg transition-all">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                                            <Megaphone className="w-4 h-4" />
                                        </div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(ann.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <h4 className="text-sm font-black text-slate-800 mb-1">{ann.title}</h4>
                                    <p className="text-xs text-slate-500 line-clamp-2">{ann.content}</p>
                                </div>
                            ))}
                            {canCreateAnnouncements && (
                                <button
                                    onClick={() => setShowNewAnnouncementModal(true)}
                                    className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-black text-[10px] uppercase tracking-widest hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/50 transition-all flex items-center justify-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    Nuevo Comunicado
                                </button>
                            )}
                        </div>
                    )}
                    {(activeTab === 'chats' && rooms.length === 0 && !loading) && (
                        <div className="text-center py-8 text-slate-400 font-medium">No hay chats activos</div>
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className={`
                flex-1 flex flex-col bg-white
                ${!roomId ? 'hidden md:flex items-center justify-center' : 'flex'}
            `}>
                {roomId ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between shadow-sm relative z-10">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => navigate('/messages')}
                                    className="md:hidden p-2 hover:bg-slate-100 rounded-xl transition-colors"
                                >
                                    <ChevronLeft className="h-6 w-6" />
                                </button>
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600">
                                    {rooms.find(r => r.id === roomId)?.name.charAt(0) || 'C'}
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-800">{rooms.find(r => r.id === roomId)?.name || 'Conversación'}</h3>
                                    <div className="flex items-center gap-1">
                                        <div className={`w-1.5 h-1.5 rounded-full ${isReadOnly ? 'bg-amber-500' : 'bg-green-500'}`}></div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">{isReadOnly ? 'Solo Lectura' : 'En línea'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => alert('Función de llamada de voz próximamente')}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                    title="Llamada de voz"
                                >
                                    <Phone className="h-5 w-5" />
                                </button>
                                <button
                                    onClick={() => alert('Función de videollamada próximamente')}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                    title="Videollamada"
                                >
                                    <Video className="h-5 w-5" />
                                </button>
                                <button
                                    onClick={() => alert('Más opciones próximamente')}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                                    title="Más opciones"
                                >
                                    <MoreVertical className="h-5 w-5" />
                                </button>
                                <button
                                    onClick={() => navigate('/messages')}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                    title="Cerrar chat"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50 messenger-scroll">
                            {messages.map(msg => (
                                <MessageBubble
                                    key={msg.id}
                                    message={msg}
                                    isOwn={msg.sender_id === currentUserId}
                                />
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-6 border-t border-slate-100 bg-white relative">
                            {/* Emoji Picker */}
                            {showEmojiPicker && (
                                <div className="absolute bottom-20 left-4 z-50 shadow-2xl rounded-2xl overflow-hidden [&_.emoji-picker-react]:!border-none">
                                    <EmojiPicker
                                        onEmojiClick={handleEmojiClick}
                                        width={450}
                                        height={550}
                                        searchPlaceholder="Buscar un emoji..."
                                        emojiStyle={"native" as any}
                                        lazyLoadEmojis={true}
                                        categories={[
                                            { category: "suggested" as any, name: "Sugeridos" },
                                            { category: "smileys_people" as any, name: "Caras y Personas" },
                                            { category: "animals_nature" as any, name: "Animales y Naturaleza" },
                                            { category: "food_drink" as any, name: "Comida y Bebida" },
                                            { category: "travel_places" as any, name: "Viajes y Lugares" },
                                            { category: "activities" as any, name: "Actividades" },
                                            { category: "objects" as any, name: "Objetos" },
                                            { category: "symbols" as any, name: "Símbolos" },
                                            { category: "flags" as any, name: "Banderas" }
                                        ]}
                                        previewConfig={{
                                            showPreview: false
                                        }}
                                    />
                                </div>
                            )}

                            <div className="flex items-end gap-3 bg-slate-50 p-2 rounded-[2rem] border border-slate-200 focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-100 transition-all">
                                <button
                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                    className={`p-3 transition-colors ${showEmojiPicker ? 'text-blue-600' : 'text-slate-400 hover:text-blue-600'}`}
                                >
                                    <Smile className="h-6 w-6" />
                                </button>
                                <button className="p-3 text-slate-400 hover:text-blue-600 transition-colors"><Paperclip className="h-6 w-6" /></button>
                                <textarea
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    placeholder={isReadOnly ? "No puedes responder a este chat" : "Escribe un mensaje..."}
                                    disabled={isReadOnly}
                                    className="flex-1 bg-transparent border-none focus:ring-0 text-slate-700 py-3 resize-none max-h-32 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                    rows={1}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault()
                                            handleSend()
                                        }
                                    }}
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!inputText.trim() || isReadOnly}
                                    className="p-4 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 shadow-lg shadow-blue-100 transform active:scale-95 transition-all"
                                >
                                    <Send className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="text-center p-12">
                        <div className="w-24 h-24 bg-blue-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 text-blue-600">
                            <Send className="w-12 h-12 rotate-[-15deg]" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-800">Tus Conversaciones</h3>
                        <p className="text-slate-400 mt-2 max-w-xs mx-auto font-medium">
                            Selecciona un chat para comenzar a comunicarte con los padres de familia y colegas.
                        </p>
                    </div>
                )}
            </div>
            {/* New Chat Modal */}
            {showNewChatModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg max-h-[90vh] shadow-2xl overflow-hidden animate-in zoom-in duration-200 flex flex-col">
                        <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                            <div>
                                <h3 className="text-xl sm:text-2xl font-black text-slate-800">Nueva Conversación</h3>
                                <p className="text-slate-400 font-medium text-xs sm:text-sm">Selecciona con quién quieres hablar.</p>
                            </div>
                            <button
                                onClick={() => setShowNewChatModal(false)}
                                className="p-2 sm:p-3 hover:bg-slate-50 rounded-2xl text-slate-400 transition-all"
                            >
                                <X className="h-5 w-5 sm:h-6 sm:w-6" />
                            </button>
                        </div>

                        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
                            {/* Search bar */}
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Buscar por nombre..."
                                    className="w-full pl-12 pr-4 py-3 sm:py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-100 transition-all font-medium text-slate-700 text-sm sm:text-base"
                                />
                            </div>

                            {/* Group Name (only if multiple selected) */}
                            {selectedProfiles.length > 0 && (
                                <div className="space-y-2 animate-in slide-in-from-top-4 duration-300">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Nombre del Grupo</label>
                                    <input
                                        type="text"
                                        value={groupName}
                                        onChange={(e) => setGroupName(e.target.value)}
                                        placeholder="Ej: Docentes 3ºA..."
                                        className="w-full px-4 py-3 sm:py-4 bg-blue-50 border-none rounded-2xl focus:ring-4 focus:ring-blue-100 transition-all font-bold text-blue-700 placeholder:text-blue-300 text-sm sm:text-base"
                                    />
                                </div>
                            )}

                            {/* Profiles List - Grouped */}
                            <div className="space-y-3 pr-2 messenger-scroll">
                                {/* Docentes Section */}
                                {groupedProfiles.docentes.length > 0 && (
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2 flex items-center gap-2">
                                            <UsersIcon className="h-4 w-4" />
                                            Docentes ({groupedProfiles.docentes.length})
                                        </h4>
                                        {groupedProfiles.docentes.map(profile => (
                                            <ProfileItem
                                                key={profile.id}
                                                profile={profile}
                                                isSelected={selectedProfiles.includes(profile.id)}
                                                isOnline={isUserOnline(profile.id)}
                                                isStarting={startingProfileId === profile.id}
                                                onChat={() => handleStartChat(profile.id)}
                                                onToggle={(e) => {
                                                    e.stopPropagation()
                                                    toggleProfileSelection(profile.id)
                                                }}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* Administrativos Section */}
                                {groupedProfiles.administrativos.length > 0 && (
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2 flex items-center gap-2">
                                            <UsersIcon className="h-4 w-4" />
                                            Administrativos ({groupedProfiles.administrativos.length})
                                        </h4>
                                        {groupedProfiles.administrativos.map(profile => (
                                            <ProfileItem
                                                key={profile.id}
                                                profile={profile}
                                                isSelected={selectedProfiles.includes(profile.id)}
                                                isOnline={isUserOnline(profile.id)}
                                                isStarting={startingProfileId === profile.id}
                                                onChat={() => handleStartChat(profile.id)}
                                                onToggle={(e) => {
                                                    e.stopPropagation()
                                                    toggleProfileSelection(profile.id)
                                                }}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* Alumnos/Tutores Section */}
                                {groupedProfiles.alumnos_tutores.length > 0 && (
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest px-2 flex items-center gap-2">
                                            <UsersIcon className="h-4 w-4" />
                                            Alumnos/Tutores ({groupedProfiles.alumnos_tutores.length})
                                        </h4>
                                        {groupedProfiles.alumnos_tutores.map(profile => (
                                            <ProfileItem
                                                key={profile.id}
                                                profile={profile}
                                                isSelected={selectedProfiles.includes(profile.id)}
                                                isOnline={isUserOnline(profile.id)}
                                                isStarting={startingProfileId === profile.id}
                                                onChat={() => handleStartChat(profile.id)}
                                                onToggle={(e) => {
                                                    e.stopPropagation()
                                                    toggleProfileSelection(profile.id)
                                                }}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* No results */}
                                {groupedProfiles.docentes.length === 0 &&
                                    groupedProfiles.administrativos.length === 0 &&
                                    groupedProfiles.alumnos_tutores.length === 0 && (
                                        <div className="text-center py-8 text-slate-400">
                                            <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                            <p className="font-medium">No se encontraron usuarios</p>
                                        </div>
                                    )}
                            </div>
                        </div>

                        {selectedProfiles.length > 0 && (
                            <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100 shrink-0">
                                <button
                                    onClick={handleCreateGroup}
                                    disabled={isCreating || !groupName}
                                    className="w-full py-3 sm:py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-sm sm:text-base"
                                >
                                    {isCreating ? 'Creando...' : (
                                        <>
                                            <UsersIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                                            Crear Grupo con {selectedProfiles.length} personas
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* New Announcement Modal */}
            {showNewAnnouncementModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="p-8 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl">
                                    <Megaphone className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900">Nuevo Comunicado</h3>
                                    <p className="text-xs text-amber-600 font-bold uppercase tracking-widest">Mensaje Masivo</p>
                                </div>
                            </div>
                            <button onClick={() => setShowNewAnnouncementModal(false)} className="p-2 hover:bg-white rounded-xl transition-all">
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Título del Aviso</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Suspensión de labores por consejo técnico"
                                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-4 focus:ring-amber-100 transition-all outline-none"
                                    value={newAnnouncement.title}
                                    onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Contenido</label>
                                <textarea
                                    placeholder="Escribe el mensaje detallado aquí..."
                                    className="w-full h-32 px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-4 focus:ring-amber-100 transition-all outline-none resize-none"
                                    value={newAnnouncement.content}
                                    onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                                />
                            </div>
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                                <div className="flex items-center gap-3">
                                    <Bell className="w-5 h-5 text-slate-400" />
                                    <div>
                                        <p className="text-xs font-black text-slate-800">Notificar por Email</p>
                                        <p className="text-[10px] text-slate-400 font-medium">Se enviará una copia a todos los correos registrados.</p>
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    className="w-6 h-6 rounded-lg border-slate-200 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    checked={newAnnouncement.sendEmail}
                                    onChange={(e) => setNewAnnouncement({ ...newAnnouncement, sendEmail: e.target.checked })}
                                />
                            </div>
                        </div>
                        <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex gap-4">
                            <button
                                onClick={() => setShowNewAnnouncementModal(false)}
                                className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSendAnnouncement}
                                className="flex-[2] py-4 bg-gray-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-2"
                            >
                                <Megaphone className="w-4 h-4" />
                                Publicar y Enviar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
