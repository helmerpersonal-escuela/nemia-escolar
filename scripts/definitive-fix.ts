import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config();

// Load the service role key directly from file if possible or env
const envContent = fs.readFileSync('.env', 'utf-8');
const match = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
const serviceRoleKey = match ? match[1].trim().replace(/^"|"$/g, '') : process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
    console.error('CRITICAL: SUPABASE_SERVICE_ROLE_KEY not found!');
    process.exit(1);
}

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    serviceRoleKey,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

async function run() {
    const helmerId = '85870a47-4730-401d-a96c-a3712e821b3d';
    const studentId = '8c0a8767-1601-4993-96b6-58673f808381';
    const tenantId = 'c8b671a5-8fe1-4770-985f-8255e2a22f30';

    console.log('--- DEFINITIVE FIX (SERVICE ROLE) ---');

    // 1. Update Profile
    const { data: pData, error: pError } = await supabase
        .from('profiles')
        .update({
            role: 'TUTOR',
            tenant_id: tenantId,
            first_name: 'HELMER',
            full_name: 'HELMER FERRAS COUTIÑO',
            last_name_paternal: 'FERRAS',
            last_name_maternal: 'COUTIÑO'
        })
        .eq('id', helmerId)
        .select();

    if (pError) console.error('P ERROR:', pError);
    else console.log('P UPDATED:', JSON.stringify(pData));

    // 2. Profile Tenants
    const { error: ptError } = await supabase
        .from('profile_tenants')
        .upsert({
            profile_id: helmerId,
            tenant_id: tenantId,
            role: 'TUTOR',
            first_name: 'HELMER',
            last_name_paternal: 'FERRAS',
            last_name_maternal: 'COUTIÑO',
            full_name: 'HELMER FERRAS COUTIÑO'
        });

    if (ptError) console.error('PT ERROR:', ptError);
    else console.log('PT UPDATED.');

    // 3. Guardians
    const { error: gError } = await supabase
        .from('guardians')
        .upsert({
            user_id: helmerId,
            profile_id: helmerId,
            student_id: studentId,
            relationship: 'Padre',
            tenant_id: tenantId,
            first_name: 'HELMER',
            last_name_paternal: 'FERRAS',
            last_name_maternal: 'COUTIÑO',
            email: 'helmerferras@gmail.com'
        });

    if (gError) console.error('G ERROR:', gError);
    else console.log('G UPDATED.');

    // 4. Student
    const { error: sError } = await supabase
        .from('students')
        .update({
            sex: 'HOMBRE',
            avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=HelmerStudent&gender=male'
        })
        .eq('id', studentId);

    if (sError) console.error('S ERROR:', sError);
    else console.log('S UPDATED.');

    console.log('--- VERIFYING ---');
    const { data: finalP } = await supabase.from('profiles').select('email, first_name, role').eq('id', helmerId).single();
    console.log('FINAL PROFILE:', JSON.stringify(finalP));
}

run();
