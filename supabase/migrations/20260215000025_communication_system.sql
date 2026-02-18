-- 1. Extend Guardians Table to link with Auth Profiles
ALTER TABLE public.guardians ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id);

-- 2. Chat Rooms
CREATE TABLE IF NOT EXISTS public.chat_rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    name text, -- Optional for group chats
    type text NOT NULL CHECK (type IN ('DIRECT', 'GROUP', 'CHANNEL')),
    created_at timestamp with time zone DEFAULT now()
);

-- 3. Chat Participants
CREATE TABLE IF NOT EXISTS public.chat_participants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id uuid REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    role text DEFAULT 'MEMBER' CHECK (role IN ('ADMIN', 'MEMBER')),
    last_read_at timestamp with time zone DEFAULT now(),
    UNIQUE(room_id, profile_id)
);

-- 4. Chat Messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id uuid REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    sender_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    content text,
    type text DEFAULT 'TEXT' CHECK (type IN ('TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'REPORT', 'STICKER')),
    metadata jsonb DEFAULT '{}', -- For link previews, report details, shared items
    created_at timestamp with time zone DEFAULT now()
);

-- 5. Chat Reactions
CREATE TABLE IF NOT EXISTS public.chat_reactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid REFERENCES public.chat_messages(id) ON DELETE CASCADE,
    profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    reaction text NOT NULL, -- emoji or alias
    UNIQUE(message_id, profile_id, reaction)
);

-- RLS Policies
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_reactions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see rooms they are participants of
-- Policy: Users can only see rooms they are participants of
-- Policy: Users can see rooms in their tenant
DROP POLICY IF EXISTS "View own rooms" ON public.chat_rooms;
CREATE POLICY "View own rooms" ON public.chat_rooms
    FOR SELECT USING (
        tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    );

-- Policy: Users can see participants in their tenant's rooms
DROP POLICY IF EXISTS "View participants" ON public.chat_participants;
CREATE POLICY "View participants" ON public.chat_participants
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chat_rooms r
            WHERE r.id = chat_participants.room_id
            AND r.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        )
    );

-- Policy: Users can send messages to rooms in their tenant
DROP POLICY IF EXISTS "Send messages" ON public.chat_messages;
CREATE POLICY "Send messages" ON public.chat_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.chat_rooms r
            WHERE r.id = chat_messages.room_id
            AND r.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        )
    );

-- Policy: Users can read messages in their tenant's rooms
DROP POLICY IF EXISTS "Read messages" ON public.chat_messages;
CREATE POLICY "Read messages" ON public.chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chat_rooms r
            WHERE r.id = chat_messages.room_id
            AND r.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        )
    );

-- Enable Realtime for these tables safely
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'chat_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'chat_rooms'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_rooms;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'chat_participants'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;
    END IF;
END $$;
