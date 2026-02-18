
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
    console.log('--- Establishing Schema Inspection RPC ---')

    const sql = `
    CREATE OR REPLACE FUNCTION public.inspect_table_schema(t_name text) 
    RETURNS jsonb 
    LANGUAGE plpgsql 
    SECURITY DEFINER
    AS $$ 
    DECLARE 
        result jsonb; 
    BEGIN 
        SELECT jsonb_agg(jsonb_build_object('column', column_name, 'type', data_type)) 
        INTO result 
        FROM information_schema.columns 
        WHERE table_name = t_name AND table_schema = 'public'; 
        RETURN result; 
    END; 
    $$;
    
    GRANT EXECUTE ON FUNCTION public.inspect_table_schema(text) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.inspect_table_schema(text) TO anon;
    `;

    const { error: rpcError } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (rpcError) {
        console.error('Error creating RPC:', rpcError);
        return;
    }

    console.log('RPC Created. Inspecting lesson_plans...');
    const { data, error } = await supabase.rpc('inspect_table_schema', { t_name: 'lesson_plans' });

    if (error) {
        console.error('Error calling RPC:', error);
    } else {
        console.log('SCHEMA fetched.');
        fs.writeFileSync('lesson_plans_schema_debug.json', JSON.stringify(data, null, 2));
    }
}
import fs from 'fs'

run()
