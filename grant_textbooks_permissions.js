
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function grantPermissions() {
    try {
        console.log('Granting permissions on textbooks table...');

        const sql = `
            GRANT ALL ON TABLE public.textbooks TO anon, authenticated, service_role;
            GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
        `;

        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

        if (error) {
            console.error('Error granting permissions:', error);
            process.exit(1);
        }

        console.log('Permissions granted successfully!');
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

grantPermissions();
