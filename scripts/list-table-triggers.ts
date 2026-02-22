import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('--- LISTING TRIGGERS ---');
    const tables = ['profile_tenants', 'guardians'];

    for (const table of tables) {
        console.log(`Table: ${table}`);
        const { data } = await supabase.rpc('exec_query', {
            p_sql: `SELECT tgname, pg_get_triggerdef(oid) as def FROM pg_trigger WHERE tgrelid = '${table}'::regclass AND NOT tgisinternal`
        });
        console.log(JSON.stringify(data, null, 2));
    }
}

run();
