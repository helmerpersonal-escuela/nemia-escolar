
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Error: URLs/Keys missing.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkUser() {
    console.log('Attempting to SignUp with helmerpersonal@gmail.com...');

    const { data, error } = await supabase.auth.signUp({
        email: 'helmerpersonal@gmail.com',
        password: 'nemia2026password', // Temporary password
        options: {
            data: {
                first_name: 'Helmer',
                last_name: 'Personal (God)',
                role: 'SUPER_ADMIN' // This won't work for RLS but good for metadata
            }
        }
    });

    if (error) {
        console.error('SignUp Error:', error.message);
        if (error.message.includes('already registered')) {
            console.log('RESULT: User ALREADY EXISTS.');
        } else {
            console.log('RESULT: SignUp failed with other error.');
        }
    } else {
        if (data.user && data.user.identities && data.user.identities.length === 0) {
            console.log('RESULT: User ALREADY EXISTS (Identity check).');
        } else {
            console.log('RESULT: User CREATED successfully (or email sent).');
            console.log('User ID:', data.user?.id);
        }
    }
}

checkUser();
