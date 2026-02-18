
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
    console.log('--- GLOBAL SCHEMA INSPECTION ---')

    // Create broad inspection function
    const sql = `
    CREATE OR REPLACE FUNCTION public.inspect_global_tables(t_name text) 
    RETURNS jsonb 
    LANGUAGE plpgsql 
    SECURITY DEFINER
    AS $$ 
    DECLARE 
        result jsonb; 
    BEGIN 
        SELECT jsonb_agg(jsonb_build_object('schema', table_schema, 'table', table_name)) 
        INTO result 
        FROM information_schema.tables 
        WHERE table_name = t_name; 
        RETURN result; 
    END; 
    $$;

    CREATE OR REPLACE FUNCTION public.inspect_global_columns(t_name text) 
    RETURNS jsonb 
    LANGUAGE plpgsql 
    SECURITY DEFINER
    AS $$ 
    DECLARE 
        result jsonb; 
    BEGIN 
        SELECT jsonb_agg(jsonb_build_object('schema', table_schema, 'column', column_name, 'type', data_type)) 
        INTO result 
        FROM information_schema.columns 
        WHERE table_name = t_name; 
        RETURN result; 
    END; 
    $$;

    GRANT EXECUTE ON FUNCTION public.inspect_global_tables(text) TO authenticated, anon;
    GRANT EXECUTE ON FUNCTION public.inspect_global_columns(text) TO authenticated, anon;
    `;

    await supabase.rpc('exec_sql', { sql_query: sql });

    console.log('Inspecting TABLES...');
    const { data: tables } = await supabase.rpc('inspect_global_tables', { t_name: 'lesson_plans' });
    console.log('TABLES FOUND:', JSON.stringify(tables, null, 2));

    console.log('Inspecting COLUMNS...');
    const { data: columns } = await supabase.rpc('inspect_global_columns', { t_name: 'lesson_plans' });
    console.log('COLUMNS FOUND:', JSON.stringify(columns, null, 2));
}

run()
