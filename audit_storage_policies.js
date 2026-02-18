
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function auditStoragePolicies() {
    try {
        console.log('Auditing Storage Policies...');

        const sql = `
            CREATE TABLE IF NOT EXISTS public.diag_results (info text);
            DELETE FROM public.diag_results;
            INSERT INTO public.diag_results (info)
            SELECT 'Policy: ' || policyname || ' | Cmd: ' || cmd || ' | Qual: ' || COALESCE(qual, 'NULL') || ' | Check: ' || COALESCE(with_check, 'NULL')
            FROM pg_policies 
            WHERE schemaname = 'storage' AND tablename = 'objects' AND (policyname LIKE '%textbook%' OR policyname LIKE '%Admin%');
        `;

        await supabase.rpc('exec_sql', { sql_query: sql });

        console.log('Waiting for cache...');
        await new Promise(r => setTimeout(r, 2000));

        const { data, error } = await supabase.from('diag_results').select('*');

        if (error) {
            console.error('Error reading diag_results:', error);
        } else {
            console.log('Found Policies:', JSON.stringify(data, null, 2));
        }

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

auditStoragePolicies();
