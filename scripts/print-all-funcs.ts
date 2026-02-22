import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('Printing all functions in public schema...');
    const { data } = await supabase.rpc('exec_query', {
        p_sql: "SELECT proname, pg_get_function_arguments(oid) as args FROM pg_proc JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid WHERE nspname = 'public' ORDER BY proname"
    });

    if (data) {
        data.forEach((f: any) => {
            console.log(`${f.proname}(${f.args})`);
        });
    }
}

run();
