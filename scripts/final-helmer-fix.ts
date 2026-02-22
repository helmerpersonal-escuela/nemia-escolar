import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    const tutorId = '85870a47-4730-401d-a96c-a3712e821b3d';
    const studentId = '8c0a8767-1601-4993-96b6-58673f808381';

    console.log('--- FINAL FIX ---');

    // 1. Update Tutor Name (Helmer Ferras Coutiño)
    const { error: tError } = await supabase.rpc('exec_sql', {
        p_sql: `UPDATE profiles SET full_name = 'HELMER FERRAS COUTIÑO', first_name = 'HELMER', last_name_maternal = 'COUTIÑO', last_name_paternal = 'FERRAS' WHERE id = '${tutorId}'`
    });
    if (tError) console.error('Tutor Update Error:', tError);
    else console.log('Tutor Name Updated.');

    // 2. Update Student Gender and Avatar (Helmer Ferras Hernandez)
    const { error: sError } = await supabase.rpc('exec_sql', {
        p_sql: `UPDATE students SET sex = 'HOMBRE', avatar_url = 'https://api.dicebear.com/7.x/avataaars/svg?seed=HelmerStudent&gender=male' WHERE id = '${studentId}'`
    });
    if (sError) console.error('Student Update Error:', sError);
    else console.log('Student Gender and Avatar Updated.');

    // 3. Verify
    const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', tutorId).single();
    const { data: student } = await supabase.from('students').select('first_name, sex, avatar_url').eq('id', studentId).single();

    console.log('VERIFICATION:');
    console.log('Tutor:', JSON.stringify(profile));
    console.log('Student:', JSON.stringify(student));
}

run();
