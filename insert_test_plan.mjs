import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function insertTestPlan() {
    const tenantId = 'efc68634-9c10-4507-857a-95becd1ceb22'
    const groupId = '942db521-ea94-43ea-9fc6-9426f8c47b64'
    const subjectId = 'ffae491d-2396-48a5-8321-7290f6c1286c'
    const periodId = 'd7ddc33c-39d2-47b6-97b1-95becd1ceb22'

    const sql = `
        INSERT INTO lesson_plans (
            tenant_id, group_id, subject_id, period_id, title, campo_formativo, metodologia, problem_context, 
            activities_sequence, evaluation_plan, pda, contents, objectives, ejes_articuladores, resources
        ) VALUES (
            '${tenantId}', 
            '${groupId}', 
            '${subjectId}', 
            '${periodId}', 
            'PLAN PRUEBA ANTIGRAVITY', 
            'Lenguajes', 
            'Aprendizaje Basado en Proyectos (ABP)', 
            'Prueba de inserción manual', 
            '[]'::jsonb, 
            '{"instruments": ["Prueba"]}'::jsonb, 
            ARRAY['PDA prueba']::text[], 
            ARRAY['Contenido prueba']::text[],
            ARRAY['Objetivo prueba']::text[],
            ARRAY['Inclusión']::text[],
            ARRAY['Recurso prueba']::text[]
        );
    `;

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
        console.error('Insert failed:', JSON.stringify(error, null, 2))
    } else {
        console.log('Insert successful via exec_sql!')
    }
}

insertTestPlan()
