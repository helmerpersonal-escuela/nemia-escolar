import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkColumns() {
    const sql = `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'lesson_plans' 
        ORDER BY column_name;
    `;

    const leakSql = `
        DO $$ 
        DECLARE 
            result_text text;
        BEGIN 
            SELECT json_agg(t)::text INTO result_text FROM (${sql}) t;
            RAISE EXCEPTION 'COLS_LEAK:%', result_text;
        END $$;
    `;

    const { error } = await supabase.rpc('exec_sql', { sql_query: leakSql })

    if (error && error.message.includes('COLS_LEAK:')) {
        const cols = JSON.parse(error.message.split('COLS_LEAK:')[1]);
        console.log('COLUMNS FOUND:');
        cols.forEach(c => console.log(`- ${c.column_name} (${c.data_type})`));
    } else {
        console.error('Error:', error);
    }
}

checkColumns()
