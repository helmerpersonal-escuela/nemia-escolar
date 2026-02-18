
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import fs from 'fs'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
    const tables = ['tenants', 'groups', 'profiles', 'lesson_plans', 'evaluation_periods', 'subject_catalog'];
    const results = {};

    console.log('--- Checking Visibility for Anon ---');
    for (const table of tables) {
        const { data, count, error } = await supabase.from(table).select('*', { count: 'exact' }).limit(1);
        results[table] = {
            has_data: !!data && data.length > 0,
            count: count,
            error: error ? error.message : null
        };
        console.log(`${table}: ${results[table].has_data ? 'VISIBLE (' + count + ')' : 'HIDDEN/EMPTY'} ${error ? '(' + error.message + ')' : ''}`);
    }

    fs.writeFileSync('visibility_audit.json', JSON.stringify(results, null, 2));
}

run()
