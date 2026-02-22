import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('--- FINDING STUDENTS AND TENANTS ---');

    // Get all tenants
    const { data: tenants } = await supabase.rpc('exec_query', {
        p_sql: "SELECT id, name, type FROM tenants"
    });
    console.log('TENANTS:', JSON.stringify(tenants, null, 2));

    // Get student columns first
    const { data: cols } = await supabase.rpc('exec_query', {
        p_sql: "SELECT column_name FROM information_schema.columns WHERE table_name = 'students' ORDER BY ordinal_position"
    });
    console.log('STUDENT COLUMNS:', JSON.stringify(cols, null, 2));

    // Get all students
    const { data: students } = await supabase.rpc('exec_query', {
        p_sql: "SELECT id, first_name, last_name_paternal, last_name_maternal, tenant_id FROM students LIMIT 20"
    });
    console.log('STUDENTS:', JSON.stringify(students, null, 2));
}

run();
