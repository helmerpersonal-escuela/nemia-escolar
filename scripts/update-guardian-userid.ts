import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    const helmerTutorId = 'ecd127be-a39c-48a9-8661-e50ffb2248fd';
    const guardianId = '6c78507c-e620-48b0-bf46-e7d13d16c453';

    console.log('--- UPDATING GUARDIAN user_id ---');

    // Update the existing guardian record to set user_id
    const { error } = await supabase.rpc('exec_sql', {
        sql_query: `UPDATE guardians SET user_id = '${helmerTutorId}' WHERE id = '${guardianId}'`
    });

    if (error) {
        console.error('UPDATE ERROR:', error.message);
    } else {
        console.log('UPDATE OK');
    }

    // Verify
    const { data: g } = await supabase.rpc('exec_query', {
        p_sql: `SELECT id, user_id, profile_id, student_id, relationship, first_name FROM guardians WHERE id = '${guardianId}'`
    });
    console.log('GUARDIAN AFTER UPDATE:', JSON.stringify(g, null, 2));

    // Also verify profile_tenants
    const { data: pt } = await supabase.rpc('exec_query', {
        p_sql: `SELECT profile_id, tenant_id, role FROM profile_tenants WHERE profile_id = '${helmerTutorId}'`
    });
    console.log('PROFILE_TENANTS:', JSON.stringify(pt, null, 2));

    // Final profile check
    const { data: profile } = await supabase.rpc('exec_query', {
        p_sql: `SELECT id, first_name, role, tenant_id FROM profiles WHERE id = '${helmerTutorId}'`
    });
    console.log('PROFILE:', JSON.stringify(profile, null, 2));

    console.log('\n=== SUMMARY ===');
    const hasGuardianWithUserId = g && g.length > 0 && g[0].user_id === helmerTutorId;
    const hasPT = pt && pt.length > 0 && pt[0].role === 'TUTOR';
    const hasProfile = profile && profile.length > 0 && profile[0].role === 'TUTOR';

    console.log(`Guardian with user_id: ${hasGuardianWithUserId ? '✅' : '❌'}`);
    console.log(`Profile_tenants TUTOR: ${hasPT ? '✅' : '❌'}`);
    console.log(`Profile TUTOR: ${hasProfile ? '✅' : '❌'}`);

    if (hasGuardianWithUserId && hasPT && hasProfile) {
        console.log('\n🎉 ALL LINKS VERIFIED - TutorDashboard should work now!');
        console.log('Please refresh the browser to see the changes.');
    }
}

run();
