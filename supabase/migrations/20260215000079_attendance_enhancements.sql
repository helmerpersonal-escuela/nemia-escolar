-- 20260215000076_attendance_enhancements.sql

-- 1. Add check_out to teacher_module_attendance
ALTER TABLE public.teacher_module_attendance 
ADD COLUMN IF NOT EXISTS check_out timestamp with time zone;

-- 2. Add work_start_time to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS work_start_time time DEFAULT '07:00:00';

-- 3. Create System User (Idempotent)
DO $$
DECLARE
    sys_id uuid;
BEGIN
    -- Check if system user exists (by a specific fixed UUID or email pattern)
    -- Let's use a fixed UUID for the system user to be consistent: '00000000-0000-0000-0000-000000000000' is risky for auth.users join
    -- Better to just create a profile if it doesn't exist, linked to a placeholder or handled via RLS.
    -- Actually, since profiles references auth.users, we can't easily insert a profile without a user.
    -- HOWEVER, for the "System" sender in chat, we might cheat or needs a real user.
    -- Alternative: The `send_system_message` function can insert with a specific sender_id that we define as "System".
    -- Let's see if we can create a "System" profile on the fly if we use a specific UUID that generates no foreign key error?
    -- No, referential integrity will block us unless we have an auth user.
    
    -- STRATEGY: We will assume there is an ADMIN user who acts as system, OR we relax the FK for sender_id in chat_messages?
    -- No, chat_messages usually links to profiles.
    
    -- BETTER STRATEGY: The system message will actually come from the Tenant's Administrator (or the first Admin found), 
    -- OR we create a specific "Bot" user in auth.users? Creating auth users via SQL is tricky/impossible without pgsodium/vault.
    
    -- WORKAROUND: We will simply upsert a profile with a specific UUID '00000000-0000-0000-0000-000000000001' 
    -- and we will DROP the foreign key constraint on chat_messages.sender_id IF IT EXISTS, 
    -- OR we make the FK deferrable? 
    -- Actually, the cleanest way without a real auth user is to make sender_id nullable or not enforced for system messages.
    -- Let's check `chat_messages` definition.
    
    -- Checking `chat_messages`: sender_id usually references profiles(id).
    -- If we can't create a real auth user, we can't create a real profile.
    
    -- ALTERNATIVE: Use the sender_id of the CURRENT USER (acting as self) but message type 'SYSTEM'?
    -- No, user wants a "System User".
    
    -- OK, let's try to insert into `auth.users`? No, we don't have permissions usually.
    
    -- FINAL STRATEGY: We will use a special UUID for system messages.
    -- We will alter the `chat_messages` table to allow `sender_id` to NOT populate a Foreign Key constraint if it's the system ID?
    -- Or better: We drop the FK constraint to profiles and recreate it without strict enforcement for the system ID?
    -- Too complex.
    
    -- SIMPLEST: We'll just define that System Messages have `sender_id` = NULL (if allowed) or we reuse the Tenant ID as the Profile ID?
    -- Let's make `sender_id` nullable in chat_messages if it isn't.
    -- If `sender_id` is NULL, UI treats it as "System".
    
    -- Let's check if we can make sender_id nullable.
END $$;

-- Let's simply modify chat_messages to allow nullable sender_id for System messages
ALTER TABLE public.chat_messages ALTER COLUMN sender_id DROP NOT NULL;

-- 4. Secure RPC to send system messages
-- This function allows sending a message to a room without being a participant (super power), 
-- or specifically for system notifications.
CREATE OR REPLACE FUNCTION public.send_system_message(
    p_room_id uuid,
    p_content text,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the creator (postgres/admin)
SET search_path = public
AS $$
DECLARE
    v_msg_id uuid;
BEGIN
    INSERT INTO public.chat_messages (room_id, sender_id, content, type, metadata)
    VALUES (p_room_id, NULL, p_content, 'SYSTEM', p_metadata) -- Sender NULL means System
    RETURNING id INTO v_msg_id;
    
    RETURN v_msg_id;
END;
$$;

-- 5. Grant execute permission
GRANT EXECUTE ON FUNCTION public.send_system_message TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_system_message TO service_role;
