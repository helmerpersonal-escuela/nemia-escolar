import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('Fetching DDLs...');
    const queries = {
        exec_query: "SELECT prosrc, prosecdef FROM pg_proc WHERE proname = 'exec_query'",
        log_profile_changes: "SELECT prosrc FROM pg_proc WHERE proname = 'log_profile_changes'",
        on_profile_update_audit_log: "SELECT prosrc FROM pg_proc WHERE proname = 'on_profile_update_audit_log'",
        triggers: "SELECT tgname, tgenabled, pg_get_triggerdef(oid) as def FROM pg_trigger WHERE tgrelid = 'profiles'::regclass AND NOT tgisinternal"
    };

    const results: any = {};
    for (const [name, sql] of Object.entries(queries)) {
        const { data, error } = await supabase.rpc('exec_query', { p_sql: sql });
        results[name] = data;
    }

    fs.writeFileSync('scripts/rpc-ddl-output.json', JSON.stringify(results, null, 2));
    console.log('Results saved to scripts/rpc-ddl-output.json');
}

run();
