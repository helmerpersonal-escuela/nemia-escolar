
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import fs from 'fs'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
    const { data: cols, error: colError } = await supabase.rpc('inspect_table_schema', { t_name: 'students' });

    if (colError) {
        fs.writeFileSync('students_schema.json', JSON.stringify({ error: colError }, null, 2));
        return;
    }

    fs.writeFileSync('students_schema.json', JSON.stringify(cols, null, 2));
}

run()
