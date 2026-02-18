import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function getIds() {
    const query = `
        SELECT json_build_object(
            'group', (SELECT json_build_object('id', id, 'tenant_id', tenant_id) FROM groups LIMIT 1),
            'subject', (SELECT json_build_object('id', id, 'custom_name', custom_name) FROM group_subjects LIMIT 1),
            'period', (SELECT json_build_object('id', id) FROM evaluation_periods LIMIT 1)
        )::text
    `;

    const sql = `
        DO $$ 
        DECLARE 
            val text;
        BEGIN 
            val := (${query});
            RAISE EXCEPTION 'ID_LEAK:%', val;
        END $$;
    `;

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error && error.message.includes('ID_LEAK:')) {
        console.log(error.message.split('ID_LEAK:')[1]);
    } else {
        console.error('Error or no leak:', error);
    }
}

getIds()
