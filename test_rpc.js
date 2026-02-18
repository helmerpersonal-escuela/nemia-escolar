
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config'; // Auto-loads .env

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Error: URLs/Keys missing.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testRpc() {
    console.log('Testing RPC: start_free_trial...');

    // 1. Create a random test user
    const randomEmail = `test_${Math.floor(Math.random() * 100000)}@example.com`;
    const randomPassword = 'password123';

    console.log(`Creating temporary user: ${randomEmail}...`);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: randomEmail,
        password: randomPassword
    });

    if (signUpError) {
        console.error('SignUp Error:', signUpError.message);
        return;
    }

    const userId = signUpData.user?.id;
    console.log('User created. ID:', userId);

    // 2. Call RPC
    console.log('Invoking RPC...');
    const { data, error } = await supabase.rpc('start_free_trial', {
        p_plan_type: 'basic'
    });

    if (error) {
        console.error('RPC Error:', error);
        console.error('Message:', error.message);
        if (error.code) console.error('Code:', error.code);
        if (error.details) console.error('Details:', error.details);
    } else {
        console.log('RPC Success! Result:', data);
    }
}

testRpc();
