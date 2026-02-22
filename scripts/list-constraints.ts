import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('--- TABLE CONSTRAINTS ---');
    const { data } = await supabase.rpc('exec_query', {
        p_sql: "SELECT conname, pg_get_constraintdef(oid) as def FROM pg_constraint WHERE conrelid IN ('profile_tenants'::regclass, 'guardians'::regclass) AND contype IN ('p', 'u')"
    });
    console.log(JSON.stringify(data, null, 2));
}

run();
