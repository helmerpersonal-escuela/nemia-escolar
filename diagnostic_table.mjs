import { createClient } from '@supabase/supabase-js';

const VITE_SUPABASE_URL = "https://xgrwivblrrucucjhrmni.supabase.co";
const VITE_SUPABASE_ANON_KEY = "sb_publishable_LyBk7Vr49y7qxrtfS6EVsg_WjxCXsoy";

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function checkWithTable() {
    console.log('--- USANDO TABLA TEMPORAL PARA DIAGNÓSTICO ---');

    const sql = `
CREATE TABLE IF NOT EXISTS public.temp_diagnostic (data JSONB);
TRUNCATE public.temp_diagnostic;
INSERT INTO public.temp_diagnostic (data)
SELECT jsonb_build_object(
    'group_count', (SELECT count(*) FROM public.groups),
    'subject_count', (SELECT count(*) FROM public.group_subjects),
    'plan_count', (SELECT count(*) FROM public.lesson_plans),
    'recent_plans', (SELECT coalesce(jsonb_agg(p), '[]'::jsonb) FROM (SELECT id, title, group_id, subject_id, period_id FROM public.lesson_plans ORDER BY created_at DESC LIMIT 5) p),
    'recent_groups', (SELECT coalesce(jsonb_agg(g), '[]'::jsonb) FROM (SELECT id, grade, section FROM public.groups LIMIT 5) g),
    'recent_subjects', (SELECT coalesce(jsonb_agg(s), '[]'::jsonb) FROM (SELECT id, custom_name, group_id FROM public.group_subjects LIMIT 10) s)
);
GRANT SELECT ON public.temp_diagnostic TO anon;
    `;

    const { error: execError } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (execError) {
        console.error('Error ejecutando SQL:', execError);
        return;
    }

    console.log('SQL ejecutado. Leyendo tabla temp_diagnostic...');
    const { data, error } = await supabase.from('temp_diagnostic').select('*').single();
    if (error) {
        console.error('Error leyendo tabla temp_diagnostic:', error);
    } else {
        console.log('DATOS:', JSON.stringify(data.data, null, 2));
    }
}

checkWithTable();
