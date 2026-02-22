import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('Checking trigger DDL for on_profile_update...');
    const { data: triggerDDL } = await supabase.rpc('exec_query', {
        p_sql: `
            SELECT pg_get_triggerdef(oid) 
            FROM pg_trigger 
            WHERE tgname = 'on_profile_update'
        `
    });
    console.log('TRIGGER DDL:', JSON.stringify(triggerDDL, null, 2));
}

run();
