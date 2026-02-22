import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    const helmerTutorId = 'ecd127be-a39c-48a9-8661-e50ffb2248fd';
    const tenantId = 'c8b671a5-8fe1-4770-985f-8255e2a22f30';
    const studentId = '8c0a8767-1601-4993-96b6-58673f808381';

    console.log('Attempting direct insert into profile_tenants...');
    const { data: pt, error: ptError } = await supabase
        .from('profile_tenants')
        .upsert({
            profile_id: helmerTutorId,
            tenant_id: tenantId,
            role: 'TUTOR',
            first_name: 'HELMER'
        }, { onConflict: 'profile_id,tenant_id' });

    if (ptError) console.error('PT ERROR:', ptError);
    else console.log('PT SUCCESS');

    console.log('Attempting direct insert into guardians...');
    const { data: g, error: gError } = await supabase
        .from('guardians')
        .upsert({
            user_id: helmerTutorId,
            profile_id: helmerTutorId,
            student_id: studentId,
            relationship: 'Padre',
            tenant_id: tenantId,
            first_name: 'HELMER',
            email: 'helmerferras@gmail.com'
        }, { onConflict: 'user_id,student_id' });

    if (gError) console.error('GUARDIAN ERROR:', gError);
    else console.log('GUARDIAN SUCCESS');
}

run();
