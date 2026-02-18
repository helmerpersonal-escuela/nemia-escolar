
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import fs from 'fs'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
    console.log('--- Fetching valid IDs via direct SQL ---');

    const fetchIdsSql = `
        SELECT 
            (SELECT id FROM public.tenants LIMIT 1) as tenant_id,
            (SELECT id FROM public.groups LIMIT 1) as group_id,
            (SELECT id FROM public.subject_catalog LIMIT 1) as subject_id,
            (SELECT id FROM public.evaluation_periods LIMIT 1) as period_id
    `;

    const { data: idData, error: idError } = await supabase.rpc('exec_sql', { sql_query: fetchIdsSql });

    if (idError || !idData || idData.length === 0) {
        console.error('Could not fetch IDs:', idError);
        return;
    }

    const { tenant_id, group_id, subject_id, period_id } = idData[0];
    console.log('Found IDs:', { tenant_id, group_id, subject_id, period_id });

    console.log('--- Attempting Test Insert into lesson_plans ---');

    const testPlan = {
        tenant_id,
        group_id,
        subject_id,
        period_id,
        title: 'TEST PLAN ' + new Date().toISOString(),
        temporality: 'WEEKLY',
        start_date: '2026-02-17',
        end_date: '2026-02-24',
        campo_formativo: 'Lenguajes',
        metodologia: 'Aprendizaje Basado en Proyectos (ABP)',
        problem_context: 'Contexto de prueba',
        purpose: 'Proposito de prueba',
        project_duration: 10,
        objectives: ['Objetivo 1'],
        contents: ['Contenido 1'],
        pda: ['PDA 1'],
        ejes_articuladores: ['Inclusión'],
        activities_sequence: [],
        resources: ['Recurso 1'],
        evaluation_plan: { instruments: ['Instrumento 1'] },
        status: 'ACTIVE'
    };

    const { data, error } = await supabase.from('lesson_plans').insert([testPlan]).select();

    if (error) {
        console.error('INSERT ERROR:', JSON.stringify(error, null, 2));
        fs.writeFileSync('insert_error_detailed.json', JSON.stringify(error, null, 2));
    } else {
        console.log('INSERT SUCCESS:', data);
        // await supabase.from('lesson_plans').delete().eq('id', data[0].id);
    }
}

run()
