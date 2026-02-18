
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Supabase URL or Key not found in environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnoseDatabase() {
    try {
        console.log('--- Database Diagnosis ---');

        // Check if textbooks table exists
        const { data: tableCheck, error: tableError } = await supabase.rpc('exec_sql', {
            sql_query: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'textbooks'"
        });

        // Wait, exec_sql returns void. I need a function that returns data if I want to read.
        // Let's see if there is another RPC. 
        // If not, I can just try a simple select from the table via the client.

        const { data: selectData, error: selectError } = await supabase.from('textbooks').select('*').limit(1);

        if (selectError) {
            console.log('Select from textbooks failed:', selectError.message);
            console.log('Error code:', selectError.code);
        } else {
            console.log('Select from textbooks succeeded! Table exists and is accessible.');
        }

        // Check for exec_sql details
        // We know it exists because it failed with an ownership error earlier.

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

diagnoseDatabase();
