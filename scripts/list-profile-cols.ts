import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    const { data } = await supabase.rpc('exec_query', {
        p_sql: "SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles'"
    });
    console.log('COLUMNS:', JSON.stringify(data, null, 2));
}

run();
