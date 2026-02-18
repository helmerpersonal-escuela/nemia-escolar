import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkGroupsSchema() {
    const leakSql = `
    DO $$ 
    DECLARE 
        cols text; 
    BEGIN 
        SELECT string_agg(column_name, ', ') INTO cols FROM information_schema.columns WHERE table_name = 'groups'; 
        RAISE EXCEPTION 'COLS:%', cols; 
    END $$;`;

    const { error } = await supabase.rpc('exec_sql', { sql_query: leakSql });
    console.log('GROUPS COLUMNS:', error?.message);
}

checkGroupsSchema()
