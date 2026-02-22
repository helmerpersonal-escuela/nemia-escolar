import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    const { data } = await supabase.rpc('exec_query', {
        p_sql: "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'profile_tenants'"
    });
    console.log('PT INDEXES:', JSON.stringify(data, null, 2));
}

run();
