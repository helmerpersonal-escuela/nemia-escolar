import { createClient } from '@supabase/supabase-js';

const VITE_SUPABASE_URL = "https://xgrwivblrrucucjhrmni.supabase.co";
const VITE_SUPABASE_ANON_KEY = "sb_publishable_LyBk7Vr49y7qxrtfS6EVsg_WjxCXsoy";

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function checkSchema() {
    console.log('--- VERIFICANDO ESQUEMA DE lesson_plans ---');

    const sql = `
DO $$
DECLARE
    cols TEXT;
    cons TEXT;
BEGIN
    SELECT string_agg(column_name || ' (' || data_type || ')', ', ') INTO cols
    FROM information_schema.columns
    WHERE table_name = 'lesson_plans' AND table_schema = 'public';

    SELECT string_agg(conname, ', ') INTO cons
    FROM pg_constraint
    WHERE conrelid = 'public.lesson_plans'::regclass;

    RAISE EXCEPTION 'SCHEMA_INFO|COLUMNS:%|CONSTRAINTS:%', cols, cons;
END;
$$;
    `;

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (error) {
        const match = error.message.match(/SCHEMA_INFO\|COLUMNS:(.*)\|CONSTRAINTS:(.*)/);
        if (match) {
            console.log('COLUMNAS:', match[1]);
            console.log('RESTRICCIONES:', match[2]);
        } else {
            console.error('Error (sin datos):', error.message);
        }
    } else {
        console.log('No hubo error.');
    }
}

checkSchema();
