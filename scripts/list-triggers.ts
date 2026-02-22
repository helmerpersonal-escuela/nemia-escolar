import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('Listing triggers for profiles...');
    const { data: triggers } = await supabase.rpc('exec_query', {
        p_sql: "SELECT tgname as trigger_name FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid WHERE c.relname = 'profiles' AND t.tgisinternal = false"
    });
    console.log('TRIGGERS:', JSON.stringify(triggers, null, 2));

    console.log('Checking if exec_sql exists in any form...');
    const { data: procs } = await supabase.rpc('exec_query', {
        p_sql: "SELECT proname FROM pg_proc WHERE proname LIKE '%exec_sql%'"
    });
    console.log('PROCS:', JSON.stringify(procs, null, 2));
}

run();
