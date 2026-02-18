
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function inspectTable() {
    const sql = `
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'lesson_plans' 
    AND table_schema = 'public';
  `
    // We can't get result from exec_sql if it's returns void.
    // Let's check if there is an rpc that returns table? 
    // Probably not. 
}

// Alternative: Try to select * and see what we get or use a more descriptive error.
async function trySelectStar() {
    const { data, error } = await supabase
        .from('lesson_plans')
        .select('*')
        .limit(1);

    if (error) {
        console.log('SELECT * ERROR:', error.message);
    } else {
        console.log('COLUMNS FOUND:', Object.keys(data[0] || {}).join(', '));
    }
}

trySelectStar()
