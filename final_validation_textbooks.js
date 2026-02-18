
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function finalValidation() {
    try {
        console.log('Inserting test textbook...');
        const { data, error } = await supabase.from('textbooks').insert({
            title: 'Test Book',
            level: 'SECUNDARIA',
            grade: 1,
            file_url: 'https://example.com/test.pdf'
        }).select();

        if (error) {
            console.error('Insert failed:', error.message);
            process.exit(1);
        }

        console.log('Insert succeeded! Row ID:', data[0].id);

        console.log('Deleting test textbook...');
        const { error: dError } = await supabase.from('textbooks').delete().eq('id', data[0].id);

        if (dError) {
            console.error('Delete failed:', dError.message);
            process.exit(1);
        }

        console.log('Delete succeeded! Database operations are fully functional.');

        // Final check on lesson_plans columns
        const { data: lpData, error: lpError } = await supabase.from('lesson_plans').select('textbook_id, textbook_pages_from').limit(1);
        if (lpError && lpError.code !== 'PGRST116') { // PGRST116 is empty result, which is fine
            console.error('Lesson plans column check failed:', lpError.message);
        } else {
            console.log('Lesson plans table columns verified.');
        }

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

finalValidation();
