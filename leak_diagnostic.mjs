import { createClient } from '@supabase/supabase-js';

const VITE_SUPABASE_URL = "https://xgrwivblrrucucjhrmni.supabase.co";
const VITE_SUPABASE_ANON_KEY = "sb_publishable_LyBk7Vr49y7qxrtfS6EVsg_WjxCXsoy";

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function leakData() {
    console.log('--- EXTRAYENDO DATOS VÍA EXCEPCIÓN ---');

    const sql = `
DO $$
DECLARE
    info JSONB;
BEGIN
    SELECT jsonb_build_object(
        'plan_count', (SELECT count(*) FROM public.lesson_plans),
        'group_count', (SELECT count(*) FROM public.groups),
        'subject_count', (SELECT count(*) FROM public.group_subjects),
        'recent_plans', (SELECT coalesce(jsonb_agg(p), '[]'::jsonb) FROM (SELECT id, title, group_id, subject_id, period_id FROM public.lesson_plans ORDER BY created_at DESC LIMIT 5) p),
        'recent_groups', (SELECT coalesce(jsonb_agg(g), '[]'::jsonb) FROM (SELECT id, grade, section, name FROM public.groups LIMIT 5) g),
        'recent_subjects', (SELECT coalesce(jsonb_agg(s), '[]'::jsonb) FROM (SELECT id, custom_name, group_id FROM public.group_subjects LIMIT 10) s)
    ) INTO info;
    RAISE EXCEPTION 'DIAGNOSTIC_DATA:%', info::text;
END;
$$;
    `;

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (error) {
        // Look for our marker in the error message
        const match = error.message.match(/DIAGNOSTIC_DATA:(.*)/);
        if (match) {
            try {
                const data = JSON.parse(match[1]);
                console.log('DATOS EXTRAÍDOS:', JSON.stringify(data, null, 2));
            } catch (e) {
                console.log('Error parseando datos:', match[1]);
            }
        } else {
            console.error('Error (sin datos):', error.message);
        }
    } else {
        console.log('No hubo error (no se extrajeron datos).');
    }
}

leakData();
