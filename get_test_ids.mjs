import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function getIds() {
    const sql = `
        SELECT json_build_object(
            'group', (SELECT json_build_object('id', id, 'tenant_id', tenant_id) FROM groups LIMIT 1),
            'subject', (SELECT json_build_object('id', id, 'custom_name', custom_name) FROM group_subjects LIMIT 1),
            'period', (SELECT json_build_object('id', id) FROM evaluation_periods LIMIT 1)
        )::text as result
    `;

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
        // Fallback leak technique if RPC fails to return string
        const leakSql = `DO $$ BEGIN RAISE EXCEPTION 'LEAK:%', (${sql}); END $$;`;
        const { error: leakError } = await supabase.rpc('exec_sql', { sql_query: leakSql });
        console.log(leakError.message);
    } else {
        // If it worked and returned something (though exec_sql returns void usually)
        console.log('Done');
    }
}

getIds()
