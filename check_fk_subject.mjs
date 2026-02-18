import { createClient } from '@supabase/supabase-js';

const VITE_SUPABASE_URL = "https://xgrwivblrrucucjhrmni.supabase.co";
const VITE_SUPABASE_ANON_KEY = "sb_publishable_LyBk7Vr49y7qxrtfS6EVsg_WjxCXsoy";

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function checkConstraints() {
    console.log('--- REVISANDO RESTRICCIONES DE lesson_plans ---');

    const sql = `
DO $$
DECLARE
    subject_fk_exists BOOLEAN;
    all_cons TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'public.lesson_plans'::regclass 
        AND conname = 'lesson_plans_subject_id_fkey'
    ) INTO subject_fk_exists;

    SELECT string_agg(conname, ' | ') INTO all_cons
    FROM pg_constraint
    WHERE conrelid = 'public.lesson_plans'::regclass;

    RAISE EXCEPTION 'FK_CHECK|EXISTS:%|ALL:%', subject_fk_exists, all_cons;
END;
$$;
    `;

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (error) {
        const match = error.message.match(/FK_CHECK\|EXISTS:(.*)\|ALL:(.*)/);
        if (match) {
            console.log('¿Existe FK de subject_id?:', match[1]);
            console.log('Todas las restricciones:', match[2]);
        } else {
            console.error('Error (sin datos):', error.message);
        }
    } else {
        console.log('No hubo error.');
    }
}

checkConstraints();
