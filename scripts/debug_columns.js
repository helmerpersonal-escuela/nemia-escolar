
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function debug() {
    console.log('--- GLOBAL TABLE SEARCH ---')

    const sql = `
        SELECT table_schema, table_name 
        FROM information_schema.tables 
        WHERE table_name = 'lesson_plans';
    `;

    const { data: tables, error: tableError } = await supabase.rpc('exec_sql', { sql_query: sql });
    console.log('Tables found:', tables);

    const sqlCols = `
        SELECT table_schema, column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'lesson_plans';
    `;
    const { data: cols, error: colError } = await supabase.rpc('exec_sql', { sql_query: sqlCols });
    console.log('Global columns found:', cols);
}

debug()
