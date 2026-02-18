import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function getTenantId() {
    const userId = '85870a47-4730-401d-a96c-a3712e821b3d'
    const sql = `SELECT tenant_id FROM profiles WHERE id = '${userId}'`;

    const leakSql = `DO $$ DECLARE r text; BEGIN SELECT tenant_id::text INTO r FROM profiles WHERE id = '${userId}'; RAISE EXCEPTION 'TENANT_LEAK:%', r; END $$;`;
    const { error: leakError } = await supabase.rpc('exec_sql', { sql_query: leakSql });

    if (leakError && leakError.message.includes('TENANT_LEAK:')) {
        console.log('TENANT ID FOUND:', leakError.message.split('TENANT_LEAK:')[1]);
    } else {
        console.error('Error finding tenant:', leakError);
    }
}

getTenantId()
