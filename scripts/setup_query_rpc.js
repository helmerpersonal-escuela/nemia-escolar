
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import fs from 'fs'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
    console.log('--- Establishing query_json RPC ---');

    const sql = `
    CREATE OR REPLACE FUNCTION public.query_json(sql_query text) 
    RETURNS jsonb 
    LANGUAGE plpgsql 
    SECURITY DEFINER
    AS $$ 
    DECLARE 
        result jsonb; 
    BEGIN 
        EXECUTE 'SELECT jsonb_agg(t) FROM (' || sql_query || ') t' INTO result; 
        RETURN result; 
    END; 
    $$;
    
    GRANT EXECUTE ON FUNCTION public.query_json(text) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.query_json(text) TO anon;
    `;

    const { error: rpcError } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (rpcError) {
        console.error('Error creating RPC:', rpcError);
        return;
    }

    console.log('RPC Created. Testing it...');
    const { data, error } = await supabase.rpc('query_json', { sql_query: 'SELECT current_database(), current_schema()' });

    if (error) {
        console.error('Error calling RPC:', error);
    } else {
        console.log('RPC Success:', JSON.stringify(data, null, 2));
    }
}

run()
