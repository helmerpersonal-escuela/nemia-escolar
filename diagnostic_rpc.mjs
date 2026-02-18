import { createClient } from '@supabase/supabase-js';

const VITE_SUPABASE_URL = "https://xgrwivblrrucucjhrmni.supabase.co";
const VITE_SUPABASE_ANON_KEY = "sb_publishable_LyBk7Vr49y7qxrtfS6EVsg_WjxCXsoy";

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function setupAndCheck() {
    console.log('--- CREANDO FUNCIÓN DE DIAGNÓSTICO ---');

    const sql = `
CREATE OR REPLACE FUNCTION public.get_diagnostic_info()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'group_count', (SELECT count(*) FROM public.groups),
        'subject_count', (SELECT count(*) FROM public.group_subjects),
        'plan_count', (SELECT count(*) FROM public.lesson_plans),
        'recent_plans', (SELECT coalesce(jsonb_agg(p), '[]'::jsonb) FROM (SELECT id, title, group_id, subject_id, period_id FROM public.lesson_plans ORDER BY created_at DESC LIMIT 5) p),
        'recent_groups', (SELECT coalesce(jsonb_agg(g), '[]'::jsonb) FROM (SELECT id, grade, section FROM public.groups LIMIT 5) g),
        'recent_subjects', (SELECT coalesce(jsonb_agg(s), '[]'::jsonb) FROM (SELECT id, custom_name, group_id FROM public.group_subjects LIMIT 10) s)
    ) INTO result;
    RETURN result;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.get_diagnostic_info() TO anon;
    `;

    const { error: rpcError } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (rpcError) {
        console.error('Error creando RPC:', rpcError);
        return;
    }

    console.log('RPC creado. Obteniendo datos...');
    const { data, error } = await supabase.rpc('get_diagnostic_info');
    if (error) {
        console.error('Error llamando a get_diagnostic_info:', error);
    } else {
        console.log('DATOS:', JSON.stringify(data, null, 2));
    }
}

setupAndCheck();
