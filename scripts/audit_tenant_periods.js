
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import fs from 'fs'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
    console.log('--- Finding Tenant and Periods via direct SQL ---');

    const sql = `
        WITH tenant_info AS (
            SELECT id, name FROM public.tenants LIMIT 1
        )
        SELECT 
            t.id as tenant_id,
            t.name as tenant_name,
            ep.id as period_id,
            ep.name as period_name,
            ep.start_date,
            ep.end_date
        FROM tenant_info t
        LEFT JOIN public.evaluation_periods ep ON ep.tenant_id = t.id
        ORDER BY ep.start_date;
    `;

    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error('RPC Error:', error);
        return;
    }

    console.log('Results:', JSON.stringify(data, null, 2));
    fs.writeFileSync('tenant_periods_audit.json', JSON.stringify(data, null, 2));
}

run()
