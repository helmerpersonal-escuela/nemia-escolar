
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
    console.log('--- CONSTRAINT TEST (Phase 3) ---')

    // Using CAST to be absolutely sure about types
    const sql = `INSERT INTO public.lesson_plans (id, tenant_id) VALUES (gen_random_uuid(), 'ec667500-47b6-9751-95becd7ddc33'::uuid);`;

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.log('CONSTRAINT ERROR:', JSON.stringify(error, null, 2));
    } else {
        console.log('SUCCESS? This means no other mandatory columns exist!');
    }
}

run()
