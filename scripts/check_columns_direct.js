
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkCol(col) {
    const { error } = await supabase.from('lesson_plans').select(col).limit(0);
    if (error) {
        console.log(`Column '${col}': MISSING (${error.message})`);
        return false;
    } else {
        console.log(`Column '${col}': EXISTS`);
        return true;
    }
}

async function run() {
    console.log('--- DIRECT COLUMN CHECK ---')
    await checkCol('id');
    await checkCol('activities_sequence');
    await checkCol('teacher_id');
    await checkCol('content');
    await checkCol('title');
}

run()
