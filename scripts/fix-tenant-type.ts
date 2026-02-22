import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    // Check tenant type
    const { data: tenants } = await supabase.rpc('exec_query', {
        p_sql: "SELECT id, name, type, educational_level FROM tenants"
    });
    console.log('TENANTS:', JSON.stringify(tenants, null, 2));

    // Fix: update tenant type to SCHOOL
    const { error } = await supabase.rpc('exec_sql', {
        sql_query: `UPDATE tenants SET type = 'SCHOOL' WHERE id = 'efc61ce1-32c2-47b6-9751-95becd7ddc33'`
    });
    if (error) console.error('FIX ERROR:', error.message);
    else console.log('FIX OK: tenant type updated to SCHOOL');

    // Verify
    const { data: after } = await supabase.rpc('exec_query', {
        p_sql: "SELECT id, name, type FROM tenants WHERE id = 'efc61ce1-32c2-47b6-9751-95becd7ddc33'"
    });
    console.log('AFTER FIX:', JSON.stringify(after, null, 2));
}

run();
