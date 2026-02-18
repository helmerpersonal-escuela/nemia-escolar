import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function getGroupTenant() {
    const groupId = '5c444b42-4db3-43a4-bac6-5f0922ecdacc'
    const leakSql = `DO $$ DECLARE r text; BEGIN SELECT tenant_id::text INTO r FROM groups WHERE id = '${groupId}'; RAISE EXCEPTION 'GROUP_TENANT_LEAK|%|END', r; END $$;`;
    const { error: leakError } = await supabase.rpc('exec_sql', { sql_query: leakSql });

    if (leakError && leakError.message.includes('GROUP_TENANT_LEAK|')) {
        const id = leakError.message.split('|')[1];
        console.log('GROUP_TENANT_FOUND:' + id);
    } else {
        console.error('Error finding group tenant:', leakError);
    }
}

getGroupTenant()
