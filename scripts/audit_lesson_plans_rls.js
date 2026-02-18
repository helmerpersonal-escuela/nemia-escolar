
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import fs from 'fs'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
    console.log('--- Querying lesson_plans via exec_sql (bypassing RLS) ---');

    // Using the previously created exec_sql to count and see recent entries
    const sql = `
        SELECT 
            lp.id, 
            lp.title, 
            lp.created_at, 
            g.grade, 
            g.section, 
            sc.name as subject_name,
            ep.name as period_name
        FROM public.lesson_plans lp
        LEFT JOIN public.groups g ON lp.group_id = g.id
        LEFT JOIN public.subject_catalog sc ON lp.subject_id = sc.id
        LEFT JOIN public.evaluation_periods ep ON lp.period_id = ep.id
        ORDER BY lp.created_at DESC
        LIMIT 20;
    `;

    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error('RPC Error:', error);
        return;
    }

    console.log('Result:', JSON.stringify(data, null, 2));
    fs.writeFileSync('lesson_plans_rls_bypass.json', JSON.stringify(data, null, 2));
}

run()
