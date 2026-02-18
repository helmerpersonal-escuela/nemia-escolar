import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkPlannings() {
    const { data, error } = await supabase.rpc('exec_sql', {
        sql_query: "SELECT id, group_id, subject_id, period_id, title, campo_formativo FROM lesson_plans"
    })

    // Leak technique if rpc returns void
    const leakSql = `DO $$ DECLARE r text; BEGIN SELECT json_agg(t)::text INTO r FROM (SELECT id, group_id, subject_id, period_id, title, campo_formativo FROM lesson_plans) t; RAISE EXCEPTION 'LEAK:%', r; END $$;`;
    const { error: leakError } = await supabase.rpc('exec_sql', { sql_query: leakSql });

    if (leakError && leakError.message.includes('LEAK:')) {
        console.log('EXISTING PLANNINGS:');
        console.log(leakError.message.split('LEAK:')[1]);
    } else {
        console.log('No plannings found or error:', leakError || error);
    }
}

checkPlannings()
