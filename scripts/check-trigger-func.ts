import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('Checking trigger function for on_profile_update...');
    const { data: triggerFunc } = await supabase.rpc('exec_query', {
        p_sql: `
            SELECT proname, prosrc 
            FROM pg_proc 
            JOIN pg_trigger ON pg_proc.oid = pg_trigger.tgfoid 
            WHERE tgname = 'on_profile_update'
        `
    });
    console.log('TRIGGER FUNCTION:', JSON.stringify(triggerFunc, null, 2));
}

run();
