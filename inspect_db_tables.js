
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectDatabase() {
    try {
        console.log('Creating inspection function...');

        const createFunc = `
            CREATE OR REPLACE FUNCTION public.inspect_tables()
            RETURNS TABLE(sname text, tname text, towner text)
            LANGUAGE plpgsql
            SECURITY DEFINER
            AS $$
            BEGIN
                RETURN QUERY SELECT schemaname::text, tablename::text, tableowner::text 
                FROM pg_catalog.pg_tables 
                WHERE schemaname = 'public' AND tablename LIKE '%textbook%';
            END;
            $$;
            GRANT EXECUTE ON FUNCTION public.inspect_tables() TO anon;
        `;

        const { error: funcError } = await supabase.rpc('exec_sql', { sql_query: createFunc });

        if (funcError) {
            console.error('Error creating inspection function:', funcError);
            process.exit(1);
        }

        console.log('Calling inspect_tables...');
        const { data, error } = await supabase.rpc('inspect_tables');

        if (error) {
            console.error('Error calling inspect_tables:', error);
            process.exit(1);
        }

        console.log('Tables found:', JSON.stringify(data, null, 2));

        if (data.length === 0) {
            console.log('No textbook tables found in public schema.');
        }

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

inspectDatabase();
