import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function dumpData() {
    console.log('--- DUMPING DATA ---')

    const query = `
        SELECT 'GROUPS' as type, json_agg(t) as data FROM (SELECT id, grade, section, tenant_id FROM groups LIMIT 5) t
        UNION ALL
        SELECT 'SUBJECTS' as type, json_agg(t) as data FROM (SELECT id, custom_name, group_id, subject_catalog_id FROM group_subjects LIMIT 5) t
        UNION ALL
        SELECT 'PERIODS' as type, json_agg(t) as data FROM (SELECT id, name, tenant_id FROM evaluation_periods LIMIT 5) t
    `;

    // We use a leak technique: throw an error with the data
    const sql = `
        DO $$ 
        DECLARE 
            result_text text;
        BEGIN 
            SELECT json_agg(r)::text INTO result_text FROM (${query}) r;
            RAISE EXCEPTION 'DATA_LEAK: %', result_text;
        END $$;
    `;

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
        if (error.message.includes('DATA_LEAK:')) {
            const dataStr = error.message.split('DATA_LEAK: ')[1]
            console.log(JSON.stringify(JSON.parse(dataStr), null, 2))
        } else {
            console.error('Error:', error)
        }
    } else {
        console.log('No data returned (unexpected)')
    }
}

dumpData()
