
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testInsert() {
    const dummyData = {
        title: 'Test Planning',
        group_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
        subject_id: null,
        period_id: null,
        temporality: 'WEEKLY',
        purpose: 'Test Purpose',
        project_duration: 10,
        start_date: '2026-01-01',
        end_date: '2026-01-07',
        campo_formativo: 'Lenguajes',
        metodologia: 'ABP',
        problem_context: 'Test Context',
        objectives: [],
        contents: [],
        pda: [],
        ejes_articuladores: [],
        activities_sequence: [],
        resources: [],
        evaluation_plan: {},
        source_document_url: null,
        extracted_text: null,
        textbook_id: null,
        textbook_pages_from: null,
        textbook_pages_to: null,
        tenant_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
        updated_at: new Date().toISOString()
    }

    console.log('Testing insert into lesson_plans...')
    const { error } = await supabase.from('lesson_plans').insert([dummyData])

    if (error) {
        console.error('INSERT ERROR:', error);
    } else {
        console.log('Insert successful (or at least no schema error)');
    }
}

testInsert()
