import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('--- STARTING FIX V2 ---');
    const helmerId = '85870a47-4730-401d-a96c-a3712e821b3d';
    const danielaStudentId = 'e4999efc-70fc-4034-8451-f7614d3f784e';
    const tenantId = 'c8b671a5-8fe1-4770-985f-8255e2a22f30';

    try {
        // 1. Profile
        await supabase
            .from('profiles')
            .update({
                role: 'TUTOR',
                tenant_id: tenantId,
                first_name: 'HELMER',
                full_name: 'HELMER FERRAS CABRERA'
            })
            .eq('id', helmerId);
        console.log('Profile updated.');

        // 2. Guardianship
        const { data: existing } = await supabase
            .from('guardians')
            .select('*')
            .eq('user_id', helmerId)
            .eq('student_id', danielaStudentId)
            .maybeSingle();

        if (!existing) {
            console.log('Inserting guardian link...');
            const { error: iError } = await supabase
                .from('guardians')
                .insert({
                    user_id: helmerId,
                    student_id: danielaStudentId,
                    relationship: 'Padre',
                    is_emergency_contact: true
                });
            if (iError) console.error('G INSERT ERROR:', iError);
            else console.log('G INSERT OK');
        } else {
            console.log('Guardian link already exists.');
        }

        // 3. Verification
        const { data: final } = await supabase.from('profiles').select('role, full_name, tenant_id').eq('id', helmerId).single();
        console.log('FINAL PROFILE:', final);

        const { data: gFinal } = await supabase.from('guardians').select('*').eq('user_id', helmerId);
        console.log('FINAL GUARDIANS:', gFinal);

    } catch (e) {
        console.error('CATCH:', e);
    }
}

run();
