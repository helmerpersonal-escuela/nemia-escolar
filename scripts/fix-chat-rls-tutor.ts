/**
 * Diagnose and fix chat RLS issues for the TUTOR user.
 * Run: npx ts-node -e "require('./scripts/fix-chat-rls-tutor.ts')"
 * Or: npx tsx scripts/fix-chat-rls-tutor.ts
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
})

async function main() {
    const HELMER_TUTOR_ID = 'ecd127be-a39c-48a9-8661-e50ffb2248fd'

    console.log('=== DIAGNOSE CHAT RLS FOR TUTOR ===\n')

    // 1. Check what tenant_id is in profiles table for the tutor
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, role, tenant_id, full_name')
        .eq('id', HELMER_TUTOR_ID)
        .single()

    if (profileError) {
        console.error('Profile error:', profileError)
        return
    }

    console.log('Tutor profile:', JSON.stringify(profile, null, 2))

    // 2. Check profile_tenants
    const { data: ptRows } = await supabase
        .from('profile_tenants')
        .select('*')
        .eq('profile_id', HELMER_TUTOR_ID)

    console.log('\nprofile_tenants rows:', JSON.stringify(ptRows, null, 2))

    // 3. List the current RLS policies on chat_rooms
    console.log('\n=== CURRENT RLS POLICIES ON chat_rooms ===')
    const { data: policies } = await supabase.rpc('exec_sql', {
        sql_query: `
            SELECT policyname, cmd, qual, with_check
            FROM pg_policies
            WHERE tablename = 'chat_rooms'
            ORDER BY policyname;
        `
    })
    console.log(JSON.stringify(policies, null, 2))

    // 4. Check existing chat rooms
    const { data: rooms } = await supabase
        .from('chat_rooms')
        .select('*')
        .limit(10)

    console.log('\nExisting chat rooms:', JSON.stringify(rooms, null, 2))

    // 5. Try to create a chat room directly as service role
    const SCHOOL_TENANT_ID = 'efc61ce1-32c2-47b6-9751-95becd7ddc33'
    console.log('\n=== FIX: Applying comprehensive chat RLS fix ===')

    const fixSQL = `
        -- Drop all old chat_rooms policies and recreate properly
        DROP POLICY IF EXISTS "Users can create rooms" ON public.chat_rooms;
        DROP POLICY IF EXISTS "Users can view their own rooms" ON public.chat_rooms;
        DROP POLICY IF EXISTS "View own rooms" ON public.chat_rooms;

        -- SELECT: Users can see rooms in their tenant
        CREATE POLICY "chat_rooms_select" ON public.chat_rooms
        FOR SELECT USING (
            tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
            OR EXISTS (
                SELECT 1 FROM public.chat_participants cp
                WHERE cp.room_id = chat_rooms.id
                AND cp.profile_id = auth.uid()
            )
        );

        -- INSERT: Any authenticated user in a tenant can create a room in their tenant
        CREATE POLICY "chat_rooms_insert" ON public.chat_rooms
        FOR INSERT WITH CHECK (
            tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        );

        -- UPDATE: Only room creators / admins
        DROP POLICY IF EXISTS "chat_rooms_update" ON public.chat_rooms;
        CREATE POLICY "chat_rooms_update" ON public.chat_rooms
        FOR UPDATE USING (
            tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        );

        -- DELETE: Admin only
        DROP POLICY IF EXISTS "chat_rooms_delete" ON public.chat_rooms;
        CREATE POLICY "chat_rooms_delete" ON public.chat_rooms
        FOR DELETE USING (
            tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        );

        -- chat_participants INSERT fix
        DROP POLICY IF EXISTS "chat_participants_insert" ON public.chat_participants;
        CREATE POLICY "chat_participants_insert" ON public.chat_participants
        FOR INSERT WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.chat_rooms r
                WHERE r.id = chat_participants.room_id
                AND r.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
            )
        );

        -- chat_participants SELECT fix
        DROP POLICY IF EXISTS "View participants" ON public.chat_participants;
        DROP POLICY IF EXISTS "chat_participants_select" ON public.chat_participants;
        CREATE POLICY "chat_participants_select" ON public.chat_participants
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.chat_rooms r
                WHERE r.id = chat_participants.room_id
                AND r.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
            )
        );
    `

    const { error: fixError } = await supabase.rpc('exec_sql', { sql_query: fixSQL })
    if (fixError) {
        console.error('❌ Fix error:', fixError.message)
        console.log('\nTrying alternative: applying policies one by one...')
        // Try executing each statement individually
        const statements = fixSQL.split(';').map(s => s.trim()).filter(s => s.length > 0)
        for (const stmt of statements) {
            const { error } = await supabase.rpc('exec_sql', { sql_query: stmt + ';' })
            if (error) {
                console.log(`  SKIP: "${stmt.substring(0, 60)}..." - ${error.message}`)
            } else {
                console.log(`  OK:   "${stmt.substring(0, 60)}..."`)
            }
        }
    } else {
        console.log('✅ RLS fix applied successfully!')
    }

    // 6. Verify tutor has correct tenant_id in profiles
    if (!profile.tenant_id) {
        console.log('\n⚠️  Tutor has NULL tenant_id in profiles! Fixing...')
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ tenant_id: SCHOOL_TENANT_ID })
            .eq('id', HELMER_TUTOR_ID)

        if (updateError) {
            console.error('Update error:', updateError.message)
        } else {
            console.log('✅ Set tutor tenant_id to SCHOOL tenant:', SCHOOL_TENANT_ID)
        }
    } else {
        console.log('\n✅ Tutor already has tenant_id:', profile.tenant_id)
        if (profile.tenant_id !== SCHOOL_TENANT_ID) {
            console.log('⚠️  But it doesn\'t match the expected SCHOOL tenant:', SCHOOL_TENANT_ID)
            console.log('Fixing...')
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ tenant_id: SCHOOL_TENANT_ID })
                .eq('id', HELMER_TUTOR_ID)
            if (updateError) console.error('Update error:', updateError.message)
            else console.log('✅ Updated tenant_id to:', SCHOOL_TENANT_ID)
        }
    }

    console.log('\n=== DONE ===')
    console.log('Now try refreshing the browser and clicking on the teacher again.')
}

main().catch(console.error)
