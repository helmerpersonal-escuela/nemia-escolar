import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function runSQL(sql: string, label: string) {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (error) {
        console.error(`${label} ERROR:`, error.message);
        return false;
    }
    console.log(`${label} OK`);
    return true;
}

async function run() {
    // Get all data we need
    const { data: tenants } = await supabase.rpc('exec_query', {
        p_sql: "SELECT id, name FROM tenants"
    });

    const { data: students } = await supabase.rpc('exec_query', {
        p_sql: "SELECT id, first_name, last_name_paternal, last_name_maternal, tenant_id FROM students"
    });

    const results = { tenants, students };
    fs.writeFileSync('scripts/db-dump.json', JSON.stringify(results, null, 2));
    console.log('Saved to scripts/db-dump.json');
    console.log('TENANTS:', JSON.stringify(tenants, null, 2));
    console.log('STUDENTS:', JSON.stringify(students, null, 2));
}

run();
