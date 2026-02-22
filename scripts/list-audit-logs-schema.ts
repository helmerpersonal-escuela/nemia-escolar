import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('--- AUDIT_LOGS SCHEMA ---');
    const { data: cols } = await supabase.rpc('exec_query', {
        p_sql: "SELECT column_name FROM information_schema.columns WHERE table_name = 'audit_logs'"
    });
    console.log('Columns:', JSON.stringify(cols, null, 2));

    const { data: fks } = await supabase.rpc('exec_query', {
        p_sql: `
            SELECT
                tc.constraint_name, 
                kcu.column_name, 
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name 
            FROM 
                information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                  ON ccu.constraint_name = tc.constraint_name
                  AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='audit_logs';
        `
    });
    console.log('FKs:', JSON.stringify(fks, null, 2));
}

run();
