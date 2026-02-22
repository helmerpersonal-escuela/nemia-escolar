import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    const email = 'helmerferras@gmail.com';
    console.log(`--- DIAGNOSING WORKSPACE FOR ${email} ---`);

    // 1. Get Profile
    const { data: profile } = await supabase.from('profiles').select('*').eq('email', email).maybeSingle();
    console.log('PROFILE:', JSON.stringify(profile, null, 2));

    if (profile) {
        // 2. Get All Workspace Roles
        const { data: pt } = await supabase
            .from('profile_tenants')
            .select('*, tenants(name, type)')
            .eq('profile_id', profile.id);

        console.log('WORKSPACES (profile_tenants):', JSON.stringify(pt, null, 2));

        // 3. Get Guardianship
        const { data: guardians } = await supabase
            .from('guardians')
            .select('*, students(full_name)')
            .eq('user_id', profile.id);

        console.log('GUARDIANSHIPS:', JSON.stringify(guardians, null, 2));
    }
}

run();
