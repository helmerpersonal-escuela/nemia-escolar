
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectStoragePolicies() {
    try {
        console.log('Inspecting Storage Policies...');

        const sql = `
            SELECT 
                schemaname, 
                tablename, 
                policyname, 
                permissive, 
                roles, 
                cmd, 
                qual, 
                with_check 
            FROM pg_policies 
            WHERE schemaname = 'storage' AND tablename = 'objects';
        `;

        // Use exec_sql to insert into diag_results since it's void and we can't get direct return easily 
        // unless we use a function that returns table.
        // Actually, let's create a function that returns the table.

        const createFunc = `
            CREATE OR REPLACE FUNCTION public.get_storage_policies()
            RETURNS TABLE(pname text, pcmd text, pqual text, pcheck text)
            LANGUAGE plpgsql
            SECURITY DEFINER
            AS $$
            BEGIN
                RETURN QUERY SELECT 
                    policyname::text, 
                    cmd::text, 
                    qual::text, 
                    with_check::text
                FROM pg_policies 
                WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE '%Admin%';
            END;
            $$;
            GRANT EXECUTE ON FUNCTION public.get_storage_policies() TO anon, authenticated;
        `;

        await supabase.rpc('exec_sql', { sql_query: createFunc });

        const { data, error } = await supabase.rpc('get_storage_policies');

        if (error) {
            console.error('Error fetching policies:', error);
        } else {
            console.log('Admin Storage Policies:', JSON.stringify(data, null, 2));
        }

        // Also check buckets
        const bucketSql = `
            CREATE OR REPLACE FUNCTION public.get_buckets()
            RETURNS TABLE(bid text, bname text, bpublic boolean)
            LANGUAGE plpgsql
            SECURITY DEFINER
            AS $$
            BEGIN
                RETURN QUERY SELECT id::text, name::text, public FROM storage.buckets;
            END;
            $$;
            GRANT EXECUTE ON FUNCTION public.get_buckets() TO anon, authenticated;
        `;
        await supabase.rpc('exec_sql', { sql_query: bucketSql });
        const { data: bData, error: bError } = await supabase.rpc('get_buckets');
        if (bError) {
            console.error('Error fetching buckets:', bError);
        } else {
            console.log('Buckets:', JSON.stringify(bData, null, 2));
        }

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

inspectStoragePolicies();
