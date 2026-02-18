
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import fs from 'fs'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
    console.log('--- Attempting Test Insert into lesson_plans ---');

    // Fetch some IDs to make it valid
    const { data: tenant } = await supabase.from('tenants').select('id').limit(1).single();
    const { data: group } = await supabase.from('groups').select('id').limit(1).single();

    if (!tenant || !group) {
        console.error('Could not find tenant or group for test');
        return;
    }

    const testPlan = {
        tenant_id: tenant.id,
        group_id: group.id,
        title: 'TEST PLAN ' + new Date().toISOString(),
        temporality: 'WEEKLY',
        campo_formativo: 'Lenguajes',
        metodologia: 'Aprendizaje Basado en Proyectos (ABP)',
        activities_sequence: [],
        evaluation_plan: { instruments: [] },
        ejes_articuladores: [],
        contents: [],
        pda: [],
        objectives: [],
        resources: []
    };

    const { data, error } = await supabase.from('lesson_plans').insert([testPlan]).select();

    if (error) {
        console.error('INSERT ERROR:', JSON.stringify(error, null, 2));
        fs.writeFileSync('insert_error.json', JSON.stringify(error, null, 2));
    } else {
        console.log('INSERT SUCCESS:', data);
        // Delete it immediately to keep it clean
        await supabase.from('lesson_plans').delete().eq('id', data[0].id);
    }
}

run()
