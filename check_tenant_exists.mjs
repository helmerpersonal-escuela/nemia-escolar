import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkTenant() {
    const tenantId = 'efc61ce1-32c2-47b6-9751-95becd7ddc33'
    const sql = `SELECT id FROM tenants WHERE id = '${tenantId}'`;

    const leakSql = `DO $$ BEGIN IF EXISTS (SELECT 1 FROM tenants WHERE id = '${tenantId}') THEN RAISE EXCEPTION 'EXISTS:YES'; ELSE RAISE EXCEPTION 'EXISTS:NO'; END IF; END $$;`;
    const { error: leakError } = await supabase.rpc('exec_sql', { sql_query: leakSql });

    console.log('TENANT CHECK:', leakError?.message);
}

checkTenant()
