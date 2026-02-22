import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    const helmerTutorId = 'ecd127be-a39c-48a9-8661-e50ffb2248fd';

    console.log('=== FINAL VERIFICATION ===\n');

    // 1. Profile
    const { data: profile } = await supabase.rpc('exec_query', {
        p_sql: `SELECT id, first_name, role, tenant_id FROM profiles WHERE id = '${helmerTutorId}'`
    });
    console.log('1. PROFILE:', JSON.stringify(profile, null, 2));

    // 2. Profile Tenants
    const { data: pt } = await supabase.rpc('exec_query', {
        p_sql: `SELECT profile_id, tenant_id, role, first_name FROM profile_tenants WHERE profile_id = '${helmerTutorId}'`
    });
    console.log('2. PROFILE_TENANTS:', JSON.stringify(pt, null, 2));

    // 3. Guardians
    const { data: g } = await supabase.rpc('exec_query', {
        p_sql: `SELECT user_id, student_id, relationship, tenant_id FROM guardians WHERE user_id = '${helmerTutorId}'`
    });
    console.log('3. GUARDIANS:', JSON.stringify(g, null, 2));

    // 4. Student
    const { data: s } = await supabase.rpc('exec_query', {
        p_sql: `SELECT id, first_name, last_name_paternal, tenant_id FROM students WHERE id = 'a0f1f865-6389-4da9-b451-b968eb1b3717'`
    });
    console.log('4. STUDENT:', JSON.stringify(s, null, 2));

    // Summary
    const hasProfile = profile && profile.length > 0 && profile[0].role === 'TUTOR';
    const hasPT = pt && pt.length > 0 && pt[0].role === 'TUTOR';
    const hasGuardian = g && g.length > 0;
    const hasStudent = s && s.length > 0;

    console.log('\n=== SUMMARY ===');
    console.log(`Profile TUTOR: ${hasProfile ? '✅' : '❌'}`);
    console.log(`Profile_Tenants TUTOR: ${hasPT ? '✅' : '❌'}`);
    console.log(`Guardian Link: ${hasGuardian ? '✅' : '❌'}`);
    console.log(`Student Found: ${hasStudent ? '✅' : '❌'}`);

    if (hasProfile && hasPT && hasGuardian && hasStudent) {
        console.log('\n🎉 ALL LINKS VERIFIED - Dashboard should show TutorDashboard!');
    } else {
        console.log('\n⚠️ Some links are missing - need further investigation');
    }
}

run();
