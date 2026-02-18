import { createClient } from '@supabase/supabase-js';

const VITE_SUPABASE_URL = "https://xgrwivblrrucucjhrmni.supabase.co";
const VITE_SUPABASE_ANON_KEY = "sb_publishable_LyBk7Vr49y7qxrtfS6EVsg_WjxCXsoy";

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function diagnostic() {
    console.log('--- DIAGNÓSTICO DE DATOS ---');

    // 1. Grupos
    const { data: groups } = await supabase.from('groups').select('id, grade, section, name');
    console.log('GRUPOS ENCONTRADOS:', groups?.length || 0);
    if (groups && groups.length > 0) {
        console.log('Muestra de Grupos:', JSON.stringify(groups.slice(0, 3), null, 2));
    }

    // 2. Planeaciones
    const { data: plans } = await supabase.from('lesson_plans').select('id, title, group_id, subject_id, period_id, campo_formativo');
    console.log('PLANEACIONES ENCONTRADAS:', plans?.length || 0);
    if (plans && plans.length > 0) {
        console.log('Muestra de Planeaciones:', JSON.stringify(plans.slice(0, 5), null, 2));
    }

    // 3. Materias del Grupo
    const { data: groupSubjects } = await supabase.from('group_subjects').select('id, custom_name, group_id');
    console.log('MATERIAS DE GRUPO ENCONTRADAS:', groupSubjects?.length || 0);
    if (groupSubjects && groupSubjects.length > 0) {
        console.log('Muestra de Materias:', JSON.stringify(groupSubjects.slice(0, 5), null, 2));
    }

    // 4. Periodos
    const { data: periods } = await supabase.from('evaluation_periods').select('id, name, is_active');
    console.log('PERIODOS ENCONTRADOS:', periods?.length || 0);
    if (periods) {
        console.log('Periodos:', JSON.stringify(periods, null, 2));
    }
}

diagnostic();
