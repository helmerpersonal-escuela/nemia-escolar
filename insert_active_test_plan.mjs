import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function insertTestPlan() {
    const tenantId = 'efc61ce1-32c2-47b6-97b1-95becd7ddc33' // Verified Tenant ID
    const groupId = '5c444b42-4db3-43a4-bac6-5f0922ecdacc'
    const subjectId = 'c63901ba-b28d-43b8-8c02-b805db38643a'
    const periodId = '942db521-ea10-4106-bcda-028960a94be6'

    const sql = `
        INSERT INTO lesson_plans (
            tenant_id, group_id, subject_id, period_id, title, campo_formativo, metodologia, problem_context, 
            activities_sequence, evaluation_plan, pda, contents, objectives, ejes_articuladores, resources
        ) VALUES (
            '${tenantId}', 
            '${groupId}', 
            '${subjectId}', 
            '${periodId}', 
            'PLAN PRUEBA ESPAÑOL VUNLEK', 
            'Lenguajes', 
            'Aprendizaje Basado en Proyectos (ABP)', 
            'Prueba de visibilidad final', 
            '[]'::jsonb, 
            '{"instruments": ["Prueba"]}'::jsonb, 
            '["PDA prueba"]'::jsonb, 
            '["Contenido prueba"]'::jsonb,
            '["Objetivo prueba"]'::jsonb,
            '["Inclusión"]'::jsonb,
            ARRAY['Recurso prueba']::text[]
        );
    `;

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
        console.error('Insert failed:', JSON.stringify(error, null, 2))
    } else {
        console.log('Insert successful for ACTIVE IDs (Correct Tenant)!')
    }
}

insertTestPlan()
