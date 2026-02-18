
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
    console.log('--- TARGETED SCHEMA VERIFICATION ---')

    // Explicitly check for these columns
    const columnsToVerify = [
        'title', 'group_id', 'subject_id', 'period_id', 'temporality', 'purpose',
        'project_duration', 'start_date', 'end_date', 'campo_formativo',
        'metodologia', 'problem_context', 'objectives', 'contents', 'pda',
        'ejes_articuladores', 'activities_sequence', 'resources', 'evaluation_plan',
        'source_document_url', 'extracted_text', 'textbook_id',
        'textbook_pages_from', 'textbook_pages_to', 'tenant_id', 'updated_at'
    ];

    const { data: cols, error } = await supabase.rpc('inspect_table_schema', { t_name: 'lesson_plans' });

    if (error) {
        console.error('Error Calling RPC:', error);
        return;
    }

    const existingCols = cols.map(c => c.column);
    const missing = columnsToVerify.filter(c => !existingCols.includes(c));

    if (missing.length > 0) {
        console.log('MISSING COLUMNS FOUND:', missing);
    } else {
        console.log('ALL REQUIRED COLUMNS PRESENT!');
    }

    console.log('FULL COLUMN LIST:', existingCols);
}

run()
