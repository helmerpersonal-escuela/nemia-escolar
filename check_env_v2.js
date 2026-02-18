
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectUserAndBuckets() {
    try {
        console.log('Inspecting User and Buckets...');

        // Use a function that exists or create one that returns text
        const sql = `
            CREATE OR REPLACE FUNCTION public.check_env()
            RETURNS TABLE(info text)
            LANGUAGE plpgsql
            SECURITY DEFINER
            AS $$
            BEGIN
                RETURN QUERY SELECT 'Bucket: ' || id || ' (Public: ' || public::text || ')' FROM storage.buckets;
                RETURN QUERY SELECT 'User Email regex: ' || email FROM auth.users WHERE email ILIKE 'helmer%';
            END;
            $$;
            GRANT EXECUTE ON FUNCTION public.check_env() TO anon, authenticated;
        `;

        await supabase.rpc('exec_sql', { sql_query: sql });

        // Wait and call
        console.log('Waiting for check_env...');
        await new Promise(r => setTimeout(r, 2000));

        const { data, error } = await supabase.rpc('check_env');
        if (error) {
            console.error('Error:', error);
        } else {
            console.log('Environment Info:', JSON.stringify(data, null, 2));
        }

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

inspectUserAndBuckets();
