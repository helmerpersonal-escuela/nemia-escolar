import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('Deep trigger check for profiles...');
    const { data: triggerInfo } = await supabase.rpc('exec_query', {
        p_sql: `
            SELECT 
                tgname, 
                proname as function_name,
                nspname as function_schema
            FROM pg_trigger 
            JOIN pg_proc ON pg_trigger.tgfoid = pg_proc.oid
            JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid
            JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
            WHERE pg_class.relname = 'profiles'
        `
    });
    console.log('TRIGGER INFO:', JSON.stringify(triggerInfo, null, 2));
}

run();
